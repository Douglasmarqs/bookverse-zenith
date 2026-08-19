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
}

export function computeGoalProgress(entries: LibraryEntry[], target: number): GoalProgress {
  const completed = entries.filter((e) => e.status === "concluido").length;
  const percent = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
  const remaining = Math.max(0, target - completed);
  const monthsLeft = Math.max(1, 12 - new Date().getMonth());
  const expected = target * ((new Date().getMonth() + 1) / 12);
  return {
    completed,
    target,
    percent,
    remaining,
    perMonthNeeded: Math.ceil(remaining / monthsLeft),
    onTrack: completed >= Math.floor(expected),
  };
}
