# @xoong/forms

Forms for xoong: a draft model with per-field state, validation from the OpenAPI request schema, your own rules, payload normalisation and dirty tracking, bound to plain `<form xo-submit>` markup.

## Install

```bash
npm install @xoong/forms
```

## Use

```html
<xo-view get="getPerson" p-id="1">
  <form xo-submit="updatePerson">
    <input name="name"> <input name="email" type="email">
    <button>Save</button>
  </form>
</xo-view>
```
Importing `@xoong/ui` (or `@xoong/forms` itself) turns every `<form xo-submit>` into a form with a model: `form.model`, `$form.dirty`, server errors by field.

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/forms
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
