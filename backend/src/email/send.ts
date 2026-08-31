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

export async function sendVerificationReceivedEmail(userId: string, email: string, referralCode: string) {
  const rightSignalUrl = `${env.RIGHTSIGNAL_URL}/signup?ref=signal_match&signal_ref=${referralCode}`;
  const html = emailLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;">🎉 Congratulations — you're in!</h2>
    <p>Your signal is now live and working for you. We'll email you the moment we find someone relevant — no need to check back.</p>
    <p style="margin-top:16px;">Your match is waiting for you on RightSignal — go connect with them.</p>
    ${button("Continue on RightSignal →", rightSignalUrl)}
  `);
  await sendEmail({
    to: email,
    subject: "🎉 You're in — your Signal is live!",
    html,
    type: "signal_received",
    userId,
  });
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
      subject: "🎯 We found your match — take a look",
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
      subject: "👀 Someone needs exactly what you offer",
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
    await sendEmail({ to, subject: "🎯 Connection unlocked — they're waiting", html, type: "mutual_match" });
  }
}

/**
 * Marketing follow-up sent by the promo-followup cron (see routes/cron.ts)
 * to anyone with an active signal who hasn't clicked through to RightSignal
 * yet. Sent at most once every 7 days per person — see the cron job for
 * the eligibility query.
 *
 * Narrative: Signal finds the match; Colab is where the raise actually
 * happens. Each feature is framed as a specific moment in a founder's
 * fundraising journey rather than a generic feature list.
 */
export async function sendRightSignalPromoEmail(userId: string, email: string, referralCode: string) {
  const rightSignalUrl = `${env.RIGHTSIGNAL_URL}/signup?ref=signal_match_promo&signal_ref=${referralCode}`;
  const html = emailLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;">Finding the investor was step one.</h2>
    <p>Signal found you someone worth talking to. What happens next — the pitch, the follow-ups, the data room, the close — is where most raises actually stall. That's what Colab, on RightSignal, is built for.</p>

    <p style="margin-top:20px;"><strong>Investor Rooms.</strong> A private space to pitch directly — no cold email chains, no "just following up" messages lost in someone's inbox.</p>

    <p style="margin-top:14px;"><strong>A CRM built for fundraising.</strong> Every investor conversation tracked in one place — who you've talked to, what they said, who needs a follow-up this week.</p>

    <p style="margin-top:14px;"><strong>Your data room, always ready.</strong> Pitch deck, cap table, financials — organized and shareable the moment an investor asks, not scrambled together at 11pm.</p>

    <p style="margin-top:14px;"><strong>Visible traction.</strong> Task progress and roadmap milestones investors can actually see — momentum is easier to believe than a slide about it.</p>

    <p style="margin-top:14px;"><strong>A team that looks like one.</strong> Bring in co-founders and advisors, assign real roles — investors back teams, not solo decks.</p>

    <p style="margin-top:14px;"><strong>A public presence worth checking out.</strong> A credible business page investors can look at before they even take the call.</p>

    ${button("Explore Colab on RightSignal →", rightSignalUrl)}
    <p style="margin-top:20px;color:#8A8D96;font-size:13px;">This is a one-time reminder — we won't email you about this again for at least a week.</p>
  `);
  await sendEmail({
    to: email,
    subject: "⏳ Finding the investor was the easy part",
    html,
    type: "rightsignal_promo",
    userId,
  });
}

/**
 * Admin-triggered manual follow-up, sent from the admin dashboard to nudge
 * a specific signal's owner (e.g. "haven't heard back", "still looking?").
 */
export async function sendAdminFollowUpEmail(userId: string, email: string, message: string) {
  const html = emailLayout(`
    <h2 style="margin:0 0 12px;font-size:20px;">A quick note from Signal</h2>
    <p style="white-space:pre-wrap;">${message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</p>
    ${button("View my signal →", `${env.APP_URL}/my-signal`)}
  `);
  await sendEmail({ to: email, subject: "A quick note from Signal", html, type: "admin_followup", userId });
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
