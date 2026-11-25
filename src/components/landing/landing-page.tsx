/**
 * First visit on "/". Phones get the app-like welcome (mockup 01);
 * larger screens get the site landing (mockup 18). Both lead into the
 * same short setup at /bem-vindo — no account needed to start.
 */
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleCheck,
  FileUp,
  Flame,
  Headphones,
  Pause,
  Smartphone,
  Sparkles,
} from "lucide-react";

import { BookArt } from "@/components/book-art";
import { Logo } from "@/components/brand/logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { fauxBookFor } from "@/lib/faux-books";

const EASE = [0.16, 1, 0.3, 1] as const;

const STRIP = [
  "Dom Casmurro",
  "Alice no País das Maravilhas",
  "Frankenstein",
  "Iracema",
  "Orgulho e Preconceito",
  "O Grande Gatsby",
  "O Alienista",
  "O Cortiço",
  "Os Sertões",
  "Senhora",
  "Dom Quixote",
  "Contos Fluminenses",
  "A Metamorfose",
  "Memórias Póstumas de Brás Cubas",
];

export function LandingPage() {
  return (
    <div className="relative">
      <MobileWelcome />
      <DesktopHero />
      <CoverStrip />
      <Features />
      <Faq />
      <FinalCta />
    </div>
  );
}

/* ------------------------------- phone ------------------------------- */

const FAN = [
  { t: "Dom Casmurro", x: "4%", y: "14%", r: -12, w: "34%", d: 0 },
  { t: "Alice no País das Maravilhas", x: "36%", y: "2%", r: 8, w: "30%", d: 0.08 },
  { t: "Frankenstein", x: "66%", y: "11%", r: 6, w: "31%", d: 0.16 },
  { t: "Iracema", x: "-8%", y: "50%", r: 8, w: "28%", d: 0.12 },
  { t: "Orgulho e Preconceito", x: "26%", y: "46%", r: -4, w: "32%", d: 0.2 },
  { t: "O Alienista", x: "60%", y: "54%", r: 12, w: "30%", d: 0.28 },
];

