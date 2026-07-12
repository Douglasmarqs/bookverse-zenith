import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  subscribeAuth,
  isFirebaseConfigured,
} from "../lib/firebase";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — BookVerse" },
      {
        name: "description",
        content: "Entre na sua conta BookVerse para sincronizar sua biblioteca e progresso em qualquer dispositivo.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const redirectTo = search.redirect || "/";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState<null | "email" | "google">(null);
  const [error, setError] = useState<string | null>(null);
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

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading("google");
    try {
      await signInWithGoogle();
      router.invalidate();
      navigate({ to: redirectTo, replace: true });
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-md place-items-center px-5 py-12">
      <div className="w-full">
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold/10 ring-1 ring-gold/40">
            <BookOpen className="h-5 w-5 text-gold" />
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold">
            {mode === "signup" ? "Crie sua conta" : "Bem-vindo de volta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Guarde seu progresso e biblioteca em qualquer dispositivo."
              : "Entre para sincronizar sua leitura entre dispositivos."}
          </p>
        </div>

        {configMissing && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>Login indisponível:</strong> a chave do Firebase (
            <code className="font-mono">GOOGLE_API_KEY</code>) não foi configurada neste
            deploy. Nenhuma conta pode ser criada até isso ser resolvido — veja{" "}
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
          <Field
            icon={<Lock className="h-4 w-4" />}
            type="password"
            placeholder="Senha"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={6}
          />

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

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
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
            }}
            className="text-gold underline underline-offset-4"
          >
            {mode === "signup" ? "Entrar" : "Criar agora"}
          </button>
        </p>
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
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
  };
  return map[code] ?? "Não foi possível concluir. Tente novamente.";
}
