// Copies what the site takes from the design kit (design/brand-kit): stylesheets, fonts, logos and the theme builder script.
// The kit's look (Mist tokens, brand, token map, control standard, components, states, shell, Mist skin) goes into ONE cascade layer,
// `xoong-standard`, declared after the framework's own layers: it beats the framework's defaults, and anything a consumer or a
// third-party theme writes (unlayered, or in a later layer) beats it. Files are in the same layer in the same order, so they cascade
// among themselves exactly as the kit's pages do. Fonts and print styles stay outside the layer.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';

const kit = new URL('../design/brand-kit/', import.meta.url);
const site = new URL('../site/', import.meta.url);
// [kit file, site file, in the layer]
const css = [['fonts.css', 'fonts.css', false], ['mist-tokens.css', 'mist-tokens.css', true], ['brand.css', 'brand.css', true], ['xo-map.css', 'xo-map.css', true],
  ['controls.css', 'standard.css', true], ['icons.css', 'icons.css', true], ['components.css', 'components.css', true], ['states.css', 'states.css', true],
  ['controls-new.css', 'controls-new.css', true], ['shell.css', 'shell.css', true], ['mist.css', 'mist.css', true], ['print.css', 'print.css', false]];
for (const [from, to, layered] of css) {
  let text = readFileSync(new URL(`css/${from}`, kit), 'utf8');
  if (from === 'fonts.css') text = text.replaceAll('../assets/fonts/', '../fonts/'); // the fonts are copied to site/fonts
  writeFileSync(new URL(`src/${to}`, site), layered ? `/* ${from} of the design kit, in the layer xoong-standard (tools/kit-css.mjs) */\n@layer xoong-standard {\n${text}\n}\n` : text);
}
const copyAll = (fromDir, toDir, filter = () => true) => {
  mkdirSync(new URL(toDir, site), { recursive: true });
  for (const name of readdirSync(new URL(fromDir, kit)).filter(filter)) copyFileSync(new URL(`${fromDir}${name}`, kit), new URL(`${toDir}${name}`, site));
};
copyAll('assets/fonts/', 'fonts/');
copyAll('assets/mist/', 'brand/mist/');
copyFileSync(new URL('js/theme-builder.js', kit), new URL('src/theme-builder.js', site));
console.log(`copied ${css.length} stylesheets, the fonts, the Mist logos and the theme builder script`);
