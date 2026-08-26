/**
 * PostCard — xMind feed cell.
 *
 * Visual identity (deliberately unique, not IG, not X):
 *  - 3px coral gradient ribbon at the top edge of every card. The
 *    peach → coral → magenta sequence is the same gradient the
 *    StoriesRail uses, so the brand reads as one continuous system.
 *  - Card-shape row (`mx-base mb-sm`, rounded-lg, hairline border)
 *    matching every other list item in the app for design consistency.
 *  - Asymmetric one-line meta: bold name + verified, then a single
 *    tertiary line "@handle · timestamp". No FB-style stacked subtitle.
 *  - Inline-count action bar: each metric is `[icon] [count]` instead
 *    of `[icon] / [count below]`. Tighter, faster to read, distinctive.
 *  - Reshare button (Twitter's `repeat` glyph) glows green when active.
 *    Likes are coral, bookmark is coral when filled — a single colour
 *    rule per state cuts cognitive load.
 *  - When `post.originalPost` is populated, the row is a reshare entry:
 *    we render a coral "@resharer reshared" banner above the source
 *    post, then operate every action on the *source* id so a like /
 *    reshare / comment hits the canonical post, not the empty entry.
 *
 * Performance:
 *  - memo at boundary; comparator covers the full set of fields the
 *    visible state depends on (likes, comments, repostCount, image).
 *  - All animations on the UI thread via Reanimated worklets.
 *  - expo-image with memory-disk cache + recyclingKey for FlashList.
 *  - No inline objects in renderItem — every callback is wrapped.
 */
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  Pressable,
  type GestureResponderEvent,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { AntDesign, Feather } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { useTheme } from "@/hooks/useTheme";
import { useBookmarksStore } from "@/stores/useBookmarksStore";
import { storyRingGradient } from "@/constants/tokens";
import { formatDate, formatNumber } from "@/utils/formatter";
import type { Post, User } from "@/types";

import ImageModal from "./ImageModal";
import ShareToChatSheet from "./ShareToChatSheet";
import { useCustomAlert } from "@/hooks/useCustomAlert";
import CustomAlert from "./CustomAlert";

export interface PostCardProps {
  post: Post;
  isLiked?: boolean;
  isReshared?: boolean;
  currentUser: User | null | undefined;
  onLike: (postId: string) => void;
  onReshare?: (postId: string) => void;
  onComment: (post: Post) => void;
  onDelete: (postId: string) => void;
  onMore?: (post: Post) => void;
}

