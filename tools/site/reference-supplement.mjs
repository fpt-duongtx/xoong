// What the reference cannot read from the code: an example, a guide page, the words a person might search for, and the types of the attributes that
// `static props` does not declare. Everything else in site/reference.json is GENERATED (tools/site/reference-data.mjs): the descriptions and attribute
// lists from packages/cli/src/html-data.js, the names from packages/core/src/syntax.js, the signatures from packages/*/src/index.d.ts.
// test/reference.test.mjs runs every HTML example through `xoong check` and keeps the names here in step with the code.
// Text uses `backticks` for code, like html-data.js.

/** The five groups, in the order of the page and the menu. */
export const GROUPS = [
  { id: 'elements', label: 'Elements', menu: 'Elements', summary: 'Every xo-* element: what it does, its attributes, its events and an example.' },
  { id: 'directives', label: 'Directives', menu: 'Directives', summary: 'The xo-* attributes you put on your own markup: data, actions, form rows, routing, dialogs.' },
  { id: 'events', label: 'Events', menu: 'Events', summary: 'The events xoong elements fire, what is in `detail`, and who listens.' },
  { id: 'api', label: 'JavaScript API', menu: 'JavaScript API', summary: 'The functions and objects you import when HTML is not enough.' },
  { id: 'template', label: 'Template syntax', menu: 'Template syntax', summary: 'What goes between braces inside an <xo-view>: paths, formats and view variables.' },
];

