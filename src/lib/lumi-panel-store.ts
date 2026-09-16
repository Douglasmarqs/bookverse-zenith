/**
 * Tiny pub/sub so any button anywhere (header, home AI card, reader
 * toolbar) can open the Lumi chat panel, which is mounted once in the root
 * layout. Avoids prop-drilling / context boilerplate for a single boolean +
 * optional book context.
 */
import { useEffect, useState } from "react";

export interface LumiContext {
  /** Keeps unrelated reader actions in independent conversations. */
  topic?:
    "general" | "question" | "summary" | "translation" | "explanation" | "character" | "flashcards";
  bookTitle?: string;
  bookAuthor?: string;
  chapterTitle?: string;
  chapterExcerpt?: string;
  /** Text deliberately selected in the reader. This stays bounded in the
   * client before a request is made; the whole book is never sent. */
  selectedText?: string;
  positionLabel?: string;
  /** A reader action can supply a focused question so Lumi responds without
   * making the person copy/paste the selected passage into the composer. */
  initialPrompt?: string;
  /** Current scanned PDF page, attached only after an explicit Lumi action. */
  pageImageDataUrl?: string;
}

interface LumiPanelState {
  open: boolean;
  context: LumiContext | null;
}

let state: LumiPanelState = { open: false, context: null };
const listeners = new Set<(s: LumiPanelState) => void>();

function emit() {
  for (const l of listeners) l(state);
}

export function openLumiPanel(context: LumiContext | null = null) {
  state = { open: true, context };
  emit();
}

export function closeLumiPanel() {
  state = { ...state, open: false };
  emit();
}

export function useLumiPanelState(): LumiPanelState {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
