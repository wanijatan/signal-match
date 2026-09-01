import { Resend } from "resend";
import nodemailer from "nodemailer";
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

// Fallback transport: Gmail SMTP via an App Password. Works immediately
// with zero domain/DNS verification — useful while a real sending domain
// is still propagating in Resend, or as a permanent low-volume option.
const gmailTransport =
  env.GMAIL_USER && env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
      })
    : null;

/** Extracts a plain "you@domain.com" from a "Name <you@domain.com>" style string. */
function extractAddress(fromHeader: string): string {
  const match = fromHeader.match(/<(.+)>/);
  return match ? match[1] : fromHeader;
}

async function sendViaResend(to: string, subject: string, html: string): Promise<string> {
  if (!resend) throw new Error("Resend not configured");
  const result = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html });
  // Resend's SDK often returns { error: {...} } WITHOUT throwing (e.g. an
  // unverified domain) — checking only `.data` here previously let failed
  // sends get logged as "sent". Must check `.error` explicitly.
  if (result.error) {
    throw new Error(`Resend error: ${result.error.message ?? JSON.stringify(result.error)}`);
  }
  return result.data?.id ?? "";
}

async function sendViaGmail(to: string, subject: string, html: string): Promise<string> {
  if (!gmailTransport) throw new Error("Gmail SMTP not configured");
  const info = await gmailTransport.sendMail({
    from: `"Signal by RightSignal" <${env.GMAIL_USER}>`,
    to,
    subject,
    html,
    replyTo: extractAddress(env.EMAIL_FROM),
  });
  return info.messageId ?? "";
}

export async function sendEmail({ to, subject, html, type, userId = null }: SendArgs): Promise<void> {
  let providerId: string | null = null;
  let status: "sent" | "failed" = "sent";
  let lastError: unknown = null;

  if (resend) {
    try {
      providerId = await sendViaResend(to, subject, html);
    } catch (err) {
      console.error("Resend send failed, trying Gmail fallback if configured:", err);
      lastError = err;
      if (gmailTransport) {
        try {
          providerId = await sendViaGmail(to, subject, html);
          lastError = null;
        } catch (gmailErr) {
          console.error("Gmail fallback also failed:", gmailErr);
          lastError = gmailErr;
        }
      }
    }
  } else if (gmailTransport) {
    try {
      providerId = await sendViaGmail(to, subject, html);
    } catch (err) {
      console.error("Gmail send failed:", err);
      lastError = err;
    }
  } else {
    // No provider configured at all — log instead of throwing, so local/dev
    // flows keep working without any email credentials.
    console.log(`[email:dev-mode] would send "${subject}" to ${to}`);
  }

  if (lastError) status = "failed";

  await supabase.from("email_events").insert({
    user_id: userId,
    type,
    provider_id: providerId,
    status,
  });
}
