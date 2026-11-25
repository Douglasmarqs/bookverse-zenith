import { ArrowUp, Sparkles } from "lucide-react";
import { useState } from "react";

import { Lumi } from "@/components/brand/lumi";
import { openLumiPanel, type LumiContext } from "@/lib/lumi-panel-store";

/**
 * A small "ask Lumi" composer that lives inside a screen. Typing here (or
 * tapping a suggestion) opens the Lumi sheet with the question already sent.
 */
export function LumiAskBar({
  placeholder = "Pergunte à Lumi…",
  prefix = "",
  suggestions = [],
  context,
  className = "",
}: {
  placeholder?: string;
  /** Instruction prepended to what the person types (kept out of the UI). */
  prefix?: string;
  suggestions?: string[];
  context?: Omit<LumiContext, "initialPrompt">;
  className?: string;
}) {
  const [text, setText] = useState("");
  const ask = (q: string) => {
    const t = q.trim();
    if (!t) return;
    openLumiPanel({ topic: "general", ...context, initialPrompt: prefix + t });
    setText("");
  };
  return (
    <div className={className}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
        className="flex items-center gap-2 rounded-full bg-accent-soft py-1.5 pl-1.5 pr-1.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold)_22%,transparent)]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-card">
          <Lumi pose="hello" size={34} shadow={false} />
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="send"
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-foreground/50"
        />
        <button
          type="submit"
          aria-label="Perguntar à Lumi"
          disabled={!text.trim()}
          className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-white transition-opacity disabled:opacity-40"
        >
          <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.4} />
        </button>
      </form>
      {suggestions.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[12.5px] font-semibold text-foreground/80 shadow-[inset_0_0_0_1px_var(--border)]"
            >
              <Sparkles className="h-3 w-3 text-gold" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
