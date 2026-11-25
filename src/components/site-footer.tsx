import { Link } from "@tanstack/react-router";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { DISCOVER_SEARCH } from "@/lib/nav";
import { LogoMark, Wordmark } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-card/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-12 md:px-8">
        <div className="md:col-span-5">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <LogoMark size={34} />
            <Wordmark className="text-xl" />
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Leia mais, leia melhor. Clássicos gratuitos, seus EPUBs e PDFs e um leitor feito para
            longas horas de leitura — com a Lumi sempre por perto.
          </p>
        </div>
        <FooterCol title="Ler">
          <li>
            <Link
              to="/descobrir"
              search={DISCOVER_SEARCH}
              className="inline-block py-1.5 hover:text-gold"
            >
              Descobrir
            </Link>
          </li>
          <li>
            <Link to="/biblioteca" className="inline-block py-1.5 hover:text-gold">
              Minha biblioteca
            </Link>
          </li>
          <li>
            <Link to="/diario" className="inline-block py-1.5 hover:text-gold">
              Diário
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => openLumiPanel()}
              className="inline-block py-1.5 hover:text-gold"
            >
              Fale com a Lumi
            </button>
          </li>
        </FooterCol>
        <FooterCol title="Comunidade">
          <li>
            <Link to="/metas" className="inline-block py-1.5 hover:text-gold">
              Metas
            </Link>
          </li>
          <li>
            <Link to="/desafios" className="inline-block py-1.5 hover:text-gold">
              Desafios
            </Link>
          </li>
          <li>
            <Link to="/ranking" className="inline-block py-1.5 hover:text-gold">
              Ranking
            </Link>
          </li>
        </FooterCol>
        <FooterCol title="BookVerse">
          <li>
            <Link to="/sobre" className="inline-block py-1.5 hover:text-gold">
              Sobre
            </Link>
          </li>
          <li>
            <Link to="/privacidade" className="inline-block py-1.5 hover:text-gold">
              Privacidade
            </Link>
          </li>
          <li>
            <Link to="/termos" className="inline-block py-1.5 hover:text-gold">
              Termos
            </Link>
          </li>
          <li>
            <Link to="/contato" className="inline-block py-1.5 hover:text-gold">
              Contato
            </Link>
          </li>
        </FooterCol>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-6 text-xs text-muted-foreground md:px-8">
          <p>© {new Date().getFullYear()} BookVerse. Feito para quem ama ler.</p>
          <p>Obras clássicas via Project Gutenberg · domínio público</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="md:col-span-2 lg:col-span-2">
      <h4 className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
        {title}
      </h4>
      <ul className="mt-3 space-y-0.5 text-sm text-muted-foreground">{children}</ul>
    </div>
  );
}
