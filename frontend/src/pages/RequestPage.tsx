import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { api } from "../lib/api";

type Choice = "know_someone" | "might_know" | "not_me" | null;

export default function RequestPage() {
  const { token } = useParams<{ token: string }>();
  const [lookingFor, setLookingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice>(null);
  const [canOffer, setCanOffer] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .getRequest(token)
      .then((r) => setLookingFor(r.lookingFor))
      .catch((err) => setError(err.message));
  }, [token]);

  async function submitOffer() {
    if (!token) return;
    setError(null);
    try {
      await api.respondToRequest(token, { response: "know_someone", canOffer, email });
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function submitSimple(response: "might_know" | "not_me") {
    if (!token) return;
    try {
      await api.respondToRequest(token, { response });
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <Nav />
      <section className="container-page flex flex-col items-center py-16 text-center">
        {error && <p className="text-red-600">{error}</p>}
        {!error && lookingFor === null && <p className="text-muted">Loading…</p>}

        {!error && lookingFor !== null && !done && (
          <>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Someone is looking for:</h1>
            <p className="mt-4 max-w-lg text-lg italic text-muted">"{lookingFor}"</p>

            {choice !== "know_someone" ? (
              <>
                <h2 className="mt-10 font-display text-xl font-medium">Can you help?</h2>
                <div className="mt-4 flex flex-wrap justify-center gap-4">
                  <button onClick={() => setChoice("know_someone")} className="btn-primary">
                    I know someone
                  </button>
                  <button onClick={() => submitSimple("might_know")} className="btn-secondary">
                    I might know someone
                  </button>
                  <button onClick={() => submitSimple("not_me")} className="btn-secondary">
                    Not me
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-10 w-full max-w-md text-left">
                <label className="field-label !text-lg">What can you offer?</label>
                <textarea
                  className="textarea-base"
                  maxLength={500}
                  value={canOffer}
                  onChange={(e) => setCanOffer(e.target.value)}
                  placeholder="I can introduce them to..."
                />
                <label className="field-label mt-6 !text-lg">Your email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-3 w-full rounded-2xl border border-hairline bg-white p-4 text-[15px]"
                  placeholder="you@company.com"
                />
                <button onClick={submitOffer} className="btn-primary mt-6 w-full">
                  Submit
                </button>
              </div>
            )}
          </>
        )}

        {done && (
          <>
            <h1 className="font-display text-3xl font-semibold">Thanks for helping out.</h1>
            <p className="mt-3 max-w-md text-muted">We've passed this along.</p>
          </>
        )}
      </section>
      <Footer />
    </div>
  );
}
