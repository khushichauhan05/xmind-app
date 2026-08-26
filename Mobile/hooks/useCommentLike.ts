/**
 * Comment-like mutation.
 *
 * Optimistically toggles the viewer's id in the comment's `likes` array,
 * patches every cached page of `["comments", postId]`, and rolls back
 * on failure. Same pattern as the post-like mutation in `usePosts`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { commentApi, useApiClient } from "@/utils/api";
import type { Comment, User } from "@/types";

function readViewerIdFromCache(
  queryClient: ReturnType<typeof useQueryClient>
): string | null {
  const cached = queryClient.getQueryData<User | null>(["authUser"]);
  return cached?._id ?? null;
}

function toggleLikeFor(comment: Comment, viewerId: string): Comment {
  const likes = comment.likes ?? [];
  const isLiked = likes.includes(viewerId);
  return {
    ...comment,
    likes: isLiked ? likes.filter((id) => id !== viewerId) : [...likes, viewerId],
  };
}

export const useCommentLike = (postId: string | null | undefined) => {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (commentId: string) =>
      commentApi.likeComment(api, commentId).then((r) => r.data),
    onMutate: async (commentId) => {
      if (!postId) return { previous: undefined };
      await queryClient.cancelQueries({ queryKey: ["comments", postId] });
      const previous = queryClient.getQueryData<Comment[]>(["comments", postId]);
      const viewerId = readViewerIdFromCache(queryClient);

      queryClient.setQueryData<Comment[]>(["comments", postId], (old) => {
        if (!old || !viewerId) return old;
        return old.map((c) => (c._id === commentId ? toggleLikeFor(c, viewerId) : c));
      });

      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (postId && ctx?.previous) {
        queryClient.setQueryData(["comments", postId], ctx.previous);
      }
    },
  });

  return {
    toggleLike: mutation.mutate,
    isLikePending: mutation.isPending,
  };
};
