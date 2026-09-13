import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { useAuthUser } from "@/hooks/use-auth-user";
import {
  deleteEpubBook,
  deleteEpubBookFromCloud,
  saveEpubBook,
  uploadEpubBookToCloud,
} from "@/lib/epub-store";
import {
  createPdfBook,
  deletePdfBook,
  deletePdfBookFromCloud,
  savePdfBook,
  uploadPdfBookToCloud,
} from "@/lib/pdf-store";
import { addToLibrary } from "@/lib/library";
import { describeFirestoreError } from "@/lib/async-utils";

/**
 * Drag-and-drop book import surface. EPUBs are parsed into reflowable text;
 * PDFs retain their original layout. Both formats are private, synced and
 * open from the same library on another device.
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
      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      if (isPdf) {
        const book = createPdfBook(file);
        await savePdfBook(book);
        try {
          await uploadPdfBookToCloud(user.uid, book);
          await addToLibrary(
            user.uid,
            { title: book.title, author: book.author, cover: null, readerId: book.id },
            "lendo",
          );
        } catch (err) {
          void deletePdfBook(book.id).catch(() => {});
          void deletePdfBookFromCloud(user.uid, book.id).catch(() => {});
          throw err;
        }
        toast.success('"' + book.title + '" pronto para leitura.');
        void navigate({ to: "/reader/$bookId", params: { bookId: book.id } });
        return;
      }
      const { parseEpubFile } = await import("@/lib/epub-parser");
      const book = await parseEpubFile(file);
      await saveEpubBook(book);
      try {
        // Do not surface a library entry until its private cloud copy exists.
        // That keeps a successful import truthful across every device.
        await uploadEpubBookToCloud(user.uid, book, file);
        await addToLibrary(
          user.uid,
          { title: book.title, author: book.author, cover: book.cover, readerId: book.id },
          "lendo",
        );
      } catch (err) {
        void deleteEpubBook(book.id).catch(() => {});
        void deleteEpubBookFromCloud(user.uid, book.id).catch(() => {});
        throw err;
      }
      toast.success(`"${book.title}" pronto para leitura.`);
      void navigate({ to: "/reader/$bookId", params: { bookId: book.id } });
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível importar este arquivo."));
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
        accept=".epub,.pdf,application/epub+zip,application/pdf"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-gold/12 text-gold">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
      </div>
      <p className="mt-4 font-display text-lg font-medium">
        {busy ? "Processando seu livro…" : "Arraste um .epub ou .pdf aqui"}
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        EPUBs e PDFs ficam privados na sua conta e disponíveis também nos seus outros aparelhos.
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
