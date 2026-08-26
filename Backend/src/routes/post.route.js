import express from "express";
import {
  createPost,
  deletePost,
  getPost,
  getPosts,
  getTrending,
  getUserPosts,
  likePost,
  resharePost,
} from "../controllers/post.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";

const router = express.Router();

// public routes
router.get("/", getPosts);
router.get("/trending", getTrending);
router.get("/user/:username", getUserPosts);
router.get("/:postId", getPost);

// protected proteced
router.post("/", protectRoute, upload.single("image"), createPost);
router.post("/:postId/like", protectRoute, likePost);
router.post("/:postId/reshare", protectRoute, resharePost);
router.delete("/:postId", protectRoute, deletePost);

export default router;
