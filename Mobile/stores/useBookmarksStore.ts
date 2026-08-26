/**
 * Bookmarks store.
 *
 * Architectural role:
 *  Tracks which posts the current user has saved. Persists to
 *  AsyncStorage so saves survive cold starts. Kept client-side in V1 —
 *  a future iteration can move bookmarks server-side without changing
 *  the call sites; only the implementation of `toggle` flips from
 *  AsyncStorage to a backend mutation.
 *
 * Psychology lever:
 *  Goal pursuit. The bookmark icon is a tiny "I'll come back to this"
 *  contract with the user. Even when they never open the bookmarks
 *  list, the act of saving lifts session length because each save is a
 *  small commitment to return.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const STORAGE_KEY = "@xmind/bookmarks/v1";

export interface BookmarksState {
  postIds: Set<string>;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  toggle: (postId: string) => Promise<boolean>;
  isBookmarked: (postId: string) => boolean;
  clear: () => Promise<void>;
}

async function persist(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Best-effort — a failed write doesn't lose the in-memory copy.
  }
}

export const useBookmarksStore = create<BookmarksState>((set, get) => ({
  postIds: new Set<string>(),
  isHydrated: false,

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      set({ postIds: new Set(parsed), isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },

  toggle: async (postId) => {
    const next = new Set(get().postIds);
    const saved = !next.has(postId);
    if (saved) next.add(postId);
    else next.delete(postId);
    set({ postIds: next });
    await persist(next);
    return saved;
  },

  isBookmarked: (postId) => get().postIds.has(postId),

  clear: async () => {
    set({ postIds: new Set() });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
}));
