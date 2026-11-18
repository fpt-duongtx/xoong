// The icon set: the SVG files are the one source, everything else is generated from them and must match; the markup is safe under a strict CSP;
// the controls draw no icon with a text character; `.ic[data-ic]` (the old API) still names every icon it did.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { icons, names, svgOf, maskUrl, buildCss, scan, MODIFIERS, VARIANTS, LEGACY } from '../src/index.js';
import { build, LEGACY_NAMES, LEGACY_RENAMES, BLOCKS } from '../../../tools/build-icons.mjs';

const root = new URL('../../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const svgDir = new URL('../src/svg/', import.meta.url);
const files = (dir) => readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();

describe('the sources', () => {
  it('every SVG file is an icon in the data, with a category and tags, and the other way round', () => {
    expect(files(svgDir)).toEqual([...names].sort());
    const meta = JSON.parse(read('packages/icons/src/meta.json'));
    expect(Object.keys(meta).sort()).toEqual([...names].sort());
    for (const n of names) { expect(icons[n].category, n).toMatch(/^[a-z]+$/); expect(icons[n].tags.length, n).toBeGreaterThan(0); }
    for (const f of files(new URL('fill/', svgDir))) expect(names, `fill/${f}.svg has no outline`).toContain(f);
  });

  it('is drawn on the 24px grid with one stroke, round ends and joins, and nothing a strict CSP or a script could object to', () => {
    for (const n of names) {
      for (const [kind, svg] of [['regular', icons[n].regular], ['fill', icons[n].fill]].filter(([, s]) => s)) {
        const where = `${n} (${kind})`;
        expect(svg, where).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24" /);
        expect(svg, where).toContain('stroke-linecap="round"');
        expect(svg, where).toContain('stroke-linejoin="round"');
        expect(svg, where).not.toMatch(/<script|<style|<foreignObject|<image|<use|\son\w+=|href=|style=|javascript:|<!\[CDATA\[/i);
        expect([...svg.matchAll(/<(\w+)/g)].map((m) => m[1]).filter((t) => !['svg', 'path', 'circle', 'rect', 'g', 'mask', 'line', 'polyline', 'polygon', 'ellipse'].includes(t)), where).toEqual([]);
        for (const m of svg.replace(/xmlns="[^"]*"/, '').matchAll(/-?\d*\.?\d+/g)) expect(Math.abs(+m[0]), `${where}: a number outside the grid`).toBeLessThanOrEqual(24);
      }
      expect(icons[n].regular, n).toContain('fill="none" stroke="currentColor" stroke-width="1.75"'); // one weight for every outline
      if (icons[n].fill) expect(icons[n].fill, n).toContain('fill="currentColor"');
      const ids = [...(icons[n].fill ?? '').matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      for (const id of ids) expect(id, `${n}: mask ids are unique per icon, so inlined icons do not clash`).toBe(`k-${n}`);
    }
  });

  it('has names that are kebab-case and never one of the modifier classes (xi-bold is the weight, not an icon)', () => {
    for (const n of names) { expect(n).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/); expect(MODIFIERS, n).not.toContain(n); }
  });

  it('has the bold weight as the outline with a heavier stroke, and a fill for an icon without a drawing of its own', () => {
    expect(svgOf('plus', 'bold')).toContain('stroke-width="2.5"');
    expect(svgOf('plus', 'fill')).toBe(svgOf('plus', 'bold'));
    expect(svgOf('trash', 'fill')).toBe(icons.trash.fill);
    expect(() => svgOf('nope')).toThrow(/unknown icon/);
  });

  it('covers every name the first release promised', () => {
    const wanted = 'edit trash plus minus search link more list-bullet list-number grid menu log-out check close arrow-up arrow-down arrow-left arrow-right chevron-up chevron-down chevron-left chevron-right user users sliders settings message mail layers info warning error success image history external-link droplet copy calendar undo redo eye eye-off filter grip download upload lock bell home globe star palette sort expand publish unpublish duplicate preview guide preset seo page article tag folder language phone map-pin clock'.split(' ');
    expect(wanted.filter((n) => !names.includes(n))).toEqual([]);
  });
});

describe('the generated files', () => {
  it('are up to date with the sources (node tools/build-icons.mjs)', () => {
    for (const { file, text } of build()) expect(read(file) === text, `${file} is out of date: run node tools/build-icons.mjs`).toBe(true);
  });

  it('is CSS a strict CSP accepts: masks from data: images, no style attribute, no remote url', () => {
    const css = read('packages/icons/src/icons.css');
    for (const [, url] of css.matchAll(/url\(([^)]*)\)/g)) expect(url, 'only data: images').toMatch(/^"data:image\/svg\+xml,%3Csvg /);
    expect(css).not.toMatch(/@import|https?:\/\/(?!www\.w3\.org)/);
    for (const m of css.matchAll(/url\("data:image\/svg\+xml,([^"]*)"\)/g)) expect(m[1], 'the SVG in a data URI has < > # ( ) escaped, so no build mistakes it for a url()').not.toMatch(/[<>#()]/);
  });

  it('has a class for every icon in every variant, and the modifiers', () => {
    const css = read('packages/icons/src/icons.css');
    for (const n of names) for (const rule of [`.xi-${n} {`, `.xi-fill.xi-${n} {`, `.xi-bold.xi-${n} {`]) expect(css, rule).toContain(rule);
    for (const m of ['.xi-sm', '.xi-lg', '.xi-2x', '.xi-fw', '.xi-spin', '.xi-fill', '.xi-bold']) expect(css + buildCss({ names: ['plus'] }), m).toContain(m.replace('.xi-fill', '.xi-fill.xi-plus').replace('.xi-bold', '.xi-bold.xi-plus'));
    expect(css).toContain('@keyframes xi-spin');
    expect(css).toContain('prefers-reduced-motion');
  });
});

describe('.ic[data-ic], the old API', () => {
  it('still names every icon it did, in the Mist stylesheet and in the whole set', () => {
    const mist = read('packages/ui/src/mist.css'), full = read('packages/icons/src/icons.css');
    for (const old of LEGACY_NAMES) {
      const now = LEGACY_RENAMES[old] ?? old;
      expect(names, old).toContain(now);
      for (const [where, css] of [['mist.css', mist], ['icons.css', full]]) expect(css, `${where} lacks .ic[data-ic="${old}"]`).toContain(`.ic[data-ic="${old}"] { --ic: var(--ic-${now}); }`);
    }
    expect(LEGACY).toEqual(LEGACY_RENAMES);
  });
});

describe('the subset', () => {
  it('finds the icons a source uses: xi classes, data-ic, var(--ic-*), and which variants it asks for', () => {
    const r = scan(`<i class="xi xi-edit xi-lg"></i><span class="ic" data-ic="bold"></span><i class="xi xi-fill xi-star xi-ghost"></i>
      .a::before { mask: var(--ic-check); } .b { mask: var(--icf-star); } .xi-2x .xi-spin`);
    expect(r.names).toEqual(['check', 'edit', 'star', 'text-bold']);
    expect(r.unknown).toEqual(['ghost']);
    expect(r.variants.sort()).toEqual(['fill', 'regular']);
  });

  it('builds a stylesheet with only those icons, much smaller than the whole set', () => {
    const one = buildCss({ names: ['edit'], variants: ['regular'] });
    expect(one).toContain('.xi-edit {');
    expect(one).not.toContain('.xi-trash');
    expect(one.length).toBeLessThan(read('packages/icons/src/icons.css').length / 20);
    expect(buildCss({ names: ['edit'], variants: ['regular'], base: false })).not.toContain('.xi {');
  });

  it('is what the xoong-icons command writes for a project', () => {
    const dir = mkdtempSync(join(tmpdir(), 'xoong-icons-'));
    writeFileSync(join(dir, 'page.html'), '<i class="xi xi-star"></i><i class="xi xi-bold xi-trash"></i><i class="xi xi-nonexistent"></i>');
    const out = join(dir, 'out.css');
    const cli = new URL('../src/cli.js', import.meta.url).pathname;
    execFileSync('node', [cli, '--scan', dir, '--include', 'plus', '--out', out], { stdio: 'pipe' });
    const css = readFileSync(out, 'utf8');
    for (const n of ['star', 'trash', 'plus']) expect(css).toContain(`.xi-${n} {`);
    expect(css).not.toContain('.xi-edit');
    expect(css).toContain('--icb-trash'); // xi-bold was used somewhere, so the bold weight is in
    expect(css).not.toContain('--icf-star'); // xi-fill was not
    expect(execFileSync('node', [cli, '--list'], { encoding: 'utf8' }).split('\n').filter(Boolean)).toEqual(names);
    expect(() => execFileSync('node', [cli], { stdio: 'pipe' })).toThrow();
  });
});

describe('the controls', () => {
  const sources = (dir) => readdirSync(new URL(dir, root)).filter((f) => /\.(js|css)$/.test(f) && f !== 'sanitize.js').map((f) => [`${dir}${f}`, read(`${dir}${f}`)]);
  const GLYPHS = /[↑↓←→↗↘×✕✓✔‹›▾▴▲▼▶◀⋯⋮⋱•↶↷❚★☆✗☰]/;

  it('draw no icon with a text character: not in the scripts they run, not in the CSS content of their stylesheets', () => {
    const bad = [];
    for (const dir of ['packages/controls/src/', 'packages/richtext/src/', 'packages/ui/src/']) {
      for (const [file, text] of sources(dir).filter(([f]) => !f.endsWith('mist.css'))) {
        const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // comments may name a glyph
        for (const [i, line] of code.split('\n').entries()) if (GLYPHS.test(line)) bad.push(`${file}:${i + 1}: ${line.trim().slice(0, 90)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('use only icons that exist, and carry exactly those in the block of their stylesheet', () => {
    for (const [file, dirs] of BLOCKS.map(([f, d]) => [f, d])) {
      const text = dirs.flatMap((d) => sources(`${d}/`)).map(([, t]) => t.replace(/\/\* icons:start[\s\S]*?\/\* icons:end \*\//, '')).join('\n');
      const r = scan(text);
      expect(r.unknown, `${file} names icons that do not exist`).toEqual([]);
      expect(read(file), file).toContain('/* icons:start');
      for (const n of r.names) expect(read(file), `${file} lacks ${n}`).toContain(`.xi-${n} {`);
    }
  });

  it('make the icon a drawn element the screen reader skips: <i class="xi ..." aria-hidden="true">', () => {
    for (const [file, text] of ['packages/controls/src/', 'packages/ui/src/'].flatMap(sources).filter(([f]) => f.endsWith('.js'))) {
      for (const m of text.matchAll(/<i class="xi[^>]*>/g)) expect(m[0], `${file}: ${m[0]}`).toContain('aria-hidden="true"');
    }
  });
});
