# ADR-0009: Forms are a model plus derived field state; the rules come from the API schema

Status: Accepted (first implementation in progress)

## Context
Real admin screens are not a handful of text inputs. A single screen edits a record with dozens of typed fields, nested objects
(`title.en`, `title.vi`), arrays of objects with their own fields, tagged variants (a page made of blocks), and sometimes a large table
of such records. Every one of those fields already has a type, a format, limits and a pattern in the OpenAPI document; writing them
again in the frontend (and keeping them in step) is where the time goes and where bugs come from.

The goal, in the owner's words: given the API schema, the author writes the form's HTML, points it at a data path, and the form finds
the variables and their types by itself. Custom rules and patterns stay possible.

Reference: Angular's Signal Forms (`@angular/forms/signals`, experimental in Angular 21). Its data flow is the right one:
* **the model is a signal and the single source of truth**; the form is a tree of *derived* field state over it (value, valid, errors,
  touched, dirty, disabled, pending ...), never a second copy of the data;
* **rules are declared once, per path**, not scattered over controls; a rule is a plain function of the value and the model;
* **the DOM is a view**: user input writes into the model, model changes flow back to the DOM;
* **submission** touches everything, validates, runs the action, and **maps server errors back onto fields** by path.

What xoong does differently, because it already has something Angular does not: an API contract. The rules do not have to be
written. And xoong's authors write HTML, so binding is by `name` path, not a directive per control.

## Decision

### One model, five small parts
```
OpenAPI request schema ──sync──▶ bodySchema (in operations.json)
                                     │
   data path (store entity) ─▶  baseline ──copy──▶  draft (signal, typed)  ◀── input/change events (delegated, by name path)
                                                        │
                    rules (schema-derived + custom) ────┤
                                                        ▼
                                     field state per path (derived signals):
                                     value, error, touched, dirty, valid, pending
                                                        │
                                                        ▼
                      DOM: attributes, aria-invalid/describedby, messages, $form in markup
                                                        │
                       submit: touch all → validate → focus first invalid → mutate → server errors back onto paths
```
1. **`schema.js` (pure, no DOM)**: the schema node model; `nodeAt(schema, path)`; `coerce(node, raw)` (strings from controls to typed
   values); `validate(node, value)` returning `{ 'items[2].title': 'message' }`; `defaults(node)`; the message catalogue.
2. **`form-model.js` (pure signals, no DOM)**: `createForm({ schema, value, rules })` returns the draft signal, the baseline, `field(path)`,
   `errors`, `dirty`, `touched`, `valid`, `submitting`, `setValue`, `validate`, `reset`, `markPristine`. This is xoong's `form(model, schema)`
   and is testable without a browser.
3. **`form-dom.js` (the binder)**: attaches a model to a `<form>`: finds controls by `name` path, completes their attributes from the
   schema, writes values in, listens for input/change/blur, renders errors, focuses the first invalid control, exposes `$form`.
4. **`xo-submit` uses it**: any `<form xo-submit>` whose operation has a `bodySchema` gets all of this automatically, hand-written or generated.
5. **`<xo-form>` is only a markup generator** over the same binder: it writes the controls (with labels, hints, nested fieldsets, array
   editors) and then the binder does the rest. There is no second validation path.

### Authoring: write the HTML, name the fields, point at the data
```html
<xo-view get="getArticle" p-id=":id">
  <form xo-submit="updateArticle">            <!-- the record shown by the view is the baseline: fields fill themselves -->
    <label>Slug <input name="slug"></label>   <!-- type, required, pattern, maxlength come from the schema -->
    <label>Title (en) <input name="title.en"></label>
    <label>Published <input name="publishedAt"></label>   <!-- date-time: a datetime-local input, ISO in and out -->
    <template xo-each="tags"><input name="tags[{$index}]"></template>
    <button>Save</button>
  </form>
</xo-view>
```
* **Data path.** The form edits the record of its scope (the enclosing `xo-view` item); `xo-body="path"` on the form picks another
  record. Without a record, the baseline is the schema's defaults.
* **Binding by name.** `name` is a path: `a.b`, `a[2].b` (`a.2.b` is read the same). The binder looks the path up in the schema and fills
  in only what the author did not set: `type`, `required`, `min`/`max`/`step`, `minlength`/`maxlength`, `pattern`, `multiple`, options of an
  enum `<select>`. An attribute written in the HTML always wins.
* **Typed values.** Controls give strings; the draft holds numbers, booleans, `null`s and nested objects according to the schema.
  What is sent is the draft, not `FormData`.

### Validation
* **The browser's constraint validation is the UI** (`setCustomValidity`, `aria-invalid`, `aria-describedby`, `:user-invalid`), so
  assistive technology and native behaviour work. The schema rules produce the messages; the browser shows nothing of its own.
* Rules from the schema: required, type/integer, minimum/maximum (exclusive too), multipleOf, minLength/maxLength, pattern, format
  (email, uri, uuid, date, date-time), enum, minItems/maxItems/uniqueItems, nullable. Messages are a catalogue, replaceable per
  language (`configure({ messages })`), each receiving its parameters.
* When: on blur first (a field the person has not left stays quiet), then on every input once it has an error; everything on submit,
  and the first invalid control takes focus.
