/**
 * xMind feed ranker — layered hybrid algorithm.
 *
 * The ranker runs as a stack of pure signal layers, each one a small
 * function so we can unit-test in isolation later. Order matters: hard
 * filters first so we never spend cycles scoring posts we'd hide
 * anyway, then scoring, then a Maximal Marginal Relevance diversity
 * pass, then a per-author cap, then a 4:1 chronological blend.
 *
 *   1. Hard filters         (muted, blocked, max age, low quality, "not interested")
 *   2. Exposure decay       (seen this session → 0.4× score, not removed)
 *   3. Topical relevance    (TF-IDF cosine vs user's interaction profile, hashtags 3×)
 *   4. Engagement velocity  (engagement / hour, normalised per author follower count)
 *   5. Time decay           (half-life, slowed during the user's active hours)
 *   6. Connection strength  (follow direct + 2nd-degree follow-of-follow)
 *   7. Quality + sentiment  (length, tag count, clickbait, all-caps + !!! penalty)
 *   8. Cold-start fallback  (when interaction history < 5: verified + velocity + diversity)
 *   9. MMR diversity rerank (λ=0.7, TF-IDF cosine as the diversity penalty)
 *  10. Per-author cap       (≤ 2 posts per author after MMR)
 *  11. Chronological blend  (1 chronological post for every 4 ranked ones)
 *
 * Determinism is non-negotiable. No `Math.random()` anywhere — the same
 * inputs must produce the same output every render so React's `useMemo`
 * actually memoises and FlashList scroll positions stay stable.
 *
 * Performance notes:
 *  - We score in a single pass over the candidate set.
 *  - The user's TF-IDF profile is a single object that's memoised at the
 *    hook layer, so we don't rebuild it per post.
 *  - Hot scoring path avoids per-post string allocations where possible.
 */

import { Post, User } from "@/types";

import {
  buildTfIdfIndex,
  cosineSimilarity,
  extractTerms,
  type TermVector,
  type TfIdfIndex,
  vectorise,
} from "./tfidf";

// ───────────────────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────────────────

export interface UserInteraction {
  userId: string;
  postId: string;
  type: "like" | "comment" | "share" | "view" | "skip";
  timestamp: number;
}

export interface UserProfile {
  userId: string;
  interests: string[];
  location?: string;
  followedAccounts: string[];
  blockedAccounts: string[];
  interactionHistory: UserInteraction[];
  preferences: {
    contentTypes: ("text" | "image" | "video")[];
    topics: string[];
    mutedAccounts: string[];
    preferPersonalContent?: boolean;
  };
}

export interface FeedRankingWeights {
  topicalRelevance?: number;
  engagementVelocity?: number;
  recency?: number;
  connectionStrength?: number;
  quality?: number;
  /** Legacy keys, kept so existing callers compile. */
  engagementLikelihood?: number;
  diversity?: number;
}

export interface FeedRankingConfig {
  weights: Required<Omit<FeedRankingWeights, "engagementLikelihood" | "diversity">>;
  limits: {
    maxPostsPerAccount: number;
    maxPostsPerFeed: number;
    /** Insert one chronological post for every N ranked posts. 0 disables blending. */
    chronologicalBlendEvery: number;
    /** Top N candidates fed into MMR diversity rerank. */
    mmrCandidatePool: number;
    /** MMR lambda — 1.0 = pure relevance, 0.0 = pure diversity. */
    mmrLambda: number;
  };
  timeDecay: {
    halfLifeHours: number;
    maxAgeHours: number;
    /** Multiplier applied during the user's active hours (>=1 slows decay). */
    activeHourFactor: number;
  };
  /** Penalty multiplier applied to posts the user has already seen this session. */
  seenPenalty: number;
  /** Below this many interactions we drop into "discover" mode. */
  coldStartThreshold: number;
  trendingThreshold?: {
    minEngagement: number;
    maxAgeHours: number;
  };
}

