export interface Formatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: { r?: number; g?: number; b?: number };
  url?: string;
  isLink?: boolean;
}

export interface ContentItem {
  text: string;
  url?: string;
  isLink?: boolean;
  formatting?: Formatting;
}

export interface Step {
  /** Stable id for progress/highlights; when absent the step's position is used. */
  id?: string;
  content: ContentItem[];
  nestedContent?: { level: number; content: ContentItem[] }[];
  metadata?: Record<string, string | undefined>;
}

export interface GearBox {
  label: string;
  items: string;
}

export interface Section {
  title: string;
  steps: Step[];
  /** Paragraphs shown above / below the steps. */
  intro?: ContentItem[][];
  outro?: ContentItem[][];
  /** Equipment / inventory setups shown under the steps. */
  gear?: GearBox[];
}

export interface Chapter {
  title: string;
  titleFormatted?: ContentItem[];
  sections: Section[];
  footnotes?: { content: ContentItem[] }[];
}

export interface GuideData {
  updatedOn: string;
  chapters: Chapter[];
}

export type HighlightColor = 'green' | 'yellow' | 'blue' | 'pink' | 'red' | 'purple';
export const HIGHLIGHT_COLORS: HighlightColor[] = ['green', 'yellow', 'blue', 'pink', 'red', 'purple'];

export interface Highlight {
  parentId: string; // e.g. "step-1-4"
  htmlContent: string; // highlighted text
  color: HighlightColor;
  group?: string; // all pieces of one selection share a group, so they're removed together
  start?: number; // character offset within the step body, so short text is restored in the right place
}
