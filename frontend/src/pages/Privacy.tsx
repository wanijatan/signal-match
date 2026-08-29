import Nav from "../components/Nav";
import Footer from "../components/Footer";

export default function Privacy() {
  return (
    <div>
      <Nav />
      <section className="container-page max-w-2xl py-16">
        <h1 className="font-display text-3xl font-semibold">Privacy</h1>
        <div className="prose-neutral mt-8 space-y-6 text-[15px] leading-relaxed text-muted">
          <p><strong className="text-ink">We never sell your email address.</strong></p>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Email usage</h2>
            <p>Your email verifies your identity and lets us notify you about relevant matches and important Signal updates. We don't send unrelated marketing.</p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Matching data</h2>
            <p>What you tell us you're looking for and what you can offer is used only to find and explain relevant matches.</p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Data storage</h2>
            <p>Data is stored securely in our database (Supabase/PostgreSQL). Authentication and identity are handled by Clerk.</p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Match visibility</h2>
            <p>We never expose your email or contact details to a match until you both express interest.</p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">RightSignal handoff</h2>
            <p>After a mutual match, we may offer to continue the connection on RightSignal, our parent product. This is always optional.</p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Data deletion</h2>
            <p>You can delete your signal and matching data at any time from the link in any Signal email, or by contacting us.</p>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
