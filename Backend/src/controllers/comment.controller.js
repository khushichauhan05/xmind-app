import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import Comment from "../models/comment.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";

export const getComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  // Top-level + replies are returned in one shot; the client groups
  // them by `parent`. Sort top-level by recency so the latest top-level
  // comment surfaces first; the client handles reply ordering inside
  // each thread (oldest-first inside a thread reads more naturally
  // than newest-first does).
  const comments = await Comment.find({ post: postId })
    .sort({ createdAt: -1 })
    .populate("user", "username firstName lastName profilePicture verified")
    .lean();

  res.status(200).json({ comments });
});

export const createComment = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { postId } = req.params;
  const { content, parentId } = req.body;

  if (!content || content.trim() === "") {
    return res.status(400).json({ error: "Comment content is required" });
  }

  const user = await User.findOne({ clerkId: userId });
  const post = await Post.findById(postId);

  if (!user || !post)
    return res.status(404).json({ error: "User or post not found" });

  // Reply path — flatten "reply to a reply" into a reply on the
  // original parent so the thread doesn't drift into deep recursion.
  // Notify the parent comment's author when the reply is by someone else.
  let resolvedParentId = null;
  let parentAuthorId = null;
  if (parentId) {
    if (!mongoose.isValidObjectId(parentId)) {
      return res.status(400).json({ error: "Invalid parent id" });
    }
    const parent = await Comment.findById(parentId).select("post parent user").lean();
    if (!parent) {
      return res.status(404).json({ error: "Parent comment not found" });
    }
    if (String(parent.post) !== String(postId)) {
      return res.status(400).json({ error: "Parent belongs to a different post" });
    }
    // If the "parent" is itself a reply, hoist to its parent so we keep
    // the depth at one level.
    resolvedParentId = parent.parent ?? parent._id;
    parentAuthorId = parent.user;
  }

  const comment = await Comment.create({
    user: user._id,
    post: postId,
    content,
    parent: resolvedParentId,
  });

  // Link the comment to the post for backwards compatibility — the
  // legacy Post.comments array is still used by the size projection in
  // the feed.
  await Post.findByIdAndUpdate(postId, {
    $push: { comments: comment._id },
  });

  // Notify the post author (top-level) or the parent comment author
  // (reply). Skip self-notifications.
  const notifyTargets = new Set();
  if (post.user.toString() !== user._id.toString()) {
    notifyTargets.add(post.user.toString());
  }
  if (parentAuthorId && parentAuthorId.toString() !== user._id.toString()) {
    notifyTargets.add(parentAuthorId.toString());
  }
  await Promise.all(
    Array.from(notifyTargets).map((to) =>
      Notification.create({
        from: user._id,
        to,
        type: "comment",
        post: postId,
        comment: comment._id,
      }).catch((err) => console.error("[comment] notification error:", err))
    )
  );

  res.status(201).json({ comment });
});

/**
 * Atomic comment-like toggle.
 *
 * Same pattern as `likePost`: try to PULL the user from the likes array.
 * If nothing was modified, ADD the user instead. The two-write approach
 * is race-safe — only one of the two writes will report
 * `modifiedCount > 0`.
 */
export const likeComment = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { commentId } = req.params;
  if (!mongoose.isValidObjectId(commentId)) {
    return res.status(400).json({ error: "Invalid comment id" });
  }

  const user = await User.findOne({ clerkId: userId }).select("_id").lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const unlike = await Comment.updateOne(
    { _id: commentId, likes: user._id },
    { $pull: { likes: user._id } }
  );

  let liked;
  if (unlike.matchedCount === 0) {
    const like = await Comment.updateOne(
      { _id: commentId },
      { $addToSet: { likes: user._id } }
    );
    if (like.matchedCount === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }
    liked = true;
  } else {
    liked = false;
  }

  const fresh = await Comment.findById(commentId).select("likes").lean();
  const likeCount = fresh ? (fresh.likes?.length ?? 0) : 0;
  res.status(200).json({ liked, likeCount });
});

export const deleteComment = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { commentId } = req.params;

  const user = await User.findOne({ clerkId: userId });
  const comment = await Comment.findById(commentId);

  if (!user || !comment) {
    return res.status(404).json({ error: "User or comment not found" });
  }

  if (comment.user.toString() !== user._id.toString()) {
    return res.status(403).json({ error: "You can only delete your own comments" });
  }

  // remove comment from post
  await Post.findByIdAndUpdate(comment.post, {
    $pull: { comments: commentId },
  });

  // delete the comment
  await Comment.findByIdAndDelete(commentId);

  res.status(200).json({ message: "Comment deleted successfully" });
});
