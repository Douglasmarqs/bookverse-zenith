import { Link } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  CloudOff,
  FileText,
  Highlighter,
  Languages,
  MessageCircleQuestion,
  RefreshCw,
  Search,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { AmbiencePicker } from "@/components/ambience-picker";
import { FauxCover } from "@/components/faux-cover";
import { LumiMascot } from "@/components/lumi-mascot";
import { Magnetic, Tilt } from "@/components/motion/interactive";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAUX_BOOKS } from "@/lib/faux-books";
import { DISCOVER_SEARCH } from "@/lib/nav";

/* -------------------------------------------------------------------------- */
/*  Shared motion helpers                                                     */
/* -------------------------------------------------------------------------- */

const EASE = [0.16, 1, 0.3, 1] as const;

function Rise({
  children,
  delay = 0,
  className = "",
  y = 26,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p id={id} className="eyebrow scroll-mt-28">
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function LandingPage() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  return (
    <div className="overflow-x-clip">
      <motion.div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gold"
        style={{ scaleX: progress }}
      />
      <Hero />
      <Acervo />
      <ReaderShowcase />
      <LumiShowcase />
      <Ritual />
      <Ambiences />
      <HowItWorks />
      <Faq />
      <FinalCta />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — an interactive shelf under a reading lamp                          */
/* -------------------------------------------------------------------------- */

const SHELF = [
  {
    title: "Dom Casmurro",
    author: "Machado de Assis",
    year: 1899,
    bg: "#3c5a4a",
    h: 0.86,
    w: 46,
    line: "Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu.",
  },
  {
    title: "Iracema",
    author: "José de Alencar",
    year: 1865,
    bg: "#7a2e2a",
    h: 0.7,
    w: 36,
    line: "Verdes mares bravios de minha terra natal, onde canta a jandaia nas frondes da carnaúba;",
  },
  {
    title: "Memórias Póstumas",
    author: "Machado de Assis",
    year: 1881,
    bg: "#22344a",
    fg: "#f0c77a",
    h: 0.96,
    w: 54,
    line: "Ao verme que primeiro roeu as frias carnes do meu cadáver dedico como saudosa lembrança estas memórias póstumas.",
  },
  {
    title: "O Alienista",
    author: "Machado de Assis",
    year: 1882,
    bg: "#c49a52",
    fg: "#2a1f14",
    h: 0.78,
    w: 40,
    line: "As crônicas da vila de Itaguaí dizem que em tempos remotos vivera ali um certo médico, o Dr. Simão Bacamarte, filho da nobreza da terra e o maior dos médicos do Brasil, de Portugal e das Espanhas.",
  },
  {
    title: "A Cartomante",
    author: "Machado de Assis",
    year: 1884,
    bg: "#4b3a5c",
    h: 0.64,
    w: 34,
    line: "Hamlet observa a Horácio que há mais cousas no céu e na terra do que sonha a nossa filosofia.",
  },
  {
    title: "O Cortiço",
    author: "Aluísio Azevedo",
    year: 1890,
    bg: "#2b2a26",
    fg: "#d9a54e",
    h: 0.9,
    w: 48,
    line: "João Romão foi, dos treze aos vinte e cinco anos, empregado de um vendeiro que enriqueceu entre as quatro paredes de uma suja e obscura taverna nos refolhos do bairro do Botafogo;",
  },
  {
    title: "Quincas Borba",
    author: "Machado de Assis",
    year: 1891,
    bg: "#5b6b3a",
    h: 0.74,
    w: 40,
    line: "Rubião fitava a enseada, — eram oito horas da manhã.",
  },
  {
    title: "Policarpo Quaresma",
    author: "Lima Barreto",
    year: 1915,
    bg: "#8a3d24",
    h: 0.84,
    w: 50,
    line: "Como de hábito, Policarpo Quaresma, mais conhecido por Major Quaresma, bateu em casa às quatro e quinze da tarde.",
  },
] as const;

function Hero() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const shelfY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const glowY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const book = SHELF[open];

  return (
    <section ref={ref} className="relative">
      <motion.div
        aria-hidden
        style={reduce ? undefined : { y: glowY }}
        className="lamp-glow lamp-breathe absolute -right-40 -top-72 h-[56rem] w-[56rem]"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-52 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,var(--ambient-2),transparent_65%)]"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-8 md:px-8 md:pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:pb-28">
        <div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_10px_var(--success)]" />
            Clássicos gratuitos, seus EPUBs e PDFs, uma IA nas margens
          </motion.div>

          <h1 className="mt-7 font-display text-[3.4rem] leading-[0.9] tracking-[-0.02em] sm:text-7xl lg:text-[6.2rem]">
            {["Leia como", "quem acende"].map((line, i) => (
              <motion.span
                key={line}
                className="block"
                initial={reduce ? false : { opacity: 0, y: 40, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1, ease: EASE, delay: 0.08 + i * 0.1 }}
              >
                {line}
              </motion.span>
            ))}
            <motion.span
              className="block italic text-gold"
              initial={reduce ? false : { opacity: 0, y: 40, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1, ease: EASE, delay: 0.28 }}
            >
              uma lâmpada
            </motion.span>
            <motion.span
              className="block"
              initial={reduce ? false : { opacity: 0, y: 40, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1, ease: EASE, delay: 0.38 }}
            >
              à noite.
            </motion.span>
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}
            className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Setenta mil clássicos, os seus próprios livros e uma coruja que lê com você, nas
            margens. Um leitor feito para longas horas, do jeito que o papel sempre foi, no celular
            ou no computador.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.6 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Magnetic>
              <Link
                to="/auth"
                search={{ redirect: "/" }}
                className="btn-primary btn-sheen w-full px-7 py-4 text-base sm:w-auto"
              >
                Começar a ler grátis <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnetic>
            <Link to="/" hash="leitor" className="btn-ghost w-full px-7 py-4 text-base sm:w-auto">
              Ver o leitor por dentro
            </Link>
          </motion.div>

          <motion.ul
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            {["Gratuito", "Sem anúncios", "Funciona offline", "7 ambientes"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-gold" />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* The shelf */}
        <motion.div
          style={reduce ? undefined : { y: shelfY }}
          className="relative mx-auto h-[30rem] w-full max-w-[36rem] sm:h-[34rem]"
        >
          <Lamp />
          <div
            role="listbox"
            aria-label="Puxe um livro da estante"
            className="absolute inset-x-2 bottom-[4.4rem] flex h-[19rem] items-end justify-center gap-[5px] sm:h-[22rem]"
          >
            {SHELF.map((b, i) => {
              const selected = i === open;
              return (
                <motion.button
                  key={b.title}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={`${b.title}, de ${b.author}`}
                  onClick={() => setOpen(i)}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(i)}
                  initial={reduce ? false : { opacity: 0, y: 60, rotate: 180 }}
                  animate={{
                    opacity: 1,
                    y: selected ? -26 : 0,
                    // .spine draws its title rotated 180°; motion owns the
                    // transform, so the base rotation is included here.
                    rotate: selected ? 177.5 : 180,
                  }}
                  whileHover={reduce ? undefined : { y: selected ? -26 : -12 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: reduce ? 0 : 0.35 + i * 0.05,
                  }}
                  className="spine shrink-0 cursor-pointer text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-base"
                  style={
                    {
                      "--s-bg": b.bg,
                      "--s-fg": "fg" in b ? b.fg : undefined,
                      width: `clamp(26px, ${b.w / 6.2}vw, ${b.w}px)`,
                      height: `${b.h * 100}%`,
                      boxShadow: selected
                        ? "0 0 0 1px var(--gold), 0 18px 40px -12px color-mix(in oklab, var(--gold) 60%, transparent)"
                        : undefined,
                    } as React.CSSProperties
                  }
                >
                  {b.title}
                  <span className="h-px w-3/4 bg-[color-mix(in_oklab,var(--gold)_70%,transparent)]" />
                </motion.button>
              );
            })}
          </div>
          <div className="shelfboard absolute inset-x-0 bottom-[3.6rem]" />

          {/* the opened page */}
          <AnimatePresence mode="wait">
            <motion.figure
              key={book.title}
              initial={reduce ? false : { opacity: 0, y: 18, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: 3 }}
              exit={{ opacity: 0, y: -10, rotate: 6 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="absolute -bottom-2 right-0 w-[min(17rem,78%)] rounded-[4px] bg-paper p-5 text-paper-ink shadow-[0_40px_70px_-25px_rgb(0_0_0/0.8)] sm:right-[-0.5rem]"
            >
              <div className="flex justify-between text-[9px] uppercase tracking-[0.22em] text-[#8b7b60]">
                <span>{book.author}</span>
                <span>{book.year}</span>
              </div>
              <p className="mt-2 font-display text-xl leading-tight">{book.title}</p>
              <blockquote className="mt-2 line-clamp-5 font-[family-name:var(--font-book)] text-[13px] leading-relaxed">
                “{book.line}”
              </blockquote>
              <figcaption className="mt-3 flex items-center gap-2 border-t border-dashed border-[#cdbf9f] pt-2.5 text-[10.5px] text-[#6b5a3f]">
                <LumiMascot size={22} className="!animate-none" />
                Passe o cursor ou toque nas lombadas
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

function Lamp() {
  return (
    <svg
      viewBox="0 0 200 260"
      aria-hidden
      className="absolute right-[18%] top-0 w-28 sm:w-36"
      style={{ filter: "drop-shadow(0 20px 30px rgb(0 0 0 / 0.5))" }}
    >
      <defs>
        <linearGradient id="lampShade" x1="0" x2="1">
          <stop style={{ stopColor: "var(--oxide)" }} />
          <stop offset=".5" style={{ stopColor: "var(--gold)" }} />
          <stop offset="1" style={{ stopColor: "var(--oxide)" }} />
        </linearGradient>
        <radialGradient id="lampBulb">
          <stop stopColor="#fff3cf" />
          <stop offset="1" stopColor="#f3cd84" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M150 250 L150 120 Q150 60 100 60"
        strokeWidth="5"
        fill="none"
        style={{ stroke: "var(--oxide)" }}
      />
      <path d="M40 60 Q100 8 160 60 Z" fill="url(#lampShade)" />
      <ellipse cx="100" cy="64" rx="44" ry="11" fill="url(#lampBulb)" className="lamp-breathe" />
      <ellipse cx="150" cy="252" rx="34" ry="6" style={{ fill: "var(--shelf)" }} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Acervo strip                                                               */
/* -------------------------------------------------------------------------- */

function Acervo() {
  const covers = [...FAUX_BOOKS, ...FAUX_BOOKS];
  return (
    <section
      aria-label="Alguns clássicos do acervo"
      className="relative border-y border-border py-10"
    >
      <div className="mx-auto mb-6 flex max-w-7xl flex-wrap items-baseline justify-between gap-3 px-5 md:px-8">
        <p className="font-display text-2xl md:text-3xl">
          Do Machado à Austen, <span className="italic text-gold">setenta mil clássicos</span>{" "}
          prontos para abrir.
        </p>
        <Link
          to="/descobrir"
          search={DISCOVER_SEARCH}
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-gold"
        >
          Explorar o acervo
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <div className="marquee-mask overflow-hidden">
        <div
          className="marquee-track gap-5 py-4 pr-5"
          style={{ ["--marquee-duration" as string]: "70s" }}
        >
          {covers.map((b, i) => (
            <Tilt key={i} max={12} className="w-24 shrink-0 rounded-[6px] sm:w-28">
              <FauxCover book={b} />
            </Tilt>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reader showcase with marginalia                                            */
/* -------------------------------------------------------------------------- */

const PAGE_THEMES = [
  {
    id: "papel",
    label: "Papel",
    bg: "#f3ead8",
    fg: "#2a241b",
    muted: "#8b7b60",
    mark: "rgba(217,165,78,.42)",
  },
  {
    id: "sepia",
    label: "Sépia",
    bg: "#e8d6b1",
    fg: "#3a2818",
    muted: "#7a6347",
    mark: "rgba(160,100,30,.3)",
  },
  {
    id: "noite",
    label: "Noite",
    bg: "#1a1712",
    fg: "#e8dfd3",
    muted: "#9b8f7c",
    mark: "rgba(217,165,78,.35)",
  },
  {
    id: "amoled",
    label: "AMOLED",
    bg: "#000000",
    fg: "#efeae0",
    muted: "#8a8478",
    mark: "rgba(217,165,78,.35)",
  },
] as const;

const PAGE_FONTS = [
  { id: "newsreader", label: "Newsreader", family: "var(--font-book)" },
  { id: "serif", label: "Instrument", family: "var(--font-display)" },
  { id: "sans", label: "Sem serifa", family: "var(--font-sans)" },
] as const;

const MARGIN_NOTES = [
  {
    title: "Destaques em quatro cores",
    text: "Com notas, busca e exportação de tudo que você marcou.",
    icon: Highlighter,
  },
  {
    title: "A Lumi nas margens",
    text: "Selecione um trecho: ela explica, resume, traduz e cria flashcards.",
    icon: Sparkles,
  },
  {
    title: "Virada de página real",
    text: "Folha com sombra, ou rolagem contínua. Gestos e teclado.",
    icon: Bookmark,
  },
  {
    title: "Busca dentro do livro",
    text: "Encontre qualquer palavra e pule direto para ela.",
    icon: Search,
  },
];

function ReaderShowcase() {
  const [theme, setTheme] = useState<(typeof PAGE_THEMES)[number]["id"]>("papel");
  const [font, setFont] = useState<(typeof PAGE_FONTS)[number]["id"]>("newsreader");
  const [size, setSize] = useState(17);
  const t = PAGE_THEMES.find((x) => x.id === theme)!;
  const f = PAGE_FONTS.find((x) => x.id === font)!;

  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div
        aria-hidden
        className="lamp-glow absolute left-1/2 top-0 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2"
      />
      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <Rise className="mx-auto max-w-2xl text-center">
          <Eyebrow id="leitor">O leitor</Eyebrow>
          <h2 className="mt-3 font-display text-5xl leading-[0.95] md:text-7xl">
            Uma página que <span className="italic text-gold">respeita</span> você.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-muted-foreground">
            Teste aqui mesmo. É exatamente o leitor que você usa dentro do app.
          </p>
        </Rise>

        <div className="mt-14 grid items-start gap-10 lg:grid-cols-[1fr_minmax(0,34rem)_1fr]">
          <div className="hidden flex-col gap-16 pt-16 text-right lg:flex">
            {MARGIN_NOTES.slice(0, 2).map((n, i) => (
              <Rise key={n.title} delay={0.1 * i}>
                <p className="font-display text-2xl italic text-gold-soft">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.text}</p>
              </Rise>
            ))}
          </div>

          <Rise y={40}>
            <Tilt max={3} glare={false} className="rounded-md">
              <motion.article
                animate={{ backgroundColor: t.bg, color: t.fg }}
                transition={{ duration: 0.5 }}
                className="rounded-md px-7 py-9 shadow-[0_60px_100px_-40px_rgb(0_0_0/0.9)] sm:px-12 sm:py-12"
              >
                <div
                  className="flex justify-between text-[10px] uppercase tracking-[0.22em]"
                  style={{ color: t.muted }}
                >
                  <span>Machado de Assis</span>
                  <span>Capítulo I</span>
                </div>
                <h3 className="mt-5 font-display text-4xl">Do título</h3>
                <motion.div
                  className="mt-4 space-y-3"
                  animate={{ fontSize: size }}
                  style={{ fontFamily: f.family, lineHeight: 1.8 }}
                >
                  <p>
                    <span className="float-left pr-2 pt-1 font-display text-[3.6em] leading-[0.8] text-gold">
                      U
                    </span>
                    ma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da
                    Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu.{" "}
                    <mark
                      className="rounded-sm px-0.5 text-inherit"
                      style={{ background: t.mark, boxShadow: `0 2px 0 ${t.mark}` }}
                    >
                      Cumprimentou-me, sentou-se ao pé de mim
                    </mark>
                    , falou da lua e dos ministros, e acabou recitando-me versos.
                  </p>
                  <p className="hidden sm:block">
                    A viagem era curta, e os versos pode ser que não fossem inteiramente maus.
                  </p>
                </motion.div>
                <div
                  className="mt-7 flex items-center gap-3 text-[11px]"
                  style={{ color: t.muted }}
                >
                  <div
                    className="h-[3px] flex-1 overflow-hidden rounded-full"
                    style={{ background: `${t.muted}44` }}
                  >
                    <div className="h-full w-[6%] rounded-full bg-gold" />
                  </div>
                  2 min até o fim do capítulo
                </div>
              </motion.article>
            </Tilt>

            {/* controls */}
            <div className="mt-6 grid gap-4 rounded-3xl border border-border bg-card/70 p-4 backdrop-blur sm:grid-cols-[auto_1fr]">
              <div role="radiogroup" aria-label="Tema da página" className="flex gap-2">
                {PAGE_THEMES.map((x) => (
                  <button
                    key={x.id}
                    role="radio"
                    aria-checked={x.id === theme}
                    aria-label={x.label}
                    title={x.label}
                    onClick={() => setTheme(x.id)}
                    className="press relative grid h-10 w-10 place-items-center rounded-full font-display text-base ring-1 ring-border"
                    style={{ background: x.bg, color: x.fg }}
                  >
                    Aa
                    {x.id === theme && (
                      <motion.span
                        layoutId="page-theme-ring"
                        className="absolute -inset-1 rounded-full ring-2 ring-gold"
                      />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-full border border-border p-0.5">
                  {PAGE_FONTS.map((x) => (
                    <button
                      key={x.id}
                      onClick={() => setFont(x.id)}
                      aria-pressed={x.id === font}
                      className="press relative rounded-full px-3 py-1.5 text-xs"
                      style={{ fontFamily: x.family }}
                    >
                      {x.id === font && (
                        <motion.span
                          layoutId="page-font"
                          className="absolute inset-0 rounded-full bg-gold/15"
                        />
                      )}
                      <span
                        className={`relative ${x.id === font ? "text-gold" : "text-muted-foreground"}`}
                      >
                        {x.label}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-[11px]">A</span>
                  <input
                    id="landing-size"
                    type="range"
                    min={14}
                    max={22}
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "var(--gold)" }}
                    aria-label="Tamanho do texto"
                  />
                  <span className="text-base">A</span>
                </label>
              </div>
            </div>
          </Rise>

          <div className="flex flex-col gap-10 pt-6 lg:gap-16 lg:pt-16">
            {MARGIN_NOTES.slice(2).map((n, i) => (
              <Rise key={n.title} delay={0.1 * i}>
                <p className="font-display text-2xl italic text-gold-soft">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.text}</p>
              </Rise>
            ))}
            <div className="grid gap-6 sm:grid-cols-2 lg:hidden">
              {MARGIN_NOTES.slice(0, 2).map((n) => (
                <Rise key={n.title}>
                  <p className="font-display text-2xl italic text-gold-soft">{n.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{n.text}</p>
                </Rise>
              ))}
            </div>
          </div>
        </div>

        <Rise className="mt-14 flex flex-wrap justify-center gap-2.5">
          {[
            { icon: CloudOff, t: "Lê sem internet" },
            { icon: FileText, t: "PDF folha a folha" },
            { icon: RefreshCw, t: "Sincroniza em todos os aparelhos" },
            { icon: Languages, t: "Tradução de trechos" },
          ].map((c) => (
            <span
              key={c.t}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground"
            >
              <c.icon className="h-4 w-4 text-gold" /> {c.t}
            </span>
          ))}
        </Rise>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Lumi                                                                       */
/* -------------------------------------------------------------------------- */

const LUMI_ANSWER =
  "“Ressaca” aqui é o mar que recua e puxa tudo para dentro. Bento sente que o olhar de Capitu o arrasta, e a imagem do mar volta mais tarde no livro. Repare como ele escolhe o que contar: é um narrador para ler com desconfiança.";

function LumiShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setStarted(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setTyped(LUMI_ANSWER.length);
      return;
    }
    if (typed >= LUMI_ANSWER.length) return;
    const id = setTimeout(() => setTyped((n) => Math.min(LUMI_ANSWER.length, n + 2)), 18);
    return () => clearTimeout(id);
  }, [started, typed]);

  const actions = [
    { icon: WandSparkles, label: "Resumir sem spoilers" },
    { icon: MessageCircleQuestion, label: "Explicar o trecho" },
    { icon: Languages, label: "Traduzir" },
    { icon: Bookmark, label: "Criar flashcards" },
  ];

  return (
    <section className="px-3 py-8 md:px-6">
      <div className="grain relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-border bg-night px-6 py-16 text-night-foreground md:px-14 md:py-24">
        <div
          aria-hidden
          className="lamp-glow lamp-breathe absolute -right-32 -top-40 h-[34rem] w-[34rem]"
        />
        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Rise>
              <Eyebrow id="lumi">A Lumi</Eyebrow>
              <h2 className="mt-3 font-display text-5xl leading-[0.95] md:text-6xl">
                Uma coruja que lê <span className="italic text-gold">nas margens</span> com você.
              </h2>
              <p className="mt-6 max-w-lg leading-relaxed opacity-70">
                Travou numa passagem? Selecione o trecho e a Lumi explica o contexto, resume o
                capítulo sem estragar o final, traduz expressões antigas e cria flashcards para
                revisar. Ela só recebe o que você pedir, nunca o livro inteiro.
              </p>
            </Rise>
            <div className="mt-8 grid max-w-md grid-cols-2 gap-2.5">
              {actions.map((a, i) => (
                <Rise key={a.label} delay={0.06 * i} y={14}>
                  <span className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm transition hover:border-gold/50 hover:bg-white/10">
                    <a.icon className="h-4 w-4 text-gold" /> {a.label}
                  </span>
                </Rise>
              ))}
            </div>
          </div>

          <Rise delay={0.1}>
            <div
              ref={ref}
              className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl backdrop-blur-xl md:p-6"
            >
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <LumiMascot size={46} thinking={started && typed < LUMI_ANSWER.length} />
                <div>
                  <p className="text-sm font-semibold">Lumi</p>
                  <p className="text-xs opacity-55">Lendo Dom Casmurro com você</p>
                </div>
              </div>
              <div className="mt-5 space-y-4 text-sm">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={started ? { opacity: 1, x: 0 } : undefined}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gold px-4 py-3 text-primary-foreground"
                >
                  O que ele quer dizer com “olhos de ressaca”?
                </motion.div>
                <div className="max-w-[94%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 font-[family-name:var(--font-book)] text-[15px] leading-relaxed">
                  {LUMI_ANSWER.slice(0, typed)}
                  {typed < LUMI_ANSWER.length && <span className="caret" />}
                </div>
              </div>
            </div>
          </Rise>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ritual — candles light up as you scroll                                   */
/* -------------------------------------------------------------------------- */

function Candle({
  lit,
  h,
  delay,
  label,
}: {
  lit: boolean;
  h: number;
  delay: number;
  label: number;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <motion.span
        initial={{ opacity: 0, scale: 0.2 }}
        whileInView={lit ? { opacity: 1, scale: 1 } : undefined}
        viewport={{ once: true }}
        transition={{ delay, type: "spring", stiffness: 300, damping: 14 }}
        className="flame h-4 w-2.5 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-[radial-gradient(circle_at_50%_70%,#fff3cf,#f3cd84_40%,#e0703f_80%)] shadow-[0_0_18px_rgb(243_205_132/0.85)]"
      />
      <span
        className="w-3.5 rounded-t-[3px]"
        style={{
          height: h,
          background: lit
            ? "linear-gradient(90deg,#d8ccb3,#f1e7d3,#cbbd9f)"
            : "color-mix(in oklab, var(--foreground) 12%, transparent)",
        }}
      />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function Ritual() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 md:px-8 lg:grid-cols-2">
        <Rise>
          <Eyebrow id="ritual">O ritual</Eyebrow>
          <h2 className="mt-3 font-display text-5xl leading-[0.95] md:text-6xl">
            Cada noite lida deixa a lâmpada <span className="italic text-gold">mais acesa.</span>
          </h2>
          <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
            Escolha seu ritual de 10, 20 ou 30 minutos. A sequência vira uma fileira de velas, a
            meta anual enche uma estante e cada conquista ganha um selo ex-libris. Sem pressão: o
            app celebra o hábito, não a pressa.
          </p>
        </Rise>
        <Rise delay={0.1}>
          <div className="rounded-[2rem] border border-border bg-card/60 p-6 backdrop-blur md:p-8">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Sequência · 12 noites</span>
              <span className="text-xs text-muted-foreground">novembro</span>
            </div>
            <div className="mt-6 flex items-end gap-1.5 sm:gap-2.5">
              {Array.from({ length: 14 }, (_, i) => (
                <Candle
                  key={i}
                  lit={i < 12}
                  h={36 + ((i * 37) % 30)}
                  delay={0.08 * i}
                  label={11 + i}
                />
              ))}
            </div>
            <div className="foil my-7" />
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Meta 2026 · 3 de 12 livros</span>
              <span className="text-xs font-semibold text-success">no ritmo</span>
            </div>
            <div className="mt-4 flex h-28 items-end gap-1">
              {[
                ["Frankenstein", "#3c5a4a", 0.92],
                ["O Alienista", "#7a2e30", 0.8],
                ["Iracema", "#22344a", 0.96],
              ].map(([t, c, h], i) => (
                <motion.div
                  key={t as string}
                  initial={{ y: -80, opacity: 0, rotate: 180 }}
                  whileInView={{ y: 0, opacity: 1, rotate: 180 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: 0.4 + i * 0.15,
                    type: "spring",
                    stiffness: 220,
                    damping: 18,
                  }}
                  className="spine w-7 text-[11px]"
                  style={{ "--s-bg": c, height: `${(h as number) * 100}%` } as React.CSSProperties}
                >
                  {t}
                </motion.div>
              ))}
              {Array.from({ length: 9 }, (_, i) => (
                <div
                  key={i}
                  className="h-[86%] w-6 rounded-[3px] border border-dashed border-border"
                />
              ))}
            </div>
            <div className="shelfboard h-2" />
          </div>
        </Rise>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ambiences — live switch                                                    */
/* -------------------------------------------------------------------------- */

function Ambiences() {
  return (
    <section className="relative border-y border-border bg-card/30 py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Rise className="max-w-2xl">
          <Eyebrow>Sete ambientes</Eyebrow>
          <h2 className="mt-3 font-display text-5xl leading-[0.95] md:text-6xl">
            Não é só claro ou escuro. <span className="italic text-gold">É o seu canto.</span>
          </h2>
          <p className="mt-5 text-muted-foreground">
            Toque em um ambiente e veja o BookVerse inteiro mudar agora. O Automático segue o seu
            aparelho; o Alto contraste foi pensado para quem precisa de máxima legibilidade.
          </p>
        </Rise>
        <Rise delay={0.1} className="mt-10">
          <AmbiencePicker />
        </Rise>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  How it works                                                               */
/* -------------------------------------------------------------------------- */

function HowItWorks() {
  const steps = [
    {
      n: "I",
      title: "Crie sua estante",
      text: "Entre com Google ou e-mail. Seu nome vira uma placa ex-libris.",
    },
    {
      n: "II",
      title: "Puxe os primeiros livros",
      text: "Escolha clássicos no acervo ou traga seus EPUBs e PDFs.",
    },
    {
      n: "III",
      title: "Acenda a primeira noite",
      text: "Ajuste o leitor do seu jeito e leia. A Lumi fica por perto.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
      <Rise className="text-center">
        <Eyebrow>Como funciona</Eyebrow>
        <h2 className="mt-3 font-display text-5xl md:text-6xl">
          Três passos até a primeira página.
        </h2>
      </Rise>
      <ol className="relative mt-16 grid gap-10 md:grid-cols-3">
        <motion.div
          aria-hidden
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: EASE }}
          className="foil absolute left-[16%] right-[16%] top-9 hidden origin-left md:block"
        />
        {steps.map((s, i) => (
          <Rise key={s.n} delay={0.15 * i} className="relative text-center">
            <span className="relative mx-auto grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--gold-soft),var(--gold)_55%,var(--oxide))] font-display text-2xl text-primary-foreground shadow-[0_14px_30px_-10px_color-mix(in_oklab,var(--gold)_70%,transparent)]">
              {s.n}
            </span>
            <h3 className="mt-6 font-display text-3xl">{s.title}</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{s.text}</p>
          </Rise>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  FAQ + CTA                                                                  */
/* -------------------------------------------------------------------------- */

const FAQ = [
  {
    q: "O BookVerse é gratuito?",
    a: "Sim. Criar conta, ler os clássicos de domínio público, importar seus arquivos e usar metas, diário e desafios não custa nada e não tem anúncios.",
  },
  {
    q: "Quais livros posso ler?",
    a: "Milhares de obras de domínio público, de Machado de Assis a Jane Austen, abrem direto no leitor. Você também pode importar EPUBs e PDFs que já possui.",
  },
  {
    q: "É fácil de usar para quem não é de tecnologia?",
    a: "Sim. O botão “Ler” no centro da tela sempre volta ao seu livro, as letras podem ficar bem grandes, existe um ambiente de alto contraste e a fonte Atkinson foi feita para facilitar a leitura.",
  },
  {
    q: "Meus arquivos ficam seguros?",
    a: "Os EPUBs e PDFs que você importa ficam vinculados apenas à sua conta e não são compartilhados com outras pessoas.",
  },
  {
    q: "Funciona no celular e sem internet?",
    a: "Funciona em qualquer navegador e pode ser instalado como aplicativo. O livro que você já abriu continua disponível offline.",
  },
  {
    q: "O que a Lumi faz com o meu livro?",
    a: "A Lumi só recebe o trecho que você seleciona ou o contexto do capítulo atual quando você pede ajuda, nunca o livro inteiro.",
  },
];

function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-5 pb-20 md:px-8 md:pb-28">
      <Rise className="text-center">
        <Eyebrow id="faq">Perguntas</Eyebrow>
        <h2 className="mt-3 font-display text-5xl md:text-6xl">Antes de abrir o livro</h2>
      </Rise>
      <Rise delay={0.1} className="mt-10">
        <Accordion
          type="single"
          collapsible
          className="divide-y divide-border border-y border-border"
        >
          {FAQ.map((item, i) => (
            <AccordionItem key={item.q} value={`q${i}`} className="border-0">
              <AccordionTrigger className="py-6 text-left font-display text-2xl font-normal hover:no-underline [&[data-state=open]]:text-gold">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-[15px] leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Rise>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-3 pb-8 md:px-6">
      <Rise>
        <div className="grain relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-gold/25 bg-[linear-gradient(120deg,color-mix(in_oklab,var(--gold)_14%,var(--night)),var(--night)_65%)] px-6 py-14 text-night-foreground md:px-14 md:py-16">
          <div
            aria-hidden
            className="lamp-glow lamp-breathe absolute -left-20 -top-32 h-[28rem] w-[28rem]"
          />
          <div className="relative grid items-center gap-8 md:grid-cols-[auto_1fr_auto]">
            <LumiMascot size={120} className="mx-auto" />
            <div className="text-center md:text-left">
              <h2 className="font-display text-4xl leading-[1] md:text-5xl">
                Sua estante te espera.{" "}
                <span className="italic text-gold">Acenda a primeira noite.</span>
              </h2>
              <p className="mt-3 opacity-70">
                Crie sua conta em 30 segundos. Seu progresso acompanha você em qualquer aparelho.
              </p>
            </div>
            <Magnetic className="justify-center">
              <Link
                to="/auth"
                search={{ redirect: "/" }}
                className="btn-primary btn-sheen px-8 py-4 text-base"
              >
                Criar minha estante <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnetic>
          </div>
        </div>
      </Rise>
    </section>
  );
}
