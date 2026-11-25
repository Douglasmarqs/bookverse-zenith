import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BellRing,
  Camera,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  HardDriveDownload,
  Info,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Save,
  ShieldAlert,
  Target,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "firebase/auth";

import { AmbiencePicker } from "@/components/ambience-picker";
import { LumiMascot } from "@/components/lumi-mascot";
import { TopBar } from "@/components/shell/top-bar";
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
  const [open, setOpen] = useState<Panel | null>(null);

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

  const toggle = (k: Panel) => setOpen((cur) => (cur === k ? null : k));
  const notifLabel =
    notifSupport === "granted"
      ? "Ativados"
      : notifSupport === "denied"
        ? "Bloqueados"
        : notifSupport === "unsupported"
          ? "Indisponível"
          : "Desligados";

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 lg:pt-10">
      <TopBar title="Ajustes" fallback="/perfil" />

      {/* Who you are */}
      <motion.div
        initial={{ opacity: 0.6, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="surface-card mt-2 flex items-center gap-4 p-4"
      >
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
            aria-label="Trocar foto de perfil"
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
          <p className="truncate text-[13px] text-muted-foreground">
            {username ? `@${username}` : user.email}
          </p>
          {memberSince && (
            <p className="mt-0.5 text-[12px] text-faint">Leitor desde {memberSince}</p>
          )}
        </div>
      </motion.div>

      <Group title="Conta">
        <Row
          icon={UserRound}
          tint="#ffe7dd"
          label="Editar perfil"
          hint="Nome, identificador e bio"
          open={open === "perfil"}
          onClick={() => toggle("perfil")}
        />
        <Expand open={open === "perfil"}>
          <form onSubmit={handleSaveProfile} className="grid gap-3 pb-4 pt-1">
            <Field label="Nome de exibição">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className={INPUT}
              />
            </Field>
            <Field label="Identificador">
              <div className={`${INPUT} flex items-center !py-0`}>
                <span className="text-muted-foreground">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={32}
                  placeholder="seu_nome"
                  autoCapitalize="none"
                  className="min-w-0 flex-1 bg-transparent py-3 pl-1 outline-none"
                />
              </div>
            </Field>
            <Field label={`Bio · ${bio.length}/280`}>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Conte brevemente o que você gosta de ler."
                className={`${INPUT} resize-none`}
              />
            </Field>
            {profile?.customPhotoDataUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={photoSaving}
                className="justify-self-start text-[13px] font-semibold text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
              >
                Remover foto de perfil
              </button>
            )}
            <button type="submit" disabled={nameSaving} className={PRIMARY}>
              {nameSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar alterações
            </button>
          </form>
        </Expand>

        <Row
          icon={KeyRound}
          tint="#e6e1ff"
          label="Senha e acesso"
          hint={provider === "google.com" ? "Entrada com Google" : "Trocar sua senha"}
          open={open === "senha"}
          onClick={() => toggle("senha")}
        />
        <Expand open={open === "senha"}>
          {provider === "google.com" ? (
            <p className="pb-4 pt-1 text-[13.5px] leading-relaxed text-muted-foreground">
              Você entra com sua conta Google — a senha é gerenciada diretamente pelo Google.
            </p>
          ) : (
            <form onSubmit={handleChangePassword} className="grid gap-2.5 pb-4 pt-1">
              <PasswordInput
                placeholder="Senha atual"
                value={currentPassword}
                onChange={setCurrentPassword}
                visible={showPasswords}
                autoComplete="current-password"
              />
              <PasswordInput
                placeholder="Nova senha (mín. 6 caracteres)"
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
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="inline-flex items-center gap-1.5 justify-self-start py-1 text-[12.5px] font-semibold text-muted-foreground"
              >
                {showPasswords ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {showPasswords ? "Ocultar senhas" : "Mostrar senhas"}
              </button>
              <button type="submit" disabled={passwordSaving} className={PRIMARY}>
                {passwordSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Alterar senha
              </button>
            </form>
          )}
        </Expand>
      </Group>

      <Group title="Aparência">
        <div className="py-3.5">
          <p className="text-[13px] leading-snug text-muted-foreground">
            O ambiente de todo o app. O leitor tem temas próprios, que você troca dentro do livro.
          </p>
          <div className="mt-3">
            <AmbiencePicker />
          </div>
        </div>
      </Group>

      <Group title="Leitura">
        <Row
          icon={BellRing}
          tint="#fff1c7"
          label="Lembretes da Lumi"
          hint="Um toque por dia, se você ainda não leu"
          value={notifLabel}
          onClick={
            notifSupport === "default"
              ? () => void handleEnableNotifications()
              : () => toggle("lembrete")
          }
          open={open === "lembrete"}
          chevron={notifSupport !== "default"}
        />
        <Expand open={open === "lembrete"}>
          <div className="flex items-center gap-3 pb-4 pt-1">
            <LumiMascot size={36} blink={false} />
            <p className="text-[13px] leading-snug text-muted-foreground">
              {notifSupport === "granted"
                ? "Ativados — a Lumi avisa no máximo uma vez por dia, enquanto o app estiver aberto."
                : notifSupport === "denied"
                  ? "Bloqueados no navegador. Libere notificações para este site e recarregue a página."
                  : "Este navegador não aceita notificações."}
            </p>
          </div>
        </Expand>
        <LinkRow
          to="/downloads"
          icon={HardDriveDownload}
          tint="#d7f2ec"
          label="Downloads e arquivos"
          hint="Livros salvos neste aparelho"
        />
        <LinkRow
          to="/metas"
          icon={Target}
          tint="#ffe7dd"
          label="Metas de leitura"
          hint="Quantos livros neste ano"
          last
        />
      </Group>

      <Group title="Sobre">
        <LinkRow to="/sobre" icon={Info} tint="#ecebe6" label="Sobre o BookVerse" />
        <LinkRow to="/privacidade" icon={Lock} tint="#ecebe6" label="Privacidade" />
        <LinkRow to="/termos" icon={FileText} tint="#ecebe6" label="Termos de uso" />
        <LinkRow to="/contato" icon={Mail} tint="#ecebe6" label="Fale com a gente" last />
      </Group>

      <button
        type="button"
        onClick={() => {
          void signOut().then(() => navigate({ to: "/", replace: true }));
        }}
        className="press surface-card mt-6 flex h-[52px] w-full items-center justify-center gap-2 text-[15px] font-semibold"
      >
        <LogOut className="h-[18px] w-[18px]" /> Sair da conta
      </button>

      {/* Danger zone — tucked away, but one tap to reach */}
      <div className="mt-3">
        {!deleteOpen ? (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="mx-auto flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-destructive"
          >
            <ShieldAlert className="h-4 w-4" /> Excluir minha conta
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 rounded-[22px] border border-destructive/30 bg-destructive/5 p-4"
          >
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              Isso remove para sempre seu perfil, biblioteca e progresso de leitura. Não dá para
              desfazer.
            </p>
            {provider === "password" && (
              <PasswordInput
                placeholder="Confirme sua senha"
                value={deletePassword}
                onChange={setDeletePassword}
                visible={showPasswords}
                autoComplete="current-password"
              />
            )}
            <Field label="Digite EXCLUIR para confirmar">
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoCapitalize="characters"
                className={`${INPUT} border-destructive/40`}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmText("");
                  setDeletePassword("");
                }}
                disabled={deleting}
                className="h-11 rounded-full bg-surface-2 text-[14px] font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-destructive text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Excluir
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

type Panel = "perfil" | "senha" | "lembrete";

const INPUT =
  "w-full rounded-[14px] border border-border bg-background px-4 py-3 text-[15px] outline-none transition-colors focus:border-foreground/40";
const PRIMARY =
  "press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-[14.5px] font-semibold text-background disabled:opacity-60";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <p className="eyebrow mb-2 px-2">{title}</p>
      <div className="surface-card px-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function RowBody({
  icon: Icon,
  tint,
  label,
  hint,
  value,
}: {
  icon: typeof BellRing;
  tint: string;
  label: string;
  hint?: string;
  value?: string;
}) {
  return (
    <>
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-[#131313]"
        style={{ background: tint }}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] font-semibold">{label}</span>
        {hint && <span className="block truncate text-[12.5px] text-muted-foreground">{hint}</span>}
      </span>
      {value && <span className="shrink-0 text-[13px] text-faint">{value}</span>}
    </>
  );
}

function Row({
  open,
  onClick,
  chevron = true,
  ...body
}: {
  icon: typeof BellRing;
  tint: string;
  label: string;
  hint?: string;
  value?: string;
  open: boolean;
  onClick: () => void;
  chevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="press flex w-full items-center gap-3.5 border-b border-border py-3 last:border-b-0"
    >
      <RowBody {...body} />
      {chevron && (
        <ChevronDown
          className={`h-[18px] w-[18px] shrink-0 text-faint transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      )}
    </button>
  );
}

function LinkRow({
  to,
  last,
  ...body
}: {
  to: "/downloads" | "/metas" | "/sobre" | "/privacidade" | "/termos" | "/contato";
  icon: typeof BellRing;
  tint: string;
  label: string;
  hint?: string;
  last?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`press flex items-center gap-3.5 py-3 ${last ? "" : "border-b border-border"}`}
    >
      <RowBody {...body} />
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-faint" />
    </Link>
  );
}

/** Smooth open/close for a row's inline panel. */
function Expand({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden border-b border-border"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
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
      className={INPUT}
    />
  );
}
