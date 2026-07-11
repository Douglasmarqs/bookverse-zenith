/**
 * askLumi — callable Cloud Function that proxies chat turns to Claude on
 * behalf of the "Lumi" owl reading companion. The API key never reaches the
 * browser: it lives only as a Firebase secret bound to this function.
 *
 * Deploy:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 *   cd functions && npm install && npm run deploy
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

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
  { secrets: [ANTHROPIC_API_KEY], cors: true, maxInstances: 10 },
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

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system: buildSystemPrompt(context),
        messages: messages.map((m) => ({
          role: m.role,
          content: m.text,
        })),
      });

      const reply = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      return { reply: reply || "Não consegui pensar em uma resposta agora — tente reformular?" };
    } catch (err) {
      console.error("[askLumi] Anthropic call failed", err);
      throw new HttpsError("internal", "Lumi não conseguiu responder agora.");
    }
  },
);