function PostCardImpl({
  post,
  isLiked,
  isReshared,
  currentUser,
  onLike,
  onReshare,
  onComment,
  onDelete,
  onMore,
}: PostCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { showDeleteConfirmation, alertConfig, isVisible, hideAlert } =
    useCustomAlert();

  const [imageOpen, setImageOpen] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  // ── Reshare resolution ────────────────────────────────────────────────
  // When this row is a reshare entry, every action targets the *source*
  // post and every visible field comes from source. The reshare banner
  // names the resharer; the rest of the card reads as the original.
  const isResharedRow = !!post.originalPost;
  const source = post.originalPost ?? post;
  const resharer = isResharedRow ? post.user : null;

  const isOwn = !!currentUser && source.user._id === currentUser._id;
  const commentCount = source.commentCount ?? source.comments?.length ?? 0;
  const likeCount = source.likes?.length ?? 0;
  const repostCount = source.repostCount ?? source.reposts?.length ?? 0;

  // ── Like animation ────────────────────────────────────────────────────
  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  // Big-heart burst on top of the image (double-tap signature).
  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);
  const burstStyle = useAnimatedStyle(() => ({
    transform: [{ scale: burstScale.value }],
    opacity: burstOpacity.value,
  }));

  // ── Reshare animation — small scale-in on toggle ──────────────────────
  const reshareScale = useSharedValue(1);
  const reshareStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reshareScale.value }],
  }));

  const triggerLikeAnim = useCallback(() => {
    heartScale.value = withSequence(
      withTiming(1.3, { duration: 120 }),
      withTiming(1, { duration: 160 })
    );
  }, [heartScale]);

  const triggerReshareAnim = useCallback(() => {
    reshareScale.value = withSequence(
      withSpring(1.25, { damping: 14, stiffness: 320, mass: 0.6 }),
      withSpring(1, { damping: 14, stiffness: 320, mass: 0.6 })
    );
  }, [reshareScale]);

  const handleLike = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    triggerLikeAnim();
    onLike(source._id);
  }, [onLike, source._id, triggerLikeAnim]);

  const handleReshare = useCallback(() => {
    if (!onReshare || isOwn) return;
    Haptics.selectionAsync().catch(() => undefined);
    triggerReshareAnim();
    onReshare(source._id);
  }, [isOwn, onReshare, source._id, triggerReshareAnim]);

  const triggerHeartBurst = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    burstScale.value = 0;
    burstOpacity.value = 0;
    burstScale.value = withSequence(
      withSpring(1, { damping: 10, stiffness: 200, mass: 0.7 }),
      withTiming(1, { duration: 240 }),
      withTiming(1.1, { duration: 200 })
    );
    burstOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(1, { duration: 240 }),
      withTiming(0, { duration: 220 })
    );
    if (!isLiked) onLike(source._id);
  }, [burstOpacity, burstScale, isLiked, onLike, source._id]);

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(280)
        .onStart(() => {
          "worklet";
          runOnJS(triggerHeartBurst)();
        }),
    [triggerHeartBurst]
  );

  const singleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(1)
        .maxDuration(280)
        .onStart(() => {
          "worklet";
          runOnJS(setImageOpen)(true);
        }),
    []
  );

  const imageGesture = useMemo(
    () => Gesture.Exclusive(doubleTap, singleTap),
    [doubleTap, singleTap]
  );

  const handleComment = useCallback(() => {
    onComment(source);
  }, [onComment, source]);

  const handleDelete = useCallback(() => {
    showDeleteConfirmation(
      "Delete this post?",
      "It'll disappear from your feed and from anyone who's already seen it.",
      () => onDelete(post._id)
    );
  }, [onDelete, post._id, showDeleteConfirmation]);

  const handleMore = useCallback(() => {
    if (!onMore) return;
    Haptics.selectionAsync().catch(() => undefined);
    onMore(post);
  }, [onMore, post]);

  const handleShare = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    setShareSheetOpen(true);
  }, []);

  // ── Bookmarks — local-first via Zustand + AsyncStorage ────────────────
  const isBookmarked = useBookmarksStore((s) => s.postIds.has(source._id));
  const toggleBookmark = useBookmarksStore((s) => s.toggle);
  const handleBookmark = useCallback(async () => {
    Haptics.selectionAsync().catch(() => undefined);
    await toggleBookmark(source._id);
  }, [source._id, toggleBookmark]);

  const navigateToProfile = useCallback(() => {
    if (isOwn) router.push("/(tabs)/profile");
    else
      router.push({
        pathname: "/user-profile",
        params: { userId: source.user._id, username: source.user.username },
      });
  }, [isOwn, router, source.user._id, source.user.username]);

  const navigateToResharer = useCallback(() => {
    if (!resharer) return;
    router.push({
      pathname: "/user-profile",
      params: { userId: resharer._id, username: resharer.username },
    });
  }, [resharer, router]);

  // ── Content tokenization — tappable @mentions and #hashtags ───────────
  const contentNodes = useMemo(() => {
    if (!source.content) return null;
    const tokens = source.content.split(/(\s+)/);
    return tokens.map((token, i) => {
      const tagMatch = token.match(/^#[A-Za-z0-9_]+$/);
      const mentionMatch = token.match(/^@[A-Za-z0-9_]+$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        return (
          <Text
            key={`t-${i}`}
            tone="tint"
            weight="700"
            onPress={() =>
              router.push({
                pathname: "/hashtag-posts",
                params: { hashtag: tag },
              })
            }
          >
            {token}
          </Text>
        );
      }
      if (mentionMatch) {
        const handle = mentionMatch[0].slice(1).toLowerCase();
        return (
          <Text
            key={`t-${i}`}
            tone="accent"
            weight="600"
            onPress={() =>
              router.push({
                pathname: "/user-profile",
                params: { userId: "", username: handle },
              })
            }
          >
            {token}
          </Text>
        );
      }
      return (
        <Text key={`t-${i}`} tone="primary">
          {token}
        </Text>
      );
    });
  }, [router, source.content]);

  return (
    <>
      <View className="mx-base mb-sm">
        <Card
          variant="solid"
          padding={0}
          className="border border-subtle overflow-hidden"
        >
          {/* xMind signature ribbon — coral gradient at the top edge */}
          <LinearGradient
            colors={
              storyRingGradient as unknown as readonly [string, string, ...string[]]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 3, width: "100%" }}
          />

          {/* Reshare banner — only on reshare entries */}
          {resharer ? (
            <Pressable
              onPress={navigateToResharer}
              accessibilityRole="link"
              accessibilityLabel={`Reshared by @${resharer.username}`}
              className="flex-row items-center px-base pt-md gap-xs"
            >
              <Feather name="repeat" size={12} color={colors.tint.primary} />
              <Text variant="caption" tone="tint" weight="700" numberOfLines={1}>
                {resharer.firstName} {resharer.lastName} reshared
              </Text>
            </Pressable>
          ) : null}

          {/* Identity row — asymmetric, single subtitle line */}
          <View className="flex-row items-center gap-md px-base pt-md">
            <Pressable
              onPress={navigateToProfile}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Open profile of ${source.user.firstName}`}
            >
              <Avatar
                source={source.user.profilePicture}
                name={`${source.user.firstName} ${source.user.lastName}`}
                size={44}
              />
            </Pressable>

            <Pressable
              onPress={navigateToProfile}
              className="flex-1 min-w-0"
              accessibilityRole="link"
            >
              <View className="flex-row items-center">
                <Text
                  variant="subtitle"
                  tone="primary"
                  weight="800"
                  numberOfLines={1}
                  className="shrink mr-xs"
                >
                  {source.user.firstName} {source.user.lastName}
                </Text>
                {source.user.verified ? <VerifiedBadge size={14} /> : null}
              </View>
              <View className="flex-row items-center mt-[2px]">
                <Text
                  variant="caption"
                  tone="tertiary"
                  numberOfLines={1}
                  className="shrink"
                >
                  @{source.user.username}
                </Text>
                <Text variant="caption" tone="tertiary" className="mx-xs">
                  ·
                </Text>
                <Text variant="caption" tone="tertiary">
                  {formatDate(source.createdAt)}
                </Text>
              </View>
            </Pressable>

            {onMore ? (
              <Pressable
                onPress={handleMore}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="More options"
                className="w-8 h-8 rounded-full items-center justify-center"
              >
                <Feather
                  name="more-horizontal"
                  size={20}
                  color={colors.text.secondary}
                />
              </Pressable>
            ) : null}
          </View>

          {/* Body content */}
          {contentNodes ? (
            <View className="px-base pt-sm">
              <Text variant="body" tone="primary">
                {contentNodes}
              </Text>
            </View>
          ) : null}

          {/* Media — full-bleed, double-tap to like */}
          {source.image ? (
            <View className="mt-md">
              <GestureDetector gesture={imageGesture}>
                <View
                  className="relative"
                  style={{ backgroundColor: colors.surface.sunken }}
                >
                  <ExpoImage
                    source={{ uri: source.image }}
                    style={{ width: "100%", aspectRatio: 1 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={140}
                    recyclingKey={source._id}
                  />
                  <Animated.View
                    pointerEvents="none"
                    className="absolute inset-0 items-center justify-center"
                    style={burstStyle}
                  >
                    <AntDesign name="heart" size={96} color="#FFFFFF" />
                  </Animated.View>
                </View>
              </GestureDetector>
            </View>
          ) : null}

          {/* Action bar — inline-count rhythm, xMind signature */}
          <View className="flex-row items-center gap-lg px-base pt-md pb-md">
            <ActionPill
              onPress={handleLike}
              accessibilityLabel={isLiked ? "Unlike" : "Like"}
            >
              <Animated.View style={heartStyle}>
                <AntDesign
                  name="heart"
                  size={20}
                  color={isLiked ? colors.tint.primary : colors.text.secondary}
                />
              </Animated.View>
              {likeCount > 0 ? (
                <Text
                  variant="caption"
                  weight="700"
                  tone={isLiked ? "tint" : "secondary"}
                  className="ml-[6px]"
                >
                  {formatNumber(likeCount)}
                </Text>
              ) : null}
            </ActionPill>

            <ActionPill
              onPress={handleComment}
              accessibilityLabel="Open comments"
            >
              <Feather
                name="message-circle"
                size={20}
                color={colors.text.secondary}
              />
              {commentCount > 0 ? (
                <Text
                  variant="caption"
                  weight="700"
                  tone="secondary"
                  className="ml-[6px]"
                >
                  {formatNumber(commentCount)}
                </Text>
              ) : null}
            </ActionPill>

            {onReshare ? (
              <ActionPill
                onPress={handleReshare}
                disabled={isOwn}
                accessibilityLabel={
                  isOwn
                    ? "You can't reshare your own post"
                    : isReshared
                    ? "Undo reshare"
                    : "Reshare this post"
                }
              >
                <Animated.View style={reshareStyle}>
                  <Feather
                    name="repeat"
                    size={20}
                    color={
                      isReshared
                        ? colors.tint.success
                        : isOwn
                        ? colors.text.tertiary
                        : colors.text.secondary
                    }
                  />
                </Animated.View>
                {repostCount > 0 ? (
                  <Text
                    variant="caption"
                    weight="700"
                    tone={isReshared ? "success" : "secondary"}
                    className="ml-[6px]"
                  >
                    {formatNumber(repostCount)}
                  </Text>
                ) : null}
              </ActionPill>
            ) : null}

            <View className="flex-1" />

            <Pressable
              onPress={handleShare}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share"
              className="w-8 h-8 rounded-full items-center justify-center"
            >
              <Feather name="send" size={20} color={colors.text.secondary} />
            </Pressable>

            <Pressable
              onPress={handleBookmark}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isBookmarked ? "Remove from saved" : "Save post"}
              className="w-8 h-8 rounded-full items-center justify-center"
            >
              <Feather
                name="bookmark"
                size={20}
                color={
                  isBookmarked ? colors.tint.primary : colors.text.secondary
                }
              />
            </Pressable>

            {isOwn && !isResharedRow ? (
              <Pressable
                onPress={handleDelete}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Delete post"
                className="w-8 h-8 rounded-full items-center justify-center"
              >
                <Feather
                  name="trash-2"
                  size={18}
                  color={colors.text.tertiary}
                />
              </Pressable>
            ) : null}
          </View>
        </Card>
      </View>

      <ImageModal
        isVisible={imageOpen}
        onClose={() => setImageOpen(false)}
        imageUrl={source.image || ""}
        imageTitle="Post image"
      />

      <ShareToChatSheet
        post={shareSheetOpen ? source : null}
        onClose={() => setShareSheetOpen(false)}
      />

      {alertConfig ? (
        <CustomAlert
          visible={isVisible}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          type={alertConfig.type}
          onDismiss={hideAlert}
        />
      ) : null}
    </>
  );
}

interface ActionPillProps {
  children: React.ReactNode;
  onPress: (e: GestureResponderEvent) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

function ActionPillImpl({
  children,
  onPress,
  accessibilityLabel,
  disabled,
}: ActionPillProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="flex-row items-center py-[2px] active:opacity-60"
      style={disabled ? { opacity: 0.55 } : undefined}
    >
      {children}
    </Pressable>
  );
}
const ActionPill = memo(ActionPillImpl);
ActionPill.displayName = "ActionPill";

export const PostCard = memo(PostCardImpl, (prev, next) => {
  const ps = prev.post.originalPost ?? prev.post;
  const ns = next.post.originalPost ?? next.post;
  const prevComments = ps.commentCount ?? ps.comments?.length ?? 0;
  const nextComments = ns.commentCount ?? ns.comments?.length ?? 0;
  const prevReposts = ps.repostCount ?? ps.reposts?.length ?? 0;
  const nextReposts = ns.repostCount ?? ns.reposts?.length ?? 0;
  return (
    prev.post._id === next.post._id &&
    ps._id === ns._id &&
    (ps.likes?.length ?? 0) === (ns.likes?.length ?? 0) &&
    prevComments === nextComments &&
    prevReposts === nextReposts &&
    ps.image === ns.image &&
    ps.content === ns.content &&
    prev.isLiked === next.isLiked &&
    prev.isReshared === next.isReshared &&
    prev.currentUser?._id === next.currentUser?._id &&
    prev.onMore === next.onMore &&
    prev.onReshare === next.onReshare
  );
});
PostCard.displayName = "PostCard";

export default PostCard;
