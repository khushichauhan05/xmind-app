import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { useAuth } from "@clerk/clerk-expo";
import { useMemo } from "react";

/**
 * Resolved API base URL.
 *
 * Production / preview pulls from `EXPO_PUBLIC_API_URL` so the same JS
 * bundle can target staging and prod without a rebuild. The hard-coded
 * fallback is the deployed Vercel function.
 *
 * On a physical device, `localhost` will not resolve — use the LAN IP
 * (e.g. `http://192.168.x.x:5001/api`) when developing against a local
 * backend.
 */
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://xmind-app-five.vercel.app/api";

/**
 * Augment Axios's request config with our retry flag and an opt-in
 * "silent on 404" flag without leaking `any` into the call sites.
 *
 * `silent404` lets a single call site (e.g. fetching a post that may
 * have been deleted by the time a chat-share preview tries to render)
 * tell the interceptor to skip the `[api] error` log line. Other 4xx /
 * 5xx still log normally — this is *not* a global silencer.
 */
type RetryableRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
  silent404?: boolean;
};

/**
 * Builds a configured Axios instance bound to a Clerk token getter.
 *
 * Single source of truth for:
 *  - base URL + default headers
 *  - bearer-token attachment
 *  - one-shot refresh + retry on 401
 *  - one-shot retry on Arcjet "bot" 403 (their first-request edge case)
 *
 * Logging only fires in development. In production the interceptors
 * are silent — no console churn on the JS thread during scroll.
 */
export const createApiClient = (
  getToken: () => Promise<string | null>
): AxiosInstance => {
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "User-Agent": "xMind/1.0 (Mobile App)",
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    },
    timeout: 15_000,
  });

  api.interceptors.request.use(async (config) => {
    try {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else if (__DEV__) {
        console.warn(`[api] no token for ${config.url}`);
      }
    } catch (error) {
      if (__DEV__) console.error("[api] token error:", error);
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as RetryableRequestConfig | undefined;

      // 401 → wait briefly for Clerk to refresh, then retry once.
      if (
        originalRequest &&
        !originalRequest._retry &&
        error.response?.status === 401
      ) {
        originalRequest._retry = true;
        await new Promise((resolve) => setTimeout(resolve, 800));
        try {
          const newToken = await getToken();
          if (newToken) {
            originalRequest.headers = {
              ...(originalRequest.headers ?? {}),
              Authorization: `Bearer ${newToken}`,
            };
            return api(originalRequest);
          }
        } catch (tokenError) {
          if (__DEV__) console.error("[api] refresh failed:", tokenError);
        }
      }

      // Arcjet sometimes flags the very first request from a fresh device
      // as a bot. Retry once after a short wait — subsequent requests pass.
      const data = error.response?.data as { error?: string } | undefined;
      if (
        originalRequest &&
        !originalRequest._retry &&
        error.response?.status === 403 &&
        data?.error === "Bot access denied"
      ) {
        originalRequest._retry = true;
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return api(originalRequest);
      }

      // Skip the log when the call site explicitly opted out for an
      // expected 404 (e.g. a shared post the recipient is viewing was
      // deleted by the author after the share).
      const isSilentExpected404 =
        error.response?.status === 404 &&
        (originalRequest as RetryableRequestConfig | undefined)?.silent404 ===
          true;

      if (__DEV__ && !isSilentExpected404) {
        console.error("[api] error", {
          status: error.response?.status,
          url: error.config?.url,
          message: (error.response?.data as { message?: string })?.message,
        });
      }
      return Promise.reject(error);
    }
  );

  return api;
};

/**
 * Hook — returns a stable Axios instance for the current Clerk session.
 *
 * Why this exists:
 *  Earlier, every component calling `useApiClient()` built a fresh
 *  Axios instance on every render and re-registered interceptors. On the
 *  Home screen alone that meant dozens of throwaway clients per second
 *  during scroll. We now memoise on `getToken` (stable across renders
 *  while the session is the same) so the whole app shares one client
 *  for the lifetime of the session.
 */
export const useApiClient = (): AxiosInstance => {
  const { getToken } = useAuth();
  return useMemo(() => createApiClient(getToken), [getToken]);
};

// Typed helpers — every call site reads as a verb-on-domain instead of a
// stringly-typed URL, which kept the screens free of literal endpoints.

/** Generic Axios response with a typed `data` payload. */
type ApiResponse<T> = Promise<AxiosResponse<T>>;

