import type { ContentItem, GearBox, GuideData, Step } from './types';

export interface StepEntry {
  step: Step;
  id: string; // "<chapter>-<n>", n counts steps within the chapter (matches the original site)
  number: number;
  text: string; // lowercase searchable text
}

export interface SectionEntry {
  key: string;
  title: string;
  steps: StepEntry[];
  intro: ContentItem[][];
  outro: ContentItem[][];
  gear: GearBox[];
}

export interface ChapterEntry {
  index: number;
  title: string;
  titleFormatted?: ContentItem[];
  sections: SectionEntry[];
  footnotes: ContentItem[][];
}

const flat = (c: ContentItem[]) => c.map((i) => i.text).join('');

export function buildModel(data: GuideData): { chapters: ChapterEntry[]; stepIds: string[] } {
  const stepIds: string[] = [];
  const chapters = data.chapters.map((ch, ci) => {
    let n = 0;
    const sections = ch.sections.map((sec, si) => ({
      key: `${ci}-${si}`,
      title: sec.title,
      intro: sec.intro ?? [],
      outro: sec.outro ?? [],
      gear: sec.gear ?? [],
      steps: sec.steps.map((step) => {
        n++;
        const id = step.id ?? `${ci + 1}-${n}`;
        stepIds.push(id);
        const text = [
          flat(step.content),
          ...(step.nestedContent ?? []).map((x) => flat(x.content)),
          ...Object.entries(step.metadata ?? {})
            .filter(([k]) => k === 'gp_stack' || k === 'items_needed')
            .map(([, v]) => v ?? ''),
        ]
          .join(' ')
          .toLowerCase();
        return { step, id, number: n, text };
      }),
    }));
    return {
      index: ci,
      title: ch.title,
      titleFormatted: ch.titleFormatted,
      sections,
      footnotes: (ch.footnotes ?? []).map((f) => f.content ?? []),
    };
  });
  return { chapters, stepIds };
}
