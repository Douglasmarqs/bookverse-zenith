/**
 * Client for the "Lumi" AI reading companion. Proxies chat turns through the
 * `askLumi` Firebase Cloud Function (see /functions in the repo root) so the
 * model API key never touches the browser.
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebase } from "./firebase";
import type { LumiContext } from "./lumi-panel-store";

export interface LumiMessage {
  role: "user" | "assistant";
  text: string;
}

interface AskLumiResponse {
  reply: string;
}

/**
 * Sends the running conversation + optional book context to the backend and
 * returns Lumi's reply. Throws a friendly error if the function isn't
 * deployed yet or the call otherwise fails.
 */
export async function askLumi(
  messages: LumiMessage[],
  context?: LumiContext | null,
): Promise<string> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase não inicializado.");

  const functions = getFunctions(fb.app);
  const callable = httpsCallable<
    { messages: LumiMessage[]; context?: LumiContext | null },
    AskLumiResponse
  >(functions, "askLumi");

  try {
    const res = await callable({ messages, context: context ?? null });
    return res.data.reply;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? "";
    if (code.includes("not-found") || code.includes("internal")) {
      throw new Error(
        "A IA ainda não foi implantada neste projeto Firebase. Faça o deploy da função `askLumi` (veja /functions/README.md).",
      );
    }
    throw new Error("Lumi não conseguiu responder agora. Tente novamente em instantes.");
  }
}
