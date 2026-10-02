import type { BookLocation, Chapter } from "./reading-book";

/** Resolve an archive reference without allowing external URLs or escaping root. */
export function resolveEpubHref(
  sourcePath: string,
  href: string,
): { path: string; fragment: string } | null {
  try {
    const raw = href.trim();
    if (
      !raw ||
      Array.from(raw).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
      /^[a-z][a-z\d+.-]*:/i.test(raw) ||
      raw.startsWith("//") ||
      raw.includes("\\")
    )
      return null;
    const hash = raw.indexOf("#");
    const pathPart = (hash < 0 ? raw : raw.slice(0, hash)).split("?")[0];
    const fragment = hash < 0 ? "" : decodeURIComponent(raw.slice(hash + 1));
    const decoded = decodeURIComponent(pathPart);
    if (
      decoded.includes("\\") ||
      decoded.includes("\0") ||
      /^[a-z][a-z\d+.-]*:/i.test(decoded) ||
      decoded.startsWith("//")
    )
      return null;
    if (!decoded) return { path: sourcePath, fragment };
    const parts = decoded.startsWith("/") ? [] : sourcePath.split("/").slice(0, -1);
    for (const part of decoded.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (!parts.length) return null;
        parts.pop();
      } else parts.push(part);
    }
    return parts.length ? { path: parts.join("/"), fragment } : null;
  } catch {
    return null;
  }
}

export function resolveBookLocation(
  chapters: Chapter[],
  sourcePath: string,
  href: string,
): BookLocation | null {
  const target = resolveEpubHref(sourcePath, href);
  if (!target) return null;
  const chapterIndex = chapters.findIndex((chapter) => chapter.sourcePath === target.path);
  if (chapterIndex < 0) return null;
  const anchors = chapters[chapterIndex].anchors;
  if (target.fragment && (!anchors || !Object.hasOwn(anchors, target.fragment))) return null;
  return { chapterIndex, paragraphIndex: target.fragment ? anchors![target.fragment] : 0 };
}
