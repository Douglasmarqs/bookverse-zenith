/**
 * Ambient soundscapes for the reader, synthesised live with the Web Audio
 * API — no audio files to download, works offline, loops forever without
 * a seam. Each scene is layered, stereo filtered noise shaped to feel like
 * its namesake.
 *
 * iPhone detail: Web Audio follows the ringer switch by default, so with
 * the phone on silent nothing would play. We ask for the "playback" audio
 * session (Safari 17+) and, for older iOS, keep a silent <audio> element
 * looping — either one makes iOS treat this as media, like a music app.
 */
import type { AmbientSound } from "./reader-store";

type Scene = { stop: () => void; setVolume: (v: number) => void };

let ctx: AudioContext | null = null;
let current: Scene | null = null;
let currentKind: AmbientSound = "off";
let unlockEl: HTMLAudioElement | null = null;
let watching = false;

/** A tiny silent WAV, generated once (no file to ship). */
function silentWavUrl(): string {
  const rate = 8000;
  const samples = rate / 2;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

/** Lets sound play with the iPhone's silent switch on. Must run inside a
 * user gesture (a tap) the first time. */
function preferMediaPlayback() {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch {
    // not supported
  }
  if (!/iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) || !("ontouchend" in document)) return;
  if (!unlockEl) {
    unlockEl = document.createElement("audio");
    unlockEl.setAttribute("x-webkit-airplay", "deny");
    unlockEl.preload = "auto";
    unlockEl.loop = true;
    unlockEl.src = silentWavUrl();
  }
  void unlockEl.play().catch(() => {});
}

function releaseMediaPlayback() {
  unlockEl?.pause();
}

/** The soundscape belongs to the open book: it pauses whenever the app
 * leaves the screen (home button, app switcher, lock) — the "playback"
 * audio session would otherwise keep it going in the background — and
 * comes back when you return to the book. Calls/alarms that suspend audio
 * are recovered the same way. Closing the page stops it for good. */
function watchInterruptions() {
  if (watching || typeof document === "undefined") return;
  watching = true;
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      if (ctx && ctx.state === "running") void ctx.suspend().catch(() => {});
      unlockEl?.pause();
      return;
    }
    revive();
  };
  const revive = () => {
    if (document.visibilityState !== "visible" || currentKind === "off" || !ctx) return;
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    if (unlockEl?.paused) void unlockEl.play().catch(() => {});
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pointerdown", revive, { passive: true });
  window.addEventListener("pagehide", () => stopAmbient());
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state !== "running") void ctx.resume().catch(() => {});
  return ctx;
}

const bufferCache = new Map<string, AudioBuffer>();

/** Eight seconds of looping stereo noise, each channel independent so the
 * sound feels wide. "brown" is deep, "pink" is soft hiss. */
function noiseBuffer(ac: AudioContext, kind: "brown" | "pink" | "white"): AudioBuffer {
  const key = `${kind}:${ac.sampleRate}`;
  const cached = bufferCache.get(key);
  if (cached) return cached;
  const length = ac.sampleRate * 8;
  const buffer = ac.createBuffer(2, length, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let last = 0;
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === "brown") {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else if (kind === "pink") {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        data[i] = white;
      }
    }
    // Crossfade the tail into the head so the loop has no click.
    const fade = Math.floor(ac.sampleRate * 0.25);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] = data[i]! * t + data[length - fade + i]! * (1 - t);
    }
  }
  bufferCache.set(key, buffer);
  return buffer;
}

function loop(ac: AudioContext, buffer: AudioBuffer, offset = Math.random() * 6) {
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  (src as AudioBufferSourceNode & { __offset?: number }).__offset = offset;
  return src;
}

