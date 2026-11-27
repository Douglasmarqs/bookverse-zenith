/**
 * Ouvir — any book becomes audio. Two engines:
 *  - "Vozes naturais": neural voices from the server (/api/tts), played as
 *    MP3 with the next sentences fetched ahead, lock-screen controls and
 *    playback that keeps going with the screen off.
 *  - "Vozes do aparelho": the device's own voice (Web Speech API, offline),
 *    best-sounding voices first.
 * The sentence being read is highlighted, karaoke-style. Mockup 12.
 */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Gauge,
  MicVocal,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Smartphone,
  Text as TextIcon,
  Timer,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { BookArt } from "@/components/book-art";
import { bookPalette } from "@/lib/faux-books";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  author?: string;
  cover?: string | null;
  chapterLabel: string;
  paragraphs: string[];
  /** Paragraph to start from (where the reader is). */
  startParagraph: number;
  /** Called when the chapter ends and listening should continue. */
  onChapterEnd: () => void;
}

const RATES = [0.8, 1, 1.25, 1.5, 2];
const TIMERS = ["off", "chapter", 15, 30] as const;
type SleepTimer = (typeof TIMERS)[number];
const VOICE_KEY = "bookverse:listen-voice";
/** Server limit per request; longer sentences are split at commas. */
const MAX_PIECE = 600;

interface NaturalVoiceInfo {
  id: string;
  label: string;
  hint: string;
}

type VoiceChoice = { kind: "natural"; id: string } | { kind: "device"; uri: string };