* **Custom rules are plain functions keyed by path**, async allowed (the field is `pending` meanwhile):
  ```js
  form.rules = {
    slug: async (value, { record }) => (await isTaken(value, record.id)) ? 'Already used' : '',
    'dates.end': (value, { record }) => value < record.dates.start ? 'Must be after the start' : '',
    '*': (record) => ({ 'a': 'Either a or b is needed' }),   // whole record: cross-field errors by path
  };
  ```
  A rule returns `''` (valid) or a message. `pattern` is the HTML/OpenAPI `pattern`, nothing new.
* **Server errors** (`error.fields`, already parsed from problem+json, FastAPI and envelopes) are merged onto the same paths, and
  clear when that field is edited.

### State, readable from markup and JavaScript
`$form` in markup (`$form.dirty`, `$form.valid`, `$form.submitting`, `$form.touched`, `$form.error` and per field `$form.errors['title.en']`),
and the same signals on the form element in JavaScript. `dirty` compares the draft with the baseline by value, so undoing an edit makes
it pristine again. After a successful save the baseline becomes the saved record. If the entity changes underneath (a live update): a
pristine form follows it; a dirty form keeps the draft and sets `$form.stale`.

### Large and varied records
* The binder works per path, so a form of 200 fields costs the same as one of 3: it is a delegated listener and a map of paths, not
  200 objects with subscriptions. Rendering an array of objects is `xo-each` over the draft (`name="items[{$index}].title"`), keyed.
* A union (`oneOf` with a discriminator) renders the sub-form of the selected variant (`xo-if` on the discriminator); switching variants
  resets only that branch of the draft.
* The same field binding (schema node + path) is what an editable table cell will use; tables are a later step on top of this model.

### Requirements settled with the first consumer (rainlet admin)
These came from a real admin with localized fields (five locales, one visible at a time), a block editor and date-times, and changed the design:
1. **Validity lives in the model, not in the DOM.** Native constraint validation on a hidden control blocks submit with "not focusable".
   The binder sets `novalidate`; submit validates the model; hidden controls count and show their error when revealed. "Focus the first
   invalid control" first dispatches a cancelable, bubbling `xo-reveal` `{ path }` on the form so the app can switch a tab or select a block;
   if a listener calls `preventDefault()` the form waits one frame, then focuses the control if it is focusable.
2. **Per-path state is readable from any markup**, not only from controls: `$form.errors['title.vi']`, `$form.touched[..]`, `$form.filled[..]`,
   `$form.dirty[..]` (a tab can show an error dot or a "missing translation" dot).
3. **The payload is normalised in one declared way.** Only properties of the *request* schema are sent (`id`, `createdAt` of the baseline never
   go out; a node of type `any` keeps its content). `emptyAs: "omit" | "null"` (default omit for optional values) per schema or path;
   `pruneEmpty: true` on an object schema removes empty members, and an object left empty follows its own `emptyAs`. Escape hatch:
   `form.serialize = (draft, defaultBody) => body`.
4. **Dirty uses the same normalisation**: dirty means `normalise(draft)` differs from `normalise(baseline)`, so opening a form, or typing and
   deleting, is pristine.
5. **Date-times round-trip.** The DOM writes to the draft only on a user input event, so an untouched `date-time` keeps its exact original string;
   an edit converts local time to UTC ISO.
6. **Widgets are an open registry.** `widget` is a built-in name (textarea, select, datetime, date, password, url, email, color, richtext
   when it exists) or the tag of any custom element that extends `XoControl`. The binder treats any `XoControl` with a `name` as the field
   of that path and gives it properties `schema` (its node), `hints` (every hint key of the field, unknown ones included) and `form` (the
   model, to read other paths). The same registry serves array items and union variants. Media libraries and crop tools are such widgets,
   written by the application.
Hint keys xoong acts on: `label`, `hint`, `placeholder`, `widget`, `order`, `readOnly`, `hidden`, `group`, `emptyAs`, `pruneEmpty`. Any other
key (and any unknown key on a schema) is **passed through** to the widget untouched. Domain concepts such as locales, or a slug that follows
another field, are not xoong's: they are widgets and components of the application built on these primitives.

### What stays out
No form builder, no layout vocabulary, no second expression language. Widgets are native elements or `XoControl`s (ADR in progress for rich text).
Field presentation hints (label, hint, placeholder, widget, order, read-only) come from OpenAPI `title`/`description`, an `x-xoong-widget`
extension, and a `fields` map in `xoong.hints.json` keyed `Schema.property` for specs that cannot be edited.

## Consequences
+ An author writes the layout once and gets types, constraints, prefill, dirty tracking and server-error mapping for free; a screen of
  many typed fields needs no per-field code.
+ One validation path (model + rules) for hand-written and generated forms, tested without a DOM.
+ Large records are cheap: no per-field objects.
- `operations.json` grows by the request schemas (response schemas are not included).
- A new concept to learn (`$form`, `rules`), but one that maps to a familiar model (Angular Signal Forms, Vue/React form libraries).
- The first implementation covers objects with primitives and nested objects; arrays and unions follow in steps (P0-3).
