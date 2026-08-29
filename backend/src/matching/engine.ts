import { conceptOverlap, normalize, phraseBonus } from "./normalize.js";
import { cosineSimilarity } from "./embeddings.js";
import type { Confidence, MatchType, Signal } from "../types/index.js";
import { env } from "../utils/env.js";

export interface ScoreResult {
  forwardScore: number; // A.lookingFor <-> B.canOffer, 0-100
  reverseScore: number; // B.lookingFor <-> A.canOffer, 0-100
  locationScore: number; // 0-100
  overallScore: number; // 0-100
  matchType: MatchType;
  confidence: Confidence | null; // null => below notification threshold
  explanation: string;
}

function keywordScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  const overlap = conceptOverlap(na.concepts, nb.concepts); // 0..1
  const bonus = phraseBonus(a, b); // 0..0.25
  return Math.min(1, overlap + bonus) * 100;
}

function directionalScore(a: string, b: string, embedA: number[] | null, embedB: number[] | null): number {
  const kw = keywordScore(a, b);
  if (env.AI_MATCHING_ENABLED && embedA && embedB) {
    const cosine = cosineSimilarity(embedA, embedB); // -1..1, usually 0..1 for related text
    const semantic = Math.max(0, cosine) * 100;
    // Blend: semantic similarity leads, keyword overlap provides a floor/boost
    return Math.round(Math.min(100, semantic * 0.75 + kw * 0.25));
  }
  return Math.round(kw);
}

function locationScore(locA: string | null, locB: string | null): number {
  if (!locA || !locB || locA === "Global" || locB === "Global") return 60; // neutral-friendly
  return locA === locB ? 100 : 30;
}

function classifyConfidence(overall: number): Confidence | null {
  if (overall >= env.MATCH_THRESHOLD_STRONG) return "strong";
  if (overall >= env.MATCH_THRESHOLD_GOOD) return "good";
  if (overall >= env.MATCH_THRESHOLD_POTENTIAL) return "potential";
  return null;
}

function buildExplanation(
  a: Pick<Signal, "looking_for" | "can_offer">,
  b: Pick<Signal, "looking_for" | "can_offer">,
  matchType: MatchType,
  leadDirection: "forward" | "reverse"
): string {
  const trim = (s: string, n = 140) => (s.length > n ? s.slice(0, n).trim() + "…" : s);
  if (matchType === "reciprocal") {
    return `You're both looking for something the other can help with — you need "${trim(
      a.looking_for,
      70
    )}" and they can help, while they need "${trim(b.looking_for, 70)}" and you can help.`;
  }
  // forward = A's need matched by B's offer. reverse = B's need matched by A's offer.
  if (leadDirection === "forward") {
    return `You're looking for "${trim(a.looking_for)}", and this person can help with "${trim(
      b.can_offer
    )}".`;
  }
  return `This person is looking for "${trim(b.looking_for)}" — and what you offer ("${trim(
    a.can_offer,
    70
  )}") may be a genuine fit.`;
}

/**
 * Computes a full bidirectional match score between two signals and
 * classifies the match type + confidence tier. Returns confidence: null
 * when the score doesn't clear the minimum notification threshold — the
 * caller should not create/notify a match in that case.
 */
export function scoreSignalPair(a: Signal, b: Signal): ScoreResult {
  // Tiered retention: a "looking for" ask expires faster than a "can offer"
  // listing. A direction only counts if BOTH the asker's need and the
  // helper's offer are still within their active window.
  const forwardValid = a.looking_for_active && b.can_offer_active;
  const reverseValid = b.looking_for_active && a.can_offer_active;

  const forwardScore = forwardValid
    ? directionalScore(a.looking_for, b.can_offer, a.looking_embedding, b.offer_embedding)
    : 0;
  const reverseScore = reverseValid
    ? directionalScore(b.looking_for, a.can_offer, b.looking_embedding, a.offer_embedding)
    : 0;
  const locScore = locationScore(a.location, b.location);

  const RECIPROCAL_THRESHOLD = 50; // both directions meaningfully relevant
  const isReciprocal = forwardScore >= RECIPROCAL_THRESHOLD && reverseScore >= RECIPROCAL_THRESHOLD;

  let overallScore: number;
  let matchType: MatchType;

  if (isReciprocal) {
    // Both people are relevant to each other — blend both directions, per spec formula.
    matchType = "reciprocal";
    overallScore = forwardScore * 0.55 + reverseScore * 0.35 + locScore * 0.1;
    // Reciprocal matches are inherently higher value — small deliberate boost, capped at 100.
    overallScore = Math.min(100, overallScore * 1.05);
  } else {
    // One side is clearly the "ask" and the other the "give". Per spec §9, a
    // one-way match should be scored primarily on forwardScore (the strong
    // direction), not dragged down by blending in the much weaker reverse
    // direction — the other person not needing anything back doesn't make
    // this a worse match for the person who does the asking.
    const leadScore = Math.max(forwardScore, reverseScore);
    const otherScore = Math.min(forwardScore, reverseScore);
    matchType = leadScore >= RECIPROCAL_THRESHOLD ? "direct" : "one_way";
    // The weaker direction still contributes a small amount — some mutual
    // relevance is a good sign even short of "reciprocal" — but doesn't
    // dominate the score.
    overallScore = leadScore * 0.8 + otherScore * 0.1 + locScore * 0.1;
  }

  const confidence = classifyConfidence(overallScore);
  const leadDirection: "forward" | "reverse" = forwardScore >= reverseScore ? "forward" : "reverse";
  const explanation = buildExplanation(a, b, matchType, leadDirection);

  return {
    forwardScore: Math.round(forwardScore * 100) / 100,
    reverseScore: Math.round(reverseScore * 100) / 100,
    locationScore: Math.round(locScore * 100) / 100,
    overallScore: Math.round(overallScore * 100) / 100,
    matchType,
    confidence,
    explanation,
  };
}
