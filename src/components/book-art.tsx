import { useState } from "react";

import { FauxCover } from "@/components/faux-cover";
import { fauxBookFor } from "@/lib/faux-books";

/**
 * A book's cover: the generated "capa viva" art underneath, the real artwork
 * fading in on top when there is one (and silently staying hidden if the
 * image fails). Always 2:3 with the shared book shadow.
 */
export function BookArt({
  title,
  author,
  cover,
  className = "",
  lift = false,
  showText = true,
  eager = false,
}: {
  title: string;
  author?: string;
  cover?: string | null;
  className?: string;
  lift?: boolean;
  showText?: boolean;
  eager?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-[4px_8px_8px_4px] ${
        lift ? "book-shadow-lift" : "book-shadow"
      } ${className}`}
    >
      <FauxCover
        book={fauxBookFor(title, author)}
        showText={showText}
        className="absolute inset-0 h-full w-full"
      />
      {cover && state !== "error" && (
        <img
          src={cover}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            state === "ok" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {/* Spine light, so real covers read as objects too. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgb(0 0 0 / .26), rgb(255 255 255 / .12) 5%, rgb(0 0 0 / .05) 9%, transparent 20%)",
        }}
      />
    </div>
  );
}
