/**
 * ChatCard — single inbox row.
 *
 * Layout (WhatsApp / iMessage / Messenger pattern):
 *   ┌─────────┬──────────────────────────────────────┬──────────┐
 *   │ avatar  │ name [verified]                       │ time     │
 *   │ + dot   │ (last message)                        │ unread # │
 *   └─────────┴──────────────────────────────────────┴──────────┘
 *
 * Three columns: a fixed-width avatar block, a flex-1 middle column
 * for name + message preview, and a fixed-width right column for the
 * timestamp + unread badge. Each column's content is internally
 * justified vertically, so the row reads cleanly even when the name
 * truncates or the preview wraps.
 */
import React, { memo, useCallback } from "react";
import { Pressable, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { useTheme } from "@/hooks/useTheme";
import { formatDate } from "@/utils/formatter";
import type { ChatUser, Conversation } from "@/types";

export interface ChatCardProps {
  conversation: Conversation;
  /** The current user's id — used to pick the *other* participant. */
  currentUserId: string | null | undefined;
  onPress: (conversation: Conversation) => void;
  onLongPress?: (conversation: Conversation) => void;
}

function pickOther(
  conversation: Conversation,
  currentUserId: string | null | undefined
): ChatUser | null {
  if (!conversation.participants) return null;
  return (
    conversation.participants.find((p) => p._id !== currentUserId) ??
    conversation.participants[0] ??
    null
  );
}

function ChatCardImpl({
  conversation,
  currentUserId,
  onPress,
  onLongPress,
}: ChatCardProps) {
  const { colors } = useTheme();
  const other = pickOther(conversation, currentUserId);
  const last = conversation.lastMessage;
  const unread = conversation.unreadCount ?? 0;

  const handlePress = useCallback(
    () => onPress(conversation),
    [conversation, onPress]
  );
  const handleLongPress = useCallback(
    () => onLongPress?.(conversation),
    [conversation, onLongPress]
  );

  if (!other) return null;

  const lastBody = last?.body ?? "Tap to say hi";
  const isMine = last?.sender === currentUserId;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      android_ripple={{ color: colors.overlay.press }}
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${other.firstName} ${other.lastName}`}
    >
      <Card
        variant="solid"
        className="mx-base mb-sm p-base border border-subtle"
      >
        <View className="flex-row items-center gap-md">
          {/* Left column: avatar with optional unread dot. Fixed width. */}
          <View className="relative w-14 h-14">
            <Avatar
              source={other.profilePicture}
              name={`${other.firstName} ${other.lastName}`}
              size={56}
            />
            {unread > 0 ? (
              <View
                // borderColor sticks in style — `bg-canvas` is a fill class,
                // there's no canvas border-color in the tailwind config.
                className="absolute right-0 bottom-0 w-[14px] h-[14px] rounded-full border-2 bg-tint"
                style={{ borderColor: colors.bg.canvas }}
              />
            ) : null}
          </View>

          {/* Middle column: name + preview, stacked. min-w-0 lets the
              inner Texts truncate without overflowing the card. */}
          <View className="flex-1 min-w-0 justify-center">
            <View className="flex-row items-center">
              <Text
                variant="subtitle"
                tone="primary"
                weight={unread > 0 ? "800" : "700"}
                numberOfLines={1}
                className="shrink mr-xs"
              >
                {other.firstName} {other.lastName}
              </Text>
              {other.verified ? <VerifiedBadge size={14} /> : null}
            </View>

            <Text
              variant="bodySm"
              tone={unread > 0 ? "primary" : "secondary"}
              weight={unread > 0 ? "700" : "400"}
              numberOfLines={1}
              className="mt-[2px]"
            >
              {isMine ? "You: " : ""}
              {lastBody}
            </Text>
          </View>

          {/* Right column: timestamp on top, unread badge below. Margin
              instead of gap, so the badge collapses cleanly when absent. */}
          <View className="items-end justify-center min-w-14">
            {last?.createdAt ? (
              <Text
                variant="caption"
                tone={unread > 0 ? "tint" : "tertiary"}
                weight={unread > 0 ? "700" : "500"}
              >
                {formatDate(last.createdAt)}
              </Text>
            ) : null}
            {unread > 0 ? (
              <View className="mt-[6px] min-w-[22px] h-[22px] px-[7px] rounded-[11px] items-center justify-center bg-tint">
                <Text variant="caption" tone="inverse" weight="800">
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export const ChatCard = memo(
  ChatCardImpl,
  (prev, next) =>
    prev.conversation._id === next.conversation._id &&
    prev.conversation.lastActivityAt === next.conversation.lastActivityAt &&
    prev.conversation.unreadCount === next.conversation.unreadCount &&
    prev.currentUserId === next.currentUserId
);
ChatCard.displayName = "ChatCard";

export default ChatCard;
