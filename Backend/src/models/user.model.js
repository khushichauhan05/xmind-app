import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true, // Ensure username is always lowercase
    },
    profilePicture: {
      type: String,
      default: "",
    },
    bannerImage: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
      maxLength: 160,
    },
    location: {
      type: String,
      default: "",
    },
    verified: {
      type: Boolean,
      default: false,
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// Pre-save middleware to ensure username is always lowercase
userSchema.pre('save', function(next) {
  if (this.username) {
    this.username = this.username.toLowerCase();
  }
  next();
});

// Pre-update middleware to ensure username is always lowercase
userSchema.pre('findOneAndUpdate', function(next) {
  if (this._update?.username) {
    this._update.username = this._update.username.toLowerCase();
  }
  next();
});

// `clerkId` and `username` are already unique (declared on the field), which
// auto-creates indexes. Email is also unique. Add a covering index for the
// most common lookup patterns.
userSchema.index({ followers: 1 });
userSchema.index({ following: 1 });

const User = mongoose.model("User", userSchema);

export default User;
