// Two look fixes were made in generated files (packages/ui/src/mist.css, site/src/controls-new.css) and lost the next time they were regenerated from the design kit,
// because the kit (design/brand-kit/css) is the source. This keeps them in the source and in everything made from it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const file = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const copies = ['design/brand-kit/css/controls-new.css', 'site/src/controls-new.css', 'site/live-kit/css/controls-new.css', 'packages/ui/src/mist.css'];

describe('look fixes live in the kit and in what is made from it', () => {
  for (const path of copies) {
    describe(path, () => {
      const css = file(path);
      it('the knob of a switch that is off sits at the left edge (the track centres its content unless told otherwise)', () => {
        const rule = css.match(/\.xo-switch \{[^}]*\}/)?.[0] ?? '';
        expect(rule).toContain('justify-content: flex-start');
      });
      it('the arrow of a split button (a trigger inside <xo-menu>) squares the edge it shares with the main button', () => {
        expect(css).toMatch(/\.xo-split-button > xo-menu:last-child > \[xo-menu-trigger\]/);
        expect(css).toMatch(/\.xo-split-button > xo-menu \{ display: inline-flex; \}/);
      });
    });
  }
});