function MobileWelcome() {
  const reduce = useReducedMotion();
  return (
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.875rem)] lg:hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[62%] bg-[radial-gradient(ellipse_at_50%_20%,#ffe1d3_0%,transparent_70%)] dark:opacity-30"
      />
      {/* Clock/battery stay legible over the tilted covers. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[calc(env(safe-area-inset-top)+1.25rem)] bg-gradient-to-b from-background via-background/80 to-transparent"
      />
      <div aria-hidden className="relative -mx-6 h-[46dvh] min-h-[300px]">
        {FAN.map((b) => {
          const f = fauxBookFor(b.t);
          return (
            <motion.div
              key={b.t}
              className="absolute"
              style={{ left: b.x, top: b.y, width: b.w }}
              initial={reduce ? false : { opacity: 0, y: 40, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: b.r }}
              transition={{ duration: 0.8, ease: EASE, delay: b.d }}
            >
              <motion.div
                animate={reduce ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 5 + b.d * 10, repeat: Infinity, ease: "easeInOut" }}
              >
                <BookArt title={f.title} author={f.author} lift />
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
        className="relative mt-auto"
      >
        <Logo size={30} />
        <h1 className="mt-5 font-display text-[46px] leading-[0.98] tracking-[-0.045em]">
          Todo livro,
          <br />a um toque.
        </h1>
        <p className="mt-3.5 text-[16px] leading-relaxed text-muted-foreground">
          Milhares de clássicos grátis, seus EPUBs e PDFs, leitura e áudio no mesmo lugar.
        </p>
        <Link
          to="/bem-vindo"
          className="press mt-6 flex h-[56px] items-center justify-center rounded-full bg-gold text-[16.5px] font-semibold text-white shadow-[0_14px_30px_-14px_#ff4d1a]"
        >
          Começar a ler — é grátis
        </Link>
        <Link
          to="/auth"
          search={{ redirect: undefined }}
          className="press mt-2.5 flex h-[56px] items-center justify-center rounded-full bg-card text-[16.5px] font-semibold shadow-[inset_0_0_0_1px_var(--border)]"
        >
          Já tenho conta
        </Link>
        <p className="mt-3.5 text-center text-[13px] text-faint">
          Não precisa de cadastro para começar.
        </p>
        <a
          href="#recursos"
          className="mx-auto mt-2 flex w-fit items-center gap-1 py-1 text-[12.5px] font-semibold text-muted-foreground"
        >
          Conheça o BookVerse <ChevronDown className="h-3.5 w-3.5" />
        </a>
      </motion.div>
    </section>
  );
}

/* ------------------------------ desktop ------------------------------ */

function DesktopHero() {
  const reduce = useReducedMotion();
  const rise = (d: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease: EASE, delay: d },
        };
  return (
    <section className="hidden lg:block">
      <header className="mx-auto flex max-w-7xl items-center gap-10 px-10 py-6">
        <Logo size={34} />
        <nav
          aria-label="Seções"
          className="flex items-center gap-7 text-[15px] text-muted-foreground"
        >
          <Link to="/descobrir" search={{}} className="transition hover:text-foreground">
            Explorar
          </Link>
          <a href="#recursos" className="transition hover:text-foreground">
            Como funciona
          </a>
          <a href="#faq" className="transition hover:text-foreground">
            Perguntas
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to="/auth"
            search={{ redirect: undefined }}
            className="rounded-full px-4 py-2.5 text-[15px] font-semibold"
          >
            Entrar
          </Link>
          <Link
            to="/bem-vindo"
            className="press rounded-full bg-foreground px-5 py-3 text-[15px] font-semibold text-background"
          >
            Começar a ler
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-[1.05fr_1fr] items-center gap-10 px-10 pb-16 pt-8">
        <div>
          <motion.span
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--border)]"
          >
            <i className="h-2 w-2 rounded-full bg-success" /> Mais de 70 mil livros grátis
          </motion.span>
          <motion.h1
            {...rise(0.05)}
            className="mt-6 font-display text-[clamp(4.2rem,7vw,6.4rem)] leading-[0.92] tracking-[-0.055em]"
          >
            Todo livro.
            <br />
            Um toque.
            <br />
            <span className="text-gold">Leia ou ouça.</span>
          </motion.h1>
          <motion.p
            {...rise(0.1)}
            className="mt-6 max-w-[34rem] text-[19px] leading-relaxed text-muted-foreground"
          >
            Clássicos grátis, seus próprios arquivos e um leitor feito para longas horas — no
            celular, no tablet e no computador.
          </motion.p>
          <motion.div {...rise(0.15)} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/bem-vindo"
              className="press inline-flex h-[60px] items-center gap-2.5 rounded-full bg-gold px-8 text-[17px] font-semibold text-white shadow-[0_18px_36px_-16px_#ff4d1a]"
            >
              Começar a ler — grátis <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="#recursos"
              className="press inline-flex h-[60px] items-center gap-2.5 rounded-full bg-card px-7 text-[17px] font-semibold shadow-[inset_0_0_0_1px_var(--border)]"
            >
              <BookOpen className="h-5 w-5" /> Ver como funciona
            </a>
          </motion.div>
          <motion.ul
            {...rise(0.2)}
            className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[14.5px] text-muted-foreground"
          >
            {["Sem cadastro para começar", "Sem anúncios", "Funciona offline"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CircleCheck className="h-[18px] w-[18px] text-success" /> {t}
              </li>
            ))}
          </motion.ul>
        </div>
        <PhoneScene />
      </div>
    </section>
  );
}

