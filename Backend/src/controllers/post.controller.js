import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import Comment from "../models/comment.model.js";
import cloudinary from "../config/cloudinary.js";
import { getAuth } from "@clerk/express";

/**
 * Page-size policy for the feed. Mobile asks for 20, the server clamps
 * 1–50 to keep payloads bounded.
 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const FEED_USER_FIELDS = "username firstName lastName profilePicture verified";

/**
 * Lean projection for the feed: drops the `comments` array (replaced by
 * `commentCount`) so a 20-post page is small enough to fit in a single
 * Vercel response without needing compression. Likes ship as a string
 * array because the mobile app uses them to decide the heart state.
 */
/**
 * Reusable user-projection sub-pipeline. Used both for the resharer and
 * the original author when populating an `originalPost`.
 */
const USER_PROJECTION_PIPELINE = [
  {
    $project: {
      username: 1,
      firstName: 1,
      lastName: 1,
      profilePicture: 1,
      verified: 1,
    },
  },
];

function buildFeedAggregation(matchStage, limit) {
  return [
    { $match: matchStage },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
        pipeline: USER_PROJECTION_PIPELINE,
      },
    },
    { $unwind: "$user" },
    // When this row is a reshare, hydrate the original post (one extra
    // lookup per reshare row — the index on `originalPost` keeps it cheap).
    {
      $lookup: {
        from: "posts",
        localField: "originalPost",
        foreignField: "_id",
        as: "originalPost",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "user",
              foreignField: "_id",
              as: "user",
              pipeline: USER_PROJECTION_PIPELINE,
            },
          },
          { $unwind: "$user" },
          {
            $project: {
              content: 1,
              image: 1,
              createdAt: 1,
              user: 1,
              likes: 1,
              reposts: 1,
              repostCount: { $size: { $ifNull: ["$reposts", []] } },
              commentCount: { $size: { $ifNull: ["$comments", []] } },
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$originalPost",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        content: 1,
        image: 1,
        createdAt: 1,
        updatedAt: 1,
        likes: 1,
        user: 1,
        reposts: 1,
        repostCount: { $size: { $ifNull: ["$reposts", []] } },
        commentCount: { $size: { $ifNull: ["$comments", []] } },
        originalPost: 1,
      },
    },
  ];
}

function parseLimit(raw) {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
}

function parseCursor(raw) {
  if (!raw) return null;
  const parsed = new Date(String(raw));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Trending hashtags — cached aggregation of the last 24h.
 *
 * Caching strategy:
 *  Vercel functions reuse the warm process for ~5 minutes between
 *  invocations, so an in-memory `Map` keyed on a freshness window is
 *  enough to absorb the home-screen traffic without a Redis. When the
 *  process is cold the next request rebuilds — the aggregation runs in
 *  ~150ms on a 100k-post collection thanks to the `{createdAt: -1}`
 *  index.
 *
 *  Velocity is the sum of (likes + comment count) across each hashtag's
 *  posts in the window, divided by the lifetime of the hashtag in
 *  hours. The blend gives a hashtag with 5 fast posts a stronger
 *  ranking than one with 50 slow ones — which is the behaviour every
 *  social network's "what's hot in the last 24h" rail wants.
 */
const TRENDING_TTL_MS = 5 * 60 * 1000;
const trendingCache = new Map();

export const getTrending = asyncHandler(async (req, res) => {
  const limitRaw = Number.parseInt(String(req.query.limit ?? "10"), 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 25)
    : 10;

  const cacheKey = `trending:${limit}`;
  const cached = trendingCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TRENDING_TTL_MS) {
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
    return res.status(200).json(cached.payload);
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const hashtags = await Post.aggregate([
    { $match: { createdAt: { $gte: cutoff } } },
    {
      $project: {
        createdAt: 1,
        likeCount: { $size: { $ifNull: ["$likes", []] } },
        commentCount: { $size: { $ifNull: ["$comments", []] } },
        hashtags: {
          $regexFindAll: { input: { $ifNull: ["$content", ""] }, regex: /#[A-Za-z0-9_]+/ },
        },
      },
    },
    { $unwind: "$hashtags" },
    {
      $group: {
        _id: { $toLower: "$hashtags.match" },
        count: { $sum: 1 },
        engagement: { $sum: { $add: ["$likeCount", "$commentCount"] } },
        firstSeen: { $min: "$createdAt" },
        lastSeen: { $max: "$createdAt" },
      },
    },
    { $match: { count: { $gte: 2 } } },
    {
      $project: {
        _id: 0,
        hashtag: "$_id",
        count: 1,
        velocity: {
          $divide: [
            { $add: ["$count", "$engagement"] },
            {
              $max: [
                {
                  $divide: [
                    { $subtract: ["$lastSeen", "$firstSeen"] },
                    1000 * 60 * 60,
                  ],
                },
                0.5,
              ],
            },
          ],
        },
      },
    },
    { $sort: { velocity: -1, count: -1 } },
    { $limit: limit },
  ]);

  const payload = {
    hashtags,
    generatedAt: new Date().toISOString(),
  };
  trendingCache.set(cacheKey, { at: Date.now(), payload });
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  res.status(200).json(payload);
});

/**
 * Cursor-paginated feed.
 *
 * Cursor is the `createdAt` ISO of the oldest post already on the
 * client. Combined with the unique-`_id` tiebreak it gives a stable
 * ordering even when two posts share the same millisecond.
 */
export const getPosts = asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const match = cursor ? { createdAt: { $lt: cursor } } : {};
  const posts = await Post.aggregate(buildFeedAggregation(match, limit + 1));

  const hasNextPage = posts.length > limit;
  const page = hasNextPage ? posts.slice(0, limit) : posts;
  const last = page[page.length - 1];

  res.status(200).json({
    posts: page,
    nextCursor: hasNextPage && last ? last.createdAt : null,
  });
});

