import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ProgressConflict, ReadingProgress } from "@/lib/reader-store";

function positionLabel(progress: ReadingProgress): string {
  if (progress.pageIndex !== undefined) {
    const viewport = progress.pdfViewport;
    return `Página ${progress.pageIndex + 1}${viewport ? ` · rolagem ${Math.round(viewport.y * 100)}%, horizontal ${Math.round(viewport.x * 100)}%` : ""}`;
  }
  const percentage = Math.round((progress.overallRatio ?? 0) * 100);
  return `Capítulo ${progress.chapterIndex + 1} · ${percentage}%`;
}

export function ProgressConflictDialog({
  conflict,
  onChoose,
}: {
  conflict: ProgressConflict | null;
  onChoose: (source: "local" | "remote") => void;
}) {
  return (
    <AlertDialog open={Boolean(conflict)}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {conflict?.legacy ? "Recuperar leitura anterior?" : "Onde deseja continuar?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {conflict?.legacy
              ? "Há uma posição salva neste navegador por uma versão anterior do BookVerse. Escolha se deseja vinculá-la à sua conta."
              : "Encontramos posições diferentes para este livro. Escolha a leitura que quer retomar."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2 rounded-xl border border-border/70 p-4 text-sm">
          <p>
            Neste dispositivo: <strong>{conflict && positionLabel(conflict.local)}</strong>
          </p>
          <p>
            Na sua conta:{" "}
            <strong>
              {conflict &&
                (conflict.legacy && conflict.remote.updatedAt === 0
                  ? "Início do livro"
                  : positionLabel(conflict.remote))}
            </strong>
          </p>
        </div>
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogAction
            className="min-h-11 bg-secondary text-secondary-foreground hover:bg-secondary/80"
            onClick={() => onChoose("local")}
          >
            Continuar aqui
          </AlertDialogAction>
          <AlertDialogAction className="min-h-11" onClick={() => onChoose("remote")}>
            Usar posição da conta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
