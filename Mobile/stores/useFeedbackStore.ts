/**
 * Negative-feedback store.
 *
 * Architectural role:
 *  Tracks user-driven "I don't want to see this" signals so the feed
 *  ranker can hard-filter or soft-suppress accordingly. Persisted via
 *  AsyncStorage so the user's curation survives cold starts — you only
 *  mute someone once.
 *
 * Psychology lever:
 *  Locus-of-control. Letting the user explicitly trim their feed
 *  shifts the experience from "the algorithm decides" to "I shaped
 *  this." That single sense of agency is one of the strongest drivers
 *  of long-term retention in social apps.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const STORAGE_KEY = "@xmind/feedback/v1";

interface PersistedShape {
  notInterestedAuthorIds: string[];
  notInterestedHashtags: string[];
  mutedAuthorIds: string[];
  notInterestedPostIds: string[];
}

export interface FeedbackState {
  notInterestedAuthorIds: Set<string>;
  notInterestedHashtags: Set<string>;
  mutedAuthorIds: Set<string>;
  /** Post ids explicitly dismissed via "not interested in this post". */
  notInterestedPostIds: Set<string>;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  markNotInterested: (postId: string) => Promise<void>;
  muteAuthor: (authorId: string) => Promise<void>;
  unmuteAuthor: (authorId: string) => Promise<void>;
  notInterestedAuthor: (authorId: string) => Promise<void>;
  notInterestedHashtag: (hashtag: string) => Promise<void>;
  isAuthorMuted: (authorId: string) => boolean;
  reset: () => Promise<void>;
}

async function persist(state: FeedbackState): Promise<void> {
  const payload: PersistedShape = {
    notInterestedAuthorIds: Array.from(state.notInterestedAuthorIds),
    notInterestedHashtags: Array.from(state.notInterestedHashtags),
    mutedAuthorIds: Array.from(state.mutedAuthorIds),
    notInterestedPostIds: Array.from(state.notInterestedPostIds),
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Disk write failures are non-fatal — the in-memory copy still
    // protects the current session.
  }
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  notInterestedAuthorIds: new Set<string>(),
  notInterestedHashtags: new Set<string>(),
  mutedAuthorIds: new Set<string>(),
  notInterestedPostIds: new Set<string>(),
  isHydrated: false,

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        set({ isHydrated: true });
        return;
      }
      const parsed = JSON.parse(raw) as Partial<PersistedShape>;
      set({
        notInterestedAuthorIds: new Set(parsed.notInterestedAuthorIds ?? []),
        notInterestedHashtags: new Set(parsed.notInterestedHashtags ?? []),
        mutedAuthorIds: new Set(parsed.mutedAuthorIds ?? []),
        notInterestedPostIds: new Set(parsed.notInterestedPostIds ?? []),
        isHydrated: true,
      });
    } catch {
      set({ isHydrated: true });
    }
  },

  markNotInterested: async (postId) => {
    const next = new Set(get().notInterestedPostIds);
    next.add(postId);
    set({ notInterestedPostIds: next });
    await persist(get());
  },

  muteAuthor: async (authorId) => {
    const next = new Set(get().mutedAuthorIds);
    next.add(authorId);
    set({ mutedAuthorIds: next });
    await persist(get());
  },

  unmuteAuthor: async (authorId) => {
    const next = new Set(get().mutedAuthorIds);
    next.delete(authorId);
    set({ mutedAuthorIds: next });
    await persist(get());
  },

  notInterestedAuthor: async (authorId) => {
    const next = new Set(get().notInterestedAuthorIds);
    next.add(authorId);
    set({ notInterestedAuthorIds: next });
    await persist(get());
  },

  notInterestedHashtag: async (hashtag) => {
    const tag = hashtag.startsWith("#") ? hashtag.toLowerCase() : `#${hashtag.toLowerCase()}`;
    const next = new Set(get().notInterestedHashtags);
    next.add(tag);
    set({ notInterestedHashtags: next });
    await persist(get());
  },

  isAuthorMuted: (authorId) => get().mutedAuthorIds.has(authorId),

  reset: async () => {
    set({
      notInterestedAuthorIds: new Set(),
      notInterestedHashtags: new Set(),
      mutedAuthorIds: new Set(),
      notInterestedPostIds: new Set(),
    });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
}));