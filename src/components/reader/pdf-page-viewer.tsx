import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileImage,
  Highlighter,
  Languages,
  Loader2,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { PdfBook } from "@/lib/pdf-store";
import { markAsReading } from "@/lib/library";
import {
  addPdfRegionHighlight,
  removePdfRegionHighlight,
  subscribeAnnotations,
  type BookAnnotations,
  type PdfRegionHighlight,
} from "@/lib/annotations";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { PdfDisplaySettingsPanel } from "@/components/reader/pdf-display-settings";
import {
  loadPdfDisplaySettings,
  savePdfDisplaySettings,
  type PdfDisplaySettings,
} from "@/lib/pdf-display-settings";
import {
  loadProgressRemote,
  loadSettings,
  saveProgress,
  saveSettings,
  saveSettingsRemote,
} from "@/lib/reader-store";

const PDF_PAGE_TURN_DURATION_MS = 680;
const EMPTY_ANNOTATIONS: BookAnnotations = { highlights: [], bookmarks: [], pdfRegions: [] };

type PdfPageTurn = {
  direction: "next" | "previous";
  width: number;
  height: number;
};

type RegionDraft = { startX: number; startY: number; x: number; y: number };

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => { width: number; height: number };
    render: (options: {
      canvasContext: CanvasRenderingContext2D;
      canvas: HTMLCanvasElement;
      viewport: { width: number; height: number };
      transform?: number[];
    }) => { promise: Promise<void>; cancel: () => void };
  }>;
};

/** BookVerse's fallback for image-only/scanned PDFs. It intentionally uses
 * PDF.js instead of the browser iframe so the reading chrome, progress,
 * gestures and paper-like page transition stay consistent with EPUBs. */
