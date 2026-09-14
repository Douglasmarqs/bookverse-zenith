"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicDomainBook = exports.searchPublicDomainBooks = void 0;
/**
 * Public-domain reading — real, full book text for titles whose copyright
 * has expired (Machado de Assis, Eça de Queirós, etc.), sourced from
 * Project Gutenberg via the Gutendex catalog API. Runs server-side (not in
 * the browser) for two reasons:
 *   1. Avoids relying on Gutendex/Gutenberg's CORS support, which is
 *      inconsistent for direct browser fetches.
 *   2. Lets us parse + cache the parsed chapters once in Firestore instead
 *      of re-downloading/re-parsing a multi-hundred-KB text file per reader.
 */
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const GUTENDEX_BASE = "https://gutendex.com";
async function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
function summarize(b) {
    return {
        id: b.id,
        title: b.title,
        author: b.authors?.map((a) => a.name).join(", ") || "Autor desconhecido",
        cover: b.formats["image/jpeg"] ?? null,
        languages: b.languages ?? [],
        subjects: (b.subjects ?? []).slice(0, 4),
    };
}
function textUrls(formats) {
    return Object.entries(formats)
        .filter(([key]) => key.startsWith("text/plain"))
        .sort(([a], [b]) => {
        const score = (key) => (key.includes("utf-8") ? 0 : key.includes("us-ascii") ? 1 : 2);
        return score(a) - score(b);
    })
        .map(([, url]) => url.replace(/^http:/, "https:"))
        .filter((url, index, all) => all.indexOf(url) === index);
}
async function downloadPlainText(formats) {
    const urls = textUrls(formats);
    if (!urls.length) {
        throw new https_1.HttpsError("failed-precondition", "Este título não tem uma versão em texto simples disponível.");
    }
    let lastError;
    for (const url of urls.slice(0, 3)) {
        try {
            const response = await fetchWithTimeout(url, 25000);
            if (!response.ok)
                throw new Error(`Project Gutenberg ${response.status}`);
            return await response.text();
        }
        catch (error) {
            lastError = error;
        }
    }
    console.error("[public-domain] every plain-text mirror failed", lastError);
    throw new https_1.HttpsError("unavailable", "Falha temporária ao baixar o texto do livro.");
}
/** Strips the Project Gutenberg legal boilerplate that wraps every text. */
function stripBoilerplate(raw) {
    const startMatch = raw.match(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i);
    const endMatch = raw.match(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i);
    const start = startMatch ? startMatch.index + startMatch[0].length : 0;
    const end = endMatch ? endMatch.index : raw.length;
    return raw.slice(start, end).trim();
}
function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
/**
 * Some Gutenberg plain-text editions hard-wrap at every clause with a blank
 * line between them (common in verse-like or numbered-maxim texts), which
 * makes naive blank-line paragraph splitting produce tiny, choppy
 * fragments like "batalha;" / "se" / "estivermos" instead of one flowing
 * sentence. This merges consecutive fragments back together until each
 * resulting paragraph actually ends in sentence-ending punctuation.
 */
