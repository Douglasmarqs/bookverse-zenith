/**
 * Lumi — BookVerse's owl. Her face is the logo (an open book, one eye on each
 * page), the orange bookmark marks where you stopped, and she wears the
 * colour of the book you are reading. Pure SVG, rendered from a string so the
 * same artwork is used by the app, the icons and the share images.
 */
import type { CSSProperties } from "react";

export type LumiEyes = "open" | "down" | "up" | "side" | "happy" | "closed" | "wink" | "wide";
export type LumiWings = "down" | "up" | "point" | "hold" | "wave";
export type LumiProp =
  "book" | "headphones" | "sparkle" | "zzz" | "confetti" | "dots" | "heart" | "moon" | "sweat";

export interface LumiOptions {
  size?: number;
  height?: number;
  body?: string;
  belly?: string;
  face?: string;
  accent?: string;
  ink?: string;
  iris?: string;
  eyes?: LumiEyes;
  wings?: LumiWings;
  props?: LumiProp[];
  book?: { bg: string; acc: string };
  shadow?: boolean;
  view?: string;
  animate?: boolean;
}

/** Ready-made poses for each moment of the app. */
export const LUMI_POSES = {
  hello: { wings: "wave", eyes: "happy" },
  reading: { wings: "hold", eyes: "down", props: ["book"] },
  explaining: { wings: "point", eyes: "up", props: ["sparkle"] },
  celebrating: { wings: "up", eyes: "happy", props: ["confetti"] },
  listening: { eyes: "happy", props: ["headphones"] },
  thinking: { eyes: "side", props: ["dots"] },
  sleeping: { eyes: "closed", props: ["zzz", "moon"] },
  oops: { eyes: "wide", props: ["sweat"] },
  idle: { eyes: "open", wings: "down" },
} satisfies Record<string, Partial<LumiOptions>>;
export type LumiPose = keyof typeof LUMI_POSES;

