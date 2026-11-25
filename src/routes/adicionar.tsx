import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ExternalLink,
  FileUp,
  HardDrive,
  Link2,
  Loader2,
  Mail,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SOURCE_BADGE, SourceBadge } from "@/components/catalog/source-badge";
import { ImportCard } from "@/components/import/import-card";
import { useAuthUser } from "@/hooks/use-auth-user";
import { SOURCE_LABEL, type CatalogSource } from "@/lib/catalog";
import { IMPORT_ACCEPT } from "@/lib/importers";
import { enqueueFiles, importFromLink, useImportQueue } from "@/lib/import-queue";
import { takeSharedFiles } from "@/lib/share-target";

export const Route = createFileRoute("/adicionar")({
  validateSearch: (search: Record<string, unknown>): { compartilhado?: string; link?: string } => ({
    compartilhado: typeof search.compartilhado === "string" ? search.compartilhado : undefined,
    link: typeof search.link === "string" ? search.link.slice(0, 2000) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Adicionar livros — BookVerse" },
      {
        name: "description",
        content:
          "Importe EPUB, PDF, MOBI, AZW3, FB2, CBZ e TXT, cole um link ou baixe clássicos grátis.",
      },
    ],
  }),
  component: AdicionarPage,
});

type Panel = "link" | "nuvem" | "compartilhar" | "email" | null;

function AdicionarPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const user = useAuthUser();
  const member = !!user && !user.isAnonymous;
  const queue = useImportQueue();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const [panel, setPanel] = useState<Panel>(search.link ? "link" : null);
  const [link, setLink] = useState(() => search.link?.match(/https:\/\/\S+/)?.[0] ?? "");
  const [fetching, setFetching] = useState(false);

  // Files shared from another app arrive through the service worker.
  useEffect(() => {
    if (!search.compartilhado) return;
    void takeSharedFiles().then((files) => {
      if (files.length) {
        enqueueFiles(files);
        toast.success(
          files.length === 1
            ? "Importando o arquivo compartilhado"
            : `Importando ${files.length} arquivos`,
        );
      }
      void navigate({ to: "/adicionar", search: {}, replace: true });
    });
  }, [search.compartilhado, navigate]);

  function pick(files: FileList | null | undefined) {
    if (!files?.length) return;
    enqueueFiles(Array.from(files));
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!link.trim() || fetching) return;
    setFetching(true);
    try {
      await importFromLink(link);
      setLink("");
      setPanel(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível baixar este link.");
    } finally {
      setFetching(false);
    }
  }

  function close() {
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/biblioteca" });
  }

  const rows: { id: Exclude<Panel, null>; icon: typeof Link2; label: string; soon?: boolean }[] = [
    { id: "link", icon: Link2, label: "Colar link de EPUB ou PDF" },
    { id: "nuvem", icon: HardDrive, label: "Google Drive · Dropbox · OneDrive" },
    { id: "compartilhar", icon: Share2, label: "Compartilhar de outro app" },
    { id: "email", icon: Mail, label: "Enviar por e-mail para a sua estante", soon: true },
  ];

  return (
    <div className="mx-auto max-w-xl pb-12 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:pt-10">
      <header className="flex items-center justify-between px-4">
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="press grid h-[42px] w-[42px] place-items-center rounded-full"
        >
          <X className="h-[22px] w-[22px]" strokeWidth={2} />
        </button>
        <h1 className="font-sans text-base font-bold tracking-normal">Adicionar livros</h1>
        <span className="w-[42px]" />
      </header>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IMPORT_ACCEPT}
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      <motion.button
        type="button"
        initial={{ opacity: 0.55, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
        className={`press mx-4 mt-3 block w-[calc(100%-2rem)] rounded-[26px] border-2 border-dashed bg-accent-soft p-5 text-center transition ${
          over ? "scale-[1.01] border-gold" : "border-gold/55"
        }`}
      >
        <span className="inline-grid h-[52px] w-[52px] place-items-center rounded-[16px] bg-gold text-white">
          <FileUp className="h-6 w-6" strokeWidth={2} />
        </span>
        <span className="mt-2.5 block text-[17px] font-bold">
          {over ? "Solte para importar" : "Escolher arquivos"}
        </span>
        <span className="mt-1 block text-[13px] text-muted-foreground">
          EPUB · PDF · MOBI · AZW3 · FB2 · CBZ · TXT
        </span>
        <span className="mt-1.5 block text-[11.5px] text-faint">vários de uma vez · sem DRM</span>
      </motion.button>

      <AnimatePresence initial={false}>
        {queue.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-[22px] mb-2 mt-4 flex items-baseline justify-between">
              <p className="eyebrow">Importando agora</p>
              <Link to="/downloads" className="text-[12.5px] font-semibold text-gold">
                Downloads
              </Link>
            </div>
            <ul className="flex flex-col gap-2 px-4">
              <AnimatePresence initial={false}>
                {queue.slice(0, 6).map((item) => (
                  <ImportCard key={item.id} item={item} />
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="surface-card mx-4 mt-2.5 rounded-[1.6rem] px-3.5 py-1">
        {rows.map((r, k) => {
          const Icon = r.icon;
          const open = panel === r.id;
          return (
            <div key={r.id} className={k < rows.length - 1 ? "border-b border-border" : ""}>
              <button
                type="button"
                onClick={() => setPanel(open ? null : r.id)}
                aria-expanded={open}
                className="flex h-12 w-full items-center gap-3 text-left"
              >
                <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={2} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{r.label}</span>
                {r.soon && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">
                    em breve
                  </span>
                )}
                <ChevronRight
                  className={`h-[17px] w-[17px] shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`}
                  strokeWidth={2}
                />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-3.5 pl-[31px] text-[13px] leading-relaxed text-muted-foreground">
                      {r.id === "link" && (
                        <form onSubmit={submitLink} className="flex flex-col gap-2">
                          <input
                            type="url"
                            inputMode="url"
                            autoFocus
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="https://…/livro.epub"
                            className="h-11 w-full rounded-[14px] bg-surface-2 px-3.5 text-[14px] text-foreground outline-none placeholder:text-faint focus:ring-2 focus:ring-gold/40"
                          />
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12px] text-faint">
                              Links públicos do Drive e do Dropbox também funcionam.
                            </span>
                            <button
                              type="submit"
                              disabled={!link.trim() || fetching}
                              className="press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 text-[13px] font-semibold text-background disabled:opacity-40"
                            >
                              {fetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              {fetching ? "Baixando" : "Importar"}
                            </button>
                          </div>
                        </form>
                      )}
                      {r.id === "nuvem" && (
                        <>
                          <p>
                            No celular, toque em{" "}
                            <b className="text-foreground">Escolher arquivos</b> e abra o Drive, o
                            Dropbox ou o OneDrive na lista de locais. No computador, use a pasta
                            sincronizada — ou cole o link de compartilhamento acima.
                          </p>
                          <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="press mt-2.5 inline-flex h-9 items-center rounded-full bg-foreground px-4 text-[13px] font-semibold text-background"
                          >
                            Abrir arquivos
                          </button>
                        </>
                      )}
                      {r.id === "compartilhar" && (
                        <p>
                          Instale o BookVerse na tela inicial (menu do navegador →{" "}
                          <b className="text-foreground">Adicionar à tela inicial</b>). Depois, em
                          qualquer app, toque em <b className="text-foreground">Compartilhar</b> num
                          EPUB ou PDF e escolha o BookVerse — o livro chega aqui sozinho.
                        </p>
                      )}
                      {r.id === "email" && (
                        <p>
                          Em breve você terá um endereço só seu: mande o arquivo por e-mail e ele
                          aparece na estante. Por enquanto, use os outros caminhos acima.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {!member && (
        <p className="mx-[22px] mt-3 text-[12.5px] leading-relaxed text-faint">
          Os livros ficam neste aparelho.{" "}
          <Link to="/auth" search={{ redirect: "/adicionar" }} className="font-semibold text-gold">
            Entre
          </Link>{" "}
          para guardar uma cópia privada e ler em qualquer lugar.
        </p>
      )}

      <div className="mx-[22px] mb-2.5 mt-[18px] flex items-baseline justify-between">
        <h2 className="text-[18px]">Catálogos grátis</h2>
        <span className="text-[12.5px] font-semibold text-muted-foreground">Download direto</span>
      </div>
      <div className="flex flex-col gap-2 px-4">
        <CatalogRow source="gutenberg" />
        <CatalogRow source="standard" />
        <a
          href="http://www.dominiopublico.gov.br/pesquisa/PesquisaObraForm.jsp"
          target="_blank"
          rel="noreferrer"
          className="surface-card press flex items-center gap-3 rounded-[18px] px-3 py-2.5"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#1351b4] font-display text-[15px] text-white">
            DP
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold">Domínio Público</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Acervo do governo · PDF</p>
          </div>
          <ExternalLink className="h-4 w-4 text-faint" />
        </a>
        <CatalogRow source="wikisource" />
        <CatalogRow source="archive" />
      </div>
    </div>
  );
}

function CatalogRow({ source }: { source: CatalogSource }) {
  return (
    <Link
      to="/descobrir"
      search={{ fonte: source }}
      className="surface-card press flex items-center gap-3 rounded-[18px] px-3 py-2.5"
    >
      <SourceBadge source={source} />
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold">{SOURCE_LABEL[source]}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{SOURCE_BADGE[source].hint}</p>
      </div>
      <ChevronRight className="h-[17px] w-[17px] text-faint" strokeWidth={2} />
    </Link>
  );
}
