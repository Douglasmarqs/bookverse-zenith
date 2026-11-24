import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { Link } from "@tanstack/react-router";
import { RefreshCw, ArrowRight } from "lucide-react";
import { LumiMascot } from "@/components/lumi-mascot";
import { getNextBookRecommendation, type BookRecommendation } from "@/lib/lumi-recommend";
import { slugFor } from "@/lib/library";
import type { LibraryEntry } from "@/lib/library";

function cacheKey(uid: string) {
  return `bookverse:lumi-recommendation:${uid}`;
}
// Recommendations are cached client-side for half a day — a fresh Groq
// call every single homepage visit would burn through the free tier's
// rate limit fast for no real benefit (taste doesn't change minute to
// minute), and a stable "pick of the day" feel is arguably nicer anyway.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * "Sugestão da Lumi" — a proactive recommendation based on what's already
 * in the person's library, rather than something they had to ask for.
 * Hidden entirely for logged-out/anonymous visitors and while the library
 * is still empty (nothing to base a suggestion on yet).
 */
export function LumiRecommendationCard({
  user,
  libraryEntries,
}: {
  user: User | null;
  libraryEntries: LibraryEntry[];
}) {
  const [rec, setRec] = useState<BookRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(cacheKey(user.uid));
      if (!raw) return;
      const cached = JSON.parse(raw) as { rec: BookRecommendation; at: number };
      if (Date.now() - cached.at < CACHE_TTL_MS) setRec(cached.rec);
    } catch {
      // corrupt/old cache shape — ignore, just ask fresh
    }
  }, [user]);

  async function fetchRecommendation() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Completed books are the strongest signal of actual taste, so they
      // lead the list; everything else fills the rest, capped at 15 so
      // the prompt stays small.
      const prioritized = [
        ...libraryEntries.filter((e) => e.status === "concluido"),
        ...libraryEntries.filter((e) => e.status !== "concluido"),
      ]
        .slice(0, 15)
        .map((e) => ({ title: e.title, author: e.author ?? undefined }));

      const result = await getNextBookRecommendation(prioritized);
      setRec(result);
      localStorage.setItem(cacheKey(user.uid), JSON.stringify({ rec: result, at: Date.now() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui pensar numa sugestão agora.");
    } finally {
      setLoading(false);
    }
  }

  if (!user || user.isAnonymous) return null;

  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-[1.75rem] border border-border bg-card/70 p-6 backdrop-blur">
      <div aria-hidden className="lamp-glow absolute -right-16 -top-16 h-48 w-48" />
      <div className="relative flex items-center gap-3">
        <LumiMascot size={52} thinking={loading} className="shrink-0" />
        <div>
          <p className="eyebrow">Lumi sugere</p>
          <p className="text-xs text-muted-foreground">com base na sua estante</p>
        </div>
      </div>

      <div className="relative min-w-0 flex-1">
        {libraryEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Adicione alguns livros à sua biblioteca — assim eu consigo entender seu gosto e sugerir
            o próximo.
          </p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Pensando numa sugestão pra você…</p>
        ) : rec ? (
          <>
            <p className="font-display text-3xl leading-tight">{rec.title}</p>
            {rec.author && <p className="text-sm text-muted-foreground">{rec.author}</p>}
            {rec.reason && (
              <p className="mt-2 font-[family-name:var(--font-book)] text-[15px] italic leading-relaxed text-muted-foreground">
                {rec.reason}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Quer uma sugestão de leitura com base no que já está na sua biblioteca?
          </p>
        )}
        {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
      </div>

      <div className="relative flex flex-wrap items-center gap-2">
        {rec && !loading && (
          <Link
            to="/livro/$slug"
            params={{ slug: slugFor(rec.title, rec.author) || "livro" }}
            search={{ title: rec.title, author: rec.author }}
            className="btn-primary px-4 py-2 text-sm"
          >
            Ver livro <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
        {libraryEntries.length > 0 && (
          <button
            onClick={fetchRecommendation}
            disabled={loading}
            className="btn-ghost px-4 py-2 text-sm disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {rec ? "Pedir outra" : "Pedir sugestão"}
          </button>
        )}
      </div>
    </div>
  );
}