// ---- elements ---------------------------------------------------------------------------------------------------------------------
// guide: a page of the site (optionally #anchor); events: names in EVENTS; types: the type of an attribute `static props` does not declare, or one that is
// more specific than text/number/flag (list, JSON, selector, operation, path); defaults: when the description does not say it in a way the generator reads.
export const ELEMENTS = {
  'xo-view': {
    guide: 'data.html', events: ['xo-done', 'xo-error', 'xo-invalid', 'xo-notice', 'xo-go'], keywords: 'screen page read fetch load data list query live stream',
    types: { get: 'operation', live: 'flag', 'url-params': 'list' },
    example: `
<xo-view get="listPeople" url-params="name,role">
  <p xo-if="$loading">Loading…</p>
  <p xo-if="$error">{$error.detail}</p>
  <ul>
    <li xo-each="items">{name} · {email}</li>
  </ul>
</xo-view>`,
  },
  'xo-table': {
    guide: 'data.html', events: ['xo-columns-change'], keywords: 'grid list rows columns sort filter search page pagination select bulk cards',
    types: { of: 'path', columns: 'list', sortable: 'flag', selectable: 'flag', filters: 'list', 'page-size': 'number', cards: 'flag', title: 'text', status: 'text', empty: 'text', 'page-sizes': 'list', 'column-picker': 'flag', 'hidden-columns': 'list', 'columns-key': 'text' },
    defaults: { of: 'items' },
    example: `
<xo-view get="listPeople">
  <xo-table columns="name,email:E-mail,role" sortable filters="name:Search by name" selectable page-size="10" empty="Nobody here">
    <span slot="role" class="badge">{role}</span>
    <button xo-click="deletePerson" xo-confirm="Delete {name}?" xo-notice="Deleted">Delete</button>
    <button slot="bulk" xo-click="deletePerson" xo-selected>Delete ticked</button>
  </xo-table>
</xo-view>`,
  },
  'xo-form': {
    guide: 'forms.html', events: ['xo-done', 'xo-error', 'xo-invalid', 'xo-dirty', 'xo-reveal', 'xo-form-ready'], keywords: 'input fields validation submit schema generate create edit',
    types: { op: 'operation', submit: 'text' },
    example: `<xo-form op="createPerson" submit="Add person" xo-notice="Person added"></xo-form>`,
  },
  'xo-dialog': {
    guide: 'dialogs.html', keywords: 'modal popup window overlay confirm sheet',
    types: { heading: 'text', size: 'choice', dismiss: 'flag' },
    example: `
<button xo-open="#add">Add person</button>
<xo-dialog id="add" heading="Add person" size="wide" dismiss>
  <xo-form op="createPerson" submit="Add"></xo-form>
  <button slot="footer" xo-close>Cancel</button>
</xo-dialog>`,
  },
  'xo-toast': {
    guide: 'dialogs.html', keywords: 'notification snackbar message notice alert undo error success',
    types: { timeout: 'number' }, defaults: { timeout: '6' },
    example: `<xo-toast timeout="8"></xo-toast>`,
  },
  'xo-router': {
    guide: 'arch-routing.html', events: ['xo-navigate', 'xo-error'], keywords: 'route navigation spa history links layout guard base url',
    types: { base: 'text', 'base-links': 'flag' },
    example: `
<xo-router base="/admin" base-links>
  <template xo-layout="shell">
    <nav><a href="/users">Users</a></nav>
    <main xo-outlet></main>
  </template>
  <template xo-route="/users/:id" layout="shell" title="User">
    <xo-view get="getPerson" p-id=":id"><h1>{name}</h1></xo-view>
  </template>
  <template xo-route="*">Not found</template>
</xo-router>`,
  },
  'xo-pager': {
    guide: 'recipes.html', keywords: 'pagination page next previous paging offset limit total',
    types: { 'page-size': 'number', 'page-sizes': 'list' },
    example: `
<xo-view get="listPeople">
  <ul><li xo-each="items">{name}</li></ul>
  <xo-pager page-size="12" page-sizes="12,24,48"></xo-pager>
</xo-view>`,
  },
  'xo-tabs': {
    guide: 'tabs.html', events: ['xo-tab-change'], keywords: 'tab panel section',
    example: `
<xo-tabs label="Person">
  <section xo-tab="General" id="general"><label>Name <input name="name"></label></section>
  <section xo-tab="Topics" id="topics">…</section>
</xo-tabs>`,
  },
  'xo-menu': {
    guide: 'menu.html', events: ['xo-menu-select', 'xo-menu-open', 'xo-menu-close'], keywords: 'dropdown actions context popup choice radio',
    example: `
<xo-menu label="Actions">
  <button xo-menu-trigger>Actions</button>
  <button>Duplicate</button>
  <a href="/people/1">Open</a>
</xo-menu>`,
  },
  'xo-combobox': {
    guide: 'combobox.html', events: ['xo-search'], keywords: 'select dropdown autocomplete typeahead picker chips multiple options',
    types: { 'options-op': 'operation', 'option-value': 'path', 'option-label': 'path' },
    example: `
<xo-combobox name="topics" label="Topics" multiple>
  <option value="web">Web</option>
  <option value="data">Data</option>
  <option value="design">Design</option>
</xo-combobox>`,
  },
  'xo-tags': {
    guide: 'combobox.html', keywords: 'chips keywords labels free text input',
    example: `<xo-tags name="keywords" label="Keywords" placeholder="Add a keyword"></xo-tags>`,
  },
  'xo-richtext': {
    guide: 'richtext.html', events: ['xo-pick-media', 'xo-richtext-expand', 'xo-richtext-done'], keywords: 'editor wysiwyg html formatting bold italic image toolbar',
    example: `<xo-richtext name="bio" label="Bio" toolbar="compact" maxlength="2000" media></xo-richtext>`,
  },
  'xo-carousel': {
    guide: 'carousel.html', events: ['xo-carousel-change'], keywords: 'slider slides gallery banner cards swipe slideshow',
    example: `
<xo-carousel label="Services" items="3" dots counter loop>
  <article>First</article>
  <article>Second</article>
  <article>Third</article>
  <article>Fourth</article>
</xo-carousel>`,
  },
  'xo-switch': {
    guide: 'more-controls.html#choose', keywords: 'toggle checkbox on off boolean setting',
    types: { size: 'choice' },
    example: `<xo-switch name="notify" checked>Email me about new comments</xo-switch>`,
  },
  'xo-date': {
    guide: 'more-controls.html#dates', keywords: 'calendar datepicker day range',
    types: { 'week-start': 'number' },
    example: `<xo-date name="publishedAt" label="Publish on" value="2026-11-25"></xo-date>`,
  },
  'xo-time': {
    guide: 'more-controls.html#dates', keywords: 'hour minute clock',
    example: `<xo-time name="at" label="Time" step="15" value="09:30"></xo-time>`,
  },
  'xo-slider': {
    guide: 'more-controls.html#numbers', keywords: 'range track number',
    types: { labels: 'list' },
    example: `<xo-slider name="quality" label="Image quality" min="0" max="100" step="5" value="80"></xo-slider>`,
  },
  'xo-stepper': {
    guide: 'more-controls.html#numbers', keywords: 'number plus minus quantity spinner increment',
    example: `<xo-stepper name="perPage" label="Items per page" min="1" max="100" step="5" value="25"></xo-stepper>`,
  },
  'xo-password': {
    guide: 'more-controls.html#text', keywords: 'secret show hide reveal credential',
    example: `<xo-password name="password" label="Password" autocomplete="new-password"></xo-password>`,
  },
  'xo-copy': {
    guide: 'more-controls.html#text', events: ['copied', 'copy-failed'], keywords: 'clipboard copy button api key',
    example: `<xo-copy label="API key" value="xo_live_4f9a7f3a"></xo-copy>`,
  },
  'xo-image': {
    guide: 'more-controls.html#page', keywords: 'picture photo lazy placeholder fallback ratio responsive',
    types: { ratio: 'text', fit: 'choice' },
    defaults: { fit: 'cover', loading: 'lazy' },
    example: `<xo-image src="img/landscape.svg" alt="A landscape" ratio="16/9" fallback="img/placeholder.svg"></xo-image>`,
  },
  'xo-theme-toggle': {
    guide: 'more-controls.html#page', events: ['xo-theme-change'], keywords: 'dark mode light theme switch colour scheme',
    defaults: { storage: 'xoong-theme' },
    example: `<xo-theme-toggle></xo-theme-toggle>`,
  },
  'xo-accordion': {
    guide: 'more-controls.html#structure', events: ['xo-accordion-change'], keywords: 'collapse expand details faq sections',
    example: `
<xo-accordion single>
  <details><summary>Does it need a build?</summary><div class="xo-accordion__body">No.</div></details>
  <details><summary>Can I use my own styles?</summary><div class="xo-accordion__body">Yes.</div></details>
</xo-accordion>`,
  },
  'xo-popover': {
    guide: 'more-controls.html#structure', events: ['xo-popover-open', 'xo-popover-close'], keywords: 'panel popup dropdown notifications overlay',
    types: { anchor: 'selector', open: 'flag' },
    example: `
<div class="xo-notify">
  <button aria-label="Notifications">Bell</button>
  <xo-popover label="Notifications"><p>Nothing new.</p></xo-popover>
</div>`,
  },
  'xo-consent': {
    guide: 'more-controls.html#page', events: ['xo-consent'], keywords: 'cookies privacy gdpr banner analytics marketing',
    types: { categories: 'list' }, defaults: { storage: 'xoong-consent' },
    example: `
<xo-consent categories="analytics,marketing">
  <b>We use two cookies.</b> One keeps you signed in, one measures anonymous visits.
</xo-consent>
<button xo-consent-open>Cookie settings</button>`,
  },
  'xo-file': {
    guide: 'more-controls.html#file', events: ['xo-file-reject'], keywords: 'upload drop zone attachment image pdf',
    types: { accept: 'text', 'max-size': 'text' },
    example: `<xo-file name="logo" label="Logo" accept="image/*" max-size="2MB" hint="PNG or SVG, up to 2 MB"></xo-file>`,
  },
  'xo-command': {
    guide: 'more-controls.html#page', events: ['xo-command-run'], keywords: 'palette search commands shortcut ctrl k spotlight',
    defaults: { shortcut: 'k' },
    example: `
<xo-command shortcut="k" label="Search commands">
  <a href="/articles" data-group="Go to">Articles</a>
  <button data-group="Actions" data-value="new-article">New article</button>
</xo-command>`,
  },
  'xo-chart': {
    guide: 'more-controls.html#structure', keywords: 'graph bar line plot data visualisation table',
    types: { data: 'JSON', unit: 'text', heading: 'text', 'value-heading': 'text' },
    defaults: { type: 'bar' },
    example: `<xo-chart type="bar" label="Visits per day" unit="k" data='[{"label":"Mon","value":12},{"label":"Tue","value":18},{"label":"Wed","value":9}]'></xo-chart>`,
  },
  'xo-range-slider': {
    guide: 'more-controls.html#numbers', keywords: 'minimum maximum two thumbs price range',
    types: { 'min-label': 'text', 'max-label': 'text' },
    example: `<xo-range-slider name="price" label="Price" min="0" max="100" value="20,70" min-label="Minimum price" max-label="Maximum price"></xo-range-slider>`,
  },
  'xo-segmented': {
    guide: 'more-controls.html#choose', keywords: 'buttons choice toggle group radio',
    example: `
<xo-segmented name="period" label="Billing period" value="month">
  <button value="month">Monthly</button>
  <button value="year">Yearly</button>
</xo-segmented>`,
  },
  'xo-split-button': {
    guide: 'more-controls.html#choose', keywords: 'button menu dropdown main action more',
    example: `
<xo-split-button more="More publish options">
  <button class="primary">Publish</button>
  <button>Schedule</button>
  <button>Save as draft</button>
</xo-split-button>`,
  },
  'xo-textarea': {
    guide: 'more-controls.html#text', keywords: 'multiline text counter limit characters',
    example: `<xo-textarea name="excerpt" label="Excerpt" maxlength="160" rows="3"></xo-textarea>`,
  },
  'xo-stat': {
    guide: 'more-controls.html#structure', keywords: 'kpi metric number sparkline delta trend tile',
    types: { delta: 'number', series: 'list', value: 'text' },
    example: `<xo-stat label="Visits" value="48,210" delta="12.4" delta-label="vs last week" series="20,22,18,26,24,32,29"></xo-stat>`,
  },
  'xo-otp': {
    guide: 'more-controls.html#feedback', events: ['complete'], keywords: 'code pin verification digits sms',
    defaults: { length: '6' },
    example: `<xo-otp name="code" length="6" label="Verification code"></xo-otp>`,
  },
  'xo-avatar': {
    guide: 'more-controls.html#feedback', keywords: 'profile picture initials user badge photo',
    types: { size: 'choice', status: 'choice' },
    example: `<xo-avatar name="Linh Phạm" status="ok"></xo-avatar>`,
  },
  'xo-avatars': {
    guide: 'more-controls.html#feedback', keywords: 'stack group users team people',
    example: `
<xo-avatars max="2" label="Reviewers">
  <xo-avatar name="An Lê"></xo-avatar>
  <xo-avatar name="Binh Vo"></xo-avatar>
  <xo-avatar name="Chi Do"></xo-avatar>
</xo-avatars>`,
  },
  'xo-progress': {
    guide: 'more-controls.html#feedback', keywords: 'bar loading percent upload indeterminate',
    types: { value: 'number' }, defaults: { max: '100' },
    example: `<xo-progress value="62" label="Upload"></xo-progress>`,
  },
  'xo-spinner': {
    guide: 'more-controls.html#feedback', keywords: 'loading busy wait indicator',
    types: { size: 'choice' },
    example: `<xo-spinner label="Loading" size="lg"></xo-spinner>`,
  },
  'xo-steps': {
    guide: 'more-controls.html#feedback', keywords: 'wizard stepper progress flow checkout',
    example: `
<xo-steps current="1" label="Checkout">
  <span>Account</span><span>Plan</span><span>Payment</span>
</xo-steps>`,
  },
  'xo-inline-edit': {
    guide: 'more-controls.html#feedback', events: ['save', 'cancel'], keywords: 'rename edit in place title text',
    example: `<xo-inline-edit name="title" value="Greece Golden Visa" label="Title"></xo-inline-edit>`,
  },
  'xo-drawer': {
    guide: 'more-controls.html#overlays', keywords: 'side sheet panel slide filter offcanvas modal',
    types: { heading: 'text', label: 'text', side: 'choice', size: 'choice', dismiss: 'flag' }, defaults: { side: 'end', size: 'md' },
    example: `
<button xo-open="#filters">Filters</button>
<xo-drawer id="filters" heading="Filters" side="end" dismiss>
  <p>Choose what to show.</p>
  <button slot="footer" type="button" xo-close>Close</button>
</xo-drawer>`,
  },
  'xo-breadcrumb': {
    guide: 'more-controls.html#overlays', keywords: 'trail path navigation hierarchy location',
    types: { label: 'text', items: 'JSON', max: 'number' },
    example: `
<xo-breadcrumb max="3" items='[{"label":"Home","href":"/"},{"label":"Docs","href":"/docs"},{"label":"Controls","href":"/docs/controls"},{"label":"Tree"}]'></xo-breadcrumb>`,
  },
  'xo-alert': {
    guide: 'more-controls.html#messages', events: ['xo-dismiss'], keywords: 'banner notice message warning error success info callout',
    types: { kind: 'choice', heading: 'text', live: 'choice' }, defaults: { kind: 'info' },
    example: `<xo-alert kind="warning" heading="Your trial ends in 3 days" dismissible>Add a payment method to keep your pages.</xo-alert>`,
  },
  'xo-skeleton': {
    guide: 'more-controls.html#messages', keywords: 'loading placeholder shimmer shape',
    types: { lines: 'number', shape: 'choice', width: 'text', height: 'text', label: 'text' },
    example: `<xo-skeleton lines="3"></xo-skeleton>`,
  },
  'xo-tree': {
    guide: 'more-controls.html#overlays', events: ['xo-tree-select', 'xo-tree-toggle', 'xo-tree-load'], keywords: 'hierarchy folders outline nested expand collapse checkbox',
    types: { data: 'JSON', label: 'text', selectable: 'flag', multiple: 'flag', expanded: 'list', selected: 'list' },
    example: `
<xo-tree label="Files" selectable>
  <ul><li>src<ul><li>index.js</li><li>util.js</li></ul></li><li>README.md</li></ul>
</xo-tree>`,
  },
  'xo-color': {
    guide: 'more-controls.html#pick', keywords: 'colour picker hex swatch palette brand',
    types: { label: 'text', alpha: 'flag', swatches: 'list' },
    example: `<xo-color name="brand" label="Brand color" value="#0b7285" swatches="#0b7285,#c92a2a,#2b8a3e"></xo-color>`,
  },
  'xo-rating': {
    guide: 'more-controls.html#pick', keywords: 'stars review score rate',
    types: { label: 'text', max: 'number', half: 'flag', clearable: 'flag' }, defaults: { max: '5' },
    example: `<xo-rating name="score" label="Your rating" value="4" half clearable></xo-rating>`,
  },
};

