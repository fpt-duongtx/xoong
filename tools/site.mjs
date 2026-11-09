// Writes the documentation site's generated files from tools/site/*.mjs:
//   site/*.html          the pages (tools/site/pages.mjs)
//   site/reference.json  the reference as data (tools/site/reference-data.mjs)
//   site/search-index.json  the index of the search and the Reference menu (tools/site/search-index.mjs)
//   node tools/site.mjs          write them
//   node tools/site.mjs --check  fail when a file on disk differs from what the sources produce (used by the tests)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pages } from './site/pages.mjs';
import { layout } from './site/lib.mjs';
import { referenceJson } from './site/reference-data.mjs';
import { searchIndexJson } from './site/search-index.mjs';

const site = new URL('../site/', import.meta.url).pathname;

/** @returns {{ file: string, html: string }[]} */
export const render = () => pages.map((page) => ({ file: page.file, html: layout({ pages, page }) }));

/** The generated data files: `{ file, text }`. llms.txt is the one file of the repository the site also serves (for assistants without MCP). */
export const data = () => [{ file: 'reference.json', text: referenceJson() }, { file: 'search-index.json', text: searchIndexJson(pages) }, { file: 'llms.txt', text: readFileSync(new URL('../llms.txt', import.meta.url), 'utf8') }];

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const { file, html } of [...render(), ...data().map((d) => ({ file: d.file, html: d.text }))]) {
    const path = join(site, file);
    if (check) { if (!existsSync(path) || readFileSync(path, 'utf8') !== html) stale.push(file); } else writeFileSync(path, html);
  }
  const known = new Set(pages.map((p) => p.file));
  for (const f of readdirSync(site).filter((n) => n.endsWith('.html') && !known.has(n) && !n.startsWith('live-'))) stale.push(`${f} (no source)`); // live-*.html are the two full-page demos: whole apps, not generated
  if (check && stale.length) { console.error(`site files out of date: ${stale.join(', ')}. Run: npm run site`); process.exit(1); }
  if (!check) console.log(`wrote ${pages.length} pages, reference.json and search-index.json`);
}
