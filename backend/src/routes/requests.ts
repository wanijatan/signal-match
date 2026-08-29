import { Router } from "express";
import { z } from "zod";
import { supabase } from "../services/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { generateRequestToken } from "../utils/tokens.js";
import { moderateText } from "../matching/moderation.js";
import { trackEvent } from "../services/analytics.js";

export const requestsRouter = Router();

/** POST /api/requests — create a shareable "pass it on" link for my signal. */
requestsRouter.post("/", requireAuth, async (req, res) => {
  const { databaseUserId } = req.authenticatedUser!;
  const { data: signal } = await supabase
    .from("signals")
    .select("id")
    .eq("user_id", databaseUserId)
    .in("status", ["active", "flagged"])
    .maybeSingle();
  if (!signal) return res.status(404).json({ error: "You don't have an active signal yet." });

  const token = generateRequestToken();
  const { data: request, error } = await supabase
    .from("requests")
    .insert({ signal_id: signal.id, token, forwarded_by_user_id: databaseUserId })
    .select("*")
    .single();
  if (error) return res.status(500).json({ error: "Could not create a shareable link." });

  await trackEvent("request_shared", databaseUserId, { request_id: request.id });
  return res.status(201).json({ token, url: `/request/${token}` });
});

/** GET /api/requests/:token — public view of a forwarded request. */
requestsRouter.get("/:token", async (req, res) => {
  const { data: request } = await supabase
    .from("requests")
    .select("*, signal:signals(looking_for, location)")
    .eq("token", req.params.token)
    .maybeSingle();
  if (!request) return res.status(404).json({ error: "This link isn't valid anymore." });
  return res.json({
    lookingFor: (request as any).signal?.looking_for,
    location: (request as any).signal?.location,
  });
});

const respondSchema = z.object({
  response: z.enum(["know_someone", "might_know", "not_me"]),
  canOffer: z.string().trim().max(500).optional(),
  email: z.string().trim().email().optional(),
});

/** POST /api/requests/:token/respond — someone reacts to a forwarded request. */
requestsRouter.post("/:token/respond", async (req, res) => {
  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid response." });
  const { response, canOffer, email } = parsed.data;

  if (response === "know_someone" && (!canOffer || !email)) {
    return res.status(400).json({ error: "Tell us what you can offer and your email." });
  }
  if (canOffer) {
    const verdict = moderateText(canOffer);
    if (verdict === "rejected") {
      return res.status(422).json({ error: "This doesn't meet our content guidelines." });
    }
  }

  const { data: request } = await supabase
    .from("requests")
    .select("id")
    .eq("token", req.params.token)
    .maybeSingle();
  if (!request) return res.status(404).json({ error: "This link isn't valid anymore." });

  await supabase
    .from("requests")
    .update({ response, responder_can_offer: canOffer ?? null, responder_email: email ?? null })
    .eq("id", request.id);

  await trackEvent("request_forwarded", null, { request_id: request.id, response });
  return res.json({ ok: true });
});
