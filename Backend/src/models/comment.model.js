import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxLength: 280,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    /**
     * Parent comment id when this comment is a reply. `null` for
     * top-level comments. Reply nesting is one level deep — a reply to
     * a reply is treated as another reply to the same parent so the
     * thread doesn't drift into deep recursion.
     */
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Comment list per post is the only read pattern outside admin tools.
commentSchema.index({ post: 1, createdAt: -1 });
// Reply lookup — used when grouping replies under each parent.
commentSchema.index({ parent: 1, createdAt: 1 });

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
