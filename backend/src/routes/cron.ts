import { Router } from "express";
import { supabase } from "../services/supabase.js";
import { env } from "../utils/env.js";
import { sendRightSignalPromoEmail } from "../email/send.js";

export const cronRouter = Router();
/**
 * GET /api/cron/expire-signals
 * Invoked daily by Vercel Cron (see vercel.json). Vercel automatically
 * sends "Authorization: Bearer {CRON_SECRET}" when CRON_SECRET is set as
 * a project env var, which we verify here so this can't be triggered by
 * anyone else hitting the URL.
 *
 * A request ("looking for") lapses after LOOKING_FOR_RETENTION_DAYS; an
 * offer ("can offer") lapses after the longer CAN_OFFER_RETENTION_DAYS.
 * A signal is only fully retired (status -> "expired", dropped from the
 * matching pool) once BOTH halves have lapsed — the person can still be
 * found by others via login and can renew directly, no need to resubmit.
 */
cronRouter.get("/expire-signals", async (req, res) => {
  if (env.CRON_SECRET) {
    const header = req.headers.authorization;
    if (header !== `Bearer ${env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized." });
    }
  }

  const now = new Date().toISOString();

  const { data: expiredLooking } = await supabase
    .from("signals")
    .update({ looking_for_active: false })
    .eq("looking_for_active", true)
    .lt("looking_for_expires_at", now)
    .select("id");

  const { data: expiredOffer } = await supabase
    .from("signals")
    .update({ can_offer_active: false })
    .eq("can_offer_active", true)
    .lt("can_offer_expires_at", now)
    .select("id");

  const { data: retired } = await supabase
    .from("signals")
    .update({ status: "expired" })
    .eq("status", "active")
    .eq("looking_for_active", false)
    .eq("can_offer_active", false)
    .select("id");

  res.json({
    lookingForExpired: expiredLooking?.length ?? 0,
    canOfferExpired: expiredOffer?.length ?? 0,
    fullyRetired: retired?.length ?? 0,
  });
});

const PROMO_COOLDOWN_DAYS = 7;
const PROMO_MIN_SIGNAL_AGE_DAYS = 2; // don't nudge same-day — give the match engine a chance first

/**
 * GET /api/cron/promo-followup
 * Marketing nudge: anyone with an active signal who hasn't clicked through
 * to RightSignal yet gets a reminder email, at most once every 7 days,
 * starting 2 days after their signal went live. Same auth pattern as the
 * expiry cron (CRON_SECRET bearer token, sent automatically by Vercel).
 */
cronRouter.get("/promo-followup", async (req, res) => {
  if (env.CRON_SECRET) {
    const header = req.headers.authorization;
    if (header !== `Bearer ${env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized." });
    }
  }

  const minAge = new Date(Date.now() - PROMO_MIN_SIGNAL_AGE_DAYS * 86400000).toISOString();
  const cooldownCutoff = new Date(Date.now() - PROMO_COOLDOWN_DAYS * 86400000).toISOString();

  // Candidates: active signals old enough to nudge.
  const { data: signals, error: signalsErr } = await supabase
    .from("signals")
    .select("id, user_id, referral_code, created_at")
    .eq("status", "active")
    .lte("created_at", minAge);
  if (signalsErr) return res.status(500).json({ error: signalsErr.message });
  if (!signals || signals.length === 0) return res.json({ sent: 0 });

  const userIds = signals.map((s) => s.user_id);

  // Exclude anyone who already clicked through to RightSignal.
  const { data: clicked } = await supabase
    .from("referrals")
    .select("user_id")
    .eq("rightsignal_clicked", true)
    .in("user_id", userIds);
  const clickedIds = new Set((clicked ?? []).map((r) =>
