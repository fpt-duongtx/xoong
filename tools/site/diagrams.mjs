// The diagrams of the documentation site: hand-placed boxes and arrows as inline SVG (classes dg-*, in site/src/site.css and tools/site/architecture.css).
// Used by the Architecture pages (architecture.mjs) and by How it works (pages.mjs).
//
// A diagram is a figure with a focusable scroll frame, an svg with role="img" (a title and a full text description) and a visible caption.
// `diagram()` wraps a drawing; `d.box()` sizes a box from its text and returns its edges so arrows can start and end on them; `sequence()` draws a
// message sequence.
//
// Motion is opt-in (`anim`). It never carries information the still picture does not: small packets (dots) travel along the arrows in the order the
// story is told, the arrow and the box they reach light up for a moment, and the whole thing loops. Every packet is SMIL, in one synchronised cycle
// (all animations share `dur` and `begin="0s"`, and use keyTimes to be visible only in their own time slot). site/src/diagrams.js adds the
// Pause / Play button, and keeps the figure still for readers who prefer reduced motion. The `motion` sentence says in words what the dots show: it
// goes into the description and, while the dots are shown, into the caption.

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TITLE_LINE = 44, SUB_LINE = 16;
/** Height a box needs for a title and `n` lines of small text. */
const natural = (n) => (n ? 58 + SUB_LINE * (n - 1) : TITLE_LINE);

const REST = 1.5; // seconds of stillness at the end of a cycle, before it starts again
const num = (n) => String(+n.toFixed(3));

/** Windows [from, to] (seconds) as a sorted list in which windows that touch are one. */
function merge(windows) {
  const sorted = windows.map(([a, b]) => [a, b]).sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w[0] <= last[1] + 0.05) last[1] = Math.max(last[1], w[1]); else out.push(w);
  }
  return out;
}

/** The keyTimes / values of an animation that is `peak` inside the windows and 0 outside, with a short fade at each end. Points: [seconds, value]. */
function pulse(windows, dur, peak = 1, fadeIn = 0.15, fadeOut = 0.15) {
  const pts = [[0, 0]];
  const at = (t, v) => { const last = pts[pts.length - 1]; if (t <= last[0]) t = last[0]; if (!(t === last[0] && v === last[1])) pts.push([t, v]); };
  for (const [a, b] of merge(windows.map(([from, to]) => [Math.max(0, from), Math.min(dur, to)]))) {
    const fin = Math.min(fadeIn, (b - a) / 2), fout = Math.min(fadeOut, (b - a) / 2);
    at(a, 0); at(a + fin, peak); at(b - fout, peak); at(b, 0);
  }
  if (pts[pts.length - 1][0] < dur) pts.push([dur, 0]); else pts[pts.length - 1][0] = dur;
  return `values="${pts.map((p) => p[1]).join(';')}" keyTimes="${pts.map((p) => num(p[0] / dur)).join(';')}"`;
}

/** The common timing of every animation of a figure: one cycle, always running, so the figure stays in step. */
const loop = (dur) => `dur="${num(dur)}s" begin="0s" repeatCount="indefinite"`;

/** A packet that travels along `path` during [a, b] of the cycle and is invisible the rest of the time. */
function packet(path, [a, b], dur, ret) {
  const k = [[0, 0]];
  if (a > 0) k.push([a / dur, 0]);
  k.push([b / dur, 1]);
  if (b < dur) k.push([1, 1]);
  return `<circle class="dg-dot${ret ? ' dg-ret' : ''}" r="${ret ? 6 : 6.5}" opacity="0">`
    + `<animateMotion ${loop(dur)} path="${path}" calcMode="linear" keyPoints="${k.map((p) => p[1]).join(';')}" keyTimes="${k.map((p) => num(p[0])).join(';')}"/>`
    + `<animate attributeName="opacity" ${loop(dur)} ${pulse([[a, b]], dur)}/></circle>`;
}

/**
 * @param {{ id: string, label: string, title: string, desc: string, caption: string, w: number, h: number, size?: 'sm' | 'md' | 'lg',
 *   anim?: boolean | { dur?: number }, motion?: string, draw: (d: any) => void }} spec
 *   `anim`: the figure moves. `dur` is the length of one cycle in seconds; without it the cycle is the end of the last packet plus a rest.
 *   `motion`: one sentence, what the moving dots show (required with `anim`).
 */
