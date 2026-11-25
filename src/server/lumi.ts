/**
 * Lumi on our own server: same prompt and limits as the Firebase function,
 * but works for everyone (no account or anonymous sign-in needed). Uses
 * GROQ_API_KEY from the host's environment; without it, answers 503 and
 * the app falls back to the Firebase function.
 */
const MODEL = "openai/gpt-oss-120b";
const VISION_MODEL = "qwen/qwen3.6-27b";
const MAX_MESSAGES = 20;
const MAX_LEN = 4000;

interface Msg {
  role: "user" | "assistant";
  text: string;
}
interface Ctx {
  bookTitle?: string;
  bookAuthor?: string;
  chapterTitle?: string;
  chapterExcerpt?: string;
  selectedText?: string;
  positionLabel?: string;
  pageImageDataUrl?: string;
}

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function systemPrompt(c: Ctx | null): string {
  let p =
    "Você é Lumi, uma coruja bibliotecária e companhia de leitura dentro do app BookVerse. " +
    "Seu tom é caloroso, culto e conciso — respostas curtas e úteis, sem enrolação, em português do Brasil. " +
    "Você ajuda a resumir capítulos, explicar trechos difíceis, dar contexto histórico/cultural e recomendar livros parecidos. " +
    "Você também pode identificar personagens apenas pelo contexto fornecido, criar perguntas de revisão e flashcards curtos. " +
    "Nunca revele acontecimentos posteriores à posição informada e nunca invente fatos ausentes do contexto. " +
    "Nunca reproduza trechos extensos protegidos por direitos autorais; prefira parafrasear e resumir com suas próprias palavras. " +
    "Use no máximo 120 palavras, salvo se pedirem mais.";
  if (!c) return p;
  if (c.bookTitle)
    p += `\n\nO leitor está lendo agora: "${s(c.bookTitle, 200)}"${c.bookAuthor ? ` de ${s(c.bookAuthor, 120)}` : ""}.`;
  if (c.chapterTitle) p += ` Capítulo atual: "${s(c.chapterTitle, 200)}".`;
  if (c.chapterExcerpt)
    p += ` Trecho de referência do capítulo (contexto interno, não repita literalmente): ${s(c.chapterExcerpt, 1500)}`;
  if (c.selectedText) p += ` Trecho que a pessoa selecionou agora: ${s(c.selectedText, 900)}.`;
  if (c.positionLabel) p += ` Posição aproximada de leitura: ${s(c.positionLabel, 120)}.`;
  return p;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * Which AI to call. On Vercel, AI Gateway accepts the deployment's own OIDC
 * identity (no key to manage); a GROQ_API_KEY still works as before.
 */
function provider(
  request: Request,
): { url: string; key: string; model: string; vision: string } | null {
  const gatewayKey =
    process.env.AI_GATEWAY_API_KEY ||
    request.headers.get("x-vercel-oidc-token") ||
    process.env.VERCEL_OIDC_TOKEN;
  if (gatewayKey) {
    return {
      url: "https://ai-gateway.vercel.sh/v1/chat/completions",
      key: gatewayKey,
      model: "anthropic/claude-haiku-5.5",
      vision: "anthropic/claude-haiku-5.5",
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: MODEL,
      vision: VISION_MODEL,
    };
  }
  return null;
}

export async function handleLumi(request: Request): Promise<Response> {
  const ai = provider(request);
  if (!ai) return json({ error: "not-configured" }, 503);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (limited(ip)) return json({ error: "Muitas perguntas seguidas — espere um minutinho." }, 429);

  let body: { messages?: Msg[]; context?: Ctx | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return json({ error: "Envie ao menos uma mensagem." }, 400);
  if (messages.length > MAX_MESSAGES)
    return json({ error: "Conversa muito longa — comece outra." }, 400);
  for (const m of messages) {
    if (
      !m ||
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.text !== "string" ||
      !m.text ||
      m.text.length > MAX_LEN
    ) {
      return json({ error: "Mensagem inválida ou muito longa." }, 400);
    }
  }
  const ctx = body.context ?? null;
  const image = ctx?.pageImageDataUrl;
  const hasImage =
    typeof image === "string" &&
    /^data:image\/(?:jpeg|png);base64,/.test(image) &&
    image.length <= 4_000_000;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 28_000);
  try {
    const r = await fetch(ai.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.key}` },
      body: JSON.stringify({
        model: hasImage ? ai.vision : ai.model,
        max_tokens: 600,
        messages: [
          { role: "system", content: systemPrompt(ctx) },
          ...(hasImage
            ? [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Esta é a página atual do PDF. Leia o conteúdo visível para responder. Não antecipe páginas seguintes.",
                    },
                    { type: "image_url", image_url: { url: image } },
                  ],
                },
              ]
            : []),
          ...messages.map((m) => ({ role: m.role, content: m.text })),
        ],
      }),
    });
    if (!r.ok) {
      console.warn(
        "[lumi] provider error",
        r.status,
        (await r.text().catch(() => "")).slice(0, 300),
      );
      return json({ error: "A Lumi não conseguiu responder agora." }, 502);
    }
    const data = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = (data.choices?.[0]?.message?.content ?? "").trim();
    return json({
      reply: reply || "Não consegui pensar em uma resposta agora — tente reformular?",
    });
  } catch {
    return json({ error: "A Lumi demorou demais para responder." }, 504);
  } finally {
    clearTimeout(timer);
  }
}
