import express from "express";
import cors from "cors";
import compression from "compression";
import { clerkMiddleware } from "@clerk/express";

import userRoutes from "./routes/user.route.js";
import postRoutes from "./routes/post.route.js";
import commentRoutes from "./routes/comment.route.js";
import notificationRoutes from "./routes/notification.route.js";
import conversationRoutes from "./routes/conversation.route.js";

import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { arcjetMiddleware } from "./middleware/arcjet.middleware.js";

const app = express();

// Trust proxy is required on Vercel so `req.ip` resolves to the real
// client address (Arcjet rate limits per-IP).
app.set("trust proxy", 1);

// Compression — gzip every JSON payload over ~1KB. The feed page is the
// hottest endpoint and ships JSON; this halves bytes-on-the-wire.
app.use(compression());

// CORS — restrict to known origins in production. The mobile app sends
// no Origin header (it isn't a browser), so we allow no-origin requests
// unconditionally; only browser-style requests are filtered.
const ALLOWED_ORIGINS = (ENV.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // mobile / server-to-server
      if (ENV.NODE_ENV !== "production") return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(clerkMiddleware());
app.use(arcjetMiddleware);

// Ensure the cached Mongo connection is hot before every request. With
// the cached connect promise, this is effectively free on warm
// invocations and only does real work on a cold start.
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.get("/", (_req, res) => res.json({ ok: true, name: "xMind API" }));

app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/conversations", conversationRoutes);

// 404 — express 5 still calls the chain, so we trap unknown routes
// before the error handler runs.
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  const status = err.statusCode ?? err.status ?? 500;
  res.status(status).json({
    error: err.publicMessage ?? err.message ?? "Internal server error",
  });
});

const startServer = async () => {
  try {
    await connectDB();
    if (ENV.NODE_ENV !== "production") {
      const port = ENV.PORT ?? 5001;
      app.listen(port, () => console.log(`Server is up and running on PORT: ${port}`));
    }
  } catch (error) {
    console.error("Failed to start server:", error.message);
    if (ENV.NODE_ENV !== "production") process.exit(1);
  }
};

startServer();

// export for vercel
export default app;