function splitLong(text: string): string[] {
  if (text.length <= MAX_PIECE) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > MAX_PIECE) {
    const window = rest.slice(0, MAX_PIECE);
    const cut = Math.max(
      window.lastIndexOf("; "),
      window.lastIndexOf(", "),
      window.lastIndexOf(": "),
      window.lastIndexOf(" — "),
    );
    const at = cut > MAX_PIECE * 0.4 ? cut + 1 : window.lastIndexOf(" ") || MAX_PIECE;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function splitSentences(paragraphs: string[]): { text: string; para: number }[] {
  const out: { text: string; para: number }[] = [];
  paragraphs.forEach((p, para) => {
    const parts = p.match(/[^.!?…]+[.!?…]+["”»)\]]*\s*|[^.!?…]+$/g) ?? [p];
    for (const part of parts) {
      const t = part.trim();
      if (t) for (const piece of splitLong(t)) out.push({ text: piece, para });
    }
  });
  return out;
}

/** Best-sounding device voices first: Portuguese, then "premium",
 * "enhanced", "natural"/"neural" (Edge, Android) and Google voices. */
function rankDeviceVoices(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const score = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase().replace("_", "-");
    const name = v.name.toLowerCase();
    let s = 0;
    if (lang === "pt-br") s += 30;
    else if (lang.startsWith("pt")) s += 20;
    if (/premium|aprimorad|enhanced|melhorad/.test(name)) s += 12;
    if (/natural|neural|online/.test(name)) s += 12;
    if (/google/.test(name)) s += 6;
    if (!v.localService) s += 2;
    if (
      /eloquence|novelty|bad news|bells|bubbles|boing|jester|organ|trinoids|whisper|zarvox|superstar|cellos|wobble/.test(
        name,
      )
    )
      s -= 40;
    return s;
  };
  const pt = all.filter((v) => v.lang.toLowerCase().startsWith("pt"));
  const pool = pt.length ? pt : all;
  const seen = new Set<string>();
  return [...pool]
    .sort((a, b) => score(b) - score(a))
    .filter((v) => (seen.has(v.name) ? false : (seen.add(v.name), true)));
}

function prettyDeviceName(v: SpeechSynthesisVoice): { label: string; hint: string } {
  const raw = v.name.replace(/^(Microsoft|Google|Apple)\s*/i, "");
  const label =
    raw
      .split(/\s[-–(]/)[0]!
      .replace(/\s+Online.*$/i, "")
      .trim() || raw;
  const quality = /premium|neural|natural|online/i.test(v.name)
    ? "alta qualidade"
    : /enhanced|aprimorad|melhorad/i.test(v.name)
      ? "aprimorada"
      : /google/i.test(v.name)
        ? "Google"
        : "padrão";
  const region = v.lang.toLowerCase().includes("br")
    ? "Brasil"
    : v.lang.toLowerCase().startsWith("pt")
      ? "Portugal"
      : v.lang;
  return { label, hint: `${region} · ${quality}` };
}

function loadChoice(): VoiceChoice | null {
  try {
    const raw = localStorage.getItem(VOICE_KEY);
    return raw ? (JSON.parse(raw) as VoiceChoice) : null;
  } catch {
    return null;
  }
}
function saveChoice(c: VoiceChoice) {
  try {
    localStorage.setItem(VOICE_KEY, JSON.stringify(c));
  } catch {
    // storage unavailable
  }
}

/** Rough speaking time: ~14 characters per second at 1×. */
const secondsFor = (text: string, rate: number) => text.length / 14 / rate;
const clock = (s: number) => {
  const v = Math.max(0, Math.round(s));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

const isApple =
  typeof navigator !== "undefined" &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && "ontouchend" in document));

export function ListenMode({
  open,
  onClose,
  title,
  author,
  cover,
  chapterLabel,
  paragraphs,
  startParagraph,
  onChapterEnd,
}: Props) {
  const pal = bookPalette(title, author);
  const sentences = useMemo(() => splitSentences(paragraphs), [paragraphs]);
  const speechOk = typeof window !== "undefined" && "speechSynthesis" in window;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState(1);
  const [deviceVoices, setDeviceVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [naturalVoices, setNaturalVoices] = useState<NaturalVoiceInfo[] | null>(null);
  const [choice, setChoice] = useState<VoiceChoice | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sleep, setSleep] = useState<SleepTimer>("off");
  const sleepAt = useRef<number | null>(null);
  const playingRef = useRef(false);
  const idxRef = useRef(0);
  /** Bumped on every (re)start so stale async work can bail out. */
  const tokenRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clips = useRef(new Map<string, Promise<string>>());
  const continueNext = useRef(false);

  // Voices: natural ones from the server, the device's own as fallback.
  useEffect(() => {
    if (!open || naturalVoices) return;
    fetch("/api/tts?voices=1")
      .then((r) => (r.ok ? r.json() : { voices: [] }))
      .then((d: { voices?: NaturalVoiceInfo[] }) => setNaturalVoices(d.voices ?? []))
      .catch(() => setNaturalVoices([]));
  }, [open, naturalVoices]);

  useEffect(() => {
    if (!speechOk) return;
    const load = () => setDeviceVoices(rankDeviceVoices(window.speechSynthesis.getVoices()));
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, [speechOk]);

  // Saved choice, or the best available voice.
  useEffect(() => {
    if (choice || naturalVoices === null) return;
    const saved = loadChoice();
    if (saved?.kind === "natural" && naturalVoices.some((v) => v.id === saved.id))
      return setChoice(saved);
    if (saved?.kind === "device" && deviceVoices.some((v) => v.voiceURI === saved.uri))
      return setChoice(saved);
    if (naturalVoices[0]) return setChoice({ kind: "natural", id: naturalVoices[0].id });
    if (deviceVoices[0]) setChoice({ kind: "device", uri: deviceVoices[0].voiceURI });
  }, [choice, naturalVoices, deviceVoices]);

  const deviceVoice =
    choice?.kind === "device" ? deviceVoices.find((v) => v.voiceURI === choice.uri) : undefined;
  const natural = choice?.kind === "natural" ? choice.id : null;
  const supported = !!natural || speechOk;

  // Start where the reader is (or at the top of the next chapter).
  useEffect(() => {
    if (!open) return;
    const first = continueNext.current ? 0 : sentences.findIndex((s) => s.para >= startParagraph);
    const i = Math.max(0, first);
    setIdx(i);
    idxRef.current = i;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sentences]);

  const audio = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      a.setAttribute("playsinline", "");
      audioRef.current = a;
    }
    return audioRef.current;
  };

  const clipUrl = useCallback(
    (i: number, voice: string): Promise<string> | null => {
      const s = sentences[i];
      if (!s) return null;
      const key = `${voice}|${s.text}`;
      let p = clips.current.get(key);
      if (!p) {
        p = fetch(`/api/tts?v=${encodeURIComponent(voice)}&t=${encodeURIComponent(s.text)}`)
          .then((r) => {
            if (!r.ok) throw new Error(String(r.status));
            return r.blob();
          })
          .then((b) => URL.createObjectURL(b));
        p.catch(() => clips.current.delete(key));
        clips.current.set(key, p);
        if (clips.current.size > 40) {
          const oldest = clips.current.keys().next().value!;
          void clips.current
            .get(oldest)
            ?.then((u) => URL.revokeObjectURL(u))
            .catch(() => {});
          clips.current.delete(oldest);
        }
      }
      return p;
    },
    [sentences],
  );

  const stop = useCallback(() => {
    tokenRef.current++;
    playingRef.current = false;
    setPlaying(false);
    setLoading(false);
    audioRef.current?.pause();
    if (speechOk) window.speechSynthesis.cancel();
  }, [speechOk]);

  const finishChapter = useCallback(() => {
    if (sleep === "chapter") return stop();
    stop();
    continueNext.current = true;
    onChapterEnd();
  }, [sleep, stop, onChapterEnd]);

  const speak = useCallback(
    (i: number) => {
      const token = ++tokenRef.current;
      if (speechOk) window.speechSynthesis.cancel();
      audioRef.current?.pause();
      if (i >= sentences.length) return finishChapter();
      if (sleepAt.current && Date.now() > sleepAt.current) return stop();
      idxRef.current = i;
      setIdx(i);
      const next = () => {
        if (playingRef.current && tokenRef.current === token) speak(idxRef.current + 1);
      };

      if (natural) {
        const clip = clipUrl(i, natural);
        // Fetch ahead so the next sentences start without a gap.
        for (let k = 1; k <= 3; k++) clipUrl(i + k, natural);
        setLoading(true);
        clip!
          .then(async (url) => {
            if (tokenRef.current !== token) return;
            const a = audio();
            a.src = url;
            a.playbackRate = rate;
            a.onended = next;
            await a.play();
            setLoading(false);
          })
          .catch(() => {
            if (tokenRef.current !== token) return;
            setLoading(false);
            // Server voice unavailable: carry on with the device's own voice.
            if (deviceVoices[0] || speechOk) {
              toast.message("Voz natural indisponível agora — usando a voz do aparelho.");
              const fallback = deviceVoices[0];
              setChoice(fallback ? { kind: "device", uri: fallback.voiceURI } : null);
            } else stop();
          });
        return;
      }

      if (!speechOk) return stop();
      const u = new SpeechSynthesisUtterance(sentences[i]!.text);
      u.lang = deviceVoice?.lang ?? "pt-BR";
      if (deviceVoice) u.voice = deviceVoice;
      u.rate = rate;
      u.onend = next;
      window.speechSynthesis.speak(u);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sentences, natural, deviceVoice, deviceVoices, rate, speechOk, clipUrl, finishChapter, stop],
  );

  const play = useCallback(() => {
    playingRef.current = true;
    setPlaying(true);
    // A paused natural clip resumes mid-sentence instead of restarting.
    const a = audioRef.current;
    if (natural && a && a.src && a.paused && a.currentTime > 0 && !a.ended) {
      tokenRef.current++;
      const token = tokenRef.current;
      a.onended = () => {
        if (playingRef.current && tokenRef.current === token) speak(idxRef.current + 1);
      };
      void a.play().catch(() => speak(idxRef.current));
      return;
    }
    speak(idxRef.current);
  }, [natural, speak]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    setLoading(false);
    if (natural) audioRef.current?.pause();
    else stop();
  }, [natural, stop]);

  // Next chapter arrived while listening: keep going.
  useEffect(() => {
    if (!open || !continueNext.current) return;
    continueNext.current = false;
    const t = setTimeout(() => play(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences, open]);

  // Speed applies at once; a new voice from the current sentence.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
    if (playingRef.current && !natural) speak(idxRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate]);
  useEffect(() => {
    if (playingRef.current) speak(idxRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice]);

  useEffect(() => {
    sleepAt.current = typeof sleep === "number" ? Date.now() + sleep * 60_000 : null;
  }, [sleep]);

  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);
  useEffect(
    () => () => {
      stop();
      for (const p of clips.current.values())
        void p.then((u) => URL.revokeObjectURL(u)).catch(() => {});
    },
    [stop],
  );

  const jump = useCallback(
    (deltaSeconds: number) => {
      let i = idxRef.current;
      let acc = 0;
      const step = deltaSeconds > 0 ? 1 : -1;
      while (i + step >= 0 && i + step < sentences.length && acc < Math.abs(deltaSeconds)) {
        i += step;
        acc += secondsFor(sentences[i]!.text, rate);
      }
      idxRef.current = i;
      setIdx(i);
      if (playingRef.current) speak(i);
      else if (audioRef.current) audioRef.current.removeAttribute("src");
    },
    [sentences, rate, speak],
  );

  // Lock screen / headphones controls.
  useEffect(() => {
    if (!open || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: chapterLabel,
        artist: author ?? "",
        album: title,
        artwork: cover ? [{ src: cover, sizes: "512x512" }] : [],
      });
      ms.setActionHandler("play", () => play());
      ms.setActionHandler("pause", () => pause());
      ms.setActionHandler("seekbackward", () => jump(-15));
      ms.setActionHandler("seekforward", () => jump(15));
      ms.setActionHandler("previoustrack", () => jump(-15));
      ms.setActionHandler("nexttrack", () => jump(15));
    } catch {
      // older browsers
    }
    return () => {
      for (const a of [
        "play",
        "pause",
        "seekbackward",
        "seekforward",
        "previoustrack",
        "nexttrack",
      ])
        try {
          ms.setActionHandler(a as MediaSessionAction, null);
        } catch {
          // ignore
        }
    };
  }, [open, title, author, cover, chapterLabel, play, pause, jump]);
  useEffect(() => {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator)
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  const choose = (c: VoiceChoice) => {
    saveChoice(c);
    setChoice(c);
    setPickerOpen(false);
  };

  const total = useMemo(
    () => sentences.reduce((a, s) => a + secondsFor(s.text, rate), 0),
    [sentences, rate],
  );
  const elapsed = useMemo(
    () => sentences.slice(0, idx).reduce((a, s) => a + secondsFor(s.text, rate), 0),
    [sentences, idx, rate],
  );
  const prev = sentences[idx - 1]?.text;
  const cur = sentences[idx]?.text;
  const nextText = sentences[idx + 1]?.text;
  const voiceName = natural
    ? (naturalVoices?.find((v) => v.id === natural)?.label ?? "Natural")
    : deviceVoice
      ? prettyDeviceName(deviceVoice).label
      : "Voz";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-reader-action="true"
          role="dialog"
          aria-label="Ouvir o livro"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 36 }}
          className="fixed inset-0 z-[80] overflow-y-auto"
          style={{
            background: `linear-gradient(180deg, ${pal.bg}, color-mix(in oklab, ${pal.bg} 55%, #000))`,
            color: pal.fg,
            fontFamily: "var(--font-sans)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[-40px] top-[60px] h-[360px]"
            style={{
              background: `radial-gradient(closest-side, color-mix(in oklab, ${pal.accent} 25%, transparent), transparent)`,
            }}
          />
          <div className="relative mx-auto flex min-h-full max-w-md flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="grid h-[42px] w-[42px] place-items-center rounded-full"
              >
                <ChevronDown className="h-[26px] w-[26px]" />
              </button>
              <div className="min-w-0 text-center">
                <p className="text-[11px] font-semibold tracking-[0.14em] opacity-65">OUVINDO</p>
                <p className="truncate text-sm font-bold">{title}</p>
              </div>
              <span className="w-[42px]" />
            </div>

            <div className="mx-auto mt-[min(18px,2dvh)] w-[min(190px,18dvh)]">
              <BookArt title={title} author={author} cover={cover} lift eager />
            </div>

            <div className="mt-[26px] px-2">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] opacity-60">
                {chapterLabel}
              </p>
              {!supported ? (
                <p className="mt-3 text-[15px] leading-relaxed opacity-80">
                  Este navegador não tem leitura em voz alta. No celular, use o Chrome ou o Safari
                  atualizados.
                </p>
              ) : (
                <p
                  className="mt-3 max-h-[min(9.5em,20dvh)] overflow-hidden text-[clamp(17px,2.7dvh,21px)] leading-[1.45] [mask-image:linear-gradient(#000_70%,transparent)]"
                  style={{ fontFamily: '"Literata Variable", serif' }}
                  aria-live="polite"
                >
                  {prev && (
                    <span className="opacity-[.38]">
                      {prev.length > 140 ? "…" + prev.slice(-140) : prev}{" "}
                    </span>
                  )}
                  {cur && (
                    <span
                      className="rounded-md px-1 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                      style={{ background: pal.accent, color: pal.bg }}
                    >
                      {cur}
                    </span>
                  )}
                  {nextText && <span className="opacity-60"> {nextText}</span>}
                </p>
              )}
            </div>

            <div className="flex-1" />

            <div className="mt-6 px-2">
              <div className="h-[5px] overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(elapsed / Math.max(1, total)) * 100}%`, background: pal.fg }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs font-semibold opacity-65">
                <span>{clock(elapsed)}</span>
                <span>−{clock(total - elapsed)}</span>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-center gap-[34px]">
              <button
                type="button"
                aria-label="Voltar 15 segundos"
                onClick={() => jump(-15)}
                className="press"
              >
                <RotateCcw className="h-[30px] w-[30px]" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                aria-label={playing ? "Pausar" : "Ouvir"}
                onClick={() => (playing ? pause() : play())}
                disabled={!supported || !choice}
                className="press relative grid h-[78px] w-[78px] place-items-center rounded-full disabled:opacity-50"
                style={{ background: pal.fg, color: pal.bg }}
              >
                {loading && (
                  <span
                    aria-hidden
                    className="absolute inset-[-5px] animate-spin rounded-full border-[3px] border-transparent"
                    style={{ borderTopColor: pal.fg }}
                  />
                )}
                {playing ? (
                  <Pause className="h-[34px] w-[34px]" fill="currentColor" />
                ) : (
                  <Play className="ml-1 h-[34px] w-[34px]" fill="currentColor" />
                )}
              </button>
              <button
                type="button"
                aria-label="Avançar 15 segundos"
                onClick={() => jump(15)}
                className="press"
              >
                <RotateCw className="h-[30px] w-[30px]" strokeWidth={1.8} />
              </button>
            </div>

            <div className="mt-[22px] flex justify-between gap-1.5 text-[12.5px] font-semibold">
              <button
                type="button"
                onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length]!)}
                aria-label="Velocidade"
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[.12] px-2.5"
              >
                <Gauge className="h-[15px] w-[15px]" />{" "}
                {(Number.isInteger(rate) ? rate.toFixed(1) : String(rate)).replace(".", ",")}×
              </button>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                aria-label="Escolher voz"
                className="inline-flex h-9 min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[.12] px-2.5"
              >
                {natural ? (
                  <Sparkles className="h-[15px] w-[15px] shrink-0" />
                ) : (
                  <MicVocal className="h-[15px] w-[15px] shrink-0" />
                )}{" "}
                <span className="truncate">{voiceName}</span>
              </button>
              <button
                type="button"
                onClick={() => setSleep(TIMERS[(TIMERS.indexOf(sleep) + 1) % TIMERS.length]!)}
                aria-label="Timer para parar"
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[.12] px-2.5"
              >
                <Timer className="h-[15px] w-[15px]" />{" "}
                {sleep === "off" ? "Timer" : sleep === "chapter" ? "Fim do cap." : `${sleep} min`}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[.12] px-2.5"
              >
                <TextIcon className="h-[15px] w-[15px]" /> Texto
              </button>
            </div>
          </div>

          <AnimatePresence>
            {pickerOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[81] bg-black/45"
                  onClick={() => setPickerOpen(false)}
                />
                <motion.div
                  role="dialog"
                  aria-label="Escolher voz"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 340, damping: 34 }}
                  className="fixed inset-x-0 bottom-0 z-[82] mx-auto max-h-[78dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[30px] bg-[#fbfaf7] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 text-[#1b1b1b] shadow-2xl dark:bg-[#1c1c1f] dark:text-[#f3f2ee]"
                >
                  <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-black/15 dark:bg-white/20" />
                  <div className="flex items-center justify-between">
                    <p className="font-display text-xl">Escolha a voz</p>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(false)}
                      aria-label="Fechar"
                      className="grid h-9 w-9 place-items-center rounded-full bg-black/5 dark:bg-white/10"
                    >
                      <X className="h-[18px] w-[18px]" />
                    </button>
                  </div>

                  {naturalVoices && naturalVoices.length > 0 && (
                    <>
                      <p className="mb-1.5 mt-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-60">
                        <Sparkles className="h-3.5 w-3.5" /> Vozes naturais
                      </p>
                      <p className="mb-2 text-[12.5px] opacity-65">
                        Narração neural, parecida com audiolivro. Precisa de internet.
                      </p>
                      {naturalVoices.map((v) => (
                        <VoiceRow
                          key={v.id}
                          label={v.label}
                          hint={v.hint}
                          on={natural === v.id}
                          onClick={() => choose({ kind: "natural", id: v.id })}
                        />
                      ))}
                    </>
                  )}

                  {deviceVoices.length > 0 && (
                    <>
                      <p className="mb-1.5 mt-5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-60">
                        <Smartphone className="h-3.5 w-3.5" /> Vozes do aparelho
                      </p>
                      <p className="mb-2 text-[12.5px] opacity-65">Funcionam sem internet.</p>
                      {deviceVoices.slice(0, 12).map((v) => {
                        const n = prettyDeviceName(v);
                        return (
                          <VoiceRow
                            key={v.voiceURI}
                            label={n.label}
                            hint={n.hint}
                            on={choice?.kind === "device" && choice.uri === v.voiceURI}
                            onClick={() => choose({ kind: "device", uri: v.voiceURI })}
                          />
                        );
                      })}
                      <p className="mt-3 rounded-2xl bg-black/[.04] p-3 text-[12.5px] leading-relaxed opacity-80 dark:bg-white/[.06]">
                        {isApple
                          ? "Dica: no iPhone, baixe vozes melhores em Ajustes › Acessibilidade › Conteúdo Falado › Vozes › Português (Brasil) — escolha uma “Premium” ou “Aprimorada”."
                          : "Dica: no Android, instale vozes melhores em Configurações › Acessibilidade › Saída de texto para fala › Google › Instalar dados de voz › Português (Brasil)."}
                      </p>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function VoiceRow({
  label,
  hint,
  on,
  onClick,
}: {
  label: string;
  hint: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
      style={on ? { background: "color-mix(in oklab, currentColor 8%, transparent)" } : undefined}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{label}</span>
        <span className="block truncate text-xs opacity-60">{hint}</span>
      </span>
      {on && <Check className="h-[18px] w-[18px] shrink-0" strokeWidth={2.6} />}
    </button>
  );
}
