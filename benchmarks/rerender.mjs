// Re-render probe: when ONE thing changes on the people screen, how much of the DOM is touched? A MutationObserver counts the nodes added and removed
// (and attribute and text changes) around each action, rows are marked beforehand so we can see how many survive as the same element, and for xoong the number of
// effect runs is counted too (the served copy of @xoong/core's signals.js gets a counter; nothing else is changed).
//   node benchmarks/rerender.mjs [--out results/rerender.json]
// Every scenario starts from 1,000 people shown (page size 1,000). Counts are deterministic: they do not depend on the speed of the machine.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serve } from './lib/serve.mjs';
import { launchChromium } from '../tools/browser.mjs';
import { apps, root } from './lib/apps.mjs';
import { environment } from './lib/env.mjs';
import { mode } from './lib/acceptance.mjs';

const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : join(root, 'results/rerender.json');
const STACKS = ['xoong', 'react', 'vue', 'angular'];
const SETTLE = 600; // ms after the awaited change: late refetches and redraws must show up too

const PROBE = () => {
  let observer, records = [];
  const size = (node) => { let n = 1; if (node.nodeType === 1) { const w = document.createTreeWalker(node, NodeFilter.SHOW_ALL); while (w.nextNode()) n++; } return n; };
  window.__probe = {
    mark() { document.querySelectorAll('tbody tr').forEach((tr, i) => { tr.__probe = i; }); window.__focus = document.activeElement; },
    start() { records = []; window.__effectRuns = 0; observer = new MutationObserver((r) => records.push(...r)); observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true }); },
    stop() {
      records.push(...observer.takeRecords()); observer.disconnect();
      let added = 0, removed = 0, attributes = 0, text = 0;
      for (const r of records) {
        if (r.type === 'childList') { r.addedNodes.forEach((n) => { added += size(n); }); r.removedNodes.forEach((n) => { removed += size(n); }); } else if (r.type === 'attributes') attributes++; else text++;
      }
      const rows = [...document.querySelectorAll('tbody tr')];
      return { added, removed, attributes, text, rows: rows.length, rowsSame: rows.filter((tr) => '__probe' in tr).length, effectRuns: window.__effectRuns };
    },
  };
};

async function scenarios(page, base, step) {
  const rows = () => page.locator('tbody tr');
  const total = (text) => page.getByText(text, { exact: true }).waitFor({ timeout: 10000 });
  const open = async (size = 1000) => {
    await mode(page, base, 'normal', 1000);
    await page.goto(base + '/');
    await page.getByText('1–10 of 1000', { exact: true }).waitFor({ timeout: 10000 });
    await page.getByRole('combobox', { name: 'Rows per page' }).selectOption(String(size));
    await page.waitForFunction((n) => document.querySelectorAll('tbody tr').length === n, size, { timeout: 10000 });
    await page.waitForTimeout(300);
    await page.evaluate(PROBE);
  };
  const run = async (name, action) => { await page.evaluate(() => window.__probe.mark()); await page.evaluate(() => window.__probe.start()); await action(); await page.waitForTimeout(SETTLE); step(name, await page.evaluate(() => window.__probe.stop())); };

  await open();
  await run('Disable one person', async () => { await rows().nth(4).getByRole('button', { name: 'Disable' }).click(); await page.waitForFunction(() => document.querySelectorAll('tbody tr')[4].children[4].textContent.trim() === 'disabled'); });
  await run('Tick one row', () => rows().nth(7).getByRole('checkbox', { name: 'Select row' }).check());
  await run('Untick it again', () => rows().nth(7).getByRole('checkbox', { name: 'Select row' }).uncheck());
  await run('Sort by name', async () => { await page.getByRole('button', { name: 'Name' }).click(); await page.waitForSelector('th[aria-sort="ascending"]'); });
  await run('Type a letter in the add dialog (nothing else changes)', async () => { await page.getByRole('button', { name: 'Add a person' }).click(); await page.getByRole('textbox', { name: /^Name/ }).pressSequentially('Zed'); });
  await run('Add one person, who is not on this page (the list is fetched again)', async () => {
    await page.getByRole('textbox', { name: /^Email/ }).fill('zed@example.com'); await page.getByRole('combobox', { name: /^Role/ }).selectOption('admin');
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  });
  await open();
  await run('Delete one person (the next one moves up into the page)', async () => {
    await rows().nth(3).getByRole('checkbox', { name: 'Select row' }).check();
    await page.getByRole('button', { name: 'Delete selected' }).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click(); await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
  });
  await open();
  await run('Search "person99" (11 of the 1,000 match)', async () => { await page.getByRole('searchbox', { name: 'Search' }).fill('person99'); await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 11); });
  await run('Clear the search (back to 1,000)', async () => { await page.getByRole('searchbox', { name: 'Search' }).fill(''); await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1000); });
  await run('Rows per page 1,000 to 100', async () => { await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('100'); await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 100); });
  await run('Next page (100 rows, all different)', async () => { await page.getByRole('button', { name: 'Next' }).click(); await page.waitForFunction(() => document.querySelector('tbody tr').children[2].textContent.trim() === 'person101@example.com'); });
}

const result = { environment: null, method: 'MutationObserver on document.body (childList, attributes, characterData; nodes counted with their descendants); "rows kept" = rows that are the same element as before the action', scenarios: {} };
const browser = await launchChromium();
result.environment = environment({ browser: `Chromium ${browser.version()}` });
for (const id of STACKS) {
  const app = apps[id];
  const transform = id === 'xoong' ? (path, body) => (path.endsWith('/@xoong/core/src/signals.js') ? Buffer.from(body.toString().replace('  run() {\n    if (this.disposed) return;\n    this.cleanup?.();', '  run() {\n    if (this.disposed) return;\n    globalThis.__effectRuns = (globalThis.__effectRuns ?? 0) + 1;\n    this.cleanup?.();')) : body) : undefined;
  const server = await serve({ root: join(app.dir, app.dist), rows: 1000, transform });
  const ctx = await browser.newContext({ bypassCSP: true });
  const page = await ctx.newPage();
  await scenarios(page, server.url, (name, m) => { (result.scenarios[name] ??= {})[id] = id === 'xoong' ? m : { ...m, effectRuns: undefined }; console.log(id.padEnd(8), name.padEnd(70), JSON.stringify(m)); });
  await ctx.close(); await server.close();
}
await writeFile(out, JSON.stringify(result, null, 1) + '\n');
await browser.close();
