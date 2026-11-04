import type { Chapter, ContentItem, Formatting, GuideData, Section, Step } from '../guide/types';
import { fetchWithFallback } from '../remote';

// OSRS Wiki: Ultimate Ironman Walkthrough Guide to Prifddinas (CC BY-NC-SA 3.0).
// Loaded live from the wiki API (it allows cross-site requests), so wiki edits
// show up without redeploying; public/data/uim holds a fallback copy.
export const UIM_GUIDE_PAGE = 'Guide:Ultimate_Ironman_Walkthrough_Guide_To_Prifddinas';
export const UIM_GUIDE_URL = `https://oldschool.runescape.wiki/w/${UIM_GUIDE_PAGE}`;
const WIKI = 'https://oldschool.runescape.wiki';
const API = `${WIKI}/api.php`;

export type UimGuide = GuideData;

interface ParseResponse {
  parse: { text: string; revid: number };
}
interface RevisionResponse {
  query: { pages: { revisions?: { timestamp: string }[] }[] };
}

export async function loadUimGuide(): Promise<UimGuide> {
  const page = encodeURIComponent(UIM_GUIDE_PAGE);
  const [parsed, rev] = await Promise.all([
    fetchWithFallback<ParseResponse>(
      `${API}?action=parse&page=${page}&prop=text|revid&format=json&formatversion=2&redirects=1&origin=*`,
      'data/uim/parse.json'
    ),
    fetchWithFallback<RevisionResponse>(
      `${API}?action=query&prop=revisions&rvprop=timestamp&titles=${page}&format=json&formatversion=2&redirects=1&origin=*`,
      'data/uim/revision.json'
    ),
  ]);
  const updatedOn = rev.query.pages[0]?.revisions?.[0]?.timestamp ?? '';
  return { updatedOn, chapters: convert(parsed.parse.text) };
}

// --- HTML → guide data ------------------------------------------------------

const BLOCK_SKIP = 'hr, style, script, .mw-editsection, .toc, #toc';
const clean = (s: string) => s.replace(/\s+/g, ' ');

function absUrl(href: string): string | undefined {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('/')) return WIKI + href;
  return undefined;
}

/** Inline content of `node` (stopping at nested lists) as formatted text runs. */
function inline(node: Node, fmt: Formatting = {}, out: ContentItem[] = []): ContentItem[] {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = clean(child.textContent ?? '');
      if (text) out.push({ text, formatting: { ...fmt } });
      return;
    }
    if (!(child instanceof HTMLElement)) return;
    const tag = child.tagName;
    if (tag === 'UL' || tag === 'OL' || tag === 'IMG' || tag === 'TABLE') return;
    if (child.matches('.mw-editsection, sup.reference, style')) return;
    if (tag === 'BR') return void out.push({ text: '\n' });
    const f = { ...fmt };
    if (tag === 'B' || tag === 'STRONG') f.bold = true;
    if (tag === 'I' || tag === 'EM') f.italic = true;
    if (tag === 'U') f.underline = true;
    if (tag === 'S' || tag === 'DEL') f.strikethrough = true;
    if (tag === 'A') {
      const url = absUrl(child.getAttribute('href') ?? '');
      if (url) {
        f.isLink = true;
        f.url = url;
      }
    }
    inline(child, f, out);
  });
  return trim(out);
}

/** Merge neighbouring runs with the same formatting and trim outer whitespace. */
function trim(items: ContentItem[]): ContentItem[] {
  const merged: ContentItem[] = [];
  for (const it of items) {
    const prev = merged[merged.length - 1];
    if (prev && JSON.stringify(prev.formatting) === JSON.stringify(it.formatting)) prev.text += it.text;
    else merged.push({ ...it });
  }
  for (const it of merged) it.text = it.text.replace(/ +/g, ' ');
  if (merged[0]) merged[0].text = merged[0].text.trimStart();
  const last = merged[merged.length - 1];
  if (last) last.text = last.text.trimEnd();
  return merged.filter((it) => it.text);
}

const textOf = (items: ContentItem[]) => items.map((i) => i.text).join('').trim();

/** Nested bullets under a list item, flattened with their depth (1 = direct child). */
function nested(li: Element, level = 1, out: { level: number; content: ContentItem[] }[] = []) {
  for (const list of li.querySelectorAll(':scope > ul, :scope > ol')) {
    for (const sub of list.querySelectorAll(':scope > li')) {
      const content = inline(sub);
      if (textOf(content)) out.push({ level, content });
      nested(sub, level + 1, out);
    }
  }
  return out;
}

