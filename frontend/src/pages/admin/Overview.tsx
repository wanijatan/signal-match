import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../lib/api";

const CARDS: { key: string; label: string }[] = [
  { key: "totalSignals", label: "Total signals" },
  { key: "verifiedSignals", label: "Active signals" },
  { key: "matches", label: "Matches" },
  { key: "strongMatches", label: "Strong matches" },
  { key: "mutualInterests", label: "Mutual interests" },
  { key: "referrals", label: "RightSignal referrals" },
  { key: "matchRate", label: "Match rate (%)" },
  { key: "mutualInterestRate", label: "Mutual interest rate (%)" },
  { key: "emailsSent", label: "Emails sent" },
];

const EVENT_LABELS: Record<string, string> = {
  landing_view: "Landing page visits",
  cta_clicked: "CTA clicks",
  form_started: "Signal form started",
  email_entered: "Email entered",
  verification_requested: "Verification requested",
  email_verified: "Email verified",
  signal_created: "Signals created",
  signal_renewed: "Signals renewed",
  signal_deleted: "Signals deleted",
  match_generated: "Matches generated",
  match_viewed: "Matches viewed",
  interest_clicked: "Interest clicked",
  mutual_match: "Mutual matches",
  rightsignal_clicked: "RightSignal clicks",
  request_shared: "Pass-it-on links shared",
  request_forwarded: "Pass-it-on responses",
};

export default function Overview() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    api.admin.stats(getToken).then(setStats).catch(console.error);
    api.admin.analytics(getToken).then(setAnalytics).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Overview</h1>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-6">
          <p className="text-sm text-muted">Total users</p>
          <p className="mt-2 font-display text-3xl font-semibold">
            {analytics ? analytics.totalUsers : "…"}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-muted">Visitors (30 days)</p>
          <p className="mt-2 font-display text-3xl font-semibold">
            {analytics ? analytics.landingViews30d : "…"}
          </p>
        </div>
        {CARDS.map((c) => (
          <div key={c.key} className="card p-6">
            <p className="text-sm text-muted">{c.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">
              {stats ? stats[c.key] ?? "—" : "…"}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 font-display text-xl font-semibold">Activity — last 30 days</h2>
      <p className="mt-1 text-sm text-muted">Every action people took, most recent window.</p>
      <div className="mt-4 overflow-hidden rounded-xl2 border border-hairline bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-paper text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Count</th>
            </tr>
          </thead>
          <tbody>
            {!analytics && (
              <tr><td className="px-4 py-6 text-muted" colSpan={2}>Loading…</td></tr>
            )}
            {analytics && Object.keys(analytics.breakdown).length === 0 && (
              <tr><td className="px-4 py-6 text-muted" colSpan={2}>No activity yet.</td></tr>
            )}
            {analytics &&
              Object.entries(analytics.breakdown as Record<string, number>)
                .sort((a, b) => b[1] - a[1])
                .map(([event, count]) => (
                  <tr key={event} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3">{EVENT_LABELS[event] ?? event}</td>
                    <td className="px-4 py-3 font-mono">{count}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