function build({
  size = 240,
  body = "#18181B",
  belly = "#FFF4E4",
  face = "#FFF7EA",
  accent = "#FF4D1A",
  ink = "#141414",
  iris = "#FFC9B3",
  eyes = "open",
  wings = "down",
  props = [],
  book = { bg: "#1D4A37", acc: "#F2B544" },
  shadow = true,
  view = "0 0 400 420",
  height,
  animate = false,
}: LumiOptions = {}): string {
  const wing = `style="fill:color-mix(in oklab, ${body} 78%, #000)"`;
  const wingHi = `style="fill:color-mix(in oklab, ${body} 86%, #fff)"`;
  const L = (t: string) =>
    `<path d="M100 214 C 70 252 70 318 112 350 C 124 306 124 258 108 214 Z" ${wing} transform="${t}"/><path d="M98 232 C 84 262 86 300 106 326" fill="none" stroke-width="5" stroke-linecap="round" ${wingHi.replace("fill", "stroke")} opacity=".55" transform="${t}"/>`;
  const R = (t: string) => `<g transform="translate(400 0) scale(-1 1)">${L(t)}</g>`;
  const wingT = {
    down: ["", ""],
    up: ["rotate(112 104 220)", "rotate(112 104 220)"],
    point: ["", "rotate(112 104 220)"],
    hold: ["rotate(-16 104 220)", "rotate(-16 104 220)"],
    wave: ["", "rotate(140 104 220)"],
  }[wings]!;

  // Iris and pupil sit in groups the gaze tracker can shift (lumi-gaze.ts).
  const pupil = (cx: number, cy: number, dx = 0, dy = 0) =>
    `<g class="lumi-iris"><circle cx="${cx + dx * 0.5}" cy="${cy + dy * 0.5}" r="31" fill="${iris}"/></g><g class="lumi-pupil"><circle cx="${cx + dx}" cy="${cy + dy}" r="20" fill="${ink}"/><circle cx="${cx + dx + 7}" cy="${cy + dy - 7}" r="6.5" fill="#fff"/><circle cx="${cx + dx - 6}" cy="${cy + dy + 7}" r="2.6" fill="#fff" opacity=".8"/></g>`;
  const eyeSet = {
    open: pupil(150, 170) + pupil(250, 170),
    down: pupil(150, 170, 3, 10) + pupil(250, 170, -3, 10),
    up: pupil(150, 170, 8, -9) + pupil(250, 170, 8, -9),
    side: pupil(150, 170, -10, 2) + pupil(250, 170, -10, 2),
    happy: `<path d="M128 178 Q150 150 172 178" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M228 178 Q250 150 272 178" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>`,
    closed: `<path d="M130 170 Q150 188 170 170" fill="none" stroke="${ink}" stroke-width="9" stroke-linecap="round"/><path d="M230 170 Q250 188 270 170" fill="none" stroke="${ink}" stroke-width="9" stroke-linecap="round"/>`,
    wink:
      pupil(150, 170) +
      `<path d="M230 174 Q250 156 270 174" fill="none" stroke="${ink}" stroke-width="9" stroke-linecap="round"/>`,
    wide: `<circle cx="150" cy="170" r="32" fill="${iris}"/><circle cx="150" cy="170" r="25" fill="${ink}"/><circle cx="158" cy="161" r="8" fill="#fff"/><circle cx="250" cy="170" r="32" fill="${iris}"/><circle cx="250" cy="170" r="25" fill="${ink}"/><circle cx="258" cy="161" r="8" fill="#fff"/>`,
  }[eyes]!;

  const has = (p: LumiProp) => props.includes(p);
  const bookProp = has("book")
    ? `<g><path d="M200 268 C 178 256 152 254 128 260 L 128 330 C 152 324 178 326 200 338 C 222 326 248 324 272 330 L 272 260 C 248 254 222 256 200 268 Z" fill="${book.bg}"/><path d="M200 262 C 180 250 158 248 136 254 L 136 318 C 158 312 180 314 200 326 Z" fill="#fffdf7"/><path d="M200 262 C 220 250 242 248 264 254 L 264 318 C 242 312 220 314 200 326 Z" fill="#f4eee2"/>${[0, 1, 2, 3].map((i: number) => `<path d="M${150} ${270 + i * 12} q 20 -4 38 3" stroke="#d6cfc2" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M${212} ${273 + i * 12} q 20 -7 38 -3" stroke="#d6cfc2" stroke-width="3" fill="none" stroke-linecap="round"/>`).join("")}<path d="M224 250 v34 l7 -6 l7 6 v-36" fill="${book.acc}"/></g>`
    : "";
  const phones = has("headphones")
    ? `<path d="M92 176 C 88 52 312 52 308 176" fill="none" stroke="${accent}" stroke-width="15" stroke-linecap="round"/><rect x="72" y="146" width="36" height="66" rx="16" fill="${accent}"/><rect x="292" y="146" width="36" height="66" rx="16" fill="${accent}"/><rect x="84" y="160" width="12" height="38" rx="6" fill="#000" opacity=".18"/><rect x="304" y="160" width="12" height="38" rx="6" fill="#000" opacity=".18"/>`
    : "";
  const star = (x: number, y: number, s: number, c: string) =>
    `<path d="M${x} ${y - s} C ${x + s * 0.16} ${y - s * 0.16} ${x + s * 0.16} ${y - s * 0.16} ${x + s} ${y} C ${x + s * 0.16} ${y + s * 0.16} ${x + s * 0.16} ${y + s * 0.16} ${x} ${y + s} C ${x - s * 0.16} ${y + s * 0.16} ${x - s * 0.16} ${y + s * 0.16} ${x - s} ${y} C ${x - s * 0.16} ${y - s * 0.16} ${x - s * 0.16} ${y - s * 0.16} ${x} ${y - s} Z" fill="${c}"/>`;
  const sparkle = has("sparkle")
    ? star(338, 76, 26, accent) + star(370, 128, 13, "#6D5DF6") + star(312, 30, 9, "#F6CF45")
    : "";
  const zzz = has("zzz")
    ? `<text x="300" y="92" font-family="Bricolage Grotesque Variable" font-weight="800" font-size="40" fill="${accent}">z</text><text x="334" y="58" font-family="Bricolage Grotesque Variable" font-weight="800" font-size="28" fill="${accent}" opacity=".75">z</text><text x="358" y="32" font-family="Bricolage Grotesque Variable" font-weight="800" font-size="20" fill="${accent}" opacity=".5">z</text>`
    : "";
  const confetti = has("confetti")
    ? (
        [
          [44, 70, "#F6CF45", 20],
          [350, 60, "#6D5DF6", -25],
          [24, 190, "#17867A", 40],
          [372, 200, accent, 15],
          [70, 22, accent, 60],
          [326, 18, "#17867A", -10],
          [16, 120, "#F5C9D3", 0],
          [384, 130, "#F6CF45", 30],
        ] as [number, number, string, number][]
      )
        .map(([x, y, c, r]: [number, number, string, number], i: number) =>
          i % 2
            ? `<rect x="${x}" y="${y}" width="16" height="9" rx="3" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`
            : `<circle cx="${x}" cy="${y}" r="7" fill="${c}"/>`,
        )
        .join("")
    : "";
  const dots = has("dots")
    ? `<g><rect x="286" y="30" width="96" height="56" rx="28" fill="#fff" stroke="#e4e2dc" stroke-width="3"/><circle cx="312" cy="58" r="7" fill="${ink}"/><circle cx="334" cy="58" r="7" fill="${ink}" opacity=".55"/><circle cx="356" cy="58" r="7" fill="${ink}" opacity=".3"/><circle cx="292" cy="98" r="8" fill="#fff" stroke="#e4e2dc" stroke-width="3"/></g>`
    : "";
  const heart = has("heart")
    ? `<path d="M340 70 c -10 -18 -40 -10 -34 12 c 4 14 34 30 34 30 s 30 -16 34 -30 c 6 -22 -24 -30 -34 -12 Z" fill="${accent}"/>`
    : "";
  const moon = has("moon")
    ? `<path d="M64 52 a 30 30 0 1 0 34 40 a 24 24 0 1 1 -34 -40 Z" fill="#F6CF45"/>`
    : "";
  const tear = has("sweat")
    ? `<path d="M316 112 c 0 0 -14 18 -14 28 a 14 14 0 0 0 28 0 c 0 -10 -14 -28 -14 -28 Z" fill="#7cc3ff"/>`
    : "";

  const rightWing =
    animate && wings === "wave" ? `<g class="lumi-wave">${R(wingT[1])}</g>` : R(wingT[1]);
  const wingsBehind = wings === "hold" ? "" : L(wingT[0]) + rightWing;
  const wingsFront = wings === "hold" ? L(wingT[0]) + R(wingT[1]) : "";

  return `<svg width="${size}" height="${height ?? (size * 420) / 400}" viewBox="${view}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  ${shadow ? `<ellipse cx="200" cy="388" rx="112" ry="13" fill="#000" opacity=".09"/>` : ""}
  ${moon}${confetti}
  ${wings === "up" || wings === "wave" || wings === "point" ? wingsBehind : ""}
  <path d="M190 104 C 150 90 110 70 86 28 C 128 42 166 62 200 92 Z" fill="${body}" stroke="${body}" stroke-width="8" stroke-linejoin="round"/>
  <path d="M210 104 C 250 90 290 70 314 28 C 272 42 234 62 200 92 Z" fill="${body}" stroke="${body}" stroke-width="8" stroke-linejoin="round"/>
  <path d="M200 62 C 298 62 334 150 334 236 C 334 324 278 374 200 374 C 122 374 66 324 66 236 C 66 150 102 62 200 62 Z" fill="${body}"/>
  <ellipse cx="146" cy="104" rx="44" ry="16" fill="#fff" opacity=".07" transform="rotate(-24 146 104)"/>
  ${wings === "down" ? wingsBehind : ""}
  <path d="M134 262 C 152 236 248 236 266 262 C 286 302 268 352 200 358 C 132 352 114 302 134 262 Z" fill="${belly}"/>
  ${[0, 1, 2, 3].map((i: number) => `<path d="M${156 + i * 4} ${270 + i * 18} H ${244 - i * 10}" stroke="${body}" stroke-opacity=".16" stroke-width="6" stroke-linecap="round"/>`).join("")}
  <path d="M200 136 C 176 110 134 100 104 116 C 86 150 88 204 110 232 C 142 218 178 220 200 238 C 222 220 258 218 290 232 C 312 204 314 150 296 116 C 266 100 224 110 200 136 Z" fill="${face}" stroke="${face}" stroke-width="12" stroke-linejoin="round"/>
  <path d="M200 132 V 232" stroke="${body}" stroke-opacity=".12" stroke-width="3"/>
  <path d="M194 118 h12 v32 l-6 -6 l-6 6 Z" fill="${accent}"/>
  <ellipse cx="128" cy="212" rx="14" ry="8" fill="${accent}" opacity=".22"/><ellipse cx="272" cy="212" rx="14" ry="8" fill="${accent}" opacity=".22"/>
  ${animate && eyes !== "happy" && eyes !== "closed" ? `<g class="lumi-blink">${eyeSet}</g>` : eyeSet}
  <path d="M200 214 L 213 229 L 200 250 L 187 229 Z" fill="${accent}" stroke="${accent}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M200 214 L 213 229 L 200 233 Z" fill="#fff" opacity=".22"/>
  ${[148, 165, 182].map((x: number) => `<ellipse cx="${x + 2}" cy="374" rx="9" ry="11" fill="${accent}"/>`).join("")}
  ${[218, 235, 252].map((x: number) => `<ellipse cx="${x - 2}" cy="374" rx="9" ry="11" fill="${accent}"/>`).join("")}
  ${bookProp}${wingsFront}
  ${phones}${sparkle}${zzz}${dots}${heart}${tear}
</svg>`;
}

