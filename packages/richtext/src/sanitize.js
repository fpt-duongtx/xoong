// @ts-check
/**
 * The HTML that <xo-richtext> keeps, and the one sanitiser a server can run too: the same code gives the same bytes in a browser and in Node.
 * It needs no DOM. The input is tokenised and put in a tree by a small parser of its own (this file), the tree is checked against a profile, and the
 * result is written as a string with its own escaping, in a shape that is already what a browser's parser would build: it never has to be parsed in a
 * different shape than the one that was checked, and sanitising the output again returns it unchanged.
 *
 * A profile is plain data (see PROFILES below, and docs/richtext.md):
 *   { tags: { a: { attrs: { href: 'url', title: 'text' } }, aside: { classes: ['note'] }, ... },
 *     rename: { b: 'strong' }, drop: ['iframe'], schemes: { url: ['http'], imgurl: ['http', 'relative'] } }
 * Only listed tags survive; an unlisted tag is unwrapped (its text stays). Only listed attributes survive, each checked by its type
 * (text, url, imgurl, int, or a list of allowed values); `class` keeps the listed class names of that tag. There is no "allow everything", and
 * style, on*, srcdoc and an id outside a list are refused when a profile is defined.
 *
 * Whatever the profile says: script, style, iframe, object, embed, svg, math, template, noscript, textarea, title and similar go with their content;
 * a link keeps rel="noopener noreferrer"; URL schemes are checked after control characters and spaces are removed.
 * Non-breaking spaces become plain spaces; empty paragraphs at the very start or end are removed; a line break at the very end of a block
 * (a browser's placeholder) is removed.
 */

/** Elements that are always removed with their content, in any profile. */
const ALWAYS_DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'noscript', 'textarea', 'title', 'xmp', 'noembed', 'noframes', 'plaintext', 'head', 'frameset', 'applet']);
/** Their content is raw text up to the end tag (never markup). */
const RAW_TEXT = new Set(['script', 'style', 'iframe', 'noembed', 'noframes', 'noscript', 'xmp', 'textarea', 'title']);
const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']);
const PHRASING = new Set(['strong', 'em', 'u', 's', 'code', 'sub', 'sup', 'mark', 'small', 'span', 'abbr', 'kbd', 'a', 'br', 'img']);
const TEXT_BLOCK = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'figcaption']);
const LIST = new Set(['ul', 'ol']);
const CONTAINER = new Set(['blockquote', 'aside', 'div', 'section']);
const KNOWN = new Set([...PHRASING, ...TEXT_BLOCK, ...LIST, ...CONTAINER, 'li', 'figure']);
/** A start tag of these closes an open <p>. */
const CLOSES_P = new Set([...TEXT_BLOCK, ...LIST, ...CONTAINER, 'li', 'figure', 'hr', 'table']);
const MAX_DEPTH = 100;
const LEGACY_ENTITY = new Set(['amp', 'lt', 'gt', 'quot', 'nbsp', 'copy', 'reg']);
const ENTITIES = /** @type {Record<string, string>} */ ({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', bull: '•', middot: '·', deg: '°', plusmn: '±', times: '×', divide: '÷', euro: '€', pound: '£', yen: '¥', cent: '¢',
  sect: '§', para: '¶', larr: '←', rarr: '→', uarr: '↑', darr: '↓', check: '✓', szlig: 'ß', shy: '\u00ad', ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009', zwnj: '\u200c', zwj: '\u200d',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï',
  ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý', ccedil: 'ç', ntilde: 'ñ',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë', Igrave: 'Ì', Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï',
  Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü', Yacute: 'Ý', Ccedil: 'Ç', Ntilde: 'Ñ',
});
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

