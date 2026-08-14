import { useMemo } from "react";
import owl from "@/assets/owl-mascot.webp";

/**
 * The Lumi owl mascot, wherever it appears (hero, login screen, chat
 * header) — layered so float/breathe/blink can each animate independently:
 *   outer <div>  → lumi-float    (bob + gentle head-tilt)
 *   <img>        → lumi-breathe  (subtle scale pulse)
 *   eyelid spans → lumi-blink    (closed by default, briefly "shuts" to
 *                                 fake a blink — see src/styles.css)
 *
 * Eyelid positions are hand-measured percentages against the actual
 * artwork (src/assets/owl-mascot.png), so they track correctly at any
 * render size without per-usage tuning.
 */
export function LumiMascot({
  size = 64,
  className = "",
  thinking = false,
  interactive = false,
  blink = true,
}: {
  /** Rendered width/height in px — the artwork is square. */
  size?: number;
  className?: string;
  /** Faster, more energetic breathing — use while Lumi is generating a reply. */
  thinking?: boolean;
  /** Adds a springy hover/focus wiggle for clickable instances. */
  interactive?: boolean;
  /** Most instances should blink; disable for very small/decorative ones
   * (under ~28px the blink is imperceptible and not worth the DOM cost). */
  blink?: boolean;
}) {
  // Small per-instance random offset so multiple mascots on the same
  // screen don't breathe/blink in perfect, uncanny unison.
  const delay = useMemo(() => (-(Math.random() * 3)).toFixed(2), []);

  return (
    <div
      className={`lumi-float relative inline-block select-none ${interactive ? "lumi-interactive cursor-pointer" : ""} ${className}`}
      style={{ width: size, height: size, animationDelay: `${delay}s` }}
    >
      <img
        src={owl}
        alt="Lumi"
        width={size}
        height={size}
        className={`h-full w-full object-contain ${thinking ? "lumi-breathe-active" : "lumi-breathe"}`}
        style={{ animationDelay: `${delay}s` }}
      />
      {blink && size >= 28 && (
        <>
          <span
            className="lumi-eyelid"
            style={{ left: "29.7%", animationDelay: `${delay}s` }}
            aria-hidden="true"
          />
          <span
            className="lumi-eyelid"
            style={{ left: "50%", animationDelay: `${(parseFloat(delay) - 0.35).toFixed(2)}s` }}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}
