// A binding in a URL attribute is filled in at run time; `xoong build` leaves it as written.
import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../src/build.js';

const PAGE = `<!doctype html><html><head><title>x</title></head><body>
<img id="a" src="{url}" alt=""><xo-image id="b" src="{url}" alt=""></xo-image>
<img id="c" srcset="{a} 1x" alt=""><video id="d" poster="{p}"></video>
<img id="e" src="/a.png" alt=""><img id="f" src="a.png" alt=""><a id="g" href="{x}">x</a>
</body></html>`;

describe('xoong build: bindings in URL attributes', () => {
  it('keeps them as written and still rewrites real files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-bind-'));
    await writeFile(join(root, 'index.html'), PAGE);
    await writeFile(join(root, 'a.png'), 'a');
    const out = join(root, 'dist');
    await build({ root, out });
    const html = await readFile(join(out, 'index.html'), 'utf8');
    expect(html).toContain('id="a" src="{url}"');
    expect(html).toContain('id="b" src="{url}"');
    expect(html).toContain('srcset="{a} 1x"');
    expect(html).toContain('poster="{p}"');
    expect(html).toContain('id="e" src="/a.png"');
    expect(html).toContain('id="f" src="/a.png"');
    expect(html).toContain('href="{x}"');
    expect(html).not.toContain('./{');
  });
});
