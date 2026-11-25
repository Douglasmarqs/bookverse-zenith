/**
 * Ambient soundscapes for the reader, synthesised live with the Web Audio
 * API — no audio files to download, works offline, loops forever without
 * a seam. Each scene is filtered noise shaped to feel like its namesake.
 */
import type { AmbientSound } from "./reader-store";

type Scene = { stop: () => void; setVolume: (v: number) => void };

let ctx: AudioContext | null = null;
let current: Scene | null = null;
let currentKind: AmbientSound = "off";

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Two seconds of looping noise. "brown" is deep, "pink" is soft hiss. */
function noiseBuffer(ac: AudioContext, kind: "brown" | "pink" | "white"): AudioBuffer {
  const length = ac.sampleRate * 2;
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
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
  return buffer;
}

function loop(ac: AudioContext, buffer: AudioBuffer) {
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

function build(kind: Exclude<AmbientSound, "off">, ac: AudioContext, volume: number): Scene {
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  master.gain.linearRampToValueAtTime(volume, ac.currentTime + 1.5);
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];

  if (kind === "chuva") {
    const src = loop(ac, noiseBuffer(ac, "pink"));
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 400;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 6500;
    src.connect(hp).connect(lp).connect(master);
    nodes.push(src);
    // occasional heavier drops
    const drops = () => {
      const t = ac.currentTime;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      const s = loop(ac, noiseBuffer(ac, "white"));
      const bp = ac.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2500 + Math.random() * 2500;
      s.connect(bp).connect(g).connect(master);
      s.start(t);
      s.stop(t + 0.1);
      timers.push(setTimeout(drops, 60 + Math.random() * 260));
    };
    drops();
  } else if (kind === "lareira") {
    const src = loop(ac, noiseBuffer(ac, "brown"));
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500;
    src.connect(lp).connect(master);
    nodes.push(src);
    const crackle = () => {
      const t = ac.currentTime;
      const g = ac.createGain();
      const peak = 0.15 + Math.random() * 0.5;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05);
      const s = loop(ac, noiseBuffer(ac, "white"));
      const hp = ac.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1500 + Math.random() * 3000;
      s.connect(hp).connect(g).connect(master);
      s.start(t);
      s.stop(t + 0.1);
      timers.push(setTimeout(crackle, 80 + Math.random() * 900));
    };
    crackle();
  } else if (kind === "mar") {
    const src = loop(ac, noiseBuffer(ac, "pink"));
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const swell = ac.createGain();
    swell.gain.value = 0.5;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 0.45;
    lfo.connect(lfoGain).connect(swell.gain);
    src.connect(lp).connect(swell).connect(master);
    nodes.push(src, lfo);
  } else {
    // "foco": calm brown noise, commonly used to mask distractions
    const src = loop(ac, noiseBuffer(ac, "brown"));
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;
    src.connect(lp).connect(master);
    nodes.push(src);
  }

  nodes.forEach((n) => n.start());
  return {
    setVolume: (v) => master.gain.linearRampToValueAtTime(v, ac.currentTime + 0.3),
    stop: () => {
      timers.forEach(clearTimeout);
      const t = ac.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.8);
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
  if (kind === currentKind) {
    current?.setVolume(volume);
    return;
  }
  current?.stop();
  current = null;
  currentKind = kind;
  if (kind === "off") return;
  const ac = audio();
  if (!ac) return;
  current = build(kind, ac, volume);
}

export function stopAmbient() {
  setAmbient("off");
}
