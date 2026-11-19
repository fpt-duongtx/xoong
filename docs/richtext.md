# Rich text (`@xoong/richtext`)

A small rich text editor for forms, as an optional package (zero dependencies besides `@xoong/core`). It is a `contenteditable` area with an accessible toolbar,
and its value is **sanitised HTML**. It does not try to be a document editor: it covers what most admin forms need, and it hands the rest (media libraries, embeds,
custom blocks) to the application.

```js
import '@xoong/richtext';
```
```html
<link rel="stylesheet" href="/@xoong/richtext/richtext.css">  <!-- optional -->
<xo-richtext name="body" label="Body" placeholder="Write something" media></xo-richtext>
```

It is an `XoControl`, so it works in `<form xo-submit>` like a native field: `name`, `required` (an empty editor is empty), `disabled`, `readonly`, `dirty`, `touched`,
validity, `maxlength` (text characters; the schema `maxLength` applies to the stored HTML string, which is what the API receives). In a generated form use the hint `widget: "xo-richtext"` (or `x-xoong-widget` in OpenAPI) on a string field.

## What it keeps

`sanitizeHtml()` decides what the value may contain, on every input, paste, drop, `value` set and reset. What it keeps is a **profile**: a white-list written as plain data. The
default profile is exactly what the editor kept before profiles existed, so nothing changes for anyone who does not configure one:

| Allowed by `default` | Notes |
|---|---|
| `p`, `h2`, `h3`, `blockquote`, `ul`, `ol`, `li`, `br` | `h1` becomes `h2`, `h4` to `h6` become `h3`, `div` becomes `p`; loose text is wrapped in `p` |
| `strong`, `em`, `u` | `b` and `i` are mapped; underline is `u` |
| `a` with `href` (and `title`) | only `http:`, `https:`, `mailto:`, `tel:`; `rel="noopener noreferrer"` is added; any other link keeps its text and loses the link |
| `img` with `src`, `alt`, `width`, `height` | `src` must be `http(s)` or a relative URL (no `data:`, no `javascript:`, no `//host`); sizes are digits only |

The built-in **`rich`** profile adds `figure` (classes `figure`, `figure--wide`), `figcaption`, `aside` (classes `note`, `note--info`, `note--warning`) and `target="_blank"` on links.
Everything a profile does not list is unwrapped (its text stays); `script`, `style`, `iframe`, `object`, `embed`, `svg`, `math`, `template`, `noscript`, `textarea`, `title` are removed
with their content in every profile. Non-breaking spaces become spaces and blank paragraphs at the very start or end are removed.

### Profiles

```html
<xo-richtext name="body" profile="rich" media></xo-richtext>
```
```js
import { defineRichtextProfile, sanitizeHtml } from '@xoong/richtext';

defineRichtextProfile('article', {
  tags: {
    p: {}, h2: {}, h3: {}, strong: {}, em: {}, u: {}, br: {}, ul: {}, ol: {}, li: {}, blockquote: {},
    a:   { attrs: { href: 'url', title: 'text', target: ['_blank'] } },
    img: { attrs: { src: 'imgurl', alt: 'text', width: 'int', height: 'int' } },
    figure: { classes: ['figure', 'figure--wide'] },
    figcaption: {},
    aside: { classes: ['note', 'note--warning', 'note--info'] },
  },
  rename: { b: 'strong', i: 'em', h1: 'h2', h4: 'h3', div: 'p' },   // applied before the check
  drop: ['video'],                                                   // more tags removed with their content
  schemes: { url: ['http', 'https', 'mailto', 'tel'], imgurl: ['http', 'https', 'relative'] },
});
```

