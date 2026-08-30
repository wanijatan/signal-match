import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../lib/api";

const STATUSES = ["", "pending_moderation", "active", "paused", "flagged", "deleted"];

export default function Signals() {
  const { getToken } = useAuth();
  const [signals, setSignals] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.admin
      .signals(getToken, { query: query || undefined, status: status || undefined })
      .then((r) => setSignals(r.signals))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status]);

  async function updateStatus(id: string, newStatus: string) {
    await api.admin.patchSignal(id, { status: newStatus }, getToken);
    load();
  }

  async function triggerMatch(id: string) {
    await api.admin.triggerMatch(id, getToken);
    alert("Matching re-run for this signal.");
  }

  async function sendFollowUp(id: string) {
    const message = prompt("Message to send this person (they'll get it as an email):");
    if (!message) return;
    try {
      await api.admin.nudgeSignal(id, message, getToken);
      alert("Follow-up sent.");
    } catch (err: any) {
      alert(err.message ?? "Could not send the follow-up.");
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Signals</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <input
          placeholder="Search by keyword…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="rounded-full border border-hairline bg-white px-4 py-2 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-full border border-hairline bg-white px-4 py-2 text-sm">
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
        <button onClick={load} className="btn-secondary !px-4 !py-2 text-sm">Search</button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl2 border border-hairline bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-paper text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Looking for</th>
              <th className="px-4 py-3">Can offer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-6 text-muted" colSpan={5}>Loading…</td></tr>}
            {!loading && signals.length === 0 && <tr><td className="px-4 py-6 text-muted" colSpan={5}>No signals found.</td></tr>}
            {signals.map((s) => (
              <tr key={s.id} className="border-b border-hairline last:border-0">
                <td className="px-4 py-3">{s.user?.email}</td>
                <td className="max-w-xs truncate px-4 py-3">{s.looking_for}</td>
                <td className="max-w-xs truncate px-4 py-3">{s.can_offer}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-signal/10 px-2 py-1 text-xs font-medium text-signal">{s.status}</span>
                </td>
                <td className="space-x-2 px-4 py-3">
                  <button onClick={() => triggerMatch(s.id)} className="text-xs text-signal hover:underline">Match</button>
                  <button onClick={() => sendFollowUp(s.id)} className="text-xs text-signal hover:underline">Follow up</button>
                  <button onClick={() => updateStatus(s.id, "suspended" === s.status ? "active" : "paused")} className="text-xs text-muted hover:underline">Suspend</button>
                  <button onClick={() => updateStatus(s.id, "flagged")} className="text-xs text-muted hover:underline">Spam</button>
                  <button onClick={() => updateStatus(s.id, "deleted")} className="text-xs text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
