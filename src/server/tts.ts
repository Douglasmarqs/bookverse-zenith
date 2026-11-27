/**
 * Natural voices for "Ouvir": each passage (a few sentences) is spoken by a neural model on
 * Vercel AI Gateway and returned as MP3. Identical sentences are cached by
 * the CDN for a year, so a book that many people listen to is only paid
 * for once. Per-address limits keep one listener from running up the bill;
 * set TTS_DISABLED=1 to switch the feature off (the app falls back to the
 * device's own voice).
 */

/**
 * ElevenLabs Multilingual is the most natural Portuguese on the gateway.
 * The same ElevenLabs voice id works on every ElevenLabs model, so when
 * one model is at its rate limit the next one keeps the *same* voice; the
 * OpenAI voice is only the last resort. TTS_MODEL forces a single model.
 */
const ELEVEN_CHAIN = [
  "elevenlabs/eleven-multilingual-v2",
  "elevenlabs/eleven-v4",
  "elevenlabs/eleven-flash-v2.5",
];

export interface NaturalVoice {
  id: string;
  label: string;
  hint: string;
  /** Provider voice id (ElevenLabs). */
  voice: string;
  /** OpenAI voice used when every ElevenLabs model is busy. */
  backup: "nova" | "onyx" | "shimmer" | "echo";
  /** Kept out of the picker (still callable by id). */
  hidden?: boolean;
}

/** Voices offered to listeners, best for Brazilian Portuguese first. */
export const NATURAL_VOICES: NaturalVoice[] = [
  {
    id: "bella",
    label: "Bella",
    hint: "Feminina, calorosa",
    voice: "hpp4J3VqNfWAUOO0d1Us",
    backup: "nova",
  },
  {
    id: "daniel",
    label: "Daniel",
    hint: "Masculina, grave · narrador",
    voice: "onwK4e9ZLuTAKqWW03F9",
    backup: "onyx",
  },
  {
    id: "sarah",
    label: "Sarah",
    hint: "Feminina, suave",
    voice: "EXAVITQu4vr4xnSDxMaL",
    backup: "shimmer",
  },
  {
    id: "george",
    label: "George",
    hint: "Masculina, contador de histórias",
    voice: "JBFqnCBsd6RMkjVDRZzb",
    backup: "echo",
  },
  {
    id: "lily",
    label: "Lily",
    hint: "Feminina, clara",
    voice: "pFZP5JQG7iQjIQuC4Bku",
    backup: "nova",
  },
  {
    id: "roger",
    label: "Roger",
    hint: "Masculina, tranquila",
    voice: "CwhRBWXzGAHq8TQ4Fs17",
    backup: "echo",
  },
  // Earlier ids, so a saved choice keeps working.
  {
    id: "nova",
    label: "Nova",
    hint: "",
    voice: "hpp4J3VqNfWAUOO0d1Us",
    backup: "nova",
    hidden: true,
  },
  {
    id: "onyx",
    label: "Onyx",
    hint: "",
    voice: "onwK4e9ZLuTAKqWW03F9",
    backup: "onyx",
    hidden: true,
  },
  {
    id: "shimmer",
    label: "Shimmer",
    hint: "",
    voice: "EXAVITQu4vr4xnSDxMaL",
    backup: "shimmer",
    hidden: true,
  },
  {
    id: "echo",
    label: "Echo",
    hint: "",
    voice: "JBFqnCBsd6RMkjVDRZzb",
    backup: "echo",
    hidden: true,
  },
];

/** Models that just answered 429, and until when to skip them. */
const busyUntil = new Map<string, number>();

function attempts(v: NaturalVoice): { model: string; voice: string }[] {
  const forced = process.env.TTS_MODEL;
  if (forced) return [{ model: forced, voice: forced.startsWith("openai/") ? v.backup : v.voice }];
  return [
    ...ELEVEN_CHAIN.map((model) => ({ model, voice: v.voice })),
    { model: "openai/tts-1", voice: v.backup },
  ];
}

const MAX_CHARS = 700;
/** Out of credit / no access: stop offering natural voices for a while. */
let restingUntil = 0;
/** Passages per address per hour (~2–3 hours of listening). */
const HOURLY_LIMIT = 400;
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

class GatewayError extends Error {
  constructor(
    public status: number,
    detail: string,
    public retryAfter = 0,
  ) {
    super(`gateway ${status} ${detail}`);
  }
}

async function synthesize(
  key: string,
  v: { model: string; voice: string },
  text: string,
): Promise<ArrayBuffer> {
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
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    const after = Number(/Retry after (\d+)s/i.exec(detail)?.[1] ?? res.headers.get("retry-after"));
    throw new GatewayError(res.status, detail, Number.isFinite(after) ? after : 0);
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

  const text = (url.searchParams.get("t") ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  const voice =
    NATURAL_VOICES.find((v) => v.id === url.searchParams.get("v")) ?? NATURAL_VOICES[0]!;
  if (!text) return json({ error: "Texto vazio." }, 400);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (limited(ip)) return json({ error: "limit" }, 429);

  let lastError = "";
  let outOfCredit = false;
  for (const attempt of attempts(voice)) {
    if ((busyUntil.get(attempt.model) ?? 0) > Date.now()) continue;
    try {
      const audio = await synthesize(key, attempt, text);
      return new Response(audio, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(audio.byteLength),
          // Same passage + voice → same audio: let the CDN keep it.
          "Cache-Control": "public, max-age=604800, s-maxage=31536000, immutable",
          "X-TTS-Model": attempt.model,
        },
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const status = err instanceof GatewayError ? err.status : 0;
      console.error("[tts]", attempt.model, lastError);
      if (status === 429) {
        const wait = err instanceof GatewayError && err.retryAfter ? err.retryAfter : 20;
        busyUntil.set(attempt.model, Date.now() + wait * 1000);
      } else if (status === 401 || status === 402) {
        outOfCredit = true;
        break;
      } else if (status === 403) {
        // No access to this model on this plan: skip it for a while.
        busyUntil.set(attempt.model, Date.now() + 30 * 60_000);
      }
    }
  }
  // Out of credit: stop offering natural voices for a while (the app
  // falls back to the device's own voice).
  if (outOfCredit) restingUntil = Date.now() + 30 * 60_000;
  return json({ error: "unavailable", detail: lastError.slice(0, 120) }, 502);
}
