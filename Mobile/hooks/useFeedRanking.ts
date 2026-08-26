/**
 * Feed-ranking hook.
 *
 * Architectural role:
 *  Bridges the raw `usePosts()` infinite query with the layered feed
 *  ranker in `utils/feedRanking.ts`. The expensive bits (TF-IDF index,
 *  user vector, follower-count map) live in a memoised `extras` object
 *  that only rebuilds when the input identity actually changes.
 *
 * Psychology lever:
 *  Variable reward without addiction. The chronological blend keeps the
 *  feed honest — even strong personalisation can't fully hide what was
 *  posted in the last hour. The seen-post penalty deliberately fades
 *  rather than removes, so a great post stays surfaceable next session.
 */
import { useEffect, useMemo, useRef } from "react";

import { usePosts } from "./usePosts";
import { useCurrentUser } from "./useCurrentUser";
import { useFeedbackStore } from "@/stores/useFeedbackStore";
import { useSessionStore } from "@/stores/useSessionStore";
import {
  buildPersonalisationContext,
  rankFeedPostsAdvanced,
  simpleRankPosts,
  type FeedRankingWeights,
  type NegativeFeedback,
  type RankerExtras,
  type UserInteraction,
} from "@/utils/feedRanking";
import type { Post } from "@/types";

export interface UseFeedRankingOptions {
  /** When true, runs the layered ranker; otherwise sorts by recency-weighted velocity. */
  useAdvancedAlgorithm?: boolean;
  /** Page-size cap. The server already paginates, this is a UI safety cap. */
  maxPosts?: number;
  /** Optional weight overrides; pass a stable reference. */
  customWeights?: FeedRankingWeights;
  /** Insert one chronological post for every N ranked posts. 0 disables blending. */
  chronologicalBlendEvery?: number;
}

const DEFAULT_WEIGHTS = {
  topicalRelevance: 0.30,
  engagementVelocity: 0.22,
  recency: 0.20,
  connectionStrength: 0.18,
  quality: 0.10,
} as const satisfies Required<
  Pick<
    FeedRankingWeights,
    | "topicalRelevance"
    | "engagementVelocity"
    | "recency"
    | "connectionStrength"
    | "quality"
  >
>;

