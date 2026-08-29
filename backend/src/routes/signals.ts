import { Router } from "express";
import { z } from "zod";
import { supabase } from "../services/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { normalize } from "../matching/normalize.js";
import { embedText } from "../matching/embeddings.js";
import { moderateText } from "../matching/moderation.js";
import { generateReferralCode } from "../utils/tokens.js";
import { runMatchingForSignal } from "../jobs/matchJob.js";
import { sendVerificationReceivedEmail, sendAbuseNotification } from "../email/send.js";
import { trackEvent } from "../services/analytics.js";
import { env } from "../utils/env.js";

export const signalsRouter = Router();

const submitSchema = z.object({
  lookingFor: z.string().trim().min(10, "Tell us a bit more about what you need.").max(500),
  canOffer: z.string().trim().min(10, "Tell us a bit more about what you can offer.").max(500),
  location: z.string().trim().max(64).optional().default("Global"),
});

/**
 * POST /api/signals
 * Creates or updates the authenticated user's single active signal, then
 * kicks off matching in the background. Rejects if moderation blocks the
 * content outright; flags (but still creates) borderline content for
 * admin review.
 */
signalsRouter.post("/", requireAuth, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  const { lookingFor, canOffer, location } = parsed.data;
  const { databaseUserId } = req.authenticatedUser!;

  const verdict = moderateText(lookingFor, canOffer);
  if (verdict === "rejected") {
    return res.status(422).json({
      error: "We couldn't accept this signal — it looks like it may violate our content guidelines.",
    });
  }

  const normLooking = normalize(lookingFor);
  const normOffer = normalize(canOffer);
  const [lookingEmbedding, offerEmbedding] = await Promise.all([
    embedText(lookingFor),
    embedText(canOffer),
  ]);

  // Basic anti-spam: cap total signals a single account has ever created.
  const { count } = await supabase
    .from("signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", databaseUserId);
  if ((count ?? 0) > 25) {
    return res.status(429).json({ error: "You've reached the maximum number of signals for this account." });
  }

  // One active signal per user — find existing non-deleted signal and update it,
  // otherwise insert a new one. (Matches the unique partial index in the DB.)
  const { data: existing } = await supabase
    .from("signals")
    .select("id")
    .eq("user_id", databaseUserId)
    .in("status", ["pending_moderation", "active", "paused", "flagged"])
    .maybeSingle();

  const payload = {
    user_id: databaseUserId,
    looking_for: lookingFor,
    can_offer: canOffer,
    location: location || "Global",
    normalized_looking_for: normLooking.normalizedText,
    normalized_can_offer: normOffer.normalizedText,
    looking_embedding: lookingEmbedding,
    offer_embedding: offerEmbedding,
    status: verdict === "flagged" ? "flagged" : "active",
    moderation_status: verdict,
    referral_code: generateReferralCode(),
    // Any create/update — including edits made from "My Signal" after
    // logging back in — renews both timers from now. Requests stay
    // matchable for 30 days, offers for 90.
    looking_for_expires_at: new Date(Date.now() + env.LOOKING_FOR_RETENTION_DAYS * 86400000).toISOString(),
    can_offer_expires_at: new Date(Date.now() + env.CAN_OFFER_RETENTION_DAYS * 86400000).toISOString(),
    looking_for_active: true,
    can_offer_active: true,
  };

  const { data: signal, error } = existing
    ? await supabase.from("signals").update(payload).eq("id", existing.id).select("*").single()
    : await supabase.from("signals").insert(payload).select("*").single();

  if (error) {
    console.error("Signal upsert failed:", error);
    return res.status(500).json({ error: "Could not save your signal. Please try again." });
  }

  await trackEvent("signal_created", databaseUserId, { signal_id: signal.id, moderation: verdict });

  if (verdict === "flagged" && env.ADMIN_EMAIL) {
    await sendAbuseNotification(env.ADMIN_EMAIL, signal.id, "Automated moderation flagged this content for review.");
  }

  if (signal.status === "active") {
    if (!existing) await sendVerificationReceivedEmail(databaseUserId, req.authenticatedUser!.email);
    // Awaited (not fire-and-forget): on serverless hosting (Vercel), work
    // queued after the response is sent is not guaranteed to finish, so
    // matching must complete before we respond.
    await runMatchingForSignal(signal.id).catch((err) => console.error("Matching job failed:", err));
  }

  return res.status(201).json({ signal });
});

/** GET /api/signals/status — the caller's current signal, if any. */
signalsRouter.get("/status", requireAuth, async (req, res) => {
  const { databaseUserId } = req.authenticatedUser!;
  const { data: signal, error } = await supabase
    .from("signals")
    .select("*")
    .eq("user_id", databaseUserId)
    .in("status", ["pending_moderation", "active", "paused", "flagged"])
    .maybeSingle();
  if (error) return res.status(500).json({ error: "Could not load your signal." });
  return res.json({ signal: signal ?? null });
});

/**
 * POST /api/signals/renew — resets both expiry timers to their full
 * window without requiring the person to retype anything. Surfaced as a
 * "Keep my signal active" button in the My Signal dashboard.
 */
signalsRouter.post("/renew", requireAuth, async (req, res) => {
  const { databaseUserId } = req.authenticatedUser!;
  const { data: signal } = await supabase
    .from("signals")
    .select("id")
    .eq("user_id", databaseUserId)
    .in("status", ["active", "flagged", "paused"])
    .maybeSingle();
  if (!signal) return res.status(404).json({ error: "You don't have an active signal to renew." });

  const { data: updated, error } = await supabase
    .from("signals")
    .update({
      looking_for_expires_at: new Date(Date.now() + env.LOOKING_FOR_RETENTION_DAYS * 86400000).toISOString(),
      can_offer_expires_at: new Date(Date.now() + env.CAN_OFFER_RETENTION_DAYS * 86400000).toISOString(),
      looking_for_active: true,
      can_offer_active: true,
      status: "active",
    })
    .eq("id", signal.id)
    .select("*")
    .single();
  if (error) return res.status(500).json({ error: "Could not renew your signal." });

  await trackEvent("signal_renewed", databaseUserId, { signal_id: signal.id });
  return res.json({ signal: updated });
});

/** DELETE /api/signals/me — "Delete my Signal" (soft delete + cancel pending matches). */
signalsRouter.delete("/me", requireAuth, async (req, res) => {
  const { databaseUserId } = req.authenticatedUser!;
  const { data: signal } = await supabase
    .from("signals")
    .select("id")
    .eq("user_id", databaseUserId)
    .in("status", ["pending_moderation", "active", "paused", "flagged"])
    .maybeSingle();

  if (!signal) return res.json({ deleted: false });

  await supabase.from("signals").update({ status: "deleted" }).eq("id", signal.id);
  await supabase
    .from("matches")
    .update({ status: "expired" })
    .or(`signal_a_id.eq.${signal.id},signal_b_id.eq.${signal.id}`)
    .eq("status", "pending");

  await trackEvent("signal_deleted", databaseUserId, { signal_id: signal.id });
  return res.json({ deleted: true });
});
