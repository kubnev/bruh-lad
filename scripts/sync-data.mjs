// Refresh the bundled fallback copies in public/data from upstream.
// The site fetches upstream live, so this only matters if GitHub is unreachable.
import { mkdir, writeFile } from 'node:fs/promises';

const GUIDE = 'https://raw.githubusercontent.com/umkyzn/BRUHsailer/main/data';
const LADLOR = 'https://raw.githubusercontent.com/Madssb/InteractiveGearProg/main/data';
const UIM_PAGE = 'Guide:Ultimate_Ironman_Walkthrough_Guide_To_Prifddinas';
const WIKI_API = 'https://oldschool.runescape.wiki/api.php';

const files = [
  [`${GUIDE}/guide_data.json`, 'public/data/guide_data.json'],
  [`${LADLOR}/logic/milestone-sequence-main.json`, 'public/data/ladlor/milestone-sequence-main.json'],
  [`${LADLOR}/logic/milestone-sequence-retirement.json`, 'public/data/ladlor/milestone-sequence-retirement.json'],
  [`${LADLOR}/generated/milestone-metadata.json`, 'public/data/ladlor/milestone-metadata.json'],
  [`${WIKI_API}?action=parse&page=${UIM_PAGE}&prop=text|revid&format=json&formatversion=2&redirects=1`, 'public/data/uim/parse.json'],
  [`${WIKI_API}?action=query&prop=revisions&rvprop=timestamp&titles=${UIM_PAGE}&format=json&formatversion=2&redirects=1`, 'public/data/uim/revision.json'],
];

await mkdir('public/data/ladlor', { recursive: true });
await mkdir('public/data/uim', { recursive: true });
for (const [url, dest] of files) {
  // The wiki asks API clients to identify themselves.
  const res = await fetch(url, { headers: { 'User-Agent': 'bruh-lad guide data sync' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await writeFile(dest, await res.text());
  console.log(`${dest} <- ${url}`);
}
