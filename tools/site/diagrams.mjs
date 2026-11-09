// The diagrams of the documentation site: hand-placed boxes and arrows as inline SVG (classes dg-*, in site/src/site.css and tools/site/architecture.css).
// Used by the Architecture pages (architecture.mjs) and by How it works (figures.mjs).
//
// A diagram is a figure with a focusable scroll frame, an svg with role="img" (a title and a full text description) and a visible caption.
// `diagram()` wraps a drawing; `d.box()` sizes a box from its text and returns its edges so arrows can start and end on them; `sequence()` draws a
// message sequence.
//
// Motion is opt-in (`anim`). It never carries information the still picture and the text do not: small packets (dots) travel along the arrows in the
// order the story is told, the arrow and the box they reach light up for a moment, a mock of the screen the person sees changes with the steps, and
// the whole thing loops. Everything is SMIL in one synchronised cycle per figure (every animation shares `dur` and `begin="0s"`, and uses keyTimes
// to be visible only in its own time slot), so one clock, `svg.setCurrentTime()`, moves all of it.
//
// A story is a list of steps (`d.step(sentence, window)`). The sentences go into the description and into data-steps, which site/src/diagrams.js
// turns into a slider with one marker per step, a Pause / Play button and a caption "Step 3 of 9: ...". The `motion` sentence says what the dots show.

import { highlight } from './lib.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');

const TITLE_LINE = 44, SUB_LINE = 16;
/** Height a box needs for a title and `n` lines of small text. */
const natural = (n) => (n ? 58 + SUB_LINE * (n - 1) : TITLE_LINE);

const REST = 1.5; // seconds of stillness at the end of a cycle, before it starts again
const RESET = 0.5; // the last half second of a cycle: the screens go back to where they started
const num = (n) => String(+n.toFixed(3));
/** The moment a step is shown when someone picks it: its packet is nearly at the end of the arrow, and what it causes has happened. */
const scrubAt = ([a, b]) => Math.max(a + 0.1, b - 0.12);

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

/**
 * The keyTimes / values of an animation that is `peak` inside the windows and 0 outside, with a short fade at each end. A window that starts at 0 (or ends at
 * `dur`) has no fade there, so the cycle joins up with itself.
 */
function pulse(windows, dur, peak = 1, fadeIn = 0.15, fadeOut = 0.15) {
  const ws = merge(windows.map(([a, b]) => [Math.max(0, a), Math.min(dur, b)]).filter(([a, b]) => b > a));
  const pts = [];
  const at = (t, v) => {
    const last = pts[pts.length - 1];
    if (last && t <= last[0]) t = last[0];
    if (!last || t !== last[0] || v !== last[1]) pts.push([t, v]);
  };
  for (const [a, b] of ws) {
    const fin = Math.min(fadeIn, (b - a) / 2), fout = Math.min(fadeOut, (b - a) / 2);
    if (a <= 0) at(0, peak); else { if (!pts.length) at(0, 0); at(a, 0); at(a + fin, peak); }
    if (b >= dur) at(dur, peak); else { at(b - fout, peak); at(b, 0); }
  }
  if (!pts.length) at(0, 0);
  if (pts[pts.length - 1][0] < dur) at(dur, 0);
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
    + `<animate attributeName="opacity" ${loop(dur)} ${pulse([[a, b]], dur, 1, 0.1, 0.1)}/></circle>`;
}

