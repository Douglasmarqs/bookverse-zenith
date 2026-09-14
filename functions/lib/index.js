"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePrivateFiles = exports.recordReadingMilestone = exports.recommendNextBook = exports.askLumi = exports.getGoogleBookMeta = exports.searchGoogleBooks = exports.getPublicDomainBook = exports.searchPublicDomainBooks = void 0;
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
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
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
        "Você também pode identificar personagens apenas pelo contexto fornecido, criar perguntas de revisão e flashcards curtos. " +
        "Nunca revele acontecimentos posteriores à posição informada e nunca invente fatos ausentes do contexto. " +
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
    if (context?.selectedText) {
        prompt += ` Trecho que a pessoa selecionou agora: ${context.selectedText.slice(0, 900)}.`;
    }
    if (context?.positionLabel) {
        prompt += ` Posição aproximada de leitura: ${context.positionLabel.slice(0, 120)}.`;
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
/**
 * askLumi's proactive sibling: instead of answering a question, this one
 * looks at what's already in the person's library and suggests one book
 * to read next — the "Lumi recommends" card on the homepage. Same secret,
 * same model, same provider; just a different, single-shot prompt that
 * asks for strict JSON back instead of a chat reply, so the client can
 * render a proper recommendation card instead of parsing prose.
 */
exports.recommendNextBook = (0, https_1.onCall)({ secrets: [GROQ_API_KEY], cors: true, maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Faça login para receber recomendações.");
    }
    const titles = (request.data?.recentTitles ?? []).filter((t) => t?.title);
    if (titles.length === 0) {
        throw new https_1.HttpsError("failed-precondition", "Adicione alguns livros à sua biblioteca primeiro, aí eu consigo sugerir algo.");
    }
    const list = titles
        .slice(0, 20)
        .map((t) => `- "${t.title}"${t.author ? ` de ${t.author}` : ""}`)
        .join("\n");
    const prompt = `Você é Lumi, a coruja bibliotecária do app de leitura BookVerse. ` +
        `Esta é a lista de livros que a pessoa já tem na biblioteca ou já leu:\n${list}\n\n` +
        `Sugira UM único próximo livro que ela provavelmente vai gostar, considerando os temas, ` +
        `gêneros e estilos da lista acima. Pode ser um clássico, um best-seller ou uma obra menos ` +
        `conhecida — mas não repita nenhum título que já está na lista. ` +
        `Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto antes ou depois, ` +
        `exatamente neste formato: ` +
        `{"title": "título do livro", "author": "nome do autor", "reason": "uma frase curta e ` +
        `calorosa em português, explicando o motivo da indicação"}`;
    try {
        const groq = new groq_sdk_1.default({ apiKey: GROQ_API_KEY.value() });
        const completion = await groq.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            max_completion_tokens: 300,
        });
        const raw = (completion.choices[0]?.message?.content ?? "").trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error("Lumi's reply didn't contain a JSON object");
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.title)
            throw new Error("Lumi's reply was missing a title");
        return {
            title: String(parsed.title).slice(0, 200),
            author: parsed.author ? String(parsed.author).slice(0, 120) : "",
            reason: parsed.reason ? String(parsed.reason).slice(0, 400) : "",
        };
    }
    catch (err) {
        console.error("[recommendNextBook] Groq call failed", err);
        throw new https_1.HttpsError("internal", "Lumi não conseguiu pensar numa recomendação agora.");
    }
});
function saoPauloDateKey(date) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const value = (part) => parts.find((p) => p.type === part)?.value ?? "01";
    return `${value("year")}-${value("month")}-${value("day")}`;
}
function mondayFor(dateKey) {
    const date = new Date(`${dateKey}T12:00:00Z`);
    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
    return date.toISOString().slice(0, 10);
}
/** Server-authoritative milestones protect the meaningful reading metrics.
 * The browser can request an event, but it cannot choose XP values and each
 * resource gets a deterministic idempotency record under the account. */
