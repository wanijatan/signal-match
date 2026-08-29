import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8080),

  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_WEBHOOK_SECRET: z.string().min(1, "CLERK_WEBHOOK_SECRET is required"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  AI_MATCHING_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  OPENAI_API_KEY: z.string().optional().default(""),

  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("Signal <signal@example.com>"),

  APP_URL: z.string().url().default("http://localhost:5173"),
  API_URL: z.string().url().default("http://localhost:8080"),
  RIGHTSIGNAL_URL: z.string().url().default("https://rightsignal.social"),

  ADMIN_EMAIL: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),

  LOOKING_FOR_RETENTION_DAYS: z.coerce.number().default(30),
  CAN_OFFER_RETENTION_DAYS: z.coerce.number().default(90),

  MATCH_THRESHOLD_STRONG: z.coerce.number().default(85),
  MATCH_THRESHOLD_GOOD: z.coerce.number().default(70),
  MATCH_THRESHOLD_POTENTIAL: z.coerce.number().default(55),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. Check backend/.env against .env.example.");
}

export const env = parsed.data;