// ---- the pieces of a screen mock ----------------------------------------------------------------------------------------------------------
// Small drawings of what a person sees: a table, loading rows, a dialog, a toast, a form field. Each returns SVG for `layer()` or `still()`. They are
// decorative: the step sentences say what happens.
/** x of the columns of the table mock (name, email or status, role) in a table `w` wide. */
const cols = (w) => [0, Math.round(w * 0.25), Math.round(w * 0.68)];
export const ui = {
  /** A heading. */
  h: (x, y, text) => `<text class="dg-wh" x="${x}" y="${y}">${esc(text)}</text>`,
  /** A small line of text. */
  t: (x, y, text, cls = '') => `<text class="dg-wt ${cls}" x="${x}" y="${y}">${esc(text)}</text>`,
  /** The head of a table: column names, and a line under them. */
  thead: (x, y, w, heads = ['Name \u25B2', 'Email', 'Role']) => heads.map((t, i) => `<text class="dg-wm dg-wb" x="${x + cols(w)[i] + 6}" y="${y + 11}">${esc(t)}</text>`).join('') + `<path class="dg-wline" d="M${x} ${y + 22} H${x + w}"/>`,
  /** A row of a table: cells under the columns, and a button at the right end when there is one. */
  trow: (x, y, w, cells, { h = 28, button = '', bw = 52, strong = true } = {}) => cells.map((t, i) => `<text class="dg-wt${strong && i === 0 ? '' : ' dg-wn'}" x="${x + cols(w)[i] + 6}" y="${y + h / 2}">${esc(t)}</text>`).join('')
    + (button ? `<rect class="dg-wbtn" x="${x + w - bw - 2}" y="${y + (h - 20) / 2}" width="${bw}" height="20" rx="5"/><text class="dg-wbt" x="${x + w - bw / 2 - 2}" y="${y + h / 2}">${esc(button)}</text>` : '')
    + `<path class="dg-wline" d="M${x} ${y + h} H${x + w}"/>`,
  /** Grey bars that stand for rows that are still loading. */
  tskel: (x, y, w, n = 3, { h = 28 } = {}) => Array.from({ length: n }, (_, i) => [0, 1, 2].map((c) => `<rect class="dg-skel" x="${x + cols(w)[c] + 6}" y="${y + i * h + h / 2 - 4}" width="${[Math.round(w * 0.16), Math.round(w * 0.3), Math.round(w * 0.12)][c]}" height="8" rx="4"/>`).join('')).join(''),
  /** A dialog, with its title and two buttons. */
  dialog: (x, y, w, text, ok = 'OK', cancel = 'Cancel') => `<rect class="dg-dlg" x="${x}" y="${y}" width="${w}" height="64" rx="8"/><text class="dg-wt" x="${x + w / 2}" y="${y + 18}" text-anchor="middle">${esc(text)}</text>`
    + `<rect class="dg-wbtn" x="${x + w / 2 - 68}" y="${y + 34}" width="62" height="22" rx="5"/><text class="dg-wbt" x="${x + w / 2 - 37}" y="${y + 45}">${esc(cancel)}</text>`
    + `<rect class="dg-wbtn dg-wprimary" x="${x + w / 2 + 6}" y="${y + 34}" width="62" height="22" rx="5"/><text class="dg-wbt dg-wprimaryt" x="${x + w / 2 + 37}" y="${y + 45}">${esc(ok)}</text>`,
  /** A toast. */
  toast: (x, y, w, text) => `<rect class="dg-toast" x="${x}" y="${y}" width="${w}" height="24" rx="12"/><text class="dg-toastt" x="${x + w / 2}" y="${y + 12}">${esc(text)}</text>`,
  /** A form field: a label, a box with its value, and under it an error when there is one. */
  field: (x, y, w, name, value = '', error = '') => `<text class="dg-wm" x="${x}" y="${y + 6}">${esc(name)}</text>`
    + `<rect class="dg-wfield${error ? ' dg-werrbox' : ''}" x="${x}" y="${y + 14}" width="${w}" height="24" rx="5"/>`
    + (value ? `<text class="dg-wt" x="${x + 8}" y="${y + 26}">${esc(value)}</text>` : '')
    + (error ? `<text class="dg-werr" x="${x}" y="${y + 50}">${esc(error)}</text>` : ''),
  /** A button. */
  button: (x, y, w, text, primary = false) => `<rect class="dg-wbtn${primary ? ' dg-wprimary' : ''}" x="${x}" y="${y}" width="${w}" height="24" rx="5"/><text class="dg-wbt${primary ? ' dg-wprimaryt' : ''}" x="${x + w / 2}" y="${y + 12}">${esc(text)}</text>`,
  /** A ring around something that was just pressed. */
  ring: (x, y, w, h) => `<rect class="dg-wring" x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="8"/>`,
};

