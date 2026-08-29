import { Router } from "express";
import { supabase } from "../services/supabase.js";
import { trackEvent } from "../services/analytics.js";

export const referralsRouter = Router();

/** GET /api/referrals/:code — resolve a referral code (used to build the RightSignal handoff URL). */
referralsRouter.get("/:code", async (req, res) => {
  const { data: signal } = await supabase
    .from("signals")
    .select("id, user_id")
    .eq("referral_code", req.params.code)
    .maybeSingle();
  if (!signal) return res.status(404).json({ error: "Unknown referral code." });
  return res.json({ referralCode: req.params.code, signalId: signal.id });
});

/** POST /api/referrals/:code/click — track a RightSignal click for attribution. */
referralsRouter.post("/:code/click", async (req, res) => {
  const { matchId } = req.body ?? {};
  const { data: signal } = await supabase
    .from("signals")
    .select("id, user_id")
    .eq("referral_code", req.params.code)
    .maybeSingle();

  await supabase.from("referrals").insert({
    match_id: matchId ?? null,
    user_id: signal?.user_id ?? null,
    source: "signal_match",
    referral_code: req.params.code,
    rightsignal_clicked: true,
  });
  await trackEvent("rightsignal_clicked", signal?.user_id ?? null, { referral_code: req.params.code });
  return res.json({ ok: true });
});
