const BLOCKED_PATTERNS: RegExp[] = [
  // Explicit / illegal solicitation
  /\b(escort|onlyfans|nudes|xxx)\b/i,
  // Common scam / phishing language
  /\b(wire transfer|crypto giveaway|guaranteed returns|double your (money|bitcoin))\b/i,
  /\b(click here|bit\.ly|tinyurl)\b/i,
  // Obvious PII dumping (SSN-like, full card numbers) — belongs nowhere in a match request
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:\d[ -]*?){13,16}\b/,
];

const FLAG_PATTERNS: RegExp[] = [
  /\b(loan|forex|mlm|multi-level marketing|get rich quick)\b/i,
  /\bhttps?:\/\//i, // raw links get a human look, not auto-block
];

export type ModerationVerdict = "approved" | "flagged" | "rejected";

export function moderateText(...texts: string[]): ModerationVerdict {
  const combined = texts.join("\n");
  if (BLOCKED_PATTERNS.some((re) => re.test(combined))) return "rejected";
  if (FLAG_PATTERNS.some((re) => re.test(combined))) return "flagged";
  return "approved";
}