/**
 * Windows for a screen that is in one state after another. `bounds` are the moments it changes, [b1, b2, ...] in seconds; the result has one list of windows per
 * state (one more than there are bounds), to pass to `layer()`. Neighbours overlap for a moment, so one fades into the next, and the first state comes back at
 * the end of the cycle.
 */
export function states(bounds) {
  const f = 0.2;
  const edges = [0, ...bounds, 'reset'];
  return edges.slice(0, -1).map((from, i) => (i === 0 ? [[0, edges[1]], ['reset-0.2', 'end']] : [[from - f, edges[i + 1]]]));
}

/**
 * @param {{ id: string, label: string, title: string, desc: string, caption: string, w: number, h: number, size?: 'sm' | 'md' | 'lg',
 *   anim?: boolean | { dur?: number }, motion?: string, draw: (d: any) => void }} spec
 *   `anim`: the figure moves. `dur` is the length of one cycle in seconds; without it the cycle is the end of the last step plus a rest.
 *   `motion`: one sentence, what the moving dots show (required with `anim`).
 *   `desc`: what the picture is made of; the steps are added to it.
 */
export function diagram({ id, label, title, desc, caption, w, h, size = 'sm', anim = false, motion = '', draw }) {
  if (anim && !motion) throw new Error(`diagram ${id}: an animated diagram needs a "motion" sentence that says in words what the dots show`);
  const out = [];
  const lines = []; // moving things: { path, windows, ret, dash }
  const nodes = []; // boxes that light up: { x, y, w, h, index, windows }
  const steps = []; // the story: { text, win, n }
  const layers = []; // what a screen shows at each time: { index, markup, windows, fade }
  const bands = []; // code lines that light up with a step: { box, from, to, win }
  const codes = []; // the plain text of the code windows, for the description
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
    /** A dashed frame with a label at its top left, and more small lines under it. */
    zone(x, y, zw, zh, text, sub = []) {
      out.push(`<rect class="dg-zone" x="${x}" y="${y}" width="${zw}" height="${zh}" rx="12"/><text class="dg-zlab" x="${x + 14}" y="${y + 18}">${esc(text)}</text>`
        + sub.map((s, i) => `<text class="dg-zsub" x="${x + 14}" y="${y + 35 + 16 * i}">${esc(s)}</text>`).join(''));
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
    /**
     * A step of the story, in plain words, and the time window in which it plays. `n` is its number when that is not its place in the list (a step that
     * plays again is "2′"). `code` is [codeBox, firstLine, lastLine] (or a list of those): the lines of a code window that make the step happen, which
     * get a soft band for as long as it plays. Returns the window, to pass to the arrows as `go`.
     */
    step(text, win, { n, code } = {}) {
      steps.push({ text, win, n });
      if (anim && code) for (const [box, from, to = from] of (Array.isArray(code[0]) ? code : [code])) bands.push({ box, from, to, win });
      return win;
    },
    /**
     * What a screen shows, as SVG, during the given windows: [from, to] in seconds, where a time can also be 'reset' (the moment before the cycle starts
     * again, so the screen can be back where it began) or 'end', with an offset such as 'reset-0.2'. The content is decorative.
     */
    layer(markup, windows, { fade = 0.2 } = {}) {
      if (!anim) return;
      const index = out.push('') - 1;
      layers.push({ index, markup, windows, fade });
    },
    /** Content that is always there (the heading of a screen, the outline of a view). */
    raw(markup) { out.push(`<g aria-hidden="true">${markup}</g>`); },
    /** What a screen shows when nothing moves (no script, reduced motion): the settled state. */
    still(markup) {
      if (anim) out.push(`<g class="dg-still" aria-hidden="true">${markup}</g>`);
    },
    /**
     * The window of an app or a browser, at (x, y): a title bar with three dots and `title` (the address or the name), and room below for what it shows.
     * Returns its edges, `top` (where the content starts) and `layer` / `still` for the content.
     */
    screen(x, y, sw, sh, { title = '' } = {}) {
      const R = 10, bar = 28;
      const index = out.push(`<g class="dg-win" aria-hidden="true"><rect class="dg-wbox" x="${x}" y="${y}" width="${sw}" height="${sh}" rx="${R}"/>`
        + `<path class="dg-wbar" d="M${x} ${y + bar} V${y + R} a${R} ${R} 0 0 1 ${R} -${R} H${x + sw - R} a${R} ${R} 0 0 1 ${R} ${R} V${y + bar} Z"/><path class="dg-wline" d="M${x} ${y + bar} H${x + sw}"/>`
        + [14, 28, 42].map((dx) => `<circle class="dg-wdot" cx="${x + dx}" cy="${y + bar / 2}" r="4"/>`).join('')
        + (title ? `<text class="dg-wm" x="${x + 58}" y="${y + bar / 2 + 0.5}">${esc(title)}</text>` : '') + '</g>') - 1;
      const box = { x, y, w: sw, h: sh, r: x + sw, b: y + sh, cx: x + sw / 2, cy: y + sh / 2, top: y + bar, left: x + 12, inner: sw - 24, bar: [x + 58, y + bar / 2 + 0.5] };
      nodes.push({ ...box, index, windows: [] });
      Object.defineProperty(box, 'node', { value: nodes[nodes.length - 1] });
      return box;
    },
    /**
     * A code window in the site's dark "window" look (the one of the home page), with the code highlighted as everywhere on the site: `lines` of `lang` under a title
     * bar that shows `name`. It is real HTML in a foreignObject, so it takes the colours of the site. A line is 16 units high, so `step(..., { code })` can
     * put a band on it. Returns its edges and `lineY(i)`.
     */
    code(x, y, cw, name, lang, lines) {
      const TOP = 34, LH = 16;
      const ch = TOP + LH * lines.length + 8;
      out.push(`<g aria-hidden="true"><foreignObject x="${x}" y="${y}" width="${cw}" height="${ch}"><div class="window dg-code"><div class="bar"><i></i><i></i><i></i><span>${esc(name)}</span></div><pre><code>${highlight(lang, lines.join('\n'))}</code></pre></div></foreignObject></g>`);
      codes.push(`${name}: ${lines.join(' ')}`);
      return { x, y, w: cw, h: ch, r: x + cw, b: y + ch, cx: x + cw / 2, cy: y + ch / 2, lineY: (i) => y + TOP + LH * i, LH };
    },
    /**
     * Your services and APIs, as a dashed zone with a few small tiles in it (examples: xoong needs one OpenAPI document, one base URL, and does not
     * care what is behind it). `tiles` are [name, y, height, sub?]; returns the tile boxes. The one that takes part is drawn tall by the caller.
     */
    services(x, y, sw, sh, tiles) {
      d.zone(x, y, sw, sh, 'Your services and APIs', ['any language, one base URL,', 'described by OpenAPI']);
      return tiles.map(([name, ty, th, sub]) => d.box(x + 14, ty, sw - 28, name, sub ?? [], { kind: 'svc', bh: th }));
    },
  };
  draw(d);

  // The moving layer goes on top of everything: arrows that light up, packets, boxes that light up.
  let fx = '';
  let dur = 0;
  if (anim) {
    const ends = [...lines.flatMap((l) => l.windows.map((win) => win[1])), ...steps.map((s) => s.win[1])];
    dur = typeof anim === 'object' && anim.dur ? anim.dur : Math.ceil((Math.max(0, ...ends) + REST) * 2) / 2;
    if (ends.some((e) => e > dur - RESET)) throw new Error(`diagram ${id}: a step is still playing when the ${dur} s cycle ends`);
    const t = (v) => {
      if (typeof v === 'number') return v;
      const m = /^(reset|end)([+-]\d*\.?\d+)?$/.exec(v);
      return (m[1] === 'end' ? dur : dur - RESET) + Number(m[2] ?? 0);
    };
    for (const l of layers) {
      out[l.index] = `<g class="dg-moving" aria-hidden="true" opacity="0"><animate attributeName="opacity" ${loop(dur)} ${pulse(l.windows.map(([a, b]) => [t(a), t(b)]), dur, 1, l.fade, l.fade)}/>${l.markup}</g>`;
    }
    fx = '<g class="dg-fx" aria-hidden="true">'
      + lines.map((l) => `<path class="dg-hot${l.dash ? ' dg-dash' : ''}" d="${l.path}" marker-end="url(#${id}-ah)" opacity="0"><animate attributeName="opacity" ${loop(dur)} ${pulse(l.windows.map(([a, b]) => [a, b + 0.3]), dur, 1, 0.12, 0.3)}/></path>`).join('')
      + nodes.filter((n) => n.windows.length).map((n) => `<rect class="dg-glow" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" opacity="0"><animate attributeName="opacity" ${loop(dur)} ${pulse(n.windows, dur, 1, 0.12, 0.25)}/></rect>`).join('')
      + [...bands.reduce((acc, b) => { const key = `${b.box.x},${b.box.y},${b.from},${b.to}`; (acc.get(key) ?? acc.set(key, { ...b, wins: [] }).get(key)).wins.push([b.win[0] - 0.05, b.win[1] + 0.1]); return acc; }, new Map()).values()]
        .map((b) => `<rect class="dg-band" x="${b.box.x + 4}" y="${b.box.lineY(b.from) - 1}" width="${b.box.w - 8}" height="${b.box.LH * (b.to - b.from + 1) + 2}" rx="3" opacity="0"><animate attributeName="opacity" ${loop(dur)} ${pulse(b.wins, dur, 0.4, 0.12, 0.2)}/></rect>`).join('')
      + lines.flatMap((l) => l.windows.map((win) => packet(l.path, win, dur, l.ret))).join('')
      + '</g>';
  }
  const heads = `<marker id="${id}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-head" d="M0 0 10 5 0 10z"/></marker>`
    + (anim ? `<marker id="${id}-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-head dg-head-hot" d="M0 0 10 5 0 10z"/></marker>` : '');
  const story = steps.map((s, i) => `${s.n ?? i + 1}. ${s.text}`).join(' ');
  const full = anim ? `${desc}${codes.length ? ` The code window shows ${codes.join(' and ')}.` : ''} Steps: ${story} When the animation plays, ${motion}` : desc;
  const data = anim ? ` data-dur="${num(dur)}" data-steps="${attr(JSON.stringify(steps.map((s, i) => [s.n ?? String(i + 1), s.text, num(s.win[0]), num(scrubAt(s.win))])))}"` : '';
  return `<figure class="dg-fig${anim ? ' dg-anim' : ''}"${data}>
<div class="dg-scroll" tabindex="0" role="group" aria-label="${esc(label)}">
<svg class="dg dg-${size}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-t ${id}-d">
<title id="${id}-t">${esc(title)}</title>
<desc id="${id}-d">${esc(full)}</desc>
<defs>${heads}</defs>
${out.join('\n')}
${fx}
</svg>
</div>
<p class="hint">${caption}${anim ? ` <span class="dg-motion">In motion, ${esc(motion)} Use the slider, or press a number, to look at one step.</span>` : ''}</p>
</figure>`;
}

