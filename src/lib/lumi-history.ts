/**
 * Persists Lumi conversations so they survive closing the panel or
 * reloading the page — one thread per "context" (book title, or "geral"
 * for conversations started without a specific book). Only for real
 * (non-anonymous) accounts; anonymous sessions stay ephemeral like before.
 */
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebase } from "./firebase";
import { withDeadline, withFallback } from "./async-utils";
import type { LumiMessage } from "./lumi";

const READ_TIMEOUT_MS = 5000;
const WRITE_TIMEOUT_MS = 10000;
const MAX_STORED_MESSAGES = 30;

export function contextKeyFor(bookTitle?: string | null): string {
  if (!bookTitle) return "geral";
  return (
    bookTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 140) || "geral"
  );
}

export async function loadLumiHistory(uid: string, contextKey: string): Promise<LumiMessage[]> {
  const fb = getFirebase();
  if (!fb) return [];
  try {
    const ref = doc(fb.db, "users", uid, "lumi", contextKey);
    const snap = await withFallback(getDoc(ref), READ_TIMEOUT_MS, null);
    const data = snap?.data() as { messages?: LumiMessage[] } | undefined;
    return data?.messages ?? [];
  } catch (err) {
    console.warn("[lumi-history] load failed", err);
    return [];
  }
}

export async function saveLumiHistory(
  uid: string,
  contextKey: string,
  messages: LumiMessage[],
): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  try {
    const ref = doc(fb.db, "users", uid, "lumi", contextKey);
    await withDeadline(
      setDoc(
        ref,
        { messages: messages.slice(-MAX_STORED_MESSAGES), updatedAt: serverTimestamp() },
        { merge: true },
      ),
      WRITE_TIMEOUT_MS,
      "timeout",
    );
  } catch (err) {
    console.warn("[lumi-history] save failed (non-blocking)", err);
  }
}

export async function clearLumiHistory(uid: string, contextKey: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  const ref = doc(fb.db, "users", uid, "lumi", contextKey);
  await withDeadline(
    setDoc(ref, { messages: [], updatedAt: serverTimestamp() }, { merge: true }),
    WRITE_TIMEOUT_MS,
    "Não foi possível limpar a conversa agora.",
  );
}
