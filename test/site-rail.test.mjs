// The "On this page" rail of the generated site: it lists the sections of the page, not the headings that belong to an example, and a page whose controls are real elements loads their scripts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const page = (name) => readFileSync(new URL(`../site/${name}`, import.meta.url), 'utf8');
const rail = (html) => [...(html.match(/<aside class="rail"[\s\S]*?<\/aside>/)?.[0] ?? '').matchAll(/<a href="#([^"]+)"[^>]*>([^<]*)/g)].map((m) => m[2]);

describe('the rail of "On this page"', () => {
  it('All controls lists its sections, not the dialog titles and the editor content shown inside examples', () => {
    expect(rail(page('controls-demo.html'))).toEqual(['Tabs', 'Menu and tooltip', 'Combobox and tags', 'Carousel', 'Data table', 'Forms', 'Rich text', 'Dialog, confirm, toast']);
  });

  it('a heading the design kit already gave an id is listed, a heading in a side panel is not (icons)', () => {
    const icons = rail(page('icons.html'));
    expect(icons).toContain('Use it');
    expect(icons).not.toContain('edit'); // the selected-icon panel is an <aside>
  });

  it('every page with a rail has at least two entries and no entry repeats', () => {
    for (const name of ['controls-demo.html', 'more-controls.html', 'overlays.html', 'components.html', 'data.html']) {
      const entries = rail(page(name));
      expect(entries.length, name).toBeGreaterThan(1);
      expect(new Set(entries).size, name).toBe(entries.length);
    }
  });
});

describe('All controls shows real elements', () => {
  it('loads the demo script, so xo-view, xo-richtext and the rest are defined (an undefined <xo-view> is hidden by the page CSS)', () => {
    expect(page('controls-demo.html')).toContain('src="src/demo.js"');
  });
});
