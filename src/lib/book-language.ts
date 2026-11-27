/**
 * The language of a personal book (imported EPUB/PDF), for the PT/EN tag
 * on the shelf: from the EPUB's own metadata when it says, else guessed
 * from the text by its most common little words. Remembered per book on
 * this device and stored on the library entry for the reader's others.
 */
const KEY = "bookverse:book-languages";

const MARKERS: Record<string, string[]> = {
  pt: [
    "que",
    "não",
    "uma",
    "com",
    "para",
    "os",
    "do",
    "da",
    "em",
    "é",
    "se",
    "mais",
    "ele",
    "ela",
    "como",
    "mas",
    "foi",
    "ao",
  ],
  en: [
    "the",
    "and",
    "of",
    "to",
    "is",
    "was",
    "that",
    "with",
    "he",
    "she",
    "his",
    "her",
    "it",
    "for",
    "you",
    "not",
    "had",
    "but",
  ],
  es: [
    "el",
    "los",
    "las",
    "del",
    "que",
    "por",
    "una",
    "con",
    "para",
    "es",
    "su",
    "pero",
    "como",
    "más",
    "fue",
    "le",
    "lo",
    "al",
  ],
  fr: [
    "le",
    "les",
    "des",
    "est",
    "une",
    "dans",
    "qui",
    "pas",
    "sur",
    "il",
    "elle",
    "au",
    "avec",
    "pour",
    "mais",
    "du",
    "ce",
    "je",
  ],
};

/** "pt-BR" → "pt", "por" → "pt", "eng" → "en". */
export function normalizeLang(code?: string | null): string | null {
  const c = (code ?? "").trim().toLowerCase();
  if (!c) return null;
  const map: Record<string, string> = { por: "pt", eng: "en", spa: "es", fre: "fr", fra: "fr" };
  return map[c] ?? (c.split(/[-_]/)[0] || null);
}

/** Best guess from a sample of the text; null when there's too little. */
export function guessLanguage(text: string): string | null {
  const words = text.toLowerCase().match(/[a-zà-ÿ]+/g);
  if (!words || words.length < 40) return null;
  const sample = words.slice(0, 4000);
  let best: string | null = null;
  let bestScore = 0;
  for (const [lang, list] of Object.entries(MARKERS)) {
    const set = new Set(list);
    const score = sample.reduce((n, w) => n + (set.has(w) ? 1 : 0), 0) / sample.length;
    if (score > bestScore) {
      bestScore = score;
      best = lang;
    }
  }
  return bestScore > 0.04 ? best : null;
}

function readAll(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function rememberBookLanguage(readerId: string, lang: string | null | undefined) {
  const l = normalizeLang(lang);
  if (!readerId || !l) return;
  try {
    const all = readAll();
    if (all[readerId] === l) return;
    all[readerId] = l;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage unavailable
  }
}

export function bookLanguage(readerId?: string | null): string | null {
  if (!readerId) return null;
  return readAll()[readerId] ?? null;
}

/** Language of a parsed book: its metadata, else a guess from its text. */
export function languageOfBook(book: {
  language?: string | null;
  chapters: { paragraphs: string[] }[];
}): string | null {
  const meta = normalizeLang(book.language);
  if (meta) return meta;
  let text = "";
  for (const c of book.chapters) {
    text += " " + c.paragraphs.join(" ");
    if (text.length > 20000) break;
  }
  return guessLanguage(text);
}
