import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** True on devices with a precise pointer (mouse / trackpad). Hover-driven
 * effects are skipped on touch screens, where they would only get stuck. */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setFine(mq.matches);
    const on = () => setFine(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return fine;
}

const SPRING = { stiffness: 260, damping: 22, mass: 0.6 };

/**
 * Pulls its child gently towards the cursor while hovered, then springs
 * back. Used on primary calls to action.
 */
export function Magnetic({
  children,
  strength = 0.28,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);

  const active = fine && !reduce;
  return (
    <motion.span
      ref={ref}
      className={`inline-flex ${className}`}
      style={active ? { x, y } : undefined}
      onPointerMove={(e) => {
        if (!active || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

/**
 * 3D tilt with a soft moving glare — for covers and feature cards. Falls
 * back to a plain container on touch screens and with reduced motion.
 */
export function Tilt({
  children,
  max = 9,
  glare = true,
  className = "",
  style,
}: {
  children: ReactNode;
  max?: number;
  glare?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), SPRING);
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), SPRING);
  const gx = useTransform(px, [0, 1], ["0%", "100%"]);
  const gy = useTransform(py, [0, 1], ["0%", "100%"]);
  const glareBg = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgb(255 255 255 / 0.22), transparent 55%)`;
  const [hover, setHover] = useState(false);
  const active = fine && !reduce;

  return (
    <motion.div
      ref={ref}
      className={`relative ${className}`}
      style={{
        ...style,
        ...(active ? { rotateX: rx, rotateY: ry, transformPerspective: 900 } : null),
        transformStyle: "preserve-3d",
      }}
      onPointerEnter={() => setHover(true)}
      onPointerMove={(e) => {
        if (!active || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        setHover(false);
        px.set(0.5);
        py.set(0.5);
      }}
    >
      {children}
      {active && glare && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light transition-opacity duration-300"
          style={{ background: glareBg, opacity: hover ? 1 : 0 }}
        />
      )}
    </motion.div>
  );
}

/**
 * The "reading lamp": a wide, warm light that follows the cursor across the
 * app. Purely decorative, desktop only, off for reduced motion.
 */
export function CursorSpotlight() {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const x = useSpring(-1000, { stiffness: 120, damping: 30, mass: 0.8 });
  const y = useSpring(-1000, { stiffness: 120, damping: 30, mass: 0.8 });
  const bg = useMotionTemplate`radial-gradient(520px circle at ${x}px ${y}px, color-mix(in oklab, var(--gold) 9%, transparent), transparent 70%)`;

  useEffect(() => {
    if (!fine || reduce) return;
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [fine, reduce, x, y]);

  if (!fine || reduce) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ background: bg }}
    />
  );
}

/** Light haptic tick on supporting phones; silently ignored elsewhere. */
export function haptic(ms = 8) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    // vibration unsupported or blocked
  }
}
