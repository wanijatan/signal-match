import { sendEmail } from "../services/email.js";
import { supabase } from "../services/supabase.js";
import { emailLayout, button } from "./templates/layout.js";
import { env } from "../utils/env.js";
import type { Match, Signal } from "../types/index.js";

async function getUserEmail(userId: string): Promise<string | null> {
  const { data } = await supabase.from("users").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendVerificationReceivedEmail(userId: string, email: string) {
  const html = emailLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;">You're in.</h2>
    <p>Your signal is now active. We'll email you the moment we find someone relevant — no need to check back.</p>
  `);
  await sendEmail({ to: email, subject: "Your signal is live", html, type: "signal_received", userId });
}

/**
 * Sends the pair of match emails: one to each side of the match, each
 * seeing only what the OTHER person offers/needs — never their email.
 */
export async function sendMatchEmails(match: Match, signalA: Signal, signalB: Signal) {
  const emailA = await getUserEmail(signalA.user_id);
  const emailB = await getUserEmail(signalB.user_id);
  const matchUrl = `${env.APP_URL}/match/${match.token}`;

  if (emailA) {
    const html = emailLayout(`
      <h2 style="margin:0 0 12px;font-size:20px;">We found someone you should meet.</h2>
      <p>We found a potential match based on what you're looking for and what they can offer.</p>
      <p style="margin-top:20px;"><strong>You're looking for</strong><br/>${escapeHtml(signalA.looking_for)}</p>
      <p style="margin-top:12px;"><strong>They can help with</strong><br/>${escapeHtml(signalB.can_offer)}</p>
      <p style="margin-top:16px;">We think there may be a relevant connection.</p>
      ${button("View the match →", matchUrl)}
      <p style="margin-top:20px;color:#8A8D96;font-size:13px;">You can decide whether you'd like to connect.</p>
    `);
    await sendEmail({
      to: emailA,
      subject: "We found someone you should meet.",
      html,
      type: `${match.confidence}_match`,
      userId: signalA.user_id,
    });
  }

  if (emailB) {
    const html = emailLayout(`
      <h2 style="margin:0 0 12px;font-size:20px;">Someone is looking for what you can offer.</h2>
      <p>Someone in the Signal network is looking for something you may be able to help with.</p>
      <p style="margin-top:20px;"><strong>They're looking for</strong><br/>${escapeHtml(signalA.looking_for)}</p>
      <p style="margin-top:12px;"><strong>You can offer</strong><br/>${escapeHtml(signalB.can_offer)}</p>
      ${button("View the potential match →", matchUrl)}
    `);
    await sendEmail({
      to: emailB,
      subject: "Someone is looking for what you can offer.",
      html,
      type: `${match.confidence}_match`,
      userId: signalB.user_id,
    });
  }
}

export async function sendSomeoneInterestedEmail(userId: string, matchToken: string) {
  const email = await getUserEmail(userId);
  if (!email) return;
  const html = emailLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;">Someone's interested.</h2>
    <p>The other person in your match said they'd like to connect. If you're interested too, we'll unlock the connection.</p>
    ${button("View the match →", `${env.APP_URL}/match/${matchToken}`)}
  `);
  await sendEmail({ to: email, subject: "Someone's interested in connecting", html, type: "someone_interested", userId });
}

export async function sendMutualMatchEmails(match: Match, signalA: Signal, signalB: Signal) {
  const emailA = await getUserEmail(signalA.user_id);
  const emailB = await getUserEmail(signalB.user_id);
  const matchUrl = `${env.APP_URL}/match/${match.token}`;
  const html = emailLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;">Connection unlocked 🎯</h2>
    <p>You both expressed interest. Time to continue the conversation.</p>
    ${button("Continue on RightSignal →", `${env.RIGHTSIGNAL_URL}/signup?ref=signal_match&match_id=${match.id}`)}
    <p style="margin-top:16px;"><a href="${matchUrl}" style="color:#2F5EFF;">Or exchange emails instead →</a></p>
  `);
  for (const to of [emailA, emailB].filter(Boolean) as string[]) {
    await sendEmail({ to, subject: "Connection unlocked 🎯", html, type: "mutual_match" });
  }
}

export async function sendRequestForwardedEmail(to: string, lookingFor: string, requestToken: string) {
  const html = emailLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;">Someone is looking for:</h2>
    <p style="font-style:italic;">"${escapeHtml(lookingFor)}"</p>
    <p style="margin-top:12px;">Do you know someone who could help?</p>
    ${button("Take a look →", `${env.APP_URL}/request/${requestToken}`)}
  `);
  await sendEmail({ to, subject: "Someone is looking for a connection", html, type: "request_forwarded" });
}

export async function sendAbuseNotification(adminEmail: string, targetId: string, reason: string) {
  if (!adminEmail) return;
  const html = emailLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;">Signal flagged for review</h2>
    <p><strong>Signal ID:</strong> ${escapeHtml(targetId)}</p>
    <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    ${button("Open admin dashboard →", `${env.APP_URL}/admin/signals`)}
  `);
  await sendEmail({ to: adminEmail, subject: "⚠️ Signal flagged for review", html, type: "admin_notification" });
}
