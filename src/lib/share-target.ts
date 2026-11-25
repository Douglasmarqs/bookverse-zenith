/**
 * Files shared to the installed app ("Compartilhar → BookVerse") are posted
 * to /compartilhar; public/sw.js stashes them in this cache and opens
 * /adicionar?compartilhado=1, which picks them up here.
 */
const CACHE = "bookverse-share";

export async function takeSharedFiles(): Promise<File[]> {
  if (typeof caches === "undefined") return [];
  try {
    const cache = await caches.open(CACHE);
    const keys = await cache.keys();
    const files: File[] = [];
    for (const req of keys) {
      const res = await cache.match(req);
      if (res) {
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get("x-file-name") ?? "livro");
        files.push(new File([blob], name, { type: blob.type }));
      }
      await cache.delete(req);
    }
    return files;
  } catch {
    return [];
  }
}
