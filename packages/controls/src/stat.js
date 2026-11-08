// @ts-check
/**
 * <xo-stat> is a KPI tile: a label, a big value, a change against before, and a sparkline from a series.
 *
 *   <xo-stat label="Visits" value="48,210" delta="12.4" delta-label="vs last week" series="20,22,18,26,24,32,29"></xo-stat>
 *
 * - `delta` is a number: positive shows an up arrow, negative a down arrow (the sign and the arrow carry the meaning, not only the colour);
 *   `trend="down-is-good"` swaps which direction counts as good (costs, errors). `delta-label` is the text after it.
 * - `series` (comma-separated numbers, or `el.seriesData = [...]`) draws the sparkline; it is decoration (`aria-hidden`), the numbers are in the text.
 * - Draws `.xo-kpi > .xo-kpi__label + .xo-kpi__value + .xo-kpi__delta + svg.xo-kpi__spark`.
 */
import { XoElement, define, text } from '@xoong/core';

const NS = 'http://www.w3.org/2000/svg';

class XoStat extends XoElement {
  static props = { label: String, value: String, delta: Number, deltaLabel: String, series: String, trend: String };

  #list = /** @type {number[] | null} */ (null);
  #built = false;
  get seriesData() { return this.#list ?? (this.series ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n)); }
  set seriesData(v) { this.#list = Array.isArray(v) ? v.map(Number) : null; if (this.#built) this.#draw(); }

  connected() { this.#built = true; this.#draw(); }
  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); if (this.#built) this.#draw(); }

  #draw() {
    this.classList.add('xo-kpi');
    const parts = [];
    const span = (/** @type {string} */ cls, /** @type {string} */ t) => { const s = document.createElement('span'); s.className = cls; s.textContent = t; return s; };
    parts.push(span('xo-kpi__label', this.label ?? ''), span('xo-kpi__value', this.value ?? ''));
    if (this.hasAttribute('delta') && !Number.isNaN(this.delta)) {
      const d = this.delta;
      const el = span('xo-kpi__delta', '');
      const good = this.trend === 'down-is-good' ? d <= 0 : d >= 0;
      el.dataset.good = String(good);
      el.dataset.direction = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
      const icon = document.createElement('span');
      icon.className = 'ic'; icon.dataset.ic = d >= 0 ? 'arrow-up' : 'arrow-down'; icon.setAttribute('aria-hidden', 'true');
      const sign = d > 0 ? '+' : d < 0 ? '−' : '';
      el.append(icon, `${sign}${Math.abs(d)}%${this.deltaLabel ? ` ${this.deltaLabel}` : ''}`);
      el.setAttribute('aria-label', (good ? text('xoong.stat.better', '{change} better', { change: `${sign}${Math.abs(d)}%` }) : text('xoong.stat.worse', '{change} worse', { change: `${sign}${Math.abs(d)}%` })) + (this.deltaLabel ? ` ${this.deltaLabel}` : ''));
      parts.push(el);
    }
    const data = this.seriesData;
    if (data.length > 1) {
      const lo = Math.min(...data), hi = Math.max(...data), r = hi - lo || 1;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'xo-kpi__spark'); svg.setAttribute('viewBox', '0 0 100 32'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', data.map((v, i) => `${i ? 'L' : 'M'}${((i / (data.length - 1)) * 100).toFixed(1)} ${(30 - ((v - lo) / r) * 28).toFixed(1)}`).join(' '));
      svg.append(path);
      parts.push(svg);
    }
    this.replaceChildren(...parts);
  }
}
define('xo-stat', XoStat);
