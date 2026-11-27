/**
 * Natural voices for "Ouvir": each sentence is spoken by a neural model on
 * Vercel AI Gateway and returned as MP3. Identical sentences are cached by
 * the CDN for a year, so a book that many people listen to is only paid
 * for once. Per-address limits keep one listener from running up the bill;
 * set TTS_DISABLED=1 to switch the feature off (the app falls back to the
 * device's own voice).
 */

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
    model: "openai/tts-1-hd",
    voice: "nova",
  },
  {
    id: "onyx",
    label: "Onyx",
    hint: "Masculina, grave",
    model: "openai/tts-1-hd",
    voice: "onyx",
  },
  {
    id: "shimmer",
    label: "Shimmer",
    hint: "Feminina, suave",
    model: "openai/tts-1-hd",
    voice: "shimmer",
  },
  {
    id: "echo",
    label: "Echo",
    hint: "Masculina, serena",
    model: "openai/tts-1-hd",
    voice: "echo",
  },
  ...["Kore", "Aoede", "Charon", "Puck"].flatMap((name) => [
    {
      id: `g-${name.toLowerCase()}`,
      label: name,
      hint: "Gemini",
      model: "google/gemini-3.8-flash-tts",
      voice: name,
      hidden: true,
    },
    {
      id: `gl-${name.toLowerCase()}`,
      label: name,
      hint: "Gemini Lite",
      model: "google/gemini-3.8-flash-lite-tts",
      voice: name,
      hidden: true,
    },
  ]),
  ...["alloy", "nova"].map((name) => ({
    id: `fast-${name}`,
    label: name,
    hint: "tts-1",
    model: "openai/tts-1",
    voice: name,
    hidden: true,
  })),
];

const MAX_CHARS = 700;
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
  const enabled = !!key && process.env.TTS_DISABLED !== "1";

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
    console.error("[tts]", voice.model, err instanceof Error ? err.message : err);
    return json({ error: "unavailable" }, 502);
  }
}
