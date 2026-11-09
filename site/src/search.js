// The docs search: Ctrl or Cmd + K, "/" (when no field has the focus) or the Search button of the header opens a dialog that searches the whole site:
// pages, their sections and every entry of the reference. The index (search-index.json, built with the pages) is loaded when the dialog first opens.
// A native modal <dialog> with a combobox and a listbox (the look of <xo-command>: its classes), so Escape, the focus trap and the focus's way back are the browser's.
import { prepare, search } from './search-core.js';

const SUGGESTED = ['install.html', 'overview.html', 'data.html', 'forms.html', 'dialogs.html', 'reference.html'];
const MONO = new Set(['element', 'directive', 'event', 'api', 'syntax']); // reference entries are names: shown in the code font
const base = new URL('../', import.meta.url);
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** @type {HTMLDialogElement | null} */ let dialog = null;
/** @type {HTMLInputElement} */ let input;
/** @type {HTMLElement} */ let list, empty, count, keys;
/** @type {Promise<any> | null} */ let loading = null;
/** @type {ReturnType<typeof prepare> | null} */ let prepared = null;
/** @type {any[]} */ let index = [];
/** @type {any[]} */ let shown = [];
let active = 0;
let timer = 0;
let failed = false;

const el = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; };
const icon = (name) => { const s = el('span', 'ic'); s.dataset.ic = name; s.setAttribute('aria-hidden', 'true'); return s; };
const hrefOf = (item) => new URL(item.url, base).href;

/** The header's Search link becomes a button (the link is the fallback without JavaScript: it leads to the Reference). */
function upgrade(link) {
  const button = el('button', link.className);
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.dataset.search = '';
  for (const name of ['aria-keyshortcuts']) if (link.hasAttribute(name)) button.setAttribute(name, link.getAttribute(name) ?? '');
  button.append(...link.childNodes);
  const kbd = button.querySelector('kbd');
  if (kbd && mac) kbd.textContent = '⌘K';
  button.addEventListener('click', openSearch);
  link.replaceWith(button);
}

function load() {
  loading ??= import('../search-index.json', { with: { type: 'json' } }).then((m) => {
    index = m.default.items;
    prepared = prepare(index);
    if (dialog?.open) render(true);
  }, () => { loading = null; failed = true; if (dialog?.open) render(); });
  return loading;
}

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'xo-command-dialog xo-search';
  dialog.setAttribute('aria-label', 'Search the documentation');
  const panel = el('div', 'xo-float xo-command');
  const head = el('div', 'xo-command__input');
  input = el('input');
  input.type = 'text';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'search-results');
  input.setAttribute('aria-label', 'Search the documentation');
  input.placeholder = 'Search pages, elements, attributes…';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.enterKeyHint = 'go';
  const close = el('button', 'search-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close search');
  close.append(icon('close'));
  head.append(icon('search'), input, close);
  const body = el('div', 'search-body');
  list = el('div', 'xo-listbox');
  list.id = 'search-results';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Results');
  empty = el('div', 'search-empty');
  empty.hidden = true;
  body.append(list, empty);
  const foot = el('div', 'xo-command__foot');
  count = el('span', 'search-count');
  count.setAttribute('role', 'status');
  keys = el('span', 'search-keys', 'Up and down to move, Enter to open, Esc to close');
  foot.append(count, keys);
  panel.append(head, body, foot);
  dialog.append(panel);
  document.body.append(dialog);

  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', onKey);
  close.addEventListener('click', () => dialog?.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog?.close(); }); // the backdrop
  dialog.addEventListener('close', () => { input.value = ''; });
  list.addEventListener('click', (e) => { if (/** @type {Element} */ (e.target).closest('a')) dialog?.close(); }); // an anchor on this very page does not reload it
}

/** The count is announced after a pause, not on every key. */
function status(text, now = false) {
  clearTimeout(timer);
  const set = () => { count.textContent = text; };
  if (now) set(); else timer = setTimeout(set, 300);
}

function render(now = false) {
  const query = input.value.trim();
  let results;
  if (!prepared) { results = []; } else if (query) results = search(prepared, query); else results = SUGGESTED.map((url) => index.find((i) => i.url === url && i.kind === 'page')).filter(Boolean);
  shown = results;
  list.replaceChildren();
  active = Math.min(active, Math.max(0, results.length - 1));
  list.hidden = !results.length;
  empty.hidden = !!results.length;
  input.setAttribute('aria-expanded', String(!!results.length));
  results.forEach((item, i) => {
    const a = el('a', 'xo-option search-option');
    a.href = hrefOf(item);
    a.id = `search-option-${i}`;
    a.tabIndex = -1;
    a.setAttribute('role', 'option');
    a.setAttribute('aria-selected', 'false');
    const main = el('span', 'search-main');
    main.append(el('span', `search-title${MONO.has(item.kind) ? ' mono' : ''}`, item.title));
    const sub = item.page ? `${item.page}${item.text ? ` · ${item.text}` : ''}` : item.text;
    if (sub) main.append(el('span', 'search-sub', sub));
    a.append(main, el('span', 'search-badge', item.group));
    a.addEventListener('pointermove', () => { if (active !== i) { active = i; mark(); } });
    list.append(a);
  });
  if (!results.length) {
    empty.replaceChildren();
    if (!prepared && !failed) empty.append(el('p', 'search-hint', 'Loading the index…'));
    else if (!prepared) {
      empty.append(el('p', 'search-hint', 'The search index could not be loaded.'));
      const more = el('a', '', 'Open the reference');
      more.href = new URL('reference.html', base).href;
      empty.append(more);
    } else {
      empty.append(el('p', 'search-hint', `No results for “${query}”.`), el('p', 'search-sub', 'Try fewer or shorter words, or another spelling: the search ignores case and accents.'));
      const more = el('a', '', 'Browse the reference');
      more.href = new URL('reference.html', base).href;
      more.addEventListener('click', () => dialog?.close());
      empty.append(more);
    }
  }
  mark();
  if (!prepared) status(failed ? 'The search index could not be loaded' : 'Loading…', true);
  else status(query ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Suggested pages', now);
}

function mark() {
  const options = [...list.children];
  options.forEach((o, i) => {
    const on = i === active;
    o.classList.toggle('xo-option--active', on);
    o.setAttribute('aria-selected', String(on));
    if (on) o.scrollIntoView?.({ block: 'nearest' });
  });
  const on = options[active];
  if (on) input.setAttribute('aria-activedescendant', on.id); else input.removeAttribute('aria-activedescendant');
}

function onKey(/** @type {KeyboardEvent} */ e) {
  if (e.isComposing || e.keyCode === 229) return; // an input method is composing: Enter and the arrows are its keys
  const n = shown.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (n) { active = (active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; mark(); } }
  else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) go(shown[active]); }
}

function go(item) {
  dialog?.close();
  location.assign(hrefOf(item));
}

function openSearch() {
  if (!dialog) build();
  if (dialog?.open) return;
  input.value = ''; // always a fresh search (the dialog's close event comes a moment after Escape)
  active = 0;
  render();
  dialog?.showModal();
  input.focus();
  void load();
}

const typing = (/** @type {Element | null} */ target) => !!target && (/** @type {HTMLElement} */ (target).isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return;
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(document.activeElement) && !document.querySelector('dialog[open]')) { e.preventDefault(); openSearch(); }
});
for (const link of document.querySelectorAll('a[data-search]')) upgrade(link);
