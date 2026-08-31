import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence as AP, motion as m } from "framer-motion";
import { useAuth, useSignIn, useSignUp, useUser } from "@clerk/clerk-react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import SignalMark from "../components/SignalMark";
import { api } from "../lib/api";

const LOCATIONS = ["Global", "India", "United States", "United Kingdom", "Europe", "Southeast Asia", "Other"];

type Step = "looking" | "offer" | "email" | "verify" | "submitting" | "success";

export default function SignalFlow() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const { signUp, isLoaded: signUpLoaded, setActive: setActiveFromSignUp } = useSignUp();
  const { signIn, isLoaded: signInLoaded, setActive: setActiveFromSignIn } = useSignIn();

  const [step, setStep] = useState<Step>("looking");
  const [lookingFor, setLookingFor] = useState("");
  const [canOffer, setCanOffer] = useState("");
  const [location, setLocation] = useState("Global");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifyMode, setVerifyMode] = useState<"signup" | "signin">("signup");
  const [error, setError] = useState<string | null>(null);
  const [submittedSignal, setSubmittedSignal] = useState<any>(null);

  useEffect(() => {
    api.trackEvent("form_started");
  }, []);

  const canSubmitLookingFor = lookingFor.trim().length >= 10;
  const canSubmitOffer = canOffer.trim().length >= 10;

  async function submitSignalToBackend() {
    setStep("submitting");
    setError(null);
    try {
      const { signal } = await api.submitSignal({ lookingFor, canOffer, location }, getToken);
      setSubmittedSignal(signal);
      setStep("success");
      api.trackEvent("signal_created");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
      setStep("email");
    }
  }

  async function handleEmailContinue() {
    setError(null);
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    api.trackEvent("email_entered");

    if (isSignedIn) {
      await submitSignalToBackend();
      return;
    }

    if (!signUpLoaded || !signInLoaded) return;

    try {
      await signUp!.create({ emailAddress: email });
      await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerifyMode("signup");
      setStep("verify");
      api.trackEvent("verification_requested");
    } catch (err: any) {
      const alreadyExists = err?.errors?.[0]?.code === "form_identifier_exists";
      if (alreadyExists) {
        try {
          const attempt = await signIn!.create({ identifier: email });
          const emailFactor = attempt.supportedFirstFactors?.find(
            (f: any) => f.strategy === "email_code"
          ) as any;
          await signIn!.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailFactor?.emailAddressId,
          });
          setVerifyMode("signin");
          setStep("verify");
          api.trackEvent("verification_requested");
        } catch (signInErr: any) {
          setError(signInErr?.errors?.[0]?.message ?? "Could not start sign-in. Please try again.");
        }
      } else {
        setError(err?.errors?.[0]?.message ?? "Could not send a verification email. Please try again.");
      }
    }
  }

  async function handleVerifyCode() {
    setError(null);
    if (code.trim().length < 4) {
      setError("Enter the code from your email.");
      return;
    }
    try {
      if (verifyMode === "signup") {
        const attempt = await signUp!.attemptEmailAddressVerification({ code });
        if (attempt.status === "complete") {
          await setActiveFromSignUp!({ session: attempt.createdSessionId });
          api.trackEvent("email_verified");
          await submitSignalToBackend();
        } else {
          setError("That code didn't work. Please try again.");
        }
      } else {
        const attempt = await signIn!.attemptFirstFactor({ strategy: "email_code", code });
        if (attempt.status === "complete") {
          await setActiveFromSignIn!({ session: attempt.createdSessionId });
          api.trackEvent("email_verified");
          await submitSignalToBackend();
        } else {
          setError("That code didn't work. Please try again.");
        }
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "That code didn't work. Please try again.");
    }
  }

  async function handleResend() {
    setError(null);
    try {
      if (verifyMode === "signup") {
        await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
      } else {
        const emailFactor = signIn!.supportedFirstFactors?.find(
          (f: any) => f.strategy === "email_code"
        ) as any;
        await signIn!.prepareFirstFactor({ strategy: "email_code", emailAddressId: emailFactor?.emailAddressId });
      }
    } catch {
      setError("Could not resend the code. Please try again in a moment.");
    }
  }

  const progress = useMemo(() => {
    const order: Step[] = ["looking", "offer", "email", "verify"];
    const idx = order.indexOf(step);
    return idx === -1 ? 100 : ((idx + 1) / order.length) * 100;
  }, [step]);

  if (step === "success") {
    return (
      <div>
        <Nav />
        <section className="container-page flex flex-col items-center py-20 text-center">
          <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <SignalMark size={180} />
          </m.div>
          <h1 className="mt-6 font-display text-4xl font-semibold">You're in.</h1>
          <p className="mt-3 max-w-md text-muted">Your signal has been added to the network.</p>

          <div className="card mt-10 w-full max-w-lg p-8 text-left">
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-muted">Looking for</p>
              <p className="mt-1 text-[15px]">{submittedSignal?.looking_for ?? lookingFor}</p>
            </div>
            <div className="mt-6">
              <p className="font-mono text-xs uppercase tracking-wide text-muted">Can offer</p>
              <p className="mt-1 text-[15px]">{submittedSignal?.can_offer ?? canOffer}</p>
            </div>
          </div>

          <p className="mt-8 max-w-md text-sm text-muted">
            We'll email you when we find a relevant match.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a href="https://rightsignal.social" className="btn-primary">
              Explore RightSignal →
            </a>
            <button onClick={() => navigate("/")} className="btn-secondary">
              Done
            </button>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Nav />
      {/* Required by Clerk's invisible bot-protection captcha for the
          sign-up call below (signUp.create). It stays invisible — Clerk
          renders its widget into this element itself; without it present
          in the DOM, Clerk rejects sign-up with a 422. */}
      <div id="clerk-captcha" />
      <section className="container-page flex flex-col items-center py-14 sm:py-20">
        <div className="mb-10 h-1 w-full max-w-lg overflow-hidden rounded-full bg-hairline">
          <m.div
            className="h-full bg-signal"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>

        <AP mode="wait">
          {step === "looking" && (
            <m.div
              key="looking"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="w-full max-w-lg"
            >
              <label className="field-label">What are you looking for?</label>
              <p className="mt-2 text-sm text-muted">Be specific. The better you describe your need, the better the match.</p>
              <textarea
                autoFocus
                className="textarea-base"
                maxLength={500}
                placeholder="I'm looking for a pre-seed investor interested in B2B SaaS..."
                value={lookingFor}
                onChange={(e) => setLookingFor(e.target.value)}
              />
              <div className="mt-1 text-right font-mono text-xs text-muted">{lookingFor.length} / 500</div>
              <div className="mt-6 flex justify-end">
                <button disabled={!canSubmitLookingFor} onClick={() => setStep("offer")} className="btn-primary disabled:opacity-40">
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </m.div>
          )}

          {step === "offer" && (
            <m.div
              key="offer"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="w-full max-w-lg"
            >
              <label className="field-label">What can you help with?</label>
              <p className="mt-2 text-sm text-muted">Your expertise, connections, opportunities, services or knowledge.</p>
              <textarea
                autoFocus
                className="textarea-base"
                maxLength={500}
                placeholder="I help B2B SaaS founders build their sales pipeline..."
                value={canOffer}
                onChange={(e) => setCanOffer(e.target.value)}
              />
              <div className="mt-1 text-right font-mono text-xs text-muted">{canOffer.length} / 500</div>

              <label className="field-label mt-8 !text-lg">Where are you based?</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-hairline bg-white p-3.5 text-[15px]"
              >
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>

              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep("looking")} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  disabled={!canSubmitOffer}
                  onClick={() => (userLoaded && isSignedIn ? submitSignalToBackend() : setStep("email"))}
                  className="btn-primary disabled:opacity-40"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </m.div>
          )}

          {step === "email" && (
            <m.div
              key="email"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="w-full max-w-lg"
            >
              <label className="field-label">Your email</label>
              <input
                autoFocus
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailContinue()}
                className="mt-3 w-full rounded-2xl border border-hairline bg-white p-4 text-[15px] focus:border-signal focus:ring-2 focus:ring-signal/20"
              />
              <p className="mt-2 text-xs text-muted">
                We'll only email you about relevant matches and important product updates.
              </p>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => setStep("offer")} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
                  <ArrowLeft size={15} /> Back
                </button>
                <button onClick={handleEmailContinue} className="btn-primary">
                  Find my match <ArrowRight size={16} />
                </button>
              </div>
            </m.div>
          )}

          {step === "verify" && (
            <m.div
              key="verify"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="w-full max-w-lg text-center"
            >
              <h2 className="font-display text-3xl font-semibold">One small step.</h2>
              <p className="mt-3 text-muted">
                Check your email to verify your address. Then we'll activate your signal.
              </p>
              <input
                autoFocus
                inputMode="numeric"
                placeholder="Verification code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                className="mt-6 w-full rounded-2xl border border-hairline bg-white p-4 text-center text-lg tracking-[0.3em] focus:border-signal focus:ring-2 focus:ring-signal/20"
              />
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <button onClick={handleVerifyCode} className="btn-primary mt-6 w-full">
                Verify & find my match
              </button>
              <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                <button onClick={handleResend} className="text-muted hover:text-ink">Resend code</button>
                <button onClick={() => setStep("email")} className="text-muted hover:text-ink">Change email</button>
              </div>
            </m.div>
          )}

          {step === "submitting" && (
            <m.div key="submitting" className="flex flex-col items-center gap-4 py-16 text-muted">
              <Loader2 className="animate-spin" />
              <p>Setting up your signal…</p>
            </m.div>
          )}
        </AP>
      </section>
      <Footer />
    </div>
  );
}