export function diagram({ id, label, title, desc, caption, w, h, size = 'sm', anim = false, motion = '', draw }) {
  if (anim && !motion) throw new Error(`diagram ${id}: an animated diagram needs a "motion" sentence that says in words what the dots show`);
  const out = [];
  const lines = []; // moving things: { path, windows, ret, dash }
  const nodes = []; // boxes that light up: { x, y, w, h, index, windows }
  const d = {
    id, w, h,
    /** A box at (x, y), `bw` wide; its height follows the text unless `bh` is given (then the text is centred). Returns its edges. */
    box(x, y, bw, name, sub = [], { kind = '', bh } = {}) {
      const rows = Array.isArray(sub) ? sub : [sub];
      const nat = natural(rows.filter(Boolean).length);
      const bhh = bh ?? nat;
      const top = y + (bhh - nat) / 2;
      const cls = `dg-box${kind ? ` dg-k-${kind}` : ''}`;
      const index = out.push(`<g class="dg-node"><rect class="${cls}" x="${x}" y="${y}" width="${bw}" height="${bhh}" rx="8"/>`
        + `<text class="dg-t" x="${x + bw / 2}" y="${top + 22}">${esc(name)}</text>`
        + rows.filter(Boolean).map((l, i) => `<text class="dg-sub" x="${x + bw / 2}" y="${top + 42 + SUB_LINE * i}">${esc(l)}</text>`).join('')
        + '</g>') - 1;
      const box = { x, y, w: bw, h: bhh, r: x + bw, b: y + bhh, cx: x + bw / 2, cy: y + bhh / 2 };
      nodes.push({ ...box, index, windows: [] });
      Object.defineProperty(box, 'node', { value: nodes[nodes.length - 1] });
      return box;
    },
    /**
     * An arrow along `points`; `label` is placed at `at` ([x, y], centred unless `anchor` is 'start' or 'end').
     * Motion (when the figure has `anim`): `go` is the time window [from, to], in seconds of the cycle, in which a packet travels along the arrow
     * (a list of windows for several trips); a dashed arrow, an answer or a signal, carries a hollow packet. `from` and `to` are the boxes it
     * leaves and reaches, which light up around then.
     */
    line(points, { dash = false, life = false, label: text, at, anchor = '', head = !life, go, from, to } = {}) {
      const path = `M${points.map(([x, y]) => `${x} ${y}`).join(' L')}`;
      out.push(`<path class="${life ? 'dg-life' : `dg-line${dash ? ' dg-dash' : ''}`}" d="${path}"${head ? ` marker-end="url(#${id}-a)"` : ''}/>`);
      if (text) out.push(`<text class="dg-lab${anchor ? ` dg-${anchor}` : ''}" x="${at[0]}" y="${at[1]}">${esc(text)}</text>`);
      if (anim && go) {
        const windows = Array.isArray(go[0]) ? go : [go];
        lines.push({ path, windows, ret: dash, dash });
        for (const [a, b] of windows) {
          from?.node?.windows.push([a, a + 0.35]);
          to?.node?.windows.push([b - 0.1, b + 0.5]);
        }
      }
    },
    /** A dashed frame with a label at its top left. */
    zone(x, y, zw, zh, text) {
      out.push(`<rect class="dg-zone" x="${x}" y="${y}" width="${zw}" height="${zh}" rx="12"/><text class="dg-zlab" x="${x + 14}" y="${y + 18}">${esc(text)}</text>`);
    },
    /** A line of small text. */
    text(x, y, text, cls = '') { out.push(`<text class="dg-sub ${cls}" x="${x}" y="${y}">${esc(text)}</text>`); },
    /** A scheduler for the packets: each call returns the next time window, one after the other (`skip(s)` waits). */
    clock({ start = 0.3, travel = 0.7, gap = 0.1 } = {}) {
      let t = start;
      const next = (len = travel) => { const win = [t, t + len]; t += len + gap; return win; };
      next.skip = (s) => { t += s; };
      return next;
    },
  };
  draw(d);

  // The moving layer goes on top of everything: arrows that light up, packets, boxes that light up.
  let fx = '';
  let dur = 0;
  if (anim) {
    const ends = [...lines.flatMap((l) => l.windows.map((win) => win[1]))];
    dur = typeof anim === 'object' && anim.dur ? anim.dur : Math.ceil((Math.max(0, ...ends) + REST) * 2) / 2;
    if (ends.some((e) => e > dur)) throw new Error(`diagram ${id}: a packet is still on its way when the ${dur} s cycle ends`);
    fx = '<g class="dg-fx" aria-hidden="true">'
      + lines.map((l) => `<path class="dg-hot${l.dash ? ' dg-dash' : ''}" d="${l.path}" marker-end="url(#${id}-ah)" opacity="0"><animate attributeName="opacity" ${loop(dur)} ${pulse(l.windows.map(([a, b]) => [a, b + 0.3]), dur, 1, 0.12, 0.3)}/></path>`).join('')
      + nodes.filter((n) => n.windows.length).map((n) => `<rect class="dg-glow" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" opacity="0"><animate attributeName="opacity" ${loop(dur)} ${pulse(n.windows.map(([a, b]) => [Math.max(0, a), Math.min(dur, b)]), dur, 1, 0.12, 0.25)}/></rect>`).join('')
      + lines.flatMap((l) => l.windows.map((win) => packet(l.path, win, dur, l.ret))).join('')
      + '</g>';
  }
  const heads = `<marker id="${id}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-head" d="M0 0 10 5 0 10z"/></marker>`
    + (anim ? `<marker id="${id}-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-head dg-head-hot" d="M0 0 10 5 0 10z"/></marker>` : '');
  const full = anim ? `${desc} When the animation plays, ${motion}` : desc;
  return `<figure class="dg-fig${anim ? ' dg-anim' : ''}">
<div class="dg-scroll" tabindex="0" role="group" aria-label="${esc(label)}">
<svg class="dg dg-${size}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-t ${id}-d">
<title id="${id}-t">${esc(title)}</title>
<desc id="${id}-d">${esc(full)}</desc>
<defs>${heads}</defs>
${out.join('\n')}
${fx}
</svg>
</div>
${anim ? `<div class="dg-cap"><p class="hint">${caption} <span class="dg-motion">In motion, ${esc(motion)}</span></p></div>` : `<p class="hint">${caption}</p>`}
</figure>`;
}