exports.recordReadingMilestone = (0, https_1.onCall)({ cors: true, maxInstances: 20 }, async (request) => {
    if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") {
        throw new https_1.HttpsError("unauthenticated", "Use uma conta para registrar a leitura.");
    }
    const input = request.data;
    const allowed = [
        "book-added",
        "chapter-completed",
        "book-completed",
        "diary-entry",
        "review-published",
        "reading-session",
    ];
    if (!allowed.includes(input?.type) || !input.resourceId || input.resourceId.length > 180) {
        throw new https_1.HttpsError("invalid-argument", "Evento de leitura inválido.");
    }
    const uid = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const profileRef = db.doc(`users/${uid}`);
    const eventId = `${input.type}-${Buffer.from(input.resourceId).toString("base64url")}`;
    const eventRef = profileRef.collection("gamificationEvents").doc(eventId);
    const today = saoPauloDateKey(new Date());
    const weekStart = mondayFor(today);
    const monthStart = `${today.slice(0, 7)}-01`;
    const result = await db.runTransaction(async (transaction) => {
        const [profile, recorded] = await Promise.all([
            transaction.get(profileRef),
            transaction.get(eventRef),
        ]);
        if (recorded.exists)
            return { accepted: false };
        if (!profile.exists) {
            throw new https_1.HttpsError("failed-precondition", "Perfil de leitura ainda está sendo criado.");
        }
        if (input.type === "book-added" || input.type === "book-completed") {
            const library = await transaction.get(profileRef.collection("library").doc(input.resourceId));
            if (!library.exists ||
                (input.type === "book-completed" && library.data()?.status !== "concluido")) {
                throw new https_1.HttpsError("failed-precondition", "O livro não está pronto para esse registro.");
            }
        }
        if (input.type === "diary-entry") {
            const diary = await transaction.get(profileRef.collection("diary").doc(input.resourceId));
            if (!diary.exists)
                throw new https_1.HttpsError("failed-precondition", "Entrada do diário não encontrada.");
        }
        if (input.type === "review-published") {
            const review = await transaction.get(db.doc(`books/${input.resourceId}/reviews/${uid}`));
            if (!review.exists)
                throw new https_1.HttpsError("failed-precondition", "Resenha não encontrada.");
        }
        const chapterIndex = Number(input.chapterIndex);
        const chapterCount = Number(input.chapterCount);
        if (input.type === "chapter-completed" &&
            (!Number.isInteger(chapterIndex) ||
                !Number.isInteger(chapterCount) ||
                chapterIndex < 0 ||
                chapterCount < 1 ||
                chapterIndex >= chapterCount ||
                chapterCount > 500)) {
            throw new https_1.HttpsError("invalid-argument", "Capítulo inválido.");
        }
        const data = profile.data() ?? {};
        const sameWeek = data.weekStart === weekStart;
        const sameMonth = data.monthStart === monthStart;
        const points = {
            "book-added": 5,
            "chapter-completed": 20,
            "book-completed": 50,
            "diary-entry": 10,
            "review-published": 15,
            "reading-session": 0,
        };
        const xp = points[input.type];
        const patch = {
            xp: Number(data.xp ?? 0) + xp,
            weeklyXp: (sameWeek ? Number(data.weeklyXp ?? 0) : 0) + xp,
            weeklyChaptersRead: (sameWeek ? Number(data.weeklyChaptersRead ?? 0) : 0) +
                (input.type === "chapter-completed" ? 1 : 0),
            weeklyBooksAdded: (sameWeek ? Number(data.weeklyBooksAdded ?? 0) : 0) +
                (input.type === "book-added" ? 1 : 0),
            weekStart,
            monthStart,
            monthlyXp: (sameMonth ? Number(data.monthlyXp ?? 0) : 0) + xp,
            monthlyChaptersRead: (sameMonth ? Number(data.monthlyChaptersRead ?? 0) : 0) +
                (input.type === "chapter-completed" ? 1 : 0),
            monthlyReadingMinutes: sameMonth ? Number(data.monthlyReadingMinutes ?? 0) : 0,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        };
        if (data.lastActiveDate !== today) {
            const previous = data.lastActiveDate ? new Date(`${data.lastActiveDate}T12:00:00Z`) : null;
            const days = previous
                ? Math.round((Date.parse(`${today}T12:00:00Z`) - previous.getTime()) / 86400000)
                : 0;
            const streak = days === 1 ? Number(data.currentStreak ?? 0) + 1 : 1;
            patch.currentStreak = streak;
            patch.longestStreak = Math.max(streak, Number(data.longestStreak ?? 0));
            patch.lastActiveDate = today;
        }
        if (input.type === "chapter-completed") {
            const pages = Math.max(1, Math.min(120, Math.round(Number(input.pagesRead) || 1)));
            const minutes = Math.max(1, Math.min(90, Math.round(Number(input.readingMinutes) || 1)));
            patch.chaptersRead = Number(data.chaptersRead ?? 0) + 1;
            patch.pagesRead = Number(data.pagesRead ?? 0) + pages;
            patch.readingMinutes = Number(data.readingMinutes ?? 0) + minutes;
            patch.monthlyReadingMinutes =
                (sameMonth ? Number(data.monthlyReadingMinutes ?? 0) : 0) + minutes;
        }
        if (input.type === "book-completed")
            patch.booksCompleted = Number(data.booksCompleted ?? 0) + 1;
        transaction.set(profileRef, patch, { merge: true });
        transaction.set(eventRef, {
            type: input.type,
            resourceId: input.resourceId,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { accepted: true };
    });
    return result;
});
/** Deletes every private source object for the authenticated account,
 * including an upload that reached Storage but failed before its Firestore
 * metadata was created. Called immediately before the client deletes Auth. */
exports.deletePrivateFiles = (0, https_1.onCall)({ cors: true, maxInstances: 5 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Faça login para remover seus arquivos privados.");
    }
    const uid = request.auth.uid;
    try {
        const bucket = (0, storage_1.getStorage)().bucket();
        await Promise.all([
            bucket.deleteFiles({ prefix: `users/${uid}/epubs/`, force: true }),
            bucket.deleteFiles({ prefix: `users/${uid}/pdfs/`, force: true }),
        ]);
        return { deleted: true };
    }
    catch (err) {
        console.error("[deletePrivateFiles] failed", err);
        throw new https_1.HttpsError("internal", "Não foi possível remover todos os arquivos privados.");
    }
});
