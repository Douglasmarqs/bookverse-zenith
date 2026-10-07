import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type HttpsCallable,
} from "firebase/functions";
import { getFirebaseAuth, usesFirebaseEmulators } from "./firebase";

let emulatorConnected = false;

/** Creates a callable on demand. Keeping the Functions SDK behind this module
 * prevents public pages from downloading it until a feature actually calls a
 * backend Function. */
export function bookverseCallable<RequestData, ResponseData>(
  name: string,
  timeout: number,
): HttpsCallable<RequestData, ResponseData> {
  const fb = getFirebaseAuth();
  if (!fb) throw new Error("Firebase não está configurado neste ambiente.");
  const functions = getFunctions(fb.app);
  if (usesFirebaseEmulators() && !emulatorConnected) {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    emulatorConnected = true;
  }
  return httpsCallable<RequestData, ResponseData>(functions, name, { timeout });
}
