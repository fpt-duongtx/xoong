import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import '@xoong/controls';

// A control is moved in the DOM (a row is reordered, a node is re-attached), so connectedCallback runs again on a node
// that already holds the drawn control. It must draw once: the same markup after the move as before it.
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const PAGES = ['more-controls', 'combobox', 'carousel', 'tabs', 'menu', 'forms', 'controls'];
const main = (name) => {
  const html = readFileSync(join(process.cwd(), 'site', `${name}.html`), 'utf8'); // vitest runs from the repository root
  const body = /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? '';
  return body.replace(/<script[\s\S]*?<\/script>/g, '');
};
// ids are generated per connection (aria links point at them): compare the markup without them
const shape = (el) => el.innerHTML.replace(/\s(id|for|aria-controls|aria-labelledby|aria-describedby|aria-activedescendant|list)="[^"]*"/g, '');

afterEach(() => { document.body.innerHTML = ''; });

describe('controls are drawn once when they are moved or re-attached', () => {
  for (const page of PAGES) {
    it(`${page}: every control keeps the same markup after remove + append`, async () => {
      document.body.innerHTML = main(page);
      await wait(60);
      const controls = [...document.body.querySelectorAll('*')].filter((e) => e.localName.startsWith('xo-') && customElements.get(e.localName) && !e.parentElement.closest('xo-view, xo-form, xo-table'));
      expect(controls.length).toBeGreaterThan(0);
      const before = new Map(controls.map((el) => [el, shape(el)]));
      for (const el of controls) {
        const parent = el.parentNode;
        const next = el.nextSibling;
        el.remove();
        parent.insertBefore(el, next);
      }
      await wait(60);
      const changed = controls.filter((el) => shape(el) !== before.get(el)).map((el) => `${el.localName}${el.getAttribute('name') ? `[${el.getAttribute('name')}]` : ''}`);
      expect(changed).toEqual([]);
    });
  }

  for (const page of PAGES) {
    it(`${page}: a copy of the drawn control (a snapshot, a cloned row) is drawn once, not doubled`, async () => {
      document.body.innerHTML = main(page);
      await wait(60);
      const top = [...document.body.querySelectorAll('*')].filter((e) => e.localName.startsWith('xo-') && customElements.get(e.localName) && !e.parentElement.closest('xo-view, xo-form, xo-table, xo-tabs, xo-carousel, xo-menu, xo-accordion'));
      expect(top.length).toBeGreaterThan(0);
      const holder = document.createElement('div');
      document.body.append(holder);
      const doubled = [];
      for (const el of top) {
        const copy = el.cloneNode(true);
        holder.append(copy);
        await wait(5);
        const count = (n) => n.querySelectorAll('*').length;
        if (count(copy) > count(el)) doubled.push(`${el.localName}: ${count(el)} -> ${count(copy)}`);
        copy.remove();
      }
      expect(doubled).toEqual([]);
    });
  }
});
