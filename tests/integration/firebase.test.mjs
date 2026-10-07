import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDocFromServer,
  deleteDoc,
  terminate,
  disableNetwork,
  enableNetwork,
  waitForPendingWrites,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";

// Fixed local endpoints and a demo-only project: this suite cannot select a
// deployed Firebase project through environment variables or credentials.
const projectId = "demo-bookverse";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const password = "Local-emulator-test-123!";
const clients = [];
let owner, other, device, guest;
function client(name) {
  const app = initializeApp(
    { projectId, apiKey: "demo-bookverse-local", storageBucket: `${projectId}.appspot.com` },
    `${name}-${suffix}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8085);
  const storage = getStorage(app);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const result = { app, auth, db, storage, functions };
  clients.push(result);
  return result;
}
const denied = (operation) =>
  assert.rejects(operation, (error) => /permission-denied|storage\/unauthorized/.test(error.code));
const privateDoc = (client, collection, id = "book") =>
  doc(client.db, "users", owner.auth.currentUser.uid, collection, id);

before(
  async () => {
    const response = await fetch("http://127.0.0.1:4400/emulators");
    assert.ok(response.ok, "Start the Firebase emulators before running integration tests");
    const emulators = await response.json();
    for (const service of ["auth", "firestore", "storage", "functions"])
      assert.ok(emulators[service], `${service} emulator is required`);
    owner = client("owner");
    other = client("other");
    device = client("device");
    guest = client("guest");
    const email = `owner-${suffix}@example.test`;
    await createUserWithEmailAndPassword(owner.auth, email, password);
    await createUserWithEmailAndPassword(other.auth, `other-${suffix}@example.test`, password);
    await signInWithEmailAndPassword(device.auth, email, password);
    await setDoc(doc(owner.db, "users", owner.auth.currentUser.uid), {
      uid: owner.auth.currentUser.uid,
      displayName: "Local QA",
      xp: 0,
      booksCompleted: 0,
    });
  },
  { timeout: 30000 },
);

after(async () => {
  await Promise.all(
    clients.map(async ({ db, app }) => {
      await terminate(db);
      await deleteApp(app);
    }),
  );
});

test(
  "private library, progress, annotations and preferences are isolated by account",
  { timeout: 30000 },
  async () => {
    for (const collection of [
      "library",
      "progress",
      "annotations",
      "preferences",
      "epubFiles",
      "pdfFiles",
    ]) {
      await setDoc(privateDoc(owner, collection), { test: suffix, chapterIndex: 2 });
      assert.equal((await getDocFromServer(privateDoc(device, collection))).data().chapterIndex, 2);
      await denied(() => getDocFromServer(privateDoc(other, collection)));
      await denied(() => setDoc(privateDoc(other, collection), { chapterIndex: 99 }));
      await denied(() => getDocFromServer(privateDoc(guest, collection)));
    }
  },
);

test(
  "an offline write reaches the second device after reconnection",
  { timeout: 30000 },
  async () => {
    const target = privateDoc(owner, "progress", "offline");
    await setDoc(target, { chapterIndex: 0, updatedAt: 1 });
    await disableNetwork(owner.db);
    const pending = setDoc(target, { chapterIndex: 4, updatedAt: 2 });
    assert.equal(
      (await getDocFromServer(privateDoc(device, "progress", "offline"))).data().chapterIndex,
      0,
    );
    await enableNetwork(owner.db);
    await pending;
    await waitForPendingWrites(owner.db);
    assert.equal(
      (await getDocFromServer(privateDoc(device, "progress", "offline"))).data().chapterIndex,
      4,
    );
  },
);

test(
  "reading milestones reach the Functions emulator and remain idempotent",
  { timeout: 30000 },
  async () => {
    const uid = owner.auth.currentUser.uid;
    const bookId = `milestone-${suffix}`;
    await setDoc(doc(owner.db, "users", uid, "library", bookId), { status: "quero-ler" });
    const record = httpsCallable(owner.functions, "recordReadingMilestone");

    assert.deepEqual((await record({ type: "book-added", resourceId: bookId })).data, {
      accepted: true,
    });
    assert.deepEqual((await record({ type: "book-added", resourceId: bookId })).data, {
      accepted: false,
    });

    const profile = (await getDocFromServer(doc(device.db, "users", uid))).data();
    assert.equal(profile.xp, 5);
    assert.equal(profile.weeklyBooksAdded, 1);
  },
);

test(
  "private EPUB/PDF objects can be recovered on another device but not another account",
  { timeout: 30000 },
  async () => {
    for (const [folder, filename, contentType] of [
      ["epubs", "source.epub", "application/epub+zip"],
      ["pdfs", "source.pdf", "application/pdf"],
      ["epubs", "book.json", "application/json"],
    ]) {
      const path = `users/${owner.auth.currentUser.uid}/${folder}/qa-${suffix}/${filename}`;
      const bytes = new TextEncoder().encode("Local emulator fixture only");
      await uploadBytes(ref(owner.storage, path), bytes, { contentType });
      assert.deepEqual(new Uint8Array(await getBytes(ref(device.storage, path))), bytes);
      await denied(() => getBytes(ref(other.storage, path)));
      await denied(() => getBytes(ref(guest.storage, path)));
      await denied(() => uploadBytes(ref(other.storage, path), bytes, { contentType }));
    }
    await denied(() =>
      uploadBytes(
        ref(owner.storage, `users/${owner.auth.currentUser.uid}/pdfs/qa-${suffix}/source.pdf`),
        new Uint8Array([1]),
        { contentType: "text/html" },
      ),
    );
  },
);

test("reviews permit owner edits and reject another author's writes and invalid ratings", async () => {
  const uid = owner.auth.currentUser.uid;
  const review = {
    uid,
    displayName: "Local QA",
    rating: 4,
    text: "Texto de teste somente no emulador.",
    spoiler: false,
  };
  const path = ["books", `qa-${suffix}`, "reviews", uid];
  await setDoc(doc(owner.db, ...path), review);
  await setDoc(doc(owner.db, ...path), { ...review, rating: 5 });
  assert.equal((await getDocFromServer(doc(device.db, ...path))).data().rating, 5);
  await denied(() => setDoc(doc(other.db, ...path), review));
  await denied(() => setDoc(doc(owner.db, ...path), { ...review, rating: 6 }));
  await denied(() =>
    setDoc(doc(owner.db, ...path), { ...review, uid: other.auth.currentUser.uid }),
  );
  await deleteDoc(doc(owner.db, ...path));
});
