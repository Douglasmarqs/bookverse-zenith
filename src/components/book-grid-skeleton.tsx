/** A shimmering placeholder grid matching the book-cover grids used across
 * Descobrir/Catálogo/Biblioteca — swap in while real results are loading
 * so the layout doesn't jump and the wait reads as "loading", not "broken". */
export function BookGridSkeleton({
  count = 6,
  columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
}: {
  count?: number;
  columns?: string;
}) {
  return (
    <div className={`mt-4 grid gap-x-5 gap-y-8 ${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[2/3] w-full rounded-md bg-secondary/60" />
          <div className="mt-3 h-3 w-4/5 rounded bg-secondary/60" />
          <div className="mt-2 h-2.5 w-3/5 rounded bg-secondary/40" />
        </div>
      ))}
    </div>
  );
}
