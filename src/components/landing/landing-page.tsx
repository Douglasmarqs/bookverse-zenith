import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Check,
  CloudOff,
  Flame,
  Highlighter,
  Languages,
  Library,
  Lock,
  MessageCircleQuestion,
  NotebookPen,
  Palette,
  Sparkles,
  Target,
  Trophy,
  Type,
  UploadCloud,
  WandSparkles,
} from "lucide-react";

import { CountUp, Reveal } from "@/components/motion/reveal";
import { FAUX_BOOKS, FauxCover } from "@/components/faux-cover";
import { LumiMascot } from "@/components/lumi-mascot";
import { ProgressRing } from "@/components/progress-ring";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const DISCOVER_SEARCH = { q: undefined, categoria: undefined };

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function LandingPage() {
  return (
    <div className="overflow-x-clip">
      <Hero />
      <CoverMarquee />
      <StatsBand />
      <FeatureBento />
      <ReaderShowcase />
      <HowItWorks />
      <LumiShowcase />
      <HabitsShowcase />
      <Faq />
      <FinalCta />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="blob-drift absolute -left-32 top-10 h-[28rem] w-[28rem] rounded-full bg-gold/20 blur-3xl" />
        <div
          className="blob-drift absolute -right-24 top-40 h-[24rem] w-[24rem] rounded-full bg-warm/15 blur-3xl"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--foreground) 12%, transparent) 1px, transparent 0)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, #000 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 60% at 50% 30%, #000 30%, transparent 75%)",
          }}
        />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-16 pt-10 md:px-8 md:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24">
        <div className="text-center lg:text-left">
          <Reveal>
            <button
              type="button"
              onClick={() =>
                document.getElementById("lumi")?.scrollIntoView({ behavior: "smooth" })
              }
              className="group inline-flex items-center gap-2 rounded-full border border-gold/30 bg-card/70 py-1 pl-1 pr-3 text-xs font-medium text-foreground/85 shadow-sm backdrop-blur transition hover:border-gold/60"
            >
              <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                Novo
              </span>
              Lumi, a IA que lê junto com você
              <ArrowRight className="h-3.5 w-3.5 text-gold transition-transform group-hover:translate-x-0.5" />
            </button>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 font-display text-[2.6rem] font-medium leading-[1.02] tracking-tight sm:text-6xl lg:text-[3.5rem] xl:text-[3.9rem]">
              Toda grande história
              <br className="hidden sm:block" /> começa em{" "}
              <span className="relative inline-block italic text-gold">
                uma página
                <svg
                  aria-hidden
                  viewBox="0 0 300 20"
                  className="absolute -bottom-2 left-0 h-3 w-full text-warm"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M3 14C60 4 140 2 297 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              .
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
              O BookVerse reúne milhares de clássicos gratuitos, seus EPUBs e PDFs e um leitor
              confortável em um só lugar — com metas, diário e uma IA que explica, resume e traduz
              sem tirar você da página.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                to="/auth"
                search={{ redirect: "/" }}
                className="btn-primary btn-sheen w-full px-7 py-4 text-base sm:w-auto"
              >
                Começar a ler grátis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/descobrir"
                search={DISCOVER_SEARCH}
                className="btn-ghost w-full px-7 py-4 text-base sm:w-auto"
              >
                <BookOpen className="h-4 w-4" /> Explorar clássicos
              </Link>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-start">
              {["Gratuito", "Sem anúncios", "EPUB e PDF", "Funciona offline"].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-success" /> {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal variant="scale" delay={150}>
          <HeroVisual />
        </Reveal>
      </div>
    </section>
  );
}

