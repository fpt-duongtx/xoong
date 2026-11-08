// Writes the documentation site's HTML pages (site/*.html) from tools/site/pages.mjs.
//   node tools/site.mjs          write the pages
//   node tools/site.mjs --check  fail when a page on disk differs from what the sources produce (used by the tests)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pages } from './site/pages.mjs';
import { layout } from './site/lib.mjs';

const site = new URL('../site/', import.meta.url).pathname;

/** @returns {{ file: string, html: string }[]} */
export const render = () => pages.map((page) => ({ file: page.file, html: layout({ pages, page }) }));

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const { file, html } of render()) {
    const path = join(site, file);
    if (check) { if (!existsSync(path) || readFileSync(path, 'utf8') !== html) stale.push(file); } else writeFileSync(path, html);
  }
  const known = new Set(pages.map((p) => p.file));
  for (const f of readdirSync(site).filter((n) => n.endsWith('.html') && !known.has(n))) stale.push(`${f} (no source)`);
  if (check && stale.length) { console.error(`site pages out of date: ${stale.join(', ')}. Run: npm run site`); process.exit(1); }
  if (!check) console.log(`wrote ${pages.length} pages`);
}
