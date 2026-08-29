import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import SignalMark from "../components/SignalMark";
import { api } from "../lib/api";

export default function Landing() {
  useEffect(() => {
    api.trackEvent("landing_view");
  }, []);

  return (
    <div>
      <Nav />

      {/* HERO — the whole page, essentially */}
      <section className="container-page flex min-h-[78vh] flex-col items-center justify-center py-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <SignalMark size={140} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 max-w-2xl font-display text-[38px] font-semibold leading-[1.1] tracking-tight sm:text-[52px] lg:text-[62px]"
        >
          You don't need another network.
          <br />
          <span className="text-signal">You just need the right person.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-5 max-w-md text-lg leading-relaxed text-muted"
        >
          Tell us what you're looking for and what you can offer. We'll email you when we find a match.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col items-center gap-3"
        >
          <Link
            to="/start"
            onClick={() => api.trackEvent("cta_clicked", { location: "hero" })}
            className="btn-primary"
          >
            Find my match <ArrowRight size={17} />
          </Link>
          <span className="text-sm font-medium text-muted">No profile. No feed. No noise.</span>
        </motion.div>
      </section>

      {/* Three short lines — that's the entire "how it works" */}
      <section id="how-it-works" className="border-t border-hairline">
        <div className="container-page grid gap-10 py-16 sm:grid-cols-3 sm:gap-6">
          {[
            { n: "01", title: "Tell us what you need" },
            { n: "02", title: "Tell us what you can offer" },
            { n: "03", title: "We'll find the overlap" },
          ].map(({ n, title }) => (
            <div key={n} className="text-center sm:text-left">
              <span className="font-mono text-xs text-muted">{n}</span>
              <p className="mt-2 font-display text-lg font-medium">{title}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