// ---- directives -------------------------------------------------------------------------------------------------------------------
// category: the label on the entry; package: where it is implemented; applies: where it is allowed; value: what it takes.
export const DIRECTIVES = {
  'xo-each': {
    category: 'Read data', package: '@xoong/data', guide: 'data.html', keywords: 'loop repeat list foreach iterate rows items',
    applies: 'Any element inside `<xo-view>`. On a `<template>` it repeats the template\'s children.', value: 'The path of a list: `items`, `tags`, `blocks`.',
    example: `
<xo-view get="listPeople">
  <ul><li xo-each="items">{$n}. {name}</li></ul>
</xo-view>`,
    notes: ['Inside it `{path}` reads the current item, `$index` is its position from 0 and `$n` from 1.', 'Rows are keyed by entity id, so a changed list updates the rows that changed.'],
  },
  'xo-if': {
    category: 'Read data', package: '@xoong/data', guide: 'data-states.html', keywords: 'condition show hide when conditional loading empty error',
    applies: 'Any element inside `<xo-view>`.', value: 'A path (`$loading`, `items`), `!path` to negate, or a comparison with a text: `type=image`, `status!=draft`.',
    example: `
<xo-view get="listPeople">
  <p xo-if="$loading">Loading…</p>
  <p xo-if="!items">Nobody here yet.</p>
</xo-view>`,
  },
  'xo-param': {
    category: 'Read data', package: '@xoong/data', guide: 'data.html', keywords: 'filter search sort page query parameter refetch toggle',
    applies: 'An `<input>` or `<select>` (its value), or any element that is clicked (`name=value`), inside `<xo-view>`.',
    value: 'On a field: the parameter name. On click: `name=value`, `name+=n`, `name-=n` (never below 0) or `name~=value` (toggle `value` and `-value`, for sorting).',
    example: `
<xo-view get="listPeople" url-params="name,role">
  <input type="search" xo-param="name" aria-label="Search by name">
  <button xo-param="role=admin">Admins</button>
  <button xo-param="role=editor">Editors</button>
  <ul><li xo-each="items">{name}</li></ul>
</xo-view>`,
    notes: ['A button whose `xo-param` matches the current value gets `aria-current`.'],
  },
  'xo-refresh': {
    category: 'Read data', package: '@xoong/data', guide: 'data-states.html', keywords: 'reload retry try again refetch update',
    applies: 'A button inside `<xo-view>`.', value: 'None.',
    example: `
<xo-view get="listPeople">
  <p xo-if="$error">Could not load. <button xo-refresh>Try again</button></p>
</xo-view>`,
  },
  'xo-click': {
    category: 'Actions', package: '@xoong/data', guide: 'data.html', keywords: 'button call operation mutation delete post put request action',
    applies: 'A `<button>` or link inside `<xo-view>`. Another element works, but it is not reachable by keyboard.', value: 'An operationId (`deletePerson`) or `METHOD /path/{param}`. `{param}` comes from the current item, then the view\'s `p-*` parameters.',
    example: `
<xo-view get="listPeople">
  <ul>
    <li xo-each="items">{name}
      <button xo-click="deletePerson" xo-confirm="Delete {name}?" xo-notice="Deleted">Delete</button>
    </li>
  </ul>
</xo-view>`,
    notes: ['An operation that reads (GET) belongs on `<xo-view get>`, not on `xo-click`.', 'After success the queries that overlap the path are refetched.'],
  },
  'xo-submit': {
    category: 'Actions', package: '@xoong/data', guide: 'forms.html', keywords: 'form send create save post body validate',
    applies: 'A `<form>` inside `<xo-view>`.', value: 'An operationId or `METHOD /path/{param}`.',
    example: `
<xo-view>
  <form xo-submit="createPerson" xo-notice="Person added">
    <label>Name <input name="name" required></label>
    <label>E-mail <input name="email" type="email"></label>
    <button>Add</button>
  </form>
</xo-view>`,
    notes: ['The field names are paths (`name`, `title.en`, `items[0].x`). The form is reset after success unless `xo-keep` is present.'],
  },
  'xo-body': {
    category: 'Actions', package: '@xoong/data', keywords: 'request body payload item send whole',
    applies: 'An element with `xo-click`.', value: 'The path of the object to send: `.` (the current item), `draft`, `$selected`.',
    example: `
<xo-view get="listPeople">
  <ul><li xo-each="items">{name}
    <button xo-click="updatePerson" xo-body=".">Save</button>
  </li></ul>
</xo-view>`,
  },
  'xo-keep': {
    category: 'Actions', package: '@xoong/data', keywords: 'preserve reset clear fields after submit',
    applies: 'A `<form>` that has `xo-submit`.', value: 'None.',
    example: `
<xo-view>
  <form xo-submit="createPerson" xo-keep>
    <input name="name" aria-label="Name">
    <button>Add</button>
  </form>
</xo-view>`,
  },
  'xo-with': {
    category: 'Actions', package: '@xoong/data', guide: 'data.html', keywords: 'fixed fields body extra values constant',
    applies: 'An element with `xo-click` or `xo-submit`, or `xo-add` in a form.', value: 'A list `field=value,other={path}`. Values are typed from the request schema.',
    example: `
<xo-view get="listPeople">
  <ul><li xo-each="items">{name}
    <button xo-click="updatePerson" xo-with="role=admin">Make admin</button>
  </li></ul>
</xo-view>`,
  },
  'xo-optimistic': {
    category: 'Actions', package: '@xoong/data', guide: 'data.html', keywords: 'instant immediately undo rollback fast ui',
    applies: 'An element with `xo-click`, inside `xo-each`.', value: 'A list `field=value,field2={path}`.',
    example: `
<xo-view get="listPeople">
  <ul><li xo-each="items">{name} ({role})
    <button xo-click="updatePerson" xo-with="role=viewer" xo-optimistic="role=viewer">Make viewer</button>
  </li></ul>
</xo-view>`,
  },
  'xo-select': {
    category: 'Actions', package: '@xoong/data', guide: 'data.html', keywords: 'checkbox tick row bulk select all',
    applies: 'A checkbox in a row (inside `xo-each`), or in the header.', value: 'None on a row; `all:items` (`all:` and the list path) on the header checkbox ticks every row.',
    example: `
<xo-view get="listPeople">
  <label><input type="checkbox" xo-select="all:items"> All</label>
  <ul><li xo-each="items"><label><input type="checkbox" xo-select> {name}</label></li></ul>
  <button xo-click="deletePerson" xo-selected xo-if="$selectedCount">Delete {$selectedCount}</button>
</xo-view>`,
    notes: ['`<xo-table selectable>` adds these checkboxes for you.'],
  },
  'xo-selected': {
    category: 'Actions', package: '@xoong/data', guide: 'data.html', keywords: 'bulk batch ticked rows selected many',
    applies: 'An element with `xo-click`.', value: 'None: run the operation once per ticked row. With a field name (`ids`): one request whose body has the ticked ids in that field.',
    example: `
<xo-view get="listPeople">
  <ul><li xo-each="items"><label><input type="checkbox" xo-select> {name}</label></li></ul>
  <button xo-click="deletePerson" xo-selected>Delete ticked</button>
</xo-view>`,
  },
  'xo-confirm': {
    category: 'Actions', package: '@xoong/data', guide: 'dialogs.html', keywords: 'ask question dialog modal sure delete danger yes no confirm',
    applies: 'An element with `xo-click` or `xo-submit`.', value: 'The question; `{path}` names the item: `Delete {name}?`.',
    example: `
<xo-view get="listPeople">
  <ul><li xo-each="items">{name}
    <button xo-click="deletePerson" xo-confirm="Delete {name}?" xo-confirm-title="Delete person" xo-confirm-ok="Delete" xo-confirm-kind="danger">Delete</button>
  </li></ul>
</xo-view>`,
    notes: ['The dialog is native. With @xoong/ui imported it is the built-in confirm dialog; `xo-confirm-title`, `xo-confirm-ok`, `xo-confirm-cancel` and `xo-confirm-kind` tune it.', 'In JavaScript the same question is `confirm()`.'],
  },
  'xo-confirm-title': {
    category: 'Actions', package: '@xoong/ui', guide: 'dialogs.html', keywords: 'heading dialog confirm title',
    applies: 'An element that has `xo-confirm`.', value: 'The heading text.',
    example: `<button xo-click="deletePerson" xo-confirm="This cannot be undone." xo-confirm-title="Delete person">Delete</button>`,
  },
  'xo-confirm-ok': {
    category: 'Actions', package: '@xoong/ui', guide: 'dialogs.html', keywords: 'button label confirm ok text',
    applies: 'An element that has `xo-confirm`.', value: 'The text of the confirming button.',
    example: `<button xo-click="deletePerson" xo-confirm="Delete {name}?" xo-confirm-ok="Delete">Delete</button>`,
  },
  'xo-confirm-cancel': {
    category: 'Actions', package: '@xoong/ui', keywords: 'button label confirm cancel text',
    applies: 'An element that has `xo-confirm`.', value: 'The text of the cancelling button.',
    example: `<button xo-click="deletePerson" xo-confirm="Delete {name}?" xo-confirm-cancel="Keep it">Delete</button>`,
  },
  'xo-confirm-kind': {
    category: 'Actions', package: '@xoong/ui', guide: 'dialogs.html', keywords: 'icon colour danger warning info success severity',
    applies: 'An element that has `xo-confirm`.', value: 'One of `danger`, `warning`, `info`, `success`.',
    example: `<button xo-click="updatePerson" xo-confirm="Publish now?" xo-confirm-kind="info">Publish</button>`,
  },
  'xo-notice': {
    category: 'Actions', package: '@xoong/data', guide: 'dialogs.html', keywords: 'toast message success saved feedback snackbar',
    applies: 'An element with `xo-click` or `xo-submit`.', value: 'The message; `{path}` and `{$selectedCount}` work.',
    example: `<button xo-click="deletePerson" xo-notice="Deleted {name}">Delete</button>`,
    notes: ['The message is shown by `<xo-toast>`. It travels as the `xo-notice` event.'],
  },
  'xo-then': {
    category: 'Actions', package: '@xoong/data', keywords: 'redirect navigate go after success next page',
    applies: 'An element with `xo-click` or `xo-submit`.', value: 'A path of this site. `{id}` comes from the result (a created record), then from the item acted on.',
    example: `
<xo-view>
  <form xo-submit="createPerson" xo-then="/people/{id}">
    <input name="name" aria-label="Name">
    <button>Create</button>
  </form>
</xo-view>`,
    notes: ['`<xo-router>` navigates. Without a router the page is loaded with `location.assign`. Only a relative path or a same-origin URL is followed.'],
  },
  'xo-add': {
    category: 'Form rows', package: '@xoong/forms', guide: 'forms.html#written-by-hand', keywords: 'array list row append item add union',
    applies: 'A button inside a `<form xo-submit>`.', value: 'The path of the array: `keywords`, `blocks`. Add `xo-with="type=image"` to give a union item its tag.',
    example: `
<xo-view get="getPerson" p-id="1">
  <form xo-submit="updatePerson">
    <div xo-each="keywords"><input name="keywords[{$index}]" aria-label="Keyword"></div>
    <button type="button" xo-add="keywords">Add keyword</button>
  </form>
</xo-view>`,
  },
  'xo-remove': {
    category: 'Form rows', package: '@xoong/forms', guide: 'forms.html#written-by-hand', keywords: 'array list row delete item',
    applies: 'A button inside a row of an array in a form.', value: 'The path of the item: `keywords[{$index}]`.',
    example: `
<xo-view get="getPerson" p-id="1">
  <form xo-submit="updatePerson">
    <div xo-each="keywords"><input name="keywords[{$index}]" aria-label="Keyword">
      <button type="button" xo-remove="keywords[{$index}]" aria-label="Remove">✕</button></div>
  </form>
</xo-view>`,
  },
  'xo-move': {
    category: 'Form rows', package: '@xoong/forms', guide: 'forms.html#written-by-hand', keywords: 'array list row reorder up down order',
    applies: 'A button inside a row of an array in a form.', value: 'The path of the item and a direction: `keywords[{$index}]:up` or `:down`.',
    example: `
<xo-view get="getPerson" p-id="1">
  <form xo-submit="updatePerson">
    <div xo-each="keywords"><input name="keywords[{$index}]" aria-label="Keyword">
      <button type="button" xo-move="keywords[{$index}]:up" aria-label="Move up">↑</button>
      <button type="button" xo-move="keywords[{$index}]:down" aria-label="Move down">↓</button></div>
  </form>
</xo-view>`,
  },
  'xo-drag': {
    category: 'Form rows', package: '@xoong/forms', guide: 'forms.html#written-by-hand', keywords: 'array list row reorder drag drop handle',
    applies: 'A handle inside a row of an array in a form.', value: 'The path of the item: `keywords[{$index}]`.',
    example: `
<xo-view get="getPerson" p-id="1">
  <form xo-submit="updatePerson">
    <div xo-each="keywords"><span class="handle" xo-drag="keywords[{$index}]" title="Drag to reorder">⠿</span>
      <input name="keywords[{$index}]" aria-label="Keyword"></div>
  </form>
</xo-view>`,
  },
  'xo-guard': {
    category: 'Form rows', package: '@xoong/ui', keywords: 'unsaved changes leave page dirty warn navigation',
    applies: 'A `<form xo-submit>`.', value: '`off` disables the question; any other text is the question to ask.',
    example: `
<xo-view get="getPerson" p-id="1">
  <form xo-submit="updatePerson" xo-guard="Leave without saving?">
    <input name="name" aria-label="Name"> <button>Save</button>
  </form>
</xo-view>`,
  },
  'xo-route': {
    category: 'Routing', package: '@xoong/ui', guide: 'arch-routing.html', keywords: 'path url page screen router template',
    applies: 'A `<template>` inside `<xo-router>`.', value: 'The path the route answers: `/users/:id`; `*` is the not-found route.',
    example: `
<xo-router>
  <template xo-route="/users/:id" title="User"><xo-view get="getPerson" p-id=":id"><h1>{name}</h1></xo-view></template>
  <template xo-route="*">Not found</template>
</xo-router>`,
  },
  'xo-layout': {
    category: 'Routing', package: '@xoong/ui', guide: 'arch-routing.html', keywords: 'shell frame navigation sidebar wrapper',
    applies: 'A `<template>` inside `<xo-router>`.', value: 'The name of the layout. Routes use it with `layout="name"`.',
    example: `
<xo-router>
  <template xo-layout="shell"><nav><a href="/users">Users</a></nav><main xo-outlet></main></template>
  <template xo-route="/users" layout="shell">Users</template>
</xo-router>`,
  },
  'xo-outlet': {
    category: 'Routing', package: '@xoong/ui', guide: 'arch-routing.html', keywords: 'slot content area route placeholder',
    applies: 'One element in a layout.', value: 'None.',
    example: `
<xo-router>
  <template xo-layout="shell"><header>My app</header><main xo-outlet></main></template>
  <template xo-route="/" layout="shell">Home</template>
</xo-router>`,
  },
  'xo-open': {
    category: 'Dialogs', package: '@xoong/ui', guide: 'dialogs.html', keywords: 'show modal dialog button trigger open window',
    applies: 'A button anywhere in the page.', value: 'A selector for an `<xo-dialog>`: `#add`.',
    example: `
<button xo-open="#add">Add person</button>
<xo-dialog id="add" heading="Add person"><xo-form op="createPerson"></xo-form></xo-dialog>`,
  },
  'xo-close': {
    category: 'Dialogs', package: '@xoong/ui', guide: 'dialogs.html', keywords: 'dismiss cancel hide modal dialog button',
    applies: 'A button inside an `<xo-dialog>`.', value: 'None.',
    example: `
<xo-dialog id="info" heading="Info">
  <p>Saved.</p>
  <button slot="footer" xo-close>Close</button>
</xo-dialog>`,
  },
  'xo-t': {
    category: 'Language', package: '@xoong/i18n', guide: 'recipes.html', keywords: 'translate translation localise language locale catalog',
    applies: 'Any element.', value: 'A message key for the text (`home.title`), or `attr:key; attr2:key2` for attributes.',
    example: `
<h1 xo-t="home.title">Welcome</h1>
<input xo-t="placeholder:search.placeholder" placeholder="Search" aria-label="Search">`,
    notes: ['The text written in the HTML is the default. Inside an `<xo-view>`, `{placeholders}` come from the view.'],
  },
  'xo-tab': {
    category: 'Controls', package: '@xoong/controls', guide: 'tabs.html', keywords: 'tab label panel section',
    applies: 'A `<section>` inside `<xo-tabs>`.', value: 'The tab label. The section\'s `id` is the key of the tab (its position without one).',
    example: `<xo-tabs label="Page"><section xo-tab="General">…</section><section xo-tab="SEO" id="seo">…</section></xo-tabs>`,
  },
  'xo-menu-trigger': {
    category: 'Controls', package: '@xoong/controls', guide: 'menu.html', keywords: 'button open dropdown actions',
    applies: 'A button inside `<xo-menu>`.', value: 'None.',
    example: `<xo-menu label="Actions"><button xo-menu-trigger>Actions</button><button>Duplicate</button></xo-menu>`,
  },
  'xo-tooltip': {
    category: 'Controls', package: '@xoong/controls', guide: 'menu.html', keywords: 'hint hover description help title',
    applies: 'Any element.', value: 'The text of the tooltip.',
    example: `<button xo-tooltip="Copy the link" aria-label="Copy link">Copy</button>`,
    notes: ['It describes the element; it is not its accessible name, so a button without text still needs `aria-label`.'],
  },
  'xo-consent-open': {
    category: 'Controls', package: '@xoong/controls', guide: 'more-controls.html#page', keywords: 'cookies settings privacy reopen banner',
    applies: 'Any element (a button).', value: 'None.',
    example: `<button xo-consent-open>Cookie settings</button>`,
  },
};

