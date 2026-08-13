"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askLumi = exports.getGoogleBookMeta = exports.searchGoogleBooks = exports.getPublicDomainBook = exports.searchPublicDomainBooks = void 0;
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
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
var public_domain_1 = require("./public-domain");
Object.defineProperty(exports, "searchPublicDomainBooks", { enumerable: true, get: function () { return public_domain_1.searchPublicDomainBooks; } });
Object.defineProperty(exports, "getPublicDomainBook", { enumerable: true, get: function () { return public_domain_1.getPublicDomainBook; } });
var google_books_1 = require("./google-books");
Object.defineProperty(exports, "searchGoogleBooks", { enumerable: true, get: function () { return google_books_1.searchGoogleBooks; } });
Object.defineProperty(exports, "getGoogleBookMeta", { enumerable: true, get: function () { return google_books_1.getGoogleBookMeta; } });
const GROQ_API_KEY = (0, params_1.defineSecret)("GROQ_API_KEY");
// If this exact model gets retired/renamed on Groq's side, check the
// current list at https://console.groq.com/docs/models and update this
// string — everything else in this function stays the same.
const MODEL_NAME = "openai/gpt-oss-120b";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_OUTPUT_TOKENS = 600;
function buildSystemPrompt(context) {
    let prompt = "Você é Lumi, uma coruja bibliotecária e companhia de leitura dentro do app BookVerse. " +
        "Seu tom é caloroso, culto e conciso — respostas curtas e úteis, sem enrolação, em português do Brasil. " +
        "Você ajuda a resumir capítulos, explicar trechos difíceis, dar contexto histórico/cultural e recomendar livros parecidos. " +
        "Nunca reproduza trechos extensos protegidos por direitos autorais; prefira parafrasear e resumir com suas próprias palavras.";
    if (context?.bookTitle) {
        prompt += `\n\nO leitor está lendo agora: "${context.bookTitle}"${context.bookAuthor ? ` de ${context.bookAuthor}` : ""}.`;
    }
    if (context?.chapterTitle) {
        prompt += ` Capítulo atual: "${context.chapterTitle}".`;
    }
    if (context?.chapterExcerpt) {
        prompt += ` Trecho de referência do capítulo (contexto interno, não repita literalmente): ${context.chapterExcerpt.slice(0, 1500)}`;
    }
    return prompt;
}
exports.askLumi = (0, https_1.onCall)({ secrets: [GROQ_API_KEY], cors: true, maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Faça login para conversar com a Lumi.");
    }
    const { messages, context } = request.data ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Envie ao menos uma mensagem.");
    }
    if (messages.length > MAX_MESSAGES) {
        throw new https_1.HttpsError("invalid-argument", "Conversa muito longa — inicie um novo tópico.");
    }
    for (const m of messages) {
        if (!m.text || m.text.length > MAX_MESSAGE_LENGTH) {
            throw new https_1.HttpsError("invalid-argument", "Mensagem inválida ou muito longa.");
        }
    }
    try {
        const groq = new groq_sdk_1.default({ apiKey: GROQ_API_KEY.value() });
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
    }
    catch (err) {
        console.error("[askLumi] Groq call failed", err);
        throw new https_1.HttpsError("internal", "Lumi não conseguiu responder agora.");
    }
});
