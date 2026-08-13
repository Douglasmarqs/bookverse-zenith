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
const MODEL_NAME = "llama-3.3-70b-versatile";

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