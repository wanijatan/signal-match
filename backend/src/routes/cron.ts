import { Router } from "express";
import { supabase } from "../services/supabase.js";
import { env } from "../utils/env.js";

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
