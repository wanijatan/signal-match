import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./utils/env.js";
import { signalsRouter } from "./routes/signals.js";
import { matchesRouter } from "./routes/matches.js";
import { requestsRouter } from "./routes/requests.js";
import { referralsRouter } from "./routes/referrals.js";
import { adminRouter } from "./routes/admin.js";
import { analyticsRouter } from "./routes/analytics.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { cronRouter } from "./routes/cron.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.APP_URL,
      credentials: true,
    })
  );
  app.use(cookieParser());

  // Clerk webhooks need the raw body for signature verification — mount BEFORE express.json().
  app.use("/api/webhooks", express.raw({ type: "application/json" }), webhooksRouter);

  app.use(express.json({ limit: "100kb" }));

  // Global rate limiting (defense in depth). Note: on serverless hosting
  // this in-memory store resets per cold start, so it's a soft backstop,
  // not a hard guarantee — pair with a durable store (e.g. Upstash) if you
  // need strict limits at scale.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10 });
  app.use("/api/signals", submitLimiter);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/signals", signalsRouter);
  app.use("/api/matches", matchesRouter);
  app.use("/api/requests", requestsRouter);
  app.use("/api/referrals", referralsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/cron", cronRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Something went wrong." });
  });

  return app;
}
