/**
 * Tiny pub/sub so any button anywhere (header, home AI card, reader
 * toolbar) can open the Lumi chat panel, which is mounted once in the root
 * layout. Avoids prop-drilling / context boilerplate for a single boolean +
 * optional book context.
 */
import { useEffect, useState } from "react";

export interface LumiContext {
  bookTitle?: string;
  bookAuthor?: string;
  chapterTitle?: string;
  chapterExcerpt?: string;
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
