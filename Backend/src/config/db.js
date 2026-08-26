import mongoose from "mongoose";
import { ENV } from "./env.js";

/**
 * Cached connection promise.
 *
 * Vercel re-uses the same Node process across invocations on a single
 * function instance, so this caches the active mongoose connection
 * (and the in-flight connect promise) across cold starts. Without
 * this, every request would open a new pool and Atlas would throttle
 * us within minutes.
 */
let cached = global.__mongoose;
if (!cached) {
  cached = global.__mongoose = { conn: null, promise: null };
}

const POOL_OPTIONS = {
  // Small pool — Vercel functions are stateless, more pool space wastes RAM.
  maxPoolSize: 10,
  minPoolSize: 0,
  // Don't buffer queries while disconnected — fail fast instead.
  bufferCommands: false,
  serverSelectionTimeoutMS: 8_000,
  socketTimeoutMS: 30_000,
};

export const connectDB = async () => {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    if (!ENV.MONGO_URI) {
      throw new Error("MONGO_URI is not configured");
    }
    cached.promise = mongoose.connect(ENV.MONGO_URI, POOL_OPTIONS).then((mongooseInstance) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("Connected to MongoDB");
      }
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Reset the cached promise so the NEXT request can retry instead of
    // permanently rejecting.
    cached.promise = null;
    throw error;
  }
  return cached.conn;
};