import express from "express";

import {
  createOrGetConversation,
  listConversations,
  listMessages,
  markRead,
  sendMessage,
} from "../controllers/conversation.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// All conversation endpoints require an authenticated user.
router.use(protectRoute);

router.get("/", listConversations);
router.post("/", createOrGetConversation);

router.get("/:id/messages", listMessages);
router.post("/:id/messages", sendMessage);
router.post("/:id/read", markRead);

export default router;
