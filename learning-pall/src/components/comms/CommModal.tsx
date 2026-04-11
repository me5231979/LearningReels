"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, X } from "lucide-react";

type ActiveComm = {
  id: string;
  heading: string;
  details: string;
  ctaText: string | null;
  ctaUrl: string | null;
};

export default function CommModal() {
  const [comm, setComm] = useState<ActiveComm | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comms/active", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.comm) return;

        // Limit this announcement to a max of 3 appearances per browser
        // session (sessionStorage is cleared when the tab closes). The key
        // is scoped to the comm id so a new announcement resets the counter.
        const key = `comm:${d.comm.id}:views`;
        let views = 0;
        try {
          views = parseInt(sessionStorage.getItem(key) ?? "0", 10) || 0;
        } catch {
          // sessionStorage may be unavailable (private mode, etc.) — fall
          // through and show the modal without counting.
        }
        if (views >= 3) return;
        try {
          sessionStorage.setItem(key, String(views + 1));
        } catch {}

        setComm(d.comm);
        setOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function recordEvent(event: "dismissed" | "cta_clicked") {
    if (!comm) return;
    fetch(`/api/comms/${comm.id}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    }).catch(() => {});
  }

  function handleClose() {
    recordEvent("dismissed");
    setOpen(false);
  }

  function handleCta() {
    recordEvent("cta_clicked");
    setOpen(false);
  }

  if (!comm) return null;

  const hasCta = !!(comm.ctaText && comm.ctaUrl);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="relative w-full max-w-sm bg-vand-black border border-vand-gold/30 rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gold accent strip */}
            <div className="h-1 bg-gradient-to-r from-vand-gold/50 via-vand-gold to-vand-gold/50" />

            {/* Close button */}
            <button
              onClick={handleClose}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-vand-sand/50 hover:text-vand-sand hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="p-6 pt-7">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-full bg-vand-gold/15 border border-vand-gold/30 flex items-center justify-center text-vand-gold">
                  <Megaphone size={16} />
                </div>
                <span className="text-[10px] font-condensed uppercase tracking-widest text-vand-gold/80">
                  Announcement
                </span>
              </div>

              <h2 className="font-serif text-xl font-bold text-white leading-snug mb-2">
                {comm.heading}
              </h2>

              <p className="text-sm text-vand-sand/80 leading-relaxed whitespace-pre-wrap">
                {comm.details}
              </p>

              <div className="mt-6 flex flex-col gap-2">
                {hasCta ? (
                  <>
                    <a
                      href={comm.ctaUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleCta}
                      className="block text-center w-full px-5 py-3 rounded-xl bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-sm font-bold active:bg-vand-highlight transition-colors"
                    >
                      {comm.ctaText}
                    </a>
                    <button
                      onClick={handleClose}
                      className="w-full px-5 py-2.5 rounded-xl text-vand-sand/60 text-sm font-condensed uppercase tracking-wider hover:text-vand-sand"
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleClose}
                    className="w-full px-5 py-3 rounded-xl bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-sm font-bold active:bg-vand-highlight transition-colors"
                  >
                    Got it
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
