/**
 * Single-conversation messages hook.
 *
 * Polling architecture (option A — pragmatic, no WebSocket infra):
 *  - `useInfiniteQuery` paginates by `nextCursor` (createdAt ISO of the
 *    oldest message currently loaded). Older messages load via
 *    `fetchNextPage`, which the FlashList v2 thread screen calls from
 *    `onStartReached` because in v2's `maintainVisibleContentPosition`
 *    pattern the visual top of the chat == the data start (oldest).
 *  - Polling refetches the FIRST page (newest messages) every 2 seconds
 *    while the screen is mounted AND the app is foreground. Older
 *    pages already in the cache aren't re-fetched.
 *  - Optimistic send: `appendOptimistic` immediately puts the new
 *    message on the first page with a temp `_id === clientId` and
 *    `pending: true`. When the server response lands (with the real
 *    `_id`), we reconcile by `clientId`, replacing the optimistic row
 *    in place. If the send fails, we mark the row `failed: true` and
 *    leave it in the cache for retry.
 *
 * Realtime upgrade path (documented for future reference):
 *  Swap `refetchInterval` for a WebSocket subscription that pushes
 *  events into `queryClient.setQueryData(["messages", id], …)`. Pusher /
 *  Ably's REST publish API integrates with this server in a single
 *  `POST` from the `sendMessage` controller. The mobile cache shape is
 *  designed not to change.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import {
  conversationApi,
  useApiClient,
  type MessagesPayload,
} from "@/utils/api";
import type { ChatMessage } from "@/types";

const PAGE_SIZE = 30;
const POLL_INTERVAL_MS = 2_000;

type MessagePage = MessagesPayload<ChatMessage>;
type MessagesKey = readonly ["messages", string];

export interface UseMessagesResult {
  /** Oldest-first array, ready to feed FlashList with `startRenderingFromBottom`. */
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Send a message — handles optimistic insert + server reconcile. */
  send: (input: { body: string; clientId: string }) => Promise<void>;
  /** Retry a previously-failed send (same clientId, same body). */
  retry: (input: { body: string; clientId: string }) => Promise<void>;
}

const EMPTY: ChatMessage[] = [];

export const useMessages = (
  conversationId: string | null | undefined
): UseMessagesResult => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );

  const queryKey = (conversationId
    ? (["messages", conversationId] as const)
    : (["messages", "_disabled"] as const)) as MessagesKey;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => setAppState(next));
    return () => sub.remove();
  }, []);

  // In-memory pending tracker. We don't need SQLite for v1; the cache
  // is the source of truth. Future-proofing: replace this with an
  // outbox row write when offline support is added — the rest of the
  // hook stays identical.
  const pendingRef = useRef<Set<string>>(new Set());

  const queryEnabled = !!conversationId;

  const query = useInfiniteQuery<
    MessagePage,
    Error,
    InfiniteData<MessagePage>,
    MessagesKey,
    string | null
  >({
    queryKey,
    enabled: queryEnabled,
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      if (!conversationId) {
        return { messages: [], nextCursor: null };
      }
      const response = await conversationApi.listMessages<ChatMessage>(
        api,
        conversationId,
        { cursor: pageParam, limit: PAGE_SIZE }
      );
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: () =>
      queryEnabled && appState === "active" ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    // Polling refreshes the first page only — TanStack default behaviour.
    staleTime: 1_000,
  });

  // Flatten — server returns newest-first per page; we reverse so the
  // final array is oldest-first (matches FlashList v2's
  // `maintainVisibleContentPosition.startRenderingFromBottom` contract).
  const messages = (() => {
    const pages = query.data?.pages;
    if (!pages || pages.length === 0) return EMPTY;
    const flat: ChatMessage[] = [];
    // Pages are ordered first-fetched (newest) → last-fetched (oldest).
    // Inside each page, messages are newest-first. We want the final
    // array oldest-first, so iterate pages from last to first and
    // reverse each page's messages.
    for (let i = pages.length - 1; i >= 0; i--) {
      const page = pages[i];
      for (let j = page.messages.length - 1; j >= 0; j--) {
        flat.push(page.messages[j]);
      }
    }
    return flat;
  })();

  // ── Optimistic send ───────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (input: { body: string; clientId: string }) => {
      if (!conversationId) throw new Error("No conversation");
      const response = await conversationApi.sendMessage<ChatMessage>(
        api,
        conversationId,
        input
      );
      return response.data.message;
    },
    onMutate: async (input) => {
      if (!conversationId) return;
      pendingRef.current.add(input.clientId);
      await queryClient.cancelQueries({ queryKey });

      const optimistic: ChatMessage = {
        _id: input.clientId,
        conversation: conversationId,
        sender: "self",
        body: input.body,
        createdAt: new Date().toISOString(),
        readBy: [],
        clientId: input.clientId,
        pending: true,
      };

      queryClient.setQueryData<InfiniteData<MessagePage>>(queryKey, (old) => {
        if (!old || old.pages.length === 0) {
          return {
            pageParams: [null],
            pages: [{ messages: [optimistic], nextCursor: null }],
          };
        }
        // Insert at the start of the first (newest) page.
        const first = old.pages[0];
        const filtered = first.messages.filter(
          (m) => m.clientId !== input.clientId
        );
        return {
          ...old,
          pages: [
            { ...first, messages: [optimistic, ...filtered] },
            ...old.pages.slice(1),
          ],
        };
      });
    },
    onSuccess: (serverMessage, input) => {
      pendingRef.current.delete(input.clientId);
      queryClient.setQueryData<InfiniteData<MessagePage>>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page, idx) => {
            if (idx !== 0) return page;
            // Replace the optimistic row (matched by clientId) with
            // the server row. If the server didn't return clientId
            // back (older deployments), match on body+pending fallback.
            let replaced = false;
            const messages = page.messages.map((m) => {
              if (
                m.clientId === input.clientId ||
                (!replaced && m.pending && m.body === input.body)
              ) {
                replaced = true;
                return { ...serverMessage, pending: false };
              }
              return m;
            });
            // If for some reason no optimistic row was found, prepend.
            if (!replaced) {
              return { ...page, messages: [serverMessage, ...messages] };
            }
            return { ...page, messages };
          }),
        };
      });
      // Bump the inbox so the conversation re-sorts to top.
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (_err, input) => {
      pendingRef.current.delete(input.clientId);
      queryClient.setQueryData<InfiniteData<MessagePage>>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page, idx) => {
            if (idx !== 0) return page;
            return {
              ...page,
              messages: page.messages.map((m) =>
                m.clientId === input.clientId
                  ? { ...m, pending: false, failed: true }
                  : m
              ),
            };
          }),
        };
      });
    },
  });

  const send = useCallback(
    async (input: { body: string; clientId: string }) => {
      await sendMutation.mutateAsync(input);
    },
    [sendMutation]
  );

  const retry = useCallback(
    async (input: { body: string; clientId: string }) => {
      // Clear failed flag while we retry.
      queryClient.setQueryData<InfiniteData<MessagePage>>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page, idx) => {
            if (idx !== 0) return page;
            return {
              ...page,
              messages: page.messages.map((m) =>
                m.clientId === input.clientId
                  ? { ...m, failed: false, pending: true }
                  : m
              ),
            };
          }),
        };
      });
      await sendMutation.mutateAsync(input);
    },
    [queryClient, queryKey, sendMutation]
  );

  return {
    messages,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    send,
    retry,
  };
};
