// A deleted row must be collectable. A closure created inside the list effect kept that run's `next` map, and with it every row of that run (rows that were
// removed later too), alive for as long as one row of that run lived: after a sort, going from 1,000 rows back to 10 left 1,000 detached rows in memory.
// Real Chromium, the people screen of benchmarks/ built with `xoong build`, forced garbage collection.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { build } from '../../cli/src/build.js';
import { sync } from '../../cli/src/commands.js';
import { serve } from '../../../benchmarks/lib/serve.mjs';
import { launchChromium } from '../../../tools/browser.mjs';

const repo = new URL('../../..', import.meta.url).pathname;
const app = join(repo, 'benchmarks/apps/xoong');
let server, browser;
beforeAll(async () => {
  await sync(join(repo, 'benchmarks/shared/openapi.json'), { out: join(app, '.xoong'), hints: join(app, 'xoong.hints.json') });
  const out = join(await mkdtemp(join(tmpdir(), 'xoong-release-')), 'dist');
  await build({ root: app, out });
  server = await serve({ root: out, rows: 1000 });
  browser = await launchChromium();
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

describe('rows of a list that left are released', () => {
  it('after a sort, going back from 1,000 rows to 10 leaves only about ten rows in memory', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.goto(server.url);
    await page.waitForSelector('tbody tr');
    const rows = (n) => page.waitForFunction((count) => document.querySelectorAll('tbody tr').length === count, n);
    await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('1000'); await rows(1000);
    await page.getByRole('button', { name: 'Name' }).click(); await page.waitForTimeout(400);
    await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('10'); await rows(10);
    await page.waitForTimeout(300);
    await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const nodes = metrics.find((m) => m.name === 'Nodes').value;
    expect(nodes, 'DOM nodes alive after 990 rows were removed (1,000 rows are about 14,000 nodes)').toBeLessThan(2000);
    await ctx.close();
  }, 60000);
});
