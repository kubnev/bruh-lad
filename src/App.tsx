import { useEffect, useState } from 'react';
import Backup from './Backup';
import GuideTab from './guide/GuideTab';
import type { GuideData } from './guide/types';
import ProgressionTab, { type LadlorData, type MilestoneMeta } from './progression/ProgressionTab';
import { fetchWithFallback, GUIDE_RAW, LADLOR_RAW, useAsync } from './remote';
import { usePersistentState } from './storage';
import { loadUimGuide, UIM_GUIDE_URL, type UimGuide } from './uim/wiki';

type Mode = 'iron' | 'uim';
type Tab = 'guide' | 'progression';
type Theme = 'auto' | 'light' | 'dark';

const GUIDE_DOC = 'https://docs.google.com/document/d/1CBkFM70SnrW4hJXvHM2F1fYCuBF_fRnEXnTYgRnRkAE';

// "#uim/guide", "#iron/progression"; the old "#guide" / "#progression" links mean Ironman.
// Account types that have a Progression tab (Ultimate Ironman doesn't have one yet).
const HAS_PROGRESSION: Record<Mode, boolean> = { iron: true, uim: false };

function routeFromHash(): { mode: Mode; tab: Tab } {
  const [a, b] = location.hash.replace(/^#/, '').split('/');
  const mode: Mode = a === 'uim' ? 'uim' : 'iron';
  const wanted = (a === 'uim' || a === 'iron' ? b : a) === 'progression' ? 'progression' : 'guide';
  return { mode, tab: HAS_PROGRESSION[mode] ? wanted : 'guide' };
}

function formatDate(s: string) {
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function loadLadlor(): Promise<LadlorData> {
  const f = <T,>(remotePath: string, local: string) => fetchWithFallback<T>(`${LADLOR_RAW}/${remotePath}`, `data/ladlor/${local}`);
  return Promise.all([
    f<string[][]>('data/logic/milestone-sequence-main.json', 'milestone-sequence-main.json'),
    f<string[][]>('data/logic/milestone-sequence-retirement.json', 'milestone-sequence-retirement.json'),
    f<Record<string, MilestoneMeta>>('data/generated/milestone-metadata.json', 'milestone-metadata.json'),
  ]).then(([main, retirement, meta]) => ({ main, retirement, meta }));
}

/** Becomes true the first time `active` is true, so each panel only loads once it's opened. */
function useOpenedOnce(active: boolean) {
  const [opened, setOpened] = useState(active);
  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);
  return opened;
}

function Status({ what, error }: { what: string; error: string | null }) {
  return error ? (
    <p className="status error">Couldn't load the {what}: {error}</p>
  ) : (
    <p className="status">Loading {what}…</p>
  );
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  const { mode, tab } = route;
  const [theme, setTheme] = usePersistentState<Theme>('theme', 'auto');

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  const go = (next: { mode: Mode; tab: Tab }) => {
    if (!HAS_PROGRESSION[next.mode]) next = { ...next, tab: 'guide' };
    history.replaceState(null, '', `#${next.mode}/${next.tab}`);
    setRoute(next);
  };

  const ironGuideOpen = useOpenedOnce(mode === 'iron' && tab === 'guide');
  const ironProgOpen = useOpenedOnce(mode === 'iron' && tab === 'progression');
  const uimGuideOpen = useOpenedOnce(mode === 'uim' && tab === 'guide');

  const ironGuide = useAsync(
    () =>
      ironGuideOpen ? fetchWithFallback<GuideData>(`${GUIDE_RAW}/guide_data.json`, 'data/guide_data.json') : null,
    [ironGuideOpen]
  );
  const ladlor = useAsync(() => (ironProgOpen ? loadLadlor() : null), [ironProgOpen]);
  const uim = useAsync<UimGuide>(() => (uimGuideOpen ? loadUimGuide() : null), [uimGuideOpen]);

  const show = (m: Mode, t: Tab) => mode === m && tab === t;

  return (
    <>
      <header className="banner">
        <h1>OSRS Ironman Guide</h1>
        <p className="credit">
          Web version inspired by{' '}
          <a href="https://umkyzn.github.io/BRUHsailer/" target="_blank" rel="noreferrer">
            kyyznn's BRUHsailer site
          </a>
        </p>
      </header>

      <nav className="tabs">
        <div className="nav-left">
          <div className="mode-switch" role="radiogroup" aria-label="Account type">
            <button role="radio" aria-checked={mode === 'iron'} onClick={() => go({ mode: 'iron', tab })}>
              Ironman
            </button>
            <button role="radio" aria-checked={mode === 'uim'} onClick={() => go({ mode: 'uim', tab })}>
              <span className="long">Ultimate Ironman</span>
              <span className="short">UIM</span>
            </button>
          </div>
          <div className="tab-list" role="tablist">
            <button role="tab" aria-selected={tab === 'guide'} onClick={() => go({ mode, tab: 'guide' })}>
              Guide
            </button>
            {HAS_PROGRESSION[mode] && (
              <button role="tab" aria-selected={tab === 'progression'} onClick={() => go({ mode, tab: 'progression' })}>
                Progression
              </button>
            )}
          </div>
        </div>
        <div className="theme-switch" role="radiogroup" aria-label="Colour theme">
          {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} onClick={() => setTheme(t)}>
              {t === 'auto' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </nav>

      <main>
        <div hidden={!show('iron', 'guide')}>
          <p className="guide-credit">
            <strong>BRUHsailer</strong> by So Iron BRUH and ParasailerOSRS ·{' '}
            <a href={GUIDE_DOC} target="_blank" rel="noreferrer">Original guide (Google Doc)</a> ·{' '}
            <a href="https://umkyzn.github.io/BRUHsailer/" target="_blank" rel="noreferrer">Original web version</a>
            {ironGuide.data && <> · Last updated: {formatDate(ironGuide.data.updatedOn)}</>}
          </p>
          {ironGuide.data ? <GuideTab data={ironGuide.data} ns="main" /> : <Status what="guide" error={ironGuide.error} />}
        </div>

        <div hidden={!show('iron', 'progression')}>
          <p className="guide-credit">
            <a href="https://ladlorchart.com/" target="_blank" rel="noreferrer">Ladlor's Interactive Gear Progression Chart</a>{' '}
            by Ladlor, Mads S. Balto and the Ironscape Discord community.
          </p>
          {ladlor.data ? <ProgressionTab data={ladlor.data} /> : <Status what="chart" error={ladlor.error} />}
        </div>

        <div hidden={!show('uim', 'guide')}>
          <p className="guide-credit">
            <strong>Ultimate Ironman Walkthrough Guide to Prifddinas</strong> by OSRS Wiki contributors (
            <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 3.0</a>) ·{' '}
            <a href={UIM_GUIDE_URL} target="_blank" rel="noreferrer">View on the wiki</a>
            {uim.data?.updatedOn && <> · Last edited: {formatDate(uim.data.updatedOn)}</>}
          </p>
          {uim.data ? <GuideTab data={uim.data} ns="uim" /> : <Status what="guide" error={uim.error} />}
        </div>

      </main>
      <Backup />
    </>
  );
}
