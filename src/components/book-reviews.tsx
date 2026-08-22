/**
 * Resenhas da comunidade na página de detalhes do livro — média de
 * estrelas, editor da própria resenha (com marcação de spoiler) e lista
 * com curtidas, no estilo Skoob.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, Heart, Loader2, PenLine, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { User } from "firebase/auth";
import { describeFirestoreError } from "@/lib/async-utils";
import {
  REVIEW_MAX_LENGTH,
  REVIEW_XP,
  deleteReview,
  saveReview,
  setReviewLike,
  subscribeReviewLikes,
  subscribeReviews,
  type BookReview,
} from "@/lib/reviews";
import { subscribeUserProfile, type UserProfile } from "@/lib/user-profile";
import { UserAvatar } from "./user-avatar";

function Stars({
  value,
  onChange,
  size = "h-4 w-4",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: string;
}) {
  return (
    <div
      className="flex items-center gap-0.5"
      role={onChange ? "radiogroup" : undefined}
      aria-label="Avaliação em estrelas"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i)}
          className={onChange ? "transition hover:scale-110" : "cursor-default"}
          aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
        >
          <Star
            className={`${size} ${i <= value ? "fill-gold text-gold" : "text-muted-foreground/40"}`}
          />
        </button>
      ))}
    </div>
  );
}

export function BookReviews({ bookId, user }: { bookId: string; user: User | null }) {
  const [reviews, setReviews] = useState<BookReview[] | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const canWrite = !!user && !user.isAnonymous;

  useEffect(() => subscribeReviews(bookId, setReviews), [bookId]);
  useEffect(() => {
    if (!canWrite || !user) return;
    return subscribeUserProfile(user.uid, setProfile);
  }, [canWrite, user]);

  const own = useMemo(() => reviews?.find((r) => r.id === user?.uid) ?? null, [reviews, user]);
  const stats = useMemo(() => {
    const rated = (reviews ?? []).filter((r) => r.rating > 0);
    const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
    return { count: reviews?.length ?? 0, avg };
  }, [reviews]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-medium">Resenhas da comunidade</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O que outros leitores acharam deste livro.
          </p>
        </div>
        {stats.count > 0 && (
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <Stars value={Math.round(stats.avg)} />
              <span className="font-display text-xl font-medium">{stats.avg.toFixed(1)}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {stats.count} {stats.count === 1 ? "resenha" : "resenhas"}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        {canWrite && user ? (
          <ReviewEditor bookId={bookId} user={user} profile={profile} own={own} />
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-card/30 p-5 text-sm text-muted-foreground">
            <Link to="/auth" className="font-medium text-gold hover:underline">
              Entre com sua conta
            </Link>{" "}
            para escrever uma resenha e curtir as de outros leitores.
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {reviews === null ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-border/50 p-5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-secondary" />
                  <div className="h-3 w-32 rounded bg-secondary" />
                </div>
                <div className="mt-4 h-3 w-full rounded bg-secondary" />
                <div className="mt-2 h-3 w-3/4 rounded bg-secondary" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            Ainda não há resenhas. Seja a primeira pessoa a compartilhar o que achou!
          </p>
        ) : (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              bookId={bookId}
              review={review}
              viewerUid={canWrite && user ? user.uid : null}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ReviewEditor({
  bookId,
  user,
  profile,
  own,
}: {
  bookId: string;
  user: User;
  profile: UserProfile | null;
  own: BookReview | null;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(own?.rating ?? 0);
  const [text, setText] = useState(own?.text ?? "");
  const [spoiler, setSpoiler] = useState(own?.spoiler ?? false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Quando a própria resenha chega pela assinatura, sincroniza o formulário.
  useEffect(() => {
    setRating(own?.rating ?? 0);
    setText(own?.text ?? "");
    setSpoiler(own?.spoiler ?? false);
  }, [own?.rating, own?.text, own?.spoiler]);

  const editing = open || !own;

  async function handleSave() {
    setSaving(true);
    try {
      const { isNew } = await saveReview(user, profile, bookId, { rating, text, spoiler });
      toast.success(isNew ? `Resenha publicada! Você ganhou +${REVIEW_XP} XP.` : "Resenha atualizada.");
      setOpen(false);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível publicar sua resenha agora."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!own || !window.confirm("Apagar sua resenha deste livro?")) return;
    setDeleting(true);
    try {
      await deleteReview(user.uid, bookId);
      toast.success("Resenha apagada.");
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível apagar sua resenha agora."));
    } finally {
      setDeleting(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/5 p-4">
        <p className="text-sm text-foreground/80">
          Você já resenhou este livro{own.rating > 0 ? ` (${own.rating}★)` : ""}.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-1.5 text-xs font-medium hover:border-gold/40 hover:text-gold"
          >
            <PenLine className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-destructive/50 hover:text-destructive disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Apagar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">{own ? "Editar sua resenha" : "Escreva sua resenha"}</p>
        <Stars value={rating} onChange={setRating} size="h-5 w-5" />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, REVIEW_MAX_LENGTH))}
        rows={4}
        maxLength={REVIEW_MAX_LENGTH}
        placeholder="O que você achou deste livro? Vale tudo: ritmo, personagens, aquele final…"
        className="mt-3 w-full resize-y rounded-lg border border-border/60 bg-background/60 p-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 focus:border-gold/50"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={spoiler}
            onChange={(e) => setSpoiler(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#C89B6A]"
          />
          Contém spoiler
        </label>
        <span className="text-[11px] text-muted-foreground/70">
          {text.length}/{REVIEW_MAX_LENGTH}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-70"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {own ? "Salvar alterações" : "Publicar resenha"}
        </button>
        {own && (
          <button
            onClick={() => setOpen(false)}
            className="rounded-full border border-border/60 px-5 py-2 text-sm hover:border-gold/40 hover:text-gold"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  bookId,
  review,
  viewerUid,
}: {
  bookId: string;
  review: BookReview;
  viewerUid: string | null;
}) {
  const [likes, setLikes] = useState<string[]>([]);
  const [liking, setLiking] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(
    () => subscribeReviewLikes(bookId, review.id, setLikes),
    [bookId, review.id],
  );

  const liked = viewerUid ? likes.includes(viewerUid) : false;
  const hidden = review.spoiler && !revealed;
  const dateLabel = review.createdAt?.toMillis
    ? new Date(review.createdAt.toMillis()).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "agora mesmo";

  async function handleLike() {
    if (!viewerUid) return;
    setLiking(true);
    try {
      await setReviewLike(bookId, review.id, viewerUid, !liked);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível registrar sua curtida agora."));
    } finally {
      setLiking(false);
    }
  }

  return (
    <article className="rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="flex items-center gap-3">
        <UserAvatar profile={review} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{review.displayName}</p>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </div>
        {review.rating > 0 && <Stars value={review.rating} size="h-3.5 w-3.5" />}
      </div>

      <div className="relative mt-3">
        <p
          className={`whitespace-pre-line text-sm leading-relaxed text-foreground/85 ${
            hidden ? "select-none blur-[6px]" : ""
          }`}
        >
          {review.text}
        </p>
        {hidden && (
          <button
            onClick={() => setRevealed(true)}
            className="absolute inset-0 grid place-items-center"
            aria-label="Mostrar resenha com spoiler"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-background/95 px-4 py-1.5 text-xs font-medium text-gold">
              <Eye className="h-3.5 w-3.5" /> Contém spoiler — mostrar
            </span>
          </button>
        )}
      </div>

      <div className="mt-4">
        <button
          onClick={handleLike}
          disabled={liking || !viewerUid}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
            liked
              ? "border-gold/50 bg-gold/10 text-gold"
              : "border-border/60 text-muted-foreground hover:border-gold/40 hover:text-gold"
          } disabled:opacity-60`}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-gold text-gold" : ""}`} />
          {likes.length > 0 && <span>{likes.length}</span>}
          {liked ? "Curtido" : "Curtir"}
        </button>
      </div>
    </article>
  );
}
