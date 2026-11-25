import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BellRing,
  Camera,
  ChevronLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Palette,
  Save,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "firebase/auth";

import { AmbiencePicker } from "@/components/ambience-picker";
import { LumiMascot } from "@/components/lumi-mascot";
import { UserAvatar } from "@/components/user-avatar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { describeFirestoreError } from "@/lib/async-utils";
import { getPrimaryProvider, signOut, updateDisplayName } from "@/lib/firebase";
import { downscaleImageFile } from "@/lib/image-utils";
import { notificationPermission, requestNotificationPermission } from "@/lib/reading-reminder";
import {
  deleteUserData,
  subscribeUserProfile,
  updateProfileFields,
  type UserProfile,
} from "@/lib/user-profile";

export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes — BookVerse" },
      { name: "description", content: "Perfil, aparência, lembretes e segurança da conta." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuardedAjustesPage,
});

function GuardedAjustesPage() {
  const { state, user } = useRequireAuth();
  if (state !== "authenticated" || !user) {
    return (
      <div className="grid min-h-[calc(100vh-8rem)] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      </div>
    );
  }
  return <AjustesPage user={user} />;
}

function formatMemberSince(createdAt: unknown): string | null {
  const date =
    createdAt && typeof createdAt === "object" && "toDate" in createdAt
      ? (createdAt as { toDate: () => Date }).toDate()
      : null;
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date);
}

function AjustesPage({ user }: { user: User }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

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

  useEffect(
    () =>
      subscribeUserProfile(user.uid, (nextProfile) => {
        setProfile(nextProfile);
        setProfileReady(true);
      }),
    [user.uid],
  );

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
  const displayName = profile?.displayName || user.displayName || "Leitor";

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-[max(0.75rem,env(safe-area-inset-top))] lg:pt-10">
      <header className="-mx-1 flex items-center justify-between">
        <Link
          to="/perfil"
          aria-label="Voltar"
          className="press grid h-[42px] w-[42px] place-items-center rounded-full"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </Link>
        <h1 className="font-sans text-base font-bold tracking-normal">Ajustes</h1>
        <span className="w-[42px]" />
      </header>

      {/* Photo */}
      <div className="surface-card mt-3 flex items-center gap-4 p-4">
        <div className="relative shrink-0">
          <UserAvatar
            profile={profile}
            user={user}
            size="lg"
            allowProviderFallback={profileReady}
          />
          <label
            className={`absolute -bottom-1 -right-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-foreground text-background ring-2 ring-card transition hover:scale-105 ${photoSaving ? "pointer-events-none opacity-70" : ""}`}
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
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold">{displayName}</p>
          <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>
          {memberSince && <p className="mt-0.5 text-[12px] text-faint">Desde {memberSince}</p>}
        </div>
        {profile?.customPhotoDataUrl && (
          <button
            type="button"
            onClick={handleRemovePhoto}
            disabled={photoSaving}
            className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-60"
          >
            Remover foto
          </button>
        )}
      </div>

      {/* Edit profile */}
      <section id="configuracoes" className="mt-3 scroll-mt-24 surface-card p-5">
        <h2 className="text-[17px] font-bold">Perfil</h2>

        <form onSubmit={handleSaveProfile} className="mt-5 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-sm text-muted-foreground">Nome de exibição</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-[14px] border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground/40"
            />
          </label>
          <label>
            <span className="text-sm text-muted-foreground">Identificador</span>
            <div className="mt-1.5 flex items-center rounded-[14px] border border-border bg-background px-4 focus-within:border-foreground/40">
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
              className="mt-1.5 w-full resize-y rounded-[14px] border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground/40"
            />
          </label>
          <button
            type="submit"
            disabled={nameSaving}
            className="inline-flex items-center justify-center gap-2 self-end rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
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
      <section id="aparencia" className="mt-3 scroll-mt-24 surface-card p-5">
        <h2 className="flex items-center gap-2 text-[17px] font-bold">
          <Palette className="h-4 w-4 " /> Aparência
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o ambiente de todo o aplicativo. O leitor tem suas próprias opções de tema,
          independentes desta.
        </p>
        <div className="mt-4">
          <AmbiencePicker />
        </div>
      </section>

      {/* Reading reminders */}
      <section className="mt-3 surface-card p-5">
        <h2 className="flex items-center gap-2 text-[17px] font-bold">
          <BellRing className="h-4 w-4 " /> Lembretes de leitura
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
            <p className="text-sm text-success">Ativados — bom te ter por perto. 🦉</p>
          ) : notifSupport === "denied" ? (
            <p className="text-sm text-muted-foreground">
              Bloqueados nas configurações do navegador. Para ativar, libere notificações para este
              site e recarregue a página.
            </p>
          ) : (
            <button
              onClick={handleEnableNotifications}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              <BellRing className="h-3.5 w-3.5" /> Ativar lembretes
            </button>
          )}
        </div>
      </section>

      {/* Security */}
      <section className="mt-3 surface-card p-5">
        <h2 className="flex items-center gap-2 text-[17px] font-bold">
          <KeyRound className="h-4 w-4 " /> Segurança
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
              className="-my-2 inline-flex items-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {showPasswords ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showPasswords ? "Ocultar senhas" : "Mostrar senhas"}
            </button>
            <div>
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {passwordSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Alterar senha
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Danger zone */}
      <section className="mt-3 rounded-[1.6rem] border border-destructive/30 bg-destructive/5 p-5">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-destructive">
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
      <button
        type="button"
        onClick={() => {
          void signOut().then(() => navigate({ to: "/", replace: true }));
        }}
        className="press surface-card mt-3 flex h-[52px] w-full items-center justify-center gap-2 text-[15px] font-semibold"
      >
        <LogOut className="h-[18px] w-[18px]" /> Sair da conta
      </button>
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
