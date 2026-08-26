/**
 * Chat thread screen.
 *
 * SDK 54/55 specifics in play here:
 *  1. FlashList v2 — `inverted` is deprecated. We use
 *     `maintainVisibleContentPosition.startRenderingFromBottom: true`
 *     instead. With that flag, "scrolling up" to load history fires
 *     `onStartReached` (the data start IS the visual top, no inversion
 *     happening underneath).
 *  2. Babel plugin is `react-native-worklets/plugin` (renamed from
 *     `react-native-reanimated/plugin` — fixed in babel.config.js).
 *  3. Composer uses `react-native-keyboard-controller`'s
 *     `KeyboardAvoidingView` — RN's built-in is jittery and fights
 *     edge-to-edge on Android.
 *  4. Optimistic send + clientId reconciliation inside `useMessages`.
 *
 * Polling pauses when the app goes background (handled inside
 * `useMessages`), so opening the app to a backlog still triggers a
 * refresh on resume without burning battery while idle.
 */
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useQueryClient } from "@tanstack/react-query";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { Text } from "@/components/ui/Text";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import MessageBubble from "@/components/MessageBubble";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useChatComposer } from "@/hooks/useChatComposer";
import { conversationApi, useApiClient } from "@/utils/api";
import type { ChatMessage } from "@/types";

const GROUP_WINDOW_MS = 3 * 60_000;

export default function ChatThreadScreen() {
  const { colors, spacing, radii } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiClient();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();

  const { currentUser } = useCurrentUser();
  const { conversations } = useConversations();
  const conversation = useMemo(
    () => conversations.find((c) => c._id === conversationId) ?? null,
    [conversationId, conversations]
  );
  const other = useMemo(() => {
    if (!conversation) return null;
    return (
      conversation.participants?.find((p) => p._id !== currentUser?._id) ??
      conversation.participants?.[0] ??
      null
    );
  }, [conversation, currentUser?._id]);

  const {
    messages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    retry,
  } = useMessages(conversationId);

  const { draft, setDraft, canSend, send, isSending } = useChatComposer(
    conversationId
  );

  // Mark read on mount + whenever the message list updates and the
  // newest message isn't ours.
  useEffect(() => {
    if (!conversationId) return;
    conversationApi
      .markRead(api, conversationId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .catch(() => undefined);
  }, [api, conversationId, messages.length, queryClient]);

  const listRef = useRef<FlashListRef<ChatMessage>>(null);

  const handleRetry = useCallback(
    (m: ChatMessage) => {
      if (!m.clientId) return;
      retry({ body: m.body, clientId: m.clientId }).catch(() => undefined);
    },
    [retry]
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ChatMessage>) => {
      const senderId = item.sender;
      const isMine =
        item.sender === "self" ||
        (currentUser?._id && senderId === currentUser._id);
      const prev = messages[index - 1];
      const next = messages[index + 1];
      const grouped =
        !!prev &&
        prev.sender === item.sender &&
        new Date(item.createdAt).getTime() -
          new Date(prev.createdAt).getTime() <
          GROUP_WINDOW_MS;
      const showTimestamp =
        !next ||
        next.sender !== item.sender ||
        new Date(next.createdAt).getTime() -
          new Date(item.createdAt).getTime() >
          GROUP_WINDOW_MS;
      return (
        <MessageBubble
          message={item}
          isMine={!!isMine}
          grouped={grouped}
          showTimestamp={showTimestamp}
          onRetry={item.failed ? handleRetry : undefined}
          otherParticipantId={other?._id ?? null}
        />
      );
    },
    [currentUser?._id, handleRetry, messages, other?._id]
  );

  const keyExtractor = useCallback(
    (m: ChatMessage) => m.clientId ?? m._id,
    []
  );

  const handleStartReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Send button scale — gently grows when the draft has content.
  const sendScale = useSharedValue(0.85);
  useEffect(() => {
    sendScale.value = withSpring(canSend ? 1 : 0.85, {
      damping: 16,
      stiffness: 360,
      mass: 0.5,
    });
  }, [canSend, sendScale]);
  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const onSend = useCallback(() => {
    if (!canSend || isSending) return;
    send().catch(() => undefined);
    listRef.current?.scrollToEnd({ animated: true });
  }, [canSend, isSending, send]);

  // FlashList v2 chat config — memoised so recycling stays effective.
  const maintainPosition = useMemo(
    () => ({
      startRenderingFromBottom: true,
      autoscrollToBottomThreshold: 0.2,
    }),
    []
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
          {other ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${other.firstName}'s profile`}
              onPress={() =>
                router.push({
                  pathname: "/user-profile",
                  params: { userId: other._id, username: other.username },
                })
              }
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Avatar
                source={other.profilePicture}
                name={`${other.firstName} ${other.lastName}`}
                size={36}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text variant="subtitle" tone="primary" numberOfLines={1}>
                    {other.firstName} {other.lastName}
                  </Text>
                  {other.verified ? <VerifiedBadge size={12} /> : null}
                </View>
                <Text variant="caption" tone="tertiary">
                  @{other.username}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }}>
              <Text variant="subtitle" tone="primary">
                Loading conversation
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1 }}>
          {isLoading && messages.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text variant="bodySm" tone="tertiary">
                Loading messages…
              </Text>
            </View>
          ) : messages.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: spacing.xxl,
                gap: spacing.sm,
              }}
            >
              <Feather name="message-circle" size={32} color={colors.tint.primary} />
              <Text variant="title" tone="primary" align="center">
                Say hi
              </Text>
              <Text variant="body" tone="secondary" align="center">
                The first message is the warmest one. A real sentence beats a wave.
              </Text>
            </View>
          ) : (
            <FlashList<ChatMessage>
              ref={listRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              // FlashList v2 chat pattern (replaces deprecated `inverted`).
              maintainVisibleContentPosition={maintainPosition}
              onStartReached={handleStartReached}
              onStartReachedThreshold={0.5}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: spacing.sm,
                paddingBottom: spacing.sm,
              }}
            />
          )}
        </View>

        {/* Composer */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: spacing.sm,
            paddingHorizontal: spacing.base,
            paddingTop: spacing.sm,
            paddingBottom: Math.max(spacing.sm, insets.bottom),
            borderTopWidth: 0.5,
            borderTopColor: colors.border.subtle,
            backgroundColor: colors.bg.canvas,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: radii.xl,
              backgroundColor: colors.surface.secondary,
              paddingHorizontal: spacing.base,
              paddingVertical: 8,
              minHeight: 44,
              maxHeight: 120,
              justifyContent: "center",
            }}
          >
            <TextInput
              style={{
                fontSize: 15,
                lineHeight: 20,
                color: colors.text.primary,
                textAlignVertical: "center",
              }}
              placeholder="Message"
              placeholderTextColor={colors.text.tertiary}
              value={draft}
              onChangeText={setDraft}
              multiline
              accessibilityLabel="Message"
            />
          </View>
          <Animated.View style={sendStyle}>
            <Pressable
              onPress={onSend}
              disabled={!canSend || isSending}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !canSend || isSending }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: canSend
                  ? colors.tint.primary
                  : colors.surface.sunken,
              }}
            >
              <Feather
                name="send"
                size={18}
                color={canSend ? colors.text.onTint : colors.text.tertiary}
              />
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