/** Stable step id from its text, so wiki edits elsewhere don't move your ticks. */
function hashId(text: string): string {
  let h = 5381;
  const s = text.toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function convert(html: string): Chapter[] {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root')!;
  root.querySelectorAll(BLOCK_SKIP).forEach((el) => el.remove());

  const chapters: Chapter[] = [];
  let h2 = '';
  let chapter: Chapter | null = null;
  let section: Section | null = null;
  const usedIds = new Set<string>();

  const newChapter = (title: string) => {
    chapter = { title, sections: [] };
    chapters.push(chapter);
    section = null;
  };
  const newSection = (title: string) => {
    if (!chapter) newChapter(title);
    section = { title, steps: [] };
    chapter!.sections.push(section);
  };
  // Content before any sub-heading: an overview, which becomes "Route" once steps arrive.
  const current = (): Section => {
    if (!section) newSection('Overview');
    return section!;
  };
  const addParagraph = (content: ContentItem[]) => {
    if (!textOf(content)) return;
    const sec = current();
    if (sec.steps.length) (sec.outro ??= []).push(content);
    else (sec.intro ??= []).push(content);
  };

  const walk = (parent: Element) => {
    for (const el of Array.from(parent.children)) {
      const heading = el.matches('h2, h3, h4') ? el : el.matches('.mw-heading') ? el.querySelector('h2, h3, h4') : null;
      if (heading) {
        const title = clean(heading.textContent ?? '').trim().replace(/\.$/, '');
        if (heading.tagName === 'H2') {
          h2 = title;
          if (!/route sections/i.test(title)) newChapter(title);
        } else if (/route sections/i.test(h2)) {
          newChapter(title); // each route section is a chapter
        } else {
          newSection(title);
        }
        continue;
      }
      // Collapsible boxes: either wrap a heading (route section) or are optional extras.
      if (el.matches('table.mw-collapsible')) {
        const th = el.querySelector('tr > th');
        const isBox = !!th && !th.querySelector('h2, h3, h4, .mw-heading');
        // An optional box is its own section; content after it belongs to the route again.
        const resume = section;
        if (isBox) newSection(clean(th!.textContent ?? '').trim());
        for (const cell of el.querySelectorAll(':scope > tbody > tr > th, :scope > tbody > tr > td')) {
          if (cell === th && isBox) continue;
          walk(cell);
        }
        if (isBox) section = resume;
        continue;
      }
      if (el.matches('figure.embedvideo')) {
        const id = el.querySelector('iframe')?.getAttribute('src')?.match(/\/embed\/([\w-]+)/)?.[1];
        if (id) addParagraph([{ text: '▶ Video', formatting: { isLink: true, url: `https://www.youtube.com/watch?v=${id}` } }]);
        continue;
      }
      if (el.matches('figure, iframe')) continue;
      if (el.matches('table.equipment, table.inventorytable')) {
        const names = Array.from(el.querySelectorAll('a[title], img[alt]'))
          .map((a) => (a.getAttribute('title') || a.getAttribute('alt') || '').replace(/\.png$/, ''))
          .filter((n, i, arr) => n && arr.indexOf(n) === i);
        if (names.length) {
          const sec = current();
          (sec.gear ??= []).push({ label: el.matches('.inventorytable') ? 'Inventory' : 'Equipment', items: names.join(', ') });
        }
        continue;
      }
      if (el.matches('.checklist')) {
        const sec = current();
        if (sec.title === 'Overview' && !sec.steps.length && /route sections/i.test(h2)) sec.title = 'Route';
        for (const li of el.querySelectorAll(':scope > ul > li')) {
          const content = inline(li);
          const text = textOf(content);
          if (!text) continue;
          let id = `u-${hashId(text)}`;
          for (let n = 2; usedIds.has(id); n++) id = `u-${hashId(text)}-${n}`;
          usedIds.add(id);
          const step: Step = { id, content, nestedContent: nested(li) };
          sec.steps.push(step);
        }
        continue;
      }
      if (el.matches('ul, ol')) {
        // Plain bullet text (e.g. the route design breakdown): one paragraph per bullet.
        for (const li of el.querySelectorAll(':scope > li')) {
          addParagraph(inline(li));
          for (const n of nested(li)) addParagraph(n.content);
        }
        continue;
      }
      if (el.matches('p')) {
        const content = inline(el);
        const text = textOf(content);
        // A paragraph that is entirely bold reads as a sub-heading.
        const allBold = content.length > 0 && content.every((c) => c.formatting?.bold);
        if (allBold && text.length < 80 && chapter) newSection(text);
        else addParagraph(content);
        continue;
      }
      if (el.matches('div, table, tbody, tr, td, th, center, section')) walk(el);
    }
  };
  walk(root);

  // Drop empty sections/chapters.
  return chapters
    .map((c) => ({
      ...c,
      sections: c.sections.filter((s) => s.steps.length || s.intro?.length || s.outro?.length || s.gear?.length),
    }))
    .filter((c) => c.sections.length);
}
