import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      maxLength: 280,
    },
    image: {
      type: String,
      default: "",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    // Users who have reshared this post. Maintained on the *original*
    // post; reshare entries (with `originalPost` set) leave this empty.
    reposts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // When set, this post is a reshare of another. The frontend renders
    // the original's media + content with a "@username reshared" banner.
    // Allows the resharer's optional commentary to live in `content`
    // while the source content is fetched via populate.
    originalPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Feed paging — `{ createdAt: -1, _id: -1 }` is the hot read path.
postSchema.index({ createdAt: -1, _id: -1 });
// Profile feed — every "posts by this user" page issues this query.
postSchema.index({ user: 1, createdAt: -1 });
// Reshare lookup — used to find an existing reshare doc for toggle.
postSchema.index({ user: 1, originalPost: 1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
