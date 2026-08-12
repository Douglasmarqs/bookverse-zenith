/**
 * Client for the "Lumi" AI reading companion. Proxies chat turns through the
 * `askLumi` Firebase Cloud Function (see /functions in the repo root) so the
 * model API key never touches the browser.
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { ensureUserOrThrow, getFirebase } from "./firebase";
import type { LumiContext } from "./lumi-panel-store";

export interface LumiMessage {
  role: "user" | "assistant";
  text: string;
}

interface AskLumiResponse {
  reply: string;
}

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/admin-restricted-operation":
      "Login anônimo está desabilitado no Firebase Console (Authentication → Sign-in method → Anonymous → habilitar).",
    "auth/network-request-failed": "Falha de rede ao iniciar a sessão. Verifique sua conexão.",
    "auth/configuration-not-found":
      "A configuração de Authentication não foi encontrada no Firebase Console.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      "A chave de API do Firebase configurada é inválida.",
    "auth/invalid-api-key": "A chave de API do Firebase configurada é inválida.",
  };
  if (map[code]) return map[code];
  return code
    ? `Não foi possível iniciar uma sessão para conversar com a Lumi (${code}).`
    : "Não foi possível iniciar uma sessão para conversar com a Lumi agora. Tente novamente em instantes.";
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

  // askLumi requires an authenticated caller (any session works, including
  // anonymous) — make sure one exists even if the visitor never touched a
  // page that signs them in first (e.g. clicking "IA" straight from the nav).
  try {
    await ensureUserOrThrow();
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }

  const functions = getFunctions(fb.app);
  const callable = httpsCallable<
    { messages: LumiMessage[]; context?: LumiContext | null },
    AskLumiResponse
  >(functions, "askLumi", { timeout: 30000 });

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
    if (code.includes("unauthenticated")) {
      throw new Error("Faça login para conversar com a Lumi.");
    }
    throw new Error(
      code
        ? `Lumi não conseguiu responder agora (${code}).`
        : "Lumi não conseguiu responder agora. Tente novamente em instantes.",
    );
  }
}
