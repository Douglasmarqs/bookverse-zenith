import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { useAuthUser } from "@/hooks/use-auth-user";
import { saveEpubBook, uploadEpubBookToCloud } from "@/lib/epub-store";
import { addToLibrary } from "@/lib/library";
import { describeFirestoreError } from "@/lib/async-utils";

/**
 * Drag-and-drop EPUB import surface. Parses the file fully in the browser,
 * stores it locally (IndexedDB), registers it in the reader's library and
 * mirrors it to the cloud so the same book opens on other devices.
 */
export function EpubImport({ className = "" }: { className?: string }) {
  const user = useAuthUser();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const signedIn = !!user && !user.isAnonymous;

  async function handleFile(file: File | null | undefined) {
    if (!file || busy) return;
    if (!signedIn || !user) {
      void navigate({ to: "/auth", search: { redirect: "/" } });
      return;
    }
    setBusy(true);
    try {
      const { parseEpubFile } = await import("@/lib/epub-parser");
      const book = await parseEpubFile(file);
      await saveEpubBook(book);
      await addToLibrary(
        user.uid,
        { title: book.title, author: book.author, cover: book.cover, readerId: book.id },
        "lendo",
      );
      void uploadEpubBookToCloud(user.uid, book);
      toast.success(`"${book.title}" pronto para leitura.`);
      void navigate({ to: "/reader/$bookId", params: { bookId: book.id } });
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível importar este EPUB."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void handleFile(e.dataTransfer.files?.[0]);
      }}
      className={`rounded-3xl border border-dashed p-6 text-center transition ${
        over ? "border-gold bg-gold/5" : "border-border/70 bg-card/40"
      } ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".epub"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-gold/12 text-gold">
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <UploadCloud className="h-5 w-5" />
        )}
      </div>
      <p className="mt-4 font-display text-lg font-medium">
        {busy ? "Processando seu livro…" : "Arraste um .epub aqui"}
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Capítulos, ilustrações e capa são lidos no seu próprio navegador — e o progresso sincroniza
        entre aparelhos.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
      >
        {signedIn ? "Escolher arquivo" : "Entrar para importar"}
      </button>
    </div>
  );
}
