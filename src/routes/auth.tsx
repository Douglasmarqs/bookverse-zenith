import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, Lock, User as UserIcon, Loader2, Eye, EyeOff, Check, ArrowLeft } from "lucide-react";
import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  subscribeAuth,
  resetPassword,
  isFirebaseConfigured,
  getFirebaseKeyDebugInfo,
} from "../lib/firebase";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { BookArt } from "@/components/book-art";
import { LogoMark } from "@/components/brand/logo";
import { fauxBookFor } from "@/lib/faux-books";
import { useLastBook } from "@/lib/nav";

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect: string | undefined; modo?: "criar" } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    ...(search.modo === "criar" ? { modo: "criar" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Entrar — BookVerse" },
      {
        name: "description",
        content:
          "Entre na sua conta BookVerse para sincronizar sua biblioteca e progresso em qualquer dispositivo.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const redirectTo = search.redirect || "/";
  const [mode, setMode] = useState<Mode>(search.modo === "criar" ? "signup" : "signin");
  // A brand-new account goes through the short onboarding before the app.
  const justSignedUp = useRef(false);
  // Leave /auth exactly once, however many auth events arrive.
  const leavingRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState<null | "email" | "google" | "reset">(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [invalidKey, setInvalidKey] = useState(false);
  const [alreadyAuthed, setAlreadyAuthed] = useState(false);
  const [configMissing] = useState(() => !isFirebaseConfigured());

  useEffect(() => {
    return subscribeAuth((u) => {
      const authed = !!u && !u.isAnonymous;
      setAlreadyAuthed(authed);
      if (authed && !leavingRef.current) {
        leavingRef.current = true;
        if (justSignedUp.current) {
          navigate({
            to: "/bem-vindo",
            search: { redirect: redirectTo },
            replace: true,
            viewTransition: false,
          });
        } else {
          navigate({ to: redirectTo, replace: true, viewTransition: false });
        }
      }
    });
  }, [navigate, redirectTo, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setFieldError(null);
    setInvalidKey(false);
    setResetSent(false);
  }

  const passwordStrength = useMemo(() => scorePassword(password), [password]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    setInvalidKey(false);

    if (mode === "signup") {
      if (password.length < 6) {
        setFieldError("A senha precisa ter pelo menos 6 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        setFieldError("As senhas não coincidem.");
        return;
      }
      if (!acceptedTerms) {
        setFieldError("Você precisa aceitar os Termos de uso para criar uma conta.");
        return;
      }
    }

    setLoading("email");
    try {
      if (mode === "signup") {
        justSignedUp.current = true;
        await signUpWithEmail(email, password, name);
        router.invalidate();
        navigate({
          to: "/bem-vindo",
          search: { redirect: redirectTo },
          replace: true,
          viewTransition: false,
        });
      } else {
        await signInWithEmail(email, password);
        router.invalidate();
        navigate({ to: redirectTo, replace: true, viewTransition: false });
      }
    } catch (err: unknown) {
      justSignedUp.current = false;
      setError(friendlyError(err));
      setInvalidKey(isInvalidKeyError(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setFieldError(null);
    setInvalidKey(false);
    setLoading("google");
    try {
      await signInWithGoogle();
      router.invalidate();
      navigate({ to: redirectTo, replace: true, viewTransition: false });
    } catch (err: unknown) {
      setError(friendlyError(err));
      setInvalidKey(isInvalidKeyError(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (!email.trim()) {
      setFieldError("Informe seu e-mail para receber o link de redefinição.");
      return;
    }
    setLoading("reset");
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(null);
    }
  }

  const lastBook = useLastBook();
  const [stage, setStage] = useState<"choose" | "email">(
    search.modo === "criar" ? "email" : "choose",
  );
  const pct = lastBook?.progress ? Math.round(lastBook.progress * 100) : 0;

  function skip() {
    if (lastBook?.id) navigate({ to: "/reader/$bookId", params: { bookId: lastBook.id } });
    else navigate({ to: search.redirect || "/descobrir", replace: true });
  }

  const heading =
    mode === "reset"
      ? "Redefinir senha"
      : stage === "email"
        ? mode === "signup"
          ? "Crie sua estante"
          : "Bom te ver de novo"
        : pct > 0
          ? "Guarde seu progresso"
          : "Sua estante em todo lugar";

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background lg:grid lg:grid-cols-[1.1fr_1fr]">
      <CoverWall />

      <div className="relative z-[1] -mt-10 flex flex-1 flex-col lg:mt-0 lg:items-center lg:justify-center lg:px-10">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-1 flex-col rounded-t-[34px] bg-card px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_50px_-30px_rgba(0,0,0,.35)] lg:w-full lg:max-w-md lg:flex-none lg:rounded-[34px] lg:pb-8 lg:pt-8 lg:shadow-[0_30px_80px_-40px_rgba(0,0,0,.4)]"
        >
          <div className="mx-auto h-[5px] w-10 rounded-full bg-border lg:hidden" />
          <div className="mx-auto w-full max-w-md">
            <div className="mt-5 flex items-center justify-between">
              <LogoMark size={40} />
              {(stage === "email" || mode === "reset") && (
                <button
                  type="button"
                  onClick={() => {
                    if (mode === "reset") switchMode("signin");
                    else setStage("choose");
                  }}
                  className="press inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[13.5px] font-semibold text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
              )}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={heading}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 className="mt-4 font-display text-[31px] leading-[1.05] tracking-[-0.035em] sm:text-[36px]">
                  {heading}
                </h1>
                <p className="mt-2.5 text-[16px] leading-relaxed text-muted-foreground">
                  {mode === "reset" ? (
                    "Informe seu e-mail e enviaremos um link para criar uma nova senha."
                  ) : stage === "email" ? (
                    mode === "signup" ? (
                      "Leva menos de um minuto. Seus livros e seu progresso vão junto para qualquer aparelho."
                    ) : (
                      "Entre para continuar exatamente da página em que parou."
                    )
                  ) : pct > 0 && lastBook?.title ? (
                    <>
                      Você leu {pct}% de{" "}
                      <b className="font-semibold text-foreground">{lastBook.title}</b> sem conta.
                      Entre para continuar de onde parou em qualquer aparelho.
                    </>
                  ) : (
                    "Entre para guardar livros, progresso, metas e sequência — no celular e no computador."
                  )}
                </p>
              </motion.div>
            </AnimatePresence>

            {configMissing && (
              <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <strong>Login indisponível:</strong> a chave do Firebase (
                <code className="font-mono">GOOGLE_API_KEY</code>) não foi configurada neste deploy.
                Veja <code className="font-mono">DEPLOY.md</code> no projeto.
              </div>
            )}
            {alreadyAuthed && (
              <div className="mt-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
                Você já está conectado.{" "}
                <Link to="/" className="font-semibold text-gold">
                  Ir para o início
                </Link>
              </div>
            )}

            {mode === "reset" ? (
              resetSent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 rounded-[24px] bg-mint px-5 py-6 text-center text-[#1f4d35]"
                >
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/70">
                    <Check className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm">
                    Se houver uma conta com <strong>{email}</strong>, enviamos o link. Confira
                    também o spam.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="press mt-4 h-11 rounded-full bg-foreground px-5 text-sm font-semibold text-background"
                  >
                    Voltar para entrar
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleReset} className="mt-6 space-y-3">
                  <Field
                    icon={<Mail className="h-4 w-4" />}
                    type="email"
                    placeholder="E-mail"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                    required
                  />
                  {fieldError && <ErrorBox>{fieldError}</ErrorBox>}
                  {error && <ErrorBox>{error}</ErrorBox>}
                  <PrimaryButton
                    disabled={loading !== null || configMissing}
                    busy={loading === "reset"}
                  >
                    Enviar link de redefinição
                  </PrimaryButton>
                </form>
              )
            ) : stage === "choose" ? (
              <div className="mt-7 space-y-3">
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading !== null || configMissing}
                  className="press flex h-[56px] w-full items-center justify-center gap-3 rounded-full bg-foreground text-[16.5px] font-semibold text-background disabled:opacity-60"
                >
                  {loading === "google" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white">
                      <GoogleIcon />
                    </span>
                  )}
                  Continuar com Google
                </button>
                <button
                  type="button"
                  onClick={() => setStage("email")}
                  className="press flex h-[56px] w-full items-center justify-center gap-3 rounded-full bg-card text-[16.5px] font-semibold shadow-[inset_0_0_0_1.5px_var(--border)]"
                >
                  <Mail className="h-5 w-5" strokeWidth={2} /> Continuar com e-mail
                </button>
                {error && <ErrorBox>{error}</ErrorBox>}
                {invalidKey && <KeyDebugBox />}
              </div>
            ) : (
              <>
                <div
                  role="tablist"
                  aria-label="Entrar ou criar conta"
                  className="mt-6 grid grid-cols-2 rounded-[16px] bg-surface-2 p-1"
                >
                  {(
                    [
                      ["signin", "Entrar"],
                      ["signup", "Criar conta"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={mode === id}
                      onClick={() => switchMode(id)}
                      className="press relative rounded-[12px] py-2.5 text-sm font-semibold"
                    >
                      {mode === id && (
                        <motion.span
                          layoutId="auth-tab"
                          className="absolute inset-0 rounded-[12px] bg-card shadow-[0_2px_8px_rgba(0,0,0,.07)]"
                          transition={{ type: "spring", stiffness: 450, damping: 34 }}
                        />
                      )}
                      <span className={`relative ${mode === id ? "" : "text-muted-foreground"}`}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
                <form onSubmit={handleEmail} className="mt-4 space-y-3">
                  <AnimatePresence initial={false}>
                    {mode === "signup" && (
                      <motion.div
                        key="name"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <Field
                          icon={<UserIcon className="h-4 w-4" />}
                          type="text"
                          placeholder="Seu nome"
                          value={name}
                          onChange={setName}
                          autoComplete="name"
                          maxLength={40}
                          required
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <Field
                    icon={<Mail className="h-4 w-4" />}
                    type="email"
                    placeholder="E-mail"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                    required
                  />
                  <PasswordField
                    placeholder="Senha"
                    value={password}
                    onChange={setPassword}
                    visible={showPassword}
                    onToggleVisible={() => setShowPassword((v) => !v)}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={6}
                  />
                  {mode === "signin" && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => switchMode("reset")}
                        className="-my-2 py-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {mode === "signup" && (
                      <motion.div
                        key="signup-extra"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-3 overflow-hidden"
                      >
                        {password.length > 0 && <PasswordStrengthMeter score={passwordStrength} />}
                        <PasswordField
                          placeholder="Confirme a senha"
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                          visible={showPassword}
                          onToggleVisible={() => setShowPassword((v) => !v)}
                          autoComplete="new-password"
                          required
                          minLength={6}
                        />
                        <label className="flex items-start gap-2.5 pt-1 text-xs leading-relaxed text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                            style={{ accentColor: "var(--gold)" }}
                          />
                          <span>
                            Li e aceito os{" "}
                            <Link to="/termos" className="underline underline-offset-2">
                              Termos de uso
                            </Link>{" "}
                            e a{" "}
                            <Link to="/privacidade" className="underline underline-offset-2">
                              Política de privacidade
                            </Link>
                            .
                          </span>
                        </label>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {fieldError && <ErrorBox>{fieldError}</ErrorBox>}
                  {error && <ErrorBox>{error}</ErrorBox>}
                  {invalidKey && <KeyDebugBox />}
                  <PrimaryButton
                    disabled={loading !== null || configMissing}
                    busy={loading === "email"}
                  >
                    {mode === "signup" ? "Criar minha conta" : "Entrar"}
                  </PrimaryButton>
                </form>
              </>
            )}

            <button
              type="button"
              onClick={skip}
              className="mx-auto mt-6 block py-2 text-[16px] font-semibold"
            >
              Agora não <span className="font-normal text-faint">· continuar lendo</span>
            </button>
            <p className="mt-3 text-center text-[13px] leading-relaxed text-faint">
              Ao continuar você aceita os{" "}
              <Link to="/termos" className="underline underline-offset-2">
                Termos
              </Link>{" "}
              e a{" "}
              <Link to="/privacidade" className="underline underline-offset-2">
                Política de privacidade
              </Link>
              .
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  busy,
}: {
  children: React.ReactNode;
  disabled: boolean;
  busy: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="press flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-foreground text-[16px] font-semibold text-background disabled:opacity-60"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

const WALL = [
  ["O Grande Gatsby", "Iracema", "Dom Casmurro", "Frankenstein", "Alice no País das Maravilhas"],
  ["Os Sertões", "Contos Fluminenses", "Senhora", "Dom Quixote", "O Alienista"],
  [
    "A Metamorfose",
    "Orgulho e Preconceito",
    "O Cortiço",
    "A Moreninha",
    "Memórias Póstumas de Brás Cubas",
  ],
];

/** A tilted wall of classic covers that drifts slowly. */
function CoverWall() {
  const reduce = useReducedMotion();
  return (
    <div
      aria-hidden
      className="relative h-[min(44dvh,400px)] shrink-0 overflow-hidden lg:sticky lg:top-0 lg:h-[100dvh]"
    >
      <div className="absolute left-1/2 top-1/2 flex w-[150%] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] flex-col gap-4 lg:w-[130%] lg:gap-7">
        {WALL.map((row, r) => (
          <motion.div
            key={r}
            className="flex gap-4 lg:gap-7"
            initial={{ x: r % 2 ? -60 : 0 }}
            animate={reduce ? undefined : { x: r % 2 ? [-60, 0, -60] : [0, -60, 0] }}
            transition={{ duration: 26 + r * 4, repeat: Infinity, ease: "easeInOut" }}
          >
            {[...row, ...row].map((t, i) => {
              const b = fauxBookFor(t);
              return (
                <div key={i} className="w-[104px] shrink-0 lg:w-[190px]">
                  <BookArt title={b.title} author={b.author} />
                </div>
              );
            })}
          </motion.div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background/60 lg:hidden" />
    </div>
  );
}

function Field({
  icon,
  value,
  onChange,
  ...rest
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="flex items-center gap-3 rounded-[16px] bg-surface-2 px-4 py-3 transition focus-within:ring-2 focus-within:ring-foreground/20">
      <span className="text-muted-foreground">{icon}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent py-1 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
      />
    </label>
  );
}

function PasswordField({
  value,
  onChange,
  visible,
  onToggleVisible,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type">) {
  return (
    <label className="flex items-center gap-3 rounded-[16px] bg-surface-2 px-4 py-2 transition focus-within:ring-2 focus-within:ring-foreground/20">
      <span className="text-muted-foreground">
        <Lock className="h-4 w-4" />
      </span>
      <input
        {...rest}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent py-1 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
      />
      <button
        type="button"
        onClick={onToggleVisible}
        tabIndex={-1}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </label>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

/** 0–4 heuristic password strength score. Not a security measure — just a
 * lightweight nudge toward a stronger password. */
function scorePassword(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1;
  return score;
}

function PasswordStrengthMeter({ score }: { score: number }) {
  const labels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];
  const colors = ["bg-destructive", "bg-destructive", "bg-gold-soft", "bg-gold", "bg-gold"];
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : "bg-secondary"
            }`}
          />
        ))}
      </div>
      <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground">
        {labels[score]}
      </span>
    </div>
  );
}

function KeyDebugBox() {
  const info = getFirebaseKeyDebugInfo();
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
      <p className="font-semibold">Diagnóstico da chave configurada neste build:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        <li>
          Valor (mascarado): <code className="font-mono">{info.masked}</code>
        </li>
        <li>Comprimento: {info.length} caracteres (a Web API Key do Firebase costuma ter 39)</li>
        <li>Espaço/quebra de linha sobrando: {info.hasWhitespace ? "SIM ⚠️" : "não"}</li>
        <li>Aspas incluídas no valor: {info.hasQuotes ? "SIM ⚠️" : "não"}</li>
      </ul>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}

function isInvalidKeyError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? "";
  return (
    code === "auth/invalid-api-key" ||
    code === "auth/api-key-not-valid.-please-pass-a-valid-api-key."
  );
}

function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const message = (err as { message?: string })?.message ?? "";
  if (!code && message.includes("Firebase not initialized")) {
    return "O login está indisponível neste deploy (Firebase não configurado). Avise quem administra o projeto.";
  }
  const map: Record<string, string> = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/email-already-in-use": "Este e-mail já está em uso.",
    "auth/weak-password": "Escolha uma senha com pelo menos 6 caracteres.",
    "auth/popup-closed-by-user": "Janela fechada antes de concluir.",
    "auth/popup-blocked": "Pop-up bloqueado pelo navegador.",
    "auth/network-request-failed": "Falha de rede. Tente novamente.",
    "auth/unauthorized-domain":
      "Este domínio não está autorizado no Firebase Auth (adicione-o em Authentication → Settings → Authorized domains).",
    "auth/operation-not-allowed":
      "O provedor de login (Google ou E-mail/Senha) não está habilitado no Firebase Console.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      "A chave de API do Firebase configurada é inválida.",
    "auth/invalid-api-key": "A chave de API do Firebase configurada é inválida.",
    "auth/configuration-not-found":
      "A configuração de Authentication não foi encontrada — confirme se o Authentication está ativado no Firebase Console.",
    "auth/admin-restricted-operation":
      "Login anônimo/automático está desabilitado no Firebase Console.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde um momento e tente novamente.",
  };
  if (map[code]) return map[code];
  // Unrecognized code — show it raw instead of a generic message, so
  // whoever's debugging (you, or me if you send a screenshot) can see
  // exactly what Firebase actually said instead of guessing blind.
  return code
    ? `Não foi possível concluir (${code}). Tente novamente.`
    : "Não foi possível concluir. Tente novamente.";
}
