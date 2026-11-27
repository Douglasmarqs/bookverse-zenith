/**
 * Metas de leitura anuais — no estilo "desafio de leitura" do Skoob/
 * Goodreads. Uma meta por ano, guardada em
 * `users/{uid}/goals/{ano}` para que o histórico dos anos anteriores
 * continue visível sem precisar de migração.
 *
 * Só a *meta* vive aqui; o progresso é derivado da biblioteca (livros com
 * status "concluido"), assim nunca fica dessincronizado do que o leitor
 * realmente terminou.
 */
import { doc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { getFirebase } from "./firebase";
import { withDeadline } from "./async-utils";
import type { LibraryEntry } from "./library";

const WRITE_TIMEOUT_MS = 10000;

export interface ReadingGoal {
  year: number;
  /** Quantos livros o leitor quer concluir no ano. */
  books: number;
  updatedAt?: unknown;
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export async function saveReadingGoal(uid: string, year: number, books: number): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("O login não está disponível neste ambiente agora.");
  const clamped = Math.max(1, Math.min(999, Math.round(books)));
  await withDeadline(
    setDoc(
      doc(fb.db, "users", uid, "goals", String(year)),
      { year, books: clamped, updatedAt: Date.now() },
      { merge: true },
    ),
    WRITE_TIMEOUT_MS,
    "Não foi possível salvar sua meta agora. Tente novamente.",
  );
}

export function subscribeReadingGoal(
  uid: string,
  year: number,
  cb: (goal: ReadingGoal | null) => void,
): Unsubscribe {
  const fb = getFirebase();
  if (!fb) {
    cb(null);
    return () => {};
  }
  return onSnapshot(
    doc(fb.db, "users", uid, "goals", String(year)),
    (snap) => cb(snap.exists() ? (snap.data() as ReadingGoal) : null),
    (err) => {
      console.warn("[goals] subscribe failed", err);
      cb(null);
    },
  );
}

export interface GoalProgress {
  completed: number;
  target: number;
  percent: number;
  /** Quantos livros faltam para bater a meta (nunca negativo). */
  remaining: number;
  /** Ritmo necessário por mês no tempo restante do ano. */
  perMonthNeeded: number;
  onTrack: boolean;
  /** Livros esperados até hoje para estar no ritmo (fracionário). */
  expectedByNow: number;
  /** Positivo = à frente do ritmo, negativo = atrás (em livros, arredondado). */
  delta: number;
  /** Projeção para o fim do ano no ritmo atual. */
  projected: number;
  /** Um livro a cada N dias para bater a meta no tempo que resta. */
  daysPerBook: number | null;
  /** Concluídos em cada mês do ano (jan…dez). */
  byMonth: number[];
  /** Os livros concluídos no ano, mais recentes primeiro. */
  books: LibraryEntry[];
  daysLeft: number;
}

function millisOf(v: unknown): number | null {
  if (typeof v === "number") return v;
  const t = v as { toMillis?: () => number } | null | undefined;
  return t?.toMillis ? t.toMillis() : null;
}

/** Quando o livro foi concluído; entradas antigas (sem data) usam a data em
 * que entraram na estante e contam para o ano atual. */
export function completionTime(e: LibraryEntry): number | null {
  return e.completedAt ?? millisOf(e.addedAt);
}

export function computeGoalProgress(
  entries: LibraryEntry[],
  target: number,
  year = currentYear(),
  now = new Date(),
): GoalProgress {
  const byMonth = Array.from({ length: 12 }, () => 0);
  const books: { e: LibraryEntry; t: number }[] = [];
  for (const e of entries) {
    if (e.status !== "concluido") continue;
    let t = completionTime(e);
    const legacy = !e.completedAt;
    let y = t ? new Date(t).getFullYear() : year;
    // Legacy finishes from before this feature count for the current year.
    if (legacy && y !== year && year === now.getFullYear()) {
      y = year;
      t = null;
    }
    if (y !== year) continue;
    const month = t ? new Date(t).getMonth() : now.getMonth();
    byMonth[month] = (byMonth[month] ?? 0) + 1;
    books.push({ e, t: t ?? now.getTime() });
  }
  books.sort((a, b) => b.t - a.t);
  const completed = books.length;
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
  const daysLeft = Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
  const percent = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
  const remaining = Math.max(0, target - completed);
  const monthsLeft = Math.max(1, 12 - now.getMonth());
  const expectedByNow = target * elapsed;
  return {
    completed,
    target,
    percent,
    remaining,
    perMonthNeeded: Math.ceil(remaining / monthsLeft),
    onTrack: completed >= Math.floor(expectedByNow),
    expectedByNow,
    delta: Math.round(completed - expectedByNow),
    projected: elapsed > 0.02 ? Math.round(completed / elapsed) : completed,
    daysPerBook: remaining > 0 ? Math.max(1, Math.floor(daysLeft / remaining)) : null,
    byMonth,
    books: books.map((b) => b.e),
    daysLeft,
  };
}
