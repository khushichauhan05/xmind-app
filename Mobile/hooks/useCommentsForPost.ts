/**
 * Fetches the full comment list for a single post.
 *
 * Why this exists:
 *  The feed payload (cursor-paginated /api/posts) ships only `commentCount`
 *  per post. Loading all comments inline would balloon the wire size of
 *  every page. The CommentsModal opens lazily, so it gets to do its own
 *  fetch — small, cached for 30 s, and refreshed on pull-to-refresh.
 */
import { useQuery } from "@tanstack/react-query";

import { commentApi, useApiClient } from "@/utils/api";
import type { Comment } from "@/types";

export const useCommentsForPost = (postId: string | null | undefined) => {
  const api = useApiClient();

  const {
    data: comments,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<Comment[]>({
    queryKey: ["comments", postId],
    queryFn: async () => {
      if (!postId) return [];
      const response = await commentApi.getComments<Comment>(api, postId);
      return response.data.comments ?? [];
    },
    enabled: !!postId,
    staleTime: 30_000,
  });

  return {
    comments: comments ?? [],
    isLoading,
    error,
    refetch,
    isRefetching,
  };
};
