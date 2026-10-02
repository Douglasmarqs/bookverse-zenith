export interface BookLocation {
  chapterIndex: number;
  paragraphIndex: number;
}

export interface BookNavigationEntry extends BookLocation {
  label: string;
  depth: number;
}

export interface InternalBookLink extends BookLocation {
  startOffset: number;
  endOffset: number;
}

export type ChapterBlock =
  { type: "text"; paragraphIndex: number } | { type: "image"; src: string; alt?: string };

export type Chapter = {
  id: string;
  title: string;
  /** Stable text indices used by existing notes, highlights and progress. */
  paragraphs: string[];
  blocks?: ChapterBlock[];
  sourcePath?: string;
  anchors?: Record<string, number>;
  links?: Record<number, InternalBookLink[]>;
  direction?: "ltr" | "rtl";
};

export type Book = {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  chapters: Chapter[];
  /** Optional for old imports and Gutenberg/PDF text books. */
  navigation?: BookNavigationEntry[];
  importWarnings?: string[];
  epubVersion?: string;
};
