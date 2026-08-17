import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebase } from "./firebase";

export interface BookRecommendation {
  title: string;
  author: string;
  reason: string;
}

/**
 * Asks Lumi to recommend one next book based on what's already in the
 * person's library. Throws on failure — callers should catch and show a
 * friendly message (see the `failed-precondition` case in the Cloud
 * Function for "not enough library history yet").
 */
export async function getNextBookRecommendation(
  recentTitles: { title: string; author?: string }[],
): Promise<BookRecommendation> {
  const fb = getFirebase();
  if (!fb) throw new Error("Faça login para receber recomendações.");
  const fn = httpsCallable<
    { recentTitles: { title: string; author?: string }[] },
    BookRecommendation
  >(getFunctions(fb.app), "recommendNextBook", { timeout: 15000 });
  const res = await fn({ recentTitles });
  return res.data;
}
