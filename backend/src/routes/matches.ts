import { Router } from "express";
import { supabase } from "../services/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { trackEvent } from "../services/analytics.js";
import { sendSomeoneInterestedEmail, sendMutualMatchEmails } from "../email/send.js";
import type { Match, Signal } from "../types/index.js";

export const matchesRouter = Router();

function otherSide(match: Match, signal: Signal) {
  return signal.id === match.signal_a_id ? "b" : "a";
}

/**
 * GET /api/matches/:token — public-by-token view of a match.
 * Never exposes email or other private contact info before mutual interest.
 */
matchesRouter.get("/:token", async (req, res) => {
  const { token } = req.params;
  const { data: match, error } = await supabase
    .from("matches")
    .select("*")
    .eq("token", token)
    .maybeSingle<Match>();
  if (error || !match) return res.status(404).json({ error: "Match not found." });

  const { data: signals } = await supabase
    .from("signals")
    .select("*")
    .in("id", [match.signal_a_id, match.signal_b_id])
    .returns<Signal[]>();

  const signalA = signals?.find((s) => s.id === match.signal_a_id);
  const signalB = signals?.find((s) => s.id === match.signal_b_id);
  if (!signalA || !signalB) return res.status(404).json({ error: "Match not found." });

  if (match.status === "pending") {
    await supabase.from("matches").update({ status: "viewed" }).eq("id", match.id);
    await trackEvent("match_viewed", null, { match_id: match.id });
  }

  const mutual = match.status === "mutual";

  return res.json({
    match: {
      id: match.id,
      token: match.token,
      confidence: match.confidence,
      matchType: match.match_type,
      explanation: match.explanation,
      status: match.status,
      // Two "views" of the same match — the frontend picks based on which
      // authenticated user (if any) is looking, defaulting to side A's view.
      you: { lookingFor: signalA.looking_for, canOffer: signalA.can_offer },
      them: {
        canOffer: signalB.can_offer,
        lookingFor: signalB.looking_for,
        location: signalB.location,
        email: mutual ? undefined : undefined, // never included pre-mutual; see /reveal-email
      },
    },
  });
});

/** POST /api/matches/:id/interest — authenticated user expresses interest. */
matchesRouter.post("/:id/interest", requireAuth, async (req, res) => {
  const { databaseUserId } = req.authenticatedUser!;
  const { id } = req.params;

  const { data: match, error } = await supabase.from("matches").select("*").eq("id", id).maybeSingle<Match>();
  if (error || !match) return res.status(404).json({ error: "Match not found." });

  const { data: signals } = await supabase
    .from("signals")
    .select("*")
    .in("id", [match.signal_a_id, match.signal_b_id])
    .returns<Signal[]>();
  const mySignal = signals?.find((s) => s.user_id === databaseUserId);
  if (!mySignal) return res.status(403).json({ error: "You are not part of this match." });

  await supabase
    .from("interests")
    .upsert({ match_id: match.id, user_id: databaseUserId, interested: true }, { onConflict: "match_id,user_id" });

  const side = otherSide(match, mySignal);
  const newStatus = side === "b" ? "interested_a" : "interested_b";

  const alreadyOtherInterested =
    (side === "b" && match.status === "interested_b") || (side === "a" && match.status === "interested_a");

  if (alreadyOtherInterested) {
    await supabase.from("matches").update({ status: "mutual" }).eq("id", match.id);
    const signalA = signals!.find((s) => s.id === match.signal_a_id)!;
    const signalB = signals!.find((s) => s.id === match.signal_b_id)!;
    await sendMutualMatchEmails(match, signalA, signalB);
    await trackEvent("mutual_match", null, { match_id: match.id });
    return res.json({ status: "mutual" });
  }

  if (match.status === "pending" || match.status === "viewed") {
    await supabase.from("matches").update({ status: newStatus }).eq("id", match.id);
    const otherUserId = signals!.find((s) => s.id !== mySignal.id)!.user_id;
    await sendSomeoneInterestedEmail(otherUserId, match.token);
  }

  await trackEvent("interest_clicked", databaseUserId, { match_id: match.id });
  return res.json({ status: "waiting_on_other_side" });
});

/** POST /api/matches/:id/reject — mark not relevant. */
matchesRouter.post("/:id/reject", requireAuth, async (req, res) => {
  const { databaseUserId } = req.authenticatedUser!;
  const { id } = req.params;
  const { data: match } = await supabase.from("matches").select("*").eq("id", id).maybeSingle<Match>();
  if (!match) return res.status(404).json({ error: "Match not found." });

  await supabase
    .from("interests")
    .upsert({ match_id: match.id, user_id: databaseUserId, interested: false }, { onConflict: "match_id,user_id" });
  await supabase.from("matches").update({ status: "rejected" }).eq("id", match.id);
  await trackEvent("match_rejected", databaseUserId, { match_id: match.id });
  return res.json({ status: "rejected" });
});

/**
 * GET /api/matches/:id/reveal-email — only returns data once status is "mutual",
 * and only to a participant of the match.
 */
matchesRouter.get("/:id/reveal-email", requireAuth, async (req, res) => {
  const { databaseUserId } = req.authenticatedUser!;
  const { id } = req.params;
  const { data: match } = await supabase.from("matches").select("*").eq("id", id).maybeSingle<Match>();
  if (!match || match.status !== "mutual") {
    return res.status(403).json({ error: "Emails are only shared after mutual interest." });
  }
  const { data: signals } = await supabase
    .from("signals")
    .select("*")
    .in("id", [match.signal_a_id, match.signal_b_id])
    .returns<Signal[]>();
  const mySignal = signals?.find((s) => s.user_id === databaseUserId);
  if (!mySignal) return res.status(403).json({ error: "You are not part of this match." });
  const otherSignal = signals!.find((s) => s.id !== mySignal.id)!;
  const { data: otherUser } = await supabase.from("users").select("email").eq("id", otherSignal.user_id).single();
  return res.json({ email: otherUser?.email });
});
