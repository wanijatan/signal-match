import { NavLink, Outlet } from "react-router-dom";
import { useAuth, useUser, SignInButton } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const tabs = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/signals", label: "Signals" },
  { to: "/admin/matches", label: "Matches" },
];

export default function AdminLayout() {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setAllowed(false);
      return;
    }
    api.admin
      .stats(getToken)
      .then(() => setAllowed(true))
      .catch(() => setAllowed(false));
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || allowed === null) {
    return <div className="p-16 text-center text-muted">Loading…</div>;
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-2xl font-semibold">Admin access required</h1>
        <p className="max-w-sm text-muted">Sign in with an admin account to view this dashboard.</p>
        {!isSignedIn && (
          <SignInButton mode="modal">
            <button className="btn-primary">Sign in</button>
          </SignInButton>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-white">
        <div className="container-page flex h-16 items-center gap-8">
          <span className="font-display text-lg font-bold">Signal Admin</span>
          <nav className="flex gap-6">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? "text-signal" : "text-muted hover:text-ink"}`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="container-page py-10">
        <Outlet />
      </main>
    </div>
  );
}
