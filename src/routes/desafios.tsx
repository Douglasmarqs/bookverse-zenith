import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, BookMarked } from "lucide-react";
import { subscribeAuth } from "@/lib/firebase";
import { subscribeUserProfile, type UserProfile } from "@/lib/user-profile";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/desafios")({
  head: () => ({ meta: [{ title: "Desafios — BookVerse" }] }),
  component: DesafiosPage,
});

function DesafiosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setProfile(null);
      setLibrary([]);
      return;
    }
    const unsubProfile = subscribeUserProfile(user.uid, setProfile);
    const unsubLibrary = subscribeLibrary(user.uid, setLibrary);
    return () => {
      unsubProfile();
      unsubLibrary();
    };
  }, [user]);

  const signedIn = !!user && !user.isAnonymous;
  const booksCompleted = profile?.booksCompleted ?? 0;
  const xp = profile?.xp ?? 0;
  const libraryCount = library.length;

  const challenges = [
    {
      title: "12 livros em 2026",
      pill: "Anual",
      progress: Math.min(100, Math.round((booksCompleted / 12) * 100)),
      detail: `${booksCompleted} de 12 livros concluídos`,
    },
    {
      title: "Monte sua estante",
      pill: "Biblioteca",
      progress: Math.min(100, Math.round((libraryCount / 5) * 100)),
      detail: `${libraryCount} de 5 livros salvos`,
    },
    {
      title: "1000 XP",
      pill: "Streak",
      progress: Math.min(100, Math.round((xp / 1000) * 100)),
      detail: `${xp} de 1000 XP`,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 md:px-8">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
        <Trophy className="h-4 w-4" /> Desafios
      </div>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Metas que valem uma medalha</h1>

      {!signedIn && (
        <div className="mt-8 rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <p className="text-muted-foreground">Entre na sua conta para acompanhar seu progresso real.</p>
          <Link
            to="/auth"
            search={{ redirect: undefined }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Entrar
          </Link>
        </div>
      )}

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {challenges.map((c) => (
          <div key={c.title} className="rounded-2xl border border-border/60 bg-card/60 p-6">
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-gold/30 bg-gold/5 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-gold">
                {c.pill}
              </span>
              <BookMarked className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="mt-5 font-display text-xl font-medium leading-snug">{c.title}</h3>
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progresso</span>
                <span className="text-gold">{c.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft"
                  style={{ width: `${c.progress}%` }}
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{c.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
