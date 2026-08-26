/**
 * Tiny on-device TF-IDF utilities.
 *
 * Architectural role:
 *  Powers the feed ranker's topical-relevance signal without shipping a
 *  vector model or hitting a remote embedding endpoint. Pure math, runs
 *  in milliseconds for the size of corpus we care about (≤200 documents
 *  for the user profile, ≤100 candidate posts per page).
 *
 *  Vocabulary cap (top 500 by document frequency) keeps the index tiny
 *  and prevents long-tail tokens from creating noisy similarity scores.
 *  Hashtags weight 3× a regular term — they're the strongest topical
 *  signal short-form social posts emit.
 */

export const STOP_WORDS = new Set([
  "the", "and", "a", "an", "in", "on", "at", "to", "of", "for", "with", "is",
  "are", "was", "were", "be", "been", "being", "have", "has", "had", "do",
  "does", "did", "will", "would", "could", "should", "may", "might", "this",
  "that", "these", "those", "it", "its", "i", "you", "he", "she", "we", "they",
  "them", "us", "our", "your", "my", "me", "but", "or", "if", "as", "so",
  "from", "by", "about", "than", "then", "into", "out", "up", "down", "over",
  "just", "not", "no", "yes", "yeah", "yep", "ok", "okay", "im", "youre",
  "ive", "id", "ill", "youll", "weve", "via", "rt",
]);

const HASHTAG_RX = /#[a-z0-9_]+/g;
const TOKEN_RX = /[a-z0-9_]+/g;
const HASHTAG_WEIGHT = 3;

export interface TermVector {
  /** term → tf-idf weight */
  weights: Map<string, number>;
  /** L2 norm of the vector — cached for cosine similarity. */
  norm: number;
}

/**
 * Tokenise a piece of content into the (term, weight) entries we'll
 * feed into the corpus-level frequency map. Hashtags are extracted
 * first so they don't double-count as plain words.
 */
export function extractTerms(content: string): Array<{ term: string; weight: number }> {
  if (!content) return [];
  const lower = content.toLowerCase();
  const out: Array<{ term: string; weight: number }> = [];

  const hashtags = lower.match(HASHTAG_RX) ?? [];
  for (const tag of hashtags) {
    out.push({ term: tag, weight: HASHTAG_WEIGHT });
  }

  // Strip hashtags before plain-word extraction so we don't double count.
  const stripped = lower.replace(HASHTAG_RX, " ");
  const words = stripped.match(TOKEN_RX) ?? [];
  for (const w of words) {
    if (w.length < 3) continue;
    if (STOP_WORDS.has(w)) continue;
    out.push({ term: w, weight: 1 });
  }
  return out;
}

export interface TfIdfIndex {
  /** term → number of documents that contain the term */
  documentFrequency: Map<string, number>;
  /** total number of documents fed in */
  documentCount: number;
  /** vocabulary capped to top N tokens by document frequency */
  vocabulary: Set<string>;
}

const DEFAULT_VOCAB_CAP = 500;

/**
 * Build an IDF index from a list of documents. Each document is the raw
 * text content of a post (or an aggregation of texts for a user profile).
 * Vocabulary is capped to keep memory bounded; rarely-seen tokens just
 * fall out of consideration.
 */
export function buildTfIdfIndex(
  documents: string[],
  vocabularyCap: number = DEFAULT_VOCAB_CAP
): TfIdfIndex {
  const documentFrequency = new Map<string, number>();
  let documentCount = 0;

  for (const doc of documents) {
    const seenInDoc = new Set<string>();
    for (const { term } of extractTerms(doc)) {
      if (seenInDoc.has(term)) continue;
      seenInDoc.add(term);
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    documentCount += 1;
  }

  // Cap vocabulary at the top N tokens by DF — prevents long-tail noise.
  let vocabulary: Set<string>;
  if (documentFrequency.size <= vocabularyCap) {
    vocabulary = new Set(documentFrequency.keys());
  } else {
    const ranked = Array.from(documentFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, vocabularyCap);
    vocabulary = new Set(ranked.map(([t]) => t));
  }

  return { documentFrequency, documentCount, vocabulary };
}

/**
 * Compute the TF-IDF vector for a single document given a precomputed index.
 */
export function vectorise(content: string, index: TfIdfIndex): TermVector {
  const termCounts = new Map<string, number>();
  let totalCount = 0;

  for (const { term, weight } of extractTerms(content)) {
    if (!index.vocabulary.has(term)) continue;
    termCounts.set(term, (termCounts.get(term) ?? 0) + weight);
    totalCount += weight;
  }

  if (totalCount === 0) {
    return { weights: new Map(), norm: 0 };
  }

  const weights = new Map<string, number>();
  let normSquared = 0;
  for (const [term, count] of termCounts) {
    const tf = count / totalCount;
    const df = index.documentFrequency.get(term) ?? 1;
    // Standard smoothed IDF — `+1` keeps the score bounded and finite
    // when the corpus is tiny.
    const idf = Math.log((index.documentCount + 1) / (df + 1)) + 1;
    const w = tf * idf;
    weights.set(term, w);
    normSquared += w * w;
  }
  return { weights, norm: Math.sqrt(normSquared) };
}

/**
 * Cosine similarity in [0, 1]. Returns 0 when either vector is empty.
 */
export function cosineSimilarity(a: TermVector, b: TermVector): number {
  if (a.norm === 0 || b.norm === 0) return 0;

  // Iterate over the smaller vector so we touch as few cells as possible.
  const [outer, inner] =
    a.weights.size <= b.weights.size ? [a, b] : [b, a];

  let dot = 0;
  for (const [term, w] of outer.weights) {
    const other = inner.weights.get(term);
    if (other != null) dot += w * other;
  }
  return dot / (a.norm * b.norm);
}
