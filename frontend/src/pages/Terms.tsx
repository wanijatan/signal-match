import Nav from "../components/Nav";
import Footer from "../components/Footer";

export default function Terms() {
  return (
    <div>
      <Nav />
      <section className="container-page max-w-2xl py-16">
        <h1 className="font-display text-3xl font-semibold">Terms</h1>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-muted">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Acceptable use</h2>
            <p>Signal is for genuine professional matching requests. Spam, scams, harassment, and illegal solicitation are not allowed and may be removed automatically or by our team.</p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">No guarantee of match</h2>
            <p>We do our best to find relevant matches, but we don't guarantee that a match — or any business outcome from a match — will occur.</p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Abuse policy</h2>
            <p>Accounts found violating acceptable use may be suspended. Report concerning content from any match or request page.</p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Data deletion</h2>
            <p>You may request deletion of your signal and account data at any time.</p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">RightSignal relationship</h2>
            <p>Signal is built by RightSignal. Continuing to RightSignal after a match is optional and governed by RightSignal's own terms.</p>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
