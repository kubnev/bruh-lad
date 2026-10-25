import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../storage';
import { applyHighlights, clearHighlights, clearSearchMarks, collectHighlights, highlightSelection, markSearchTerm, removeHighlightAt, withGroups } from './dom';
import { FormattedText } from './FormattedText';
import { buildModel } from './model';
import { StepView } from './StepView';
import { HIGHLIGHT_COLORS, type GuideData, type Highlight, type HighlightColor } from './types';

interface Props {
  data: GuideData;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function GuideTab({ data }: Props) {
  const { chapters, stepIds } = useMemo(() => buildModel(data), [data]);

  // Storage keys match the original site so its localStorage can be copied across.
  const [progress, setProgress] = usePersistentState<Record<string, boolean>>('guideProgress:main', {});
  // On: every completed step is hidden except the latest one, which stays as a collapsed row.
  const [minimized, setMinimized] = usePersistentState<boolean>('guideMinimizeCompleted', true);
  const [highlights, setHighlights] = usePersistentState<Highlight[]>('userHighlights:main', []);
  const [color, setColor] = usePersistentState<HighlightColor>('highlightColor', 'yellow');
  const [highlightMode, setHighlightMode] = useState(false);
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim().toLowerCase(), 200);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Open the section holding the first unticked step, and scroll to it once.
  const firstOpenId = useMemo(() => stepIds.find((id) => !progress[id]) ?? null, [stepIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    for (const ch of chapters)
      for (const s of ch.sections) if (s.steps.some((st) => st.id === firstOpenId)) return new Set([s.key]);
    return new Set([chapters[0]?.sections[0]?.key].filter(Boolean) as string[]);
  });
  const [openChapters, setOpenChapters] = useState<Set<number>>(
    () => new Set(chapters.filter((c) => c.sections.some((s) => openSections.has(s.key))).map((c) => c.index))
  );
  useEffect(() => {
    if (firstOpenId && firstOpenId !== stepIds[0]) {
      document.getElementById(`step-${firstOpenId}`)?.scrollIntoView({ block: 'start' });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleIn = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  // --- search ---------------------------------------------------------------
  const matches = useMemo(() => {
    if (!term) return null;
    const s = new Set<string>();
    for (const ch of chapters) for (const sec of ch.sections) for (const st of sec.steps) if (st.text.includes(term)) s.add(st.id);
    return s;
  }, [term, chapters]);

  const stepLocation = useMemo(() => {
    const m = new Map<string, { section: string; chapter: number }>();
    for (const ch of chapters) for (const sec of ch.sections) for (const st of sec.steps) m.set(st.id, { section: sec.key, chapter: ch.index });
    return m;
  }, [chapters]);

  const onToggleStep = useCallback(
    (id: string) => {
      const next = { ...progress, [id]: !progress[id] };
      setProgress(next);
      // Ticking the last step of a section: open the section holding the next unticked step.
      if (next[id]) {
        const nextId = stepIds.slice(stepIds.indexOf(id) + 1).find((s) => !next[s]);
        const loc = nextId && stepLocation.get(nextId);
        if (loc) {
          setOpenSections((s) => new Set(s).add(loc.section));
          setOpenChapters((s) => new Set(s).add(loc.chapter));
        }
      }
    },
    [progress, setProgress, stepIds, stepLocation]
  );

  const lastDoneId = useMemo(() => {
    for (let i = stepIds.length - 1; i >= 0; i--) if (progress[stepIds[i]]) return stepIds[i];
    return null;
  }, [stepIds, progress]);

  const isHidden = (id: string) =>
    matches ? !matches.has(id) : minimized && !!progress[id] && id !== lastDoneId;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    clearSearchMarks(root);
    if (!matches) return;
    matches.forEach((id) => {
      const body = document.getElementById(`step-${id}`)?.querySelector<HTMLElement>('.step-body');
      if (body) markSearchTerm(body, term);
    });
  }, [matches, term]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape' && t === searchRef.current) {
        setQuery('');
        searchRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // --- highlights -----------------------------------------------------------
  useEffect(() => {
    if (!rootRef.current) return;
    // Older saves have no groups; add them (without dropping anything that
    // can't currently be placed, e.g. after an upstream text change).
    const grouped = withGroups(highlights);
    applyHighlights(rootRef.current, grouped);
    if (grouped.some((h, i) => h !== highlights[i])) setHighlights(grouped);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !highlightMode) return;
    const sync = () => setHighlights(collectHighlights(root));
    const onUp = () => {
      // Let the browser finalise the selection (matters on touch devices).
      setTimeout(() => {
        if (highlightSelection(root, color)) sync();
      }, 0);
    };
    const onClick = (e: MouseEvent) => {
      if (window.getSelection()?.isCollapsed && removeHighlightAt(e.target)) sync();
    };
    root.addEventListener('mouseup', onUp);
    root.addEventListener('touchend', onUp);
    root.addEventListener('click', onClick);
    return () => {
      root.removeEventListener('mouseup', onUp);
      root.removeEventListener('touchend', onUp);
      root.removeEventListener('click', onClick);
    };
  }, [highlightMode, color, setHighlights]);

  const removeAllHighlights = () => {
    if (!highlights.length || !window.confirm('Remove all highlights?')) return;
    if (rootRef.current) clearHighlights(rootRef.current);
    setHighlights([]);
  };

  const resetProgress = () => {
    if (!window.confirm('Reset all guide progress?')) return;
    setProgress({});
  };

  // --- render ---------------------------------------------------------------
  return (
    <>
      <div className="toolbar">
        <div className="search">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search steps  ( / )"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search steps"
          />
          {matches && (
            <span className="match-count" role="status">
              {matches.size === 0 ? 'No matches' : `${matches.size} step${matches.size === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
        <div className="tools">
          <button
            className={minimized ? 'on' : ''}
            aria-pressed={minimized}
            onClick={() => setMinimized((m) => !m)}
            title="Hide completed steps, keeping only the latest one"
          >
            Minimize completed
          </button>
          <span className="hl-group">
            <button
              className={highlightMode ? 'on' : ''}
              aria-pressed={highlightMode}
              onClick={() => setHighlightMode((m) => !m)}
              title="Select text to highlight it; click a highlight to remove it"
            >
              Highlight
            </button>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch hl-${c}${color === c ? ' on' : ''}`}
                aria-label={`Highlight colour ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
              />
            ))}
          </span>
          <button onClick={removeAllHighlights}>Remove highlights</button>
          <button className="danger" onClick={resetProgress}>
            Reset progress
          </button>
        </div>
      </div>

      <div ref={rootRef} className={`guide${highlightMode ? ' highlighting' : ''}`}>
        {chapters.map((ch) => {
          const chVisible = ch.sections.some((s) => s.steps.some((st) => !isHidden(st.id)));
          const chOpen = openChapters.has(ch.index) || (!!matches && chVisible);
          return (
            <section key={ch.index} className={`chapter${chOpen ? ' open' : ''}`} hidden={!chVisible}>
              <h2>
                <button className="disclosure" onClick={() => setOpenChapters((s) => toggleIn(s, ch.index))} aria-expanded={chOpen}>
                  {/* Formatted title keeps the doc's styling, e.g. the struck-through "chopper" */}
                  <span>{ch.titleFormatted ? <FormattedText content={ch.titleFormatted} /> : ch.title}</span>
                </button>
              </h2>
              <div className="chapter-body">
                {ch.sections.map((sec) => {
                  const secVisible = sec.steps.some((st) => !isHidden(st.id));
                  const secOpen = openSections.has(sec.key) || (!!matches && secVisible);
                  return (
                    <div key={sec.key} className={`section${secOpen ? ' open' : ''}`} hidden={!secVisible}>
                      <h3>
                        <button className="disclosure" onClick={() => setOpenSections((s) => toggleIn(s, sec.key))} aria-expanded={secOpen}>
                          {sec.title}
                        </button>
                      </h3>
                      <div className="section-body">
                        {sec.steps.map((st) => {
                          const done = !!progress[st.id];
                          return (
                            <StepView
                              key={st.id}
                              step={st.step}
                              stepId={st.id}
                              number={st.number}
                              done={done}
                              collapsed={done && minimized && !matches}
                              hidden={isHidden(st.id)}
                              onToggle={onToggleStep}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {ch.footnotes.length > 0 && !matches && (
                  <details className="notes">
                    <summary>End of chapter notes</summary>
                    {ch.footnotes.map((line, i) =>
                      line.map((c) => c.text).join('').trim() ? (
                        <p key={i}>
                          <FormattedText content={line} />
                        </p>
                      ) : null
                    )}
                  </details>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
