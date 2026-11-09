// @ts-check
/**
 * <xo-date> is a date field with a calendar popover; `range` picks a start and an end.
 *
 *   <xo-date name="publishedAt" label="Publish on" min="2026-01-01" max="2026-12-31"></xo-date>
 *   <xo-date name="stay" label="Stay" range></xo-date>
 *
 * - The value is ISO `YYYY-MM-DD` (a range: `{ start, end }`); the field shows the date in the user's locale (`Intl`) and also accepts typing
 *   (the locale order, or ISO). The calendar is the picker: a click on a day chooses it.
 * - Enter or ArrowDown opens. In the calendar: arrows move by day and week, PageUp/PageDown by month, Home/End to the start/end of the week,
 *   Escape closes and returns the focus to the field. Shift+arrow extends a range.
 * - The calendar is a `role=dialog` named "Choose date"; days are buttons (`aria-pressed` when chosen, `aria-current=date` for today), days
 *   outside `min`/`max` are disabled. A range shows its length in a polite live region with Clear and Apply.
 * - `week-start` (1 = Monday ... 7 = Sunday) defaults to the locale's first day of the week. `change` fires when the person chooses.
 */
import { XoControl, define, text } from '@xoong/core';
import { prepareLayer, showLayer, hideLayer } from './layer.js';

let counter = 0;
const pad = (n) => String(n).padStart(2, '0');
const iso = (/** @type {Date} */ d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = (/** @type {string} */ s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? ''); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3], 12); return iso(d) === s ? d : null; };
const add = (/** @type {Date} */ d, /** @type {number} */ days) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12);
const months = (/** @type {Date} */ d, /** @type {number} */ n) => { const t = new Date(d.getFullYear(), d.getMonth() + n, 1, 12); t.setDate(Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate())); return t; };
const empty = { start: '', end: '' };

class XoDate extends XoControl {
  static props = { ...XoControl.props, label: String, min: String, max: String, range: Boolean, placeholder: String, weekStart: Number };

  /** @type {HTMLInputElement | null} */ #input = null;
  /** @type {HTMLButtonElement | null} */ #opener = null;
  /** @type {HTMLElement | null} */ #panel = null;
  #open = false;
  #id = `xo-date-${++counter}`;
  #cursor = new Date();
  /** @type {string} */ #pending = ''; // a range start chosen, waiting for its end
  #draft = { ...empty }; // a range being picked, applied with Apply
  #stop = () => {};
  #onDocument = (/** @type {Event} */ e) => { if (!this.contains(/** @type {Node} */ (e.target))) this.#close(false); };