export interface UserPayload<T> {
  user: T;
}
export interface UsersPayload<T> {
  users: T[];
}
export interface PostsPayload<T> {
  posts: T[];
  /** Cursor for the next page (createdAt ISO string). Absent on the last page. */
  nextCursor?: string | null;
}
export interface PostPayload<T> {
  post: T;
}
export interface CommentsPayload<T> {
  comments: T[];
}
export interface CommentPayload<T> {
  comment: T;
}
export interface NotificationsPayload<T> {
  notifications: T[];
}
export interface UsernameAvailability {
  available: boolean;
  message: string;
}

export const userApi = {
  getCurrentUser: <U>(api: AxiosInstance): ApiResponse<UserPayload<U>> =>
    api.get("/users/me"),

  getUserProfile: <U>(api: AxiosInstance, username: string): ApiResponse<UserPayload<U>> =>
    api.get(`/users/profile/${encodeURIComponent(username)}`),

  updateProfile: <U>(api: AxiosInstance, profileData: FormData): ApiResponse<UserPayload<U>> =>
    api.post("/users/profile", profileData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  updateUsername: <U>(api: AxiosInstance, username: string): ApiResponse<UserPayload<U>> =>
    api.put("/users/username", { username }),

  checkUsernameAvailability: (
    api: AxiosInstance,
    username: string
  ): ApiResponse<UsernameAvailability> =>
    api.get(`/users/check-username/${encodeURIComponent(username)}`),

  followUser: (api: AxiosInstance, targetUserId: string): ApiResponse<{ message: string }> =>
    api.post(`/users/follow/${encodeURIComponent(targetUserId)}`),

  /** Drop someone from MY followers list. Mirror of `followUser` but
   *  invoked by the receiver — pulls the target from `me.followers` and
   *  pulls me from `target.following`. No notification is sent. */
  removeFollower: (
    api: AxiosInstance,
    targetUserId: string
  ): ApiResponse<{ message: string }> =>
    api.post(`/users/follower/${encodeURIComponent(targetUserId)}/remove`),

  autoVerifyUser: <U>(api: AxiosInstance): ApiResponse<UserPayload<U>> =>
    api.post("/users/verify"),

  toggleVerification: <U>(
    api: AxiosInstance,
    targetUserId: string
  ): ApiResponse<UserPayload<U>> =>
    api.post(`/users/verify/${encodeURIComponent(targetUserId)}`),

  syncUser: <U>(api: AxiosInstance): ApiResponse<UserPayload<U>> =>
    api.post("/users/sync"),

  /** Server-side user search. Covers users who haven't posted recently
   *  — the local Fuse index can't see them. */
  searchUsers: <U>(api: AxiosInstance, q: string): ApiResponse<UsersPayload<U>> =>
    api.get("/users/search", { params: { q } }),

  getFollowers: <U>(api: AxiosInstance, username: string): ApiResponse<UsersPayload<U>> =>
    api.get(`/users/${encodeURIComponent(username)}/followers`),

  getFollowing: <U>(api: AxiosInstance, username: string): ApiResponse<UsersPayload<U>> =>
    api.get(`/users/${encodeURIComponent(username)}/following`),
};

export interface GetPostsOptions {
  /** ISO timestamp of the oldest post already loaded — used as cursor. */
  cursor?: string | null;
  /** Page size (server clamps to 1–50). */
  limit?: number;
}

export const postApi = {
  getPosts: <P>(api: AxiosInstance, opts: GetPostsOptions = {}): ApiResponse<PostsPayload<P>> =>
    api.get("/posts", {
      params: { cursor: opts.cursor ?? undefined, limit: opts.limit ?? undefined },
    }),

  /**
   * Fetch a single post.
   *
   * Pass `{ silent404: true }` when calling from a context where the
   * post may legitimately not exist (e.g. a shared-post preview in chat
   * where the author has since deleted, or a bookmarked post that's
   * been removed). The interceptor will skip the `[api] error` log line
   * for that 404 specifically; other failures still surface normally.
   */
  getPost: <P>(
    api: AxiosInstance,
    postId: string,
    opts?: { silent404?: boolean }
  ): ApiResponse<PostPayload<P>> =>
    api.get(`/posts/${encodeURIComponent(postId)}`, {
      silent404: opts?.silent404,
    } as AxiosRequestConfig),

  getUserPosts: <P>(
    api: AxiosInstance,
    username: string,
    opts: GetPostsOptions = {}
  ): ApiResponse<PostsPayload<P>> =>
    api.get(`/posts/user/${encodeURIComponent(username)}`, {
      params: { cursor: opts.cursor ?? undefined, limit: opts.limit ?? undefined },
    }),

  createPost: <P>(api: AxiosInstance, postData: FormData): ApiResponse<PostPayload<P>> =>
    api.post("/posts", postData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  likePost: (
    api: AxiosInstance,
    postId: string
  ): ApiResponse<{ liked: boolean; likeCount: number }> =>
    api.post(`/posts/${encodeURIComponent(postId)}/like`),

  /** Toggle reshare. Server resolves to the canonical original when
   *  given a reshare entry id, so callers can pass either. */
  resharePost: (
    api: AxiosInstance,
    postId: string
  ): ApiResponse<{ reshared: boolean; repostCount: number }> =>
    api.post(`/posts/${encodeURIComponent(postId)}/reshare`),

  deletePost: (api: AxiosInstance, postId: string): ApiResponse<{ message: string }> =>
    api.delete(`/posts/${encodeURIComponent(postId)}`),
};

export const commentApi = {
  createComment: <C>(
    api: AxiosInstance,
    postId: string,
    content: string,
    parentId?: string | null
  ): ApiResponse<CommentPayload<C>> =>
    api.post(`/comments/post/${encodeURIComponent(postId)}`, {
      content,
      parentId: parentId ?? undefined,
    }),

  deleteComment: (
    api: AxiosInstance,
    commentId: string
  ): ApiResponse<{ message: string }> =>
    api.delete(`/comments/${encodeURIComponent(commentId)}`),

  getComments: <C>(api: AxiosInstance, postId: string): ApiResponse<CommentsPayload<C>> =>
    api.get(`/comments/post/${encodeURIComponent(postId)}`),

  likeComment: (
    api: AxiosInstance,
    commentId: string
  ): ApiResponse<{ liked: boolean; likeCount: number }> =>
    api.post(`/comments/${encodeURIComponent(commentId)}/like`),
};

export const notificationApi = {
  getNotifications: <N>(api: AxiosInstance): ApiResponse<NotificationsPayload<N>> =>
    api.get("/notifications"),

  markAsRead: <N>(api: AxiosInstance, notificationId: string): ApiResponse<NotificationsPayload<N>> =>
    api.put(`/notifications/${encodeURIComponent(notificationId)}/read`),

  markAllAsRead: <N>(api: AxiosInstance): ApiResponse<NotificationsPayload<N>> =>
    api.put("/notifications/read-all"),

  deleteNotification: (
    api: AxiosInstance,
    notificationId: string
  ): ApiResponse<{ message: string }> =>
    api.delete(`/notifications/${encodeURIComponent(notificationId)}`),
};

// ─────────────────────────────────────────────────────────────────────────
// Conversations / messages — option A backend (Express + Mongo + polling).
// Endpoints are mounted at `/api/conversations` server-side. Clients send
// `clientId` on every message create so retries don't duplicate; the
// server treats the (conversation, clientId) pair as a unique key and
// returns the existing row if the same key is replayed.
// ─────────────────────────────────────────────────────────────────────────

export interface ConversationsPayload<C> {
  conversations: C[];
}
export interface ConversationPayload<C> {
  conversation: C;
}
export interface MessagesPayload<M> {
  messages: M[];
  /** ISO timestamp of the oldest message in this page; used as the next cursor. */
  nextCursor?: string | null;
}
export interface MessagePayload<M> {
  message: M;
}

export interface ListMessagesOptions {
  /** ISO timestamp of the oldest message already loaded. Server returns messages older than this. */
  cursor?: string | null;
  /** Page size (server clamps 1–50). */
  limit?: number;
}

export const conversationApi = {
  list: <C>(api: AxiosInstance): ApiResponse<ConversationsPayload<C>> =>
    api.get("/conversations"),

  /** Idempotent: returns the existing 1:1 conversation with `targetUserId`, or creates one. */
  createOrGet: <C>(
    api: AxiosInstance,
    targetUserId: string
  ): ApiResponse<ConversationPayload<C>> =>
    api.post("/conversations", { targetUserId }),

  listMessages: <M>(
    api: AxiosInstance,
    conversationId: string,
    opts: ListMessagesOptions = {}
  ): ApiResponse<MessagesPayload<M>> =>
    api.get(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      params: { cursor: opts.cursor ?? undefined, limit: opts.limit ?? undefined },
    }),

  sendMessage: <M>(
    api: AxiosInstance,
    conversationId: string,
    payload: { body: string; clientId: string }
  ): ApiResponse<MessagePayload<M>> =>
    api.post(`/conversations/${encodeURIComponent(conversationId)}/messages`, payload),

  markRead: (
    api: AxiosInstance,
    conversationId: string
  ): ApiResponse<{ updated: number }> =>
    api.post(`/conversations/${encodeURIComponent(conversationId)}/read`),
};
