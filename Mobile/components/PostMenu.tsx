/**
 * PostMenu — overflow sheet for a single post.
 *
 * Architectural role:
 *  Modal-from-bottom sheet that gives the user explicit curation
 *  controls: hide this post, mute the author, report. Wires into
 *  `useFeedbackStore` so the choice survives cold starts and feeds
 *  the ranker's negative-feedback signal.
 *
 * Psychology lever:
 *  Locus of control. Even when the algorithm gets a post wrong, the
 *  user can shape the next one — a tiny moment of agency that
 *  measurably improves session length and reduces churn.
 */
import React, { memo, useCallback, useEffect } from "react";
import { Modal, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Surface } from "@/components/ui/Surface";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { useCustomAlert } from "@/hooks/useCustomAlert";
import { useFeedbackStore } from "@/stores/useFeedbackStore";
import type { Post } from "@/types";

export interface PostMenuProps {
  post: Post | null;
  onClose: () => void;
  /** When true, the menu shows the author-only set (Delete) instead of
   *  the moderation set (Not interested / Mute / Report). */
  isOwn?: boolean;
  /** Required when `isOwn` is true so the Delete option can fire. */
  onDelete?: (postId: string) => void;
}

interface MenuOption {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description: string;
  destructive?: boolean;
  onPress: () => void;
}

function PostMenuImpl({ post, onClose, isOwn, onDelete }: PostMenuProps) {
  const { colors, radii } = useTheme();
  const open = useSharedValue(0);
  const visible = !!post;

  const markNotInterested = useFeedbackStore((s) => s.markNotInterested);
  const muteAuthor = useFeedbackStore((s) => s.muteAuthor);
  // Native alerts so the confirmation can stack over this modal sheet —
  // React Native does not support overlapping <Modal> components.
  const { showInfo, showSuccess, showDeleteConfirmation } = useCustomAlert({
    useNative: true,
  });

  useEffect(() => {
    open.value = withTiming(visible ? 1 : 0, { duration: 220 });
  }, [open, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [{ translateY: 24 * (1 - open.value) }],
  }));

  const onNotInterested = useCallback(async () => {
    if (!post) return;
    Haptics.selectionAsync().catch(() => undefined);
    await markNotInterested(post._id);
    onClose();
    showSuccess("Got it", "We'll show fewer posts like this.");
  }, [markNotInterested, onClose, post, showSuccess]);

  const onMute = useCallback(async () => {
    if (!post) return;
    Haptics.selectionAsync().catch(() => undefined);
    await muteAuthor(post.user._id);
    onClose();
    showSuccess(
      "Muted",
      `Posts from @${post.user.username} won't appear in your feed.`
    );
  }, [muteAuthor, onClose, post, showSuccess]);

  const onReport = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    onClose();
    showInfo(
      "Report received",
      "Thanks for letting us know. We'll review this post within a day."
    );
  }, [onClose, showInfo]);

  const onDeleteOwn = useCallback(() => {
    if (!post || !onDelete) return;
    Haptics.selectionAsync().catch(() => undefined);
    showDeleteConfirmation(
      "Delete this post?",
      "It'll be gone from your feed and from anyone who's already seen it.",
      () => {
        onDelete(post._id);
        onClose();
      }
    );
  }, [onClose, onDelete, post, showDeleteConfirmation]);

  if (!post) return null;

  // Author-only set on your own posts (delete makes sense; muting yourself
  // and reporting yourself don't). Moderation set otherwise.
  const options: MenuOption[] = isOwn
    ? [
        {
          icon: "trash-2",
          label: "Delete post",
          description: "Removes it from the feed and any thread it's in.",
          destructive: true,
          onPress: onDeleteOwn,
        },
      ]
    : [
        {
          icon: "eye-off",
          label: "Not interested",
          description: "We'll show fewer posts like this one.",
          onPress: onNotInterested,
        },
        {
          icon: "user-x",
          label: `Mute @${post.user.username}`,
          description: "Their posts will stop appearing here. They won't be told.",
          onPress: onMute,
        },
        {
          icon: "flag",
          label: "Report post",
          description: "Send this to our review queue.",
          destructive: true,
          onPress: onReport,
        },
      ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        className="flex-1"
        style={{ backgroundColor: colors.overlay.scrim }}
      >
        {/* Scrim — separate Pressable so the sheet itself doesn't have to
            wrap children in a Pressable that swallows scroll gestures. */}
        <Pressable
          accessibilityLabel="Dismiss menu"
          onPress={onClose}
          className="flex-1"
        />

        <Animated.View style={sheetStyle}>
          <SafeAreaView edges={["bottom"]} className="bg-transparent">
            <View className="px-base pb-sm">
              <Surface
                variant="solid"
                radius={radii.xxl}
                className="overflow-hidden border border-subtle"
              >
                {/* Handle bar — telegraphs "this is a sheet". */}
                <View className="items-center pt-sm pb-xs">
                  <View
                    className="w-10 h-1 rounded-[2px]"
                    style={{ backgroundColor: colors.border.strong }}
                  />
                </View>

                {/* Post preview header */}
                <View className="w-full flex-row items-center px-lg pt-sm pb-md gap-md border-b-[0.5px] border-subtle">
                  <View className="flex-1">
                    <Text variant="caption" tone="tertiary" weight="700">
                      POST BY @{post.user.username.toUpperCase()}
                    </Text>
                    <Text
                      variant="bodySm"
                      tone="secondary"
                      numberOfLines={2}
                      className="mt-xs"
                    >
                      {post.content || "Image post"}
                    </Text>
                  </View>
                </View>

                {/* Options group — generous container padding plus per-row
                    padding gives every action room to breathe. Press
                    feedback via active:bg-surface-secondary, no dividers. */}
                <View className="p-base gap-sm">
                  {options.map((opt) => (
                    <Pressable
                      key={opt.label}
                      onPress={opt.onPress}
                      android_ripple={{ color: colors.overlay.press }}
                      accessibilityRole="button"
                      accessibilityLabel={opt.label}
                      className="flex-row items-center gap-md p-md rounded-md active:bg-surface-secondary"
                    >
                      <View
                        className={`w-10 h-10 rounded-full items-center justify-center ${
                          opt.destructive
                            ? "bg-danger/10"
                            : "bg-surface-secondary"
                        }`}
                      >
                        <Feather
                          name={opt.icon}
                          size={20}
                          color={
                            opt.destructive
                              ? colors.tint.danger
                              : colors.text.primary
                          }
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          variant="subtitle"
                          tone={opt.destructive ? "danger" : "primary"}
                          numberOfLines={1}
                          weight="700"
                        >
                          {opt.label}
                        </Text>
                        <Text
                          variant="caption"
                          tone="tertiary"
                          numberOfLines={2}
                          className="mt-[2px]"
                        >
                          {opt.description}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </Surface>

              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                android_ripple={{ color: colors.overlay.press }}
                className="mt-sm"
              >
                <Surface
                  variant="solid"
                  radius={radii.xxl}
                  className="py-base items-center border border-subtle"
                >
                  <Text variant="subtitle" tone="primary" weight="800">
                    Cancel
                  </Text>
                </Surface>
              </Pressable>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export const PostMenu = memo(PostMenuImpl);
PostMenu.displayName = "PostMenu";

export default PostMenu;
