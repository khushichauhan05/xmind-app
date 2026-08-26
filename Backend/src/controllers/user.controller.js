import asyncHandler from "express-async-handler";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import cloudinary from "../config/cloudinary.js";

import { getAuth } from "@clerk/express";
import { clerkClient } from "@clerk/express";

export const getUserProfile = asyncHandler(async (req, res) => {
  const username = String(req.params.username ?? "").trim().toLowerCase();
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  // `username` is stored lowercase via the model's pre-save hook, so this
  // is a plain index lookup (no regex / no collation walk).
  const user = await User.findOne({ username }).lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  res.status(200).json({ user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { firstName, lastName, bio, location } = req.body;

  // Handle both single files and multiple files structure
  const profilePictureFile = req.files?.profilePicture?.[0] || req.file;
  const bannerImageFile = req.files?.bannerImage?.[0];

  if (
    !firstName &&
    !lastName &&
    !bio &&
    !location &&
    !profilePictureFile &&
    !bannerImageFile
  ) {
    return res
      .status(400)
      .json({ error: "At least one field must be provided for update" });
  }

  const user = await User.findOne({ clerkId: userId });
  if (!user) return res.status(404).json({ error: "User not found" });

  let profilePictureUrl = "";
  let bannerImageUrl = "";

  // Handle profile picture upload (same structure as post.controller.js)
  if (profilePictureFile) {
    try {
      // Convert buffer to base64 for Cloudinary (same as post.controller.js)
      const base64Image = `data:${
        profilePictureFile.mimetype
      };base64,${profilePictureFile.buffer.toString("base64")}`;

      const uploadResponse = await cloudinary.uploader.upload(base64Image, {
        folder: "xmind_profiles",
        resource_type: "image",
        transformation: [
          { width: 400, height: 400, crop: "fill" },
          { quality: "auto" },
          { format: "auto" },
        ],
      });
      profilePictureUrl = uploadResponse.secure_url;
    } catch (uploadError) {
      console.error("Profile picture upload error:", uploadError);
      return res
        .status(400)
        .json({ error: "Failed to upload profile picture" });
    }
  }

  // Handle banner image upload (same structure as post.controller.js)
  if (bannerImageFile) {
    try {
      // Convert buffer to base64 for Cloudinary (same as post.controller.js)
      const base64Image = `data:${
        bannerImageFile.mimetype
      };base64,${bannerImageFile.buffer.toString("base64")}`;

      const uploadResponse = await cloudinary.uploader.upload(base64Image, {
        folder: "xmind_banners",
        resource_type: "image",
        transformation: [
          { width: 1200, height: 400, crop: "fill" },
          { quality: "auto" },
          { format: "auto" },
        ],
      });
      bannerImageUrl = uploadResponse.secure_url;
    } catch (uploadError) {
      console.error("Banner image upload error:", uploadError);
      return res.status(400).json({ error: "Failed to upload banner image" });
    }
  }

  // Prepare update data
  const updateData = {
    ...(firstName && { firstName }),
    ...(lastName && { lastName }),
    ...(bio && { bio }),
    ...(location && { location }),
    ...(profilePictureUrl && { profilePicture: profilePictureUrl }),
    ...(bannerImageUrl && { bannerImage: bannerImageUrl }),
  };

  // Update user with new data
  const updatedUser = await User.findOneAndUpdate(
    { clerkId: userId },
    updateData,
    { new: true }
  );

  if (!updatedUser) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user: updatedUser });
});

