/**
 * Two small "physical" moments, done with the Web Animations API on a clone
 * so they never touch React state or the page underneath:
 *
 *  - flyToLibrary: a saved/downloaded book arcs into the Biblioteca icon,
 *    which bounces to say "got it".
 *  - playBookOpen: tapping a cover lifts it to the middle of the screen and
 *    swings it open on a paper page while the reader loads underneath.
 */

const reduced = () =>
  typeof window === "undefined" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
}

/** The cover art inside a card/row, if there is one. */
export function coverIn(root: Element | null | undefined): HTMLElement | null {
  if (!root) return null;
  return (
    root.querySelector<HTMLElement>(".book3d-body > :first-child") ??
    root.querySelector<HTMLElement>("[class*='aspect-[2/3]']")
  );
}

function cloneAt(el: HTMLElement, r: DOMRect) {
  const c = el.cloneNode(true) as HTMLElement;
  c.removeAttribute("id");
  Object.assign(c.style, {
    position: "fixed",
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: "0",
    zIndex: "9999",
    pointerEvents: "none",
    transformOrigin: "50% 50%",
  });
  return c;
}

export function flyToLibrary(source: Element | null | undefined) {
  if (!source || reduced()) return;
  const target = [...document.querySelectorAll('[data-fly-target="biblioteca"]')].find(visible) as
    HTMLElement | undefined;
  if (!target) return;
  const art = (
    source instanceof HTMLElement && source.matches("[class*='aspect-[2/3]']")
      ? source
      : coverIn(source)
  ) as HTMLElement | null;
  const from = (art ?? (source as HTMLElement)).getBoundingClientRect();
  if (!from.width) return;
  const to = target.getBoundingClientRect();
  const ghost = art
    ? cloneAt(art, from)
    : Object.assign(document.createElement("div"), {
        style: `position:fixed;left:${from.left}px;top:${from.top}px;width:28px;height:42px;border-radius:3px 6px 6px 3px;background:var(--gold);z-index:9999;pointer-events:none`,
      });
  document.body.appendChild(ghost);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const end = Math.min(1, 22 / Math.max(1, from.width));
  const lift = Math.min(160, Math.abs(dy) * 0.45 + 60);
  const fly = ghost.animate(
    [
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
      {
        transform: `translate(${dx * 0.35}px, ${dy * 0.35 - lift}px) scale(${(1 + end) / 1.6}) rotate(-10deg)`,
        opacity: 1,
        offset: 0.45,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(${end}) rotate(8deg)`, opacity: 0.85 },
    ],
    { duration: 760, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" },
  );
  fly.onfinish = () => {
    ghost.remove();
    target.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.22) translateY(-3px)" },
        { transform: "scale(0.94)" },
        { transform: "scale(1)" },
      ],
      { duration: 480, easing: "ease-out" },
    );
  };
}

let opening = false;

export function playBookOpen(cover: HTMLElement | null | undefined) {
  if (!cover || opening || reduced()) return;
  const r = cover.getBoundingClientRect();
  if (!r.width || !r.height) return;
  opening = true;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const h = Math.min(vh * 0.62, 520);
  const scale = h / r.height;
  const tx = vw / 2 - (r.left + r.width / 2);
  const ty = vh / 2 - (r.top + r.height / 2);

  const stage = document.createElement("div");
  Object.assign(stage.style, {
    position: "fixed",
    inset: "0",
    zIndex: "9998",
    pointerEvents: "none",
    perspective: "1600px",
  });
  const book = document.createElement("div");
  Object.assign(book.style, {
    position: "absolute",
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    transformStyle: "preserve-3d",
    transformOrigin: "50% 50%",
  });
  const page = document.createElement("div");
  Object.assign(page.style, {
    position: "absolute",
    inset: "0",
    borderRadius: "2px 6px 6px 2px",
    background:
      "linear-gradient(90deg, rgb(0 0 0 / .12), transparent 12%), repeating-linear-gradient(180deg, transparent 0 14%, rgb(42 38 32 / .07) 14% 15%), #F7F3EA",
    boxShadow: "0 30px 60px -20px rgb(0 0 0 / .45)",
  });
  const front = cover.cloneNode(true) as HTMLElement;
  Object.assign(front.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    transformOrigin: "0% 50%",
    backfaceVisibility: "hidden",
  });
  book.append(page, front);
  stage.append(book);
  document.body.appendChild(stage);

  const ease = "cubic-bezier(.16,1,.3,1)";
  const rise = book.animate(
    [
      { transform: "translate(0,0) scale(1)" },
      { transform: `translate(${tx}px, ${ty}px) scale(${scale})` },
    ],
    { duration: 420, easing: ease, fill: "forwards" },
  );
  rise.onfinish = () => {
    const swing = front.animate(
      [{ transform: "rotateY(0deg)" }, { transform: "rotateY(-118deg)" }],
      { duration: 520, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
    );
    swing.onfinish = () => {
      const fade = stage.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 260,
        easing: "ease-out",
        fill: "forwards",
      });
      book.animate(
        [
          { transform: `translate(${tx}px, ${ty}px) scale(${scale})` },
          { transform: `translate(${tx}px, ${ty}px) scale(${scale * 1.6})` },
        ],
        { duration: 260, easing: "ease-in", fill: "forwards" },
      );
      fade.onfinish = () => {
        stage.remove();
        opening = false;
      };
    };
  };
  // Safety net: never leave the stage on screen.
  window.setTimeout(() => {
    stage.remove();
    opening = false;
  }, 2200);
}

/** Mount once: any tap on a link into the reader that carries a cover opens it. */
export function installBookOpen() {
  if (typeof document === "undefined") return () => {};
  const onClick = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as Element | null)?.closest?.('a[href^="/reader/"]');
    if (!link) return;
    playBookOpen(coverIn(link));
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
