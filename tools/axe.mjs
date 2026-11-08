// Runs axe-core (a dev dependency) in a Playwright page and returns the violations as plain data.
// The source is evaluated through the browser protocol, which a page's strict Content-Security-Policy does not block (an injected <script> would be).
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * @param {import('playwright-core').Page} page
 * @param {{ include?: string, exclude?: string[], disable?: string[] }} [options]
 * @returns {Promise<{ id: string, impact: string, help: string, nodes: string[] }[]>}
 */
export async function axe(page, { include, exclude = [], disable = [] } = {}) {
  await page.evaluate(source);
  return page.evaluate(async ({ include, exclude, disable, tags }) => {
    const context = { include: [include ?? 'html'], exclude: exclude.map((s) => [s]) };
    const rules = Object.fromEntries(disable.map((id) => [id, { enabled: false }]));
    const result = await /** @type {any} */ (window).axe.run(context, { runOnly: { type: 'tag', values: tags }, rules });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} | ${(n.failureSummary ?? '').split('\n').slice(1, 2).join('').trim()}`) }));
  }, { include, exclude, disable, tags: TAGS });
}
