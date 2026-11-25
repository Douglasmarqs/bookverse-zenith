/**
 * Ouvir — any book becomes audio, read by the device's own voice (Web
 * Speech API, offline on most phones). The sentence being read is
 * highlighted in the text, karaoke-style. Mockup 12.
 */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Gauge,
  MicVocal,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Text as TextIcon,
  Timer,
} from "lucide-react";

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

function splitSentences(paragraphs: string[]): { text: string; para: number }[] {
  const out: { text: string; para: number }[] = [];
  paragraphs.forEach((p, para) => {
    const parts = p.match(/[^.!?…]+[.!?…]+["”»)\]]*\s*|[^.!?…]+$/g) ?? [p];
    for (const part of parts) {
      const t = part.trim();
      if (t) out.push({ text: t, para });
    }
  });
  return out;
}

/** Rough speaking time: ~14 characters per second at 1×. */
const secondsFor = (text: string, rate: number) => text.length / 14 / rate;
const clock = (s: number) => {
  const v = Math.max(0, Math.round(s));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

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
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceIdx, setVoiceIdx] = useState(0);
  const [sleep, setSleep] = useState<SleepTimer>("off");
  const sleepAt = useRef<number | null>(null);
  const playingRef = useRef(false);
  const idxRef = useRef(0);

  // Start where the reader is.
  useEffect(() => {
    if (!open) return;
    const first = sentences.findIndex((s) => s.para >= startParagraph);
    const i = Math.max(0, first);
    setIdx(i);
    idxRef.current = i;
  }, [open, sentences, startParagraph]);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      const pt = all.filter((v) => v.lang.toLowerCase().startsWith("pt"));
      const br = pt.filter((v) => v.lang.toLowerCase() === "pt-br");
      setVoices(
        br.length
          ? [...br, ...pt.filter((v) => !br.includes(v))]
          : pt.length
            ? pt
            : all.slice(0, 4),
      );
    };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, [supported]);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const speak = useCallback(
    (i: number) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      if (i >= sentences.length) {
        if (sleep === "chapter") {
          stop();
          return;
        }
        stop();
        onChapterEnd();
        return;
      }
      if (sleepAt.current && Date.now() > sleepAt.current) {
        stop();
        return;
      }
      idxRef.current = i;
      setIdx(i);
      const u = new SpeechSynthesisUtterance(sentences[i]!.text);
      u.lang = voices[voiceIdx]?.lang ?? "pt-BR";
      if (voices[voiceIdx]) u.voice = voices[voiceIdx]!;
      u.rate = rate;
      u.onend = () => {
        if (playingRef.current) speak(idxRef.current + 1);
      };
      window.speechSynthesis.speak(u);
    },
    [supported, sentences, sleep, stop, onChapterEnd, voices, voiceIdx, rate],
  );

  const play = () => {
    playingRef.current = true;
    setPlaying(true);
    speak(idxRef.current);
  };

  // Changing speed or voice applies from the current sentence.
  useEffect(() => {
    if (playingRef.current) speak(idxRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate, voiceIdx]);

  useEffect(() => {
    sleepAt.current = typeof sleep === "number" ? Date.now() + sleep * 60_000 : null;
  }, [sleep]);

  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);
  useEffect(() => () => stop(), [stop]);

  const jump = (deltaSeconds: number) => {
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
  const next = sentences[idx + 1]?.text;
  const voiceName = (voices[voiceIdx]?.name ?? "Padrão")
    .replace(/^(Microsoft|Google|Apple)\s*/i, "")
    .split(/[\s(-]/)[0];

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
                  {next && <span className="opacity-60"> {next}</span>}
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
                onClick={() => (playing ? stop() : play())}
                disabled={!supported}
                className="press grid h-[78px] w-[78px] place-items-center rounded-full disabled:opacity-50"
                style={{ background: pal.fg, color: pal.bg }}
              >
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
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[.12] px-2.5"
              >
                <Gauge className="h-[15px] w-[15px]" />{" "}
                {(Number.isInteger(rate) ? rate.toFixed(1) : String(rate)).replace(".", ",")}×
              </button>
              <button
                type="button"
                onClick={() => voices.length && setVoiceIdx((v) => (v + 1) % voices.length)}
                className="inline-flex h-9 min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[.12] px-2.5"
              >
                <MicVocal className="h-[15px] w-[15px] shrink-0" />{" "}
                <span className="truncate">{voiceName}</span>
              </button>
              <button
                type="button"
                onClick={() => setSleep(TIMERS[(TIMERS.indexOf(sleep) + 1) % TIMERS.length]!)}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