* `profile="name"` on the element, or `el.profile = { tags: ... }` for an object, read when the editor connects (the toolbar is built from it; a later change re-sanitises the value). An unknown name or an invalid profile is reported in the console and the `default` is used.
* An attribute has a **type**: `text`, `url` (checked against `schemes.url`), `imgurl` (`schemes.imgurl`), `int` (up to five digits), or a **list** of allowed values (`target: ['_blank']`). `class` is never an attribute: `classes: [...]` keeps only those class names of that tag and drops the other tokens. A `data-*` attribute is kept only when it is declared by its full name (`'data-kind': 'text'`).
* There is no "allow everything". A profile that lists `style`, `srcdoc`, `srcset`, `on*`, a `href`/`src` that is not `url`/`imgurl`, an `id` that is not a list, a tag in the always-removed list, or an unknown tag **throws when it is defined**.
* `schemes` takes scheme names, `relative` (a URL without a scheme; never `//host` or a backslash host) and, for images only, `data:image` (raster `png`, `jpeg`, `gif`, `webp`, `avif`; never SVG). Schemes are read after spaces, control characters and zero-width characters are removed, so a tab inside `java	script:` or an entity trick is still `javascript:`.
* Structure follows the tag: `li` only inside `ul`/`ol`; `figure` holds `img` and `figcaption` (loose text in a figure becomes its caption; a figure without a usable image is removed); a phrasing element that holds blocks (`<b><p>..</p></b>`) is unwrapped so the blocks stay; a block inside a link or a list item, and a link inside a link, is flattened to its text with a space around each block. Unknown or unlisted wrappers are unwrapped and their text stays.
* Known tags: `p h1-h6 pre figcaption ul ol li blockquote aside div section figure strong em u s code sub sup mark small span abbr kbd a br img`.
* The toolbar offers a tool only when the profile keeps the tags it makes (no `blockquote`, no Quote button). `rich` also shows **Note** (an `aside`: the first press makes a note around the paragraph, the next turns info into warning, the next removes it) and, with `media`, **Image with caption** (`figure > img + figcaption`, the caption is edited in place). A note or figure already in the value is kept while people edit around it, and Backspace or Delete removes it like any block.

### One sanitiser, browser and server

`@xoong/richtext/sanitize` has no DOM and no dependency: the HTML is tokenised and put in a tree by a small parser of its own (comments, CDATA, entities, unclosed and misnested tags, raw-text elements),
checked against the profile, and written back as a string with its own escaping in a shape a browser parses to the same tree. **The same code gives the same bytes in a browser and in Node** (a shared case
list runs in both, byte for byte), and `sanitizeHtml(sanitizeHtml(x)) === sanitizeHtml(x)`. Use it on the server: a client is never a trust boundary.

```js
import { sanitizeHtml } from '@xoong/richtext/sanitize';   // Node, Deno, Bun, a worker, the browser

const safe = sanitizeHtml(body.html, 'rich');               // a registered name, or a profile object, or nothing for `default`
```

`@xoong/server` stays what it was (a static, proxy and dev handler without business logic): what to sanitise, and where, is your backend's job. Call `sanitizeHtml` with the same profile the editor uses on every richtext field before it is written, and keep the profile as one JSON file both sides import.

### Your own step: `sanitize`

