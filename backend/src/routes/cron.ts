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
const PROMO_MIN_SIGNAL_AGE_DAYS = 2;

cronRouter.get("/promo-followup", async (req, res) => {
  if (env.CRON_SECRET) {
    const header = req.headers.authorization;
    if (header !== `Bearer ${env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized." });
    }
  }

  const minAge = new Date(Date.now() - PROMO_MIN_SIGNAL_AGE_DAYS * 86400000).toISOString();
  const cooldownCutoff = new Date(Date.now() - PROMO_COOLDOWN_DAYS * 86400000).toISOString();

  const signalsResult = await supabase
    .from("signals")
    .select("id, user_id, referral_code, created_at")
    .eq("status", "active")
    .lte("created_at", minAge);

  const signals = signalsResult.data;
  const signalsErr = signalsResult.error;

  if (signalsErr) {
    return res.status(500).json({ error: signalsErr.message });
  }
  if (!signals || signals.length === 0) {
    return res.json({ sent: 0 });
  }

  const userIds = [];
  for (let i = 0; i < signals.length; i++) {
    userIds.push(signals[i].user_id);
  }

  const clickedResult = await supabase
    .from("referrals")
    .select("user_id")
    .eq("rightsignal_clicked", true)
    .in("user_id", userIds);

  const clickedIds = new Set();
  const clickedRows = clickedResult.data || [];
  for (let i = 0; i < clickedRows.length; i++) {
    clickedIds.add(clickedRows[i].user_id);
  }

  const recentPromoResult = await supabase
    .from("email_events")
    .select("user_id")
    .eq("type", "rightsignal_promo")
    .gte("created_at", cooldownCutoff)
    .in("user_id", userIds);

  const recentlyPromotedIds = new Set();
  const recentPromoRows = recentPromoResult.data || [];
  for (let i = 0; i < recentPromoRows.length; i++) {
    recentlyPromotedIds.add(recentPromoRows[i].user_id);
  }

  const eligible = [];
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    if (!clickedIds.has(signal.user_id) && !recentlyPromotedIds.has(signal.user_id)) {
      eligible.push(signal);
    }
  }

  let sent = 0;
  for (let i = 0; i < eligible.length; i++) {
    const signal = eligible[i];
    const userResult = await supabase.from("users").select("email").eq("id", signal.user_id).maybeSingle();
    const user = userResult.data;
    if (!user || !user.email) continue;
    await sendRightSignalPromoEmail(signal.user_id, user.email, signal.referral_code || "");
    sent = sent + 1;
  }

  res.json({ sent: sent, candidates: signals.length });
});
