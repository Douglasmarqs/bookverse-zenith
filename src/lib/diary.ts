/**
 * Diário de leitura — entradas com reação e comentário sobre o que o
 * leitor está lendo, no estilo "histórico com emojis" do Skoob.
 * Guardado em `users/{uid}/diary/{entryId}` (acesso só do dono).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { withDeadline } from "./async-utils";
import { awardXp, recordReadingActivity } from "./user-profile";

export const DIARY_REACTIONS = [
  { id: "amei", emoji: "😍", label: "Amei" },
  { id: "animado", emoji: "🤩", label: "Empolgado" },
  { id: "rindo", emoji: "😂", label: "Divertido" },
  { id: "pensativo", emoji: "🤔", label: "Reflexivo" },
  { id: "frustrado", emoji: "😤", label: "Frustrado" },
  { id: "triste", emoji: "😢", label: "Emocionado" },
] as const;

export type DiaryReactionId = (typeof DIARY_REACTIONS)[number]["id"];

export interface DiaryEntry {
  id: string;
  bookTitle: string;
  bookAuthor: string;
  bookCover: string | null;
  reaction: DiaryReactionId;
  note: string;
  createdAt?: { toMillis?: () => number } | null;
}

const WRITE_TIMEOUT_MS = 10000;

export async function addDiaryEntry(
  uid: string,
  entry: {
    bookTitle: string;
    bookAuthor: string;
    bookCover: string | null;
    reaction: DiaryReactionId;
    note: string;
  },
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("O login não está disponível neste ambiente agora.");
  const note = entry.note.trim().slice(0, 1000);
  if (!entry.bookTitle.trim()) throw new Error("Escolha um livro para registrar no diário.");
  if (!note) throw new Error("Escreva pelo menos uma linha sobre o momento de leitura.");

  await withDeadline(
    addDoc(collection(fb.db, "users", uid, "diary"), {
      bookTitle: entry.bookTitle.trim().slice(0, 200),
      bookAuthor: entry.bookAuthor.trim().slice(0, 120),
      bookCover: entry.bookCover && entry.bookCover.length < 700_000 ? entry.bookCover : null,
      reaction: entry.reaction,
      note,
      createdAt: serverTimestamp(),
    }),
    WRITE_TIMEOUT_MS,
    "Não foi possível salvar no diário agora. Tente novamente.",
  );
  void awardXp(uid, 10);
  void recordReadingActivity(uid, {});
}

export async function deleteDiaryEntry(uid: string, id: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("O login não está disponível neste ambiente agora.");
  await withDeadline(
    deleteDoc(doc(fb.db, "users", uid, "diary", id)),
    WRITE_TIMEOUT_MS,
    "Não foi possível apagar esta entrada agora. Tente novamente.",
  );
}

export function subscribeDiary(uid: string, cb: (entries: DiaryEntry[]) => void): Unsubscribe {
  const fb = getFirebase();
  if (!fb) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(fb.db, "users", uid, "diary"), orderBy("createdAt", "desc")),
    (snap) => {
      cb(
        snap.docs.map((d) => {
          const data = d.data() as Omit<DiaryEntry, "id">;
          return { id: d.id, ...data };
        }),
      );
    },
    (err) => {
      console.warn("[diary] subscribe failed", err);
      cb([]);
    },
  );
}
