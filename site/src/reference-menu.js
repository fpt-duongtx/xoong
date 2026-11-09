// The Reference menu of the header: a button that pops up the groups of the reference on the left (Elements, Directives, Events, JavaScript API, Template
// syntax) and the entries of the highlighted group on the right. Hover, focus or a click highlights a group; ArrowRight goes into its entries, ArrowLeft back;
// Enter follows a link to reference.html#entry; Escape closes it and gives the focus back. Below 52rem it is a full-width list where a group opens
// under its name. A disclosure with links (aria-expanded), not an ARIA menu. The entries come from search-index.json, which is loaded when it first opens.
const base = new URL('../', import.meta.url);
const wide = matchMedia('(min-width: 52rem)');

/** @type {HTMLButtonElement} */ let trigger;
/** @type {HTMLElement | null} */ let panel = null;
/** @type {HTMLButtonElement[]} */ let buttons = [];
/** @type {HTMLElement[]} */ let lists = [];
let current = -1;
let shown = false;
let pendingFocus = false; // ArrowDown on the button before the entries were loaded
let stop = () => {};

const el = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; };
const icon = (name) => { const s = el('span', 'ic'); s.dataset.ic = name; s.setAttribute('aria-hidden', 'true'); return s; };

/** The header's Reference link becomes a button (the link is the fallback without JavaScript). */
function upgrade(link) {
  trigger = el('button', link.className);
  trigger.type = 'button';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'ref-menu');
  trigger.dataset.refMenu = '';
  trigger.append(...link.childNodes);
  trigger.addEventListener('click', () => (shown ? close(false) : open()));
  trigger.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); if (!shown) open(); if (buttons.length) focusButton(wide.matches ? Math.max(0, current) : 0); else pendingFocus = true; } });
  link.replaceWith(trigger);
}

function build() {
  panel = el('nav', 'ref-pop');
  panel.id = 'ref-menu';
  panel.setAttribute('aria-label', 'Reference menu');
  panel.hidden = true;
  if ('showPopover' in panel) panel.setAttribute('popover', 'manual'); // the top layer: a scrolling header or a dialog never clips it
  panel.append(el('p', 'ref-pop-note', 'Loading…'));
  panel.addEventListener('keydown', onKey);
  panel.addEventListener('click', (e) => { if (/** @type {Element} */ (e.target).closest('a')) close(false); }); // a link to this very page does not reload it
  panel.addEventListener('focusout', (e) => { const to = /** @type {FocusEvent} */ (e).relatedTarget; if (shown && to instanceof Node && !panel?.contains(to) && !trigger.contains(to)) close(false); });
  document.body.append(panel);
  import('../search-index.json', { with: { type: 'json' } }).then((m) => fill(m.default), () => {
    const note = el('p', 'ref-pop-note');
    const a = el('a', '', 'Open the reference');
    a.href = new URL('reference.html', base).href;
    note.append('The menu could not be loaded. ', a);
    panel?.replaceChildren(note);
  });
}

