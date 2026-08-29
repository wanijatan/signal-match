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

export default function Overview() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    api.admin.stats(getToken).then(setStats).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Overview</h1>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {CARDS.map((c) => (
          <div key={c.key} className="card p-6">
            <p className="text-sm text-muted">{c.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">
              {stats ? stats[c.key] ?? "—" : "…"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
