/**
 * Post detail screen.
 *
 * Architectural role:
 *  Dedicated route for a single post — the destination for like and
 *  comment notifications, hashtag drills, and any deep-link into a
 *  specific thread. Renders the post with the same `PostCard` used on
 *  the feed, then the full comment list inline below it. Keeps the
 *  user's mental model consistent across surfaces — same card, same
 *  actions, just framed by a stack header.
 *
 * Why not reuse CommentsModal:
 *  The modal is bound to the home/profile feed's selection state. A
 *  notification tap should land on a stable, addressable URL, not pop a
 *  modal that disappears on dismiss. Stack navigation also gives us
 *  back-button support out of the box.
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Text } from "@/components/ui/Text";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import PostCard from "@/components/PostCard";
import PostMenu from "@/components/PostMenu";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCommentsForPost } from "@/hooks/useCommentsForPost";
import { useCommentLike } from "@/hooks/useCommentLike";
import { useComments } from "@/hooks/useComments";
import { usePosts } from "@/hooks/usePosts";
import { groupComments } from "@/utils/commentGrouping";
import { postApi, useApiClient } from "@/utils/api";
import { formatDate } from "@/utils/formatter";
import type { Comment, Post } from "@/types";

export default function PostDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radii } = useTheme();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const api = useApiClient();
  const queryClient = useQueryClient();

  const { currentUser } = useCurrentUser();
  const {
    toggleLike,
    toggleReshare,
    deletePost,
    checkIsLiked,
    checkIsReshared,
  } = usePosts();

  const {
    data: post,
    isLoading,
    error,
  } = useQuery<Post | null>({
    queryKey: ["post", postId],
    queryFn: async () => {
      if (!postId) return null;
      const response = await postApi.getPost<Post>(api, postId);
      return response.data.post;
    },
    enabled: !!postId,
    staleTime: 30_000,
  });

  const { comments, isLoading: commentsLoading } = useCommentsForPost(postId);
  const { toggleLike: toggleCommentLike } = useCommentLike(postId ?? null);
  const {
    commentText,
    setCommentText,
    createComment,
    isCreatingComment,
    replyTarget,
    setReplyTarget,
    cancelReply,
  } = useComments();
  const [menuOpen, setMenuOpen] = useState(false);
  const threads = useMemo(() => groupComments(comments), [comments]);

  // Local handlers — wire the post-card actions through the same mutations
  // the feed uses so a like / delete keeps the cache coherent everywhere.
  const handleLike = useCallback(() => {
    if (!post) return;
    toggleLike(post._id);
  }, [post, toggleLike]);

  const handleReshare = useCallback(() => {
    if (!post) return;
    toggleReshare(post._id);
  }, [post, toggleReshare]);

  const handleComment = useCallback(() => {
    // We're already on the post detail screen — focus is on the inline
    // composer. No navigation needed; the user is here to type.
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deletePost(id);
      // After delete, return to whence the user came.
      router.back();
    },
    [deletePost, router]
  );

  const handleSubmit = useCallback(() => {
    if (!post || !commentText.trim()) return;
    createComment(post._id);
    // Refresh the local detail query so the new commentCount surfaces.
    queryClient.invalidateQueries({ queryKey: ["post", post._id] });
  }, [commentText, createComment, post, queryClient]);

  const isLiked = useMemo(() => {
    if (!post) return false;
    const source = post.originalPost ?? post;
    return checkIsLiked(source.likes, currentUser);
  }, [checkIsLiked, currentUser, post]);

  const isReshared = useMemo(
    () => (post ? checkIsReshared(post, currentUser) : false),
    [checkIsReshared, currentUser, post]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
      <SafeAreaView edges={["top"]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            gap: spacing.md,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border.subtle,
          }}
        >
          <IconButton
            accessibilityLabel="Back"
            onPress={() => router.back()}
            variant="filled"
          >
            <Feather name="arrow-left" size={18} color={colors.text.primary} />
          </IconButton>
          <Text variant="title" tone="primary" style={{ flex: 1 }}>
            Post
          </Text>
          {post ? (
            <IconButton
              accessibilityLabel="More options"
              onPress={() => setMenuOpen(true)}
              variant="ghost"
            >
              <Feather
                name="more-horizontal"
                size={20}
                color={colors.text.primary}
              />
            </IconButton>
          ) : null}
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        {isLoading ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator color={colors.tint.primary} />
          </View>
        ) : error || !post ? (
          <EmptyState
            icon={<Feather name="alert-triangle" size={28} color={colors.tint.danger} />}
            title="We couldn't load this post"
            description="It may have been deleted, or the link is broken."
            action={<Button label="Go back" variant="secondary" onPress={() => router.back()} />}
          />
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            <PostCard
              post={post}
              currentUser={currentUser}
              isLiked={isLiked}
              isReshared={isReshared}
              onLike={handleLike}
              onReshare={handleReshare}
              onComment={handleComment}
              onDelete={handleDelete}
            />

            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.md,
                paddingBottom: spacing.sm,
              }}
            >
              <Text variant="label" tone="tertiary" weight="700">
                {comments.length}{" "}
                {comments.length === 1 ? "comment" : "comments"}
              </Text>
            </View>

            {commentsLoading ? (
              <View
                style={{
                  paddingVertical: spacing.lg,
                  alignItems: "center",
                }}
              >
                <ActivityIndicator color={colors.tint.primary} />
              </View>
            ) : comments.length === 0 ? (
              <EmptyState
                icon={
                  <Feather
                    name="message-square"
                    size={26}
                    color={colors.tint.primary}
                  />
                }
                title="Be the first to reply"
                description="A short, kind reply goes further than a clever one."
              />
            ) : (
              <View style={{ paddingHorizontal: spacing.lg }}>
                {threads.map(({ root, replies }) => (
                  <View key={root._id}>
                    <DetailCommentRow
                      comment={root}
                      currentUserId={currentUser?._id ?? null}
                      onLike={() => toggleCommentLike(root._id)}
                      onReply={() => setReplyTarget(root)}
                    />
                    {replies.length > 0 ? (
                      <View style={{ paddingLeft: 48 }}>
                        {replies.map((r) => (
                          <DetailCommentRow
                            key={r._id}
                            comment={r}
                            currentUserId={currentUser?._id ?? null}
                            onLike={() => toggleCommentLike(r._id)}
                            onReply={() => setReplyTarget(root)}
                            compact
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {post ? (
          <SafeAreaView edges={["bottom"]}>
            {/* Replying-to pill — surfaced as soon as a CommentRow's
                Reply button is tapped. Tapping the x cancels. */}
            {replyTarget ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.xs + 2,
                  backgroundColor: colors.surface.secondary,
                  borderTopWidth: 0.5,
                  borderTopColor: colors.border.subtle,
                  gap: spacing.sm,
                }}
              >
                <Feather
                  name="corner-up-left"
                  size={14}
                  color={colors.tint.primary}
                />
                <Text
                  variant="caption"
                  tone="secondary"
                  style={{ flex: 1 }}
                >
                  Replying to{" "}
                  <Text variant="caption" tone="tint" weight="800">
                    @{replyTarget.user.username}
                  </Text>
                </Text>
                <Pressable
                  onPress={cancelReply}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel reply"
                >
                  <Feather name="x" size={14} color={colors.text.tertiary} />
                </Pressable>
              </View>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.sm,
                borderTopWidth: 0.5,
                borderTopColor: colors.border.subtle,
                backgroundColor: colors.bg.canvas,
              }}
            >
              <Avatar
                source={currentUser?.profilePicture}
                name={`${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`}
                size={32}
              />
              <View
                style={{
                  flex: 1,
                  borderRadius: radii.xl,
                  backgroundColor: colors.surface.secondary,
                  paddingHorizontal: spacing.base,
                  paddingVertical: 6,
                  minHeight: 40,
                  maxHeight: 120,
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                  justifyContent: "center",
                }}
              >
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder={
                    replyTarget
                      ? `Reply to @${replyTarget.user.username}`
                      : `Reply to @${post.user.username}`
                  }
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                  style={{
                    fontSize: 15,
                    lineHeight: 20,
                    color: colors.text.primary,
                    minHeight: 24,
                    padding: 0,
                  }}
                />
              </View>
              <Pressable
                onPress={handleSubmit}
                disabled={!commentText.trim() || isCreatingComment}
                accessibilityRole="button"
                accessibilityLabel="Send reply"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: commentText.trim()
                    ? colors.tint.primary
                    : colors.surface.sunken,
                }}
              >
                <Feather
                  name="send"
                  size={18}
                  color={
                    commentText.trim() ? colors.text.onTint : colors.text.tertiary
                  }
                />
              </Pressable>
            </View>
          </SafeAreaView>
        ) : null}
      </KeyboardAvoidingView>

      <PostMenu
        post={menuOpen ? post ?? null : null}
        onClose={() => setMenuOpen(false)}
        isOwn={!!post && !!currentUser && post.user._id === currentUser._id}
        onDelete={(id) => {
          handleDelete(id);
          setMenuOpen(false);
        }}
      />
    </View>
  );
}