/**
 * A sequence diagram: participants across the top, one arrow per message, top to bottom. A message is { from, to, label (string or lines), dashed? }
 * or a note { note, over: [first, last] }.
 * With `anim`, the messages play one after another: a packet travels along each arrow in its turn (`anim: { travel, gap }` sets the pace).
 */
export function sequence({ id, label, title, desc, caption, parts, msgs, col = 150, size = 'md', anim = false, motion = '' }) {
  const w = parts.length * col;
  const x = (i) => col * i + col / 2;
  let y = 66;
  const rows = msgs.map((m) => {
    if (m.note) { const row = { ...m, y, h: 36 }; y += 52; return row; }
    const lines = Array.isArray(m.label) ? m.label : [m.label];
    const row = { ...m, lines, y: y + 15 * lines.length + 6 };
    y += 15 * lines.length + 30;
    return row;
  });
  const h = y + 10;
  return diagram({
    id, label, title, desc, caption, w, h, size, anim, motion,
    draw(d) {
      const turn = d.clock({ start: 0.4, travel: typeof anim === 'object' ? anim.travel ?? 0.8 : 0.8, gap: typeof anim === 'object' ? anim.gap ?? 0.2 : 0.2 });
      const heads = parts.map((p, i) => d.box(x(i) - (col - 16) / 2, 10, col - 16, p, [], { bh: 38 }));
      parts.forEach((_, i) => d.line([[x(i), heads[i].b], [x(i), h - 6]], { life: true })); // lifelines first, so the arrows are drawn over them
      for (const m of rows) {
        if (m.note) {
          const x1 = x(m.over[0]) - (col - 24) / 2, x2 = x(m.over[1]) + (col - 24) / 2;
          d.box(x1, m.y, x2 - x1, m.note, [], { kind: 'soft', bh: m.h });
          turn.skip(0.5); // the story waits a moment at a note
          continue;
        }
        const a = x(m.from), b = x(m.to);
        d.line([[a, m.y], [b, m.y]], { dash: m.dashed, go: turn(), from: heads[m.from], to: heads[m.to] });
        m.lines.forEach((l, i) => d.text((a + b) / 2, m.y - 12 - 15 * (m.lines.length - 1 - i), l, 'dg-lab'));
      }
    },
  });
}
