import { useState } from 'react';

// Everything worth keeping. Values are copied as the raw localStorage strings.
const KEYS = [
  'guideProgress:main',
  'userHighlights:main',
  'guideProgress:uim',
  'userHighlights:uim',
  'guideMinimizeCompleted',
  'highlightColor',
  'milestonesComplete',
  'showRetirement',
  'theme',
];
const PREFIX = 'BRUHLAD1:';

function encode(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return PREFIX + btoa(bin);
}

function decode(code: string): Record<string, string> | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) return null;
  try {
    const bin = atob(trimmed.slice(PREFIX.length));
    const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
    const out: Record<string, string> = {};
    for (const k of KEYS) if (typeof obj[k] === 'string') out[k] = obj[k];
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function makeBackup(): string {
  const data: Record<string, string> = {};
  for (const k of KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) data[k] = v;
  }
  return encode(data);
}

export default function Backup() {
  const [mode, setMode] = useState<'closed' | 'backup' | 'restore'>('closed');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  const openBackup = () => {
    setCode(makeBackup());
    setMsg('');
    setMode('backup');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setMsg('Copied. Paste it somewhere safe (notes app, email to yourself).');
    } catch {
      setMsg('Copy failed — select the text and copy it manually.');
    }
  };

  const restore = () => {
    const data = decode(code);
    if (!data) {
      setMsg("That doesn't look like a valid backup code.");
      return;
    }
    if (!window.confirm('Replace your current progress, highlights and settings with this backup?')) return;
    for (const k of KEYS) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    location.reload();
  };

  return (
    <footer className="site-footer">
      <div className="footer-actions">
        <button onClick={openBackup}>Backup progress</button>
        <button
          onClick={() => {
            setCode('');
            setMsg('');
            setMode('restore');
          }}
        >
          Restore backup
        </button>
      </div>
      {mode !== 'closed' && (
        <div className="backup-panel">
          <p>
            {mode === 'backup'
              ? 'Your progress, highlights and settings as a text code:'
              : 'Paste a backup code. This replaces everything currently saved on this device.'}
          </p>
          <textarea
            value={code}
            readOnly={mode === 'backup'}
            onChange={(e) => setCode(e.target.value)}
            onFocus={(e) => mode === 'backup' && e.currentTarget.select()}
            rows={4}
            spellCheck={false}
            aria-label="Backup code"
          />
          <div className="footer-actions">
            {mode === 'backup' ? (
              <button onClick={copy}>Copy</button>
            ) : (
              <button onClick={restore} disabled={!code.trim()}>
                Restore
              </button>
            )}
            <button onClick={() => setMode('closed')}>Close</button>
          </div>
          {msg && <p className="backup-msg">{msg}</p>}
        </div>
      )}
    </footer>
  );
}
