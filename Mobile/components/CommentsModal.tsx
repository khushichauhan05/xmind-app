import React, { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Surface } from "@/components/ui/Surface";
import { Text } from "@/components/ui/Text";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { useTheme } from "@/hooks/useTheme";
import { useComments } from "@/hooks/useComments";
import { useCommentsForPost } from "@/hooks/useCommentsForPost";
import { useCommentLike } from "@/hooks/useCommentLike";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { groupComments } from "@/utils/commentGrouping";
import { formatDate } from "@/utils/formatter";
import type { Comment, Post } from "@/types";

export interface CommentsModalProps {
  selectedPost: Post | null;
  onClose: () => void;
}

/**
 * Comments sheet.
 *
 * Loads the full comment list lazily via `useCommentsForPost` and groups
 * top-level comments with their inline replies (one nesting level deep —
 * IG / FB pattern). Reply targeting flows through `useComments`'s
 * `replyTarget` state so the composer flips to "Replying to @username"
 * mode on demand.
 *
 * Switched from FlashList to ScrollView because threaded sections vary
 * in height per group and FlashList's recycling assumes uniform-ish
 * cells. Comment counts are typically small enough that ScrollView is
 * the right tradeoff at this stage.
 */
function CommentsModalImpl({ selectedPost, onClose }: CommentsModalProps) {
  const { colors, spacing, radii } = useTheme();
  const { currentUser } = useCurrentUser();

  const {
    commentText,
    setCommentText,
    createComment,
    deleteComment,
    replyTarget,
    setReplyTarget,
    cancelReply,
    isCreatingComment,
  } = useComments();

  const { comments, isLoading: commentsLoading } = useCommentsForPost(
    selectedPost?._id ?? null
  );
  const { toggleLike: toggleCommentLike } = useCommentLike(
    selectedPost?._id ?? null
  );

  const threads = useMemo(() => groupComments(comments), [comments]);

  const handleClose = useCallback(() => {
    onClose();
    setCommentText("");
    cancelReply();
  }, [cancelReply, onClose, setCommentText]);

  const handleSubmit = useCallback(() => {
    if (!selectedPost || !commentText.trim()) return;
    createComment(selectedPost._id);
  }, [commentText, createComment, selectedPost]);

  return (
    <Modal
      visible={!!selectedPost}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: colors.overlay.scrim }}>
        <Pressable
          accessibilityLabel="Dismiss replies"
          onPress={handleClose}
          style={{ flex: 1 }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          style={{ flex: 1 }}
        >
          <Surface
            variant="solid"
            style={{
              flex: 1,
              borderTopLeftRadius: radii.xxl,
              borderTopRightRadius: radii.xxl,
              overflow: "hidden",
              borderTopWidth: 1,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderColor: colors.border.subtle,
            }}
          >
            {/* IG-style handle bar */}
            <View
              style={{
                alignItems: "center",
                paddingTop: spacing.sm,
                paddingBottom: spacing.xs,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.border.strong,
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.subtle,
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="title" tone="primary">
                  Replies
                </Text>
                <Text variant="caption" tone="tertiary">
                  {comments.length}{" "}
                  {comments.length === 1 ? "reply" : "replies"}
                </Text>
              </View>
              <IconButton
                accessibilityLabel="Close"
                onPress={handleClose}
                variant="filled"
              >
                <Feather name="x" size={18} color={colors.text.primary} />
              </IconButton>
            </View>

            {selectedPost ? (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.md,
                  paddingBottom: spacing.md,
                  flexDirection: "row",
                  gap: spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border.subtle,
                }}
              >
                <Avatar
                  source={selectedPost.user.profilePicture}
                  name={`${selectedPost.user.firstName} ${selectedPost.user.lastName}`}
                  size={36}
                />
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Text
                      variant="subtitle"
                      tone="primary"
                      numberOfLines={1}
                    >
                      {selectedPost.user.firstName} {selectedPost.user.lastName}
                    </Text>
                    {selectedPost.user.verified ? <VerifiedBadge size={14} /> : null}
                  </View>
                  <Text variant="bodySm" tone="secondary" numberOfLines={4}>
                    {selectedPost.content}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={{ flex: 1 }}>
              {commentsLoading ? (
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator color={colors.tint.primary} />
                </View>
              ) : threads.length > 0 ? (
                <ScrollView
                  contentContainerStyle={{
                    paddingHorizontal: spacing.lg,
                    paddingTop: spacing.md,
                    paddingBottom: spacing.md,
                  }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {threads.map(({ root, replies }) => (
                    <CommentThread
                      key={root._id}
                      root={root}
                      replies={replies}
                      currentUserId={currentUser?._id ?? null}
                      onDelete={deleteComment}
                      onLike={toggleCommentLike}
                      onReply={setReplyTarget}
                    />
                  ))}
                </ScrollView>
              ) : (
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
              )}
            </View>

            <SafeAreaView edges={["bottom"]}>
              {/* Replying-to pill — only visible when replyTarget is set. */}
              {replyTarget ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.xs + 2,
                    backgroundColor: colors.surface.secondary,
                    borderTopWidth: 1,
                    borderTopColor: colors.border.subtle,
                    gap: spacing.sm,
                  }}
                >
                  <Feather
                    name="corner-up-left"
                    size={14}
                    color={colors.tint.primary}
                  />
                  <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
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
                  paddingTop: spacing.sm,
                  paddingBottom: spacing.sm,
                  borderTopWidth: 1,
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
                        : selectedPost
                        ? `Reply to @${selectedPost.user.username}`
                        : "Add a thoughtful reply"
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
                      commentText.trim()
                        ? colors.text.onTint
                        : colors.text.tertiary
                    }
                  />
                </Pressable>
              </View>
            </SafeAreaView>
          </Surface>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

interface CommentThreadProps {
  root: Comment;
  replies: Comment[];
  currentUserId: string | null;
  onDelete: (id: string) => void;
  onLike: (id: string) => void;
  onReply: (target: Comment) => void;
}

function CommentThread({
  root,
  replies,
  currentUserId,
  onDelete,
  onLike,
  onReply,
}: CommentThreadProps) {
  const { spacing } = useTheme();
  return (
    <View>
      <CommentRow
        comment={root}
        canDelete={!!currentUserId && root.user._id === currentUserId}
        currentUserId={currentUserId}
        onDelete={() => onDelete(root._id)}
        onLike={() => onLike(root._id)}
        onReply={() => onReply(root)}
      />
      {replies.length > 0 ? (
        <View style={{ paddingLeft: 48, gap: 0 }}>
          {replies.map((r) => (
            <CommentRow
              key={r._id}
              comment={r}
              canDelete={!!currentUserId && r.user._id === currentUserId}
              currentUserId={currentUserId}
              onDelete={() => onDelete(r._id)}
              onLike={() => onLike(r._id)}
              onReply={() => onReply(root)}
              compact
            />
          ))}
        </View>
      ) : null}
      <View style={{ height: spacing.xs }} />
    </View>
  );
}

interface CommentRowProps {
  comment: Comment;
  canDelete: boolean;
  currentUserId: string | null;
  onDelete: () => void;
  onLike: () => void;
  onReply: () => void;
  /** Smaller avatar for replies. */
  compact?: boolean;
}

function CommentRowImpl({
  comment,
  canDelete,
  currentUserId,
  onDelete,
  onLike,
  onReply,
  compact,
}: CommentRowProps) {
  const { colors, spacing } = useTheme();
  const liked = !!currentUserId && (comment.likes ?? []).includes(currentUserId);
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Text variant="label" tone="primary" numberOfLines={1}>
            {comment.user.firstName} {comment.user.lastName}
          </Text>
          {comment.user.verified ? <VerifiedBadge size={12} /> : null}
          <Text variant="caption" tone="tertiary">
            · {formatDate(comment.createdAt)}
          </Text>
          {canDelete ? (
            <Pressable
              onPress={onDelete}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Delete comment"
              style={{ marginLeft: "auto" }}
            >
              <Feather name="trash-2" size={14} color={colors.text.tertiary} />
            </Pressable>
          ) : null}
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
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
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
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
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
const CommentRow = memo(CommentRowImpl);

export const CommentsModal = memo(CommentsModalImpl);
CommentsModal.displayName = "CommentsModal";

export default CommentsModal;
