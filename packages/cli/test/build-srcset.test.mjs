// `xoong build` follows `srcset` like `src`: every URL of the list is copied and given --base, the descriptors (1x, 480w) stay.
// `<a href>` is left as written on purpose (the router and plain relative links handle it).
import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, srcsetUrls } from '../src/build.js';

const PAGE = `<!doctype html><html><head><title>x</title>
<link rel="preload" as="image" href="/img/hero-1x.png" imagesrcset="/img/hero-1x.png 1x, /img/hero-2x.png 2x" imagesizes="100vw">
</head><body>
<a id="abs" href="/about.html">About</a> <a id="rel" href="about.html">About</a>
<img src="/img/logo.png" srcset="/img/logo.png 1x, /img/logo2.png 2x" alt="">
<img srcset="img/rel-1x.png 1x,img/rel-2x.png 2x" alt="">
<picture>
  <source type="image/avif" srcset='/img/a-480.avif 480w, /img/a-960.avif 960w' sizes="(max-width: 600px) 480px, 960px">
  <source type="image/webp" srcset="/img/a-480.webp">
  <img src="/img/a-480.png" alt="">
</picture>
<img srcset="https://cdn.example/x.png 1x, /img/mixed.png 2x" alt="">
<img srcset="data:image/png;base64,AAAA 1x, /img/after-data.png 2x" alt="">
<img srcset="/img/missing.png 1x, /img/logo.png 2x" alt="">
<img srcset="/img/amp.png?v=1&amp;w=2 1x" alt="">
</body></html>`;

async function app() {
  const root = await mkdtemp(join(tmpdir(), 'xoong-srcset-'));
  const w = async (p, t) => { await mkdir(join(root, p, '..'), { recursive: true }); await writeFile(join(root, p), t); };
  await w('index.html', PAGE);
  await w('about.html', '<!doctype html><title>about</title><p>about</p>');
  for (const f of ['logo', 'logo2', 'hero-1x', 'hero-2x', 'rel-1x', 'rel-2x', 'mixed', 'after-data', 'amp']) await w(`img/${f}.png`, f);
  for (const f of ['a-480.avif', 'a-960.avif', 'a-480.webp', 'a-480.png']) await w(`img/${f}`, f);
  return root;
}

