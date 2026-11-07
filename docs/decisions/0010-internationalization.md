# ADR-0010: Internationalization: ICU-subset catalogs, `xo-t` in markup, Intl for formats

Status: Accepted (design; implementation follows, see "Order of work")

## Context
Multi-language is a requirement for xoong apps, and it is three different problems that are usually mixed up:
1. **Interface text**: the words of the application (buttons, headings, messages), and xoong's own built-in strings (validation
   messages, "Previous / Next", "Confirm", "selected").
2. **Formatting**: dates, numbers, relative times, plurals, lists; they must follow the active language.
3. **Content**: data that exists in several languages, for example a record with `title: { en, vi, zh }`. That is a field type in the API,
   handled by forms (`pruneEmpty`, `emptyAs`, per-path state) and by the application's own editing UX, not by an interface catalog.
Also: the document language and direction (`<html lang dir>`), language choice and detection, URLs and SEO per language, loading only the
language the person uses, and prerendering per language.

## Survey (what exists, and what we take from it)
* **Unicode MessageFormat 2 and `Intl.MessageFormat`.** MF2 is a Final Candidate in the Unicode spec, but the TC39 `Intl.MessageFormat`
  proposal has not shipped in browsers; as of May 2026 it is reported at Stage 2, held back until about a dozen organisations use MF2 in
  production ([Locize on MF2](https://www.locize.com/blog/messageformat-2-i18next), [TC39 proposal](https://www.github.com/tc39/proposal-intl-messageformat)).
  We cannot depend on it; we can choose a syntax that moves to it mechanically.
* **ICU MessageFormat 1** (FormatJS / react-intl, Lingui, and a plugin in Paraglide): the format translators' tools (Crowdin, Lokalise,
  Transifex, Phrase) know best: arguments, `plural`, `select`, `selectordinal`. Too large to implement fully; a small subset covers real
  interface text.
* **Fluent** (Mozilla): the best design for natural-language edge cases (selectors, terms, attributes) and the origin of the
  *declarative DOM localization* idea (`data-l10n-id` on elements, the source text stays as fallback). Fewer translation tools support it.
* **i18next**: very widely used, plugin ecosystem; keys with plural suffixes (`item_one`, `item_other`), a runtime that grows with plugins.
* **Paraglide / compile-time libraries** (Angular's built-in i18n too): messages compiled to typed functions, excellent tree-shaking
  ([comparison, vendor-authored](https://hol-docs.pages.dev/reference/lib/paraglide/comparison)); they need a build step and a bundler. xoong's apps are
  template-driven HTML with no required build, where unused-message elimination is not the problem.
* **Angular Signal Forms** do not use the browser's own validation messages, so validation text is a library concern there as well
  ([Angular guide](https://angular.dev/guide/forms/signals/validation)); xoong does the same (ADR-0009: the model produces the messages).
* **The platform**: `Intl.NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`, `PluralRules`, `ListFormat`, `DisplayNames` and
  `Intl.Locale` already do formatting and plural selection correctly for every language. A library should call them, not re-implement them.

## Decision

### 1. One package, zero dependencies: `@xoong/i18n`
It depends only on `@xoong/core` (signals). The data layer, forms and the admin set read the active language through small hooks
(the same pattern as the form engine), so applications that do not translate do not load it.

### 2. Catalogs are plain JSON, messages are an ICU subset
```json
{
  "articles.title": "Articles",
  "articles.summary": "Showing {from}–{to} of {total, number}",
  "articles.count": "{count, plural, =0 {No articles} one {# article} other {# articles}}",
  "greeting": "{gender, select, female {Welcome, Ms {name}} male {Welcome, Mr {name}} other {Welcome, {name}}}"
}
```
Supported: `{arg}`, `{arg, number}`, `{arg, date}`, `{arg, time}`, `{arg, relative}`, `{arg, plural, =n {} zero/one/two/few/many/other {}}` with `#`,
`{arg, select, ...}`, `{arg, selectordinal, ...}`, escaping with `'`. Plural categories come from `Intl.PluralRules`, formats from
the same `format()` as `{value | date}`. Unknown syntax is reported once and the raw message is shown, never an exception. This subset is
valid ICU MessageFormat 1 and maps onto MF2 constructs, so catalogs can be moved to MF2 when `Intl.MessageFormat` ships.

### 3. In markup: one attribute, the source text is the fallback
```html
<h1 xo-t="articles.title">Articles</h1>
<input xo-t="placeholder:search.placeholder; aria-label:search.label" placeholder="Search" aria-label="Search">
<xo-view get="/articles"><p xo-t="articles.summary">Showing {$from}–{$to} of {total}</p></xo-view>
```
* `xo-t="key"` replaces the element's text with the translation; `xo-t="attr:key; attr2:key2"` translates attributes. The text written in the
  HTML is the **default**: it is shown until the catalog is loaded, when a key is missing, and it is the source `xoong i18n extract` collects
  into a catalog template. No separate source file to keep in step.
* Placeholders in a message are resolved from the **scope**: inside an `xo-view` the same names as `{path}` interpolation (`{total}`,
  `{$from}`, `{name}`); outside a view there are none. No second argument syntax.
* Elements inside an `xo-view` are translated by the view (it has the scope); everywhere else (route templates, layouts, static pages) by a
  document-level enhancer. A change of language re-translates both.
* JavaScript: `t('articles.count', { count: 3 })`, `locale` (signal), `setLocale('vi')`, `onLocaleChange(fn)`.

### 4. Language state
* `locale` is a signal. `setLocale(code)` loads the catalog if needed (`configure({ i18n: { locale, fallback, messages, load } })`, where `load(locale)`
  returns the JSON, for example `import('/i18n/vi.json')`), updates `<html lang>` and `dir` (`Intl.Locale#getTextInfo`, with a small RTL list
  as fallback), and notifies readers. Fallback chain: exact locale, language without region (`pt-BR` to `pt`), the fallback locale, the inline default.
* Detection and persistence are the application's (URL prefix, cookie, `localStorage`, `navigator.language`): `detectLocale(supported)` is a helper, not a policy.
* **Interface text, formats and the built-in strings all follow the same locale.** `{x | date}` and the `format()` family use it.

### 5. xoong's own strings are a catalog too
Validation messages, table text, confirm buttons, toast actions are keys under `xoong.*` with English defaults compiled in. An application
translates them by adding `xoong.*` keys to its catalogs. `setMessages` (validation) keeps working as an override. xoong ships English; other
languages are catalogs (we will provide Vietnamese for the built-in strings; contributions for others use the same extraction).

### 6. Content in several languages is data, not interface text
* A localized field is an object keyed by BCP47 tag (`{ en, vi }`). Reading it: `{title | localized}` picks the active language, then the fallback chain,
  then the first non-empty entry. Writing it: forms treat it as a nested object with `pruneEmpty`/`emptyAs` (ADR-0009); how editors switch
  languages is the application's component (it can read `$form.filled[...]` and listen to `xo-reveal`).
* Server-rendered or prerendered pages per language: `xoong render --locale vi` loads that catalog, sets `<html lang>`, and the URL
  strategy (`/vi/...`) is the application's, using `<xo-router base="/vi">` per language file or a path prefix handled by the server.
  `hreflang` links are authored in the page head. Router-level locale prefixes are not part of this decision.

### 7. Tooling
`xoong i18n extract <html|js files> --out catalogs/en.json` lists every `xo-t` key with its inline default (and `t('key')` calls);
`xoong check` reports a key used in markup but missing from a given catalog, a message whose placeholders differ from the source
(translations must use the same arguments), and ICU syntax errors. A test keeps `llms.txt`, the editor data and the docs in step.

## Not chosen, and why
* **Fluent**: better language model, worse tool support; ICU subset is what translators and vendors already handle.
* **i18next**: pluralization by key suffix and a plugin runtime are more machinery than a template-driven framework needs.
* **Compile-time message functions**: require a build step; the benefit (dropping unused messages) is small for per-page catalogs.
* **Waiting for `Intl.MessageFormat`**: not available; the subset is chosen so that moving to it is mechanical.
* **A second argument syntax** (`xo-t-args`): placeholders come from the scope, as everywhere else in xoong.

## Consequences
+ One catalog format and one attribute cover app text, xoong's own text and validation messages; formats and plurals come from the platform.
+ The source language lives in the HTML, with a tool to extract it; translators receive standard ICU JSON.
+ Per-language prerendering works with the existing `xoong render`.
- A small ICU parser to maintain (about 150 lines), with a test suite taken from ICU's documented behaviour.
- Right-to-left layouts need logical CSS properties; `xoong.css` is moved to them in the same change.
- Admin copy that is English-only (rainlet's current rule) needs nothing: no catalog is a valid configuration, defaults show.

## Order of work
1. `@xoong/i18n` core: locale signal, ICU subset, catalogs and fallback, `setLocale`, `<html lang dir>`; `format()` follows the locale.
2. `xo-t` (inside views and everywhere else) and the `localized` format.
3. xoong's own strings as `xoong.*` keys (validation, table, confirm, toast); Vietnamese for them.
4. `xoong i18n extract`, `xoong check` rules, docs and `llms.txt`; logical CSS; Firefox/WebKit tests of language switching.
