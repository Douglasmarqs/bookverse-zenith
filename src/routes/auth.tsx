import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Mail,
  Lock,
  User as UserIcon,
  Loader2,
  Eye,
  EyeOff,
  Check,
  ArrowLeft,
  Sparkles,
  Library,
  Trophy,
} from "lucide-react";
import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  subscribeAuth,
  resetPassword,
  isFirebaseConfigured,
  getFirebaseKeyDebugInfo,
} from "../lib/firebase";
import heroImg from "@/assets/hero-library.jpg";
import owl from "@/assets/owl-mascot.png";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
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

const BENEFITS = [
  { icon: Library, text: "Sua biblioteca e progresso sincronizados em qualquer dispositivo" },
  { icon: Sparkles, text: "Lumi, sua companhia de leitura com IA, dentro de cada livro" },
  { icon: Trophy, text: "XP, metas e ranking para transformar leitura em hábito" },
];

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const redirectTo = search.redirect || "/";
  const [mode, setMode] = useState<Mode>("signin");

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
      if (authed) {
        router.invalidate();
        navigate({ to: redirectTo, replace: true });
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
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
      router.invalidate();
      navigate({ to: redirectTo, replace: true });
    } catch (err: unknown) {
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
      navigate({ to: redirectTo, replace: true });
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
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl grid-cols-1 items-center gap-0 px-5 py-10 md:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
      {/* Branding panel — hidden on small screens */}
      <div className="glass-plate relative hidden overflow-hidden rounded-3xl p-10 lg:flex lg:flex-col lg:justify-between lg:self-stretch">
        <div className="pointer-events-none absolute inset-0">
          <img src={heroImg} alt="" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
        </div>
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/10 ring-1 ring-gold/40">
              <BookOpen className="h-4 w-4 text-gold" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">
              Book<span className="text-gold">verse</span>
            </span>
          </Link>

          <h2 className="mt-14 max-w-sm font-display text-4xl font-medium leading-tight">
            Toda leitura merece um <span className="text-gradient-gold italic">santuário</span>.
          </h2>

          <ul className="mt-10 space-y-4">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-foreground/85">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/10 ring-1 ring-gold/30">
                  <Icon className="h-3.5 w-3.5 text-gold" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-4">
          <img src={owl} alt="" className="h-16 w-16" />
          <p className="max-w-[220px] text-xs leading-relaxed text-muted-foreground">
            "Estou aqui pra ler junto com você." — Lumi, a coruja da BookVerse
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="w-full py-8 lg:py-0">
        <div className="mx-auto w-full max-w-md">
          {mode !== "reset" ? (
            <div className="mb-8 text-center lg:text-left">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold/10 ring-1 ring-gold/40 lg:mx-0">
                <BookOpen className="h-5 w-5 text-gold" />
              </span>
              <h1 className="mt-4 font-display text-3xl font-semibold">
                {mode === "signup" ? "Crie sua conta" : "Bem-vindo de volta"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "signup"
                  ? "Leva menos de um minuto — guarde seu progresso e biblioteca em qualquer dispositivo."
                  : "Entre para sincronizar sua leitura entre dispositivos."}
              </p>
            </div>
          ) : (
            <div className="mb-8 text-center lg:text-left">
              <button
                onClick={() => switchMode("signin")}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar para entrar
              </button>
              <h1 className="font-display text-3xl font-semibold">Redefinir senha</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Informe seu e-mail e enviaremos um link para você criar uma nova senha.
              </p>
            </div>
          )}

          {configMissing && (
            <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <strong>Login indisponível:</strong> a chave do Firebase (
              <code className="font-mono">GOOGLE_API_KEY</code>) não foi configurada neste deploy.
              Nenhuma conta pode ser criada até isso ser resolvido — veja{" "}
              <code className="font-mono">DEPLOY.md</code> no projeto.
            </div>
          )}

          {alreadyAuthed && (
            <div className="mb-4 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm">
              Você já está autenticado.{" "}
              <Link to="/" className="text-gold underline underline-offset-4">
                Voltar à biblioteca
              </Link>
              .
            </div>
          )}

          {mode === "reset" ? (
            resetSent ? (
              <div className="rounded-2xl border border-gold/30 bg-gold/5 px-5 py-6 text-center">
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-gold/15">
                  <Check className="h-5 w-5 text-gold" />
                </span>
                <p className="mt-3 text-sm text-foreground/90">
                  Se houver uma conta com o e-mail <strong>{email}</strong>, enviamos um link de
                  redefinição de senha. Confira também sua caixa de spam.
                </p>
                <button
                  onClick={() => switchMode("signin")}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  Voltar para entrar
                </button>
              </div>
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
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                >
                  {loading === "reset" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar link de redefinição
                </button>
              </form>
            )
          ) : (
            <>
              <button
                onClick={handleGoogle}
                disabled={loading !== null || configMissing}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium transition hover:border-gold/40 hover:bg-secondary/50 disabled:opacity-60"
              >
                {loading === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Continuar com Google
              </button>

              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleEmail} className="space-y-3">
                {mode === "signup" && (
                  <Field
                    icon={<UserIcon className="h-4 w-4" />}
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={setName}
                    autoComplete="name"
                    required
                  />
                )}
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

                {mode === "signup" && (
                  <>
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
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border accent-[var(--color-gold)]"
                      />
                      <span>
                        Li e aceito os{" "}
                        <Link to="/termos" className="text-gold underline underline-offset-2">
                          Termos de uso
                        </Link>{" "}
                        e a{" "}
                        <Link to="/privacidade" className="text-gold underline underline-offset-2">
                          Política de privacidade
                        </Link>
                        .
                      </span>
                    </label>
                  </>
                )}

                {fieldError && <ErrorBox>{fieldError}</ErrorBox>}
                {error && <ErrorBox>{error}</ErrorBox>}
                {invalidKey && <KeyDebugBox />}

                <button
                  type="submit"
                  disabled={loading !== null || configMissing}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                >
                  {loading === "email" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signup" ? "Criar conta" : "Entrar"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signup" ? "Já tem uma conta?" : "Não tem conta?"}{" "}
                <button
                  onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
                  className="text-gold underline underline-offset-4"
                >
                  {mode === "signup" ? "Entrar" : "Criar agora"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
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
    <label className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-4 py-3 focus-within:border-gold/60">
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
    <label className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-4 py-3 focus-within:border-gold/60">
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
  return map[code] ?? "Não foi possível concluir. Tente novamente.";
}