const esc = (/** @type {string} */ s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

// ---- profiles --------------------------------------------------------------------------------------------------------------

/** @typedef {{ attrs?: Record<string, string | string[]>, classes?: string[] }} TagSpec */
/** @typedef {{ tags: Record<string, TagSpec>, rename?: Record<string, string>, drop?: string[], schemes?: { url?: string[], imgurl?: string[] } }} RichtextProfile */

const DROP_MORE = ['meta', 'link', 'base', 'input', 'button', 'select', 'canvas', 'audio', 'video'];

/** What <xo-richtext> kept before profiles existed. */
const DEFAULT_PROFILE = /** @type {RichtextProfile} */ ({
  tags: {
    p: {}, h2: {}, h3: {}, strong: {}, em: {}, u: {}, br: {}, ul: {}, ol: {}, li: {}, blockquote: {},
    a: { attrs: { href: 'url', title: 'text' } },
    img: { attrs: { src: 'imgurl', alt: 'text', width: 'int', height: 'int' } },
  },
  rename: { b: 'strong', i: 'em', h1: 'h2', h4: 'h3', h5: 'h3', h6: 'h3', div: 'p' },
  drop: DROP_MORE,
  schemes: { url: ['http', 'https', 'mailto', 'tel'], imgurl: ['http', 'https', 'relative'] },
});

/** The default plus figure/figcaption, aside notes and link targets. */
const RICH_PROFILE = /** @type {RichtextProfile} */ ({
  tags: {
    ...DEFAULT_PROFILE.tags,
    a: { attrs: { href: 'url', title: 'text', target: ['_blank'], rel: ['noopener', 'noreferrer'] } },
    figure: { classes: ['figure', 'figure--wide'] },
    figcaption: {},
    aside: { classes: ['note', 'note--info', 'note--warning'] },
  },
  rename: DEFAULT_PROFILE.rename,
  drop: DROP_MORE,
  schemes: DEFAULT_PROFILE.schemes,
});

/** @type {Map<string, { profile: RichtextProfile, compiled: any }>} */
const registry = new Map();
/** @type {WeakMap<object, any>} */
const compiledCache = new WeakMap();

const BAD_ATTR = /^(style|srcdoc|srcset|ping|action|formaction|on.*)$/;
const URL_ATTR = /^(href|src|poster|background|cite|data|xlink:href)$/;

/** Checks a profile and turns it into lookup tables. Throws on anything it cannot keep safe. */
function compile(/** @type {any} */ profile) {
  if (!profile || typeof profile !== 'object' || !profile.tags || typeof profile.tags !== 'object') throw new TypeError('a richtext profile needs "tags"');
  const tags = new Map();
  for (const [name, spec] of Object.entries(profile.tags)) {
    if (!KNOWN.has(name)) throw new TypeError(`richtext profile: unknown tag "${name}" (known: ${[...KNOWN].join(', ')})`);
    if (ALWAYS_DROP.has(name)) throw new TypeError(`richtext profile: "${name}" cannot be allowed`);
    const s = /** @type {TagSpec} */ (spec ?? {});
    const attrs = new Map();
    for (const [attr, type] of Object.entries(s.attrs ?? {})) {
      if (!/^[a-z][a-z0-9:-]*$/.test(attr) || BAD_ATTR.test(attr)) throw new TypeError(`richtext profile: attribute "${attr}" on <${name}> cannot be allowed`);
      if (attr === 'class') throw new TypeError(`richtext profile: use "classes" on <${name}>, not an attribute "class"`);
      const isList = Array.isArray(type);
      if (!isList && !['text', 'url', 'imgurl', 'int'].includes(/** @type {string} */ (type))) throw new TypeError(`richtext profile: attribute "${attr}" on <${name}> has an unknown type`);
      if (URL_ATTR.test(attr) && (isList || (type !== 'url' && type !== 'imgurl'))) throw new TypeError(`richtext profile: "${attr}" on <${name}> must be of type url or imgurl`);
      if (attr === 'id' && !isList) throw new TypeError(`richtext profile: "id" on <${name}> must be a list of allowed values`);
      attrs.set(attr, isList ? new Set(type) : type);
    }
    tags.set(name, { attrs, classes: s.classes ? new Set(s.classes) : null });
  }
  const rename = new Map(Object.entries(profile.rename ?? {}));
  const drop = new Set([...ALWAYS_DROP, ...(profile.drop ?? [])]);
  for (const t of tags.keys()) if (drop.has(t)) drop.delete(t);
  for (const t of ALWAYS_DROP) drop.add(t);
  const schemes = (/** @type {string[] | undefined} */ list, /** @type {string[]} */ fallback) => new Set((list ?? fallback).map((x) => String(x).toLowerCase()));
  return { tags, rename, drop, url: schemes(profile.schemes?.url, ['http', 'https', 'mailto', 'tel']), imgurl: schemes(profile.schemes?.imgurl, ['http', 'https', 'relative']) };
}

/**
 * Registers a named profile for `<xo-richtext profile="name">` and for `sanitizeHtml(html, 'name')`.
 * @param {string} name
 * @param {RichtextProfile} profile
 */
export function defineRichtextProfile(name, profile) {
  if (name === 'default' || name === 'rich') throw new Error(`the profile "${name}" is built in`);
  registry.set(name, { profile, compiled: compile(profile) });
}

registry.set('default', { profile: DEFAULT_PROFILE, compiled: compile(DEFAULT_PROFILE) });
registry.set('rich', { profile: RICH_PROFILE, compiled: compile(RICH_PROFILE) });

/** A registered profile by name (`default`, `rich`, or one from `defineRichtextProfile`), or undefined. */
export function getRichtextProfile(/** @type {string} */ name) { return registry.get(name)?.profile; }

const NO_IMAGES = compile({ ...DEFAULT_PROFILE, tags: Object.fromEntries(Object.entries(DEFAULT_PROFILE.tags).filter(([k]) => k !== 'img')) });

/** @returns {any} */
function resolve(/** @type {any} */ profile) {
  if (profile == null) return registry.get('default')?.compiled;
  if (typeof profile === 'string') {
    const found = registry.get(profile);
    if (!found) throw new Error(`unknown richtext profile "${profile}"`);
    return found.compiled;
  }
  if (!profile.tags) return profile.images === false ? NO_IMAGES : registry.get('default')?.compiled; // the old `{ images: false }`
  let compiled = compiledCache.get(profile);
  if (!compiled) { compiled = compile(profile); compiledCache.set(profile, compiled); }
  return compiled;
}

/** Whether a profile (object or name) keeps a tag, after renames: for a toolbar that only offers what the profile allows. */
export function profileAllows(/** @type {RichtextProfile | string | null | undefined} */ profile, /** @type {string} */ tag) {
  return resolve(profile).tags.has(tag);
}

// ---- URLs ------------------------------------------------------------------------------------------------------------------

/** Characters a browser ignores or that hide a scheme: removed before the scheme is read. */
const SCHEME_NOISE = /[\u0000-\u0020\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\ufeff]/g;

/** @param {string} url @param {Set<string>} allowed */
function urlAllowed(url, allowed) {
  const u = url.replace(SCHEME_NOISE, '');
  if (!u) return false;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u);
  if (scheme) {
    const name = /** @type {string} */ (scheme[1]).toLowerCase();
    if (name === 'data') return allowed.has('data:image') && /^data:image\/(png|jpe?g|gif|webp|avif)[;,]/i.test(u);
    return allowed.has(name);
  }
  return allowed.has('relative') && !/^[/\\]{2}|^\\/.test(u);
}

