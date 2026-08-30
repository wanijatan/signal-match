import { Router } from "express";
import { z } from "zod";
import { supabase } from "../services/supabase.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { runMatchingForSignal } from "../jobs/matchJob.js";
import { nanoid } from "nanoid";
import { sendMatchEmails, sendAdminFollowUpEmail } from "../email/send.js";
import type { Signal } from "../types/index.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

/** GET /api/admin/stats — overview numbers for the dashboard. */
adminRouter.get("/stats", async (_req, res) => {
  const count = (q: any) => q.then(({ count }: any) => count ?? 0);

  const [
    totalSignals,
    verifiedSignals,
    matches,
    strongMatches,
    mutualInterests,
    referrals,
    emailsSent,
  ] = await Promise.all([
    count(supabase.from("signals").select("id", { count: "exact", head: true })),
    count(supabase.from("signals").select("id", { count: "exact", head: true }).eq("status", "active")),
    count(supabase.from("matches").select("id", { count: "exact", head: true })),
    count(supabase.from("matches").select("id", { count: "exact", head: true }).eq("confidence", "strong")),
    count(supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "mutual")),
    count(supabase.from("referrals").select("id", { count: "exact", head: true }).eq("rightsignal_clicked", true)),
    count(supabase.from("email_events").select("id", { count: "exact", head: true }).eq("status", "sent")),
  ]);

  const matchRate = verifiedSignals > 0 ? Math.round((matches / verifiedSignals) * 100) : 0;
  const mutualRate = matches > 0 ? Math.round((mutualInterests / matches) * 100) : 0;

  res.json({
    totalSignals,
    verifiedSignals,
    matches,
    strongMatches,
    mutualInterests,
    referrals,
    emailsSent,
    matchRate,
    mutualInterestRate: mutualRate,
  });
});

/** GET /api/admin/signals?query=&status= */
adminRouter.get("/signals", async (req, res) => {
  const { query, status } = req.query as { query?: string; status?: string };
  let q = supabase.from("signals").select("*, user:users(email)").order("created_at", { ascending: false }).limit(100);
  if (status) q = q.eq("status", status);
  if (query) q = q.or(`looking_for.ilike.%${query}%,can_offer.ilike.%${query}%`);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ signals: data });
});

const patchSignalSchema = z.object({
  status: z.enum(["pending_moderation", "active", "paused", "flagged", "deleted"]).optional(),
  moderation_status: z.enum(["pending", "approved", "flagged", "rejected"]).optional(),
});

/** PATCH /api/admin/signals/:id — suspend / mark spam / restore. */
adminRouter.patch("/signals/:id", async (req, res) => {
  const parsed = patchSignalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid update." });
  const { data, error } = await supabase
    .from("signals")
    .update(parsed.data)
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ signal: data });
});

/** POST /api/admin/signals/:id/trigger-match — manually re-run matching. */
adminRouter.post("/signals/:id/trigger-match", async (req, res) => {
  try {
    const result = await runMatchingForSignal(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/matches?status= */
adminRouter.get("/matches", async (req, res) => {
  const { status } = req.query as { status?: string };
  let q = supabase.from("matches").select("*").order("created_at", { ascending: false }).limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ matches: data });
});

const patchMatchSchema = z.object({
  status: z
    .enum(["pending", "viewed", "interested_a", "interested_b", "mutual", "rejected", "expired"])
    .optional(),
  explanation: z.string().max(500).optional(),
});

/** PATCH /api/admin/matches/:id */
adminRouter.patch("/matches/:id", async (req, res) => {
  const parsed = patchMatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid update." });
  const { data, error } = await supabase
    .from("matches")
    .update(parsed.data)
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ match: data });
});

const manualMatchSchema = z.object({
  signalAId: z.string().uuid(),
  signalBId: z.string().uuid(),
  explanation: z.string().min(5).max(500),
  sendEmails: z.boolean().default(true),
});

/** POST /api/admin/matches/manual — admin-created match for beta testing. */
adminRouter.post("/matches/manual", async (req, res) => {
  const parsed = manualMatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { signalAId, signalBId, explanation, sendEmails } = parsed.data;

  const { data: signals } = await supabase
    .from("signals")
    .select("*")
    .in("id", [signalAId, signalBId])
    .returns<Signal[]>();
  if (!signals || signals.length !== 2) return res.status(404).json({ error: "One or both signals not found." });
  const signalA = signals.find((s) => s.id === signalAId)!;
  const signalB = signals.find((s) => s.id === signalBId)!;

  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      signal_a_id: signalAId,
      signal_b_id: signalBId,
      forward_score: 100,
      reverse_score: 100,
      location_score: 100,
      overall_score: 100,
      match_type: "direct",
      confidence: "strong",
      explanation,
      token: nanoid(24),
      status: "pending",
    })
    .select("*")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  if (sendEmails) await sendMatchEmails(match, signalA, signalB);
  res.status(201).json({ match });
});

/** GET /api/admin/reports — moderation queue */
adminRouter.get("/reports", async (_req, res) => {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ reports: data });
});

/**
 * GET /api/admin/analytics — activity breakdown for the last 30 days:
 * event counts by type (the funnel from landing view through mutual
 * match), plus distinct visitor/user approximations. "Visitors" counts
 * distinct anonymous+authenticated actors who fired a landing_view;
 * "users" counts everyone who ever created a signal.
 */
adminRouter.get("/analytics", async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: events, error } = await supabase
    .from("analytics_events")
    .select("event_name, user_id, created_at")
    .gte("created_at", since);
  if (error) return res.status(500).json({ error: error.message });

  const breakdown: Record<string, number> = {};
  const landingUserIds = new Set<string>();
  for (const e of events ?? []) {
    breakdown[e.event_name] = (breakdown[e.event_name] ?? 0) + 1;
    if (e.event_name === "landing_view" && e.user_id) landingUserIds.add(e.user_id);
  }

  const { count: totalUsers } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true });

  res.json({
    since,
    breakdown, // e.g. { landing_view: 42, cta_clicked: 18, signal_created: 6, ... }
    totalUsers: totalUsers ?? 0,
    landingViews30d: breakdown["landing_view"] ?? 0,
  });
});

const nudgeSchema = z.object({
  message: z.string().min(5).max(1000),
});

/**
 * POST /api/admin/signals/:id/nudge — sends the signal's owner a manual
 * follow-up email drafted from the admin dashboard.
 */
adminRouter.post("/signals/:id/nudge", async (req, res) => {
  const parsed = nudgeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Write a message to send." });

  const { data: signal } = await supabase
    .from("signals")
    .select("user_id")
    .eq("id", req.params.id)
    .maybeSingle();
  if (!signal) return res.status(404).json({ error: "Signal not found." });

  const { data: user } = await supabase.from("users").select("email").eq("id", signal.user_id).maybeSingle();
  if (!user?.email) return res.status(404).json({ error: "Could not find that user's email." });

  await sendAdminFollowUpEmail(signal.user_id, user.email, parsed.data.message);
  res.json({ sent: true });
});
