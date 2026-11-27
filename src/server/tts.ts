/**
 * Natural voices for "Ouvir": each sentence is spoken by a neural model on
 * Vercel AI Gateway and returned as MP3. Identical sentences are cached by
 * the CDN for a year, so a book that many people listen to is only paid
 * for once. Per-address limits keep one listener from running up the bill;
 * set TTS_DISABLED=1 to switch the feature off (the app falls back to the
 * device's own voice).
 */

/** tts-1 stretches the gateway's free credit; set TTS_MODEL=openai/tts-1-hd
 * (or another speech model) once the account has paid credits. */
const MODEL = process.env.TTS_MODEL || "openai/tts-1";

export interface NaturalVoice {
  id: string;
  label: string;
  hint: string;
  model: string;
  voice: string;
  instructions?: string;
  /** Kept out of the picker (still callable by id). */
  hidden?: boolean;
}

/** Voices offered to listeners, best for Portuguese first. */
export const NATURAL_VOICES: NaturalVoice[] = [
  {
    id: "nova",
    label: "Nova",
    hint: "Feminina, calorosa",
    model: MODEL,
    voice: "nova",
  },
  {
    id: "onyx",
    label: "Onyx",
    hint: "Masculina, grave",
    model: MODEL,
    voice: "onyx",
  },
  {
    id: "shimmer",
    label: "Shimmer",
    hint: "Feminina, suave",
    model: MODEL,
    voice: "shimmer",
  },
  {
    id: "echo",
    label: "Echo",
    hint: "Masculina, serena",
    model: MODEL,
    voice: "echo",
  },
];

const MAX_CHARS = 700;
/** Out of credit / no access: stop offering natural voices for a while. */
let restingUntil = 0;
/** Sentences per address per hour (~3–4 hours of listening). */
const HOURLY_LIMIT = 1500;
const hits = new Map<string, { n: number; reset: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + 3_600_000 });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return false;
  }
  h.n++;
  return h.n > HOURLY_LIMIT;
}

function gatewayKey(request: Request): string | null {
  return (
    process.env.AI_GATEWAY_API_KEY ||
    request.headers.get("x-vercel-oidc-token") ||
    process.env.VERCEL_OIDC_TOKEN ||
    null
  );
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

async function synthesize(key: string, v: NaturalVoice, text: string): Promise<ArrayBuffer> {
  const res = await fetch("https://ai-gateway.vercel.sh/v4/ai/speech-model", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "ai-gateway-protocol-version": "0.0.1",
      "ai-speech-model-specification-version": "4",
      "ai-model-id": v.model,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice: v.voice,
      outputFormat: "mp3",
      language: "pt",
      ...(v.instructions ? { instructions: v.instructions } : {}),
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`gateway ${res.status} ${detail}`);
  }
  const data = (await res.json()) as { audio?: string | { data?: string } };
  const b64 = typeof data.audio === "string" ? data.audio : data.audio?.data;
  if (!b64) throw new Error("gateway returned no audio");
  const buf = Buffer.from(b64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** GET /api/tts?v=nova&t=Texto  → audio/mpeg
 *  GET /api/tts?voices=1         → { voices } (empty when unavailable) */
export async function handleTts(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const key = gatewayKey(request);
  const enabled = !!key && process.env.TTS_DISABLED !== "1" && Date.now() > restingUntil;

  if (url.searchParams.has("voices")) {
    return json(
      {
        voices: enabled
          ? NATURAL_VOICES.filter((v) => !v.hidden).map(({ id, label, hint }) => ({
              id,
              label,
              hint,
            }))
          : [],
      },
      200,
      { "Cache-Control": "public, max-age=300, s-maxage=300" },
    );
  }
  if (!enabled) return json({ error: "not-configured" }, 503);

  // Preview-only: which speech models does this account reach, and how do
  // they sound in Brazilian Portuguese? (Removed before production.)
  if (url.searchParams.has("probe") && process.env.VERCEL_ENV !== "production") {
    const sample =
      "Era uma vez, numa pequena cidade do interior, uma menina que adorava ler histórias.";
    const candidates: [string, string][] = [
      ["elevenlabs/eleven-multilingual-v2", "hpp4J3VqNfWAUOO0d1Us"],
      ["elevenlabs/eleven-v4", "hpp4J3VqNfWAUOO0d1Us"],
      ["elevenlabs/eleven-flash-v2.5", "hpp4J3VqNfWAUOO0d1Us"],
      ["microsoft/mai-voice-2.1", "pt-BR-FranciscaNeural"],
      ["microsoft/mai-voice-2", "pt-BR-FranciscaNeural"],
      ["mistral/voxtral-mini-tts-3", "default"],
      ["spacexai/grok-tts", "eve"],
      ["fish-audio/s2.1-pro", "default"],
      ["google/gemini-3.8-flash-tts", "Kore"],
      ["openai/tts-1-hd", "nova"],
    ];
    const many = url.searchParams.get("voices2");
    if (many) {
      const model = url.searchParams.get("model") || "elevenlabs/eleven-multilingual-v2";
      for (const v of many.split(",")) candidates.unshift([model, v]);
      candidates.splice(many.split(",").length);
    }
    const only = many ? null : url.searchParams.get("probe");
    const list = only && only !== "1" ? candidates.filter(([m]) => m.includes(only)) : candidates;
    const voiceOverride = url.searchParams.get("voice");
    if (url.searchParams.has("play") && list[0]) {
      const [model, voice] = list[0];
      try {
        const audio = await synthesize(
          key,
          { id: "p", label: "", hint: "", model, voice: voiceOverride || voice },
          sample,
        );
        return new Response(audio, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      } catch (e) {
        return json({ model, error: String(e) }, 502);
      }
    }
    const results = await Promise.all(
      list.map(async ([model, voice]) => {
        const t0 = Date.now();
        try {
          const a = await synthesize(
            key,
            { id: "p", label: "", hint: "", model, voice: voiceOverride || voice },
            sample,
          );
          return { model, voice, ok: true, bytes: a.byteLength, ms: Date.now() - t0 };
        } catch (e) {
          return { model, voice, ok: false, error: String(e).slice(0, 400), ms: Date.now() - t0 };
        }
      }),
    );
    return json({ results });
  }

  const text = (url.searchParams.get("t") ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  const voice =
    NATURAL_VOICES.find((v) => v.id === url.searchParams.get("v")) ?? NATURAL_VOICES[0]!;
  if (!text) return json({ error: "Texto vazio." }, 400);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (limited(ip)) return json({ error: "limit" }, 429);

  try {
    const audio = await synthesize(key, voice, text);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        // Same sentence + voice → same audio: let the CDN keep it.
        "Cache-Control": "public, max-age=604800, s-maxage=31536000, immutable",
        "X-TTS-Model": voice.model,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tts]", voice.model, msg);
    if (/gateway (401|402|403|429)/.test(msg)) restingUntil = Date.now() + 30 * 60_000;
    return json({ error: "unavailable" }, 502);
  }
}
