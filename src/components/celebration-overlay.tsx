import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Lumi } from "@/components/brand/lumi";
import { dismissCelebration, useCelebration } from "@/lib/celebration";

const CONFETTI = ["#ffd84a", "#ffffff", "#9b8cff", "#5fd3a2", "#ffb3c7", "#7cc4ff"];

/** Full-screen "Lumi comemorando" (mockup M5 · Conquista). */
export function CelebrationOverlay() {
  const c = useCelebration();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!c) return;
    navigator.vibrate?.([12, 40, 18]);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissCelebration();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c]);
  if (!mounted) return null;

  async function share() {
    if (!c) return;
    const text = c.share ?? `${c.title} — no BookVerse.`;
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: "BookVerse", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Copiado para compartilhar.");
      }
    } catch {
      // cancelled
    }
  }

  return createPortal(
    <AnimatePresence>
      {c && (
        <motion.div
          role="dialog"
          aria-label={c.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex flex-col items-center overflow-hidden bg-[linear-gradient(180deg,#ff5a26,#ff4d1a_55%,#e2400f)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] text-white"
        >
          {!reduce &&
            Array.from({ length: 26 }, (_, i) => (
              <motion.i
                key={i}
                aria-hidden
                className="absolute top-[-20px] h-[10px] w-[6px] rounded-[2px]"
                style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length] }}
                initial={{ y: -20, rotate: 0, opacity: 1 }}
                animate={{ y: "105vh", rotate: 360 + i * 40, opacity: [1, 1, 0.6] }}
                transition={{
                  duration: 2.4 + (i % 5) * 0.35,
                  delay: (i % 7) * 0.12,
                  ease: "easeIn",
                }}
              />
            ))}
          <motion.div
            initial={reduce ? false : { scale: 0.6, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
            className="mt-[6vh]"
          >
            <Lumi pose="celebrating" size={230} bob />
          </motion.div>
          <motion.div
            initial={reduce ? false : { y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 max-w-sm text-center"
          >
            <p className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-white/85">
              {c.eyebrow}
            </p>
            <p className="mt-2 font-display text-[clamp(38px,11vw,52px)] leading-[0.98] tracking-[-0.04em]">
              {c.title}
            </p>
            {c.body && <p className="mt-3 text-[16px] leading-relaxed text-white/90">{c.body}</p>}
          </motion.div>
          <div className="mt-auto w-full max-w-sm">
            <button
              type="button"
              onClick={dismissCelebration}
              className="press h-[56px] w-full rounded-full bg-white text-[16.5px] font-semibold text-[#131313]"
            >
              Continuar lendo
            </button>
            <button
              type="button"
              onClick={() => void share()}
              className="mt-3 w-full py-2 text-[15px] font-semibold text-white/95"
            >
              Compartilhar conquista
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