function PhoneScene() {
  const reduce = useReducedMotion();
  const dc = fauxBookFor("Dom Casmurro");
  return (
    <div aria-hidden className="relative h-[720px]">
      <div className="absolute inset-x-6 bottom-6 top-14 rounded-[44px] bg-[linear-gradient(140deg,#ffd9c9,#fff0bf_55%,#dbe8ff)] opacity-90 dark:opacity-30" />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
        className="absolute left-1/2 top-0 h-[700px] w-[340px] -translate-x-1/2 rounded-[52px] bg-[#111] p-[10px] shadow-[0_50px_90px_-40px_rgba(0,0,0,.6)]"
      >
        <div className="relative h-full overflow-hidden rounded-[43px] bg-[#f4f3ef] text-[#131313]">
          <div className="flex items-center justify-between px-7 pt-4 text-[13px] font-semibold">
            <span>9:41</span>
            <span className="h-[26px] w-[96px] rounded-full bg-[#111]" />
            <span className="w-8" />
          </div>
          <p className="mt-5 px-6 text-[11px] font-semibold text-[#8d8c86]">
            Terça, 24 de novembro
          </p>
          <p className="mt-1 px-6 text-[25px] font-bold tracking-[-0.03em]">Boa noite, Ana</p>
          <div className="mx-4 mt-3 rounded-[24px] p-3.5" style={{ background: dc.bg }}>
            <div className="flex items-center gap-3">
              <div className="w-[70px] shrink-0">
                <BookArt title={dc.title} author={dc.author} />
              </div>
              <div className="min-w-0 flex-1" style={{ color: dc.fg }}>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-80">
                  Continue lendo
                </p>
                <p className="mt-1 text-[19px] font-bold tracking-[-0.02em] text-white">
                  Dom Casmurro
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full w-[42%] rounded-full" style={{ background: dc.fg }} />
                  </div>
                  <span className="text-[10px] text-white/80">42%</span>
                </div>
              </div>
            </div>
            <div
              className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold"
              style={{ background: "#f4ecd8", color: dc.bg }}
            >
              <BookOpen className="h-3.5 w-3.5" /> Continuar · Cap. 32
            </div>
          </div>
          <div className="mt-4 flex gap-2.5 px-4">
            {[
              "Alice no País das Maravilhas",
              "O Grande Gatsby",
              "Orgulho e Preconceito",
              "Iracema",
            ].map((t) => {
              const b = fauxBookFor(t);
              return (
                <div key={t} className="w-[84px] shrink-0">
                  <BookArt title={b.title} author={b.author} />
                </div>
              );
            })}
          </div>
          <div className="absolute inset-x-3 bottom-4 flex justify-around rounded-[24px] bg-white py-2.5 text-[9px] font-semibold text-[#8d8c86] shadow-[0_6px_20px_-8px_rgba(0,0,0,.2)]">
            {["Início", "Explorar", "Biblioteca", "Você"].map((t, i) => (
              <span key={t} className={i === 0 ? "text-[#ff4d1a]" : ""}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
        className="absolute left-[2%] top-[44%] w-[255px] rounded-[22px] bg-card p-4 text-left shadow-[0_24px_50px_-24px_rgba(0,0,0,.35)]"
      >
        <p className="flex items-center gap-2.5 text-[14px] font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-lilac text-[#5b4be0]">
            <Sparkles className="h-4 w-4" />
          </span>
          Lumi explica
        </p>
        <p className="mt-2.5 text-[13px] leading-snug text-muted-foreground">
          “Ressaca” é o refluxo do mar que puxa tudo para dentro…
        </p>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.65 }}
        className="absolute right-[0%] top-[68%] flex items-center gap-3 rounded-[22px] py-3 pl-3 pr-6 text-white shadow-[0_24px_50px_-24px_rgba(0,0,0,.45)]"
        style={{ background: dc.bg }}
      >
        <span
          className="grid h-10 w-10 place-items-center rounded-full bg-[#f4ecd8]"
          style={{ color: dc.bg }}
        >
          <Pause className="h-4 w-4" fill="currentColor" />
        </span>
        <span>
          <span className="block text-[14px] font-bold">Ouvindo agora</span>
          <span className="block text-[12px] text-white/70">Cap. XXXII · 04:12</span>
        </span>
      </motion.div>
    </div>
  );
}

/* ------------------------------ shared ------------------------------- */

function CoverStrip() {
  const reduce = useReducedMotion();
  const row = [...STRIP, ...STRIP];
  return (
    <section
      aria-label="Alguns clássicos grátis"
      className="overflow-hidden border-y border-border bg-background py-7"
    >
      <motion.div
        className="flex w-max gap-5"
        animate={reduce ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      >
        {row.map((t, i) => {
          const b = fauxBookFor(t);
          return (
            <div key={i} className="w-[84px] shrink-0 lg:w-[96px]">
              <BookArt title={b.title} author={b.author} />
            </div>
          );
        })}
      </motion.div>
    </section>
  );
}

const FEATURES = [
  {
    icon: BookOpen,
    title: "Leitor que se ajusta a você",
    body: "Fonte, tamanho, tema e luz quente. Páginas ou rolagem, seis jeitos de virar a página. Funciona offline.",
    bg: "var(--card)",
    span: "lg:col-span-2",
    ring: true,
  },
  {
    icon: Headphones,
    title: "Ouça qualquer livro",
    body: "Uma voz lê com você e o texto acompanha, frase a frase.",
    bg: "var(--sky)",
  },
  {
    icon: Sparkles,
    title: "Lumi explica",
    body: "Dúvidas sobre uma palavra ou trecho? Pergunte sem sair da página.",
    bg: "var(--lilac)",
  },
  {
    icon: Flame,
    title: "Hábito sem esforço",
    body: "Metas diárias, sequência e lembretes no seu horário.",
    bg: "var(--accent-soft)",
  },
  {
    icon: FileUp,
    title: "Seus EPUBs e PDFs",
    body: "Importe EPUB, PDF, MOBI e mais. PDFs ganham modo leitura.",
    bg: "var(--mint)",
  },
  {
    icon: Smartphone,
    title: "Em todo lugar",
    body: "Celular, tablet e computador. Sempre na página certa.",
    bg: "var(--butter)",
    span: "lg:col-span-2",
  },
];

function Features() {
  return (
    <section id="recursos" className="mx-auto max-w-7xl scroll-mt-6 px-5 py-16 lg:px-10 lg:py-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="max-w-4xl font-display text-[38px] leading-[1.02] tracking-[-0.04em] lg:text-[60px]">
          Tudo o que um leitor precisa. Nada que atrapalhe.
        </h2>
        <p className="max-w-sm text-[16px] leading-relaxed text-muted-foreground lg:text-[17px]">
          Pensado com leitores de verdade: do primeiro livro ao centésimo.
        </p>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0.6, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: EASE, delay: (i % 3) * 0.06 }}
              className={`flex min-h-[200px] flex-col rounded-[30px] p-6 text-[#131313] lg:min-h-[230px] lg:p-7 ${f.span ?? ""} ${
                f.ring ? "text-foreground shadow-[inset_0_0_0_1px_var(--border)]" : ""
              }`}
              style={{ background: f.bg }}
            >
              <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/80 shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)]">
                <Icon className="h-5 w-5 text-[#131313]" strokeWidth={2} />
              </span>
              <p className="mt-auto pt-8 text-[24px] font-bold tracking-[-0.03em]">{f.title}</p>
              <p
                className={`mt-1.5 text-[15px] leading-relaxed ${f.ring ? "text-muted-foreground" : "text-[#4a4944]"}`}
              >
                {f.body}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "O BookVerse é gratuito?",
    a: "Sim. Ler os clássicos de domínio público, importar seus arquivos e usar metas, diário e desafios não custa nada e não tem anúncios.",
  },
  {
    q: "Preciso criar conta?",
    a: "Não para começar: você lê, baixa e importa livros sem cadastro, e eles ficam no seu aparelho. Com uma conta grátis, sua estante e seu progresso vão com você para qualquer aparelho.",
  },
  {
    q: "Quais livros posso ler?",
    a: "Dezenas de milhares de obras de domínio público — de Machado de Assis a Jane Austen — vindas do Project Gutenberg, Wikisource, Standard Ebooks e Internet Archive. Você também pode importar EPUB, PDF, MOBI, AZW3, FB2, CBZ e TXT sem DRM.",
  },
  {
    q: "Funciona no celular e sem internet?",
    a: "Funciona em qualquer navegador e pode ser instalado como aplicativo. Os livros que você baixa ou importa abrem offline.",
  },
  {
    q: "Meus arquivos ficam seguros?",
    a: "Os arquivos que você importa ficam no seu aparelho e, se você tiver conta, numa cópia privada vinculada só a ela.",
  },
  {
    q: "O que a Lumi faz com o meu livro?",
    a: "A Lumi só recebe o trecho que você seleciona ou o contexto do capítulo atual quando você pede ajuda, nunca o livro inteiro.",
  },
];

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-6 px-5 pb-16 lg:pb-24">
      <h2 className="font-display text-[34px] tracking-[-0.04em] lg:text-[46px]">
        Perguntas frequentes
      </h2>
      <Accordion type="single" collapsible className="mt-6">
        {FAQ.map((item, i) => (
          <AccordionItem key={item.q} value={`q${i}`} className="border-border">
            <AccordionTrigger className="py-5 text-left text-[17px] font-semibold hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-[15.5px] leading-relaxed text-muted-foreground">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-16 lg:px-10 lg:pb-24">
      <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-6 overflow-hidden rounded-[36px] bg-[#141414] px-7 py-10 text-white lg:flex-row lg:items-center lg:justify-between lg:px-14 lg:py-14">
        <div>
          <p className="font-display text-[34px] leading-[1.02] tracking-[-0.04em] lg:text-[50px]">
            Seu próximo livro
            <br />
            está a um toque.
          </p>
          <p className="mt-3 text-[16px] text-white/70">Sem cadastro, sem anúncios, de graça.</p>
        </div>
        <Link
          to="/bem-vindo"
          className="press inline-flex h-[58px] items-center gap-2.5 rounded-full bg-gold px-7 text-[17px] font-semibold text-white"
        >
          Começar a ler <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}
