import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { postApi, useApiClient, type PostsPayload } from "@/utils/api";
import type { Post, User } from "@/types";

const PAGE_SIZE = 20;

type FeedPage = PostsPayload<Post>;
type FeedKey = readonly ["posts"] | readonly ["userPosts", string];

/**
 * Posts data hook.
 *
 * Uses TanStack `useInfiniteQuery` so the feed paginates by cursor
 * (server returns `nextCursor` based on the oldest post's `createdAt`).
 *
 * Mutation behaviour:
 *  - `toggleLike` is optimistic — the heart fills before the network
 *    round-trip. The backend returns the canonical `liked` + `likeCount`
 *    so we reconcile on success and roll back on error.
 *  - `deletePost` removes the post from the cache immediately.
 *
 * The previous version invalidated `["posts"]` on every like, which
 * forced a full refetch and a list re-render every time. With the
 * optimistic patch the network call is fire-and-forget from the user's
 * perspective.
 */
export const usePosts = (username?: string) => {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const queryKey: FeedKey = username ? (["userPosts", username] as const) : (["posts"] as const);

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<FeedPage, Error, InfiniteData<FeedPage>, FeedKey, string | null>({
    queryKey,
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const opts = { cursor: pageParam, limit: PAGE_SIZE };
      const response = username
        ? await postApi.getUserPosts<Post>(api, username, opts)
        : await postApi.getPosts<Post>(api, opts);
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // Memoise the flattened list. Without this, every render returns a
  // brand-new array reference, which cascades through every downstream
  // useMemo (search, ranking, suggested users) and creates an
  // infinite-loop hazard in any consumer that mirrors the value into
  // useState. Keyed on the underlying pages array — TanStack guarantees
  // a new pages reference only when the cache actually changes.
  const posts: Post[] = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? EMPTY_POSTS,
    [data?.pages]
  );

  // ── Like toggle (optimistic) ───────────────────────────────────────────
  const likePostMutation = useMutation({
    mutationFn: (postId: string) => postApi.likePost(api, postId).then((r) => r.data),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<FeedPage>>(queryKey);
      const viewerId = readViewerIdFromCache(queryClient);

      queryClient.setQueryData<InfiniteData<FeedPage>>(queryKey, (old) => {
        if (!old || !viewerId) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) =>
              p._id === postId ? toggleLikeFor(p, viewerId) : p
            ),
          })),
        };
      });
      return { previous };
    },
    onError: (_err, _postId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    // No invalidation on success — the optimistic patch already matches
    // the server's canonical state. A foreground refetch would re-render
    // the whole list for no visible benefit.
  });

  // ── Reshare toggle (optimistic) ────────────────────────────────────────
  // Mirrors `toggleLike` but mutates the *canonical* original's `reposts`
  // array. When the row is itself a reshare entry, we optimistically
  // patch the populated `originalPost` so the count + state ticker on the
  // active card reflects the new state without a refetch.
  const resharePostMutation = useMutation({
    mutationFn: (postId: string) => postApi.resharePost(api, postId).then((r) => r.data),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<FeedPage>>(queryKey);
      const viewerId = readViewerIdFromCache(queryClient);

      queryClient.setQueryData<InfiniteData<FeedPage>>(queryKey, (old) => {
        if (!old || !viewerId) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) => toggleReshareFor(p, postId, viewerId)),
          })),
        };
      });
      return { previous };
    },
    onError: (_err, _postId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    // The server returns the canonical repostCount; subsequent reads will
    // pick it up via the next paginated refetch. No forced invalidation.
  });

  // ── Delete (optimistic) ────────────────────────────────────────────────
  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => postApi.deletePost(api, postId).then((r) => r.data),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<FeedPage>>(queryKey);
      queryClient.setQueryData<InfiniteData<FeedPage>>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.filter((p) => p._id !== postId),
          })),
        };
      });
      return { previous };
    },
    onError: (_err, _postId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });

  const checkIsLiked = useCallback(
    (postLikes: string[] | undefined, currentUser: User | null | undefined): boolean => {
      if (!currentUser || !postLikes) return false;
      return postLikes.includes(currentUser._id);
    },
    []
  );

  /** Returns true when the viewer has reshared the canonical original
   *  for this row — handles both "this row is the original" and "this
   *  row is a reshare entry whose source we've reshared." */
  const checkIsReshared = useCallback(
    (post: Post | null | undefined, currentUser: User | null | undefined): boolean => {
      if (!post || !currentUser) return false;
      const source = post.originalPost ?? post;
      return (source.reposts ?? []).includes(currentUser._id);
    },
    []
  );

  return {
    posts,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    toggleLike: likePostMutation.mutate,
    toggleReshare: resharePostMutation.mutate,
    deletePost: deletePostMutation.mutate,
    checkIsLiked,
    checkIsReshared,
  };
};

/**
 * Pulls the viewer's `_id` from the `["authUser"]` query cache so we can
 * compute optimistic like state without prop-drilling the user through
 * every list call site. Returns `null` if the auth query hasn't resolved
 * yet (the like will still fire; we just skip the optimistic patch).
 */
function readViewerIdFromCache(queryClient: ReturnType<typeof useQueryClient>): string | null {
  const cached = queryClient.getQueryData<User | null>(["authUser"]);
  return cached?._id ?? null;
}

// Stable empty-array sentinel so the `posts` reference doesn't churn while
// the first page is still loading.
const EMPTY_POSTS: Post[] = [];

function toggleLikeFor(post: Post, viewerId: string): Post {
  const likes = post.likes ?? [];
  const isLiked = likes.includes(viewerId);
  return {
    ...post,
    likes: isLiked ? likes.filter((id) => id !== viewerId) : [...likes, viewerId],
  };
}

/**
 * Optimistically toggles the viewer's reshare on the row whose canonical
 * original matches `targetId`. Handles both shapes: the row IS the
 * original, or the row is a reshare entry whose `originalPost.id` we
 * passed in. Touches `reposts` and `repostCount` so the action bar's
 * "active" state and the count below it update in lockstep.
 */
function toggleReshareFor(post: Post, targetId: string, viewerId: string): Post {
  // The user can hit the reshare button on either the canonical row or
  // a reshare-entry row whose populated `originalPost` is the canonical.
  // Match on either id.
  const sourceId = post.originalPost?._id ?? post._id;
  if (sourceId !== targetId) return post;

  const flip = (reposts: string[] | undefined): { next: string[]; was: boolean } => {
    const list = reposts ?? [];
    const was = list.includes(viewerId);
    return {
      was,
      next: was ? list.filter((id) => id !== viewerId) : [...list, viewerId],
    };
  };

  if (post.originalPost) {
    const { next } = flip(post.originalPost.reposts);
    return {
      ...post,
      originalPost: {
        ...post.originalPost,
        reposts: next,
        repostCount: next.length,
      },
    };
  }

  const { next } = flip(post.reposts);
  return {
    ...post,
    reposts: next,
    repostCount: next.length,
  };
}
