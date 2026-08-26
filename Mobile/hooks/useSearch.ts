/**
 * Client-side search hook.
 *
 * Architectural role:
 *  Derives trending hashtags, suggested users, and a name/handle search
 *  function from the cached feed data — no extra network calls. Cheap
 *  on-device math means the search screen feels instant on every
 *  keystroke even on a 2 GB Android device.
 *
 * Why Fuse.js instead of a plain `String.includes`:
 *  Twitter / Facebook / Instagram all tolerate typos and mid-word
 *  matches on handle search. The previous `includes()` filter was
 *  unforgiving — typing "amir" would never match "@aamir". Fuse builds
 *  a Bitap-based fuzzy index, supports weighted keys, and stays under
 *  one millisecond for the few-hundred-user payloads this screen sees.
 *  The reference recommendation comes from
 *  `expo-algorithms-skill/references/04-data.md`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Fuse, { type IFuseOptions } from "fuse.js";

import { usePosts } from "./usePosts";
import { useCurrentUser } from "./useCurrentUser";
import { useApiClient, userApi } from "../utils/api";
import type { Post, User } from "../types";

const MAX_HASHTAGS = 20;
const MAX_SUGGESTED_USERS = 8;
const MAX_RESULTS = 50;

const USER_FUSE_OPTIONS: IFuseOptions<User> = {
  // 0.0 = exact match, 1.0 = match anything. 0.4 lets through 1-2
  // character typos without exploding into noise.
  threshold: 0.4,
  ignoreLocation: true,
  // Limit cost on long bios — names are short anyway.
  distance: 60,
  minMatchCharLength: 2,
  keys: [
    { name: "username", weight: 0.6 },
    { name: "firstName", weight: 0.25 },
    { name: "lastName", weight: 0.15 },
  ],
};

const POST_FUSE_OPTIONS: IFuseOptions<Post> = {
  threshold: 0.45,
  ignoreLocation: true,
  // Posts cap at 280 chars; default distance is fine but tighter saves cycles.
  distance: 200,
  minMatchCharLength: 2,
  keys: [
    { name: "content", weight: 0.7 },
    { name: "user.username", weight: 0.2 },
    { name: "user.firstName", weight: 0.05 },
    { name: "user.lastName", weight: 0.05 },
  ],
};

export const useSearch = () => {
  const { posts } = usePosts();
  const { currentUser } = useCurrentUser();
  const api = useApiClient();
  const apiRef = useRef(api);
  apiRef.current = api;

  const trendingHashtags = useMemo(() => {
    const hashtagCounts: Record<string, number> = {};
    for (const post of posts) {
      const hashtags = post.content?.match(/#\w+/g) ?? [];
      for (const hashtag of hashtags) {
        const tag = hashtag.toLowerCase();
        hashtagCounts[tag] = (hashtagCounts[tag] ?? 0) + 1;
      }
    }
    return Object.entries(hashtagCounts)
      .map(([hashtag, count]) => ({ hashtag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_HASHTAGS);
  }, [posts]);

  const uniqueUsers = useMemo(() => {
    const users = new Map<string, User>();
    for (const post of posts) {
      if (!post.user?._id) continue;
      if (post.user._id === currentUser?._id) continue;
      if (!users.has(post.user._id)) users.set(post.user._id, post.user);
    }
    return Array.from(users.values());
  }, [posts, currentUser?._id]);

  /**
   * Suggested users — verified first, then by follower count, then by
   * post count in the visible feed. Capped to keep the resting state
   * scannable in one glance (Hick's Law).
   */
  const suggestedUsers = useMemo(() => {
    const followingSet = new Set(currentUser?.following ?? []);
    const postCount = new Map<string, number>();
    for (const post of posts) {
      if (!post.user?._id) continue;
      postCount.set(post.user._id, (postCount.get(post.user._id) ?? 0) + 1);
    }
    return [...uniqueUsers]
      .filter((u) => !followingSet.has(u._id))
      .sort((a, b) => {
        const av = a.verified ? 1 : 0;
        const bv = b.verified ? 1 : 0;
        if (av !== bv) return bv - av;
        const af = a.followers?.length ?? 0;
        const bf = b.followers?.length ?? 0;
        if (af !== bf) return bf - af;
        return (postCount.get(b._id) ?? 0) - (postCount.get(a._id) ?? 0);
      })
      .slice(0, MAX_SUGGESTED_USERS);
  }, [uniqueUsers, currentUser?.following, posts]);

  // Build the Fuse indices once per data change. Index construction is
  // the one-time cost; queries against the index are sub-millisecond.
  const userFuse = useMemo(() => new Fuse(uniqueUsers, USER_FUSE_OPTIONS), [uniqueUsers]);
  const postFuse = useMemo(() => new Fuse(posts, POST_FUSE_OPTIONS), [posts]);

  const searchUsers = (searchQuery: string): User[] => {
    const q = searchQuery.trim();
    if (!q) return [];
    // Strip a leading @ so users can search "@aamir" or "aamir" both.
    const normalised = q.startsWith("@") ? q.slice(1) : q;
    return userFuse.search(normalised, { limit: MAX_RESULTS }).map((r) => r.item);
  };

  // The screen drives the merged search via the dedicated hook below.
  // Embedding it here was the wrong API surface — calling a state setter
  // from a function invoked during render produced a render loop.

  const searchPosts = (searchQuery: string): Post[] => {
    const q = searchQuery.trim();
    if (!q) return [];
    return postFuse.search(q, { limit: MAX_RESULTS }).map((r) => r.item);
  };

  const getPostsByHashtag = (hashtag: string): Post[] => {
    const target = hashtag.toLowerCase();
    return posts.filter((post) => {
      const hashtags = post.content?.match(/#\w+/g) ?? [];
      return hashtags.some((tag) => tag.toLowerCase() === target);
    });
  };

  // Used by `useExistingUsernames` for client-side username collision
  // checks while the user is editing their profile.
  const allUsernames = useMemo(
    () => uniqueUsers.map((u) => u.username.toLowerCase()),
    [uniqueUsers]
  );

  return {
    trendingHashtags,
    suggestedUsers,
    searchUsers,
    searchPosts,
    getPostsByHashtag,
    posts,
    allUsernames,
  };
};

/**
 * Server-side user search hook.
 *
 * Covers users who haven't posted recently (the local Fuse index is
 * built over the cached feed only). Debounced 250 ms. The returned list
 * is meant to be merged with `searchUsers(query)` from `useSearch`,
 * deduped by `_id`.
 */
export const useUserSearchServer = (query: string): User[] => {
  const api = useApiClient();
  const apiRef = useRef(api);
  apiRef.current = api;
  const [results, setResults] = useState<User[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await userApi.searchUsers<User>(apiRef.current, q);
        if (!cancelled) setResults(response.data.users ?? []);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return results;
};
