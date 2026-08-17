/**
 * askLumi — callable Cloud Function that proxies chat turns to Groq on
 * behalf of the "Lumi" owl reading companion. The API key never reaches
 * the browser: it lives only as a Firebase secret bound to this function.
 *
 * Uses Groq specifically because it has a genuinely free, no-credit-card
 * tier (rate-limited, not credit-limited) served through an OpenAI-style
 * chat completions API — see /functions/README.md for the full setup
 * walkthrough.
 *
 * Deploy:
 *   firebase functions:secrets:set GROQ_API_KEY
 *   cd functions && npm install && npm run deploy
 *
 * Note: Cloud Functions themselves still require Firebase's Blaze
 * (pay-as-you-go) plan regardless of which AI provider is called — that's
 * a Firebase/GCP requirement for outbound network access, not something
 * switching AI providers avoids. Blaze has its own generous free monthly
 * quota, though; a personal app like this one is very unlikely to exceed
 * it.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import Groq from "groq-sdk";

if (getApps().length === 0) {
  initializeApp();
}

export { searchPublicDomainBooks, getPublicDomainBook } from "./public-domain";
export { searchGoogleBooks, getGoogleBookMeta } from "./google-books";

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");

// If this exact model gets retired/renamed on Groq's side, check the
// current list at https://console.groq.com/docs/models and update this
// string — everything else in this function stays the same.
const MODEL_NAME = "openai/gpt-oss-120b";

interface LumiMessage {
  role: "user" | "assistant";
  text: string;
}

interface LumiContext {
  bookTitle?: string;
  bookAuthor?: string;
  chapterTitle?: string;
  chapterExcerpt?: string;
}

interface AskLumiRequest {
  messages: LumiMessage[];
  context?: LumiContext | null;
}

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_OUTPUT_TOKENS = 600;

function buildSystemPrompt(context?: LumiContext | null): string {
  let prompt =
    "Você é Lumi, uma coruja bibliotecária e companhia de leitura dentro do app BookVerse. " +
    "Seu tom é caloroso, culto e conciso — respostas curtas e úteis, sem enrolação, em português do Brasil. " +
    "Você ajuda a resumir capítulos, explicar trechos difíceis, dar contexto histórico/cultural e recomendar livros parecidos. " +
    "Nunca reproduza trechos extensos protegidos por direitos autorais; prefira parafrasear e resumir com suas próprias palavras.";

  if (context?.bookTitle) {
    prompt += `\n\nO leitor está lendo agora: "${context.bookTitle}"${
      context.bookAuthor ? ` de ${context.bookAuthor}` : ""
    }.`;
  }
  if (context?.chapterTitle) {
    prompt += ` Capítulo atual: "${context.chapterTitle}".`;
  }
  if (context?.chapterExcerpt) {
    prompt += ` Trecho de referência do capítulo (contexto interno, não repita literalmente): ${context.chapterExcerpt.slice(0, 1500)}`;
  }
  return prompt;
}

export const askLumi = onCall<AskLumiRequest>(
  { secrets: [GROQ_API_KEY], cors: true, maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Faça login para conversar com a Lumi.");
    }

    const { messages, context } = request.data ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError("invalid-argument", "Envie ao menos uma mensagem.");
    }
    if (messages.length > MAX_MESSAGES) {
      throw new HttpsError("invalid-argument", "Conversa muito longa — inicie um novo tópico.");
    }
    for (const m of messages) {
      if (!m.text || m.text.length > MAX_MESSAGE_LENGTH) {
        throw new HttpsError("invalid-argument", "Mensagem inválida ou muito longa.");
      }
    }

    try {
      const groq = new Groq({ apiKey: GROQ_API_KEY.value() });

      // Groq's chat completions API is OpenAI-shaped: one flat "messages"
      // array with role "system" | "user" | "assistant" — LumiMessage's
      // roles already line up 1:1, no remapping needed like Gemini's
      // separate history/model split required.
      const chatCompletion = await groq.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: buildSystemPrompt(context) },
          ...messages.map((m) => ({ role: m.role, content: m.text })),
        ],
        max_completion_tokens: MAX_OUTPUT_TOKENS,
      });
      const reply = (chatCompletion.choices[0]?.message?.content ?? "").trim();

      return { reply: reply || "Não consegui pensar em uma resposta agora — tente reformular?" };
    } catch (err) {
      console.error("[askLumi] Groq call failed", err);
      throw new HttpsError("internal", "Lumi não conseguiu responder agora.");
    }
  },
);

interface RecommendRequest {
  /** Titles from the person's own library — completed reads weighted
   * first by the caller, capped client-side before this is even sent. */
  recentTitles: { title: string; author?: string }[];
}

/**
 * askLumi's proactive sibling: instead of answering a question, this one
 * looks at what's already in the person's library and suggests one book
 * to read next — the "Lumi recommends" card on the homepage. Same secret,
 * same model, same provider; just a different, single-shot prompt that
 * asks for strict JSON back instead of a chat reply, so the client can
 * render a proper recommendation card instead of parsing prose.
 */
export const recommendNextBook = onCall<RecommendRequest>(
  { secrets: [GROQ_API_KEY], cors: true, maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Faça login para receber recomendações.");
    }
    const titles = (request.data?.recentTitles ?? []).filter((t) => t?.title);
    if (titles.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        "Adicione alguns livros à sua biblioteca primeiro, aí eu consigo sugerir algo.",
      );
    }

    const list = titles
      .slice(0, 20)
      .map((t) => `- "${t.title}"${t.author ? ` de ${t.author}` : ""}`)
      .join("\n");
    const prompt =
      `Você é Lumi, a coruja bibliotecária do app de leitura BookVerse. ` +
      `Esta é a lista de livros que a pessoa já tem na biblioteca ou já leu:\n${list}\n\n` +
      `Sugira UM único próximo livro que ela provavelmente vai gostar, considerando os temas, ` +
      `gêneros e estilos da lista acima. Pode ser um clássico, um best-seller ou uma obra menos ` +
      `conhecida — mas não repita nenhum título que já está na lista. ` +
      `Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto antes ou depois, ` +
      `exatamente neste formato: ` +
      `{"title": "título do livro", "author": "nome do autor", "reason": "uma frase curta e ` +
      `calorosa em português, explicando o motivo da indicação"}`;

    try {
      const groq = new Groq({ apiKey: GROQ_API_KEY.value() });
      const completion = await groq.chat.completions.create({
        model: MODEL_NAME,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 300,
      });
      const raw = (completion.choices[0]?.message?.content ?? "").trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Lumi's reply didn't contain a JSON object");
      const parsed = JSON.parse(jsonMatch[0]) as { title?: string; author?: string; reason?: string };
      if (!parsed.title) throw new Error("Lumi's reply was missing a title");

      return {
        title: String(parsed.title).slice(0, 200),
        author: parsed.author ? String(parsed.author).slice(0, 120) : "",
        reason: parsed.reason ? String(parsed.reason).slice(0, 400) : "",
      };
    } catch (err) {
      console.error("[recommendNextBook] Groq call failed", err);
      throw new HttpsError("internal", "Lumi não conseguiu pensar numa recomendação agora.");
    }
  },
);