export const updateUsername = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  // Convert username to lowercase
  const lowercaseUsername = username.toLowerCase();

  // Check for uniqueness (using lowercase)
  const existingUser = await User.findOne({ username: lowercaseUsername });
  if (existingUser && existingUser.clerkId !== userId) {
    return res.status(400).json({ error: "Username already taken" });
  }

  // Validate username format - match frontend validation
  if (username.length < 4 || username.length > 15) {
    return res
      .status(400)
      .json({ error: "Username must be between 4 and 15 characters" });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res
      .status(400)
      .json({
        error: "Username can only contain letters, numbers, and underscores",
      });
  }

  // No leading/trailing underscores
  if (username.startsWith("_") || username.endsWith("_")) {
    return res
      .status(400)
      .json({ error: "Username cannot start or end with an underscore" });
  }

  // No consecutive underscores
  if (username.includes("__")) {
    return res
      .status(400)
      .json({ error: "Username cannot have consecutive underscores" });
  }

  // Check for reserved words
  const reservedWords = [
    "admin",
    "administrator",
    "moderator",
    "system",
    "root",
    "official",
    "support",
    "help",
    "twitter",
    "x",
    "facebook",
    "instagram",
    "tiktok",
    "youtube",
    "twitch",
    "discord",
    "reddit",
    "pinterest",
    "linkedin",
    "github",
    "gitlab",
    "bitbucket",
    "heroku",
    "vercel",
    "netlify",
  ];
  if (reservedWords.some((word) => lowercaseUsername.includes(word))) {
    return res.status(400).json({ error: "Username contains a reserved word" });
  }

  const user = await User.findOneAndUpdate(
    { clerkId: userId },
    { username: lowercaseUsername },
    { new: true }
  );

  if (!user) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user });
});

export const checkUsernameAvailability = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  // Convert username to lowercase for consistency
  const lowercaseUsername = username.toLowerCase();

  // Check if username exists in database (using lowercase)
  const existingUser = await User.findOne({ username: lowercaseUsername });

  if (existingUser) {
    return res.status(200).json({
      available: false,
      message: "Username is already taken",
    });
  } else {
    return res.status(200).json({
      available: true,
      message: "Username is available",
    });
  }
});

export const syncUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);

  // check if user already exists in mongodb
  const existingUser = await User.findOne({ clerkId: userId });
  if (existingUser) {
    return res
      .status(200)
      .json({ user: existingUser, message: "User already exists" });
  }

  // create new user from Clerk data
  const clerkUser = await clerkClient.users.getUser(userId);

  const userData = {
    clerkId: userId,
    email: clerkUser.emailAddresses[0].emailAddress,
    firstName: clerkUser.firstName || "",
    lastName: clerkUser.lastName || "",
    username: clerkUser.emailAddresses[0].emailAddress
      .split("@")[0]
      .toLowerCase(),
    profilePicture: clerkUser.imageUrl || "",
    bannerImage: "",
    verified: false,
  };

  const user = await User.create(userData);

  res.status(201).json({ user, message: "User created successfully" });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const user = await User.findOne({ clerkId: userId }).lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  res.status(200).json({ user });
});

/**
 * Server-side user search.
 *
 * The mobile client builds a Fuse.js index over the in-memory feed
 * users for instant fuzzy-match, but that only sees users who have
 * posted recently. This endpoint covers the long tail — anyone in the
 * collection — so a user who has never posted is still findable by
 * handle or name.
 *
 * Query is matched case-insensitively against `username`, `firstName`,
 * and `lastName`. Capped to 20 results.
 */
export const searchUsers = asyncHandler(async (req, res) => {
  const raw = String(req.query.q ?? "").trim();
  if (raw.length < 2) {
    return res.status(200).json({ users: [] });
  }
  // Escape regex metacharacters so a typed `.` doesn't match-anything.
  const safe = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(safe, "i");

  const users = await User.find({
    $or: [{ username: re }, { firstName: re }, { lastName: re }],
  })
    .select("username firstName lastName profilePicture verified followers following")
    .limit(20)
    .lean();

  res.status(200).json({ users });
});

/**
 * Followers and Following lists. Both fetch the user, then resolve the
 * referenced ids to slim user docs via `$in`. Page-size capped to keep
 * payloads bounded — the mobile UI shows a list with a "Load more"
 * affordance against this same endpoint when the list grows.
 */
export const getFollowers = asyncHandler(async (req, res) => {
  const username = String(req.params.username ?? "").trim().toLowerCase();
  const user = await User.findOne({ username }).select("followers").lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const users = await User.find({ _id: { $in: user.followers ?? [] } })
    .select("username firstName lastName profilePicture verified followers")
    .limit(200)
    .lean();
  res.status(200).json({ users });
});

