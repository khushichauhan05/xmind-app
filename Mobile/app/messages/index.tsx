/**
 * Messages — inbox.
 *
 * Lever: progress signal.
 *  Unread badges per row + a compact title that names the queue size
 *  give the user a clean signal of "what's waiting" without requiring
 *  them to open every conversation.
 *
 * Polling lives in `useConversations`; no extra wiring here.
 */
import React, { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";

import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import ChatCard from "@/components/ChatCard";
import { useTheme } from "@/hooks/useTheme";
import { useConversations } from "@/hooks/useConversations";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Conversation } from "@/types";

export default function MessagesScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { conversations, isLoading, refetch } = useConversations();
  const { currentUser } = useCurrentUser();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  // Polling spinner discipline: the inbox refetches every 5s in the
  // background, so binding RefreshControl to `isRefetching` made the
  // spinner flash on every poll. Only show it on a deliberate
  // pull-to-refresh; automatic polls stay invisible.
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const onManualRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetch]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const other = c.participants?.find((p) => p._id !== currentUser?._id);
      if (!other) return false;
      const inName =
        `${other.firstName} ${other.lastName}`.toLowerCase().includes(q) ||
        other.username.toLowerCase().includes(q);
      const inMessage = c.lastMessage?.body?.toLowerCase().includes(q) ?? false;
      return inName || inMessage;
    });
  }, [conversations, currentUser?._id, deferredQuery]);

  const onPressConversation = useCallback(
    (c: Conversation) => {
      router.push({
        pathname: "/messages/[conversationId]",
        params: { conversationId: c._id },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Conversation>) => (
      <ChatCard
        conversation={item}
        currentUserId={currentUser?._id ?? null}
        onPress={onPressConversation}
      />
    ),
    [currentUser?._id, onPressConversation]
  );

  const keyExtractor = useCallback((c: Conversation) => c._id, []);

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={["top"]}>
        <View className="w-full flex-row items-center px-lg py-md gap-md border-b-[0.5px] border-subtle">
          <IconButton
            accessibilityLabel="Back"
            onPress={() => router.back()}
            variant="filled"
          >
            <Feather name="arrow-left" size={18} color={colors.text.primary} />
          </IconButton>
          <View className="flex-1">
            <Text variant="title" tone="primary">
              Messages
            </Text>
            <Text variant="bodySm" tone="secondary">
              {filtered.length}{" "}
              {filtered.length === 1 ? "conversation" : "conversations"}
            </Text>
          </View>
        </View>

        <View className="px-lg py-sm">
          <TextField
            shape="pill"
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, handle, or message"
            leading={<Feather name="search" size={18} color={colors.text.tertiary} />}
            trailing={
              query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery("")}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear"
                >
                  <Feather name="x" size={16} color={colors.text.secondary} />
                </Pressable>
              ) : null
            }
          />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View className="px-lg py-md gap-md">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="flex-row gap-md items-center">
              <Skeleton width={56} height={56} radius={28} />
              <View className="flex-1 gap-sm">
                <Skeleton width="40%" height={14} />
                <Skeleton width="80%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Feather name="send" size={28} color={colors.tint.primary} />}
          title={query ? "No conversations match" : "Inbox zero"}
          description={
            query
              ? "Try a shorter name or a different keyword."
              : "Open someone's profile and tap message — your first thread will live here."
          }
        />
      ) : (
        <FlashList<Conversation>
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{
            paddingTop: spacing.md,
            paddingBottom: 80 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={onManualRefresh}
              tintColor={colors.tint.primary}
              colors={[colors.tint.primary]}
            />
          }
        />
      )}
    </View>
  );
}
