/**
 * Session-scoped state.
 *
 * Architectural role:
 *  Tracks volatile, per-session signals that the feed ranker uses to keep
 *  the feed feeling fresh. The data lives in memory only — we never
 *  persist `seenPostIds` because "seen this session" is the whole point;
 *  carrying it across cold starts would over-suppress posts the user
 *  hasn't actually re-seen.
 *
 * Psychology lever:
 *  Variable reward + novelty bias. By multiplicatively penalising
 *  already-seen posts (rather than removing them) we degrade their score
 *  gracefully — a great post stays surfaceable a second time, but the
 *  feed always has more new things to show first.
 */
import { create } from "zustand";

export interface SessionState {
  /** Post ids the user has already viewed in this app session. */
  seenPostIds: Set<string>;
  /** Hour-of-day buckets the user has been active in. Drives timezone-aware decay. */
  activeHours: Record<number, number>;
  /** Most recent interaction timestamp — used as a memo key for ranker rebuilds. */
  lastInteractionAt: number;

  markPostSeen: (postId: string) => void;
  markPostsSeen: (postIds: string[]) => void;
  recordActivity: (timestamp?: number) => void;
  isPostSeen: (postId: string) => boolean;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  seenPostIds: new Set<string>(),
  activeHours: {},
  lastInteractionAt: 0,

  markPostSeen: (postId) => {
    const seen = get().seenPostIds;
    if (seen.has(postId)) return;
    const next = new Set(seen);
    next.add(postId);
    set({ seenPostIds: next });
  },

  markPostsSeen: (postIds) => {
    if (!postIds.length) return;
    const seen = get().seenPostIds;
    let changed = false;
    const next = new Set(seen);
    for (const id of postIds) {
      if (!next.has(id)) {
        next.add(id);
        changed = true;
      }
    }
    if (changed) set({ seenPostIds: next });
  },

  recordActivity: (timestamp = Date.now()) => {
    const hour = new Date(timestamp).getHours();
    const buckets = get().activeHours;
    set({
      activeHours: { ...buckets, [hour]: (buckets[hour] ?? 0) + 1 },
      lastInteractionAt: timestamp,
    });
  },

  isPostSeen: (postId) => get().seenPostIds.has(postId),

  resetSession: () =>
    set({
      seenPostIds: new Set<string>(),
      activeHours: {},
      lastInteractionAt: 0,
    }),
}));