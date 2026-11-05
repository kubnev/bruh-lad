import { useEffect, useState } from 'react';

// Upstream sources. Data is fetched live so guide updates (and the
// "last updated" date) show up without redeploying this site. The copies in
// public/data are only a fallback if a source is unreachable.
export const GUIDE_RAW = 'https://raw.githubusercontent.com/umkyzn/BRUHsailer/main/data';
export const LADLOR_RAW = 'https://raw.githubusercontent.com/Madssb/InteractiveGearProg/main';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export async function fetchWithFallback<T>(remote: string, local: string): Promise<T> {
  try {
    return await fetchJson<T>(remote);
  } catch (err) {
    console.warn('Remote fetch failed, using bundled copy:', err);
    return fetchJson<T>(local);
  }
}

/** Runs `fn` whenever `deps` change; `fn` may return null to skip (stays in the loading state). */
export function useAsync<T>(fn: () => Promise<T> | null, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({
    data: null,
    error: null,
  });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, error: null });
    const promise = fn();
    if (!promise) return;
    promise.then(
      (data) => !cancelled && setState({ data, error: null }),
      (err: unknown) =>
        !cancelled && setState({ data: null, error: err instanceof Error ? err.message : String(err) })
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
