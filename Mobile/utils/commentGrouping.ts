/**
 * Group comments by parent.
 *
 * Backend returns top-level comments and replies in one flat array
 * sorted by `createdAt` desc. The UI wants top-level threads ordered
 * newest-first, with replies inside each thread ordered oldest-first
 * (a reading order that matches every chat / forum we know — replies
 * unfold the discussion forwards, even when the threads themselves are
 * stacked newest-first).
 */
import type { Comment } from "@/types";

export interface CommentThread {
  root: Comment;
  replies: Comment[];
}

export function groupComments(comments: Comment[]): CommentThread[] {
  const replyBuckets = new Map<string, Comment[]>();
  const roots: Comment[] = [];

  for (const c of comments) {
    if (c.parent) {
      const list = replyBuckets.get(c.parent) ?? [];
      list.push(c);
      replyBuckets.set(c.parent, list);
    } else {
      roots.push(c);
    }
  }

  // Reply order: oldest-first inside each thread.
  for (const list of replyBuckets.values()) {
    list.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  return roots.map((root) => ({
    root,
    replies: replyBuckets.get(root._id) ?? [],
  }));
}
