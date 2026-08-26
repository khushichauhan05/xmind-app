import mongoose from "mongoose";

/**
 * 1:1 conversation between two users.
 *
 * v1 constraints:
 *  - Exactly two participants. Group chat is a future addition; the
 *    schema already supports an N-participant array, but the controller
 *    enforces 2.
 *  - `lastActivityAt` is what the inbox sorts on. Updated atomically in
 *    the same write that creates the message so the inbox never shows
 *    a thread before its newest message lands.
 */
const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Inbox query is `participants ∈ user → sort by lastActivityAt desc`.
conversationSchema.index({ participants: 1, lastActivityAt: -1 });

const Conversation =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

export default Conversation;
