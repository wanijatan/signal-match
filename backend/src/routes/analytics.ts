import { Router } from "express";
import { z } from "zod";
import { optionalAuth } from "../middleware/auth.js";
import { trackEvent } from "../services/analytics.js";

export const analyticsRouter = Router();

const ALLOWED_EVENTS = new Set([
  "landing_view",
  "cta_clicked",
  "form_started",
  "email_entered",
  "verification_requested",
  "email_verified",
  "signal_created",
  "match_generated",
  "match_email_sent",
  "match_viewed",
  "interest_clicked",
  "mutual_match",
  "rightsignal_clicked",
  "rightsignal_signup",
  "request_shared",
  "request_forwarded",
]);

const schema = z.object({
  event: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

analyticsRouter.post("/track", optionalAuth, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !ALLOWED_EVENTS.has(parsed.data.event)) {
    return res.status(204).end(); // never break the UI over analytics
  }
  await trackEvent(parsed.data.event, req.authenticatedUser?.databaseUserId ?? null, parsed.data.metadata ?? {});
  res.status(204).end();
});