// ---- events -----------------------------------------------------------------------------------------------------------------------
// detail: what `event.detail` holds; from: who fires it; listen: what listens (optional). `cancelable` events can be stopped with preventDefault().
export const EVENTS = {
  'xo-done': { from: '`<xo-view>` (xo-click, xo-submit, `<xo-form>`)', detail: 'The result of the operation.', summary: 'An action succeeded.', description: 'Fires on the element that ran the action, after the server answered, and bubbles. `<xo-dialog>` closes when a form inside it fires it; `<xo-toast>` hides its error.', keywords: 'success saved finished complete' },
  'xo-error': { from: '`<xo-view>`, `<xo-router>`', detail: 'The `XoongError` (status, code, detail, fields).', summary: 'A load or an action failed.', description: 'Fires on the element that ran the action (or the view that could not load) and bubbles. Cancelable: call `preventDefault()` when your own code handles the failure, and `<xo-toast>` stays quiet. `event.handled` is true when the view shows `$error` itself, or the error is a 401 that `onUnauthorized` deals with: the toast skips those too.', cancelable: true, keywords: 'failure fail problem exception handled prevent toast' },
  'xo-invalid': { from: '`<form xo-submit>`', detail: '`{ errors }`: the messages by field path.', summary: 'A form was not sent because it is invalid.', description: 'Nothing was sent; the form already shows why beside each field.', keywords: 'validation errors fields' },
  'xo-notice': { from: '`xo-notice`, `toast.show()`', detail: '`{ message, kind }`; `toast.show()` adds `action` and `timeout`.', summary: 'A message for the toast.', description: 'Fires after an action with `xo-notice` succeeded, and when you call `toast.show()`. `<xo-toast>` listens on the document.', keywords: 'toast message snackbar' },
  'xo-go': { from: '`xo-then`', detail: '`{ path }`: where to go.', summary: 'An action asked to go to another page.', description: 'Cancelable. `<xo-router>` handles it and cancels the default; without a router the page is loaded with `location.assign`.', cancelable: true, keywords: 'redirect navigate then' },
  'xo-navigate': { from: '`<xo-router>`', detail: '`{ to, from }`: two route locations (`path`, `params`, `query`, `url`, `route`).', summary: 'The router moved to another location.', description: 'Fires after a navigation, also when only the query or the hash changed.', keywords: 'route change page url history' },
  'xo-columns-change': { from: '`<xo-table column-picker>`', detail: '`{ visible, hidden }`: the field names that are shown and those that are hidden.', summary: 'The person showed or hid a column of the table.', description: 'Fires from the Columns picker. With `columns-key` the choice is also remembered in this browser.', keywords: 'columns show hide picker table toggle' },
  'xo-dirty': { from: '`<form xo-submit>`', detail: '`{ dirty }`: true when there are unsaved changes.', summary: 'A form gained or lost unsaved changes.', description: 'The router listens to it to ask before the page is left.', keywords: 'unsaved changes modified' },
  'xo-reveal': { from: '`<form xo-submit>`', detail: '`{ path }`: the invalid field.', summary: 'The form is about to focus an invalid field.', description: 'Cancelable. `<xo-tabs>` listens and selects the tab of the field first, so the field is visible when it gets the focus.', cancelable: true, keywords: 'invalid focus tab field error' },
  'xo-array-change': { from: '`<form xo-submit>`', detail: '`{ path, op, from, to }`: `op` is `add`, `remove` or `move`.', summary: 'A row of an array in a form was added, removed or moved.', description: 'Fires for the add, remove and move buttons, a drag, and code that changes the array.', keywords: 'row list add remove move reorder' },
  'xo-form-ready': { from: '`<form xo-submit>`', detail: '`{ model }`: the form model.', summary: 'The form model exists.', description: 'From here `form.model` is available. A child control that needs the model listens for this event.', keywords: 'model attach' },
  'xo-pick-media': { from: '`<xo-richtext>`', detail: '`{ insert }`: call `insert({ src, alt })` when the person has chosen.', summary: 'The image tool of the editor was used.', description: 'Cancelable. Open your media library in a listener, call `preventDefault()`, and call `detail.insert` now or later. Without `preventDefault()` nothing is inserted.', cancelable: true, keywords: 'image upload media library editor' },
  'xo-richtext-expand': { from: '`<xo-richtext>`', detail: 'None.', summary: 'The editor opened in its large dialog.', description: '', keywords: 'fullscreen expand editor' },
  'xo-richtext-done': { from: '`<xo-richtext>`', detail: 'None.', summary: 'The large editor dialog was closed.', description: 'Fires for Done and for Escape.', keywords: 'collapse close editor' },
  'xo-search': { from: '`<xo-combobox remote>`', detail: '`{ query }`: what the person typed.', summary: 'The person typed in a combobox that does not filter by itself.', description: 'Set `el.options` in the listener.', keywords: 'autocomplete remote filter typeahead' },
  'xo-tab-change': { from: '`<xo-tabs>`', detail: '`{ value }`: the key of the selected tab.', summary: 'Another tab was selected.', description: '', keywords: 'tabs selected' },
  'xo-menu-select': { from: '`<xo-menu>`', detail: '`{ value }`: the `value` of the chosen item.', summary: 'An item of a choice menu was chosen.', description: 'Only for items that have a `value` attribute.', keywords: 'choice radio dropdown' },
  'xo-menu-open': { from: '`<xo-menu>`', detail: 'None.', summary: 'A menu opened.', description: '', keywords: 'dropdown' },
  'xo-menu-close': { from: '`<xo-menu>`', detail: 'None.', summary: 'A menu closed.', description: '', keywords: 'dropdown' },
  'xo-carousel-change': { from: '`<xo-carousel>`', detail: '`{ index, count }`: the first visible slide and the number of slides.', summary: 'The carousel moved to another slide.', description: '', keywords: 'slide slider' },
  'xo-file-reject': { from: '`<xo-file>`', detail: '`{ file, reason }`: `reason` is `type` or `size`.', summary: 'A file was refused.', description: '', keywords: 'upload drop invalid' },
  'xo-command-run': { from: '`<xo-command>`', detail: '`{ value, label }`: `data-value` (or the href), and the text of the command.', summary: 'A command of the palette was run.', description: '', keywords: 'palette search' },
  'xo-consent': { from: '`<xo-consent>`', detail: 'The choices: one boolean per category (`{ analytics: true, marketing: false }`).', summary: 'The visitor made a choice about cookies.', description: '', keywords: 'cookies privacy gdpr' },
  'xo-theme-change': { from: '`<xo-theme-toggle>`', detail: '`{ theme }`: `light` or `dark`.', summary: 'The theme was switched.', description: '', keywords: 'dark mode light colour' },
  'xo-popover-open': { from: '`<xo-popover>`', detail: 'None.', summary: 'A popover opened.', description: '', keywords: 'panel' },
  'xo-popover-close': { from: '`<xo-popover>`', detail: 'None.', summary: 'A popover closed.', description: '', keywords: 'panel' },
  'xo-accordion-change': { from: '`<xo-accordion>`', detail: '`{ index, open }`: which section and whether it is open now.', summary: 'A section of an accordion opened or closed.', description: '', keywords: 'collapse expand details' },
  copied: { from: '`<xo-copy>`', detail: '`{ text }`: what was copied.', summary: 'The text was copied to the clipboard.', description: '', keywords: 'clipboard copy' },
  'copy-failed': { from: '`<xo-copy>`', detail: '`{ text }`: what could not be copied.', summary: 'The browser refused the clipboard.', description: '', keywords: 'clipboard copy' },
  complete: { from: '`<xo-otp>`', detail: '`{ value }`: the digits.', summary: 'Every box of a one-time code is filled.', description: '', keywords: 'code pin otp digits' },
  save: { from: '`<xo-inline-edit>`', detail: '`{ value }`: the new text.', summary: 'The new text of an inline edit was saved.', description: 'Enter saves.', keywords: 'rename inline edit' },
  'xo-dismiss': { from: '`<xo-alert>`', detail: 'None. `preventDefault()` keeps the alert.', summary: 'The Close button of an alert was pressed.', description: '', keywords: 'close banner' },
  'xo-tree-select': { from: '`<xo-tree>`', detail: '`{ id, selected }`: the item acted on and the chosen ids.', summary: 'The choice in a tree changed.', description: '', keywords: 'checkbox selection' },
  'xo-tree-toggle': { from: '`<xo-tree>`', detail: '`{ id, expanded }`: the item and whether it is open now.', summary: 'A tree item opened or closed.', description: '', keywords: 'expand collapse' },
  'xo-tree-load': { from: '`<xo-tree>`', detail: '`{ id }`: the lazy item; answer with `tree.setChildren(id, children)`.', summary: 'A lazy tree item was opened for the first time.', description: '', keywords: 'lazy children load' },
  cancel: { from: '`<xo-inline-edit>`', detail: 'None.', summary: 'An inline edit was cancelled.', description: 'Escape cancels.', keywords: 'rename inline edit' },
};

