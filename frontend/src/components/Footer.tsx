import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div className="container-page flex flex-col items-center justify-between gap-4 py-10 sm:flex-row">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-sm font-bold">SIGNAL</span>
          <span className="text-xs text-muted">by RightSignal</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
          <Link to="/privacy" className="hover:text-ink">Privacy</Link>
          <Link to="/terms" className="hover:text-ink">Terms</Link>
          <a href="https://rightsignal.social" className="hover:text-ink">RightSignal</a>
        </div>
        <p className="text-xs text-muted">We never sell your email address.</p>
      </div>
    </footer>
  );
}
