import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../lib/api";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Strong", value: "strong" },
  { label: "Good", value: "good" },
  { label: "Potential", value: "potential" },
  { label: "Mutual", value: "mutual" },
  { label: "Rejected", value: "rejected" },
  { label: "Pending", value: "pending" },
];

export default function Matches() {
  const { getToken } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const isConfidence = ["strong", "good", "potential"].includes(filter);
    api.admin
      .matches(getToken, isConfidence ? undefined : filter || undefined)
      .then((r) => setMatches(isConfidence ? r.matches.filter((m) => m.confidence === filter) : r.matches))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Matches</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              filter === f.value ? "border-ink bg-ink text-white" : "border-hairline bg-white text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl2 border border-hairline bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-paper text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-6 text-muted" colSpan={5}>Loading…</td></tr>}
            {!loading && matches.length === 0 && <tr><td className="px-4 py-6 text-muted" colSpan={5}>No matches found.</td></tr>}
            {matches.map((m) => (
              <tr key={m.id} className="border-b border-hairline last:border-0">
                <td className="px-4 py-3 font-mono">{m.overall_score}</td>
                <td className="px-4 py-3 capitalize">{m.match_type}</td>
                <td className="px-4 py-3 capitalize">{m.confidence}</td>
                <td className="px-4 py-3 capitalize">{m.status}</td>
                <td className="px-4 py-3 text-muted">{new Date(m.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