// ---- JavaScript API ---------------------------------------------------------------------------------------------------------------
// `from`: [package directory, export name] to find the declaration in packages/<dir>/src/index.d.ts (or `member`: [export, member] for a method of
// an interface or an object). `sig`: the call as you write it. `hand`: a signature for what has no declaration (setFormat is in @xoong/data/view).
// `params`: [name, type, description] rows (an options object lists its keys).
const CLIENT_OPTIONS = [
  ['api', 'object', 'Required. The contents of `.xoong/operations.json` (written by `xoong sync`).'],
  ['baseUrl', 'string', 'Prefix of every request URL, for example `/api`.'],
  ['headers', 'function', 'Returns the headers of a request, or a promise of them: authentication.'],
  ['credentials', 'string', 'The `fetch` credentials mode (`same-origin`, `include`, `omit`).'],
  ['staleTime', 'number', 'Milliseconds a GET result stays fresh. Default 30000.'],
  ['gcTime', 'number', 'Milliseconds an unobserved query is kept. Default 300000.'],
  ['evictEntities', 'boolean', 'Drop the entities that no cached query refers to when a query is collected. Default true.'],
  ['retry', 'number', 'Retries of a GET after a network error or a 502, 503 or 504. Default 2.'],
  ['retryDelay', 'number', 'Base delay in milliseconds, doubled per retry. Default 300.'],
  ['invalidate', 'object', 'Which queries a mutation refreshes, by operation: `{ shipOrder: [\'getDashboard\'] }`.'],
  ['onError', 'function', 'Called with every `XoongError`.'],
  ['onUnauthorized', 'function', 'Called with a 401 error (`onError` is called too).'],
  ['streamUrl', 'string', 'The server-sent events endpoint that `<xo-view live>` listens to.'],
  ['fetch', 'function', 'Your own `fetch`, for tests or a custom transport.'],
];
const DIALOG_LOOK = [
  ['title', 'string', 'A heading above the message.'],
  ['kind', 'string', '`info`, `success`, `warning` or `danger`: an icon and the matching colour.'],
  ['detail', 'string', 'A second, quieter line.'],
];

