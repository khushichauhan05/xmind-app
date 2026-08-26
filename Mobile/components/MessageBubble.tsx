/**
 * MessageBubble — single message in the chat thread.
 *
 * Style: iMessage / IG hybrid.
 *  - Outgoing bubbles: coral fill, white text, right-aligned.
 *  - Incoming bubbles: subtle surface fill, primary text, left-aligned.
 *  - Grouped consecutive messages from the same sender within 3 minutes
 *    have a tighter top margin and a tucked corner radius (the
 *    "continuation" affordance every chat ships).
 *  - Optimistic rows show a faint clock badge; failed rows show a
 *    coral retry chip.
 */
import React, { memo, useCallback } from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { SharedPostCard } from "@/components/SharedPostCard";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { formatDate } from "@/utils/formatter";
import type { ChatMessage } from "@/types";

/**
 * Parses a `#xmind/post/<id>` marker out of a message body. Sent by
 * `ShareToChatSheet` when a user shares a post into a DM. When present,
 * the bubble swaps the raw text for a `<SharedPostCard>` preview.
 */
const SHARED_POST_MARKER = /#xmind\/post\/([a-f0-9]{24})/i;

export interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  /** True when the previous message is from the same sender within 3 minutes. */
  grouped?: boolean;
  /** Show the timestamp beneath the bubble (i.e. last in a group). */
  showTimestamp?: boolean;
  /** Triggered when the user taps a failed message's retry pill. */
  onRetry?: (message: ChatMessage) => void;
  /** Other participant id — used to decide if THEY have read the message. */
  otherParticipantId?: string | null;
}

function MessageBubbleImpl({
  message,
  isMine,
  grouped,
  showTimestamp,
  onRetry,
  otherParticipantId,
}: MessageBubbleProps) {
  const { colors, spacing, radii } = useTheme();
  const handleRetry = useCallback(() => onRetry?.(message), [message, onRetry]);

  /**
   * Receipt state — WhatsApp's tick conventions:
   *  - pending: clock (still being sent)
   *  - sent:    single check (server has it)
   *  - read:    double check, blue tint (other participant has read it)
   *
   * "Delivered" (gray double check) requires a per-participant
   *  last-fetched timestamp we don't track yet; once a deliveredBy field
   *  lands on the server, the renderer drops in here without screen
   *  changes.
   */
  const receipt: "pending" | "sent" | "read" = message.pending
    ? "pending"
    : otherParticipantId &&
      (message.readBy ?? []).includes(otherParticipantId)
    ? "read"
    : "sent";

  const bubbleColor = isMine ? colors.chat.outgoingBg : colors.chat.incomingBg;
  const textColor = isMine ? colors.chat.outgoingText : colors.chat.incomingText;

  const sharedPostMatch = message.body.match(SHARED_POST_MARKER);
  const sharedPostId = sharedPostMatch?.[1] ?? null;

  // Tighter "tucked" corner on the inner side for grouped continuations.
  const innerRadius = grouped ? radii.md : radii.xl;
  const outerRadius = radii.xl;

  const radiusStyle = isMine
    ? {
        borderTopLeftRadius: outerRadius,
        borderBottomLeftRadius: outerRadius,
        borderTopRightRadius: grouped ? innerRadius : outerRadius,
        borderBottomRightRadius: outerRadius,
      }
    : {
        borderTopRightRadius: outerRadius,
        borderBottomRightRadius: outerRadius,
        borderTopLeftRadius: grouped ? innerRadius : outerRadius,
        borderBottomLeftRadius: outerRadius,
      };

  return (
    <View
      style={{
        paddingHorizontal: spacing.base,
        marginTop: grouped ? 2 : spacing.sm,
        flexDirection: "row",
        justifyContent: isMine ? "flex-end" : "flex-start",
      }}
    >
      <View style={{ maxWidth: "80%" }}>
        {sharedPostId ? (
          // Shared-post preview: skip the coloured bubble entirely so the
          // card stands as its own surface. The bubble bg would clash with
          // the card's own border + radius.
          <View
            style={{
              minWidth: 240,
              opacity: message.pending ? 0.65 : 1,
            }}
          >
            <SharedPostCard postId={sharedPostId} />
          </View>
        ) : (
          <View
            style={[
              {
                backgroundColor: bubbleColor,
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.sm + 2,
                opacity: message.pending ? 0.65 : 1,
              },
              radiusStyle,
            ]}
          >
            <Text variant="body" style={{ color: textColor }}>
              {message.body}
            </Text>
          </View>
        )}

        {showTimestamp ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 2,
              paddingHorizontal: 4,
              alignSelf: isMine ? "flex-end" : "flex-start",
            }}
          >
            <Text variant="caption" tone="tertiary">
              {formatDate(message.createdAt)}
            </Text>
            {/* Receipt ticks — only on outgoing messages. */}
            {isMine ? (
              receipt === "pending" ? (
                <Feather name="clock" size={11} color={colors.chat.timestamp} />
              ) : receipt === "read" ? (
                <Feather
                  name="check-circle"
                  size={12}
                  color={colors.tint.accent}
                />
              ) : (
                <Feather
                  name="check"
                  size={12}
                  color={colors.chat.timestamp}
                />
              )
            ) : null}
          </View>
        ) : null}

        {message.failed ? (
          <Pressable
            onPress={handleRetry}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Retry sending this message"
            style={{
              marginTop: 4,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              alignSelf: isMine ? "flex-end" : "flex-start",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.tint.danger + "22",
            }}
          >
            <Feather name="alert-circle" size={11} color={colors.tint.danger} />
            <Text variant="caption" tone="danger" weight="700">
              Tap to retry
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export const MessageBubble = memo(
  MessageBubbleImpl,
  (prev, next) =>
    prev.message._id === next.message._id &&
    prev.message.body === next.message.body &&
    prev.message.pending === next.message.pending &&
    prev.message.failed === next.message.failed &&
    (prev.message.readBy?.length ?? 0) === (next.message.readBy?.length ?? 0) &&
    prev.otherParticipantId === next.otherParticipantId &&
    prev.isMine === next.isMine &&
    prev.grouped === next.grouped &&
    prev.showTimestamp === next.showTimestamp
);
MessageBubble.displayName = "MessageBubble";

export default MessageBubble;