  setValue(v) { super.setValue(this.#clean(v)); this.#showText(); }
  #clean(v) {
    if (this.range) { const o = v && typeof v === 'object' ? v : {}; return { start: day(o.start) ? o.start : '', end: day(o.end) ? o.end : '' }; }
    return day(v) ? v : '';
  }
  serialize(v) { return this.range ? (v.start ? JSON.stringify(v) : null) : v || null; }
  isEmpty(v) { return this.range ? !v?.start : !v; }
  get focusTarget() { return this.#input; }
  validate(v) {
    const [lo, hi] = [this.min, this.max];
    for (const d of this.range ? [v.start, v.end] : [v]) { if (d && ((lo && d < lo) || (hi && d > hi))) return text('xoong.controls.dateRange', 'Choose a date within the allowed range.'); }
    return '';
  }

  connected() {
    const wrap = document.createElement('div');
    wrap.className = 'xo-input-wrap xo-input-wrap--end';
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', this.label || this.name || text('xoong.controls.date', 'Date'));
    input.placeholder = this.placeholder || (this.range ? text('xoong.controls.dateRangeHint', 'Start - end') : this.#sample());
    const opener = document.createElement('button');
    opener.type = 'button';
    opener.className = 'xo-date-open';
    opener.setAttribute('aria-label', text('xoong.controls.chooseDate', 'Choose date'));
    opener.setAttribute('aria-haspopup', 'dialog'); // on the button: a text input may not carry aria-expanded (axe aria-allowed-attr)
    opener.setAttribute('aria-expanded', 'false');
    opener.innerHTML = '<span class="ic" data-ic="calendar" aria-hidden="true"></span>';
    opener.addEventListener('click', () => (this.#open ? this.#close(true) : this.#openCalendar()));
    wrap.append(input, opener);
    const panel = document.createElement('div');
    panel.className = 'xo-float xo-date-panel';
    panel.id = `${this.#id}-panel`;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', text('xoong.controls.chooseDate', 'Choose date'));
    prepareLayer(panel);
    panel.addEventListener('keydown', (e) => this.#panelKey(e));
    this.replaceChildren(wrap, panel);
    this.#input = input; this.#opener = opener; this.#panel = panel;
    input.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return; // an IME is composing: Enter, Escape and ArrowDown are its keys
      if (e.key === 'ArrowDown' || (e.key === 'Enter' && !this.#open && !input.value.trim())) { e.preventDefault(); this.#openCalendar(); }
      else if (e.key === 'Enter') this.#commitText();
      else if (e.key === 'Escape' && this.#open) { e.stopPropagation(); this.#close(true); }
    });
    input.addEventListener('change', () => this.#commitText());
    queueMicrotask(() => this.#showText()); // the base class applies a `value` attribute after connected()
    this.#sync2();
  }
  disconnected() { document.removeEventListener('pointerdown', this.#onDocument); this.#stop(); }

  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#sync2(); }
  #sync2() { if (this.#input) { this.#input.disabled = this.isDisabled; this.#input.readOnly = this.readonly; if (this.#opener) this.#opener.disabled = this.isDisabled || this.readonly; } }

  // ---- text <-> value ------------------------------------------------------------------------------------------------------

  get #locale() { return this.closest('[lang]')?.getAttribute('lang') || document.documentElement.lang || undefined; }
  #fmt(/** @type {string} */ s) { const d = day(s); return d ? new Intl.DateTimeFormat(this.#locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d) : ''; }
  #sample() { return this.#fmt('2026-11-25') || 'YYYY-MM-DD'; }
  #showText() {
    if (!this.#input) return;
    const v = super.value;
    this.#input.value = this.range ? (v?.start ? `${this.#fmt(v.start)} - ${v.end ? this.#fmt(v.end) : ''}` : '') : this.#fmt(v);
  }
  /** Read a typed date: ISO, or numbers in the locale's day/month/year order. */
  #parse(/** @type {string} */ s) {
    s = s.trim();
    if (day(s)) return s;
    const n = s.match(/\d+/g);
    if (!n || n.length !== 3) return '';
    const order = new Intl.DateTimeFormat(this.#locale).formatToParts(new Date(2026, 10, 25)).filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year').map((p) => p.type);
    const f = Object.fromEntries(order.map((k, i) => [k, +n[i]]));
    if (f.year < 100) f.year += 2000;
    const r = `${f.year}-${pad(f.month)}-${pad(f.day)}`;
    return day(r) ? r : '';
  }
  #commitText() {
    const raw = /** @type {HTMLInputElement} */ (this.#input).value.trim();
    let v;
    if (this.range) { const parts = raw.split(/\s+[-–—]\s+|\s*\/\s*/); const a = raw ? this.#parse(parts[0]) : ''; const b = parts[1] ? this.#parse(parts[1]) : ''; v = a ? (b && b < a ? { start: b, end: a } : { start: a, end: b }) : { ...empty }; }
    else v = raw ? this.#parse(raw) : '';
    if (raw && (this.range ? !v.start : !v)) { this.#showText(); return; } // not a date: keep what was chosen
    this.#choose(v);
  }
  #choose(v) {
    this.setValue(v);
    this.userInput(super.value);
    this.userChange();
  }

  // ---- calendar --------------------------------------------------------------------------------------------------------------

  get #first() { return this.weekStart || (() => { try { return /** @type {any} */ (new Intl.Locale(this.#locale || navigator.language)).weekInfo?.firstDay ?? 1; } catch { return 1; } })(); }

  #openCalendar() {
    if (this.isDisabled || this.readonly || this.#open) return;
    const v = super.value;
    this.#draft = this.range ? { ...v } : { ...empty };
    this.#pending = '';
    this.#cursor = day(this.range ? v.start : v) ?? new Date();
    this.#open = true;
    this.#draw();
    this.#stop = showLayer(/** @type {HTMLElement} */ (this.#panel), /** @type {HTMLElement} */ (this.#input).parentElement ?? this);
    this.#opener?.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', this.#onDocument);
    this.#focusDay();
  }
  #close(refocus) {
    if (!this.#open) return;
    this.#open = false;
    this.#stop();
    hideLayer(/** @type {HTMLElement} */ (this.#panel));
    this.#opener?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', this.#onDocument);
    if (refocus) this.#input?.focus();
  }
  #focusDay() { /** @type {HTMLElement | null} */ (this.#panel?.querySelector(`button[data-date="${iso(this.#cursor)}"]`))?.focus(); }

  #out(/** @type {string} */ d) { return (!!this.min && d < this.min) || (!!this.max && d > this.max); }

  #draw() {
    const panel = /** @type {HTMLElement} */ (this.#panel);
    const loc = this.#locale;
    const y = this.#cursor.getFullYear(), m = this.#cursor.getMonth();
    const head = document.createElement('div');
    head.className = 'xo-date-head';
    const nav = (/** @type {number} */ n, /** @type {string} */ label, /** @type {string} */ glyph) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'icon-only sm ghost'; b.setAttribute('aria-label', label); b.textContent = glyph;
      b.addEventListener('click', () => { this.#cursor = months(this.#cursor, n); this.#draw(); this.#focusDay(); });
      return b;
    };
    const title = document.createElement('b');
    title.setAttribute('aria-live', 'polite');
    title.textContent = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(new Date(y, m, 1, 12));
    head.append(nav(-1, text('xoong.controls.prevMonth', 'Previous month'), '‹'), title, nav(1, text('xoong.controls.nextMonth', 'Next month'), '›'));

    const grid = document.createElement('div');
    grid.className = 'xo-calendar';
    const first = this.#first;
    const start = add(new Date(y, m, 1, 12), -((new Date(y, m, 1).getDay() || 7) - first + 7) % 7);
    for (let i = 0; i < 7; i++) { const s = document.createElement('span'); s.textContent = new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(add(start, i)).slice(0, 2); s.setAttribute('aria-hidden', 'true'); grid.append(s); }
    const today = iso(new Date());
    const v = super.value;
    const [a, b] = this.range ? [this.#draft.start, this.#draft.end] : [v, ''];
    for (let i = 0; i < 42; i++) {
      const d = add(start, i), s = iso(d);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.date = s;
      btn.textContent = String(d.getDate());
      btn.tabIndex = s === iso(this.#cursor) ? 0 : -1;
      btn.setAttribute('aria-label', new Intl.DateTimeFormat(loc, { dateStyle: 'full' }).format(d));
      if (d.getMonth() !== m) btn.classList.add('is-out');
      if (s === today) { btn.classList.add('is-today'); btn.setAttribute('aria-current', 'date'); }
      const sel = s === a || s === b;
      if (sel) btn.classList.add('is-sel');
      if (a && b && s > a && s < b) btn.classList.add('is-range');
      btn.setAttribute('aria-pressed', String(sel));
      if (this.#out(s)) btn.disabled = true;
      btn.addEventListener('click', () => this.#pick(s));
      grid.append(btn);
    }
    panel.replaceChildren(head, grid);
    if (this.range) {
      const foot = document.createElement('div');
      foot.className = 'cal-foot';
      const hint = document.createElement('span');
      hint.className = 'hint'; hint.setAttribute('aria-live', 'polite'); hint.id = `${this.#id}-sum`;
      hint.textContent = this.#summary();
      const row = document.createElement('span');
      row.className = 'row-inline';
      const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'sm'; clear.textContent = text('xoong.controls.clear', 'Clear');
      clear.addEventListener('click', () => { this.#draft = { ...empty }; this.#pending = ''; this.#draw(); this.#focusDay(); });
      const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'sm primary'; apply.textContent = text('xoong.controls.apply', 'Apply');
      apply.addEventListener('click', () => { this.#choose({ ...this.#draft }); this.#close(true); });
      row.append(clear, apply);
      foot.append(hint, row);
      panel.append(foot);
    }
  }
  #summary() {
    const { start, end } = this.#draft;
    if (!start) return text('xoong.controls.pickStart', 'Pick the first day');
    if (!end) return `${this.#fmt(start)} - ${text('xoong.controls.pickEnd', 'pick the last day')}`;
    const n = Math.round((+day(end) - +day(start)) / 864e5) + 1;
    return `${this.#fmt(start)} - ${this.#fmt(end)} · ${text('xoong.controls.days', '{n} days', { n })}`;
  }
  #pick(/** @type {string} */ s) {
    if (this.#out(s)) return;
    this.#cursor = /** @type {Date} */ (day(s));
    if (!this.range) { this.#choose(s); this.#close(true); return; }
    if (!this.#pending) { this.#pending = s; this.#draft = { start: s, end: '' }; }
    else { const a = this.#pending; this.#pending = ''; this.#draft = a <= s ? { start: a, end: s } : { start: s, end: a }; }
    this.#draw();
    this.#focusDay();
  }
  #panelKey(/** @type {KeyboardEvent} */ e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.#close(true); return; }
    const side = getComputedStyle(this).direction === 'rtl' ? -1 : 1; // the arrows follow the screen: in right-to-left the week runs from the right
    const step = { ArrowLeft: -side, ArrowRight: side, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let next = null;
    if (step) next = add(this.#cursor, step);
    else if (e.key === 'PageUp') next = months(this.#cursor, e.shiftKey ? -12 : -1);
    else if (e.key === 'PageDown') next = months(this.#cursor, e.shiftKey ? 12 : 1);
    else if (e.key === 'Home' || e.key === 'End') { const off = (this.#cursor.getDay() || 7) - this.#first; const w = ((off % 7) + 7) % 7; next = add(this.#cursor, e.key === 'Home' ? -w : 6 - w); }
    if (!next || !(e.target instanceof HTMLButtonElement && e.target.dataset.date)) return;
    e.preventDefault();
    this.#cursor = next;
    if (this.range && e.shiftKey && step && this.#pending) { const a = this.#pending, s = iso(next); this.#draft = a <= s ? { start: a, end: s } : { start: s, end: a }; }
    this.#draw();
    this.#focusDay();
  }
}
define('xo-date', XoDate);
