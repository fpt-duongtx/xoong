// @ts-check
/** Array editing inside a `<form xo-submit>`: `xo-add`, `xo-remove`, `xo-move` and dragging a row (`xo-drag`). */
import { parseInterpolation, evalParts } from './scope.js';
import { withOf } from './actions.js';

/** The marker comment that opens the xo-each list a row belongs to (null when `node` is not a row). */
const listStart = (node) => {
  for (let n = node.previousSibling; n; n = n.previousSibling) if (n.nodeType === 8) return n.data === 'xo-each' ? n : null;
  return null;
};
/** The rows of the list `row` belongs to, in order. */
function rowsOf(row) {
  const rows = [];
  for (let n = listStart(row)?.nextSibling; n && !(n.nodeType === 8 && n.data === '/xo-each'); n = n.nextSibling) if (n.nodeType === 1) rows.push(n);
  return rows;
}
/** The innermost list row that holds `el`, the rows of its list and its position among them. */
function rowContext(el) {
  let row = el;
  while (row && !listStart(row)) row = row.parentElement;
  const rows = row ? rowsOf(row) : [];
  return { row, rows, at: row ? rows.indexOf(row) : -1 };
}
/** The button with the same action spec inside another row. */
const sameButton = (row, attr, spec) => [...row.querySelectorAll(`[${attr}]`)].find((b) => b.getAttribute(attr) === spec);

/**
 * `xo-drag="blocks[{$index}]"` on a handle inside an array row: drag the row onto another row of the same list to move it. The buttons (xo-move) remain
 * for keyboards and touch; this is the pointer shortcut. The handle describes itself on demand (the index changes as rows move).
 */
const DRAG = 'application/x-xoong-row';
export function bindDrag(el, spec, scope, ctx) {
  el.draggable = true;
  el.xoDrag = () => ({ text: evalParts(parseInterpolation(spec) ?? [spec], scope, ctx.lookup), model: ctx.lookup(scope, '$form') });
  el.addEventListener('dragstart', (event) => {
    event.dataTransfer?.setData(DRAG, el.xoDrag().text);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    rowContext(el).row?.classList.add('xo-dragging');
  });
  el.addEventListener('dragend', () => document.querySelectorAll('.xo-dragging, .xo-drop').forEach((n) => n.classList.remove('xo-dragging', 'xo-drop')));
}
if (typeof document !== 'undefined') {
  const split = (text) => { const m = /^(.*)\[(\d+)\]$/.exec(text); return m ? { list: m[1], index: Number(m[2]) } : null; };
  const handleOf = (target) => rowContext(target).row?.querySelector('[xo-drag]');
  document.addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types.includes(DRAG)) return;
    const over = handleOf(event.target);
    if (!over) return;
    event.preventDefault(); // this row accepts the drop
    for (const n of document.querySelectorAll('.xo-drop')) if (n !== rowContext(over).row) n.classList.remove('xo-drop');
    rowContext(over).row?.classList.add('xo-drop');
  });
  document.addEventListener('drop', (event) => {
    const from = event.dataTransfer?.getData(DRAG);
    const target = handleOf(/** @type {Element} */ (event.target));
    if (!from || !target) return;
    event.preventDefault();
    const { text, model } = target.xoDrag();
    const a = split(from);
    const b = split(text);
    document.querySelectorAll('.xo-dragging, .xo-drop').forEach((n) => n.classList.remove('xo-dragging', 'xo-drop'));
    if (a && b && a.list === b.list && a.index !== b.index) model?.moveItem(from, b.index - a.index); // only within one list
  });
}

/**
 * Array editing inside a `<form xo-submit>` (the model owns the draft):
 *   <button type="button" xo-add="blocks" xo-with="type=image">Add image</button>      append (a union item needs its tag)
 *   <button type="button" xo-remove="blocks[{$index}]">Remove</button>                  remove this item
 *   <button type="button" xo-move="blocks[{$index}]:up">Up</button>   (or :down)        move this item
 * Plain buttons: keyboard accessible, no drag needed.
 */
export function bindArrayAction(el, kind, spec, scope, ctx, disposers) {
  const handler = (event) => {
    event.preventDefault();
    const model = ctx.lookup(scope, '$form');
    if (!model) { console.error(`xoong: ${kind} only works inside a <form xo-submit> whose operation has a request schema`); return; }
    const text = evalParts(parseInterpolation(spec) ?? [spec], scope, ctx.lookup);
    if (kind === 'xo-add') {
      const fields = withOf(el, scope, ctx, { bodyFields: [] });
      model.append(text, fields && Object.keys(fields).length ? fields : undefined);
    } else if (kind === 'xo-remove') {
      const { row, rows, at } = rowContext(el);
      const area = row?.closest('fieldset, form');
      model.removeAt(text);
      // the focus must not fall to the page: it goes to the same button of the row now at that position, else the previous one, else the list's add button
      const survivor = rows.find((r) => r.isConnected);
      const left = survivor ? rowsOf(survivor) : [];
      const next = left[at] ?? left[at - 1];
      (next ? sameButton(next, kind, spec) : area?.querySelector('[xo-add]'))?.focus();
    } else {
      const m = /^(.*):(up|down|-?\d+)$/.exec(text);
      if (!m) { console.error(`xoong: xo-move="${text}" is not "path:up" or "path:down"`); return; }
      const delta = m[2] === 'up' ? -1 : m[2] === 'down' ? 1 : Number(m[2]);
      const { rows, at } = rowContext(el);
      model.moveItem(m[1], delta);
      // rows follow their index, so the moved item's row is the one at the new position: keep the focus on the same button there
      if (rows[at + delta]) sameButton(rows[at + delta], kind, spec)?.focus();
    }
  };
  el.addEventListener('click', handler);
  disposers.push(() => el.removeEventListener('click', handler));
}
