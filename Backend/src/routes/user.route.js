import express from "express";
import {
  followUser,
  removeFollower,
  getCurrentUser,
  getUserProfile,
  syncUser,
  updateProfile,
  updateUsername,
  checkUsernameAvailability,
  toggleVerification,
  autoVerifyUser,
  searchUsers,
  getFollowers,
  getFollowing,
} from "../controllers/user.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";

const router = express.Router();

// Search must be declared BEFORE `/profile/:username` so the param
// route doesn't swallow it.
router.get("/search", protectRoute, searchUsers);
router.get("/:username/followers", getFollowers);
router.get("/:username/following", getFollowing);

// public route
router.get("/profile/:username", getUserProfile);

// protected routes
router.post("/sync", protectRoute, syncUser);
router.get("/me", protectRoute, getCurrentUser);

// Profile update route - supports both single image and multiple images like posts
router.post(
  "/profile",
  protectRoute,
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
  ]),
  updateProfile
);

// Username update route - fixed path
router.put("/username", protectRoute, updateUsername);

// Check username availability
router.get(
  "/check-username/:username",
  protectRoute,
  checkUsernameAvailability
);

// Follow user
router.post("/follow/:targetUserId", protectRoute, followUser);

// Remove a follower (mirror of follow but invoked by the receiver).
router.post("/follower/:targetUserId/remove", protectRoute, removeFollower);

// Verification routes
router.post("/verify/:targetUserId", protectRoute, toggleVerification);
router.post("/verify", protectRoute, autoVerifyUser); // Auto-verification endpoint

export default router;
