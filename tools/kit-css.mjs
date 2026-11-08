// Copies the design kit's stylesheets (design/brand-kit/css) into the site. The kit's standard look of the components (token map, control
// standard, components, states, icons) goes into ONE cascade layer, `xoong-standard`, declared after the framework's own layers: it beats
// the framework's defaults, and anything a consumer or a third-party theme writes (unlayered, or in a later layer) beats it.
// The brand and the shell are in the same layer, in the same order, so they cascade among themselves exactly as the kit's pages do; only the
// pieces the generator adds on top (site.css) and the print styles stay unlayered.
import { readFileSync, writeFileSync } from 'node:fs';

const kit = new URL('../design/brand-kit/css/', import.meta.url);
const site = new URL('../site/src/', import.meta.url);
const copy = [['brand.css', 'brand.css', true], ['shell.css', 'shell.css', true], ['print.css', 'print.css', false],
  ['xo-map.css', 'xo-map.css', true], ['controls.css', 'standard.css', true], ['components.css', 'components.css', true], ['states.css', 'states.css', true], ['icons.css', 'icons.css', true]];
for (const [from, to, layered] of copy) {
  const css = readFileSync(new URL(from, kit), 'utf8');
  writeFileSync(new URL(to, site), layered ? `/* ${from} of the design kit, in the layer xoong-standard (tools/kit-css.mjs) */\n@layer xoong-standard {\n${css}\n}\n` : css);
}
console.log(`copied ${copy.length} stylesheets`);
