import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { openLumiPanel } from "@/lib/lumi-panel-store";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4 md:px-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/10 ring-1 ring-gold/40">
              <BookOpen className="h-4 w-4 text-gold" />
            </span>
            <span className="font-display text-xl font-semibold">
              Book<span className="text-gold">verse</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Uma experiência editorial de leitura — biblioteca, leitor imersivo e recomendações
            inteligentes em um só lugar.
          </p>
        </div>
        <div>
          <h4 className="font-display text-sm font-medium text-foreground">Explorar</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/descobrir" search={{ q: undefined, categoria: undefined }} className="hover:text-gold">
                Descobrir
              </Link>
            </li>
            <li>
              <Link to="/ranking" className="hover:text-gold">
                Ranking
              </Link>
            </li>
            <li>
              <Link to="/desafios" className="hover:text-gold">
                Desafios
              </Link>
            </li>
            <li>
              <button onClick={() => openLumiPanel()} className="hover:text-gold">
                Fale com a Lumi
              </button>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm font-medium text-foreground">BookVerse</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/sobre" className="hover:text-gold">
                Sobre
              </Link>
            </li>
            <li>
              <Link to="/privacidade" className="hover:text-gold">
                Privacidade
              </Link>
            </li>
            <li>
              <Link to="/termos" className="hover:text-gold">
                Termos
              </Link>
            </li>
            <li>
              <Link to="/contato" className="hover:text-gold">
                Contato
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <p className="mx-auto max-w-7xl px-5 py-6 text-xs text-muted-foreground md:px-8">
          © {new Date().getFullYear()} BookVerse. Feito para quem ama ler.
        </p>
      </div>
    </footer>
  );
}