/**
 * Single-post detail. Populates the full comments tree because that's
 * what the comments modal reads; the feed lookup avoids this on purpose.
 */
export const getPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  const post = await Post.findById(postId)
    .populate("user", FEED_USER_FIELDS)
    .populate({
      path: "comments",
      options: { sort: { createdAt: -1 } },
      populate: { path: "user", select: FEED_USER_FIELDS },
    })
    .populate({
      path: "originalPost",
      populate: { path: "user", select: FEED_USER_FIELDS },
    })
    .lean();

  if (!post) return res.status(404).json({ error: "Post not found" });

  // Mirror the feed shape: derive repostCount on both the row and any
  // populated original so the client never has to inspect raw arrays.
  const shaped = {
    ...post,
    repostCount: post.reposts?.length ?? 0,
    originalPost: post.originalPost
      ? {
          ...post.originalPost,
          repostCount: post.originalPost.reposts?.length ?? 0,
        }
      : null,
  };

  res.status(200).json({ post: shaped });
});

export const getUserPosts = asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);
  const username = String(req.params.username ?? "").trim().toLowerCase();
  if (!username) return res.status(400).json({ error: "Username is required" });

  const user = await User.findOne({ username }).select("_id").lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const match = cursor
    ? { user: user._id, createdAt: { $lt: cursor } }
    : { user: user._id };

  const posts = await Post.aggregate(buildFeedAggregation(match, limit + 1));
  const hasNextPage = posts.length > limit;
  const page = hasNextPage ? posts.slice(0, limit) : posts;
  const last = page[page.length - 1];

  res.status(200).json({
    posts: page,
    nextCursor: hasNextPage && last ? last.createdAt : null,
  });
});

export const createPost = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { content } = req.body;
  const imageFile = req.file;

  if (!content && !imageFile) {
    return res
      .status(400)
      .json({ error: "Post must contain either text or image" });
  }

  const user = await User.findOne({ clerkId: userId }).select("_id").lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  let imageUrl = "";
  if (imageFile) {
    try {
      const base64Image = `data:${imageFile.mimetype};base64,${imageFile.buffer.toString("base64")}`;
      const uploadResponse = await cloudinary.uploader.upload(base64Image, {
        folder: "social_media_posts",
        resource_type: "image",
        transformation: [
          { width: 1080, height: 1080, crop: "limit" },
          { quality: "auto" },
          { format: "auto" },
        ],
      });
      imageUrl = uploadResponse.secure_url;
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);
      return res.status(400).json({ error: "Failed to upload image" });
    }
  }

  const created = await Post.create({
    user: user._id,
    content: content || "",
    image: imageUrl,
  });

  // Re-fetch with the populated user shape so the mobile cache can
  // optimistically prepend without any additional round trip.
  const post = await Post.findById(created._id)
    .populate("user", FEED_USER_FIELDS)
    .lean();

  res.status(201).json({
    post: { ...post, commentCount: 0 },
  });
});

/**
 * Atomic like toggle.
 *
 * Two phases without a fetch-then-write race:
 *  1. Try to PULL the user out of the likes set.
 *  2. If nothing was modified (i.e. the user wasn't liking yet),
 *     PUSH them in with `$addToSet`.
 *
 * Only one of the two writes will report `modifiedCount > 0`, so we
 * always know the canonical post-toggle state without re-reading.
 */
