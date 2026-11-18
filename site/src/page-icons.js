// The icon library page: filter, preview (weight, size, colour, background), copy the class, download the SVG.
// The grid is HTML already (tools/site/icons-page.mjs); this adds behaviour only. Nothing here writes a style attribute (a strict CSP blocks them):
// the preview is driven by data-* attributes on the stage and by the xi classes.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const stage = $('.icon-stage');
const detail = $('#icon-detail');
const live = $('#icon-live');
const countEl = $('#icon-count');
let selected = '';
let category = '';

const weight = () => $('input[name=weight]:checked').value;
/** The classes that draw an icon in the chosen weight. */
const classes = (name, w = weight()) => `xi ${w === 'regular' ? '' : `xi-${w} `}xi-${name}`;
const html = (name, w) => `<i class="${classes(name, w)}" aria-hidden="true"></i>`;
const say = (text) => { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); };

function paintWeight() {
  const w = weight();
  for (const i of $$('.icon-pick .xi', stage)) { i.classList.toggle('xi-fill', w === 'fill'); i.classList.toggle('xi-bold', w === 'bold'); }
  if (selected) showDetail(selected);
}

function apply() {
  for (const key of ['weight', 'size', 'tone', 'scheme']) stage.dataset[key] = $(`input[name=${key}]:checked`).value;
  $('.icon-detail__show').dataset.scheme = stage.dataset.scheme;
  $('.icon-detail__show').dataset.tone = stage.dataset.tone;
  paintWeight();
}

function filter() {
  const terms = $('#icon-q').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const group of $$('.icon-group', stage)) {
    const inCat = !category || group.dataset.group === category;
    let any = 0;
    for (const li of $$('li', group)) {
      const hit = inCat && terms.every((t) => li.dataset.search.includes(t));
      li.hidden = !hit;
      if (hit) any++;
    }
    group.hidden = !any;
    shown += any;
  }
  $('.icon-none').hidden = shown > 0;
  countEl.textContent = shown === 1 ? '1 icon' : `${shown} icons`;
}

function showDetail(name) {
  selected = name;
  const w = weight();
  detail.hidden = false;
  $('#icon-detail-name').textContent = name;
  $('#icon-detail-tags').textContent = `Also: ${$(`.icon-pick[data-icon="${name}"]`).closest('li').dataset.search.split(' ').slice(1).join(', ')}`;
  $('.icon-detail__show .xi').className = `${classes(name, w)} xi-2x`;
  $('#icon-detail-code').textContent = html(name, w);
  for (const b of $$('.icon-pick', stage)) b.setAttribute('aria-pressed', String(b.dataset.icon === name));
}

async function copy(text, what) {
  try { await navigator.clipboard.writeText(text); say(`Copied ${what}: ${text}`); } catch { say(`Could not copy. Select it and press Ctrl+C: ${text}`); }
}

async function download(name) {
  const w = weight();
  const { default: data } = await import('./icons-data.js'); // loaded on the first download only
  const svg = data[name]?.[w];
  if (!svg) return;
  const file = `${name}${w === 'regular' ? '' : `-${w}`}.svg`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url; a.download = file;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  say(`Downloaded ${file}`);
}

stage.addEventListener('click', (e) => {
  const pick = e.target.closest('.icon-pick');
  if (!pick) return;
  showDetail(pick.dataset.icon);
  copy(classes(pick.dataset.icon), 'class');
});
$('#icon-copy-class').addEventListener('click', () => selected && copy(classes(selected), 'class'));
$('#icon-copy-html').addEventListener('click', () => selected && copy(html(selected), 'HTML'));
$('#icon-dl').addEventListener('click', () => selected && download(selected));
$('#icon-q').addEventListener('input', filter);
for (const r of $$('.icon-opts input')) r.addEventListener('change', apply);
for (const b of $$('.icon-cat button')) {
  b.addEventListener('click', () => {
    category = b.dataset.cat;
    for (const o of $$('.icon-cat button')) o.setAttribute('aria-pressed', String(o === b));
    filter();
  });
}
apply();
filter();
