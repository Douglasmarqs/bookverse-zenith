/**
 * askLumi — callable Cloud Function that proxies chat turns to Gemini on
 * behalf of the "Lumi" owl reading companion. The API key never reaches
 * the browser: it lives only as a Firebase secret bound to this function.
 *
 * Uses Gemini specifically because Google AI Studio issues API keys with
 * a real free tier (no credit card required to get started) — see
 * /functions/README.md for the full setup walkthrough.
 *
 * Deploy:
 *   firebase functions:secrets:set GEMINI_API_KEY
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
import { GoogleGenAI } from "@google/genai";

if (getApps().length === 0) {
  initializeApp();
}

export { searchPublicDomainBooks, getPublicDomainBook } from "./public-domain";
export { searchGoogleBooks, getGoogleBookMeta } from "./google-books";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// If your Google AI Studio key doesn't have access to this exact model
// name (Google occasionally renames/retires models), check the current
// list at https://ai.google.dev/gemini-api/docs/models and update this
// string — everything else in this function stays the same.
const MODEL_NAME = "gemini-2.0-flash";

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
  { secrets: [GEMINI_API_KEY], cors: true, maxInstances: 10 },
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
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });

      // Gemini's chat API wants prior turns as "history" and the newest
      // message sent separately — mirrors how the client already splits
      // these (everything but the last message is history).
      const history = messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.text }],
      }));
      const lastMessage = messages[messages.length - 1];

      const chat = ai.chats.create({
        model: MODEL_NAME,
        history,
        config: {
          systemInstruction: buildSystemPrompt(context),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      });
      const result = await chat.sendMessage({ message: lastMessage.text });
      const reply = (result.text ?? "").trim();

      return { reply: reply || "Não consegui pensar em uma resposta agora — tente reformular?" };
    } catch (err) {
      console.error("[askLumi] Gemini call failed", err);
      throw new HttpsError("internal", "Lumi não conseguiu responder agora.");
    }
  },
);