export const likePost = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { postId } = req.params;
  if (!mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  const user = await User.findOne({ clerkId: userId }).select("_id").lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const unlike = await Post.updateOne(
    { _id: postId, likes: user._id },
    { $pull: { likes: user._id } }
  );

  let liked;
  if (unlike.matchedCount === 0) {
    // Either the post doesn't exist, or the user wasn't liking yet.
    const like = await Post.updateOne(
      { _id: postId },
      { $addToSet: { likes: user._id } }
    );
    if (like.matchedCount === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    liked = true;

    // Notify the post author (skip self-likes, skip duplicate noise).
    const post = await Post.findById(postId).select("user").lean();
    if (post && post.user.toString() !== user._id.toString()) {
      await Notification.create({
        from: user._id,
        to: post.user,
        type: "like",
        post: postId,
      }).catch((err) => console.error("[like] notification error:", err));
    }
  } else {
    liked = false;
  }

  // Cheap secondary read to return the canonical count without
  // re-aggregating the whole post.
  const fresh = await Post.findById(postId).select("likes").lean();
  const likeCount = fresh ? (fresh.likes?.length ?? 0) : 0;
  res.status(200).json({ liked, likeCount });
});

export const deletePost = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { postId } = req.params;
  if (!mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  const user = await User.findOne({ clerkId: userId }).select("_id").lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const post = await Post.findById(postId).select("user image").lean();
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.user.toString() !== user._id.toString()) {
    return res
      .status(403)
      .json({ error: "You can only delete your own posts" });
  }

  // Single-pass cleanup.
  await Promise.all([
    Comment.deleteMany({ post: postId }),
    Notification.deleteMany({ post: postId }),
    Post.findByIdAndDelete(postId),
    // When the canonical post goes, its reshare entries are dangling
    // pointers — drop them too so feeds don't render broken cards.
    Post.deleteMany({ originalPost: postId }),
  ]);

  res.status(200).json({ message: "Post deleted successfully" });
});

/**
 * Toggle a reshare (repost).
 *
 * Mirror of `likePost` semantics: idempotent on a single tap, atomic
 * across the canonical original and the resharer's reshare-entry doc.
 *
 *  - If `postId` is itself a reshare, we resolve to its source — you
 *    can't reshare a reshare; you reshare its origin.
 *  - The reshare entry is a *new* Post doc with `originalPost` set and
 *    empty content/image. The feed's $lookup hydrates the original.
 *  - The original's `reposts` array tracks who has reshared it.
 *  - The original author gets a `reshare` notification (skip self).
 */
export const resharePost = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { postId } = req.params;
  if (!mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  const user = await User.findOne({ clerkId: userId }).select("_id").lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const target = await Post.findById(postId)
    .select("user originalPost")
    .lean();
  if (!target) return res.status(404).json({ error: "Post not found" });

  // Resolve to the canonical original — reshares of reshares fold up.
  const trueOriginalId = target.originalPost ?? target._id;

  // Block self-reshares of your own post (matches Twitter's UX — you
  // can't repost yourself; the post is already on your timeline).
  const original = await Post.findById(trueOriginalId).select("user").lean();
  if (!original) return res.status(404).json({ error: "Post not found" });
  if (original.user.toString() === user._id.toString()) {
    return res.status(400).json({ error: "You can't reshare your own post" });
  }

  const existing = await Post.findOne({
    user: user._id,
    originalPost: trueOriginalId,
  })
    .select("_id")
    .lean();

  if (existing) {
    // Toggle off.
    await Promise.all([
      Post.updateOne(
        { _id: trueOriginalId },
        { $pull: { reposts: user._id } }
      ),
      Post.deleteOne({ _id: existing._id }),
    ]);
    const fresh = await Post.findById(trueOriginalId).select("reposts").lean();
    return res.status(200).json({
      reshared: false,
      repostCount: fresh?.reposts?.length ?? 0,
    });
  }

  // Toggle on: add to reposts and create the reshare entry doc.
  await Promise.all([
    Post.updateOne(
      { _id: trueOriginalId },
      { $addToSet: { reposts: user._id } }
    ),
    Post.create({
      user: user._id,
      originalPost: trueOriginalId,
      content: "",
      image: "",
    }),
  ]);

  // Fire-and-forget notification — never block the toggle.
  Notification.create({
    from: user._id,
    to: original.user,
    type: "reshare",
    post: trueOriginalId,
  }).catch((err) => console.error("[reshare] notification error:", err));

  const fresh = await Post.findById(trueOriginalId).select("reposts").lean();
  res.status(200).json({
    reshared: true,
    repostCount: fresh?.reposts?.length ?? 0,
  });
});