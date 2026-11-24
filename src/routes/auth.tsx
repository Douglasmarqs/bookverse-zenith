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
import { AnimatePresence, motion } from "motion/react";
import { LumiMascot } from "@/components/lumi-mascot";

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

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-5rem)] max-w-6xl grid-cols-1 items-center gap-0 px-5 py-8 md:px-8 lg:grid-cols-[1fr_1fr] lg:gap-14">
      {/* Ex-libris panel */}
      <div className="grain relative hidden self-stretch overflow-hidden rounded-[2rem] border border-border bg-night text-night-foreground lg:grid lg:place-items-center">
        <div
          aria-hidden
          className="lamp-glow lamp-breathe absolute -left-24 -top-40 h-[34rem] w-[34rem]"
        />
        <ExLibris mode={mode} name={name} />
        <p className="absolute bottom-6 text-xs opacity-50">
          {mode === "signup"
            ? "Sua placa ex-libris é criada enquanto você digita."
            : "Sua estante está guardada exatamente onde você deixou."}
        </p>
      </div>

      {/* Form panel */}
      <div className="w-full py-6 lg:py-0">
        <div className="mx-auto w-full max-w-md">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode === "reset" ? "reset" : "auth"}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {mode !== "reset" ? (
                <div className="mb-7 text-center lg:text-left">
                  <p className="eyebrow">{mode === "signup" ? "Criar estante" : "Entrar"}</p>
                  <h1 className="mt-3 font-display text-5xl leading-[0.95] md:text-6xl">
                    {mode === "signup" ? (
                      <>
                        Toda biblioteca começa com{" "}
                        <span className="italic text-gold">um nome.</span>
                      </>
                    ) : (
                      <>
                        Boa leitura, <span className="italic text-gold">de volta.</span>
                      </>
                    )}
                  </h1>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {mode === "signup"
                      ? "Leva menos de um minuto. Seu progresso e seus livros acompanham você em qualquer aparelho."
                      : "Entre para continuar exatamente da página em que parou."}
                  </p>
                </div>
              ) : (
                <div className="mb-7 text-center lg:text-left">
                  <button
                    onClick={() => switchMode("signin")}
                    className="press mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Voltar para entrar
                  </button>
                  <h1 className="font-display text-5xl leading-[0.95]">Redefinir senha</h1>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Informe seu e-mail e enviaremos um link para você criar uma nova senha.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {configMissing && (
            <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <strong>Login indisponível:</strong> a chave do Firebase (
              <code className="font-mono">GOOGLE_API_KEY</code>) não foi configurada neste deploy.
              Nenhuma conta pode ser criada até isso ser resolvido — veja{" "}
              <code className="font-mono">DEPLOY.md</code> no projeto.
            </div>
          )}

          {alreadyAuthed && (
            <div className="mb-4 rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm">
              Você já está conectado.{" "}
              <Link to="/" className="text-gold underline underline-offset-4">
                Ir para o início
              </Link>
              .
            </div>
          )}

          {mode === "reset" ? (
            resetSent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl border border-gold/30 bg-gold/5 px-5 py-7 text-center"
              >
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-gold/15">
                  <Check className="h-5 w-5 text-gold" />
                </span>
                <p className="mt-3 text-sm text-foreground/90">
                  Se houver uma conta com o e-mail <strong>{email}</strong>, enviamos um link de
                  redefinição de senha. Confira também sua caixa de spam.
                </p>
                <button onClick={() => switchMode("signin")} className="btn-primary mt-5 text-sm">
                  Voltar para entrar
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleReset} className="space-y-3">
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
                <button
                  type="submit"
                  disabled={loading !== null || configMissing}
                  className="btn-primary w-full py-3.5 disabled:opacity-60"
                >
                  {loading === "reset" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar link de redefinição
                </button>
              </form>
            )
          ) : (
            <>
              <div
                role="tablist"
                aria-label="Entrar ou criar conta"
                className="mb-5 grid grid-cols-2 rounded-full border border-border bg-card/60 p-1"
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
                    className="press relative rounded-full py-2.5 text-sm font-semibold"
                  >
                    {mode === id && (
                      <motion.span
                        layoutId="auth-tab"
                        className="absolute inset-0 rounded-full bg-gold/15 ring-1 ring-gold/40"
                        transition={{ type: "spring", stiffness: 450, damping: 34 }}
                      />
                    )}
                    <span
                      className={`relative ${mode === id ? "text-gold" : "text-muted-foreground"}`}
                    >
                      {label}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={handleGoogle}
                disabled={loading !== null || configMissing}
                className="btn-ghost w-full py-3.5 text-sm disabled:opacity-60"
              >
                {loading === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Continuar com Google
              </button>

              <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <span className="foil flex-1" />
                ou
                <span className="foil flex-1" />
              </div>

              <form onSubmit={handleEmail} className="space-y-3">
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
                        placeholder="Seu nome na placa"
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
                      className="text-xs text-muted-foreground hover:text-gold"
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
                          <Link to="/termos" className="text-gold underline underline-offset-2">
                            Termos de uso
                          </Link>{" "}
                          e a{" "}
                          <Link
                            to="/privacidade"
                            className="text-gold underline underline-offset-2"
                          >
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

                <button
                  type="submit"
                  disabled={loading !== null || configMissing}
                  className="btn-primary w-full py-3.5 disabled:opacity-60"
                >
                  {loading === "email" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signup" ? "Criar minha estante" : "Entrar"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The bookplate that greets readers — it fills in as they type their name. */
function ExLibris({ mode, name }: { mode: Mode; name: string }) {
  const shown = name.trim() || (mode === "signup" ? "Seu nome" : "Leitor");
  return (
    <motion.div
      initial={{ rotate: -6, y: 20, opacity: 0 }}
      animate={{ rotate: -3, y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 16 }}
      whileHover={{ rotate: 0, scale: 1.02 }}
      className="relative w-[min(22rem,80%)] rounded-md bg-paper p-4 text-paper-ink shadow-[0_50px_90px_-30px_rgb(0_0_0/0.95)]"
    >
      <div className="rounded-[3px] border-[1.5px] border-[#9c6f27] p-2">
        <div className="flex aspect-[3/4] flex-col items-center justify-center gap-4 border border-[#9c6f27]/50 px-4 text-center">
          <LumiMascot size={104} />
          <p className="font-display text-xl tracking-[0.32em] text-[#9c6f27]">EX · LIBRIS</p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={mode === "signup" ? shown : "signin"}
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="max-w-full break-words font-display text-[2.6rem] italic leading-none"
            >
              {mode === "signup" ? shown : "Bem-vindo de volta"}
            </motion.p>
          </AnimatePresence>
          <span className="h-px w-3/5 bg-[#9c6f27]/60" />
          <p className="font-[family-name:var(--font-book)] text-[13px] italic text-[#6b5a3f]">
            “Leio para viver mais de uma vida.”
          </p>
        </div>
      </div>
    </motion.div>
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
    <label className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 px-4 py-3.5 transition focus-within:border-gold/60 focus-within:ring-4 focus-within:ring-gold/10">
      <span className="text-muted-foreground">{icon}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
    <label className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 px-4 py-3.5 transition focus-within:border-gold/60 focus-within:ring-4 focus-within:ring-gold/10">
      <span className="text-muted-foreground">
        <Lock className="h-4 w-4" />
      </span>
      <input
        {...rest}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        onClick={onToggleVisible}
        tabIndex={-1}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        className="text-muted-foreground hover:text-foreground"
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
