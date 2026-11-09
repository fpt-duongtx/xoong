// @ts-check
/**
 * <xo-chart> draws a small bar or line chart from data, with the same numbers as a table for everyone who prefers or needs it.
 *
 *   <xo-chart type="bar" label="Visits per period" unit="k" data='[{"label":"Mon","value":12},{"label":"Tue","value":18}]'></xo-chart>
 *   el.rows = [{ label: 'Mon', value: 12 }, ...]      // or numbers: [12, 18], labelled 1, 2, ...
 *
 * - `type` is `bar` (default) or `line`. The SVG has role=img and the label; in a bar chart each bar is focusable and named ("Mon: 12k").
 * - "View as table" (a native <details>) lists the same data. `unit` is appended to the values; `heading` and `value-heading` name the columns.
 * - Colours come from the theme (classes `grid`, `axis`, `bar`, `line`, `area`, `dot` inside `.xo-chart`); `rows` can be set again at any time.
 */
import { XoElement, define, text } from '@xoong/core';

const NS = 'http://www.w3.org/2000/svg';
const W = 640, H = 220, L = 36, B = 24, T = 8;
/** A round number at or above `v`, for the top of the axis. */
const nice = (/** @type {number} */ v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };

class XoChart extends XoElement {
  static props = { type: String, label: String, unit: String, heading: String, valueHeading: String, data: String };

  /** @type {{ label: string, value: number }[]} */ #rows = [];
  #built = false;

  get rows() { return this.#rows; }
  set rows(v) { this.#rows = (Array.isArray(v) ? v : []).map((r, i) => (typeof r === 'number' ? { label: String(i + 1), value: r } : { label: String(r.label), value: Number(r.value) })); if (this.#built) this.#draw(); }

  connected() {
    if (!this.#rows.length && this.data) { try { this.rows = JSON.parse(this.data); } catch { console.warn('xoong: <xo-chart data> is not valid JSON: the chart has no data'); } }
    this.#built = true;
    this.#draw();
  }
  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (attr === 'data' && this.#built) { try { this.rows = JSON.parse(value ?? '[]'); } catch { console.warn('xoong: <xo-chart data> is not valid JSON: the chart has no data'); this.rows = []; } } else if (this.#built) this.#draw();
  }

  #draw() {
    const rows = this.#rows;
    const unit = this.unit ?? '';
    const el = (/** @type {string} */ tag, /** @type {Record<string, string | number>} */ attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };
    const svg = /** @type {SVGSVGElement} */ (el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': this.label ?? '' }));
    const top = nice(Math.max(0, ...rows.map((r) => r.value)));
    const y = (/** @type {number} */ v) => T + (H - B - T) * (1 - v / top);
    for (let i = 0; i <= 4; i++) {
      const v = (top / 4) * i;
      svg.append(el('line', { class: 'grid', x1: L, x2: W, y1: y(v), y2: y(v) }));
      const t = el('text', { class: 'axis', x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }); t.textContent = `${+v.toFixed(2)}${unit}`; svg.append(t);
    }
    const step = (W - L) / Math.max(1, rows.length);
    const cx = (/** @type {number} */ i) => L + step * (i + 0.5);
    const every = Math.ceil(rows.length / 12); // at most about twelve labels on the axis
    rows.forEach((r, i) => { if (i % every) return; const t = el('text', { class: 'axis', x: cx(i), y: H - 6, 'text-anchor': 'middle' }); t.textContent = r.label; svg.append(t); });
    if (this.type === 'line' && rows.length) {
      const pts = rows.map((r, i) => `${cx(i)},${y(r.value)}`);
      svg.append(el('polygon', { class: 'area', points: `${cx(0)},${y(0)} ${pts.join(' ')} ${cx(rows.length - 1)},${y(0)}` }), el('polyline', { class: 'line', points: pts.join(' ') }));
      rows.forEach((r, i) => svg.append(el('circle', { class: 'dot', cx: cx(i), cy: y(r.value), r: 3.5 })));
    } else {
      const w = Math.min(48, step * 0.6);
      rows.forEach((r, i) => {
        const bar = el('rect', { class: 'bar', x: cx(i) - w / 2, y: y(r.value), width: w, height: Math.max(0, y(0) - y(r.value)), rx: 3, tabindex: 0, role: 'img', 'aria-label': `${r.label}: ${r.value}${unit}` });
        const title = el('title'); title.textContent = `${r.label}: ${r.value}${unit}`; bar.append(title);
        svg.append(bar);
      });
    }
    const fig = document.createElement('figure');
    fig.className = 'xo-chart';
    fig.append(svg);
    const d = document.createElement('details');
    const s = document.createElement('summary');
    s.className = 'button ghost sm'; s.textContent = text('xoong.chart.table', 'View as table');
    const table = document.createElement('table');
    table.className = 'std';
    const cell = (/** @type {string} */ tag, /** @type {string} */ t) => { const c = document.createElement(tag); c.textContent = t; return c; };
    const head = document.createElement('tr'); head.append(cell('th', this.heading || text('xoong.chart.label', 'Label')), cell('th', this.valueHeading || text('xoong.chart.value', 'Value')));
    const thead = document.createElement('thead'); thead.append(head);
    const tbody = document.createElement('tbody');
    for (const r of rows) { const tr = document.createElement('tr'); tr.append(cell('td', r.label), cell('td', `${r.value}${unit}`)); tbody.append(tr); }
    table.append(thead, tbody);
    d.append(s, table);
    fig.append(d);
    this.replaceChildren(fig);
  }
}
define('xo-chart', XoChart);
