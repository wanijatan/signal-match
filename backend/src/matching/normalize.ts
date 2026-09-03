/**
 * Deterministic normalization layer. Runs ALWAYS (even when AI matching is
 * enabled) so we always have a reliable fallback signal, and so keyword
 * overlap can contribute to explanations.
 *
 * This is intentionally simple and easy to extend — add synonym clusters as
 * real user data comes in.
 */

const SYNONYM_CLUSTERS: string[][] = [
  // Investor / funding / fundraising are treated as one broad concept space —
  // someone who "helps with fundraising" or "helps you raise funds" is a
  // directly relevant match for someone "looking for an investor", per the
  // product spec's own examples.
  [
    "investor", "vc", "venture capital", "venture capitalist", "angel investor",
    "seed investor", "pre-seed investor", "funding", "capital", "fundraising",
    "fundraise", "raise", "raising", "raise funds", "raising funds",
    "raising capital", "raise capital", "fund raise", "fund raising", "invest",
    "investing", "investment",
  ],
  ["cofounder", "co-founder", "technical cofounder", "technical co-founder", "founding engineer"],
  ["designer", "product designer", "ux designer", "ui designer", "design"],
  ["developer", "engineer", "software engineer", "frontend developer", "backend developer", "full stack developer", "programmer"],
  ["sales", "b2b sales", "gtm", "go-to-market", "growth", "revenue", "pipeline"],
  ["marketing", "growth marketing", "content marketing", "performance marketing", "demand generation"],
  ["mentor", "advisor", "coach", "guidance"],
  ["customer", "client", "buyer", "user"],
  ["saas", "software as a service", "b2b saas", "b2b software"],
  ["taxation", "tax", "accounting", "cfo", "finance"],
  ["recruiter", "hiring", "talent", "recruiting"],
  ["job", "opportunity", "role", "position", "employment"],
  ["introduction", "intro", "connection", "network", "warm intro"],
  ["legal", "lawyer", "attorney", "counsel"],
];

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "for", "with", "who", "that", "this", "i", "im", "i'm",
  "am", "is", "are", "to", "of", "in", "on", "at", "someone", "some", "looking", "look",
  "need", "needs", "want", "wants", "help", "helps", "can", "could", "please", "would",
  "like", "into", "about", "person", "people", "experienced", "experience",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Crude suffix-stripping so simple tense/plural variants line up (e.g.
 * "raising" / "raised" both reduce toward "rais", matching "raise").
 * Not real stemming (no dictionary, no exceptions) — just enough to catch
 * the common English suffixes without pulling in an NLP dependency.
 */
function roughStem(word: string): string {
  return word
    .replace(/(ing|ies|ers|ed|es|s)$/i, (suffix, _match, offset, full) =>
      full.length - suffix.length >= 3 ? "" : suffix
    );
}

/** Expands each token to its synonym cluster's canonical (first) term. */
function canonicalize(tokens: string[]): Set<string> {
  const out = new Set<string>();
  for (const token of tokens) {
    const stem = roughStem(token);
    let matched = false;
    for (const cluster of SYNONYM_CLUSTERS) {
      const hit = cluster.some((phrase) => {
        const phraseStem = roughStem(phrase);
        return (
          phrase.includes(token) ||
          token.includes(phrase) ||
          phraseStem === stem ||
          phrase.includes(stem) ||
          stem.includes(phraseStem)
        );
      });
      if (hit) {
        out.add(cluster[0]);
        matched = true;
      }
    }
    if (!matched) out.add(stem || token);
  }
  return out;
}

export interface Normalized {
  raw: string;
  tokens: string[];
  concepts: Set<string>;
  normalizedText: string;
}

export function normalize(text: string): Normalized {
  const tokens = tokenize(text);
  const concepts = canonicalize(tokens);
  return {
    raw: text,
    tokens,
    concepts,
    normalizedText: Array.from(concepts).join(" "),
  };
}

/**
 * Overlap between two concept sets, 0..1, using containment (intersection
 * over the smaller set) rather than strict Jaccard. Two short texts about
 * the same thing often each carry a few unrelated filler concepts too —
 * Jaccard-over-union punishes that unfairly, while containment rewards
 * "the core concepts genuinely overlap" even when each side also mentions
 * a couple of things the other doesn't.
 */
export function conceptOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const c of a) if (b.has(c)) intersection++;
  const smaller = Math.min(a.size, b.size);
  return smaller === 0 ? 0 : intersection / smaller;
}

/** Also checks multi-word phrase containment for extra signal (e.g. exact "B2B SaaS"). */
export function phraseBonus(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const phrases = aLower.match(/\b[a-z]+(?:[\s-][a-z]+){1,3}\b/g) ?? [];
  let hits = 0;
  for (const phrase of phrases) {
    if (phrase.length > 5 && bLower.includes(phrase)) hits++;
  }
  return Math.min(hits * 0.08, 0.25);
}
