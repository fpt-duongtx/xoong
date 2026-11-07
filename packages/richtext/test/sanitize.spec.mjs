import { describe, it, expect } from 'vitest';
import { sanitizeHtml, isSafeLink, isSafeImage, textOf } from '@xoong/richtext/sanitize';

const clean = (html, o) => sanitizeHtml(html, o);

describe('sanitizeHtml: what stays', () => {
  it('keeps the allowed block and inline elements', () => {
    expect(clean('<h2>Title</h2><p>Hello <strong>bold</strong> and <em>italic</em></p><blockquote><p>q</p></blockquote>'))
      .toBe('<h2>Title</h2><p>Hello <strong>bold</strong> and <em>italic</em></p><blockquote><p>q</p></blockquote>');
    expect(clean('<ul><li>a</li><li>b<ul><li>c</li></ul></li></ul><ol><li>1</li></ol>')).toBe('<ul><li>a</li><li>b<ul><li>c</li></ul></li></ul><ol><li>1</li></ol>');
  });

  it('maps b, i, h1, h4-h6 and div; wraps loose text and inline runs in paragraphs', () => {
    expect(clean('<h1>A</h1><h5>B</h5><div>C <b>x</b> <i>y</i></div>')).toBe('<h2>A</h2><h3>B</h3><p>C <strong>x</strong> <em>y</em></p>');
    expect(clean('loose <strong>text</strong>')).toBe('<p>loose <strong>text</strong></p>');
    expect(clean('one<br>two')).toBe('<p>one<br>two</p>');
    expect(clean('<blockquote>no paragraph</blockquote>')).toBe('<blockquote><p>no paragraph</p></blockquote>');
  });

  it('keeps links with safe schemes (and adds rel), a title, and escapes attribute values', () => {
    expect(clean('<a href="https://x.test/a?b=1&c=2" title="T&quot;q">go</a>')).toBe('<p><a href="https://x.test/a?b=1&amp;c=2" title="T&quot;q" rel="noopener noreferrer">go</a></p>');
    expect(clean('<a href="mailto:a@b.test">m</a> <a href="tel:+84123">t</a>')).toContain('href="mailto:a@b.test"');
  });

  it('keeps images with an http(s) or relative source, an alt and numeric sizes, and can drop them', () => {
    expect(clean('<img src="/media/a.png" alt="A" width="20" height="x">')).toBe('<p><img src="/media/a.png" alt="A" width="20"></p>');
    expect(clean('<img src="https://x.test/a.png">')).toBe('<p><img src="https://x.test/a.png" alt=""></p>');
    expect(clean('<p>t</p><img src="/a.png">', { images: false })).toBe('<p>t</p>');
  });

  it('drops the trailing line break of a block (a browser placeholder) but keeps a break inside text and a blank line', () => {
    expect(clean('<ul><li>a<br></li></ul><p>b<br></p><h2>c<br></h2>')).toBe('<ul><li>a</li></ul><p>b</p><h2>c</h2>');
    expect(clean('<p>a<br>b</p><p><br></p><p>c</p>')).toBe('<p>a<br>b</p><p><br></p><p>c</p>');
  });

  it('turns non-breaking spaces into spaces and trims blank paragraphs at the very start and end only', () => {
    expect(clean('<p>a&nbsp;&nbsp;b</p>')).toBe('<p>a  b</p>');
    expect(clean('<p><br></p><ul><li>x</li></ul><p><br></p>')).toBe('<ul><li>x</li></ul>');
    expect(clean('<p>a</p><p><br></p><p><br></p><p>b</p>')).toBe('<p>a</p><p><br></p><p><br></p><p>b</p>');
  });

  it('keeps an empty paragraph as a blank line, and drops everything when only whitespace is left', () => {
    expect(clean('<p>a</p><p><br></p><p>b</p>')).toBe('<p>a</p><p><br></p><p>b</p>');
    expect(clean('   ')).toBe('');
    expect(clean('<p></p>')).toBe('');
  });
});

describe('sanitizeHtml: what goes', () => {
  it('removes script, style and friends with their content', () => {
    expect(clean('<p>a</p><script>alert(1)</script><style>p{x:y}</style><iframe src="x"></iframe><svg><circle/></svg><noscript>n</noscript>')).toBe('<p>a</p>');
    expect(clean('<form action="/x"><input name="a"><button>go</button>text</form>')).toBe('<p>text</p>');
  });

  it('strips every attribute that is not allowed (style, class, id, on*)', () => {
    expect(clean('<p style="color:red" class="x" id="y" onclick="a()" data-x="1">t</p>')).toBe('<p>t</p>');
    expect(clean('<strong onmouseover="a()">t</strong>')).toBe('<p><strong>t</strong></p>');
    expect(clean('<img src="/a.png" onerror="alert(1)" style="x">')).toBe('<p><img src="/a.png" alt=""></p>');
  });

  it('unsafe link targets lose the link and keep the text: javascript:, data:, vbscript:, obfuscated forms, protocol-relative', () => {
    for (const href of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'java&#x0A;script:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', '//evil.test/x', '/relative', 'ftp://x.test']) {
      const out = clean(`<a href="${href}">text</a>`);
      expect(out, href).toBe('<p>text</p>');
    }
  });

  it('unsafe image sources are removed', () => {
    for (const src of ['javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', '//evil.test/a.png', 'blob:x', 'ftp://x/a.png']) expect(clean(`<img src="${src}">`), src).toBe('');
  });

  it('unwraps unknown elements, flattens blocks inside inline content, and keeps blocks inside an unknown wrapper', () => {
    expect(clean('<span class="x">a</span> <font color="red">b</font>')).toBe('<p>a b</p>');
    expect(clean('<section><h2>T</h2><p>p</p></section>')).toBe('<h2>T</h2><p>p</p>');
    expect(clean('<p>a <a href="https://x.test"><h2>head</h2></a></p>')).toBe('<p>a <a href="https://x.test" rel="noopener noreferrer">head</a></p>');
  });

  it('known mutation-XSS shapes come out as plain text or nothing', () => {
    expect(clean('<noscript><p title="</noscript><img src=x onerror=alert(1)>">')).not.toMatch(/onerror|<img/);
    expect(clean('<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">')).not.toMatch(/onerror/);
    expect(clean('<svg><style><img src=x onerror=alert(1)></style></svg>')).toBe('');
    expect(clean('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'); // escaped text stays text
  });

  it('output is stable: sanitising twice gives the same string', () => {
    const dirty = '<div>x<script>1</script><b>y</b><ul><li>a</li></ul><a href="javascript:1">z</a><img src="/a.png"></div>';
    const once = clean(dirty);
    expect(clean(once)).toBe(once);
  });
});

describe('url checks and textOf', () => {
  it('isSafeLink and isSafeImage', () => {
    expect(isSafeLink('https://x.test')).toBe(true);
    expect(isSafeLink('mailto:a@b.c')).toBe(true);
    expect(isSafeLink('/x')).toBe(false);
    expect(isSafeLink('java\u0000script:1')).toBe(false);
    expect(isSafeImage('/a.png')).toBe(true);
    expect(isSafeImage('a/b.png')).toBe(true);
    expect(isSafeImage('data:image/png;base64,AAA')).toBe(false);
  });
  it('textOf reads the text of HTML', () => { expect(textOf('<p>a <strong>b</strong></p>')).toBe('a b'); });
});
