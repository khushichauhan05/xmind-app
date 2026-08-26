import { useCallback, useState } from "react";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import { commentApi, useApiClient, type PostsPayload } from "@/utils/api";
import { useCustomAlert } from "@/hooks/useCustomAlert";
import type { Comment, Post } from "@/types";

/**
 * Comment composer + delete actions + reply targeting.
 *
 * `replyTarget` is the comment the user has chosen to reply to. When
 * present, the next `createComment(postId)` call sends with `parentId`
 * set to the target's id. The composer surfaces a "Replying to
 * @username" hint above the input so the user can confirm or cancel.
 *
 * On send: invalidates the posts feed (commentCount changes) and the
 * `["comments", postId]` cache so the new reply appears.
 */
export const useComments = () => {
  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const api = useApiClient();
  const queryClient = useQueryClient();

  // CommentsModal hosts a <Modal>; nested Modals don't stack in RN, so
  // route alerts through the platform-native Alert.alert.
  const { showError, showInfo, showDeleteConfirmation } = useCustomAlert({
    useNative: true,
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({
      postId,
      content,
      parentId,
    }: {
      postId: string;
      content: string;
      parentId?: string | null;
    }) => {
      const response = await commentApi.createComment<Comment>(
        api,
        postId,
        content,
        parentId
      );
      return response.data.comment;
    },
    onSuccess: (_data, variables) => {
      setCommentText("");
      setReplyTarget(null);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["comments", variables.postId] });
    },
    onError: () => {
      showError("Couldn't send", "We couldn't post that reply. Try once more.");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await commentApi.deleteComment(api, commentId);
      return response.data;
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      const previous = queryClient.getQueryData<InfiniteData<PostsPayload<Post>>>([
        "posts",
      ]);
      queryClient.setQueryData<InfiniteData<PostsPayload<Post>>>(["posts"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) => ({
              ...p,
              comments: (p.comments ?? []).filter((c) => c._id !== commentId),
            })),
          })),
        };
      });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["posts"], ctx.previous);
      showError("Couldn't delete", "We couldn't remove that reply. Try once more.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments"] });
    },
  });

  const createComment = useCallback(
    (postId: string) => {
      if (!commentText.trim()) {
        showInfo("Reply is empty", "Type something before sending.");
        return;
      }
      createCommentMutation.mutate({
        postId,
        content: commentText.trim(),
        parentId: replyTarget?._id ?? null,
      });
    },
    [commentText, createCommentMutation, replyTarget?._id, showInfo]
  );

  const deleteComment = useCallback(
    (commentId: string) => {
      showDeleteConfirmation(
        "Delete this reply?",
        "It won't undo it for people who've already seen it.",
        () => deleteCommentMutation.mutate(commentId)
      );
    },
    [deleteCommentMutation, showDeleteConfirmation]
  );

  const cancelReply = useCallback(() => setReplyTarget(null), []);

  return {
    commentText,
    setCommentText,
    createComment,
    deleteComment,
    replyTarget,
    setReplyTarget,
    cancelReply,
    isCreatingComment: createCommentMutation.isPending,
    isDeletingComment: deleteCommentMutation.isPending,
  };
};
