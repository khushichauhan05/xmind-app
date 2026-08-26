/**
 * Chat inbox hook.
 *
 * Architecture:
 *  - TanStack Query under `["conversations"]`.
 *  - Polls every 5 seconds while the app is foreground; pauses when
 *    the app goes background (AppState 'active' check inside the
 *    `refetchInterval` callback).
 *  - Server returns conversations sorted by `lastActivityAt` desc with
 *    `unreadCount` already computed, so the inbox is a thin renderer.
 *
 * Realtime upgrade path:
 *  Replace the `refetchInterval` with a WebSocket subscription that
 *  calls `queryClient.setQueryData(["conversations"], …)` on each
 *  message event. The shape of the cache stays identical, so screens
 *  don't need changes. Pusher / Ably are the cleanest swap that keeps
 *  Vercel as the host.
 */
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { conversationApi, useApiClient } from "@/utils/api";
import type { Conversation } from "@/types";

const POLL_INTERVAL_MS = 5_000;

export const useConversations = () => {
  const api = useApiClient();
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => setAppState(next));
    return () => sub.remove();
  }, []);

  const query = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: async () => {
      const response = await conversationApi.list<Conversation>(api);
      return response.data.conversations;
    },
    // Polling is foreground-only. When the app is background/inactive
    // we return false so TanStack pauses the poll entirely.
    refetchInterval: () => (appState === "active" ? POLL_INTERVAL_MS : false),
    refetchIntervalInBackground: false,
    staleTime: 2_000,
  });

  return {
    conversations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
};