const DEFAULT_CONFIG: FeedRankingConfig = {
  weights: {
    topicalRelevance: 0.30,
    engagementVelocity: 0.22,
    recency: 0.20,
    connectionStrength: 0.18,
    quality: 0.10,
  },
  limits: {
    maxPostsPerAccount: 2,
    maxPostsPerFeed: 25,
    chronologicalBlendEvery: 4,
    mmrCandidatePool: 100,
    mmrLambda: 0.7,
  },
  timeDecay: {
    halfLifeHours: 12,
    maxAgeHours: 48,
    activeHourFactor: 1.4,
  },
  seenPenalty: 0.4,
  coldStartThreshold: 5,
  trendingThreshold: {
    minEngagement: 10,
    maxAgeHours: 1,
  },
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HASHTAG_RX = /#\w+/g;
const URL_RX = /https?:\/\/\S+/g;
const REPETITIVE_RUN = /(.)\1{4,}/;
const ALL_CAPS_WORD_RX = /\b[A-Z]{2,}\b/g;
const CLICKBAIT_PHRASES = [
  "shocking",
  "you won't believe",
  "mind-blowing",
  "secret revealed",
  "this changes everything",
];

// ───────────────────────────────────────────────────────────────────────────
// Pre-built artefacts the hook hands us. Memoise these at the call site.
// ───────────────────────────────────────────────────────────────────────────

export interface PersonalisationContext {
  /** TF-IDF index built from the user's recent interaction corpus. */
  index: TfIdfIndex;
  /** Aggregated TF-IDF vector representing the user's topical fingerprint. */
  userVector: TermVector;
  /** Map of authorId → number of interactions with that author (for connection). */
  authorAffinity: Map<string, number>;
  /** Active-hour buckets — hour-of-day → count. */
  activeHours: Record<number, number>;
  /** Author follower counts by id, for engagement-velocity normalisation. */
  authorFollowerCounts: Map<string, number>;
  /** 2nd-degree follow set: ids of people followed by people the user follows. */
  secondDegreeFollows: Set<string>;
}

export interface NegativeFeedback {
  notInterestedAuthorIds: ReadonlySet<string>;
  notInterestedHashtags: ReadonlySet<string>;
  mutedAuthorIds: ReadonlySet<string>;
  notInterestedPostIds: ReadonlySet<string>;
}

export interface RankerExtras {
  context: PersonalisationContext;
  feedback: NegativeFeedback;
  seenPostIds: ReadonlySet<string>;
  /** Already-fetched posts associated with the user's interaction history (for TF-IDF). */
  interactionPosts?: Post[];
}

/**
 * Build a personalisation context from a user's interaction history.
 * Returns a stable artefact that can be passed to `rankFeedPostsAdvanced`.
 */
export function buildPersonalisationContext(
  currentUser: User,
  interactionHistory: UserInteraction[],
  interactionPosts: Post[],
  candidatePool: Post[],
  options: {
    activeHours?: Record<number, number>;
    secondDegreeFollows?: Set<string>;
  } = {}
): PersonalisationContext {
  const corpusDocs = interactionPosts.map((p) => p.content || "");
  const index = buildTfIdfIndex(corpusDocs);

  // Aggregate user vector by averaging the per-document vectors. We
  // weight likes/comments equally — the API doesn't carry interaction
  // type per post here; the upstream hook decides which posts to feed in.
  const aggWeights = new Map<string, number>();
  let aggDocs = 0;
  for (const doc of corpusDocs) {
    const v = vectorise(doc, index);
    if (v.weights.size === 0) continue;
    aggDocs += 1;
    for (const [term, w] of v.weights) {
      aggWeights.set(term, (aggWeights.get(term) ?? 0) + w);
    }
  }
  let normSq = 0;
  if (aggDocs > 0) {
    for (const [term, w] of aggWeights) {
      const avg = w / aggDocs;
      aggWeights.set(term, avg);
      normSq += avg * avg;
    }
  }
  const userVector: TermVector = { weights: aggWeights, norm: Math.sqrt(normSq) };

  // Author affinity — interactions per author from history.
  const authorAffinity = new Map<string, number>();
  for (const interaction of interactionHistory) {
    if (!interaction.userId) continue;
    authorAffinity.set(
      interaction.userId,
      (authorAffinity.get(interaction.userId) ?? 0) + 1
    );
  }

  // Author follower counts — derived from the candidate pool itself
  // (every candidate carries `user.followers`). Cheap and avoids extra
  // round trips. Falls back to 0 when missing.
  const authorFollowerCounts = new Map<string, number>();
  for (const post of candidatePool) {
    if (!post.user?._id) continue;
    if (authorFollowerCounts.has(post.user._id)) continue;
    const followerCount = post.user.followers?.length ?? 0;
    authorFollowerCounts.set(post.user._id, followerCount);
  }

  return {
    index,
    userVector,
    authorAffinity,
    activeHours: options.activeHours ?? {},
    authorFollowerCounts,
    secondDegreeFollows: options.secondDegreeFollows ?? new Set<string>(),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Public ranker entry points
// ───────────────────────────────────────────────────────────────────────────

/**
 * Advanced ranker. Pass a precomputed `extras` object — the hook layer
 * memoises it so this function only does scoring work, never index work.
 */
export function rankFeedPostsAdvanced(
  posts: Post[],
  currentUser: User,
  extras: RankerExtras,
  configOverride?: Partial<FeedRankingConfig>
): Post[] {
  if (!posts.length) return [];
  const config = mergeConfig(configOverride);

  // ── Layer 1 — hard filters ───────────────────────────────────────────────
  const filtered = applyHardFilters(posts, currentUser, extras.feedback, config);
  if (!filtered.length) return [];

  const interactionCount = extras.context.authorAffinity.size;
  const isColdStart = interactionCount < config.coldStartThreshold;

  // ── Layers 2–8 — scoring ─────────────────────────────────────────────────
  const scored: ScoredPost[] = filtered.map((post) => {
    const score = isColdStart
      ? scoreColdStart(post, currentUser, config)
      : scorePost(post, currentUser, extras, config);
    const exposurePenalty = extras.seenPostIds.has(post._id)
      ? config.seenPenalty
      : 1;
    return { post, score: score * exposurePenalty };
  });
  scored.sort((a, b) => b.score - a.score);

  // ── Layer 9 — MMR diversity rerank on the top N ─────────────────────────
  const pool = scored.slice(0, config.limits.mmrCandidatePool);
  const reranked = mmrRerank(pool, extras.context.index, config.limits.mmrLambda);

  // ── Layer 10 — per-author cap ───────────────────────────────────────────
  const capped: ScoredPost[] = [];
  const authorCounts = new Map<string, number>();
  for (const item of reranked) {
    const authorId = item.post.user._id;
    const count = authorCounts.get(authorId) ?? 0;
    if (count >= config.limits.maxPostsPerAccount) continue;
    capped.push(item);
    authorCounts.set(authorId, count + 1);
    if (capped.length >= config.limits.maxPostsPerFeed) break;
  }

  // ── Layer 11 — chronological blend ──────────────────────────────────────
  if (config.limits.chronologicalBlendEvery <= 0) {
    return capped.map((s) => s.post);
  }

  const chronological = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return blendChronological(
    capped.map((s) => s.post),
    chronological,
    config.limits.chronologicalBlendEvery,
    config.limits.maxPostsPerFeed
  );
}

/**
 * Backwards-compatible entry point. Older call sites pass interaction
 * history as a flat array; we synthesise an empty personalisation
 * context so the basic recency / engagement signals still apply.
 */
export function rankFeedPosts(
  posts: Post[],
  currentUser: User,
  userInteractions: UserInteraction[] = [],
  configOverride?: Partial<FeedRankingConfig>,
  extras?: Partial<RankerExtras>
): Post[] {
  const config = mergeConfig(configOverride);
  const context: PersonalisationContext = extras?.context ?? {
    index: buildTfIdfIndex([]),
    userVector: { weights: new Map(), norm: 0 },
    authorAffinity: aggregateAffinity(userInteractions),
    activeHours: {},
    authorFollowerCounts: collectFollowerCounts(posts),
    secondDegreeFollows: new Set<string>(),
  };
  const fullExtras: RankerExtras = {
    context,
    feedback: extras?.feedback ?? {
      notInterestedAuthorIds: new Set(),
      notInterestedHashtags: new Set(),
      mutedAuthorIds: new Set(),
      notInterestedPostIds: new Set(),
    },
    seenPostIds: extras?.seenPostIds ?? new Set(),
    interactionPosts: extras?.interactionPosts,
  };
  return rankFeedPostsAdvanced(posts, currentUser, fullExtras, config);
}

/**
 * Cheap fallback — sorts by recency-weighted engagement velocity. Used
 * when the advanced ranker throws or when the caller explicitly opts out.
 */
export function simpleRankPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => velocity(b) - velocity(a));
}

// ───────────────────────────────────────────────────────────────────────────
// Layer 1 — hard filters
// ───────────────────────────────────────────────────────────────────────────

export function applyHardFilters(
  posts: Post[],
  currentUser: User,
  feedback: NegativeFeedback,
  config: FeedRankingConfig
): Post[] {
  const maxAgeMs = config.timeDecay.maxAgeHours * HOUR_MS;
  const now = Date.now();
  const muted = feedback.mutedAuthorIds;
  const notInterestedAuthor = feedback.notInterestedAuthorIds;
  const notInterestedTags = feedback.notInterestedHashtags;
  const notInterestedPost = feedback.notInterestedPostIds;

  return posts.filter((post) => {
    if (!post?._id || !post.user?._id) return false;
    if (post.user._id === currentUser._id) return false;
    if (muted.has(post.user._id)) return false;
    if (notInterestedAuthor.has(post.user._id)) return false;
    if (notInterestedPost.has(post._id)) return false;
    if (now - new Date(post.createdAt).getTime() > maxAgeMs) return false;
    if (isLowQuality(post)) return false;
    if (notInterestedTags.size > 0) {
      const tags = (post.content ?? "").toLowerCase().match(HASHTAG_RX) ?? [];
      for (const tag of tags) {
        if (notInterestedTags.has(tag)) return false;
      }
    }
    return true;
  });
}

export function isLowQuality(post: Post): boolean {
  const c = post.content ?? "";
  if (!c && !post.image) return true;
  if (c && c.length < 5 && !post.image) return true;

  const tags = c.match(HASHTAG_RX) ?? [];
  if (tags.length > 8) return true;

  const upperRatio = c.replace(/[^A-Z]/g, "").length / Math.max(c.length, 1);
  if (upperRatio > 0.7 && c.length > 20) return true;

  if (REPETITIVE_RUN.test(c)) return true;
  if ((c.match(/[!?.]{3,}/g) ?? []).length > 2) return true;
  if ((c.match(URL_RX) ?? []).length > 3) return true;
  return false;
}

// ───────────────────────────────────────────────────────────────────────────
// Scoring layers
// ───────────────────────────────────────────────────────────────────────────

interface ScoredPost {
  post: Post;
  score: number;
}

export function scorePost(
  post: Post,
  currentUser: User,
  extras: RankerExtras,
  config: FeedRankingConfig
): number {
  const w = config.weights;
  return (
    w.topicalRelevance * topicalRelevance(post, extras.context) +
    w.engagementVelocity * engagementVelocity(post, extras.context) +
    w.recency * recency(post, extras.context.activeHours, config) +
    w.connectionStrength * connectionStrength(post, currentUser, extras.context) +
    w.quality * qualityScore(post)
  );
}

/** Cold-start scorer — verified > velocity > newness. No personal signals. */
export function scoreColdStart(
  post: Post,
  _currentUser: User,
  config: FeedRankingConfig
): number {
  const verified = post.user.verified ? 0.4 : 0;
  const velocityScore = Math.min(velocity(post) * 0.05, 0.3);
  const recencyScore = recency(post, {}, config) * 0.3;
  return verified + velocityScore + recencyScore;
}

// ── Layer 3 — topical relevance ───────────────────────────────────────────
export function topicalRelevance(
  post: Post,
  ctx: PersonalisationContext
): number {
  if (ctx.userVector.norm === 0) return 0;
  const postVector = vectorise(post.content ?? "", ctx.index);
  return cosineSimilarity(postVector, ctx.userVector);
}

// ── Layer 4 — engagement velocity (normalised per author) ─────────────────
export function engagementVelocity(
  post: Post,
  ctx: PersonalisationContext
): number {
  const v = velocity(post);
  if (v === 0) return 0;
  const followers = ctx.authorFollowerCounts.get(post.user._id) ?? 0;
  // Normalise: a post outpacing the author's follower count is exceptional.
  // We use log so the curve flattens and a viral spike doesn't dominate.
  const expected = Math.max(1, Math.log10(followers + 10));
  const ratio = v / expected;
  return Math.min(ratio / 4, 1);
}

// ── Layer 5 — time decay (timezone aware) ─────────────────────────────────
export function recency(
  post: Post,
  activeHours: Record<number, number>,
  config: FeedRankingConfig
): number {
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / HOUR_MS;
  const postHour = new Date(post.createdAt).getHours();
  const isInActiveWindow = !!activeHours[postHour] && activeHours[postHour] > 0;

  // Slow decay during the user's active hours.
  const halfLife = isInActiveWindow
    ? config.timeDecay.halfLifeHours * config.timeDecay.activeHourFactor
    : config.timeDecay.halfLifeHours;

  let decay = 1 / (1 + ageHours / halfLife);
  if (ageHours > config.timeDecay.maxAgeHours) decay *= 0.5;

  // Trending bonus — recent + already getting engagement.
  const trending = config.trendingThreshold;
  const engagement = (post.likes?.length ?? 0) + (post.commentCount ?? post.comments?.length ?? 0);
  if (trending && ageHours < trending.maxAgeHours && engagement > trending.minEngagement) {
    decay = Math.min(decay + 0.2, 1);
  }
  return decay;
}

// ── Layer 6 — connection strength ─────────────────────────────────────────
export function connectionStrength(
  post: Post,
  currentUser: User,
  ctx: PersonalisationContext
): number {
  let score = 0;
  const following = currentUser.following ?? [];
  if (following.includes(post.user._id)) score += 0.5;
  if (post.user.followers?.includes(currentUser._id)) score += 0.15;
  if (ctx.secondDegreeFollows.has(post.user._id)) score += 0.3;

  const interactions = ctx.authorAffinity.get(post.user._id) ?? 0;
  const totalInteractions = sumValues(ctx.authorAffinity);
  if (totalInteractions > 0) {
    const rate = interactions / totalInteractions;
    score += Math.min(rate * 0.3, 0.3);
  }
  return Math.min(score, 1);
}

// ── Layer 7 — quality + sentiment proxy ───────────────────────────────────
export function qualityScore(post: Post): number {
  let score = 0.5;
  if (post.user.verified) score += 0.2;

  const c = post.content ?? "";
  const len = c.length;
  if (len > 50 && len < 500) score += 0.1;
  else if (len < 10 && !post.image) score -= 0.2;
  else if (len > 1000) score -= 0.1;

  const tags = c.match(HASHTAG_RX) ?? [];
  if (tags.length > 0 && tags.length <= 3) score += 0.1;
  else if (tags.length > 5) score -= 0.2;

  // Sentiment proxy — shouting + clickbait are common low-signal markers.
  const allCapsRuns = c.match(ALL_CAPS_WORD_RX) ?? [];
  let consecutiveCaps = 0;
  for (let i = 1; i < allCapsRuns.length; i++) {
    consecutiveCaps = Math.max(consecutiveCaps, 2);
  }
  if (allCapsRuns.length > 2 || consecutiveCaps >= 2) score -= 0.2;

  const exclamations = (c.match(/!/g) ?? []).length;
  if (exclamations > 3) score -= 0.2;

  const lower = c.toLowerCase();
  if (CLICKBAIT_PHRASES.some((p) => lower.includes(p))) score -= 0.3;

  return Math.max(0, Math.min(score, 1));
}

// ───────────────────────────────────────────────────────────────────────────
// Layer 9 — Maximal Marginal Relevance
// ───────────────────────────────────────────────────────────────────────────

export function mmrRerank(
  scored: ScoredPost[],
  index: TfIdfIndex,
  lambda: number
): ScoredPost[] {
  if (scored.length <= 2) return scored;

  // Pre-vectorise once per post.
  const vectors = scored.map((s) => ({
    item: s,
    vector: vectorise(s.post.content ?? "", index),
  }));

  const selected: typeof vectors = [];
  const remaining = [...vectors];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (!candidate) continue;

      let maxSim = 0;
      for (const sel of selected) {
        const sim = cosineSimilarity(candidate.vector, sel.vector);
        if (sim > maxSim) maxSim = sim;
      }
      const mmr = lambda * candidate.item.score - (1 - lambda) * maxSim;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    if (chosen) selected.push(chosen);
  }

  return selected.map((v) => v.item);
}

