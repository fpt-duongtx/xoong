// The acceptance test every implementation of the people screen must pass: the same checks, written against roles and accessible names
// only (never class names or framework markup), run in real Chromium. A screen that fails any check is not benchmarked.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const TIMEOUT = 5000;

export const mode = (page, base, m, rows) => page.request.post(`${base}/__bench/mode`, { data: { mode: m, ...(rows ? { rows } : {}) } });
export const total = async (page, base) => (await (await page.request.get(`${base}/api/people?limit=1`)).json()).total;
const rowCount = (page) => page.locator('tbody tr').count();
const firstCell = (page) => page.locator('tbody tr').first().locator('td').nth(1).innerText();
const range = (page, text) => page.getByText(text, { exact: true }).waitFor({ timeout: TIMEOUT });

/** @returns {Promise<{ name: string, pass: boolean, error?: string }[]>} */
export async function acceptance(page, base) {
  const results = [];
  const check = async (name, fn) => {
    try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: String(e.message).split('\n')[0] }); }
  };
  const open = async (m = 'normal') => { await mode(page, base, m, 10000); await page.goto(base + '/'); };

  await check('shows the first 10 of 10,000 people with a range text', async () => {
    await open();
    await page.getByRole('heading', { name: 'People', level: 1 }).waitFor({ timeout: TIMEOUT });
    await range(page, '1–10 of 10000');
    if ((await rowCount(page)) !== 10) throw new Error(`expected 10 rows, got ${await rowCount(page)}`);
  });
  await check('accessibility: no axe-core violations (WCAG 2 A and AA), table headers and controls have names', async () => {
    await page.evaluate(axeSource);
    const v = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }).then((r) => r.violations.map((x) => x.id)));
    if (v.length) throw new Error('axe: ' + v.join(', '));
    for (const name of ['Name', 'E-mail', 'Role', 'Status']) await page.getByRole('columnheader', { name }).waitFor({ timeout: 1000 });
    await page.getByRole('searchbox', { name: 'Search' }).waitFor({ timeout: 1000 });
  });
  await check('server-side sort: ascending, then descending, with aria-sort', async () => {
    await page.getByRole('button', { name: 'Name' }).click();
    await page.waitForFunction(() => document.querySelector('th[aria-sort="ascending"]'), null, { timeout: TIMEOUT });
    await page.waitForFunction(() => document.querySelector('tbody td:nth-child(2)')?.textContent?.startsWith('Ada Lovelace'), null, { timeout: TIMEOUT });
    await page.getByRole('button', { name: 'Name' }).click();
    await page.waitForFunction(() => document.querySelector('th[aria-sort="descending"]'), null, { timeout: TIMEOUT });
  });
  await check('server-side search narrows the list (111 matches for "person99")', async () => {
    await page.getByRole('searchbox', { name: 'Search' }).fill('person99');
    await range(page, '1–10 of 111');
    await page.getByRole('searchbox', { name: 'Search' }).fill('');
    await range(page, '1–10 of 10000');
  });
  await check('server-side paging: Next and Previous', async () => {
    await page.getByRole('button', { name: 'Next' }).click();
    await range(page, '11–20 of 10000');
    await page.getByRole('button', { name: 'Previous' }).click();
    await range(page, '1–10 of 10000');
  });
  await check('rows per page: 100 rows', async () => {
    await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('100');
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 100, null, { timeout: TIMEOUT });
    await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('10');
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 10, null, { timeout: TIMEOUT });
  });
  await check('row selection shows "Delete selected"; select all ticks the page', async () => {
    await open();
    await range(page, '1–10 of 10000');
    if (await page.getByRole('button', { name: 'Delete selected' }).count()) throw new Error('bulk button shown with nothing selected');
    await page.getByRole('checkbox', { name: 'Select row' }).nth(0).check();
    await page.getByRole('button', { name: 'Delete selected' }).waitFor({ timeout: 1000 });
    await page.getByRole('checkbox', { name: 'Select all rows' }).check();
    if ((await page.getByRole('checkbox', { name: 'Select row', checked: true }).count()) !== 10) throw new Error('select all did not tick 10 rows');
    await page.getByRole('checkbox', { name: 'Select all rows' }).uncheck();
    if (await page.getByRole('button', { name: 'Delete selected' }).count()) throw new Error('bulk button still shown');
  });
  await check('bulk delete asks first (Cancel keeps everything), then deletes the 2 ticked people', async () => {
    await page.getByRole('checkbox', { name: 'Select row' }).nth(0).check();
    await page.getByRole('checkbox', { name: 'Select row' }).nth(1).check();
    await page.getByRole('button', { name: 'Delete selected' }).click();
    const dlg = page.getByRole('alertdialog');
    await dlg.waitFor({ timeout: 1000 });
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await dlg.waitFor({ state: 'hidden', timeout: 1000 });
    if ((await total(page, base)) !== 10000) throw new Error('Cancel deleted something');
    await page.getByRole('button', { name: 'Delete selected' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await range(page, '1–10 of 9998');
    if ((await total(page, base)) !== 9998) throw new Error('server total is not 9998');
  });
  await check('add dialog: opens with focus inside, rejects an empty form without closing', async () => {
    await page.getByRole('button', { name: 'Add a person' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.waitFor({ timeout: 1000 });
    if (!(await page.evaluate(() => document.activeElement?.closest('dialog') !== null))) throw new Error('focus is not inside the dialog');
    await dlg.getByRole('button', { name: 'Add', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('dialog[open] [aria-invalid="true"]'), null, { timeout: 1000 });
    if (!(await dlg.isVisible())) throw new Error('dialog closed on an invalid form');
  });
  await check('add dialog: shows a server-side field error (email taken)', async () => {
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('textbox', { name: /^Name/ }).fill('Zed Zeta');
    await dlg.getByRole('textbox', { name: /^Email/ }).fill('person3@example.com');
    await dlg.getByRole('combobox', { name: /^Role/ }).selectOption('admin');
    await dlg.getByRole('button', { name: 'Add', exact: true }).click();
    await dlg.getByText('email is already taken').waitFor({ timeout: TIMEOUT });
    if (!(await dlg.isVisible())) throw new Error('dialog closed on a server error');
  });
  await check('add dialog: a valid form creates the person and closes; Escape closes the dialog', async () => {
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('textbox', { name: /^Email/ }).fill('zed@example.com');
    await dlg.getByRole('button', { name: 'Add', exact: true }).click();
    await dlg.waitFor({ state: 'hidden', timeout: TIMEOUT });
    if ((await total(page, base)) !== 9999) throw new Error('server total is not 9999');
    await page.getByRole('button', { name: 'Add a person' }).click();
    await page.getByRole('dialog').waitFor({ timeout: 1000 });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 1000 });
  });
  await check('row action: Disable changes that row to "disabled"', async () => {
    await open();
    await range(page, '1–10 of 10000');
    await page.locator('tbody tr').first().getByRole('button', { name: 'Disable' }).click();
    await page.waitForFunction(() => document.querySelector('tbody tr td:nth-child(5)')?.textContent?.trim() === 'disabled', null, { timeout: TIMEOUT });
  });
  await check('loading state: a status message while the list is slow', async () => {
    await mode(page, base, 'slow');
    await page.goto(base + '/');
    await page.getByRole('status').filter({ hasText: 'Loading' }).waitFor({ timeout: 600 });
    await range(page, '1–10 of 10000');
  });
  await check('empty state: "No people found"', async () => {
    await open('empty');
    await page.getByText('No people found').waitFor({ timeout: TIMEOUT });
  });
  await check('error state: an alert that says what failed', async () => {
    await open('error');
    await page.getByRole('alert').filter({ hasText: 'The list could not be loaded' }).waitFor({ timeout: TIMEOUT });
  });
  await mode(page, base, 'normal', 10000);
  return results;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { serve } = await import('./serve.mjs');
  const { launchChromium } = await import('../../tools/browser.mjs');
  const { appDir } = await import('./apps.mjs');
  const name = process.argv[2];
  const s = await serve({ root: appDir(name) });
  const browser = await launchChromium();
  const ctx = await browser.newContext({ bypassCSP: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const results = await acceptance(page, s.url);
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.error ? '\n      ' + r.error : ''}`);
  console.log(`\n${name}: ${results.filter((r) => r.pass).length}/${results.length} checks passed${errors.length ? `, ${errors.length} page errors: ${errors[0]}` : ''}`);
  await browser.close(); await s.close();
  process.exitCode = results.every((r) => r.pass) && !errors.length ? 0 : 1;
}
