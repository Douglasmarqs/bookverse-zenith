/**
 * Resenhas da comunidade — estilo Skoob: uma resenha por leitor por livro,
 * visíveis para qualquer usuário logado, com curtidas e marcação de spoiler.
 *
 * Estrutura no Firestore:
 *   books/{bookId}/reviews/{uid}                  a resenha (doc id = uid do autor)
 *   books/{bookId}/reviews/{uid}/likes/{likerUid} curtidas (doc id = uid de quem curtiu)
 *   users/{uid}/reviewIndex/{bookId}              espelho leve que permite à
 *                                                 exclusão de conta localizar
 *                                                 as resenhas do usuário sem
 *                                                 collection group query.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { withDeadline, withFallback } from "./async-utils";
import { awardXp } from "./user-profile";

export const REVIEW_MAX_LENGTH = 2000;
export const REVIEW_MIN_LENGTH = 10;
/** XP concedido na primeira publicação de uma resenha. */
export const REVIEW_XP = 15;

export interface BookReview {
  /** Doc id = uid do autor. */
  id: string;
  uid: string;
  displayName: string;
  photoURL: string | null;
  avatarEmoji: string | null;
  /** 0–5 estrelas; 0 = resenha só com texto. */
  rating: number;
  text: string;
  spoiler: boolean;
  createdAt?: { toMillis?: () => number } | null;
  updatedAt?: { toMillis?: () => number } | null;
}

const READ_TIMEOUT_MS = 5000;
const WRITE_TIMEOUT_MS = 10000;

function reviewsRef(bookId: string) {
  const fb = getFirebase();
  if (!fb) return null;
  return collection(fb.db, "books", bookId, "reviews");
}

export function subscribeReviews(
  bookId: string,
  cb: (reviews: BookReview[]) => void,
): Unsubscribe {
  const col = reviewsRef(bookId);
  if (!col) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    query(col, orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BookReview, "id">) }))),
    (err) => {
      console.warn("[reviews] subscribe failed", err);
      cb([]);
    },
  );
}

export interface ReviewAuthor {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
}

/** Cria ou atualiza a resenha do usuário para o livro (uma por leitor). */
export async function saveReview(
  user: ReviewAuthor,
  profile: { avatarEmoji?: string | null } | null,
  bookId: string,
  input: { rating: number; text: string; spoiler: boolean },
): Promise<{ isNew: boolean }> {
  const fb = getFirebase();
  if (!fb) throw new Error("O login não está disponível neste ambiente agora.");
  const text = input.text.trim().slice(0, REVIEW_MAX_LENGTH);
  if (text.length < REVIEW_MIN_LENGTH) {
    throw new Error("Escreva pelo menos uma frase na sua resenha.");
  }
  const rating = Math.max(0, Math.min(5, Math.round(input.rating)));
  const ref = doc(fb.db, "books", bookId, "reviews", user.uid);

  const existing = await withFallback(getDoc(ref), READ_TIMEOUT_MS, null).catch(() => null);
  const isNew = !existing || !existing.exists();

  await withDeadline(
    setDoc(
      ref,
      {
        uid: user.uid,
        displayName: user.displayName || user.email?.split("@")[0] || "Leitor",
        photoURL: user.photoURL ?? null,
        avatarEmoji: profile?.avatarEmoji ?? null,
        rating,
        text,
        spoiler: !!input.spoiler,
        ...(isNew ? { createdAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    WRITE_TIMEOUT_MS,
    "Não foi possível publicar sua resenha agora. Tente novamente.",
  );

  // Índice espelho (fire-and-forget) para a exclusão de conta localizar as
  // resenhas sem precisar de collection group query.
  void setDoc(doc(fb.db, "users", user.uid, "reviewIndex", bookId), { bookId }, { merge: true }).catch(
    () => {},
  );

  if (isNew) void awardXp(user.uid, REVIEW_XP);
  return { isNew };
}

export async function deleteReview(uid: string, bookId: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("O login não está disponível neste ambiente agora.");
  await withDeadline(
    deleteDoc(doc(fb.db, "books", bookId, "reviews", uid)),
    WRITE_TIMEOUT_MS,
    "Não foi possível apagar sua resenha agora. Tente novamente.",
  );
  void deleteDoc(doc(fb.db, "users", uid, "reviewIndex", bookId)).catch(() => {});
}

/* ------------------------------------------------------------------ *
 * Curtidas — um doc por curtida em `likes/{likerUid}`. Cada usuário só
 * pode escrever o próprio doc (ver firestore.rules), então a contagem
 * não pode ser inflada por terceiros.
 * ------------------------------------------------------------------ */

export function subscribeReviewLikes(
  bookId: string,
  reviewUid: string,
  cb: (likerUids: string[]) => void,
): Unsubscribe {
  const fb = getFirebase();
  if (!fb) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    collection(fb.db, "books", bookId, "reviews", reviewUid, "likes"),
    (snap) => cb(snap.docs.map((d) => d.id)),
    (err) => {
      console.warn("[reviews] likes subscribe failed", err);
      cb([]);
    },
  );
}

export async function setReviewLike(
  bookId: string,
  reviewUid: string,
  likerUid: string,
  like: boolean,
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("O login não está disponível neste ambiente agora.");
  const ref = doc(fb.db, "books", bookId, "reviews", reviewUid, "likes", likerUid);
  await withDeadline(
    like ? setDoc(ref, { createdAt: serverTimestamp() }) : deleteDoc(ref),
    WRITE_TIMEOUT_MS,
    "Não foi possível registrar sua curtida agora. Tente novamente.",
  );
}
