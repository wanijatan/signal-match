import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as m, AnimatePresence as AP } from "framer-motion";
import { useAuth, useSignIn, useUser } from "@clerk/clerk-react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect } from "react";
import Nav from "../components/Nav";
import Footer from "../components/Footer";

type Step = "email" | "verify" | "loading";

export default function Login() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const { signIn, isLoaded: signInLoaded, setActive } = useSignIn();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (userLoaded && isSignedIn) navigate("/my-signal");
  }, [userLoaded, isSignedIn]);

  async function handleContinue() {
    setError(null);
    setNotFound(false);
    if (!email.includes("@") || !signInLoaded) {
      setError("Enter a valid email address.");
      return;
    }
    try {
      const attempt = await signIn!.create({ identifier: email });
      const emailFactor = attempt.supportedFirstFactors?.find(
        (f: any) => f.strategy === "email_code"
      ) as any;
      if (!emailFactor) {
        setError("Couldn't start email verification for this address. Please try again.");
        return;
      }
      await signIn!.prepareFirstFactor({ strategy: "email_code", emailAddressId: emailFactor.emailAddressId });
      setStep("verify");
    } catch (err: any) {
      const code = err?.errors?.[0]?.code;
      if (code === "form_identifier_not_found") {
        setNotFound(true);
      } else {
        setError(err?.errors?.[0]?.message ?? "Something went wrong. Please try again.");
      }
    }
  }

  async function handleVerify() {
    setError(null);
    if (code.trim().length < 4) {
      setError("Enter the code from your email.");
      return;
    }
    setStep("loading");
    try {
      const attempt = await signIn!.attemptFirstFactor({ strategy: "email_code", code });
      if (attempt.status === "complete") {
        await setActive!({ session: attempt.createdSessionId });
        navigate("/my-signal");
      } else {
        setError("That code didn't work. Please try again.");
        setStep("verify");
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "That code didn't work. Please try again.");
      setStep("verify");
    }
  }

  async function handleResend() {
    setError(null);
    try {
      const emailFactor = signIn!.supportedFirstFactors?.find((f: any) => f.strategy === "email_code") as any;
      await signIn!.prepareFirstFactor({ strategy: "email_code", emailAddressId: emailFactor?.emailAddressId });
    } catch {
      setError("Could not resend the code. Please try again in a moment.");
    }
  }

  return (
    <div>
      <Nav />
      <section className="container-page flex flex-col items-center py-20">
        <AP mode="wait">
          {step === "email" && (
            <m.div key="email" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
              <h1 className="font-display text-3xl font-semibold">Welcome back.</h1>
              <p className="mt-2 text-sm text-muted">Sign in with your email — no password needed.</p>
              <input
                autoFocus
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                className="mt-6 w-full rounded-2xl border border-hairline bg-white p-4 text-center text-[15px] focus:border-signal focus:ring-2 focus:ring-signal/20"
              />
              {notFound && (
                <p className="mt-3 text-sm text-muted">
                  We couldn't find a signal for that email.{" "}
                  <a href="/start" className="font-medium text-signal">Create one →</a>
                </p>
              )}
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <button onClick={handleContinue} className="btn-primary mt-5 w-full">
                Continue <ArrowRight size={16} />
              </button>
            </m.div>
          )}

          {step === "verify" && (
            <m.div key="verify" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
              <h1 className="font-display text-3xl font-semibold">Check your email.</h1>
              <p className="mt-2 text-sm text-muted">Enter the code we just sent to {email}.</p>
              <input
                autoFocus
                inputMode="numeric"
                placeholder="Verification code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                className="mt-6 w-full rounded-2xl border border-hairline bg-white p-4 text-center text-lg tracking-[0.3em] focus:border-signal focus:ring-2 focus:ring-signal/20"
              />
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <button onClick={handleVerify} className="btn-primary mt-5 w-full">
                Sign in
              </button>
              <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                <button onClick={handleResend} className="text-muted hover:text-ink">Resend code</button>
                <button onClick={() => setStep("email")} className="text-muted hover:text-ink">Change email</button>
              </div>
            </m.div>
          )}

          {step === "loading" && (
            <m.div key="loading" className="flex flex-col items-center gap-4 py-10 text-muted">
              <Loader2 className="animate-spin" />
              <p>Signing you in…</p>
            </m.div>
          )}
        </AP>
      </section>
      <Footer />
    </div>
  );
}
