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

`sanitizeHtml()` decides what the value may contain, on every input, paste, drop, `value` set and reset:

| Allowed | Notes |
|---|---|
| `p`, `h2`, `h3`, `blockquote`, `ul`, `ol`, `li`, `br` | `h1` becomes `h2`, `h4` to `h6` become `h3`, `div` becomes `p`; loose text is wrapped in `p` |
| `strong`, `em` | `b` and `i` are mapped |
| `a` with `href` (and `title`) | only `http:`, `https:`, `mailto:`, `tel:`; `rel="noopener noreferrer"` is added; any other link keeps its text and loses the link |
| `img` with `src`, `alt`, `width`, `height` | `src` must be `http(s)` or a relative URL (no `data:`, no `javascript:`, no `//host`); sizes are digits only |

Everything else is unwrapped (its text stays); `script`, `style`, `iframe`, `object`, `embed`, `svg`, `math`, `template`, `noscript`, form controls and the like are removed with their
content. No attribute outside the table survives (no `style`, `class`, `id`, `on*`). Non-breaking spaces become spaces and blank paragraphs at the very start or end are removed.
The result is built as a string with its own escaping from an inert parse, so it does not pass through the parser in another shape than the one that was checked
(mutation XSS shapes are in the tests). The same function is exported (`@xoong/richtext/sanitize`) for the **server side**: sanitise on save as well, since a client is never a trust boundary.

Paste and drop never insert the browser's own markup: the clipboard HTML is sanitised first, plain text becomes paragraphs. The live editor DOM stays clean, not only the value.

## Toolbar and keys

`role="toolbar"` with one tab stop: Tab reaches it once, Left, Right, Home and End move inside it, the next Tab goes to the editor. The tools are `bold italic h2 ul ol quote link image undo redo`
(`tools="bold italic link"` picks and orders them; `image` needs `media`). Buttons show `aria-pressed` for the formatting at the caret. Ctrl or Cmd+B, +I and +K work.

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

`el.insertImage(src, alt)` does the same from code. An unsafe `src` is refused (`false`).

## Languages

Strings are `xoong.richtext.*` keys of the built-in catalog (Vietnamese included).

## Not included (yet)

Tables, code blocks, text alignment, colours, mentions, collaborative editing, and a floating toolbar. They are applications of the same pieces; ask before adding any of them to the package.
