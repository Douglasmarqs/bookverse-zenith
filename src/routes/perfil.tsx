import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Loader2,
  Save,
  KeyRound,
  ShieldAlert,
  Trophy,
  BookMarked,
  Library,
  Eye,
  EyeOff,
  Flame,
  Palette,
  Camera,
  X,
  BellRing,
  BookOpenCheck,
  Clock3,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "firebase/auth";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { getPrimaryProvider, updateDisplayName } from "@/lib/firebase";
import {
  deleteUserData,
  subscribeUserProfile,
  updateProfileFields,
  type UserProfile,
} from "@/lib/user-profile";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";
import { getLevelInfo } from "@/lib/achievements";
import { describeFirestoreError } from "@/lib/async-utils";
import { UserAvatar } from "@/components/user-avatar";
import { LumiMascot } from "@/components/lumi-mascot";
import { downscaleImageFile } from "@/lib/image-utils";
import { notificationPermission, requestNotificationPermission } from "@/lib/reading-reminder";
import { useSiteTheme } from "@/hooks/use-site-theme";
import { THEME_LABEL, THEME_PREVIEW, allThemes } from "@/lib/theme";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — BookVerse" },
      { name: "description", content: "Gerencie seu perfil, avatar e configurações de conta." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuardedPerfilPage,
});

function GuardedPerfilPage() {
  const { state, user } = useRequireAuth();
  if (state !== "authenticated" || !user) {
    return (
      <div className="grid min-h-[calc(100vh-8rem)] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      </div>
    );
  }
  return <PerfilPage user={user} />;
}

function formatMemberSince(createdAt: unknown): string | null {
  const date =
    createdAt && typeof createdAt === "object" && "toDate" in createdAt
      ? (createdAt as { toDate: () => Date }).toDate()
      : null;
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date);
}