export const API = [
  // @xoong/data
  { id: 'configure', name: 'configure', package: '@xoong/data', from: ['data', 'configure'], sig: 'configure(options)', returns: 'Client', guide: 'install.html',
    summary: 'Create the app-wide client once, at start-up.', description: 'Every `<xo-view>`, `xo-click` and `xo-submit` uses this client. Call it before the views start; views that started earlier wait for it.',
    params: CLIENT_OPTIONS, keywords: 'setup start init client api baseUrl headers auth retry cache',
    example: `
import { configure } from '@xoong/data';
import '@xoong/data/view';
import operations from '/.xoong/operations.json' with { type: 'json' };

configure({ api: operations, baseUrl: '/api', streamUrl: '/api/events' });` },
  { id: 'get-client', name: 'getClient', package: '@xoong/data', from: ['data', 'getClient'], sig: 'getClient()', returns: 'Client', guide: 'install.html',
    summary: 'The client that `configure()` created.', description: 'Use it when HTML is not enough: `getClient().load(...)`, `.mutate(...)`, `.reset()`.',
    keywords: 'client instance fetch',
    example: `
import { getClient } from '@xoong/data';

const people = await getClient().load('listPeople', { limit: 5 });` },
  { id: 'create-client', name: 'createClient', package: '@xoong/data', from: ['data', 'createClient'], sig: 'createClient(options)', returns: 'Client',
    summary: 'Build a client without making it the app-wide one.', description: 'Takes the same options as `configure()`. Useful in tests and for a second API.', params: CLIENT_OPTIONS, keywords: 'client instance test second api typed',
    example: `
import { createClient } from '@xoong/data';

const client = createClient({ api: operations, baseUrl: '/api' });` },
  { id: 'client-load', name: 'client.load', package: '@xoong/data', member: ['Client', 'load'], sig: 'client.load(operation, params?)', returns: 'Promise<response>', guide: 'data.html',
    summary: 'Read a GET operation and resolve with the response.', description: 'Uses the cache while the result is fresh (`staleTime`). Throws a `XoongError` when the request fails.',
    params: [['operation', 'string', 'An operationId or `GET /path`.'], ['params', 'object', 'Path and query parameters.']], keywords: 'fetch get read request data',
    example: `const page = await getClient().load('listPeople', { limit: 10, sort: 'name' });` },
  { id: 'client-query', name: 'client.query', package: '@xoong/data', member: ['Client', 'query'], sig: 'client.query(operation, params?)', returns: '{ data, status, error, retain(), release(), invalidate(), fetch() }',
    summary: 'A GET operation as signals.', description: '`data`, `status` (`idle`, `loading`, `success`, `error`) and `error` are signals: read them inside an `effect` or a template. `retain()` and `release()` keep the query alive while you observe it.',
    params: [['operation', 'string', 'An operationId or `GET /path`.'], ['params', 'object', 'Path and query parameters.']], keywords: 'signals reactive observe status loading error',
    example: `
const query = getClient().query('listPeople', { limit: 5 });
query.retain();
effect(() => console.log(query.status.value, query.data.value));` },
  { id: 'client-mutate', name: 'client.mutate', package: '@xoong/data', member: ['Client', 'mutate'], sig: 'client.mutate(operation, params, body?)', returns: 'Promise<response>', guide: 'data.html',
    summary: 'Run a write operation (POST, PUT, PATCH, DELETE).', description: 'Resolves with the response. The queries whose path overlaps the mutation are refetched afterwards (see `invalidate` in `configure`).',
    params: [['operation', 'string', 'An operationId or `METHOD /path`.'], ['params', 'object', 'Path parameters.'], ['body', 'object', 'The request body.']], keywords: 'post put patch delete create update write save',
    example: `await getClient().mutate('createPerson', {}, { name: 'Ada Lovelace', email: 'ada@example.org' });` },
  { id: 'client-seed', name: 'client.seed', package: '@xoong/data', member: ['Client', 'seed'], sig: 'client.seed(operation, params, data)', returns: 'the data',
    summary: 'Put data the server already has into the cache.', description: 'As if the GET had run: no request is made until the result is stale. For data embedded in the page.',
    params: [['operation', 'string', 'An operationId.'], ['params', 'object', 'The parameters the GET would have had.'], ['data', 'object', 'The response.']], keywords: 'cache preload hydrate prerender initial data',
    example: `getClient().seed('listPeople', { limit: 5 }, { items: [], total: 0 });` },
  { id: 'client-stream', name: 'client.stream', package: '@xoong/data', member: ['Client', 'stream'], sig: 'client.stream(operation, params, body?, { signal }?)', returns: 'AsyncGenerator<SseEvent>',
    summary: 'Call an operation that answers with server-sent events.', description: 'Each event is `{ event, data, json, id }`; `json` is `data` parsed when it is JSON. Pass an `AbortSignal` to stop.',
    params: [['operation', 'string', 'An operationId.'], ['params', 'object', 'Path parameters.'], ['body', 'object', 'The request body.']], keywords: 'sse server sent events chat streaming tokens',
    example: `
for await (const event of getClient().stream('sendMessage', {}, { text: 'Hello' })) {
  console.log(event.json ?? event.data);
}` },
  { id: 'client-invalidate-all', name: 'client.invalidateAll', package: '@xoong/data', member: ['Client', 'invalidateAll'], sig: 'client.invalidateAll()', returns: 'void',
    summary: 'Mark every cached query stale.', description: 'Views on screen fetch again.', keywords: 'refresh reload stale cache',
    example: `getClient().invalidateAll();` },
  { id: 'client-reset', name: 'client.reset', package: '@xoong/data', member: ['Client', 'reset'], sig: 'client.reset()', returns: 'void',
    summary: 'Forget everything that was loaded.', description: 'For a logout or another user: requests in flight are cancelled, cached queries and entities are dropped, and what a mounted view shows is fetched again. Mutations already sent are not cancelled.', keywords: 'logout sign out clear cache user switch',
    example: `
configure({ api: operations, onUnauthorized: () => { getClient().reset(); router.navigate('/login'); } });` },
  { id: 'derived', name: 'derived', package: '@xoong/data', from: ['data', 'derived'], sig: 'derived(({ all, get }) => value, client?)', returns: 'Signal',
    summary: 'A value computed from the entities that are loaded.', description: '`all(\'Order\')` lists every loaded entity of a type, `get(name, id)` returns one. It recomputes when they change and never makes a request: fetching is declared on a view.', keywords: 'computed total sum count entities store signal',
    example: `
import { derived } from '@xoong/data';

const openOrders = derived(({ all }) => all('Order').filter((o) => o.status === 'open').length);` },
  { id: 'connect-stream', name: 'connectStream', package: '@xoong/data', from: ['data', 'connectStream'], sig: 'connectStream({ client, url, EventSource?, onStatus?, onError? })', returns: '{ close() }',
    summary: 'Apply a stream of entity events to a client.', description: 'The events are `patch`, `upsert`, `delete` and `resync`. `configure({ streamUrl })` does this for you when a view has `live`.', keywords: 'sse live realtime push updates events',
    example: `
import { connectStream, getClient } from '@xoong/data';

const stream = connectStream({ client: getClient(), url: '/api/events' });` },
  { id: 'xoong-error', name: 'XoongError', package: '@xoong/data', from: ['data', 'XoongError'], sig: 'class XoongError extends Error', kind: 'class',
    summary: 'The error of a failed request.', description: 'Built from problem+json or `{ error: { code, message } }`. Fields: `status`, `title`, `detail`, `code`, `retryAfterS`, `operation`, and `fields`, the messages by field (`{ email: \'is not valid\' }`).', keywords: 'error exception failure problem json 401 validation',
    example: `
document.addEventListener('xo-error', (event) => console.warn(event.detail.status, event.detail.detail));` },
  { id: 'set-format', name: 'setFormat', package: '@xoong/data', hand: 'export function setFormat(name: string, fn: (value: any, locale?: string) => string): void', sig: 'setFormat(name, fn)', returns: 'void', import: '@xoong/data/view', guide: 'recipes.html',
    summary: 'Add or replace a display format.', description: 'Then `{price | currency}` works in any view. The function receives the value and the active language. A format that throws shows the plain value.', params: [['name', 'string', 'The name used after `|`.'], ['fn', 'function', '`(value, locale) => string`.']], keywords: 'format currency money date number custom pipe filter',
    example: `
import { setFormat } from '@xoong/data/view';

setFormat('currency', (value, locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value));` },
  // @xoong/ui
  { id: 'confirm', name: 'confirm', package: '@xoong/ui', from: ['ui', 'confirm'], sig: 'confirm(message, options?)', returns: 'Promise<boolean>', guide: 'dialogs.html',
    summary: 'Ask a yes or no question.', description: 'The built-in dialog, a native modal. Without a `kind` the confirming button is red, as for something that cannot be undone. Escape answers false.',
    params: [...DIALOG_LOOK, ['ok', 'string', 'The text of the confirming button.'], ['cancel', 'string', 'The text of the cancelling button.']], keywords: 'dialog modal question yes no sure delete ask',
    example: `
import { confirm } from '@xoong/ui';

if (await confirm('Delete 3 items?', { kind: 'danger', ok: 'Delete' })) remove();` },
  { id: 'alert', name: 'alert', package: '@xoong/ui', from: ['ui', 'alert'], sig: 'alert(message, options?)', returns: 'Promise<void>', guide: 'dialogs.html',
    summary: 'Tell the person something they must see.', description: 'One button; resolves when the dialog is closed. `kind` defaults to `info`.',
    params: [...DIALOG_LOOK, ['ok', 'string', 'The text of the button.']], keywords: 'dialog modal message info success warning error notify',
    example: `await alert('Saved', { kind: 'success' });` },
  { id: 'prompt', name: 'prompt', package: '@xoong/ui', from: ['ui', 'prompt'], sig: 'prompt(message, options?)', returns: 'Promise<string | null>', guide: 'dialogs.html',
    summary: 'Ask for one line of text.', description: 'Resolves with the text, or null when cancelled. The field is native, so `required`, `pattern` and `type` are checked by the browser.',
    params: [...DIALOG_LOOK, ['value', 'string', 'The starting text.'], ['label', 'string', 'The accessible name of the field.'], ['placeholder', 'string', 'Hint text of the empty field.'], ['type', 'string', 'The input type.'], ['required', 'boolean', 'The field must be filled.'], ['pattern', 'string', 'A pattern the text must match.'], ['ok', 'string', 'The text of the confirming button.'], ['cancel', 'string', 'The text of the cancelling button.']], keywords: 'dialog modal input text name rename ask',
    example: `const name = await prompt('Name this view', { value: 'My view', required: true });` },
  { id: 'ask', name: 'ask', package: '@xoong/ui', from: ['ui', 'ask'], sig: 'ask(message, { buttons, ...look })', returns: 'Promise<unknown>', guide: 'dialogs.html',
    summary: 'Offer any set of choices.', description: 'Resolves with the `value` of the button pressed; Escape answers with the `value` of the one marked `cancel`, or null when none is.',
    params: [['buttons', 'array', 'Required. Each button is `{ label, value?, primary?, danger?, cancel? }`.'], ...DIALOG_LOOK], keywords: 'dialog modal choices save discard keep editing buttons',
    example: `
const answer = await ask('Save changes?', {
  buttons: [{ label: 'Discard', value: 'no' }, { label: 'Save', value: 'yes', primary: true }],
});` },
  { id: 'confirm-labels', name: 'confirmLabels', package: '@xoong/ui', from: ['ui', 'confirmLabels'], sig: 'confirmLabels.ok, confirmLabels.cancel', kind: 'object', guide: 'dialogs.html',
    summary: 'The default button texts of `confirm()`.', description: 'Replace them for another wording or another language: `confirmLabels.ok = \'Delete\'`.', keywords: 'translate wording text labels buttons',
    example: `
import { confirmLabels } from '@xoong/ui';

confirmLabels.ok = 'Yes, delete';` },
  { id: 'set-confirm', name: 'setConfirm', package: '@xoong/ui', from: ['ui', 'setConfirm'], sig: 'setConfirm(fn)', returns: 'void', guide: 'dialogs.html',
    summary: 'Replace the confirmation dialog.', description: 'For `xo-confirm` and the question asked when a form with unsaved changes is left. `fn(message, context)` returns true (or a promise of it) to go on.', keywords: 'custom dialog override confirm own',
    example: `
import { setConfirm } from '@xoong/ui';

setConfirm((message) => myDialog.ask(message));` },
  { id: 'toast-show', name: 'toast.show', package: '@xoong/ui', member: ['toast', 'show'], sig: 'toast.show({ message, kind?, action?, timeout? })', returns: 'void', guide: 'dialogs.html',
    summary: 'Show a notice in `<xo-toast>`.', description: 'A message that asks nothing and may offer one action, for example Undo. It is the same notice `xo-notice` shows.',
    params: [['message', 'string', 'The text.'], ['kind', 'string', '`success` or `info` (the default).'], ['action', 'object', '`{ label, run }`: a button, for example Undo.'], ['timeout', 'number', 'Seconds before it hides: 6 unless `<xo-toast timeout>` says otherwise; 0 keeps it until it is dismissed.']], keywords: 'notification snackbar message undo feedback',
    example: `
import { toast } from '@xoong/ui';

toast.show({ message: 'Published 3', action: { label: 'Undo', run: undo } });` },
  { id: 'router-navigate', name: 'router.navigate', package: '@xoong/ui', member: ['router', 'navigate'], sig: 'router.navigate(path, { replace? }?)', returns: 'Promise<boolean>', guide: 'arch-routing.html',
    summary: 'Go to a path of the app.', description: 'The path is relative to the router\'s `base`. Resolves with true when the navigation happened (a guard or a veto may stop it).', params: [['path', 'string', 'For example `/users/3`.'], ['replace', 'boolean', 'Replace the history entry instead of adding one.']], keywords: 'redirect go link route url',
    example: `
import { router } from '@xoong/ui';

await router.navigate('/users/3');` },
  { id: 'router-guard', name: 'router.guard', package: '@xoong/ui', member: ['router', 'guard'], sig: 'router.guard((to, from) => result)', returns: 'function', guide: 'arch-routing.html',
    summary: 'Run a check before every navigation.', description: 'Return true (or nothing) to continue, false to cancel, or a path to redirect there. Returns a function that removes the guard.', keywords: 'auth login protect redirect permission',
    example: `
const stop = router.guard((to) => (loggedIn() || to.path === '/login' ? true : '/login'));` },
  { id: 'router-before-navigate', name: 'router.beforeNavigate', package: '@xoong/ui', member: ['router', 'beforeNavigate'], sig: 'router.beforeNavigate((to, from, type) => boolean)', returns: 'function', guide: 'arch-routing.html',
    summary: 'Veto leaving the current location.', description: 'Runs for links, back and forward, and `navigate()`; `type` is `link`, `api` or `popstate`. Return false to stay. Returns a function that removes it.', keywords: 'unsaved dirty leave warn veto',
    example: `router.beforeNavigate(() => !editor.dirty);` },
  { id: 'router-current', name: 'router.current', package: '@xoong/ui', member: ['router', 'current'], sig: 'router.current', kind: 'property', guide: 'arch-routing.html',
    summary: 'The current location.', description: '`{ path, params, query, url, route }`, or null before the first navigation.', keywords: 'location path params query url',
    example: `console.log(router.current?.params.id);` },
  // @xoong/i18n
  { id: 'configure-i18n', name: 'configureI18n', package: '@xoong/i18n', from: ['i18n', 'configureI18n'], sig: 'configureI18n({ locale?, fallback?, messages?, load? })', returns: 'Promise<void>', guide: 'recipes.html',
    summary: 'Set up languages.', description: 'Resolves when the catalogs of the language are loaded.', params: [['locale', 'string', 'The active language.'], ['fallback', 'string', 'The language to use for a missing message.'], ['messages', 'object', 'Catalogs by language: `{ vi: { key: \'message\' } }`.'], ['load', 'function', '`(code) => catalog`: loads a catalog on demand.']], keywords: 'language translation locale catalog messages',
    example: `
import { configureI18n } from '@xoong/i18n';

configureI18n({ locale: 'en', fallback: 'en', load: (code) => import(\`/i18n/\${code}.json\`) });` },
  { id: 'set-locale', name: 'setLocale', package: '@xoong/i18n', from: ['i18n', 'setLocale'], sig: 'setLocale(code)', returns: 'Promise<void>', guide: 'recipes.html',
    summary: 'Change the language.', description: 'Loads its catalog first, so the page switches once, then updates `<html lang dir>`. The last call wins.', keywords: 'language switch translate locale rtl',
    example: `await setLocale('vi');` },
  { id: 't', name: 't', package: '@xoong/i18n', from: ['i18n', 't'], sig: 't(key, args?, fallbackText?)', returns: 'string', guide: 'recipes.html',
    summary: 'Translate a message.', description: 'The message in the active language; `fallbackText` is shown when the key is unknown, otherwise the key.', params: [['key', 'string', 'The message key.'], ['args', 'object', 'Values for `{placeholders}` and plural forms.'], ['fallbackText', 'string', 'Shown when no language has the key.']], keywords: 'translate message plural language',
    example: `t('articles.count', { count: 3 });` },
  { id: 'locale', name: 'locale', package: '@xoong/i18n', from: ['i18n', 'locale'], sig: 'locale.value', kind: 'signal',
    summary: 'The active language, a signal.', description: 'Read it inside an `effect` or a template; set it with `setLocale`.', keywords: 'language current signal',
    example: `effect(() => console.log('language:', locale.value));` },
  { id: 'add-messages', name: 'addMessages', package: '@xoong/i18n', from: ['i18n', 'addMessages'], sig: 'addMessages(code, messages)', returns: 'void',
    summary: 'Add messages for a language.', description: 'Merged over what is there.', keywords: 'catalog translation messages',
    example: `addMessages('vi', { 'home.title': 'Chào mừng' });` },
  { id: 'on-locale-change', name: 'onLocaleChange', package: '@xoong/i18n', from: ['i18n', 'onLocaleChange'], sig: 'onLocaleChange(fn)', returns: 'function',
    summary: 'Run a function after each language change.', description: 'Not for the current language. Returns a function that stops it.', keywords: 'language listener',
    example: `const stop = onLocaleChange((code) => console.log('now', code));` },
  { id: 'detect-locale', name: 'detectLocale', package: '@xoong/i18n', from: ['i18n', 'detectLocale'], sig: 'detectLocale(supported, { default?, query?, storageKey? }?)', returns: 'string',
    summary: 'Pick a supported language.', description: 'The one in `?lang=`, a saved choice, then the browser\'s preferences, then `default` (the first supported one).', keywords: 'language browser preference',
    example: `const code = detectLocale(['en', 'vi']);` },
  // @xoong/core
  { id: 'signal', name: 'signal', package: '@xoong/core', from: ['core', 'signal'], sig: 'signal(value)', returns: 'Signal',
    summary: 'A reactive value.', description: '`.value` reads (tracked inside an effect, a computed or a template function) and writes; `.peek()` reads without tracking.', keywords: 'reactive state store observable',
    example: `
import { signal } from '@xoong/core';

const count = signal(0);
count.value++;` },
  { id: 'computed', name: 'computed', package: '@xoong/core', from: ['core', 'computed'], sig: 'computed(fn)', returns: 'ReadonlySignal',
    summary: 'A value derived from other signals.', description: 'It recomputes lazily, when something it read has changed.', keywords: 'derived reactive formula',
    example: `const double = computed(() => count.value * 2);` },
  { id: 'effect', name: 'effect', package: '@xoong/core', from: ['core', 'effect'], sig: 'effect(fn)', returns: 'function',
    summary: 'Run a function now and whenever a signal it read changes.', description: '`fn` may return a cleanup function. For side effects only: never fetch data in an effect, declare the operation on a view. Returns a function that stops it.', keywords: 'reactive side effect subscribe',
    example: `const stop = effect(() => { document.title = \`\${count.value} items\`; });` },
  { id: 'batch', name: 'batch', package: '@xoong/core', from: ['core', 'batch'], sig: 'batch(fn)', returns: 'what fn returns',
    summary: 'Group writes.', description: 'The effects run once, after the outermost batch ends.', keywords: 'reactive transaction group',
    example: `batch(() => { first.value = 'Ada'; last.value = 'Lovelace'; });` },
  { id: 'untracked', name: 'untracked', package: '@xoong/core', from: ['core', 'untracked'], sig: 'untracked(fn)', returns: 'what fn returns',
    summary: 'Read signals without subscribing to them.', description: 'Inside `fn` a read is not tracked by the running effect or computed.', keywords: 'reactive peek',
    example: `effect(() => { const n = untracked(() => count.value); });` },
  { id: 'html', name: 'html', package: '@xoong/core', from: ['core', 'html'], sig: 'html`...`', returns: 'TemplateResult',
    summary: 'A template with reactive bindings.', description: 'A function in a child or attribute position is reactive. `name=${v}` sets an attribute, `?name=${v}` a boolean attribute, `.name=${v}` a property, `@event=${fn}` a listener and `style:--x=${v}` a CSS custom property.', keywords: 'template render lit bindings',
    example: `html\`<button class=\${() => cls.value} @click=\${save}>\${() => label.value}</button>\`` },
  { id: 'render', name: 'render', package: '@xoong/core', from: ['core', 'render'], sig: 'render(result, container)', returns: 'function',
    summary: 'Render a template into an element.', description: 'Replaces the children of `container`. Returns the dispose function.', keywords: 'template mount dom',
    example: `const dispose = render(html\`<p>\${() => count.value}</p>\`, document.body);` },
  { id: 'xo-element', name: 'XoElement', package: '@xoong/core', from: ['core', 'XoElement'], sig: 'class XoElement extends HTMLElement', kind: 'class', guide: 'own-control.html',
    summary: 'The base of a custom element in the Light DOM.', description: '`static props` declares attributes that are also properties and signals. Implement `render()` when the element owns its content, or `connected()` to enhance markup that is already there.', keywords: 'custom element component web component base class props',
    example: `
class UserCard extends XoElement {
  static props = { name: String, age: Number };
  render() { return html\`<h3>\${() => this.name}</h3>\`; }
}
define('user-card', UserCard);` },
  { id: 'define', name: 'define', package: '@xoong/core', from: ['core', 'define'], sig: 'define(tag, class)', returns: 'void', guide: 'own-control.html',
    summary: 'Register a custom element.', description: 'A tag that is already defined is left alone. The tag must contain a hyphen.', keywords: 'custom element register customElements',
    example: `define('user-card', UserCard);` },
  { id: 'xo-control', name: 'XoControl', package: '@xoong/core', from: ['core', 'XoControl'], sig: 'class XoControl extends XoElement', kind: 'class', guide: 'own-control.html',
    summary: 'The base of a form control.', description: 'Gives the element `name`, `required`, `disabled` and `readonly`, a `value`, validation and a place in the form model. Every field control of @xoong/controls extends it.', keywords: 'form field input custom element validation',
    example: `class RatingInput extends XoControl { static props = { ...XoControl.props, max: Number }; }` },
  // @xoong/forms
  { id: 'create-form', name: 'createForm', package: '@xoong/forms', from: ['forms', 'createForm'], sig: 'createForm({ schema?, value?, rules?, serialize? })', returns: 'FormModel', guide: 'forms.html',
    summary: 'The draft of one form, without a DOM.', description: 'Holds the value, the errors and the dirty state by path. `<form xo-submit>` creates one for you; use this in tests and for a form that is not in a view.', params: [['schema', 'object', 'A request schema node.'], ['value', 'object', 'The starting record.'], ['rules', 'object', 'Rules by field path; `*` gets the whole record.'], ['serialize', 'function', '`(draft, body) => body`: change what is sent.']], keywords: 'form model validation draft state',
    example: `
import { createForm } from '@xoong/forms';

const form = createForm({ rules: { slug: (v) => (/^[a-z-]+$/.test(v) ? '' : 'Lower case letters only') } });
form.set('slug', 'My Page');` },
  { id: 'attach-form', name: 'attach', package: '@xoong/forms', from: ['forms', 'attach'], sig: 'attach(form, { schema, record?, hadRecord? })', returns: '{ model, submit, detach, rescan }', guide: 'forms.html',
    summary: 'Attach a form model to a `<form>`.', description: 'The binder that `<form xo-submit>` uses, for a form you handle yourself.', keywords: 'form binder dom model',
    example: `const { model } = attach(document.querySelector('form'), { schema });` },
  { id: 'set-messages', name: 'setMessages', package: '@xoong/forms', from: ['forms', 'setMessages'], sig: 'setMessages({ code: (params) => message })', returns: 'void', guide: 'forms.html',
    summary: 'Replace the texts of the built-in validation messages.', description: 'For another language or your own wording. Each message receives its parameters, for example `{ min: 3 }`. The codes are {codes}. `resetMessages()` brings the English ones back.',
    keywords: 'validation errors messages translate wording required language',
    example: `
import { setMessages } from '@xoong/forms';

setMessages({ required: () => 'Bắt buộc', minLength: ({ min }) => \`Ít nhất \${min} ký tự\` });` },
  // @xoong/richtext
  { id: 'sanitize-html', name: 'sanitizeHtml', package: '@xoong/richtext', from: ['richtext', 'sanitizeHtml'], sig: 'sanitizeHtml(html, { images? }?)', returns: 'string', guide: 'richtext.html',
    summary: 'Reduce HTML to the editor\'s safe subset.', description: 'Keeps p, h2, h3, strong, em, u, ul, ol, li, blockquote, br, a (safe links only) and img (safe sources only). `images: false` removes `<img>`. It needs a DOM.', keywords: 'security xss clean html sanitize editor',
    example: `
import { sanitizeHtml } from '@xoong/richtext';

const clean = sanitizeHtml(untrusted, { images: false });` },
];