export const getFollowing = asyncHandler(async (req, res) => {
  const username = String(req.params.username ?? "").trim().toLowerCase();
  const user = await User.findOne({ username }).select("following").lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const users = await User.find({ _id: { $in: user.following ?? [] } })
    .select("username firstName lastName profilePicture verified followers")
    .limit(200)
    .lean();
  res.status(200).json({ users });
});

export const followUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { targetUserId } = req.params;

  // Resolve the current user FIRST so we can compare Mongo `_id` to
  // `targetUserId`. The previous version compared `userId` (Clerk's id)
  // to `targetUserId` (Mongo's _id), which never matched, so users were
  // able to follow themselves and trigger a self-follow notification.
  const currentUser = await User.findOne({ clerkId: userId });
  if (!currentUser) return res.status(404).json({ error: "User not found" });

  if (currentUser._id.toString() === String(targetUserId)) {
    return res.status(400).json({ error: "You cannot follow yourself" });
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) return res.status(404).json({ error: "User not found" });

  const isFollowing = currentUser.following
    .map((id) => id.toString())
    .includes(String(targetUserId));

  if (isFollowing) {
    await Promise.all([
      User.findByIdAndUpdate(currentUser._id, {
        $pull: { following: targetUserId },
      }),
      User.findByIdAndUpdate(targetUserId, {
        $pull: { followers: currentUser._id },
      }),
    ]);
  } else {
    await Promise.all([
      User.findByIdAndUpdate(currentUser._id, {
        $addToSet: { following: targetUserId },
      }),
      User.findByIdAndUpdate(targetUserId, {
        $addToSet: { followers: currentUser._id },
      }),
    ]);

    // Notification is fire-and-forget; never block the follow toggle on it.
    Notification.create({
      from: currentUser._id,
      to: targetUserId,
      type: "follow",
    }).catch((err) => console.error("[follow] notification error:", err));
  }

  res.status(200).json({
    message: isFollowing
      ? "User unfollowed successfully"
      : "User followed successfully",
  });
});

/**
 * Remove a follower from the current user's followers list.
 *
 * Architectural mirror of `followUser` but invoked by the *receiver* of
 * the follow rather than the actor. The current user (me) chooses to
 * drop someone (target) from their followers — so we pull `target` from
 * `me.followers` and pull `me` from `target.following`. No notification
 * is sent: removed followers are not informed, matching the expectation
 * users carry over from Instagram.
 */
export const removeFollower = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { targetUserId } = req.params;

  const currentUser = await User.findOne({ clerkId: userId });
  if (!currentUser) return res.status(404).json({ error: "User not found" });

  if (currentUser._id.toString() === String(targetUserId)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) return res.status(404).json({ error: "User not found" });

  await Promise.all([
    User.findByIdAndUpdate(currentUser._id, {
      $pull: { followers: targetUserId },
    }),
    User.findByIdAndUpdate(targetUserId, {
      $pull: { following: currentUser._id },
    }),
  ]);

  res.status(200).json({ message: "Follower removed successfully" });
});

export const toggleVerification = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const { targetUserId } = req.params;

  const currentUser = await User.findOne({ clerkId: userId });
  const targetUser = await User.findById(targetUserId);

  if (!currentUser || !targetUser)
    return res.status(404).json({ error: "User not found" });

  // Toggle verification status
  const newVerificationStatus = !targetUser.verified;

  const updatedUser = await User.findByIdAndUpdate(
    targetUserId,
    { verified: newVerificationStatus },
    { new: true }
  );

  res.status(200).json({
    message: `User ${
      newVerificationStatus ? "verified" : "unverified"
    } successfully`,
    user: updatedUser,
  });
});

// Add auto-verification endpoint
export const autoVerifyUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);

  const user = await User.findOne({ clerkId: userId });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Set verification to true
  const updatedUser = await User.findOneAndUpdate(
    { clerkId: userId },
    { verified: true },
    { new: true }
  );

  res.status(200).json({
    message: "User automatically verified successfully",
    user: updatedUser,
  });
});