/**
 * A sequence diagram: participants across the top, one arrow per message, top to bottom. A message is { from, to, label (string or lines), dashed?, says?, code? }
 * or a note { note, over: [first, last] }. `from`, `to` and `over` count the columns from the left: the screen (if any), `parts`, the services (if any).
 * With `anim`, the messages play one after another: a packet travels along each arrow in its turn (`anim: { travel, gap }` sets the pace), `says` is the plain
 * sentence of the step (the label when there is none) and `code` is [firstLine, lastLine] of the code window that make it happen.
 * `screen: { title, code: { name, lang, lines }, build(scr, win, d, code) }` makes the first column a window of the app, and shows the code that makes the screen
 * above the arrows, between the participants; `win(i)` is the time window of message `i` of `msgs`. `services: { active, sub }` makes the last column the zone
 * of your services, with the tile of the one that answers.
 */
export function sequence({ id, label, title, desc, caption, parts, msgs, col = 150, size = 'md', anim = false, motion = '', screen, services, wide = 190, code: codeOnly }) {
  const cols = [];
  const codeSpec = screen?.code ?? codeOnly;
  if (screen) cols.push({ kind: 'screen', w: screen.w ?? wide });
  for (const part of parts) cols.push({ kind: 'part', name: part, w: col });
  if (services) cols.push({ kind: 'services', w: wide });
  let acc = 0;
  for (const c of cols) { c.x = acc; c.cx = acc + c.w / 2; acc += c.w; }
  const w = acc;
  const middle = cols.filter((c) => c.kind === 'part');
  const CODE_W = codeSpec?.w ?? 292, CODE_Y = 56;
  const codeH = codeSpec ? 34 + 16 * codeSpec.lines.length + 8 : 0;
  let y = codeSpec ? CODE_Y + codeH + 30 : 66;
  const rows = msgs.map((m) => {
    if (m.note) { const row = { ...m, y, h: 36 }; y += 52; return row; }
    const lines = Array.isArray(m.label) ? m.label : [m.label];
    const row = { ...m, lines, y: y + 15 * lines.length + 6 };
    y += 15 * lines.length + (codeSpec ? 24 : 30);
    return row;
  });
  const h = y + 10;
  const travel = typeof anim === 'object' ? anim.travel ?? 0.8 : 0.8, gap = typeof anim === 'object' ? anim.gap ?? 0.2 : 0.2;
  let t = 0.4;
  const wins = rows.map((m) => {
    if (m.note) { t += 0.5; return null; } // the story waits a moment at a note
    const win = [t, t + travel];
    t += travel + gap;
    return win;
  });
  return diagram({
    id, label, title, desc, caption, w, h, size, anim, motion,
    draw(d) {
      let code = null;
      cols.forEach((c) => {
        if (c.kind === 'part') c.head = d.box(c.cx - (c.w - 16) / 2, 10, c.w - 16, c.name, [], { bh: 38 });
        if (c.kind === 'screen') c.head = d.screen(c.x + 6, 10, c.w - 12, h - 20, { title: screen.title });
        if (c.kind === 'services') {
          // two small tiles on top, then the one that answers, tall enough to meet every arrow that goes to it
          const top = 154, bottom = h - 24;
          const used = rows.filter((r) => !r.note && (cols[r.from] === c || cols[r.to] === c)).map((r) => r.y);
          if (used.length && (Math.min(...used) < top + 12 || Math.max(...used) > bottom - 12)) throw new Error(`sequence ${id}: a message to the services misses its tile`);
          const tiles = d.services(c.x + 6, 10, c.w - 12, h - 20, [['Orders API', 72, 32], ['Files service', 110, 32], [services.active, top, bottom - top, services.sub]]);
          c.head = tiles[2];
        }
      });
      cols.forEach((c) => { if (c.kind === 'part') d.line([[c.cx, c.head.b], [c.cx, h - 6]], { life: true }); }); // lifelines first, so the arrows are drawn over them
      if (codeSpec) {
        const spread = screen ? middle : cols;
        const pw = spread.reduce((n, c) => n + c.w, 0);
        code = d.code(spread[0].x + Math.max(0, (pw - CODE_W) / 2), CODE_Y, CODE_W, codeSpec.name, codeSpec.lang, codeSpec.lines);
        if (screen && code.x - cols[0].head.r >= 18) d.line([[code.x, code.cy], [cols[0].head.r, code.cy]]);
      }
      if (screen) screen.build(cols[0].head, (i) => wins[i], d, code);
      const edge = (c) => (c.kind === 'screen' ? c.head.r : c.kind === 'services' ? c.head.x : c.cx);
      let n = 0;
      rows.forEach((m, i) => {
        if (m.note) {
          const x1 = cols[m.over[0]].x + 12, x2 = cols[m.over[1]].x + cols[m.over[1]].w - 12;
          d.box(x1, m.y, x2 - x1, m.note, [], { kind: 'soft', bh: m.h });
          return;
        }
        n++;
        const a = edge(cols[m.from]), b = edge(cols[m.to]);
        const shown = anim ? [`${n} ${m.lines[0]}`, ...m.lines.slice(1)] : m.lines;
        if (anim) d.step(m.says ?? m.lines.join(' '), wins[i], { code: m.code && code ? [code, ...m.code] : undefined });
        d.line([[a, m.y], [b, m.y]], { dash: m.dashed, go: wins[i], from: cols[m.from].head, to: cols[m.to].head });
        shown.forEach((l, k) => d.text((a + b) / 2, m.y - 12 - 15 * (shown.length - 1 - k), l, 'dg-lab'));
      });
    },
  });
}
