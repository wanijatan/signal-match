import { Resend } from "resend";
import { env } from "../utils/env.js";
import { supabase } from "./supabase.js";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  type: string; // e.g. "strong_match", "mutual_match" — for email_events logging
  userId?: string | null;
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail({ to, subject, html, type, userId = null }: SendArgs): Promise<void> {
  let providerId: string | null = null;
  let status: "sent" | "failed" = "sent";

  try {
    if (resend) {
      const result = await resend.emails.send({
        from: env.EMAIL_FROM,
        to,
        subject,
        html,
      });
      providerId = result.data?.id ?? null;
    } else {
      // No provider configured — log instead of throwing, so local/dev
      // flows keep working without a Resend key.
      console.log(`[email:dev-mode] would send "${subject}" to ${to}`);
    }
  } catch (err) {
    console.error("Email send failed:", err);
    status = "failed";
  }

  await supabase.from("email_events").insert({
    user_id: userId,
    type,
    provider_id: providerId,
    status,
  });
}