export const lumiSvg = build;

/** Eyes that can follow you (the others are closed, smiling or busy). */
const LOOKING_EYES = new Set<LumiEyes>(["open", "up", "down", "side", "wink", "wide"]);

export function Lumi({
  pose = "idle",
  size = 160,
  className = "",
  style,
  label,
  bob = false,
  ...opts
}: LumiOptions & {
  pose?: LumiPose;
  className?: string;
  style?: CSSProperties;
  label?: string;
  bob?: boolean;
}) {
  const merged = { ...(LUMI_POSES[pose] as LumiOptions), ...opts };
  const svg = build({ ...merged, animate: true, size });
  const looks = LOOKING_EYES.has(merged.eyes ?? "open");
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-lumi=""
      data-look={looks ? "" : undefined}
      className={`inline-block shrink-0 ${bob ? "lumi-bob" : ""} ${className}`}
      style={{ width: size, lineHeight: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Lumi's face cropped into a circle — avatars, chips, notifications. */
export function LumiFace({
  size = 40,
  bg = "#18181B",
  accent = "#FF4D1A",
  iris,
  eyes = "open",
  round = true,
  className = "",
}: {
  size?: number;
  bg?: string;
  accent?: string;
  iris?: string;
  eyes?: LumiEyes;
  round?: boolean;
  className?: string;
}) {
  const svg = build({
    size,
    height: size,
    body: bg,
    accent,
    iris,
    eyes,
    shadow: false,
    view: "92 58 216 216",
    animate: true,
  });
  return (
    <span
      aria-hidden="true"
      data-lumi=""
      data-look={LOOKING_EYES.has(eyes) ? "" : undefined}
      className={`inline-block shrink-0 overflow-hidden align-middle ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: round ? "50%" : size * 0.3,
        background: bg,
        lineHeight: 0,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
