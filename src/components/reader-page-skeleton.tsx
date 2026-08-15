/** Placeholder shaped like an open reader page — used while a book's
 * content is still loading (EPUB parsing, downloading from Gutenberg,
 * etc.) so the wait reads as "your book is opening" rather than a bare
 * spinner on an empty screen. */
export function ReaderPageSkeleton({ label }: { label: string }) {
  const lineWidths = ["w-full", "w-[92%]", "w-[97%]", "w-[85%]", "w-full", "w-[70%]"];
  return (
    <div className="mx-auto max-w-2xl animate-pulse px-6 py-16">
      <div className="mx-auto h-1 w-full max-w-md rounded-full bg-secondary/50" />
      <div className="mx-auto mt-10 h-3 w-40 rounded bg-secondary/60" />
      <div className="mx-auto mt-4 h-7 w-3/4 rounded bg-secondary/60" />
      <div className="mt-12 space-y-4">
        {lineWidths.map((w, i) => (
          <div key={i} className={`h-3 rounded bg-secondary/40 ${w}`} />
        ))}
      </div>
      <p className="mt-12 text-center text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
