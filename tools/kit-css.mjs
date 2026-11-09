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

// ---- the two live demo pages (design/brand-kit/live-admin.html, live-landing.html) as standalone pages of the site ----
// They are whole apps (their own header and shell), so they do not use the docs layout: the kit's CSS is copied as it is (unlayered, the order the
// pages load it) into site/live-kit, the fonts and logos are the site's own, and the pages are made strict-CSP clean: no style="" attributes
// (each distinct one becomes a class in live-kit/css/live-site.css) and no inline script.
const live = new URL('live-kit/', site);
mkdirSync(new URL('css/', live), { recursive: true });
mkdirSync(new URL('js/', live), { recursive: true });
const liveHtml = ['live-admin.html', 'live-landing.html'].map((f) => readFileSync(new URL(f, kit), 'utf8')).join('\n');
for (const name of readdirSync(new URL('css/', kit)).filter((n) => liveHtml.includes(`href="css/${n}"`))) { // only the stylesheets the pages load
  let text = readFileSync(new URL(`css/${name}`, kit), 'utf8');
  if (name === 'fonts.css') text = text.replaceAll('../assets/fonts/', '../../fonts/'); // the site's own copy of the fonts
  writeFileSync(new URL(`css/${name}`, live), text);
}
copyFileSync(new URL('js/live-demo.js', kit), new URL('js/live-demo.js', live));
const styleClasses = new Map();
const classFor = (style) => {
  const key = style.trim().replace(/;$/, '');
  if (!styleClasses.has(key)) styleClasses.set(key, `live-s${styleClasses.size + 1}`);
  return styleClasses.get(key);
};
/** The way between the demos and back to the docs: a small bar fixed at the bottom left of each live page (the pages have no docs header of their own). */
const demoSwitch = (current) => `<nav class="demo-switch" aria-label="xoong live demos">
  <a href="overview.html">&larr; Docs</a>
  <a href="demo.html">Live demos</a>
  <a href="live-admin.html"${current === 'live-admin.html' ? ' aria-current="page"' : ''}>Admin app</a>
  <a href="live-landing.html"${current === 'live-landing.html' ? ' aria-current="page"' : ''}>Landing site</a>
</nav>`;
const SWITCH_CSS = `.demo-switch { position: fixed; z-index: 90; left: 12px; bottom: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; max-width: calc(100vw - 24px); padding: 4px; font: 500 13px/1 var(--xo-font, system-ui, sans-serif); color: var(--xo-color-text, #1b2530); background: var(--xo-color-surface, #fff); border: 1px solid var(--xo-color-border, #d9dee6); border-radius: 999px; box-shadow: 0 6px 20px rgb(0 0 0 / .18); }
.demo-switch a { display: inline-flex; align-items: center; min-height: 32px; padding: 0 12px; color: inherit; text-decoration: none; border-radius: 999px; }
.demo-switch a:hover { background: var(--xo-color-subtle, #eef1f5); }
.demo-switch a[aria-current="page"] { color: var(--xo-color-accent-strong, #0b5bd3); background: var(--xo-color-accent-soft, #e6efff); font-weight: 600; }
.demo-switch a:focus-visible { outline: 3px solid var(--xo-color-accent, #0b5bd3); outline-offset: 1px; }
@media (max-width: 30rem) { .demo-switch a { padding: 0 10px; } .demo-switch a[href="demo.html"] { display: none; } }
@media print { .demo-switch { display: none; } }
`;
for (const file of ['live-admin.html', 'live-landing.html']) {
  let html = readFileSync(new URL(file, kit), 'utf8');
  html = html
    .replaceAll('href="css/', 'href="live-kit/css/').replaceAll('src="js/', 'src="live-kit/js/').replaceAll('assets/mist/', 'brand/mist/')
    .replace('<link rel="stylesheet" href="live-kit/css/demo-pages.css">', '<link rel="stylesheet" href="live-kit/css/demo-pages.css"><link rel="stylesheet" href="live-kit/css/live-site.css">')
    .replace('<script>/* none */</script>', '');
  html = html.replace(/<([a-z0-9-]+)((?:\s[^>]*?)?)\sstyle="([^"]*)"([^>]*)>/gi, (_m, tag, before, style, after) => {
    const cls = classFor(style);
    const rest = `${before}${after}`;
    return /\sclass="/.test(rest) ? `<${tag}${rest.replace(/\sclass="([^"]*)"/, (_c, v) => ` class="${v} ${cls}"`)}>` : `<${tag}${rest} class="${cls}">`;
  });
  html = html.replace('</body>', `${demoSwitch(file)}\n</body>`);
  writeFileSync(new URL(file, site), html);
}
writeFileSync(new URL('css/live-site.css', live), `/* generated by tools/kit-css.mjs: the style="" attributes of the live demo pages, as classes (a strict CSP allows no inline styles) */\n${[...styleClasses].map(([style, cls]) => `.${cls} { ${style}; }`).join('\n')}\n/* the bar between the demos and the docs */\n${SWITCH_CSS}`);
console.log(`wrote the live demo pages (${styleClasses.size} inline styles became classes)`);
