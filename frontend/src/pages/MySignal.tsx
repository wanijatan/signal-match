import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useUser, useClerk } from "@clerk/clerk-react";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { api } from "../lib/api";

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export default function MySignal() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  const [loading, setLoading] = useState(true);
  const [signal, setSignal] = useState<any>(null);
  const [lookingFor, setLookingFor] = useState("");
  const [canOffer, setCanOffer] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoaded) return;
    if (!isSignedIn) {
      navigate("/login");
      return;
    }
    api
      .getMySignalStatus(getToken)
      .then(({ signal }) => {
        setSignal(signal);
        setLookingFor(signal?.looking_for ?? "");
        setCanOffer(signal?.can_offer ?? "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userLoaded, isSignedIn]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { signal: updatedSignal } = await api.submitSignal(
        { lookingFor, canOffer, location: signal?.location ?? "Global" },
        getToken
      );
      setSignal(updatedSignal);
      setMessage("Saved. Your matching windows have been renewed.");
    } catch (err: any) {
      setError(err.message ?? "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  }

  async function renew() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { signal } = await api.renewMySignal(getToken);
      setSignal(signal);
      setMessage("Your signal is active for another 30 / 90 days.");
    } catch (err: any) {
      setError(err.message ?? "Could not renew your signal.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete your signal and stop matching? This can't be undone.")) return;
    setSaving(true);
    try {
      await api.deleteMySignal(getToken);
      setSignal(null);
      setMessage("Your signal has been deleted.");
    } catch (err: any) {
      setError(err.message ?? "Could not delete your signal.");
    } finally {
      setSaving(false);
    }
  }

  if (!userLoaded || loading) {
    return (
      <div>
        <Nav />
        <div className="flex justify-center py-24 text-muted">
          <Loader2 className="animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Nav />
      <section className="container-page max-w-lg py-16">
        <h1 className="font-display text-3xl font-semibold">My signal</h1>
        <p className="mt-2 text-sm text-muted">Update what you need or offer anytime — no need to start over.</p>

        {!signal && !loading && (
          <div className="card mt-8 p-8 text-center">
            <p className="text-muted">You don't have an active signal right now.</p>
            <a href="/start" className="btn-primary mt-5 inline-flex">Create a signal</a>
          </div>
        )}

        {signal && (
          <>
            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full border border-hairline bg-white px-3 py-1.5 font-mono text-muted">
                Request active for {daysLeft(signal.looking_for_expires_at)} more days
              </span>
              <span className="rounded-full border border-hairline bg-white px-3 py-1.5 font-mono text-muted">
                Offer active for {daysLeft(signal.can_offer_expires_at)} more days
              </span>
            </div>

            <label className="field-label mt-8 !text-lg">What are you looking for?</label>
            <textarea
              className="textarea-base"
              maxLength={500}
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value)}
            />
            <div className="mt-1 text-right font-mono text-xs text-muted">{lookingFor.length} / 500</div>

            <label className="field-label mt-6 !text-lg">What can you help with?</label>
            <textarea
              className="textarea-base"
              maxLength={500}
              value={canOffer}
              onChange={(e) => setCanOffer(e.target.value)}
            />
            <div className="mt-1 text-right font-mono text-xs text-muted">{canOffer.length} / 500</div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            {message && <p className="mt-4 text-sm text-signal">{message}</p>}

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                Save changes
              </button>
              <button onClick={renew} disabled={saving} className="btn-secondary disabled:opacity-50">
                <RefreshCw size={15} /> Renew without changes
              </button>
            </div>

            <div className="mt-10 border-t border-hairline pt-6">
              <button onClick={remove} disabled={saving} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline">
                <Trash2 size={14} /> Delete my signal
              </button>
            </div>
          </>
        )}

        <button onClick={() => signOut(() => navigate("/"))} className="mt-10 text-sm text-muted hover:text-ink">
          Sign out
        </button>
      </section>
      <Footer />
    </div>
  );
}