// ---- template syntax --------------------------------------------------------------------------------------------------------------
// What the runtime (packages/data/src/view.js, format.js) reads between braces. test/reference.test.mjs checks the variables against view.js.
export const TEMPLATE = [
  { id: 'path', name: '{path}', summary: 'Text or attribute interpolation.', guide: 'data.html', keywords: 'interpolate binding mustache braces value field expression',
    description: 'A path reads a field of the current item (`.` is the item itself, `a.b` is nested, `a[0].b` indexes) and then the view\'s `p-*` parameters. The text is escaped. A `javascript:` URL becomes `about:blank`, and `on*` attributes and `srcdoc` are not interpolated. `{{name}}` and `\\{name}` stay as written, and braces around anything that is not a path (JSON, CSS) are left alone.',
    example: `
<xo-view get="getPerson" p-id="1">
  <h2>{name}</h2>
  <a href="mailto:{email}">{email}</a>
</xo-view>` },
  { id: 'format', name: '{path | format}', summary: 'Show a value in a display format.', guide: 'data.html', keywords: 'format date time number relative json localized currency pipe filter',
    description: 'The formats are `date`, `datetime`, `time`, `relative`, `number`, `json` and `localized`. They use `Intl` and the page language. A value that cannot be formatted is shown as it is. Add your own with `setFormat()`. An unknown name is reported once on the console and the plain value is shown.',
    table: [['date', 'A calendar date in the page language: `Nov 25, 2026`.'], ['datetime', 'Date and time.'], ['time', 'Time of day.'], ['relative', '"3 days ago", "tomorrow".'], ['number', 'A number with the language\'s separators.'], ['json', 'The value as JSON text.'], ['localized', 'A value that is an object by language (`{ en, vi }`): the active language, then its base language, then English, then any filled one.']],
    example: `
<xo-view get="listPeople">
  <p xo-each="items">{name}: {createdAt | relative}, {total | number}</p>
</xo-view>` },
  { id: 'loading', name: '$loading, $refreshing', summary: 'Whether the view is fetching.', guide: 'data-states.html', keywords: 'state skeleton spinner busy wait',
    description: '`$loading` is true while a request runs and there is nothing to show yet. `$refreshing` is true while a request runs and the previous result is still on screen (a sort or a page loads), so the view does not collapse. The view also carries `data-refreshing` for CSS.',
    example: `
<xo-view get="listPeople">
  <p xo-if="$loading">Loading…</p>
  <p xo-if="$refreshing">Updating…</p>
</xo-view>` },
  { id: 'error', name: '$error', summary: 'The error of the failed load.', guide: 'data-states.html', keywords: 'failure problem message detail code status',
    description: 'A `XoongError` with `status`, `code` and `detail`, or nothing when the load worked.',
    example: `
<xo-view get="listPeople">
  <p xo-if="$error">{$error.code}: {$error.detail}</p>
</xo-view>` },
  { id: 'index', name: '$index, $n', summary: 'The position of the row in `xo-each`.', guide: 'data.html', keywords: 'number counter row position loop',
    description: '`$index` counts from 0 and `$n` from 1. In nested `xo-each` loops `$i0` (the outer one), `$i1`, ... name the position at each depth.',
    example: `<li xo-each="items">{$n}. {name}</li>` },
  { id: 'paging', name: '$hasPrev, $hasNext, $from, $to', summary: 'Paging state of a list.', guide: 'data.html', keywords: 'pagination page offset limit total next previous',
    description: 'For lists that take `limit` and `offset` and answer with `total`. `$from` and `$to` are the numbers of the first and the last row shown (the "1–12 of 48" text).',
    example: `
<xo-view get="listPeople" p-limit="10">
  <button xo-param="offset-=10" xo-if="$hasPrev">Previous</button>
  <span>{$from}–{$to}</span>
  <button xo-param="offset+=10" xo-if="$hasNext">Next</button>
</xo-view>` },
  { id: 'selection', name: '$selectedCount, $selected', summary: 'The ticked rows.', guide: 'data.html', keywords: 'checkbox bulk rows selection count',
    description: '`$selectedCount` is the number of ticked rows (`xo-select`), `$selected` the rows themselves, for `xo-body="$selected"`.',
    example: `<button xo-click="deletePerson" xo-selected xo-if="$selectedCount">Delete {$selectedCount}</button>` },
  { id: 'stream', name: '$stream, $streaming', summary: 'The events of a streamed call.', keywords: 'sse events chat tokens live',
    description: '`$stream` holds the events of the latest streamed call (an operation that answers with server-sent events) and `$streaming` whether it still runs.',
    example: `<p xo-if="$streaming">Receiving…</p>` },
  { id: 'form', name: '$form', summary: 'The state of the form around you.', guide: 'forms.html', keywords: 'dirty valid submitting errors touched filled unsaved',
    description: 'Inside a `<form xo-submit>`: `$form.dirty`, `$form.valid`, `$form.submitting`, `$form.stale`, and by field path `$form.errors[\'title.vi\']`, `$form.touched[...]`, `$form.filled[...]`.',
    example: `
<xo-view get="getPerson" p-id="1">
  <form xo-submit="updatePerson">
    <input name="name" aria-label="Name">
    <span xo-if="$form.dirty">Unsaved changes</span>
    <button>Save</button>
  </form>
</xo-view>` },
  { id: 'params', name: 'p-<name>', summary: 'A parameter of the view\'s operation.', guide: 'data.html', keywords: 'parameter path id route url query',
    description: 'On `<xo-view>`: `p-id="42"` is the path parameter `id`. `p-id="?id"` reads `?id=` from the page URL and `p-id=":id"` reads a route parameter. Inside the view `{id}` reads it.',
    example: `<xo-view get="getPerson" p-id="?id"><h1>{name}</h1></xo-view>` },
  { id: 'boolean-attributes', name: 'hidden="{flag}"', summary: 'A boolean attribute that follows the data.', guide: 'data.html', keywords: 'disabled checked selected readonly required attribute toggle',
    description: 'When `{flag}` is the whole value of `hidden`, `disabled`, `checked`, `selected`, `readonly`, `required`, `open`, `multiple`, `inert`, `autofocus`, `controls`, `loop`, `muted` or `reversed`, the attribute is present while the value is true (an empty list is false).',
    example: `<button disabled="{$loading}" xo-refresh>Refresh</button>` },
];
