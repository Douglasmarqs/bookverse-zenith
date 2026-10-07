import { getFirebase } from "./firebase-services";

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
  const { bookverseCallable } = await import("./firebase-functions");
  const fn = bookverseCallable<
    { recentTitles: { title: string; author?: string }[] },
    BookRecommendation
  >("recommendNextBook", 15_000);
  const res = await fn({ recentTitles });
  return res.data;
}