function reflowParagraphs(paragraphs) {
    const merged = [];
    let buffer = "";
    for (const p of paragraphs) {
        buffer = buffer ? `${buffer} ${p}` : p;
        const endsSentence = /[.!?][”"')\]]?$/.test(buffer) || buffer.length > 500;
        if (endsSentence) {
            merged.push(buffer);
            buffer = "";
        }
    }
    if (buffer)
        merged.push(buffer);
    return merged;
}
/**
 * Splits Gutenberg plain text into chapters. Tries common chapter markers
 * (CHAPTER/CAPÍTULO + numeral) first; falls back to fixed-size chunks so
 * even books without clean markup still read reasonably.
 */
function parseChapters(text) {
    const lines = text.split(/\r?\n/);
    const markerRe = /^\s*(CHAPTER|CAPÍTULO|CAP[IÍ]TULO)\s+([0-9IVXLCDM]+)\b\.?\s*(.*)$/i;
    const blocks = [];
    let current = null;
    for (const line of lines) {
        const trimmed = line.trim();
        const m = markerRe.exec(trimmed);
        if (m) {
            const marker = capitalize(m[1]);
            const number = m[2];
            const trailing = (m[3] ?? "").trim();
            // If there's a lot of text after the marker on the same line, it's
            // almost always the start of the chapter's body (a run-on line in
            // the source file), not a real subtitle — keep the heading clean
            // and push that text into the body instead of the title.
            const trailingIsTitle = trailing.length > 0 && trailing.length <= 60;
            current = {
                title: trailingIsTitle ? `${marker} ${number} — ${trailing}` : `${marker} ${number}`,
                lines: trailingIsTitle ? [] : trailing ? [trailing] : [],
            };
            blocks.push(current);
        }
        else if (current) {
            current.lines.push(line);
        }
        else {
            // Content before the first detected chapter marker (preface/intro).
            if (blocks.length === 0) {
                current = { title: "Início", lines: [line] };
                blocks.push(current);
            }
        }
    }
    const toParagraphs = (raw) => reflowParagraphs(raw
        .join("\n")
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p.length > 0));
    // Good chapter markers found — use them (drop empty leading blocks).
    const withContent = blocks
        .map((b, i) => ({ id: `cap-${i}`, title: b.title, paragraphs: toParagraphs(b.lines) }))
        .filter((c) => c.paragraphs.length > 0);
    // Sanity check: real chapter markers produce a handful of chapters with
    // substantial content each. If matching produced a huge number of
    // "chapters" averaging almost no paragraphs (e.g. the word "chapter"
    // appears repeatedly in a table of contents, or matched incidentally),
    // that's a false positive — prefer the fixed-size fallback instead.
    const avgParagraphsPerChapter = withContent.length > 0
        ? withContent.reduce((sum, c) => sum + c.paragraphs.length, 0) / withContent.length
        : 0;
    const looksReliable = withContent.length >= 2 && (withContent.length <= 20 || avgParagraphsPerChapter >= 2);
    if (looksReliable)
        return withContent;
    // Fallback: no reliable chapter markers — chunk into ~6000-character
    // sections so the reader still has manageable "chapters".
    const allParagraphs = toParagraphs(lines);
    const chunks = [];
    let bucket = [];
    let bucketLen = 0;
    let idx = 0;
    for (const p of allParagraphs) {
        bucket.push(p);
        bucketLen += p.length;
        if (bucketLen > 6000) {
            chunks.push({ id: `parte-${idx}`, title: `Parte ${idx + 1}`, paragraphs: bucket });
            idx += 1;
            bucket = [];
            bucketLen = 0;
        }
    }
    if (bucket.length > 0) {
        chunks.push({ id: `parte-${idx}`, title: `Parte ${idx + 1}`, paragraphs: bucket });
    }
    return chunks.length > 0
        ? chunks
        : [{ id: "unico", title: "Texto completo", paragraphs: allParagraphs }];
}
exports.searchPublicDomainBooks = (0, https_1.onCall)({ cors: true, maxInstances: 10 }, async (request) => {
    const query = (request.data?.query ?? "").trim();
    if (!query)
        return { results: [] };
    const url = `${GUTENDEX_BASE}/books?search=${encodeURIComponent(query)}&languages=pt,en`;
    const res = await fetchWithTimeout(url, 9000);
    if (!res.ok) {
        throw new https_1.HttpsError("unavailable", "Catálogo de domínio público indisponível agora.");
    }
    const data = (await res.json());
    const max = Math.min(request.data?.maxResults ?? 24, 40);
    return { results: data.results.slice(0, max).map(summarize) };
});
exports.getPublicDomainBook = (0, https_1.onCall)({ cors: true, timeoutSeconds: 60, memory: "512MiB", maxInstances: 10 }, async (request) => {
    const gutenbergId = request.data?.gutenbergId;
    if (!gutenbergId || typeof gutenbergId !== "number") {
        throw new https_1.HttpsError("invalid-argument", "gutenbergId é obrigatório.");
    }
    const db = (0, firestore_1.getFirestore)();
    const cacheRef = db.collection("publicDomainBooks").doc(String(gutenbergId));
    const cached = await cacheRef.get();
    if (cached.exists)
        return cached.data();
    const metaRes = await fetchWithTimeout(`${GUTENDEX_BASE}/books/${gutenbergId}`, 9000);
    if (!metaRes.ok)
        throw new https_1.HttpsError("not-found", "Livro não encontrado no catálogo.");
    const meta = (await metaRes.json());
    const raw = await downloadPlainText(meta.formats);
    const clean = stripBoilerplate(raw);
    const chapters = parseChapters(clean);
    const book = {
        id: `gutenberg-${gutenbergId}`,
        title: meta.title,
        author: meta.authors?.map((a) => a.name).join(", ") || "Autor desconhecido",
        cover: meta.formats["image/jpeg"] ?? null,
        chapters,
    };
    // Firestore documents are limited to 1 MiB. Large classics should still
    // open normally even when their parsed text is too large to cache there.
    if (Buffer.byteLength(JSON.stringify(book), "utf8") < 850000) {
        await cacheRef
            .set(book)
            .catch((error) => console.warn("[public-domain] cache write skipped", error));
    }
    return book;
});
