import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import { getAuth } from "@clerk/express";

import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";

/**
 * Conversation controller — option A backend.
 *
 * Pragmatic chat on Express + MongoDB + Clerk. Mobile polls every few
 * seconds for new messages; this controller answers polls cheaply by
 * relying on indexes (`{conversation: 1, createdAt: -1}` for thread
 * pages, `{participants: 1, lastActivityAt: -1}` for inbox sort).
 *
 * Idempotency:
 *  Every send must include a `clientId`. The unique
 *  `{conversation, clientId}` index ensures duplicates are rejected at
 *  the storage layer; the catch block recovers the original row so
 *  retries are safe and observable.
 */

const PARTICIPANT_FIELDS =
  "username firstName lastName profilePicture verified";
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

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

async function resolveCurrentUser(req) {
  const { userId } = getAuth(req);
  if (!userId) return null;
  return User.findOne({ clerkId: userId }).select("_id").lean();
}

// ── GET /api/conversations ────────────────────────────────────────────────
export const listConversations = asyncHandler(async (req, res) => {
  const me = await resolveCurrentUser(req);
  if (!me) return res.status(404).json({ error: "User not found" });

  const conversations = await Conversation.find({ participants: me._id })
    .sort({ lastActivityAt: -1 })
    .limit(50)
    .populate("participants", PARTICIPANT_FIELDS)
    .populate({
      path: "lastMessage",
      select: "body sender createdAt readBy clientId",
    })
    .lean();

  // Compute unread counts in a single batched aggregate so the inbox
  // can render the bold name + dot at the same time as the row text.
  const ids = conversations.map((c) => c._id);
  let unreadByConv = new Map();
  if (ids.length > 0) {
    const unread = await Message.aggregate([
      {
        $match: {
          conversation: { $in: ids },
          sender: { $ne: me._id },
          readBy: { $ne: me._id },
        },
      },
      { $group: { _id: "$conversation", count: { $sum: 1 } } },
    ]);
    unreadByConv = new Map(unread.map((u) => [String(u._id), u.count]));
  }

  const payload = conversations.map((c) => ({
    ...c,
    unreadCount: unreadByConv.get(String(c._id)) ?? 0,
  }));

  res.status(200).json({ conversations: payload });
});

// ── POST /api/conversations { targetUserId } ──────────────────────────────
// Idempotent: if a 2-participant conversation between me and target
// already exists, return it. Otherwise create one.
export const createOrGetConversation = asyncHandler(async (req, res) => {
  const me = await resolveCurrentUser(req);
  if (!me) return res.status(404).json({ error: "User not found" });

  const { targetUserId } = req.body ?? {};
  if (!mongoose.isValidObjectId(targetUserId)) {
    return res.status(400).json({ error: "Invalid targetUserId" });
  }
  if (String(targetUserId) === String(me._id)) {
    return res.status(400).json({ error: "Cannot start a conversation with yourself" });
  }

  const target = await User.findById(targetUserId).select("_id").lean();
  if (!target) return res.status(404).json({ error: "Target user not found" });

  // Try to find an existing 2-person thread.
  const existing = await Conversation.findOne({
    participants: { $all: [me._id, target._id], $size: 2 },
  })
    .populate("participants", PARTICIPANT_FIELDS)
    .populate({
      path: "lastMessage",
      select: "body sender createdAt readBy clientId",
    })
    .lean();

  if (existing) {
    return res.status(200).json({ conversation: { ...existing, unreadCount: 0 } });
  }

  const created = await Conversation.create({
    participants: [me._id, target._id],
    lastActivityAt: new Date(),
  });

  const populated = await Conversation.findById(created._id)
    .populate("participants", PARTICIPANT_FIELDS)
    .lean();

  res.status(201).json({ conversation: { ...populated, unreadCount: 0 } });
});

// ── GET /api/conversations/:id/messages?cursor=&limit= ────────────────────
// Returns newest-first. Cursor is the createdAt ISO of the oldest message
// already on the client; server returns the next batch of older messages.
export const listMessages = asyncHandler(async (req, res) => {
  const me = await resolveCurrentUser(req);
  if (!me) return res.status(404).json({ error: "User not found" });

  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid conversation id" });
  }

  const conversation = await Conversation.findById(id).select("participants").lean();
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  const isParticipant = conversation.participants.some(
    (p) => String(p) === String(me._id)
  );
  if (!isParticipant) return res.status(403).json({ error: "Not a participant" });

  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const match = cursor
    ? { conversation: id, createdAt: { $lt: cursor } }
    : { conversation: id };

  const messages = await Message.find(match)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;
  const oldest = page[page.length - 1];

  res.status(200).json({
    messages: page,
    nextCursor: hasMore && oldest ? new Date(oldest.createdAt).toISOString() : null,
  });
});

// ── POST /api/conversations/:id/messages { body, clientId } ───────────────
// Idempotent on (conversation, clientId).
export const sendMessage = asyncHandler(async (req, res) => {
  const me = await resolveCurrentUser(req);
  if (!me) return res.status(404).json({ error: "User not found" });

  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid conversation id" });
  }

  const body = String(req.body?.body ?? "").trim();
  const clientId = String(req.body?.clientId ?? "").trim();
  if (!body) return res.status(400).json({ error: "Body is required" });
  if (body.length > 2000) {
    return res.status(400).json({ error: "Message too long (max 2000 chars)" });
  }
  if (!clientId) return res.status(400).json({ error: "clientId is required" });

  const conversation = await Conversation.findById(id).select("participants").lean();
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  const isParticipant = conversation.participants.some(
    (p) => String(p) === String(me._id)
  );
  if (!isParticipant) return res.status(403).json({ error: "Not a participant" });

  let message;
  try {
    message = await Message.create({
      conversation: id,
      sender: me._id,
      body,
      readBy: [me._id],
      clientId,
    });
  } catch (err) {
    // Duplicate clientId — return the original message so retries are safe.
    if (err && err.code === 11000) {
      const existing = await Message.findOne({ conversation: id, clientId }).lean();
      if (existing) return res.status(200).json({ message: existing });
    }
    throw err;
  }

  // Atomically advance the conversation's activity pointer.
  await Conversation.updateOne(
    { _id: id },
    { $set: { lastMessage: message._id, lastActivityAt: message.createdAt } }
  );

  res.status(201).json({ message: message.toObject() });
});

// ── POST /api/conversations/:id/read ──────────────────────────────────────
export const markRead = asyncHandler(async (req, res) => {
  const me = await resolveCurrentUser(req);
  if (!me) return res.status(404).json({ error: "User not found" });

  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid conversation id" });
  }

  const conversation = await Conversation.findById(id).select("participants").lean();
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  const isParticipant = conversation.participants.some(
    (p) => String(p) === String(me._id)
  );
  if (!isParticipant) return res.status(403).json({ error: "Not a participant" });

  const result = await Message.updateMany(
    { conversation: id, readBy: { $ne: me._id } },
    { $addToSet: { readBy: me._id } }
  );

  res.status(200).json({ updated: result.modifiedCount ?? 0 });
});