function PerfilPage({ user }: { user: User }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [notifSupport, setNotifSupport] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  useEffect(() => {
    setNotifSupport(notificationPermission());
  }, []);

  async function handleEnableNotifications() {
    const result = await requestNotificationPermission();
    setNotifSupport(result);
    if (result === "granted") {
      toast.success("Lembretes ativados — a Lumi vai te dar um toque quando precisar.");
    } else if (result === "denied") {
      toast.error(
        "Notificações bloqueadas. Você pode ativar depois nas configurações do navegador.",
      );
    }
  }

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const provider = getPrimaryProvider(user);
  const [siteTheme, setSiteTheme] = useSiteTheme();

  useEffect(
    () =>
      subscribeUserProfile(user.uid, (nextProfile) => {
        setProfile(nextProfile);
        setProfileReady(true);
      }),
    [user.uid],
  );
  useEffect(() => subscribeLibrary(user.uid, setLibrary), [user.uid]);

  useEffect(() => {
    if (profile?.displayName) setName(profile.displayName);
    else if (user.displayName) setName(user.displayName);
    setUsername(profile?.username ?? "");
    setBio(profile?.bio ?? "");
  }, [profile?.displayName, profile?.username, profile?.bio, user.displayName]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("O nome não pode ficar em branco.");
      return;
    }
    const normalizedUsername = username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "");
    if (username.trim() && normalizedUsername.length < 3) {
      toast.error("O identificador precisa ter pelo menos 3 caracteres.");
      return;
    }
    if (bio.trim().length > 280) {
      toast.error("A bio pode ter até 280 caracteres.");
      return;
    }
    setNameSaving(true);
    try {
      await updateDisplayName(trimmed);
      await updateProfileFields(user.uid, {
        displayName: trimmed,
        username: normalizedUsername || null,
        bio: bio.trim() || null,
      });
      toast.success("Perfil atualizado.");
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar o nome agora."));
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    setPhotoSaving(true);
    try {
      // 320px is plenty for a circular avatar even on a retina display,
      // and keeps the encoded JPEG comfortably under Firestore's 1MB
      // per-document limit (typically 15–50KB at this size).
      const dataUrl = await downscaleImageFile(file, 320, 0.85);
      await updateProfileFields(user.uid, { customPhotoDataUrl: dataUrl });
      toast.success("Foto de perfil atualizada.");
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar a foto agora."));
    } finally {
      setPhotoSaving(false);
    }
  }

  async function handleRemovePhoto() {
    setPhotoSaving(true);
    try {
      await updateProfileFields(user.uid, { customPhotoDataUrl: null });
      toast.success("Foto removida.");
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível remover a foto agora."));
    } finally {
      setPhotoSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setPasswordSaving(true);
    try {
      const { changePassword } = await import("@/lib/firebase-account");
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada com sucesso.");
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        toast.error("Senha atual incorreta.");
      } else {
        toast.error(describeFirestoreError(err, "Não foi possível alterar a senha agora."));
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText.trim().toUpperCase() !== "EXCLUIR") {
      toast.error('Digite "EXCLUIR" para confirmar.');
      return;
    }
    setDeleting(true);
    try {
      await deleteUserData(user.uid);
      const { deleteAccount } = await import("@/lib/firebase-account");
      await deleteAccount(provider === "password" ? deletePassword : undefined);
      toast.success("Conta excluída.");
      navigate({ to: "/", replace: true });
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        toast.error("Senha incorreta.");
      } else {
        toast.error(describeFirestoreError(err, "Não foi possível excluir a conta agora."));
      }
      setDeleting(false);
    }
  }

  const memberSince = formatMemberSince(profile?.createdAt);

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Minha conta</p>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Meu perfil</h1>

      {/* Summary header */}
      <div className="mt-8 flex flex-wrap items-center gap-5 rounded-2xl border border-border/60 bg-card/40 p-6">
        <div className="group relative shrink-0">
          <UserAvatar
            profile={profile}
            user={user}
            size="lg"
            allowProviderFallback={profileReady}
          />
          <label
            className={`absolute -bottom-1 -right-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-gold text-primary-foreground ring-2 ring-background transition hover:scale-105 ${photoSaving ? "pointer-events-none opacity-70" : ""}`}
            title="Trocar foto de perfil"
          >
            {photoSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handlePhotoSelected}
              disabled={photoSaving}
            />
          </label>
          {profile?.customPhotoDataUrl && (
            <button
              onClick={handleRemovePhoto}
              disabled={photoSaving}
              title="Remover foto"
              className="absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-secondary text-foreground ring-2 ring-background transition hover:bg-destructive/80 hover:text-destructive-foreground disabled:opacity-60"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-medium">
            {profile?.displayName || user.displayName || "Leitor"}
          </p>
          {profile?.username && <p className="mt-0.5 text-sm text-gold">@{profile.username}</p>}
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          {profile?.bio && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {profile.bio}
            </p>
          )}
          {memberSince && (
            <p className="mt-1 text-xs text-muted-foreground">Membro desde {memberSince}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <StatCard
          icon={Trophy}
          label={`Nível ${getLevelInfo(profile?.xp ?? 0).level}`}
          value={profile?.xp ?? 0}
          suffix=" XP"
        />
        <StatCard
          icon={Flame}
          label="Sequência"
          value={profile?.currentStreak ?? 0}
          suffix=" dias"
        />
        <StatCard
          icon={BookMarked}
          label="Livros concluídos"
          value={profile?.booksCompleted ?? 0}
        />
        <StatCard icon={Library} label="Na biblioteca" value={library.length} />
        <StatCard icon={BookOpenCheck} label="Capítulos lidos" value={profile?.chaptersRead ?? 0} />
        <StatCard
          icon={Clock3}
          label="Tempo de leitura"
          value={profile?.readingMinutes ?? 0}
          suffix=" min"
        />
        <StatCard
          icon={Heart}
          label="Favoritos"
          value={library.filter((entry) => entry.favorite).length}
        />
      </div>
      <section className="mt-4 grid gap-3 rounded-2xl border border-border/60 bg-card/35 p-5 sm:grid-cols-3">
        <ReadingRecap label="XP nesta semana" value={profile?.weeklyXp ?? 0} suffix=" XP" />
        <ReadingRecap label="Capítulos neste mês" value={profile?.monthlyChaptersRead ?? 0} />
        <ReadingRecap
          label="Minutos neste mês"
          value={profile?.monthlyReadingMinutes ?? 0}
          suffix=" min"
        />
      </section>
      <Link
        to="/desafios"
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-gold underline underline-offset-4"
      >
        Ver conquistas e missões
      </Link>

      {/* Edit profile */}
      <section className="mt-10 rounded-2xl border border-border/60 bg-card/40 p-6">
        <h2 className="font-display text-xl font-medium">Editar perfil</h2>

        <form onSubmit={handleSaveProfile} className="mt-5 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-sm text-muted-foreground">Nome de exibição</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm outline-none focus:border-gold/60"
            />
          </label>
          <label>
            <span className="text-sm text-muted-foreground">Identificador</span>
            <div className="mt-1.5 flex items-center rounded-xl border border-border bg-background/50 px-4 focus-within:border-gold/60">
              <span className="text-sm text-muted-foreground">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={32}
                placeholder="seu_nome"
                className="min-w-0 flex-1 bg-transparent py-3 pl-1 text-sm outline-none"
              />
            </div>
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm text-muted-foreground">
              Bio <span className="text-xs">({bio.length}/280)</span>
            </span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Conte brevemente o que você gosta de ler."
              className="mt-1.5 w-full resize-y rounded-xl border border-border bg-background/50 px-4 py-3 text-sm outline-none focus:border-gold/60"
            />
          </label>
          <button
            type="submit"
            disabled={nameSaving}
            className="inline-flex items-center justify-center gap-2 self-end rounded-full bg-gold px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
          >
            {nameSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </button>
        </form>
      </section>

      {/* Appearance */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-medium">
          <Palette className="h-4 w-4 text-gold" /> Aparência
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o tema de todo o aplicativo. O leitor tem suas próprias opções de tema,
          independentes desta.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {allThemes().map((t) => (
            <button
              key={t}
              onClick={() => setSiteTheme(t)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                siteTheme === t
                  ? "border-gold ring-1 ring-gold"
                  : "border-border/60 hover:border-gold/40"
              }`}
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-semibold ring-1 ring-black/10"
                style={{ background: THEME_PREVIEW[t].bg, color: THEME_PREVIEW[t].fg }}
              >
                Aa
              </span>
              <span className="text-xs font-medium">{THEME_LABEL[t]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Reading reminders */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-medium">
          <BellRing className="h-4 w-4 text-gold" /> Lembretes de leitura
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A Lumi te avisa, no máximo uma vez por dia e só enquanto o app estiver aberto, se você
          ainda não leu nada hoje.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <LumiMascot size={40} blink={false} />
          {notifSupport === "unsupported" ? (
            <p className="text-sm text-muted-foreground">Seu navegador não aceita notificações.</p>
          ) : notifSupport === "granted" ? (
            <p className="text-sm text-emerald-500">Ativados — bom te ter por perto. 🦉</p>
          ) : notifSupport === "denied" ? (
            <p className="text-sm text-muted-foreground">
              Bloqueados nas configurações do navegador. Para ativar, libere notificações para este
              site e recarregue a página.
            </p>
          ) : (
            <button
              onClick={handleEnableNotifications}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <BellRing className="h-3.5 w-3.5" /> Ativar lembretes
            </button>
          )}
        </div>
      </section>

      {/* Security */}
      <section className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-medium">
          <KeyRound className="h-4 w-4 text-gold" /> Segurança
        </h2>

        {provider === "google.com" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Você entra com sua conta Google — a senha é gerenciada diretamente pelo Google.
          </p>
        ) : (
          <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <PasswordInput
                placeholder="Senha atual"
                value={currentPassword}
                onChange={setCurrentPassword}
                visible={showPasswords}
                autoComplete="current-password"
              />
              <div />
              <PasswordInput
                placeholder="Nova senha"
                value={newPassword}
                onChange={setNewPassword}
                visible={showPasswords}
                autoComplete="new-password"
              />
              <PasswordInput
                placeholder="Confirme a nova senha"
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={showPasswords}
                autoComplete="new-password"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowPasswords((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {showPasswords ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showPasswords ? "Ocultar senhas" : "Mostrar senhas"}
            </button>
            <div>
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-5 py-2.5 text-sm font-medium text-gold hover:bg-gold/10 disabled:opacity-60"
              >
                {passwordSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Alterar senha
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Danger zone */}
      <section className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-medium text-destructive">
          <ShieldAlert className="h-4 w-4" /> Zona de perigo
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Excluir sua conta remove permanentemente seu perfil, biblioteca e progresso de leitura.
          Essa ação não pode ser desfeita.
        </p>

        {!deleteOpen ? (
          <button
            onClick={() => setDeleteOpen(true)}
            className="mt-4 rounded-full border border-destructive/40 px-5 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Excluir minha conta
          </button>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-destructive/30 bg-background/40 p-4">
            {provider === "password" && (
              <PasswordInput
                placeholder="Confirme sua senha"
                value={deletePassword}
                onChange={setDeletePassword}
                visible={showPasswords}
                autoComplete="current-password"
              />
            )}
            <label className="block">
              <span className="text-sm text-muted-foreground">
                Digite <strong>EXCLUIR</strong> para confirmar
              </span>
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-destructive/40 bg-background/50 px-4 py-3 text-sm outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar exclusão
              </button>
              <button
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmText("");
                  setDeletePassword("");
                }}
                disabled={deleting}
                className="rounded-full border border-border/60 px-5 py-2.5 text-sm hover:bg-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link to="/biblioteca" className="text-gold underline underline-offset-4">
          Voltar à minha biblioteca
        </Link>
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
      <Icon className="h-5 w-5 text-gold" />
      <p className="mt-3 font-display text-3xl font-medium">
        {value}
        {suffix && <span className="text-base text-muted-foreground">{suffix}</span>}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function ReadingRecap({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium tabular-nums">
        {value.toLocaleString("pt-BR")}
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  visible,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <input
      type={visible ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm outline-none focus:border-gold/60"
    />
  );
}