function fill(data) {
  const groups = el('ul', 'ref-groups');
  buttons = []; lists = [];
  data.groups.forEach((g, i) => {
    const li = el('li');
    const b = el('button', 'ref-group');
    b.type = 'button';
    b.id = `ref-gb-${g.id}`;
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', `ref-ge-${g.id}`);
    b.append(el('span', 'ref-group-name', g.label), el('span', 'ref-n', String(g.count)), icon('chevron-right'));
    const box = el('div', 'ref-entries');
    box.id = `ref-ge-${g.id}`;
    box.hidden = true;
    const head = el('p', 'ref-entries-head', g.summary.replace(/`/g, ''));
    const all = el('a', 'ref-all', `See all ${g.count} on one page`);
    all.href = new URL(g.url, base).href;
    all.append(icon('arrow-right'));
    const ul = el('ul');
    for (const item of data.items.filter((x) => x.kind === g.kind)) {
      const a = el('a', '', item.title);
      a.href = new URL(item.url, base).href;
      if (item.text) a.title = item.text;
      const entry = el('li');
      entry.append(a);
      ul.append(entry);
    }
    box.append(head, all, ul);
    li.append(b, box);
    groups.append(li);
    buttons.push(b); lists.push(box);
    b.addEventListener('click', (e) => { if (!wide.matches && current === i) select(-1); else select(i); if (e.detail === 0 && wide.matches) focusEntry(i, 0); }); // Enter and Space (detail 0) go into the entries
    b.addEventListener('focus', () => { if (wide.matches) select(i); });
    let timer = 0;
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && wide.matches) timer = setTimeout(() => select(i), 60); }); // a short pause: a slanted move to the entries does not switch the group
    b.addEventListener('pointerleave', () => clearTimeout(timer));
  });
  panel?.replaceChildren(groups);
  select(wide.matches ? 0 : -1);
  place();
  if (pendingFocus) { pendingFocus = false; focusButton(0); }
}

/** Highlight group `i` (-1: none): its entries are shown, the others hidden. */
function select(i) {
  current = i;
  buttons.forEach((b, n) => { b.setAttribute('aria-expanded', String(n === i)); b.classList.toggle('is-current', n === i); lists[n].hidden = n !== i; });
  place();
}

const focusButton = (/** @type {number} */ i) => { const n = (i + buttons.length) % buttons.length; buttons[n]?.focus(); };
const linksOf = (/** @type {number} */ i) => [.../** @type {NodeListOf<HTMLAnchorElement>} */ (lists[i].querySelectorAll(':scope > ul a'))];
function focusEntry(i, n) { select(i); const links = linksOf(i); links.at(n)?.focus(); }

function onKey(/** @type {KeyboardEvent} */ e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
  const t = /** @type {HTMLElement} */ (e.target);
  const rtl = getComputedStyle(panel ?? document.body).direction === 'rtl';
  const [into, back] = rtl ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
  const g = buttons.indexOf(/** @type {HTMLButtonElement} */ (t));
  if (g >= 0) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); focusButton(g + (e.key === 'ArrowDown' ? 1 : -1)); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); focusButton(e.key === 'Home' ? 0 : buttons.length - 1); }
    else if (e.key === into) { e.preventDefault(); focusEntry(g, 0); }
    return;
  }
  const owner = lists.findIndex((box) => box.contains(t));
  if (owner < 0) return;
  const links = linksOf(owner);
  const at = links.indexOf(/** @type {HTMLAnchorElement} */ (t));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); links.at((at + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length)?.focus(); }
  else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); links.at(e.key === 'Home' ? 0 : -1)?.focus(); }
  else if (e.key === back) { e.preventDefault(); buttons[owner].focus(); }
}

/** Under the button (wide), or under the header across the whole width (narrow). */
function place() {
  if (!panel || !shown) return;
  const r = trigger.getBoundingClientRect();
  const header = document.querySelector('header.top')?.getBoundingClientRect().bottom ?? r.bottom;
  const top = Math.max(0, wide.matches ? r.bottom + 6 : header);
  const style = panel.style;
  if (wide.matches) {
    style.width = '';
    const w = panel.offsetWidth;
    Object.assign(style, { left: `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`, top: `${top}px`, right: 'auto', maxHeight: `${Math.max(240, innerHeight - top - 16)}px` });
  } else Object.assign(style, { left: '0px', right: '0px', top: `${top}px`, width: 'auto', maxHeight: `${Math.max(240, innerHeight - top)}px` });
}

function open() {
  if (!panel) build();
  if (!panel || shown) return;
  shown = true;
  panel.hidden = false;
  if (panel.hasAttribute('popover') && !panel.matches(':popover-open')) panel.showPopover();
  trigger.setAttribute('aria-expanded', 'true');
  if (buttons.length) select(wide.matches ? (current < 0 ? 0 : current) : -1);
  place();
  const onDown = (/** @type {Event} */ e) => { const t = /** @type {Node} */ (e.target); if (!panel?.contains(t) && !trigger.contains(t)) close(false); };
  const onEsc = (/** @type {KeyboardEvent} */ e) => { if (e.key === 'Escape' && !e.defaultPrevented) close(true); };
  const onMedia = () => { if (buttons.length) select(wide.matches ? Math.max(0, current) : -1); else place(); };
  document.addEventListener('pointerdown', onDown);
  document.addEventListener('keydown', onEsc);
  addEventListener('resize', place);
  addEventListener('scroll', place, { passive: true });
  wide.addEventListener('change', onMedia);
  stop = () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onEsc); removeEventListener('resize', place); removeEventListener('scroll', place); wide.removeEventListener('change', onMedia); };
}

function close(refocus) {
  if (!panel || !shown) return;
  shown = false;
  stop();
  if (panel.hasAttribute('popover') && panel.matches(':popover-open')) panel.hidePopover();
  panel.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  if (refocus) trigger.focus();
}

const link = document.querySelector('a[data-ref-menu]');
if (link) upgrade(link);