interface DetailCommentRowProps {
  comment: Comment;
  currentUserId: string | null;
  onLike: () => void;
  onReply: () => void;
  compact?: boolean;
}

function DetailCommentRow({
  comment,
  currentUserId,
  onLike,
  onReply,
  compact,
}: DetailCommentRowProps) {
  const { colors, spacing } = useTheme();
  const liked =
    !!currentUserId && (comment.likes ?? []).includes(currentUserId);
  const likeCount = comment.likes?.length ?? 0;
  const avatarSize = compact ? 28 : 36;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <Avatar
        source={comment.user.profilePicture}
        name={`${comment.user.firstName} ${comment.user.lastName}`}
        size={avatarSize}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
          }}
        >
          <Text variant="label" tone="primary" weight="700" numberOfLines={1}>
            {comment.user.firstName} {comment.user.lastName}
          </Text>
          {comment.user.verified ? <VerifiedBadge size={12} /> : null}
          <Text variant="caption" tone="tertiary">
            · {formatDate(comment.createdAt)}
          </Text>
        </View>
        <Text variant="body" tone="primary" style={{ marginTop: 2 }}>
          {comment.content}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.lg,
            marginTop: 6,
          }}
        >
          <Pressable
            onPress={onLike}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={liked ? "Unlike comment" : "Like comment"}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Feather
              name="heart"
              size={14}
              color={liked ? colors.tint.danger : colors.text.tertiary}
            />
            {likeCount > 0 ? (
              <Text
                variant="caption"
                tone={liked ? "danger" : "tertiary"}
                weight="600"
              >
                {likeCount}
              </Text>
            ) : null}
          </Pressable>
          <Pressable
            onPress={onReply}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Reply to comment"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Feather
              name="corner-up-left"
              size={13}
              color={colors.text.tertiary}
            />
            <Text variant="caption" tone="tertiary" weight="600">
              Reply
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
