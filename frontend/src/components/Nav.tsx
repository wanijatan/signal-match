import { Link, useNavigate } from "react-router-dom";
import { useUser, useClerk } from "@clerk/clerk-react";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export default function Nav() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline/70 bg-paper/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-[19px] font-bold tracking-tight">SIGNAL</span>
          <span className="hidden text-xs text-muted sm:inline">by RightSignal</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="/#how-it-works" className="text-sm text-muted transition-colors hover:text-ink">
            How it works
          </a>
          {isSignedIn ? (
            <>
              <Link to="/my-signal" className="text-sm text-muted transition-colors hover:text-ink">
                My signal
              </Link>
              <button
                onClick={() => signOut(() => navigate("/"))}
                className="text-sm text-muted transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="text-sm text-muted transition-colors hover:text-ink">
              Sign in
            </Link>
          )}
          <Link to="/start" className="btn-primary !px-5 !py-2.5 text-sm">
            Find my match
          </Link>
        </nav>

        <button className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-hairline bg-paper px-5 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            <a href="/#how-it-works" onClick={() => setOpen(false)} className="text-sm text-muted">
              How it works
            </a>
            {isSignedIn ? (
              <Link to="/my-signal" onClick={() => setOpen(false)} className="text-sm text-muted">
                My signal
              </Link>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="text-sm text-muted">
                Sign in
              </Link>
            )}
            <Link to="/start" onClick={() => setOpen(false)} className="btn-primary w-full">
              Find my match
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
