import { nanoid } from "nanoid";
import { supabase } from "../services/supabase.js";
import { scoreSignalPair } from "../matching/engine.js";
import type { Signal } from "../types/index.js";
import { sendMatchEmails } from "../email/send.js";
import { trackEvent } from "../services/analytics.js";

const MAX_CANDIDATES = 200; // keep MVP job cheap; fine for a young network

/**
 * Runs matching for a single newly-activated signal against the pool of
 * other active signals. Creates match rows for anything at/above the
 * "potential" threshold, respecting pair-level deduplication, and queues
 * notification emails for anything at/above "good".
 */
export async function runMatchingForSignal(signalId: string): Promise<{ matchesCreated: number }> {
  const { data: signal, error: signalErr } = await supabase
    .from("signals")
    .select("*")
    .eq("id", signalId)
    .single<Signal>();
  if (signalErr || !signal) throw signalErr ?? new Error("Signal not found");
  if (signal.status !== "active") return { matchesCreated: 0 };

  const { data: candidates, error: candidatesErr } = await supabase
    .from("signals")
    .select("*")
    .eq("status", "active")
    .or("looking_for_active.eq.true,can_offer_active.eq.true")
    .neq("user_id", signal.user_id)
    .neq("id", signal.id)
    .order("created_at", { ascending: false })
    .limit(MAX_CANDIDATES)
    .returns<Signal[]>();
  if (candidatesErr) throw candidatesErr;

  let created = 0;

  for (const candidate of candidates ?? []) {
    const pairKey = [signal.id, candidate.id].sort().join(":");

    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("pair_key", pairKey)
      .maybeSingle();
    if (existing) continue; // already matched this pair — never duplicate

    const result = scoreSignalPair(signal, candidate);
    if (!result.confidence) continue; // below notification threshold

    const token = nanoid(24);
    const { data: match, error: insertErr } = await supabase
      .from("matches")
      .insert({
        signal_a_id: signal.id,
        signal_b_id: candidate.id,
        forward_score: result.forwardScore,
        reverse_score: result.reverseScore,
        location_score: result.locationScore,
        overall_score: result.overallScore,
        match_type: result.matchType,
        confidence: result.confidence,
        explanation: result.explanation,
        token,
        status: "pending",
      })
      .select("*")
      .single();

    if (insertErr) {
      // Unique constraint race — another job created the same pair concurrently. Skip.
      console.warn("Match insert skipped:", insertErr.message);
      continue;
    }

    created += 1;
    await trackEvent("match_generated", null, {
      match_id: match.id,
      confidence: result.confidence,
      match_type: result.matchType,
    });

    if (result.confidence === "strong" || result.confidence === "good") {
      await sendMatchEmails(match, signal, candidate);
    }
  }

  return { matchesCreated: created };
}
