# bruh-lad

A personal **OSRS Ironman Guide** site with two account types:

- **Ironman:** the **BRUHsailer** guide, plus **Ladlor's gear progression chart**.
- **Ultimate Ironman:** the OSRS Wiki's **Ultimate Ironman Walkthrough Guide to
  Prifddinas**, in the same checklist format.

- **Guide** tab: step checklist, search, highlight / remove highlights, reset
  progress. *Minimize completed* (on by default) hides finished steps except
  the latest one.
- **Progression** tab: Ladlor's chart — click an item to mark it obtained,
  right-click for its wiki page. Optional "Retirement home" section.
- Light / Dark / Auto (system) theme.
- **Backup progress / Restore backup** (page footer): all progress,
  highlights and settings as one text code, to keep safe or move to another
  device.

## Staying up to date

Guide and chart data are fetched live from upstream (GitHub, and the OSRS Wiki
API for the Ultimate Ironman guide) on every page load, so guide updates and the **Last updated** date appear
automatically — no redeploy needed. `public/data` holds fallback copies used
only if GitHub is unreachable; refresh them with `npm run sync-data`.

BRUHsailer progress is keyed by step position (e.g. step `1-12`), the same as
the original site, so inserted or removed steps upstream can shift later ticks.
Ultimate Ironman steps are keyed by their text instead, because the wiki guide
is edited often: an edit only resets the ticks of the steps that changed.

## Progress storage

Progress lives in the browser's `localStorage`: per browser, per device, and
per site address. Use the backup code to keep a copy or move it elsewhere.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`
(Settings → Pages → Source: GitHub Actions).

## Credits

- **BRUHsailer guide** by So Iron BRUH and ParasailerOSRS —
  [Google Doc](https://docs.google.com/document/d/1CBkFM70SnrW4hJXvHM2F1fYCuBF_fRnEXnTYgRnRkAE).
- **Original web version** by kyyznn — [umkyzn/BRUHsailer](https://github.com/umkyzn/BRUHsailer).
  Guide data is loaded from that repository.
- **Ladlor's Interactive Gear Progression Chart** — [ladlorchart.com](https://ladlorchart.com/),
  source [Madssb/InteractiveGearProg](https://github.com/Madssb/InteractiveGearProg)
  (MIT, see `licenses/ladlorchart-MIT.txt`). Chart data and item icons come from that repository.
- **Ultimate Ironman Walkthrough Guide to Prifddinas** by OSRS Wiki contributors —
  [OSRS Wiki](https://oldschool.runescape.wiki/w/Guide:Ultimate_Ironman_Walkthrough_Guide_To_Prifddinas),
  licensed [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/). Loaded live from the wiki API;
  `public/data/uim` is a fallback copy.
