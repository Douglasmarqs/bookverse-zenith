import { useEffect } from "react";

/**
 * Makes every Lumi on screen alive: her pupils follow the cursor (or the
 * last touch), glance in the direction you scroll, drift back to you when
 * you stop, and she gives a little hop when tapped. One shared listener,
 * CSS variables only — no re-renders.
 */
export function LumiGaze() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let px = window.innerWidth / 2;
    let py = window.innerHeight / 3;
    let raf = 0;
    let idle = 0;
    let scrollGlance = 0;

    const aim = () => {
      raf = 0;
      const owls = document.querySelectorAll<HTMLElement>("[data-lumi][data-look]");
      owls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight || !r.width) return;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.4;
        const dx = px - cx;
        const dy = py - cy + scrollGlance;
        const dist = Math.hypot(dx, dy) || 1;
        // Closer pointer → smaller look; far away → eyes at the rim.
        const reach = Math.min(1, dist / 260);
        const x = (dx / dist) * 9 * reach;
        const y = (dy / dist) * 8 * reach;
        el.style.setProperty("--lx", `${x.toFixed(2)}px`);
        el.style.setProperty("--ly", `${y.toFixed(2)}px`);
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(aim);
    };
    const settle = () => {
      clearTimeout(idle);
      idle = window.setTimeout(() => {
        // Nobody's moving: look back at the reader (straight ahead).
        document.querySelectorAll<HTMLElement>("[data-lumi][data-look]").forEach((el) => {
          el.style.setProperty("--lx", "0px");
          el.style.setProperty("--ly", "0px");
        });
      }, 4000);
    };

    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      schedule();
      settle();
    };
    let lastY = window.scrollY;
    let glanceTimer = 0;
    const onScroll = () => {
      const v = window.scrollY - lastY;
      lastY = window.scrollY;
      scrollGlance = Math.max(-240, Math.min(240, v * 12));
      schedule();
      settle();
      // One timer per scroll gesture, not one per scroll event.
      clearTimeout(glanceTimer);
      glanceTimer = window.setTimeout(() => {
        scrollGlance = 0;
        schedule();
      }, 260);
    };
    const onDown = (e: PointerEvent) => {
      const owl = (e.target as Element | null)?.closest?.("[data-lumi]") as HTMLElement | null;
      if (!owl) return;
      owl.classList.remove("lumi-hop");
      void owl.offsetWidth; // restart the animation
      owl.classList.add("lumi-hop");
      window.setTimeout(() => owl.classList.remove("lumi-hop"), 700);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      clearTimeout(glanceTimer);
    };
  }, []);
  return null;
}