describe('xoong build: srcset', () => {
  it('copies every file a srcset names and keeps the descriptors, without --base', async () => {
    const root = await app();
    const out = join(root, 'dist');
    await build({ root, out });
    const html = await readFile(join(out, 'index.html'), 'utf8');
    expect(html).toContain('srcset="/img/logo.png 1x, /img/logo2.png 2x"');
    expect(html).toContain('srcset="/img/rel-1x.png 1x,/img/rel-2x.png 2x"'); // written relative to the page, root-absolute in the output (like src)
    expect(html).toContain("srcset='/img/a-480.avif 480w, /img/a-960.avif 960w'"); // quotes as written
    expect(html).toContain('sizes="(max-width: 600px) 480px, 960px"');
    expect(html).toContain('srcset="/img/a-480.webp"');
    expect(html).toContain('imagesrcset="/img/hero-1x.png 1x, /img/hero-2x.png 2x"');
    const copied = await readdir(join(out, 'img'));
    for (const f of ['logo2.png', 'hero-2x.png', 'rel-1x.png', 'rel-2x.png', 'a-480.avif', 'a-960.avif', 'a-480.webp', 'mixed.png', 'after-data.png']) expect(copied, f).toContain(f);
  });

  it('--base prefixes every URL of a srcset, in <img>, <source> and <link rel=preload imagesrcset>', async () => {
    const root = await app();
    const out = join(root, 'dist-base');
    await build({ root, out, base: '/repo' });
    const html = await readFile(join(out, 'index.html'), 'utf8');
    expect(html).toContain('srcset="/repo/img/logo.png 1x, /repo/img/logo2.png 2x"');
    expect(html).toContain('srcset="/repo/img/rel-1x.png 1x,/repo/img/rel-2x.png 2x"');
    expect(html).toContain("srcset='/repo/img/a-480.avif 480w, /repo/img/a-960.avif 960w'");
    expect(html).toContain('srcset="/repo/img/a-480.webp"');
    expect(html).toContain('imagesrcset="/repo/img/hero-1x.png 1x, /repo/img/hero-2x.png 2x"');
    expect(html).toContain('src="/repo/img/a-480.png"'); // src still works
    expect(await readdir(join(out, 'img'))).toContain('logo2.png');
  });

  it('leaves absolute URLs, data: URLs, and files that do not exist as written, and still rewrites the other URLs of the same list', async () => {
    const root = await app();
    const out = join(root, 'dist-mixed');
    await build({ root, out, base: '/repo' });
    const html = await readFile(join(out, 'index.html'), 'utf8');
    expect(html).toContain('srcset="https://cdn.example/x.png 1x, /repo/img/mixed.png 2x"');
    expect(html).toContain('srcset="data:image/png;base64,AAAA 1x, /repo/img/after-data.png 2x"');
    expect(html).toContain('srcset="/img/missing.png 1x, /repo/img/logo.png 2x"'); // not a file we can serve: kept
  });

  it('an attribute with a character reference is written again, escaped', async () => {
    const root = await app();
    const out = join(root, 'dist-amp');
    await build({ root, out, base: '/repo' });
    expect(await readFile(join(out, 'index.html'), 'utf8')).toContain('srcset="/repo/img/amp.png?v=1&amp;w=2 1x"');
  });

  it('does not touch <a href>: a link to a page stays as written, with or without --base', async () => {
    const root = await app();
    for (const base of ['', '/repo']) {
      const out = join(root, `dist-a${base.replace('/', '-')}`);
      await build({ root, out, base });
      const html = await readFile(join(out, 'index.html'), 'utf8');
      expect(html).toContain('<a id="abs" href="/about.html">About</a>');
      expect(html).toContain('<a id="rel" href="about.html">About</a>');
    }
  });
});

describe('srcsetUrls', () => {
  const urls = (v) => srcsetUrls(v).map((c) => c.url);
  it('reads the URL of each candidate and ignores descriptors, extra spaces and newlines', () => {
    expect(urls('a.png 1x, b.png 2x')).toEqual(['a.png', 'b.png']);
    expect(urls('  a.png   480w ,\n b.png\t960w  ')).toEqual(['a.png', 'b.png']);
    expect(urls('a.png')).toEqual(['a.png']);
    expect(urls('')).toEqual([]);
  });
  it('a URL may contain a comma (data: URL, or a CDN transform); a trailing comma ends the candidate', () => {
    expect(urls('data:image/png;base64,AAAA 1x, b.png 2x')).toEqual(['data:image/png;base64,AAAA', 'b.png']);
    expect(urls('/cdn/w_100,h_50/a.png 1x, /cdn/w_200,h_100/a.png 2x')).toEqual(['/cdn/w_100,h_50/a.png', '/cdn/w_200,h_100/a.png']);
    expect(urls('a.png, b.png')).toEqual(['a.png', 'b.png']);
    expect(urls('a.png,, b.png 2x')).toEqual(['a.png', 'b.png']);
    expect(urls('a.png,b.png 2x')).toEqual(['a.png,b.png']); // no space: one URL, as the standard reads it
  });
  it('positions point at the URL in the value', () => {
    const v = 'a.png 1x,  img/b.png 2x';
    for (const { url, start, end } of srcsetUrls(v)) expect(v.slice(start, end)).toBe(url);
  });
  it('a comma inside parentheses of a descriptor does not start a new candidate', () => {
    expect(urls('a.png calc(1,2), b.png 2x')).toEqual(['a.png', 'b.png']);
  });
});
