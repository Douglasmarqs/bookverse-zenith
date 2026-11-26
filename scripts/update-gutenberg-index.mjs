#!/usr/bin/env node
/**
 * Regenerates src/server/data/pg-index.ts — the Project Gutenberg catalogue
 * the server searches locally (gutenberg.org and Gutendex refuse cloud
 * servers). Source: the official PGLAF mirror's pg_catalog.csv.gz.
 *
 *   node scripts/update-gutenberg-index.mjs
 *   PG_CATALOG_FEED=http://localhost:8765/pg_catalog.csv.gz node scripts/…   (tests)
 *
 * Output format: gzip(base64) of "id\ttitle\tauthor\tlang" lines, Text items
 * only, first author without life dates or roles.
 */
import { gunzipSync, gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FEEDS = [
  ...(process.env.PG_CATALOG_FEED ? [process.env.PG_CATALOG_FEED] : []),
  "https://gutenberg.pglaf.org/cache/epub/feeds/pg_catalog.csv.gz",
  "https://aleph.pglaf.org/cache/epub/feeds/pg_catalog.csv.gz",
];
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "server",
  "data",
  "pg-index.ts",
);

async function download() {
  for (const url of FEEDS) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "BookVerse catalogue updater" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      console.log(`downloaded ${(buf.length / 1048576).toFixed(1)} MB from ${url}`);
      return buf;
    } catch (err) {
      console.warn(`skipping ${url}: ${err.message}`);
    }
  }
  throw new Error("no mirror answered");
}

/** RFC-4180 CSV: quotes, doubled quotes, newlines inside cells. */
function* rows(text) {
  let cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      cells.push(cell);
      cell = "";
    } else if (c === "\n") {
      cells.push(cell);
      yield cells;
      cells = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || cells.length) {
    cells.push(cell);
    yield cells;
  }
}

const LIFE_DATES =
  /,\s*(?:ca\.\s*)?-?\d{1,4}\??\s*(?:BCE)?\s*-?\s*(?:ca\.\s*)?\d{0,4}\??\s*(?:BCE)?\s*$/i;

const text = gunzipSync(await download()).toString("utf8");
const lines = [];
let header = true;
for (const c of rows(text)) {
  if (header) {
    header = false; // Text#,Type,Issued,Title,Language,Authors,…
    continue;
  }
  const [id, type, , rawTitle = "", lang = "", authors = ""] = c;
  if (type !== "Text" || !/^\d+$/.test(id ?? "")) continue;
  const title = rawTitle.replace(/\s+/g, " ").trim();
  if (!title) continue;
  const author = (authors.split(";")[0] ?? "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(LIFE_DATES, "")
    .trim();
  lines.push(
    [id, title, author, lang.split(";")[0].trim()].map((v) => v.replace(/\t/g, " ")).join("\t"),
  );
}
if (lines.length < 50_000)
  throw new Error(`only ${lines.length} titles — refusing to write a truncated index`);

const b64 = gzipSync(Buffer.from(lines.join("\n")), { level: 9 }).toString("base64");
writeFileSync(
  OUT,
  `/**
 * Project Gutenberg catalogue, compacted (id\\ttitle\\tauthor\\tlang per line,
 * gzip + base64), generated from the PGLAF mirror's pg_catalog.csv.
 * Shipped with the server so Gutenberg search never depends on a site that
 * turns cloud servers away. Regenerate with: node scripts/update-gutenberg-index.mjs
 */
export const PG_INDEX_ROWS = ${lines.length};
export const PG_INDEX_GZ_B64 =
  "${b64}";
`,
);
console.log(`wrote ${lines.length} titles (${(b64.length / 1048576).toFixed(1)} MB) to ${OUT}`);