export function PdfPageViewer({ uid, book }: { uid: string; book: PdfBook }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageTurnCanvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PdfDocument | null>(null);
  const destroyPdfRef = useRef<(() => Promise<void>) | null>(null);
  const renderCancelRef = useRef<(() => void) | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const pageTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPageTurningRef = useRef(false);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(Math.max(1, book.pageCount));
  const [pdfReady, setPdfReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pageTurn, setPageTurn] = useState<PdfPageTurn | null>(null);
  const [pageTurnEnabled, setPageTurnEnabled] = useState(() => loadSettings().pageTurn !== false);
  const [url, setUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<BookAnnotations>(EMPTY_ANNOTATIONS);
  const [marking, setMarking] = useState(false);
  const [regionDraft, setRegionDraft] = useState<RegionDraft | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<PdfDisplaySettings>(() =>
    loadPdfDisplaySettings(),
  );

  const pageRegions = annotations.pdfRegions.filter((region) => region.page === page);

  const pageImageForLumi = useCallback(() => {
    const source = canvasRef.current;
    if (!source || !source.width || !source.height) return null;
    const maxLongSide = 1400;
    const scale = Math.min(1, maxLongSide / Math.max(source.width, source.height));
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(source.width * scale));
    output.height = Math.max(1, Math.round(source.height * scale));
    const context = output.getContext("2d", { alpha: false });
    if (!context) return null;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(source, 0, 0, output.width, output.height);
    return output.toDataURL("image/jpeg", 0.78);
  }, []);

  const openPageWithLumi = useCallback(
    (topic: "question" | "translation" | "summary", initialPrompt?: string) => {
      const pageImageDataUrl = pageImageForLumi();
      if (!pageImageDataUrl) {
        toast.error("A página ainda está sendo preparada. Tente novamente em instantes.");
        return;
      }
      openLumiPanel({
        bookTitle: book.title,
        bookAuthor: book.author,
        chapterTitle: `Página ${page}`,
        positionLabel: `Página ${page} de ${pageCount}`,
        pageImageDataUrl,
        topic,
        initialPrompt,
      });
    },
    [book.author, book.title, page, pageCount, pageImageForLumi],
  );

  const normalizedPoint = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }, []);

  async function saveRegion(draft: RegionDraft) {
    const x = Math.min(draft.startX, draft.x);
    const y = Math.min(draft.startY, draft.y);
    const width = Math.abs(draft.x - draft.startX);
    const height = Math.abs(draft.y - draft.startY);
    if (width < 0.025 || height < 0.012) return;
    try {
      await addPdfRegionHighlight(uid, book.id, {
        page,
        x,
        y,
        width,
        height,
        color: "gold",
      });
      toast.success("Trecho marcado e sincronizado.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar a marcação.");
    }
  }

  async function removeRegion(region: PdfRegionHighlight) {
    try {
      await removePdfRegionHighlight(uid, book.id, region.id);
      toast.success("Marcação removida.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível remover a marcação.");
    }
  }

  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(1, Math.min(pageCount, next));
      if (target === page || isPageTurningRef.current) return;

      const canvas = canvasRef.current;
      const turnCanvas = pageTurnCanvasRef.current;
      const turnsOneLeaf = pageTurnEnabled && Math.abs(target - page) === 1 && canvas?.width;
      if (!turnsOneLeaf || !canvas || !turnCanvas) {
        setPage(target);
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      try {
        // Copy pixels directly into a second canvas. This avoids the costly
        // PNG/JPEG encoding pause caused by canvas.toDataURL() on phones.
        turnCanvas.width = canvas.width;
        turnCanvas.height = canvas.height;
        turnCanvas.getContext("2d", { alpha: false })?.drawImage(canvas, 0, 0);
        isPageTurningRef.current = true;
        setPageTurn({
          direction: target > page ? "next" : "previous",
          width: bounds.width,
          height: bounds.height,
        });
        requestAnimationFrame(() => setPage(target));
        if (pageTurnTimerRef.current) clearTimeout(pageTurnTimerRef.current);
        pageTurnTimerRef.current = setTimeout(() => {
          isPageTurningRef.current = false;
          setPageTurn(null);
        }, PDF_PAGE_TURN_DURATION_MS);
      } catch {
        isPageTurningRef.current = false;
        setPage(target);
      }
    },
    [page, pageCount, pageTurnEnabled],
  );

  const togglePageTurn = useCallback(() => {
    const enabled = !pageTurnEnabled;
    const updated = { ...loadSettings(), pageTurn: enabled, updatedAt: Date.now() };
    saveSettings(updated);
    void saveSettingsRemote(uid, updated);
    setPageTurnEnabled(enabled);
  }, [pageTurnEnabled, uid]);

  const updateDisplaySettings = useCallback((patch: Partial<PdfDisplaySettings>) => {
    setDisplaySettings((current) => {
      const next = { ...current, ...patch };
      savePdfDisplaySettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(book.source);
    setUrl(objectUrl);
    void markAsReading(
      uid,
      { title: book.title, author: book.author, cover: book.cover ?? null },
      book.id,
    );
    void loadProgressRemote(book.id).then((progress) => {
      if (progress?.pageIndex !== undefined) setPage(Math.max(1, progress.pageIndex + 1));
    });
    return () => URL.revokeObjectURL(objectUrl);
  }, [book, uid]);

  useEffect(() => subscribeAnnotations(uid, book.id, setAnnotations), [book.id, uid]);

  useEffect(
    () => () => {
      if (pageTurnTimerRef.current) clearTimeout(pageTurnTimerRef.current);
      isPageTurningRef.current = false;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    async function open() {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        }
        const task = pdfjs.getDocument({
          data: new Uint8Array(await book.source.arrayBuffer()),
        });
        destroyPdfRef.current = () => task.destroy();
        const pdf = (await task.promise) as unknown as PdfDocument;
        if (cancelled) {
          await task.destroy();
          return;
        }
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        setPage((current) => Math.min(current, pdf.numPages));
        setPdfReady(true);
      } catch (cause) {
        console.error("[pdf-reader] failed to open", cause);
        if (!cancelled) setError("Não foi possível preparar as páginas deste PDF.");
      }
    }
    void open();
    return () => {
      cancelled = true;
      renderCancelRef.current?.();
      pdfRef.current = null;
      const destroy = destroyPdfRef.current;
      destroyPdfRef.current = null;
      if (destroy) void destroy();
    };
  }, [book.source]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => setSize({ width: stage.clientWidth, height: stage.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || size.width < 80 || size.height < 80) return;
    let cancelled = false;
    async function renderPage() {
      setLoading(true);
      renderCancelRef.current?.();
      const pdfPage = await pdf!.getPage(page);
      const initial = pdfPage.getViewport({ scale: 1 });
      const availableWidth = Math.max(80, size.width - displaySettings.pagePadding * 2);
      const availableHeight = Math.max(80, size.height - displaySettings.pagePadding * 2);
      const fitScale = Math.min(availableWidth / initial.width, availableHeight / initial.height);
      const cssScale = fitScale * displaySettings.zoom;
      const viewport = pdfPage.getViewport({ scale: cssScale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const context = canvas!.getContext("2d", { alpha: false });
      if (!context || cancelled) return;
      canvas!.width = Math.floor(viewport.width * outputScale);
      canvas!.height = Math.floor(viewport.height * outputScale);
      canvas!.style.width = `${Math.floor(viewport.width)}px`;
      canvas!.style.height = `${Math.floor(viewport.height)}px`;
      const task = pdfPage.render({
        canvasContext: context,
        canvas: canvas!,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      });
      renderCancelRef.current = () => task.cancel();
      try {
        await task.promise;
        if (!cancelled) setLoading(false);
      } catch (cause) {
        if ((cause as { name?: string })?.name !== "RenderingCancelledException") throw cause;
      }
    }
    void renderPage().catch((cause) => {
      console.error("[pdf-reader] page render failed", cause);
      if (!cancelled) setError("Não foi possível mostrar esta página.");
    });
    saveProgress(book.id, {
      chapterIndex: page - 1,
      chapterCount: pageCount,
      pageIndex: page - 1,
      pageCount,
      scrollRatio: 0,
      overallRatio: pageCount > 1 ? (page - 1) / (pageCount - 1) : 0,
      updatedAt: Date.now(),
    });
    return () => {
      cancelled = true;
      renderCancelRef.current?.();
    };
  }, [book.id, displaySettings.pagePadding, displaySettings.zoom, page, pageCount, pdfReady, size]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (event.key === "ArrowRight") goTo(page + 1);
      if (event.key === "ArrowLeft") goTo(page - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, page]);

  return (
    <div className="fixed inset-0 z-30 flex min-h-0 flex-col overflow-hidden bg-[#edf5ff] text-slate-950">
      <header className="z-20 flex shrink-0 items-center justify-between gap-2 border-b border-blue-100 bg-white/95 px-2 py-2 shadow-sm backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <Link
            to="/biblioteca"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:bg-blue-50"
            aria-label="Voltar à biblioteca"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-medium">{book.title}</p>
            <p className="truncate text-[11px] text-slate-500">PDF privado · modo página</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setMarking((value) => !value);
              setRegionDraft(null);
            }}
            aria-pressed={marking}
            aria-label={marking ? "Sair do modo marcação" : "Marcar trecho da página"}
            title={marking ? "Arraste sobre o trecho" : "Marcar trecho"}
            className={`grid h-9 w-9 place-items-center rounded-full border transition ${
              marking
                ? "border-amber-300 bg-amber-100 text-amber-800"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Highlighter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              openPageWithLumi(
                "translation",
                "Traduza para português do Brasil todo o texto legível desta página, preservando parágrafos, sentido e nomes próprios. Se já estiver em português, informe isso.",
              )
            }
            aria-label="Traduzir esta página com a Lumi"
            title="Traduzir página"
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
          >
            <Languages className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openPageWithLumi("question")}
            aria-label="Perguntar à Lumi sobre esta página"
            title="Perguntar à Lumi"
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Ajustes do PDF"
            title="Ajustes do PDF"
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={togglePageTurn}
            aria-pressed={pageTurnEnabled}
            aria-label={`${pageTurnEnabled ? "Desativar" : "Ativar"} efeito de folha`}
            title={`${pageTurnEnabled ? "Desativar" : "Ativar"} efeito de folha`}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition sm:px-3 ${
              pageTurnEnabled
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Efeito de folha</span>
          </button>
          <a
            href={url ?? undefined}
            download={book.sourceName}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-blue-200 px-2.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50 sm:px-3"
          >
            <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Baixar</span>
          </a>
        </div>
      </header>

      <main
        ref={stageRef}
        className="relative min-h-0 flex-1 touch-pan-y overflow-hidden bg-[radial-gradient(circle_at_50%_20%,#ffffff_0%,#edf5ff_70%)]"
        onTouchStart={(event) => {
          if (marking || settingsOpen) {
            touchStartRef.current = null;
            return;
          }
          const touch = event.touches[0];
          touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={(event) => {
          if (marking || settingsOpen) {
            touchStartRef.current = null;
            return;
          }
          const start = touchStartRef.current;
          touchStartRef.current = null;
          const touch = event.changedTouches[0];
          if (!start || !touch) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            goTo(page + (dx > 0 ? 1 : -1));
          }
        }}
      >
        <div
          className="absolute inset-0 overflow-auto"
          style={{ padding: `${displaySettings.pagePadding}px` }}
        >
          <div className="grid min-h-full min-w-full place-items-center">
            <div
              className="relative shrink-0 shadow-2xl ring-1 ring-slate-900/10"
              style={{
                filter: `brightness(${displaySettings.brightness}) contrast(${displaySettings.contrast})`,
              }}
            >
              <canvas ref={canvasRef} className="block bg-white" />
              <div
                className={`absolute inset-0 ${marking ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
                onPointerDown={(event) => {
                  if (!marking) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const point = normalizedPoint(event);
                  setRegionDraft({ startX: point.x, startY: point.y, ...point });
                }}
                onPointerMove={(event) => {
                  if (!marking || !regionDraft) return;
                  const point = normalizedPoint(event);
                  setRegionDraft((draft) => (draft ? { ...draft, ...point } : null));
                }}
                onPointerUp={(event) => {
                  if (!marking || !regionDraft) return;
                  const point = normalizedPoint(event);
                  const completed = { ...regionDraft, ...point };
                  setRegionDraft(null);
                  void saveRegion(completed);
                }}
              >
                {marking &&
                  pageRegions.map((region) => (
                    <div
                      key={region.id}
                      className="pointer-events-none absolute border-l-4 border-amber-500 bg-amber-300/35 mix-blend-multiply"
                      style={{
                        left: `${region.x * 100}%`,
                        top: `${region.y * 100}%`,
                        width: `${region.width * 100}%`,
                        height: `${region.height * 100}%`,
                      }}
                    />
                  ))}
                {regionDraft && (
                  <div
                    className="absolute border-l-4 border-amber-500 bg-amber-300/35"
                    style={{
                      left: `${Math.min(regionDraft.startX, regionDraft.x) * 100}%`,
                      top: `${Math.min(regionDraft.startY, regionDraft.y) * 100}%`,
                      width: `${Math.abs(regionDraft.x - regionDraft.startX) * 100}%`,
                      height: `${Math.abs(regionDraft.y - regionDraft.startY) * 100}%`,
                    }}
                  />
                )}
              </div>
              {!marking &&
                pageRegions.map((region) => (
                  <button
                    key={`remove-${region.id}`}
                    type="button"
                    aria-label="Remover esta marcação"
                    title="Toque para remover"
                    onClick={() => void removeRegion(region)}
                    className="absolute border-l-4 border-amber-500 bg-amber-300/35 mix-blend-multiply"
                    style={{
                      left: `${region.x * 100}%`,
                      top: `${region.y * 100}%`,
                      width: `${region.width * 100}%`,
                      height: `${region.height * 100}%`,
                    }}
                  />
                ))}
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          className={
            pageTurn
              ? `pdf-page-turn reader-page-turn--${pageTurn.direction}`
              : "pointer-events-none absolute hidden"
          }
        >
          <div
            className="pdf-page-turn__sheet"
            style={
              pageTurn
                ? {
                    width: pageTurn.width,
                    height: pageTurn.height,
                    filter: `brightness(${displaySettings.brightness}) contrast(${displaySettings.contrast})`,
                  }
                : undefined
            }
          >
            <canvas ref={pageTurnCanvasRef} className="block h-full w-full select-none bg-white" />
          </div>
        </div>
        {(loading || !pdfReady) && !error && (
          <div className="pointer-events-none absolute inset-0 z-[5] grid place-items-center bg-[#edf5ff]/70">
            <div className="rounded-full bg-white/95 px-4 py-2 text-xs text-slate-600 shadow-lg">
              <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" /> Preparando página…
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <FileImage className="mx-auto h-6 w-6 text-blue-600" />
              <p className="mt-3 font-medium">{error}</p>
              <p className="mt-1 text-xs text-slate-500">
                O arquivo original continua disponível para download.
              </p>
            </div>
          </div>
        )}
        {marking && !error && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex justify-center">
            <p className="rounded-full bg-slate-950/90 px-4 py-2 text-xs font-medium text-white shadow-lg">
              Arraste sobre o trecho que deseja marcar
            </p>
          </div>
        )}
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1 || marking || settingsOpen}
          aria-label="Página anterior"
          className="absolute inset-y-0 left-0 grid w-14 place-items-center text-slate-700 opacity-0 transition hover:bg-white/20 hover:opacity-100 disabled:pointer-events-none sm:w-24"
        >
          <ChevronLeft className="h-7 w-7 rounded-full bg-white/90 p-1 shadow" />
        </button>
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= pageCount || marking || settingsOpen}
          aria-label="Próxima página"
          className="absolute inset-y-0 right-0 grid w-14 place-items-center text-slate-700 opacity-0 transition hover:bg-white/20 hover:opacity-100 disabled:pointer-events-none sm:w-24"
        >
          <ChevronRight className="h-7 w-7 rounded-full bg-white/90 p-1 shadow" />
        </button>
      </main>

      <footer className="z-20 shrink-0 border-t border-blue-100 bg-white/95 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-3 text-[11px] text-slate-500">
          <span className="tabular-nums">{Math.round((page / pageCount) * 100)}%</span>
          <input
            aria-label="Ir para página"
            type="range"
            min={1}
            max={pageCount}
            value={page}
            onChange={(event) => goTo(Number(event.target.value))}
            className="h-1 flex-1 accent-blue-600"
          />
          <span className="shrink-0 tabular-nums">
            Pág. {page}/{pageCount}
          </span>
        </div>
      </footer>
      <PdfDisplaySettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={displaySettings}
        onChange={updateDisplaySettings}
        pageTurnEnabled={pageTurnEnabled}
        onTogglePageTurn={togglePageTurn}
      />
    </div>
  );
}