function HeroVisual() {
  const [a, b, c, d] = [FAUX_BOOKS[0], FAUX_BOOKS[3], FAUX_BOOKS[5], FAUX_BOOKS[1]];
  return (
    <div className="relative mx-auto h-[30rem] w-full max-w-[30rem] sm:h-[34rem]">
      {/* floating covers */}
      <div
        className="book-float absolute left-0 top-10 w-28 sm:w-32"
        style={{ ["--float-rot" as string]: "-10deg", ["--float-delay" as string]: "-1s" }}
      >
        <FauxCover book={a} />
      </div>
      <div
        className="book-float absolute bottom-8 left-4 w-24 sm:w-28"
        style={{ ["--float-rot" as string]: "8deg", ["--float-delay" as string]: "-3s" }}
      >
        <FauxCover book={b} />
      </div>
      <div
        className="book-float absolute right-0 top-2 w-24 sm:w-28"
        style={{ ["--float-rot" as string]: "9deg", ["--float-delay" as string]: "-2s" }}
      >
        <FauxCover book={c} />
      </div>
      <div
        className="book-float absolute bottom-0 right-2 w-28 sm:w-32"
        style={{ ["--float-rot" as string]: "-6deg", ["--float-delay" as string]: "-4.5s" }}
      >
        <FauxCover book={d} />
      </div>

      {/* phone */}
      <div className="absolute left-1/2 top-1/2 z-10 w-[15.5rem] -translate-x-1/2 -translate-y-1/2 sm:w-[17rem]">
        <div className="rounded-[2.6rem] border border-foreground/10 bg-night p-2.5 shadow-[0_50px_90px_-40px_rgb(10_30_70/0.7)]">
          <div className="relative overflow-hidden rounded-[2.1rem] bg-[#fbf6ec] text-[#2b2419]">
            <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-night" />
            <div className="flex items-center justify-between px-5 pt-3 text-[10px] font-medium text-[#8a7a62]">
              <span>Cap. 1 · Do título</span>
              <span>12%</span>
            </div>
            <div className="px-5 pb-5 pt-3">
              <p className="font-display text-lg font-semibold">Dom Casmurro</p>
              <p className="mt-3 font-display text-[12.5px] leading-[1.7]">
                Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central
                um rapaz aqui do bairro, que eu conheço de vista e de chapéu.{" "}
                <mark className="rounded-sm bg-[#ffe28a] px-0.5 text-inherit">
                  Cumprimentou-me, sentou-se ao pé de mim
                </mark>
                , falou da lua e dos ministros, e acabou recitando-me versos.
              </p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#eadfca]">
                <div className="h-full w-[12%] rounded-full bg-[#1769d8]" />
              </div>
            </div>
          </div>
        </div>

        {/* floating chips */}
        <div className="book-float absolute -left-24 top-4 hidden items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur sm:flex">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-warm/15 text-warm">
            <Flame className="h-4 w-4" />
          </span>
          7 dias seguidos
        </div>
        <div
          className="book-float absolute -bottom-8 -right-20 hidden max-w-[12rem] items-start gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur sm:flex"
          style={{ ["--float-delay" as string]: "-2.5s" }}
        >
          <LumiMascot size={26} blink={false} />
          <span>
            <span className="font-semibold">Lumi</span>
            <span className="block text-muted-foreground">Resumo do capítulo pronto ✨</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Marquee + stats                                                            */
/* -------------------------------------------------------------------------- */

function CoverMarquee() {
  const rowA = [...FAUX_BOOKS, ...FAUX_BOOKS];
  const rowB = [...FAUX_BOOKS.slice(6), ...FAUX_BOOKS.slice(0, 6)];
  return (
    <section aria-label="Alguns clássicos disponíveis" className="relative py-6">
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Clássicos de domínio público prontos para abrir — de Machado de Assis a Jane Austen
      </p>
      <div className="marquee-mask overflow-hidden">
        <div className="marquee-track gap-5 pr-5">
          {rowA.map((book, i) => (
            <FauxCover key={`a-${i}`} book={book} className="w-24 shrink-0 sm:w-28" />
          ))}
        </div>
      </div>
      <div className="marquee-mask mt-5 hidden overflow-hidden md:block">
        <div
          className="marquee-track gap-5 pr-5"
          style={{ animationDirection: "reverse", ["--marquee-duration" as string]: "60s" }}
        >
          {[...rowB, ...rowB].map((book, i) => (
            <FauxCover key={`b-${i}`} book={book} className="w-24 shrink-0 sm:w-28" />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsBand() {
  const stats = [
    { value: 70000, suffix: "+", label: "clássicos gratuitos para ler" },
    { value: 4, suffix: "", label: "temas de leitura, do claro ao sépia" },
    { value: 2, suffix: "", label: "formatos próprios: EPUB e PDF" },
    { value: 100, suffix: "%", label: "privado: seus arquivos são só seus" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 80} className="bg-card p-6 md:p-8">
            <p className="font-display text-4xl font-medium text-foreground md:text-5xl">
              <CountUp value={s.value} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-sm leading-snug text-muted-foreground">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Features bento                                                             */
/* -------------------------------------------------------------------------- */

function SectionIntro({
  id,
  eyebrow,
  title,
  text,
  center = true,
}: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  text?: string;
  center?: boolean;
}) {
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p id={id} className="eyebrow scroll-mt-28">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight md:text-5xl">
        {title}
      </h2>
      {text && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{text}</p>}
    </Reveal>
  );
}

function FeatureBento() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
      <SectionIntro
        id="recursos"
        eyebrow="Recursos"
        title={
          <>
            Tudo que um leitor precisa,
            <br className="hidden md:block" /> num só lugar.
          </>
        }
        text="Do primeiro capítulo ao último, o BookVerse cuida do que tira você da leitura — para você só virar a página."
      />

      <div className="mt-14 grid auto-rows-[minmax(0,auto)] gap-4 md:grid-cols-6">
        <Reveal className="surface-card lift relative overflow-hidden p-7 md:col-span-4 md:row-span-2">
          <FeatureHeader
            icon={<BookOpen className="h-5 w-5" />}
            title="Leitor imersivo"
            text="Fontes, tamanho, espaçamento, margens e quatro temas. Virada de página realista, marcadores, destaques em cores e modo foco."
          />
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              { bg: "#fbf6ec", fg: "#2b2419", name: "Papel" },
              { bg: "#e9dcc2", fg: "#3a2a1d", name: "Sépia" },
              { bg: "#141b29", fg: "#e7eefb", name: "Noite" },
            ].map((t, i) => (
              <div
                key={t.name}
                className="rounded-2xl border border-border/60 p-4 shadow-sm transition-transform duration-500 hover:-translate-y-1"
                style={{ background: t.bg, color: t.fg, transitionDelay: `${i * 40}ms` }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-60">
                  {t.name}
                </p>
                <p className="mt-2 font-display text-[13px] leading-relaxed">
                  “Não consultes dicionários. Casmurro não está aqui no sentido que eles lhe dão…”
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { icon: <Type className="h-3.5 w-3.5" />, t: "Tipografia ajustável" },
              { icon: <Highlighter className="h-3.5 w-3.5" />, t: "Destaques e notas" },
              { icon: <BookMarked className="h-3.5 w-3.5" />, t: "Marcadores" },
              { icon: <Palette className="h-3.5 w-3.5" />, t: "4 temas" },
            ].map((c) => (
              <span
                key={c.t}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium"
              >
                <span className="text-gold">{c.icon}</span> {c.t}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={80} className="surface-card lift relative overflow-hidden p-7 md:col-span-2">
          <FeatureHeader
            icon={<Sparkles className="h-5 w-5" />}
            title="Lumi, sua IA"
            text="Selecione um trecho e peça um resumo, explicação, tradução ou flashcards."
          />
          <div className="mt-6 flex justify-end">
            <LumiMascot size={92} />
          </div>
        </Reveal>

        <Reveal
          delay={140}
          className="surface-card lift relative overflow-hidden p-7 md:col-span-2"
        >
          <FeatureHeader
            icon={<UploadCloud className="h-5 w-5" />}
            title="Seus EPUBs e PDFs"
            text="Arraste o arquivo e comece a ler. Fica privado na sua conta e sincroniza entre dispositivos."
          />
          <div className="mt-6 flex items-center gap-2">
            {["EPUB", "PDF"].map((f) => (
              <span
                key={f}
                className="rounded-lg border border-dashed border-gold/50 bg-gold/5 px-3 py-2 font-mono text-xs font-semibold text-gold"
              >
                .{f.toLowerCase()}
              </span>
            ))}
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-primary-foreground">
              Lendo
            </span>
          </div>
        </Reveal>

        <Reveal delay={60} className="surface-card lift p-7 md:col-span-2">
          <FeatureHeader
            icon={<Target className="h-5 w-5" />}
            title="Metas e sequência"
            text="Defina uma meta diária e acompanhe sua sequência de dias lidos."
          />
        </Reveal>
        <Reveal delay={120} className="surface-card lift p-7 md:col-span-2">
          <FeatureHeader
            icon={<NotebookPen className="h-5 w-5" />}
            title="Diário de leitura"
            text="Registre impressões, citações favoritas e o que cada livro deixou em você."
          />
        </Reveal>
        <Reveal delay={180} className="surface-card lift p-7 md:col-span-2">
          <FeatureHeader
            icon={<Trophy className="h-5 w-5" />}
            title="Desafios e ranking"
            text="Ganhe XP, conquiste medalhas e leia junto com a comunidade."
          />
        </Reveal>

        <Reveal className="surface-card lift p-7 md:col-span-3">
          <FeatureHeader
            icon={<CloudOff className="h-5 w-5" />}
            title="Funciona offline"
            text="Instale como app no celular ou computador. O livro aberto continua disponível sem internet."
          />
        </Reveal>
        <Reveal delay={80} className="surface-card lift p-7 md:col-span-3">
          <FeatureHeader
            icon={<Lock className="h-5 w-5" />}
            title="Privado por padrão"
            text="Sem anúncios e sem vender dados. Seus arquivos ficam vinculados apenas à sua conta."
          />
        </Reveal>
      </div>
    </section>
  );
}

function FeatureHeader({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div>
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold/12 text-gold ring-1 ring-gold/20">
        {icon}
      </span>
      <h3 className="mt-5 font-display text-xl font-medium md:text-2xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Interactive reader showcase                                                */
/* -------------------------------------------------------------------------- */

const SHOWCASE_THEMES = [
  { id: "papel", label: "Papel", bg: "#fbf6ec", fg: "#2b2419", muted: "#8a7a62", bar: "#eadfca" },
  { id: "claro", label: "Claro", bg: "#ffffff", fg: "#1f2937", muted: "#6b7280", bar: "#e5e7eb" },
  { id: "sepia", label: "Sépia", bg: "#e9dcc2", fg: "#3a2a1d", muted: "#7a6347", bar: "#d6c4a3" },
  { id: "noite", label: "Noite", bg: "#121826", fg: "#e3e9f5", muted: "#8e9ab3", bar: "#273149" },
] as const;

const SHOWCASE_FONTS = [
  { id: "serif", label: "Serifada", family: "var(--font-display)" },
  { id: "sans", label: "Sem serifa", family: "var(--font-sans)" },
] as const;

function ReaderShowcase() {
  const [themeId, setThemeId] = useState<(typeof SHOWCASE_THEMES)[number]["id"]>("papel");
  const [fontId, setFontId] = useState<(typeof SHOWCASE_FONTS)[number]["id"]>("serif");
  const [size, setSize] = useState(17);
  const theme = SHOWCASE_THEMES.find((t) => t.id === themeId)!;
  const font = SHOWCASE_FONTS.find((f) => f.id === fontId)!;

  return (
    <section className="relative py-16 md:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionIntro
            center={false}
            eyebrow="Experimente agora"
            title="Um leitor que se adapta a você."
            text="Teste aqui mesmo: troque o tema, a fonte e o tamanho. É exatamente assim que funciona dentro do app."
          />
          <Reveal delay={100} className="mt-8 space-y-6">
            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Tema
              </p>
              <div role="radiogroup" aria-label="Tema de leitura" className="flex flex-wrap gap-2">
                {SHOWCASE_THEMES.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={t.id === themeId}
                    onClick={() => setThemeId(t.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                      t.id === themeId
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-card hover:border-gold/40"
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ background: t.bg }}
                    />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Fonte
              </p>
              <div className="inline-flex rounded-full border border-border bg-card p-1">
                {SHOWCASE_FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFontId(f.id)}
                    aria-pressed={f.id === fontId}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      f.id === fontId
                        ? "bg-gold text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={{ fontFamily: f.family }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-w-sm">
              <label
                htmlFor="showcase-size"
                className="mb-2.5 flex justify-between text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                Tamanho <span className="tabular-nums text-foreground">{size}px</span>
              </label>
              <input
                id="showcase-size"
                type="range"
                min={14}
                max={22}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: "var(--gold)" }}
              />
            </div>
          </Reveal>
        </div>

        <Reveal variant="scale">
          <div
            className="relative rounded-[2rem] border border-border p-7 shadow-[0_40px_80px_-50px_rgb(10_30_70/0.55)] transition-colors duration-500 md:p-10"
            style={{ background: theme.bg, color: theme.fg }}
          >
            <div
              className="flex items-center justify-between text-xs font-medium transition-colors duration-500"
              style={{ color: theme.muted }}
            >
              <span>Machado de Assis · Dom Casmurro</span>
              <span>Capítulo I</span>
            </div>
            <h3
              className="mt-6 text-2xl font-semibold transition-all duration-300"
              style={{ fontFamily: font.family }}
            >
              Do título
            </h3>
            <div
              className="mt-4 space-y-4 transition-all duration-300"
              style={{ fontFamily: font.family, fontSize: size, lineHeight: 1.75 }}
            >
              <p>
                Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central
                um rapaz aqui do bairro, que eu conheço de vista e de chapéu. Cumprimentou-me,
                sentou-se ao pé de mim, falou da lua e dos ministros, e acabou recitando-me versos.
              </p>
              <p className="hidden sm:block">
                A viagem era curta, e os versos pode ser que não fossem inteiramente maus. Sucedeu,
                porém, que, como eu estava cansado, fechei os olhos três ou quatro vezes; tanto
                bastou para que ele interrompesse a leitura e metesse os versos no bolso.
              </p>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs" style={{ color: theme.muted }}>
              <div
                className="h-1 flex-1 overflow-hidden rounded-full"
                style={{ background: theme.bar }}
              >
                <div className="h-full w-[8%] rounded-full bg-[#1769d8]" />
              </div>
              <span className="tabular-nums">3 min restantes no capítulo</span>
            </div>
          </div>
        </Reveal>
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
      icon: <Sparkles className="h-5 w-5" />,
      title: "Crie sua conta grátis",
      text: "Entre com Google ou e-mail em segundos. Seu progresso passa a acompanhar você.",
    },
    {
      icon: <Library className="h-5 w-5" />,
      title: "Monte sua estante",
      text: "Escolha clássicos no Descobrir ou importe seus próprios EPUBs e PDFs.",
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: "Leia do seu jeito",
      text: "Ajuste o leitor, peça ajuda à Lumi e acompanhe metas e sequência.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
      <SectionIntro
        id="como-funciona"
        eyebrow="Como funciona"
        title="Da conta ao primeiro capítulo em 1 minuto."
      />
      <ol className="relative mt-14 grid gap-6 md:grid-cols-3">
        <div
          aria-hidden
          className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent md:block"
        />
        {steps.map((s, i) => (
          <Reveal as="li" key={s.title} delay={i * 120} className="relative text-center">
            <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold text-primary-foreground shadow-lg shadow-gold/25">
              {s.icon}
              <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-warm text-[11px] font-bold text-white">
                {i + 1}
              </span>
            </span>
            <h3 className="mt-5 font-display text-xl font-medium">{s.title}</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {s.text}
            </p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Lumi showcase (dark band with typing demo)                                 */
/* -------------------------------------------------------------------------- */

const LUMI_ANSWER =
  "O apelido vem de um poeta do bairro, ofendido porque Bento cochilou enquanto ele recitava versos no trem. O narrador avisa que não é o sentido do dicionário, e sim o popular: “homem calado e metido consigo”. Repare: desde a primeira página ele escolhe o que contar — um narrador para ler com desconfiança.";

function LumiShowcase() {
  const [typed, setTyped] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = document.getElementById("lumi-demo");
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
    const t = setTimeout(() => setTyped((n) => Math.min(LUMI_ANSWER.length, n + 3)), 22);
    return () => clearTimeout(t);
  }, [started, typed]);

  const actions = [
    { icon: <WandSparkles className="h-4 w-4" />, label: "Resumir capítulo" },
    { icon: <MessageCircleQuestion className="h-4 w-4" />, label: "Explicar trecho" },
    { icon: <Languages className="h-4 w-4" />, label: "Traduzir" },
    { icon: <BookMarked className="h-4 w-4" />, label: "Criar flashcards" },
  ];

  return (
    <section className="px-3 py-10 md:px-6">
      <div className="grain relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-night px-6 py-16 text-night-foreground md:px-14 md:py-24">
        <div
          aria-hidden
          className="blob-drift pointer-events-none absolute -right-20 -top-24 h-96 w-96 rounded-full bg-[#1769d8]/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-warm/20 blur-3xl"
        />
        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <p id="lumi" className="eyebrow scroll-mt-28 !text-[#7fb6ff]">
                Conheça a Lumi
              </p>
              <h2 className="mt-3 font-display text-3xl font-medium leading-tight md:text-5xl">
                Uma companheira de leitura que entende o livro com você.
              </h2>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70">
                Travou numa passagem? Selecione o trecho e a Lumi explica o contexto, resume o
                capítulo, traduz expressões antigas e cria flashcards para revisar. Ela lê só o que
                você pedir — nunca o livro inteiro.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-8 grid max-w-md grid-cols-2 gap-2.5">
                {actions.map((a) => (
                  <span
                    key={a.label}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm font-medium text-white/90"
                  >
                    <span className="text-[#7fb6ff]">{a.icon}</span> {a.label}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal variant="right" delay={100}>
            <div
              id="lumi-demo"
              className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl md:p-6"
            >
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <LumiMascot size={40} thinking={typed < LUMI_ANSWER.length && started} />
                <div>
                  <p className="text-sm font-semibold">Lumi</p>
                  <p className="text-xs text-white/55">Lendo Dom Casmurro com você</p>
                </div>
              </div>
              <div className="mt-5 space-y-4 text-sm">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#1769d8] px-4 py-3 text-white">
                  Por que ele se chama “Dom Casmurro”?
                  <span className="mt-2 block rounded-lg bg-white/15 px-2.5 py-1.5 text-xs italic">
                    “Não consultes dicionários…”
                  </span>
                </div>
                <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 leading-relaxed text-white/90">
                  {LUMI_ANSWER.slice(0, typed)}
                  {typed < LUMI_ANSWER.length && <span className="caret" />}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Habits                                                                     */
/* -------------------------------------------------------------------------- */

// Deterministic heatmap so server and client render the same markup.
const HEAT_WEEKS = 20;
const HEAT = Array.from({ length: 7 * HEAT_WEEKS }, (_, i) => {
  const v = (Math.sin(i * 12.9898) * 43758.5453) % 1;
  const n = Math.abs(v);
  return i > 7 * HEAT_WEEKS - 10 ? 3 : n > 0.72 ? 3 : n > 0.45 ? 2 : n > 0.22 ? 1 : 0;
});

function HabitsShowcase() {
  const tone = ["bg-secondary", "bg-gold/30", "bg-gold/60", "bg-gold"];
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal variant="left" className="order-2 lg:order-1">
          <div className="surface-card p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-6">
              <ProgressRing value={0.72} size={112} stroke={10} label="Meta diária">
                <div className="text-center">
                  <p className="font-display text-2xl font-medium">22</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    de 30 min
                  </p>
                </div>
              </ProgressRing>
              <div className="grid flex-1 grid-cols-2 gap-3">
                <MiniStat
                  icon={<Flame className="h-4 w-4 text-warm" />}
                  value="12"
                  label="dias seguidos"
                />
                <MiniStat
                  icon={<BookOpen className="h-4 w-4 text-gold" />}
                  value="8"
                  label="livros no ano"
                />
                <MiniStat
                  icon={<Trophy className="h-4 w-4 text-gold" />}
                  value="1.240"
                  label="XP"
                />
                <MiniStat
                  icon={<Target className="h-4 w-4 text-success" />}
                  value="67%"
                  label="da meta anual"
                />
              </div>
            </div>
            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Últimas {HEAT_WEEKS} semanas</span>
                <span className="flex items-center gap-1">
                  Menos
                  {tone.map((t) => (
                    <span key={t} className={`h-2.5 w-2.5 rounded-[3px] ${t}`} />
                  ))}
                  Mais
                </span>
              </div>
              <div
                className="grid grid-flow-col grid-rows-7 gap-[3px]"
                style={{ gridAutoColumns: "minmax(0, 1fr)" }}
              >
                {HEAT.map((lvl, i) => (
                  <span key={i} className={`aspect-square rounded-[3px] ${tone[lvl]}`} />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
        <div className="order-1 lg:order-2">
          <SectionIntro
            center={false}
            eyebrow="Hábito de leitura"
            title="Leia um pouco todo dia. Veja o quanto isso soma."
            text="Metas diárias e anuais, sequência de dias, XP e conquistas transformam a leitura em hábito — sem pressão, no seu ritmo."
          />
          <Reveal delay={120}>
            <ul className="mt-7 space-y-3 text-sm">
              {[
                "Lembretes gentis no horário que você escolher",
                "Diário para guardar impressões e citações",
                "Desafios mensais e ranking da comunidade",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-success/15 text-success">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/50 p-3">
      <div className="flex items-center gap-1.5">{icon}</div>
      <p className="mt-1.5 font-display text-xl font-medium tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  FAQ + CTA                                                                  */
/* -------------------------------------------------------------------------- */

const FAQ = [
  {
    q: "O BookVerse é gratuito?",
    a: "Sim. Criar conta, ler os clássicos de domínio público, importar seus arquivos e usar metas, diário e desafios não custa nada.",
  },
  {
    q: "Quais livros posso ler?",
    a: "Milhares de obras de domínio público (como Machado de Assis, Jane Austen e Kafka) abrem direto no leitor. Você também pode importar EPUBs e PDFs que já possui.",
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
    a: "A Lumi só recebe o trecho que você seleciona ou o contexto do capítulo atual quando você pede ajuda — nunca o livro inteiro.",
  },
];

function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
      <SectionIntro id="faq" eyebrow="Dúvidas" title="Perguntas frequentes" />
      <Reveal delay={100} className="mt-10">
        <Accordion type="single" collapsible className="surface-card divide-y divide-border px-6">
          {FAQ.map((item, i) => (
            <AccordionItem key={item.q} value={`q${i}`} className="border-0">
              <AccordionTrigger className="py-5 text-left font-display text-lg font-medium hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-3 pb-6 md:px-6">
      <Reveal variant="scale">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1769d8] via-[#1456b8] to-[#0a3f9e] px-6 py-16 text-center text-white md:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgb(255 255 255 / 0.35), transparent 40%), radial-gradient(circle at 80% 90%, rgb(255 200 120 / 0.35), transparent 45%)",
            }}
          />
          <div className="relative">
            <LumiMascot size={84} className="mx-auto" />
            <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-medium leading-tight md:text-5xl">
              Seu próximo livro favorito está a uma página de distância.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-white/80">
              Crie sua conta gratuita e comece agora — leva menos de um minuto.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/auth"
                search={{ redirect: "/" }}
                className="btn-sheen inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-base font-semibold text-[#0a3f9e] shadow-xl transition hover:-translate-y-0.5 sm:w-auto"
              >
                Criar conta grátis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/descobrir"
                search={DISCOVER_SEARCH}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 px-7 py-4 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
              >
                Ver o acervo
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