export const useFeedRanking = (options: UseFeedRankingOptions = {}) => {
  const useAdvancedAlgorithm = options.useAdvancedAlgorithm ?? true;
  const maxPosts = options.maxPosts ?? 25;
  const customWeights = options.customWeights;
  const chronologicalBlendEvery = options.chronologicalBlendEvery ?? 4;

  const weightsKey = useMemo(() => {
    if (!customWeights) return "default";
    return [
      customWeights.topicalRelevance,
      customWeights.engagementVelocity,
      customWeights.recency,
      customWeights.connectionStrength,
      customWeights.quality,
    ].join("|");
  }, [
    customWeights?.topicalRelevance,
    customWeights?.engagementVelocity,
    customWeights?.recency,
    customWeights?.connectionStrength,
    customWeights?.quality,
  ]);

  const weights = useMemo(
    () => ({ ...DEFAULT_WEIGHTS, ...(customWeights ?? {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weightsKey]
  );

  const {
    posts: rawPosts,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePosts();
  const { currentUser } = useCurrentUser();

  // ── Stores ───────────────────────────────────────────────────────────────
  const seenPostIds = useSessionStore((s) => s.seenPostIds);
  const activeHours = useSessionStore((s) => s.activeHours);
  const lastInteractionAt = useSessionStore((s) => s.lastInteractionAt);

  const isHydrated = useFeedbackStore((s) => s.isHydrated);
  const hydrate = useFeedbackStore((s) => s.hydrate);
  const notInterestedAuthorIds = useFeedbackStore((s) => s.notInterestedAuthorIds);
  const notInterestedHashtags = useFeedbackStore((s) => s.notInterestedHashtags);
  const mutedAuthorIds = useFeedbackStore((s) => s.mutedAuthorIds);
  const notInterestedPostIds = useFeedbackStore((s) => s.notInterestedPostIds);

  const hydratedRef = useRef(isHydrated);
  hydratedRef.current = isHydrated;

  useEffect(() => {
    if (!isHydrated) {
      hydrate().catch(() => undefined);
    }
  }, [hydrate, isHydrated]);

  // ── Derive an interaction history from the user's own posts plus
  //    posts they've liked. The backend doesn't ship a per-user
  //    interaction stream, so we approximate with what the cached feed
  //    already carries: any post whose `likes` includes the viewer is a
  //    "like" interaction. Cheap, deterministic, and good enough to
  //    fingerprint topics. ───────────────────────────────────────────────
  const { interactionHistory, interactionPosts } = useMemo(() => {
    if (!currentUser || !rawPosts.length) {
      return { interactionHistory: [] as UserInteraction[], interactionPosts: [] as Post[] };
    }
    const history: UserInteraction[] = [];
    const seen: Post[] = [];
    for (const post of rawPosts) {
      if (post.user._id === currentUser._id) {
        history.push({
          userId: post.user._id,
          postId: post._id,
          type: "share",
          timestamp: new Date(post.createdAt).getTime(),
        });
        seen.push(post);
        continue;
      }
      if (post.likes?.includes(currentUser._id)) {
        history.push({
          userId: post.user._id,
          postId: post._id,
          type: "like",
          timestamp: new Date(post.createdAt).getTime(),
        });
        seen.push(post);
      }
    }
    return { interactionHistory: history, interactionPosts: seen };
  }, [rawPosts, currentUser]);

  // ── Memoise the personalisation context. Rebuild only when the
  //    interaction count or last-interaction timestamp meaningfully
  //    changes. The hook's caller never has to think about this. ───────
  const contextKey = `${currentUser?._id ?? ""}|${interactionPosts.length}|${lastInteractionAt}`;
  const context = useMemo(() => {
    if (!currentUser) return null;
    return buildPersonalisationContext(
      currentUser,
      interactionHistory,
      interactionPosts,
      rawPosts,
      { activeHours }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey, rawPosts, currentUser?._id]);

  const feedback: NegativeFeedback = useMemo(
    () => ({
      notInterestedAuthorIds,
      notInterestedHashtags,
      mutedAuthorIds,
      notInterestedPostIds,
    }),
    [notInterestedAuthorIds, notInterestedHashtags, mutedAuthorIds, notInterestedPostIds]
  );

  const rankedPosts = useMemo<Post[]>(() => {
    if (!rawPosts || rawPosts.length === 0) return [];
    if (!currentUser || !context) return rawPosts.slice(0, maxPosts);

    if (!useAdvancedAlgorithm) {
      return simpleRankPosts(rawPosts).slice(0, maxPosts);
    }

    try {
      const extras: RankerExtras = {
        context,
        feedback,
        seenPostIds,
        interactionPosts,
      };
      return rankFeedPostsAdvanced(rawPosts, currentUser, extras, {
        weights: { ...DEFAULT_WEIGHTS, ...weights },
        limits: {
          maxPostsPerFeed: maxPosts,
          maxPostsPerAccount: 2,
          chronologicalBlendEvery,
          mmrCandidatePool: 100,
          mmrLambda: 0.7,
        },
      }).slice(0, maxPosts);
    } catch (rankError) {
      if (__DEV__) console.error("[feedRanking] error:", rankError);
      return simpleRankPosts(rawPosts).slice(0, maxPosts);
    }
  }, [
    rawPosts,
    currentUser,
    context,
    feedback,
    seenPostIds,
    interactionPosts,
    useAdvancedAlgorithm,
    maxPosts,
    weights,
    chronologicalBlendEvery,
  ]);

  return {
    posts: rankedPosts,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
};
