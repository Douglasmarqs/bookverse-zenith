/**
 * Shared bits of the opening sequence ("Abertura", see
 * components/shell/app-intro.tsx): the boot script that decides before the
 * first paint whether it plays, and a helper to defer start-up work until
 * it's over.
 */
export const SEEN_KEY = "bookverse:intro-seen";
export const SESSION_KEY = "bookverse:intro-session";
export const DONE_EVENT = "bookverse:intro-done";

/** Runs in <head> before paint: sets html[data-intro] to the mode or "off",
 * and lets a tap skip the show even before the app's JavaScript loads. */
export const INTRO_BOOT_SCRIPT = `(function(){var d=document.documentElement,m='off';try{var p=location.pathname,s=location.search;var skip=/^\\/(reader|api)\\//.test(p)||/[?&]intro=0/.test(s)||sessionStorage.getItem('${SESSION_KEY}');if(!skip){m=localStorage.getItem('${SEEN_KEY}')?'short':'full';if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)m='calm';}}catch(e){m='off'}d.setAttribute('data-intro',m);if(m!=='off'){d.style.background='#09090b';var k=function(){var o=document.getElementById('app-intro');if(o){o.classList.add('is-skipping');d.classList.add('intro-reveal');}};document.addEventListener('click',function(e){var o=document.getElementById('app-intro');if(o&&o.contains(e.target))k();},true);document.addEventListener('keydown',function(e){if(e.key==='Escape')k();},true);}})();`;

/** Runs `cb` once the opening is over (or right away if there is none) —
 * for start-up work that would otherwise compete with the animation. */
export function afterIntro(cb: () => void, maxWaitMs = 9000): () => void {
  if (typeof document === "undefined") return () => {};
  const mode = document.documentElement.getAttribute("data-intro");
  if (!mode || mode === "off") {
    cb();
    return () => {};
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.removeEventListener(DONE_EVENT, run);
    clearTimeout(t);
    cb();
  };
  window.addEventListener(DONE_EVENT, run);
  const t = setTimeout(run, maxWaitMs);
  return () => {
    done = true;
    window.removeEventListener(DONE_EVENT, run);
    clearTimeout(t);
  };
}