function filter(ac: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7) {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

function gain(ac: AudioContext, value: number) {
  const g = ac.createGain();
  g.gain.value = value;
  return g;
}

/** A short burst of filtered noise — a raindrop, a spark, a pebble. */
function burst(
  ac: AudioContext,
  out: AudioNode,
  {
    peak,
    attack,
    decay,
    type,
    freq,
    pan,
  }: {
    peak: number;
    attack: number;
    decay: number;
    type: BiquadFilterType;
    freq: number;
    pan: number;
  },
) {
  const t = ac.currentTime + 0.01;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  const s = ac.createBufferSource();
  s.buffer = noiseBuffer(ac, "white");
  const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
  if (p) p.pan.value = pan;
  const f = filter(ac, type, freq, type === "bandpass" ? 4 : 0.7);
  s.connect(f).connect(g);
  if (p) g.connect(p).connect(out);
  else g.connect(out);
  s.start(t, Math.random() * 7);
  s.stop(t + attack + decay + 0.05);
}

function build(kind: Exclude<AmbientSound, "off">, ac: AudioContext, volume: number): Scene {
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.linearRampToValueAtTime(volume, ac.currentTime + 1.5);
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const every = (fn: () => void, min: number, spread: number) => {
    const tick = () => {
      fn();
      timers.push(setTimeout(tick, min + Math.random() * spread));
    };
    timers.push(setTimeout(tick, min));
  };

  if (kind === "chuva") {
    // Steady downpour (hiss) + distant rumble on the roof + single drops.
    const hiss = loop(ac, noiseBuffer(ac, "pink"));
    const hissLevel = gain(ac, 0.8);
    hiss
      .connect(filter(ac, "highpass", 500))
      .connect(filter(ac, "lowpass", 7000))
      .connect(hissLevel)
      .connect(master);
    const roof = loop(ac, noiseBuffer(ac, "brown"));
    roof
      .connect(filter(ac, "lowpass", 380))
      .connect(gain(ac, 0.55))
      .connect(master);
    // Gusts: the downpour gets heavier and lighter.
    const gust = ac.createOscillator();
    gust.frequency.value = 0.06;
    gust.connect(gain(ac, 0.18)).connect(hissLevel.gain);
    nodes.push(hiss, roof, gust);
    every(
      () =>
        burst(ac, master, {
          peak: 0.08 + Math.random() * 0.22,
          attack: 0.003,
          decay: 0.04 + Math.random() * 0.06,
          type: "bandpass",
          freq: 1800 + Math.random() * 4200,
          pan: Math.random() * 1.6 - 0.8,
        }),
      40,
      220,
    );
  } else if (kind === "lareira") {
    // Low roar of the flames that breathes, plus crackles and pops.
    const roar = loop(ac, noiseBuffer(ac, "brown"));
    const roarLevel = gain(ac, 0.9);
    roar
      .connect(filter(ac, "lowpass", 420))
      .connect(roarLevel)
      .connect(master);
    const flicker = ac.createOscillator();
    flicker.frequency.value = 0.35;
    flicker.connect(gain(ac, 0.25)).connect(roarLevel.gain);
    const hiss = loop(ac, noiseBuffer(ac, "pink"));
    hiss
      .connect(filter(ac, "bandpass", 2600, 0.6))
      .connect(gain(ac, 0.05))
      .connect(master);
    nodes.push(roar, flicker, hiss);
    every(
      () => {
        const n = Math.random() < 0.25 ? 2 + Math.floor(Math.random() * 3) : 1;
        for (let i = 0; i < n; i++)
          timers.push(
            setTimeout(
              () =>
                burst(ac, master, {
                  peak: 0.12 + Math.random() * 0.45,
                  attack: 0.001,
                  decay: 0.015 + Math.random() * 0.05,
                  type: "highpass",
                  freq: 1200 + Math.random() * 3500,
                  pan: Math.random() * 1.2 - 0.6,
                }),
              i * (15 + Math.random() * 40),
            ),
          );
      },
      90,
      700,
    );
  } else if (kind === "mar") {
    // Waves: the surf swells and brightens, then pulls back.
    const surf = loop(ac, noiseBuffer(ac, "pink"));
    const lp = filter(ac, "lowpass", 700);
    const swell = gain(ac, 0.55);
    const wave = ac.createOscillator();
    wave.frequency.value = 0.08;
    wave.connect(gain(ac, 0.45)).connect(swell.gain);
    wave.connect(gain(ac, 600)).connect(lp.frequency);
    surf.connect(lp).connect(swell).connect(master);
    const deep = loop(ac, noiseBuffer(ac, "brown"));
    deep
      .connect(filter(ac, "lowpass", 200))
      .connect(gain(ac, 0.6))
      .connect(master);
    nodes.push(surf, wave, deep);
  } else {
    // "foco": calm brown noise, commonly used to mask distractions.
    const src = loop(ac, noiseBuffer(ac, "brown"));
    src.connect(filter(ac, "lowpass", 1100)).connect(master);
    nodes.push(src);
  }

  nodes.forEach((n) => {
    const offset = (n as AudioBufferSourceNode & { __offset?: number }).__offset;
    if (offset !== undefined) (n as AudioBufferSourceNode).start(0, offset);
    else n.start();
  });
  return {
    setVolume: (v) => {
      const t = ac.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + 0.25);
    },
    stop: () => {
      timers.forEach(clearTimeout);
      const t = ac.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0.0001, t + 0.8);
      setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.stop();
          } catch {
            // already stopped
          }
        });
        master.disconnect();
      }, 900);
    },
  };
}

/** Starts, switches or stops the soundscape. Call from a user gesture the
 * first time — browsers only allow audio after an interaction. */
export function setAmbient(kind: AmbientSound, volume = 0.35) {
  if (kind !== "off" && typeof window !== "undefined") {
    preferMediaPlayback();
    watchInterruptions();
  }
  if (kind === currentKind) {
    if (ctx && ctx.state !== "running") void ctx.resume().catch(() => {});
    current?.setVolume(volume);
    return;
  }
  current?.stop();
  current = null;
  currentKind = kind;
  if (kind === "off") {
    releaseMediaPlayback();
    // Let the fade finish, then put the audio engine to sleep.
    const sleeping = ctx;
    setTimeout(() => {
      if (currentKind === "off" && sleeping?.state === "running")
        void sleeping.suspend().catch(() => {});
    }, 1000);
    return;
  }
  const ac = audio();
  if (!ac) return;
  current = build(kind, ac, volume);
}

export function stopAmbient() {
  setAmbient("off");
}

/** For tests and the panel: what's playing right now. */
export function ambientState(): { kind: AmbientSound; running: boolean } {
  return { kind: currentKind, running: !!ctx && ctx.state === "running" && currentKind !== "off" };
}