`el.sanitize = (html, { source, profile }) => html` runs on every string that enters the editor or the value (`source` is `value`, `paste` or `input`) **before** the profile. Use it to
rewrite what a profile cannot say (turn Word's `<p class="MsoNormal">` into a note, replace an image host, strip a tracking parameter). The profile still has the last word, so the function can never let through what the profile
refuses; if it throws, the error is logged and the string goes on to the profile unchanged.

### How strong is the built-in filter, and when to add DOMPurify

The built-in `sanitizeHtml` is a **basic** filter, on purpose: it keeps a small allow-list of tags and attributes, checks URL schemes after removing the tricks that hide them, refuses
`on*`, `style` and `srcdoc`, drops `script`, `style`, `iframe`, `svg`, `math` and similar with their content, escapes everything it writes, and writes only a canonical shape. It needs no DOM, so the same
code runs in a browser and in Node and gives the same bytes. It is tested against a seeded fuzz judged in Chromium (no script-capable element, no event handler, no `style`, no URL outside the allow-list, and a
second pass changes nothing) and against the shared cases. It is **not** a general-purpose HTML sanitiser: it has a parser of its own (not a browser's), no SVG or MathML, no hooks, and no
years of attacks behind it. For the content of an xoong app that runs under a strict CSP (`script-src 'self'`), where an author is one of your own users, that is the right amount.

Add [DOMPurify](https://github.com/cure53/DOMPurify) in front of it when any of these is true:

* the content is shown **outside** an xoong app or without a strict CSP (an email, a mobile app, another site, a PDF);
* the authors are **untrusted** (public comments, user profiles, anything an attacker can post);
* a security review or a compliance rule asks for a sanitiser with a track record.

DOMPurify parses with the browser's own parser, so it is the better judge of what the input *means*. Use it as the **first** step and keep the built-in filter as the **last** one: the profile still decides what the editor
may keep, and the result is always in the canonical shape. The same two steps on the client and on the server give the same value.

**In the browser.** Install it and tell `xoong dev` and `xoong build` to serve it (a package that is not an `@xoong/*` one is named in `xoong.config.json`, see [server.md](server.md)):

```bash
npm install dompurify
```
```json
{ "packages": ["dompurify"] }
```
```js
// main.js
import '@xoong/richtext';
import DOMPurify from 'dompurify';

const editor = document.querySelector('xo-richtext');
editor.sanitize = (html) => DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
```

`sanitize` runs on every string that enters the editor or the value (`value`, `paste` and `input`), **before** the profile (see above). `USE_PROFILES: { html: true }` keeps HTML and removes SVG and MathML; the profile
then removes what the editor does not keep, so you do not need to list tags again. `sanitize` is a property of one editor: set it on each `xo-richtext` on the page, and on the ones that are added later when they are
created. It is a normal `import`, so if the file cannot be loaded the module fails as a whole; serve it from your own origin, as above, and not from a third-party CDN (a strict CSP refuses one anyway).

**On the server** (a client is never a trust boundary). DOMPurify needs a DOM in Node; `jsdom` is the usual one:

```bash
npm install dompurify jsdom @xoong/richtext
```
```js
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { sanitizeHtml } from '@xoong/richtext/sanitize';

const purify = createDOMPurify(new JSDOM('').window);

// DOMPurify first, then the same profile the editor uses, so what you store is what the editor would have produced
export const clean = (html, profile = 'rich') =>
  sanitizeHtml(purify.sanitize(html, { USE_PROFILES: { html: true } }), profile);
```

Requirements: `jsdom` 31 needs Node `^22.22.2 || ^24.15.0 || >=26`, so raise `engines.node` of your project to match. If your profile keeps `target="_blank"` on links (a profile with `target: ['_blank']`, such as the one `defineRichtextProfile` can build), add `ADD_ATTR: ['target']` to the DOMPurify options, because DOMPurify drops `target` by default (a link that opens a new tab without `rel="noopener"` can reach the page that opened it):

```js
purify.sanitize(html, { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] })
```

That is safe here: the built-in step still limits `target` to the values of the profile and writes `rel="noopener noreferrer"` on every link, so what is stored has both. The same option goes into the browser `sanitize` hook when you use one there.

Create the `JSDOM` and the `DOMPurify` instance once, not per request. In the cases tried, cleaning twice gives the same string as once (the built-in filter is stable by design), so cleaning on read as well as on write is safe.

Things to know:

* **Under a strict CSP the browser console shows messages** such as "Executing inline event handler violates the following Content Security Policy directive" when hostile input is cleaned. They come from DOMPurify's inert
  parse (DOMPurify alone logs them too), they are blocked and harmless, and they do not appear with the built-in filter alone.
* **What the editor can keep is still set by the profile**, not by DOMPurify. DOMPurify keeps tables, `<hr>` and `<h4>`, then the profile unwraps them (a table becomes spaced text). To keep more, define a richer profile
  with `defineRichtextProfile`, or for a read-only display (not the editor) show the DOMPurify output directly.
* **Keep both packages up to date.** DOMPurify has had bypasses fixed over the years; install both as ordinary dependencies, not optional ones, so that a weaker filter is never a silent fallback; this guide was checked with DOMPurify 3.4.18 and jsdom 31 on Node 26 in Chromium (a set of mutation-XSS shapes: SVG with a style,
  MathML with `mglyph`, `noscript`, obfuscated `javascript:`), and the result was safe and stable in both places.
* `sanitize` is the supported hook; if you replace the filter on the server too, keep the built-in `sanitizeHtml` as the last step so the shape matches.

### Migrating from 0.0.54

No breaking change in the editor: the `default` profile is the old behaviour, and `sanitizeHtml(html, { images: false })` still works. What to know:

* `sanitizeHtml` no longer needs a DOM (it works in Node) and is built on a parser of its own: a few inputs that a `<template>` handled by browser rules now follow the rules above (an unclosed `<math>`, `<svg>` or `<template>` removes everything after it, `<noscript>` content is dropped as raw text, and the text of a dropped element is not counted by `textOf`).
* Content that used to lose `class`, `figure` or `aside` still loses them under `default`. Choose `profile="rich"` (or your own) and clean what is already stored once with `sanitizeHtml(html, 'rich')`.
* Projects that stored Markdown convert it to HTML once, then run the converted HTML through `sanitizeHtml(html, profile)` in a one-off script on the server.

Paste and drop never insert the browser's own markup: the clipboard HTML is sanitised first, plain text becomes paragraphs. The live editor DOM stays clean, not only the value.

## Toolbar and keys

`role="toolbar"` with one tab stop: Tab reaches it once, Left, Right, Home and End move inside it, the next Tab goes to the editor. The tools, in the default order, are
`undo redo style bold italic underline ul ol quote link image note figure` (`tools="bold italic link"` picks and orders them; `image` and `figure` need `media`; a tool the profile does not allow is not shown; `h2` is also available as a plain toggle
button). `style` is a select with Paragraph, Heading 2 and Heading 3, and shows Mixed when the selection spans different blocks. Buttons show `aria-pressed` for the formatting at the
caret. Ctrl or Cmd+B, +I, +U and +K work.

**Two sizes, never wrapped, never scrolling sideways.** The toolbar is chosen by the editor's own width (a `ResizeObserver` on the editor, not the viewport), so an editor in a narrow
inspector gets the compact one even on a wide screen:

| Size | When | Shows |
|---|---|---|
| Full | the editor is 580px wide or more | every tool |
| Compact | narrower | style (P, H2, H3, Mixed), bold, italic, bulleted list, link, image, and a **More** menu holding underline, numbered list, quote, undo and redo |

`toolbar="full"` or `toolbar="compact"` forces one size. The More menu is a menu button: Enter, Space or a click opens it, ArrowDown opens it on the first item, arrows wrap, Home and End jump,
Escape closes it and returns to the button, Tab closes it, choosing an item runs it. `data-size` on the toolbar tells CSS which size is on.

**Expanding.** `el.expand()` opens the same editor (it moves, it is not copied: value, caret and undo history stay) in a dialog, 960px wide, the whole screen under 768px; Done and Escape close it,
`el.collapse()` does the same from code. It fires `xo-richtext-expand` and `xo-richtext-done` and never saves anything: it only changes where the editor is shown. The host places its own
Expand button (for example on the field's label row) and calls `expand()`; `el.expanded` says whether it is open.

Editing uses the browser's own commands (`document.execCommand`), so undo and redo, IME, spell checking and platform shortcuts behave natively. That API is deprecated on paper and has no
replacement that works across browsers yet; the editor keeps all of it in one place and the browser tests (Chromium, Firefox, WebKit) will tell when it must change.

## Links

The link tool opens a small box (an address field with Apply and Remove link). With text selected the selection becomes the link; with only a caret the address is inserted as the text; a caret inside
a link edits or removes the whole link. An address without a scheme is completed (`example.com` becomes `https://example.com`, `me@example.com` becomes `mailto:`); anything but http, https, mailto and tel is
refused with a message. Enter applies, Escape closes.

## Media

The editor has no media library. With `media` the image tool fires a cancelable **`xo-pick-media`** event whose `detail.insert` puts an image in at the caret:

```js
editor.addEventListener('xo-pick-media', (event) => {
  event.preventDefault();                       // "I handle this"
  openMyLibrary().then((file) => event.detail.insert({ src: file.url, alt: file.name }));   // now or later
});
```

`el.insertImage(src, alt)` does the same from code, and `el.insertFigure(src, alt, caption)` inserts an image with a caption (the Image with caption tool uses `detail.insert({ src, alt, caption })`). An unsafe `src`, or a profile without `figure`, is refused (`false`).

## Languages

Strings are `xoong.richtext.*` keys of the built-in catalog (Vietnamese included).

## Not included (yet)

Tables, code blocks, text alignment, colours, mentions, collaborative editing, and a floating toolbar. They are applications of the same pieces; ask before adding any of them to the package.
