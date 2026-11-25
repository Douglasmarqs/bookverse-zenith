/**
 * "Colar link de EPUB ou PDF": the server fetches a public file for the
 * reader (browsers can't, because of CORS) and streams it back.
 *
 * Guard rails: https only, at most 5 redirects, every hop's host must
 * resolve to a public address (no localhost, private ranges or cloud
 * metadata), HTML pages are refused and the body is capped at 60 MB.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 60 * 1024 * 1024;
const UA = "BookVerse/1.0 (+https://bookverse-zenith.vercel.app)";

const fail = (error: string, status: number) => Response.json({ error }, { status });

function privateV4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function privateIp(ip: string): boolean {
  if (isIP(ip) === 4) return privateV4(ip);
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateV4(mapped[1]!);
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb") ||
    v6.startsWith("ff")
  );
}

async function publicHost(url: URL): Promise<boolean> {
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") || /\.(local|internal|localhost)$/i.test(host)) return false;
  if (isIP(host)) return !privateIp(host);
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    return addrs.length > 0 && addrs.every((a) => !privateIp(a.address));
  } catch {
    return false;
  }
}

function fileName(r: Response, url: URL): string {
  const cd = r.headers.get("content-disposition") ?? "";
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]!.trim());
    } catch {
      // fall through
    }
  }
  const plain = cd.match(/filename="?([^";]+)"?/i);
  if (plain) return plain[1]!.trim();
  try {
    return decodeURIComponent(url.pathname.split("/").pop() || "livro");
  } catch {
    return "livro";
  }
}

export async function importLink(raw: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("Link inválido.", 400);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 50_000);
  try {
    let r: Response | null = null;
    for (let hop = 0; hop < 6; hop++) {
      if (!(await publicHost(url))) {
        return fail("Este endereço não pode ser usado. Use um link público https://.", 400);
      }
      r = await fetch(url, {
        signal: ctrl.signal,
        redirect: "manual",
        headers: { "User-Agent": UA, Accept: "application/epub+zip,application/pdf,*/*" },
      });
      const loc = r.headers.get("location");
      if (r.status >= 300 && r.status < 400 && loc) {
        url = new URL(loc, url);
        continue;
      }
      break;
    }
    if (!r || (r.status >= 300 && r.status < 400)) return fail("O link redireciona demais.", 502);
    if (!r.ok || !r.body)
      return fail("O site não entregou o arquivo (erro " + r.status + ").", 502);
    const type = r.headers.get("content-type") ?? "";
    if (/text\/html|xhtml/i.test(type)) {
      return fail(
        "Esse link abre uma página, não um arquivo. Use o link de download direto (ou deixe o arquivo público).",
        415,
      );
    }
    const len = Number(r.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) return fail("O arquivo precisa ter no máximo 60 MB.", 413);

    let got = 0;
    const capped = r.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, c) {
          got += chunk.byteLength;
          if (got > MAX_BYTES) c.error(new Error("too large"));
          else c.enqueue(chunk);
        },
      }),
    );
    return new Response(capped, {
      headers: {
        "Content-Type": type || "application/octet-stream",
        ...(len ? { "Content-Length": String(len) } : {}),
        "X-File-Name": encodeURIComponent(fileName(r, url)),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return fail("O site demorou demais para responder.", 504);
  } finally {
    clearTimeout(timer);
  }
}