// ───────────────────────────────────────────────────────────────────────────
// Layer 11 — chronological blend
// ───────────────────────────────────────────────────────────────────────────

export function blendChronological(
  ranked: Post[],
  chronological: Post[],
  every: number,
  cap: number
): Post[] {
  if (every <= 0) return ranked.slice(0, cap);

  const seen = new Set(ranked.map((p) => p._id));
  const queue = chronological.filter((p) => !seen.has(p._id));
  const out: Post[] = [];

  for (let i = 0; i < ranked.length && out.length < cap; i++) {
    const post = ranked[i];
    if (post) out.push(post);
    // Insert chronological filler after every Nth ranked post.
    if (out.length > 0 && out.length % every === 0 && queue.length > 0) {
      const filler = queue.shift();
      if (filler && out.length < cap) out.push(filler);
    }
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

export function velocity(post: Post): number {
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / HOUR_MS;
  const engagement =
    (post.likes?.length ?? 0) +
    (post.commentCount ?? post.comments?.length ?? 0);
  return engagement / (ageHours + 1);
}

function sumValues(map: Map<string, number>): number {
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}

function aggregateAffinity(
  interactions: UserInteraction[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (const i of interactions) {
    if (!i.userId) continue;
    out.set(i.userId, (out.get(i.userId) ?? 0) + 1);
  }
  return out;
}

function collectFollowerCounts(posts: Post[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const post of posts) {
    if (!post.user?._id || out.has(post.user._id)) continue;
    out.set(post.user._id, post.user.followers?.length ?? 0);
  }
  return out;
}

function mergeConfig(override?: Partial<FeedRankingConfig>): FeedRankingConfig {
  if (!override) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...override,
    weights: { ...DEFAULT_CONFIG.weights, ...(override.weights ?? {}) } as FeedRankingConfig["weights"],
    limits: { ...DEFAULT_CONFIG.limits, ...(override.limits ?? {}) },
    timeDecay: { ...DEFAULT_CONFIG.timeDecay, ...(override.timeDecay ?? {}) },
    seenPenalty: override.seenPenalty ?? DEFAULT_CONFIG.seenPenalty,
    coldStartThreshold:
      override.coldStartThreshold ?? DEFAULT_CONFIG.coldStartThreshold,
    trendingThreshold: {
      ...(DEFAULT_CONFIG.trendingThreshold ?? { minEngagement: 10, maxAgeHours: 1 }),
      ...(override.trendingThreshold ?? {}),
    },
  };
}

// Re-export the term extraction helper so screens can compute token sets
// for the trending rail without re-implementing the regex set.
export { extractTerms };