/** A link target the editor allows by default: http, https, mailto or tel. */
export function isSafeLink(/** @type {string} */ url) { return urlAllowed(url, new Set(['http', 'https', 'mailto', 'tel'])); }

/** An image source the editor allows by default: http, https, or a URL without a scheme (relative or root-relative). */
export function isSafeImage(/** @type {string} */ url) { return urlAllowed(url, new Set(['http', 'https', 'relative'])); }

// ---- parser ----------------------------------------------------------------------------------------------------------------

/** @typedef {{ t: 'text', v: string } | { t: 'el', tag: string, attrs: Record<string, string>, kids: Node[] }} Node */

function decode(/** @type {string} */ s, /** @type {boolean} */ inAttr) {
  if (!s.includes('&')) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*)(;?)/g, (whole, body, semi, offset, all) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return !code || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? '\ufffd' : String.fromCodePoint(code);
    }
    if (semi) return Object.hasOwn(ENTITIES, body) ? /** @type {string} */ (ENTITIES[body]) : whole;
    if (!LEGACY_ENTITY.has(body)) return whole;
    if (inAttr && /[=A-Za-z0-9]/.test(all[offset + whole.length] ?? '')) return whole;
    return /** @type {string} */ (ENTITIES[body]);
  });
}

const isSpace = (/** @type {string} */ c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
const isAlpha = (/** @type {string} */ c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

/** Parses HTML to a tree the way a browser would (close enough for what is kept), without any of the browser's scripting or foreign-content rules. */
function parse(/** @type {string} */ html) {
  /** @type {Node} */
  const root = { t: 'el', tag: '#root', attrs: {}, kids: [] };
  const stack = [root];
  const top = () => /** @type {Extract<Node, { t: 'el' }>} */ (stack[stack.length - 1]);
  const text = (/** @type {string} */ v) => { if (v) top().kids.push({ t: 'text', v }); };
  const n = html.length;
  let i = 0;
  let from = 0; // start of pending text
  const flush = (/** @type {number} */ to) => { text(decode(html.slice(from, to), false)); };

  while (i < n) {
    if (html[i] !== '<') { i++; continue; }
    const next = html[i + 1] ?? '';
    if (isAlpha(next)) { // start tag
      flush(i);
      let j = i + 1;
      while (j < n && !isSpace(html[j] ?? '') && html[j] !== '/' && html[j] !== '>') j++;
      let tag = html.slice(i + 1, j).toLowerCase();
      /** @type {Record<string, string>} */
      const attrs = {};
      let closed = false;
      while (j < n) {
        while (j < n && (isSpace(html[j] ?? '') || html[j] === '/')) j++;
        if (html[j] === '>') { closed = true; j++; break; }
        if (j >= n) break;
        let k = j + 1; // an attribute name may begin with "="
        while (k < n && !isSpace(html[k] ?? '') && html[k] !== '/' && html[k] !== '>' && html[k] !== '=') k++;
        const name = html.slice(j, k).toLowerCase();
        j = k;
        while (j < n && isSpace(html[j] ?? '')) j++;
        let value = '';
        if (html[j] === '=') {
          j++;
          while (j < n && isSpace(html[j] ?? '')) j++;
          const q = html[j];
          if (q === '"' || q === "'") {
            const end = html.indexOf(q, j + 1);
            if (end < 0) { j = n; break; } // end of input inside a value: the tag is dropped
            value = html.slice(j + 1, end);
            j = end + 1;
          } else {
            k = j;
            while (k < n && !isSpace(html[k] ?? '') && html[k] !== '>') k++;
            value = html.slice(j, k);
            j = k;
          }
        }
        if (!Object.hasOwn(attrs, name)) attrs[name] = decode(value, true).replace(CONTROL, '');
      }
      i = j;
      from = i;
      if (!closed) break; // an unfinished tag at the end is dropped with the rest
      if (tag === 'image') tag = 'img';
      if (RAW_TEXT.has(tag) || tag === 'plaintext') {
        if (tag === 'plaintext') { i = from = n; break; }
        const m = new RegExp(`</${tag}(?=[\\s/>])`, 'i').exec(html.slice(i));
        const end = m ? i + m.index : n;
        const gt = html.indexOf('>', end);
        i = from = m && gt >= 0 ? gt + 1 : n;
        top().kids.push({ t: 'el', tag, attrs: {}, kids: [] }); // kept as an empty element so the renderer drops it
        continue;
      }
      open(tag, attrs);
      continue;
    }
    if (next === '/') { // end tag
      if (isAlpha(html[i + 2] ?? '')) {
        flush(i);
        const gt = html.indexOf('>', i);
        const raw = html.slice(i + 2, gt < 0 ? n : gt);
        const tag = /^[^\s/>]+/.exec(raw)?.[0].toLowerCase() ?? '';
        i = from = gt < 0 ? n : gt + 1;
        if (tag === 'br') open('br', {}); else close(tag);
        continue;
      }
      flush(i);
      const gt = html.indexOf('>', i); // `</>` and `</ x>` are comments
      i = from = gt < 0 ? n : gt + 1;
      continue;
    }
    if (next === '!' || next === '?') { // comment, doctype, CDATA, processing instruction
      flush(i);
      let end;
      if (html.startsWith('<!--', i)) {
        if (html.startsWith('<!-->', i)) end = i + 5;
        else if (html.startsWith('<!--->', i)) end = i + 6;
        else { const a = html.indexOf('-->', i + 4); const b = html.indexOf('--!>', i + 4); end = a < 0 && b < 0 ? n : a < 0 ? b + 4 : b < 0 ? a + 3 : Math.min(a + 3, b + 4); }
      } else { const gt = html.indexOf('>', i); end = gt < 0 ? n : gt + 1; }
      i = from = end;
      continue;
    }
    i++;
  }
  flush(n);
  return root;

  function open(/** @type {string} */ tag, /** @type {Record<string, string>} */ attrs) {
    if (CLOSES_P.has(tag)) { for (let s = stack.length - 1; s > 0; s--) { const t = /** @type {any} */ (stack[s]).tag; if (t === 'p') { stack.length = s; break; } if (t === 'a' || LIST.has(t) || CONTAINER.has(t) || t === 'figure' || t === 'li') break; } }
    if (tag === 'li') { for (let s = stack.length - 1; s > 0; s--) { const t = /** @type {any} */ (stack[s]).tag; if (t === 'li') { stack.length = s; break; } if (LIST.has(t)) break; } }
    const el = /** @type {Node} */ ({ t: 'el', tag, attrs, kids: [] });
    top().kids.push(el);
    if (!VOID.has(tag) && stack.length < MAX_DEPTH) stack.push(el);
  }
  function close(/** @type {string} */ tag) {
    for (let s = stack.length - 1; s > 0; s--) if (/** @type {any} */ (stack[s]).tag === tag) { stack.length = s; return; }
  }
}

// ---- rendering -------------------------------------------------------------------------------------------------------------

/** @returns {string} */
function render(/** @type {string} */ html, /** @type {any} */ P) {
  const root = /** @type {Extract<Node, { t: 'el' }>} */ (parse(String(html ?? '')));

  /** The tag name after renames; '' for a dropped element. */
  const nameOf = (/** @type {Extract<Node, { t: 'el' }>} */ el) => (P.drop.has(el.tag) ? '' : P.rename.get(el.tag) ?? el.tag);
  const trimBreak = (/** @type {string} */ body) => (body.endsWith('<br>') && body !== '<br>' ? body.slice(0, -4) : body);

  function attrsOf(/** @type {Extract<Node, { t: 'el' }>} */ el, /** @type {string} */ tag, /** @type {any} */ spec) {
    let out = '';
    for (const [name, type] of spec.attrs) {
      if (tag === 'a' && name === 'rel') continue; // always written below
      let value = el.attrs[name];
      if (value === undefined) { if (tag === 'img' && name === 'alt') out += ' alt=""'; continue; }
      if (type === 'text') { if (!value) { if (tag === 'img' && name === 'alt') out += ' alt=""'; continue; } }
      else if (type === 'url' || type === 'imgurl') {
        value = value.replace(/[\t\n\r]/g, '').trim();
        if (!value || !urlAllowed(value, type === 'url' ? P.url : P.imgurl)) continue;
      } else if (type === 'int') { if (!/^\d{1,5}$/.test(value)) continue; }
      else if (!type.has(value)) continue;
      out += ` ${name}="${esc(value)}"`;
    }
    if (spec.classes && el.attrs.class) {
      const kept = [...new Set(el.attrs.class.split(/\s+/).filter((c) => spec.classes.has(c)))];
      if (kept.length) out += ` class="${esc(kept.join(' '))}"`;
    }
    return out;
  }

  /** The source of an <img> or '' when it is not kept. */
  const image = (/** @type {Extract<Node, { t: 'el' }>} */ el, /** @type {any} */ spec) => {
    const src = (el.attrs.src ?? '').replace(/[\t\n\r]/g, '').trim();
    return src && spec.attrs.has('src') && urlAllowed(src, P.imgurl) ? `<img${attrsOf(el, 'img', spec)}>` : '';
  };

  function inlineKids(/** @type {Node[]} */ kids, /** @type {boolean} */ inA) {
    let out = '';
    for (const k of kids) out += inline(k, inA);
    return out;
  }

  /** @returns {string} */
  function inline(/** @type {Node} */ node, /** @type {boolean} */ inA) {
    if (node.t === 'text') return esc(node.v.replace(/\u00a0/g, ' ').replace(CONTROL, '')); // Word and browsers type non-breaking spaces everywhere: plain spaces
    const tag = nameOf(node);
    if (!tag) return '';
    const spec = P.tags.get(tag);
    if (!spec) return inlineKids(node.kids, inA);
    if (tag === 'br') return '<br>';
    if (tag === 'img') return image(node, spec);
    if (tag === 'a') {
      const body = inlineKids(node.kids, true);
      const attrs = attrsOf(node, 'a', spec);
      if (inA || !/ href="/.test(attrs)) return body;
      return `<a${attrs} rel="noopener noreferrer">${body}</a>`;
    }
    if (PHRASING.has(tag)) { const body = inlineKids(node.kids, inA); return body ? `<${tag}${attrsOf(node, tag, spec)}>${body}</${tag}>` : ''; }
    return inlineKids(node.kids, inA); // a block inside inline content (a heading in a link, a list in a paragraph) becomes its text
  }

  /** Whether a block the profile keeps is somewhere inside (so an unknown wrapper such as <section> must not hide it). */
  function hasBlock(/** @type {Node[]} */ kids) {
    for (const k of kids) {
      if (k.t !== 'el') continue;
      const tag = nameOf(k);
      if (!tag) continue;
      if (P.tags.has(tag) && (TEXT_BLOCK.has(tag) && tag !== 'figcaption') || (P.tags.has(tag) && (LIST.has(tag) || CONTAINER.has(tag) || tag === 'figure'))) return true;
      if (hasBlock(k.kids)) return true;
    }
    return false;
  }

  /** @returns {string} */
  function block(/** @type {Extract<Node, { t: 'el' }>} */ el, /** @type {string} */ tag, /** @type {any} */ spec) {
    const attrs = attrsOf(el, tag, spec);
    if (LIST.has(tag)) {
      if (!P.tags.has('li')) return '';
      const items = el.kids.map((c) => (c.t === 'el' && nameOf(c) === 'li' ? item(c) : '')).join('');
      return items ? `<${tag}${attrs}>${items}</${tag}>` : '';
    }
    if (CONTAINER.has(tag)) { const inner = blocks(el.kids); return inner ? `<${tag}${attrs}>${inner}</${tag}>` : ''; }
    if (tag === 'figure') return figure(el, attrs);
    const body = trimBreak(inlineKids(el.kids, false));
    return body.replace(/<br>$/, '') === '' && !body.includes('<img') ? (tag === 'p' ? '<p><br></p>' : '') : `<${tag}${attrs}>${body}</${tag}>`;
  }

  function item(/** @type {Extract<Node, { t: 'el' }>} */ li) {
    let out = '';
    for (const c of li.kids) {
      const tag = c.t === 'el' ? nameOf(c) : '';
      out += c.t === 'el' && LIST.has(tag) && P.tags.has(tag) ? block(c, tag, P.tags.get(tag)) : inline(c, false); // nested lists stay; other blocks flatten to text
    }
    return `<li${attrsOf(li, 'li', P.tags.get('li'))}>${trimBreak(out)}</li>`;
  }

  /** figure: an image and a caption in source order; text that is neither becomes the caption when there is none. */
  function figure(/** @type {Extract<Node, { t: 'el' }>} */ el, /** @type {string} */ attrs) {
    const parts = [];
    let loose = '';
    let hasCaption = false;
    const walk = (/** @type {Node[]} */ kids) => {
      for (const k of kids) {
        const tag = k.t === 'el' ? nameOf(k) : '';
        if (k.t === 'el' && !tag) continue;
        if (k.t === 'el' && tag === 'img' && P.tags.has('img')) { const img = image(k, P.tags.get('img')); if (img) parts.push(img); }
        else if (k.t === 'el' && tag === 'figcaption' && P.tags.has('figcaption')) {
          const body = trimBreak(inlineKids(k.kids, false));
          if (body.replace(/<br>$/, '') !== '') { parts.push(`<figcaption${attrsOf(k, 'figcaption', P.tags.get('figcaption'))}>${body}</figcaption>`); hasCaption = true; }
        } else if (k.t === 'el' && !PHRASING.has(tag)) walk(k.kids);
        else loose += inline(k, false);
      }
    };
    walk(el.kids);
    if (!parts.some((p) => p.startsWith('<img'))) return '';
    const caption = !hasCaption && P.tags.has('figcaption') && loose.replace(/<br>/g, '').trim() ? `<figcaption>${trimBreak(loose.trim())}</figcaption>` : '';
    return `<figure${attrs}>${parts.join('')}${caption}</figure>`;
  }

  /** The children of a container as blocks: loose inline runs are wrapped in a paragraph. */
  function blocks(/** @type {Node[]} */ kids) {
    let out = '';
    let run = '';
    const flush = () => { if (run.replace(/<br>/g, '').trim() !== '' || run.includes('<img')) out += P.tags.has('p') ? `<p>${run}</p>` : run; run = ''; };
    for (const c of kids) {
      if (c.t === 'text') { run += inline(c, false); continue; }
      const tag = nameOf(c);
      if (!tag) continue;
      const spec = P.tags.get(tag);
      if (spec && tag !== 'figcaption' && tag !== 'li' && !PHRASING.has(tag)) { flush(); out += block(c, tag, spec); }
      else if (!PHRASING.has(tag) || !spec) { if (hasBlock(c.kids)) { flush(); out += blocks(c.kids); } else run += inline(c, false); }
      else run += inline(c, false);
    }
    flush();
    return out;
  }

  // blank lines at the very start or end are editor leftovers (a browser leaves them around a list); blank lines inside the text are the author's
  return blocks(root.kids).replace(/^(?:<p><br><\/p>)+|(?:<p><br><\/p>)+$/g, '');
}

/**
 * Sanitise HTML with a profile. The same input gives the same output in a browser and in Node, and sanitising the output again changes nothing.
 * @param {string} html
 * @param {RichtextProfile | string | { images?: boolean } | null} [profile] a profile, the name of a registered one (`default`, `rich`), or `{ images: false }` for the default without images
 * @returns {string}
 */
export function sanitizeHtml(html, profile) { return render(html, resolve(profile)); }

/** The text of HTML (sanitised or not), for "is it empty" checks and length limits. Raw-text elements such as <script> do not count. */
export function textOf(/** @type {string} */ html) {
  let out = '';
  const walk = (/** @type {Node[]} */ kids) => { for (const k of kids) { if (k.t === 'text') out += k.v; else if (!ALWAYS_DROP.has(k.tag)) walk(k.kids); } };
  walk(/** @type {any} */ (parse(String(html ?? ''))).kids);
  return out;
}
