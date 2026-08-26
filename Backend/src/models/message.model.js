import mongoose from "mongoose";

/**
 * Single chat message.
 *
 * Idempotency:
 *  Every send carries a `clientId` (UUID generated on the device). The
 *  unique index on (conversation, clientId) is what makes retries safe —
 *  a duplicate write throws E11000 which the controller catches and
 *  returns the existing row instead of creating a second one.
 */
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: {
      type: String,
      required: true,
      maxLength: 2000,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    clientId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Thread query — newest messages first.
messageSchema.index({ conversation: 1, createdAt: -1 });
// Idempotency — duplicate sends with the same clientId in the same
// conversation are rejected by Mongo and recovered by the controller.
messageSchema.index({ conversation: 1, clientId: 1 }, { unique: true });

const Message =
  mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
