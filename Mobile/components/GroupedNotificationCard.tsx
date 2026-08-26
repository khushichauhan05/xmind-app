/**
 * GroupedNotificationCard — "Alex and 12 others liked your post".
 *
 * Architectural role:
 *  Renders a same-day group of notifications about the same post + same
 *  type ("like", "comment", "follow") as a single visual unit. Drops
 *  the inbox volume by a factor of N and matches the social-network
 *  pattern users already know from Twitter/Facebook/Instagram.
 *
 * Psychology lever:
 *  Cognitive economy. Twelve identical "X liked your post" rows
 *  produces fatigue and noise; one merged row carries the same signal
 *  with less mental overhead. The face-stack also exposes social proof
 *  ("real people, my work landed") without any artificial inflation.
 */
import React, { memo, useCallback, useMemo } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { formatDate } from "@/utils/formatter";
import type { Notification } from "@/types";

export interface NotificationGroup {
  /** Synthetic id derived from `type:postId:dayBucket`. */
  id: string;
  type: Notification["type"];
  notifications: Notification[];
  latestAt: string;
  /** Reference to the post (only present for like/comment groups). */
  post?: Notification["post"];
}

export interface GroupedNotificationCardProps {
  group: NotificationGroup;
}

const FEATHER_GLYPH: Record<Notification["type"], keyof typeof Feather.glyphMap> = {
  like: "heart",
  comment: "message-circle",
  follow: "user-plus",
  reshare: "repeat",
};

function buildSentence(group: NotificationGroup): string {
  const total = group.notifications.length;
  const first = group.notifications[0];
  if (!first) return "";
  const firstName = first.from.firstName;
  const action =
    group.type === "like"
      ? "liked your post"
      : group.type === "comment"
      ? "commented on your post"
      : group.type === "reshare"
      ? "reshared your post"
      : "started following you";

  if (total === 1) return `${firstName} ${first.from.lastName} ${action}`;
  if (total === 2) {
    const second = group.notifications[1];
    return second
      ? `${firstName} and ${second.from.firstName} ${action}`
      : `${firstName} ${action}`;
  }
  return `${firstName} and ${total - 1} others ${action}`;
}

function GroupedNotificationCardImpl({ group }: GroupedNotificationCardProps) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const glyphName = FEATHER_GLYPH[group.type];
  const glyphColor =
    group.type === "like"
      ? colors.tint.danger
      : group.type === "comment"
      ? colors.tint.primary
      : colors.tint.success;

  const sentence = useMemo(() => buildSentence(group), [group]);
  const stack = group.notifications.slice(0, 3);
  const total = group.notifications.length;

  const onPress = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    const first = group.notifications[0];
    if (!first) return;
    // Route by type:
    //   follow  → the actor's profile
    //   like    → the post the actor liked
    //   comment → the post the actor commented on
    // Falls back to the actor's profile when the post id isn't available
    // (legacy notifications without `post` populated).
    if (group.type === "follow") {
      router.push({
        pathname: "/user-profile",
        params: { userId: first.from._id ?? "", username: first.from.username },
      });
      return;
    }

    const postId = group.post?._id;
    if (postId) {
      router.push({ pathname: "/post/[postId]", params: { postId } });
      return;
    }

    router.push({
      pathname: "/user-profile",
      params: { userId: first.from._id ?? "", username: first.from.username },
    });
  }, [group.notifications, group.post?._id, group.type, router]);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.overlay.press }}
      accessibilityRole="button"
      accessibilityLabel={sentence}
    >
    <Card variant="solid" className="mx-base mb-sm p-base border border-subtle">
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.surface.secondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name={glyphName} size={20} color={glyphColor} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Avatar stack — first three faces, overlapping. */}
          <View style={{ flexDirection: "row", marginBottom: spacing.xs }}>
            {stack.map((n, i) => (
              <View
                key={n._id}
                style={{
                  marginLeft: i === 0 ? 0 : -10,
                  borderWidth: 2,
                  borderColor: colors.surface.primary,
                  borderRadius: 18,
                }}
              >
                <Avatar
                  source={n.from.profilePicture}
                  name={`${n.from.firstName} ${n.from.lastName}`}
                  size={32}
                />
              </View>
            ))}
            {total > 3 ? (
              <View
                style={{
                  marginLeft: -10,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: colors.surface.primary,
                  backgroundColor: colors.surface.sunken,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text variant="caption" tone="secondary" weight="700">
                  +{total - 3}
                </Text>
              </View>
            ) : null}
          </View>

          <Text variant="body" tone="primary">
            {sentence}
          </Text>
          <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
            {formatDate(group.latestAt)}
          </Text>

          {group.post ? (
            <View
              style={{
                marginTop: spacing.sm,
                padding: spacing.sm,
                borderRadius: 12,
                backgroundColor: colors.surface.secondary,
                borderLeftWidth: 3,
                borderLeftColor: colors.tint.primary,
              }}
            >
              <Text variant="bodySm" tone="secondary" numberOfLines={2}>
                {group.post.content}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
    </Pressable>
  );
}

export const GroupedNotificationCard = memo(
  GroupedNotificationCardImpl,
  (prev, next) =>
    prev.group.id === next.group.id &&
    prev.group.notifications.length === next.group.notifications.length &&
    prev.group.latestAt === next.group.latestAt
);
GroupedNotificationCard.displayName = "GroupedNotificationCard";

export default GroupedNotificationCard;
