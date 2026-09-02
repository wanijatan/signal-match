import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth, useUser, SignInButton } from "@clerk/clerk-react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { api } from "../lib/api";

export default function MatchPage() {
  const { token } = useParams<{ token: string }>();
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .getMatch(token)
      .then(({ match }) => {
        setMatch(match);
        setStatus(match.status);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function respond(interested: boolean) {
    if (!match) return;
    setError(null);
    try {
      if (interested) {
        const result = await api.expressInterest(match.id, getToken);
        setStatus(result.status);
        if (result.status === "mutual") {
          const rev = await api.revealEmail(match.id, getToken).catch(() => null);
          if (rev) setRevealedEmail(rev.email);
        }
      } else {
        const result = await api.rejectMatch(match.id, getToken);
        setStatus(result.status);
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    }
  }

  return (
    <div>
      <Nav />
      <section className="container-page flex flex-col items-center py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Signal</p>

        {loading && <p className="mt-8 text-muted">Loading match…</p>}
        {error && !loading && <p className="mt-8 text-red-600">{error}</p>}

        {!loading && match && status !== "mutual" && (
          <>
            <h1 className="mt-4 text-center font-display text-3xl font-semibold sm:text-4xl">
              We found a potential match.
            </h1>

            <div className="card mt-10 grid w-full max-w-2xl gap-0 sm:grid-cols-2">
              <div className="p-7">
                <p className="font-mono text-xs uppercase tracking-wide text-muted">You</p>
                <p className="mt-2 text-sm text-muted">Looking for</p>
                <p className="mt-1 text-[15px]">{match.you.lookingFor}</p>
              </div>
              <div className="border-t border-hairline p-7 sm:border-l sm:border-t-0">
                <p className="font-mono text-xs uppercase tracking-wide text-muted">Them</p>
                <p className="mt-2 text-sm text-muted">Can help with</p>
                <p className="mt-1 text-[15px]">{match.them.canOffer}</p>
              </div>
              <div className="col-span-full border-t border-hairline p-7">
                <p className="font-mono text-xs uppercase tracking-wide text-muted">Why this may be useful</p>
                <p className="mt-2 text-[15px] leading-relaxed">{match.explanation}</p>
              </div>
            </div>

            <h2 className="mt-10 font-display text-xl font-medium">Would you like to connect?</h2>

            {!isSignedIn ? (
              <SignInButton mode="modal">
                <button className="btn-primary mt-4">Sign in to respond</button>
              </SignInButton>
            ) : (
              <div className="mt-4 flex gap-4">
                <button onClick={() => respond(true)} className="btn-primary">
                  <Check size={16} /> Yes, I'm interested
                </button>
                <button onClick={() => respond(false)} className="btn-secondary">
                  <X size={16} /> Not relevant
                </button>
              </div>
            )}

            {status === "interested_a" || status === "interested_b" ? (
              <p className="mt-4 text-sm text-muted">You're interested — we'll let you know if they are too.</p>
            ) : null}
            {status === "rejected" && <p className="mt-4 text-sm text-muted">Got it — thanks for letting us know.</p>}
          </>
        )}

        {!loading && match && status === "mutual" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-10 text-center">
            <h1 className="font-display text-4xl font-semibold">Connection unlocked 🎯</h1>
            <p className="mt-3 max-w-md text-muted">You both expressed interest.</p>
            {revealedEmail && (
              <p className="mt-4 rounded-full border border-hairline bg-white px-5 py-2 font-mono text-sm">
                {revealedEmail}
              </p>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              
                href={`${import.meta.env.VITE_RIGHTSIGNAL_URL ?? "https://rightsignal.social"}/signup?ref=signal_match`}
                className="btn-primary"
              >
                Continue on RightSignal →
              </a>
            </div>
          </motion.div>
        )}
      </section>
      <Footer />
    </div>
  );
}
