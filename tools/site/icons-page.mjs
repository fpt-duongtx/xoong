// The icon library page (icons.html): every icon of @xoong/icons, searchable, grouped, with a preview in size, weight, colour and scheme, a copy of the
// class name and a download of the SVG. The grid is plain HTML written here from the package's data, so the page reads without a script (and a crawler
// sees every name); site/src/page-icons.js only filters, previews, copies and downloads.
import { icons, names } from '../../packages/icons/src/index.js';
import { esc } from './lib.mjs';

const CATEGORIES = [['arrows', 'Navigation and arrows'], ['actions', 'Actions'], ['status', 'Status and alerts'], ['people', 'People'], ['interface', 'Interface'], ['content', 'Content and editor'], ['communication', 'Communication and time']];
const cell = (name) => `<li class="icon-cell-x" data-name="${name}" data-search="${esc(`${name} ${icons[name].tags.join(' ')}`)}"><button type="button" class="icon-pick" data-icon="${name}"><i class="xi xi-${name}" aria-hidden="true"></i><span class="icon-name">${name}</span></button></li>`;
const group = ([id, label]) => {
  const list = names.filter((n) => icons[n].category === id).sort();
  return list.length ? `<section class="icon-group" data-group="${id}" aria-labelledby="g-${id}"><h2 id="g-${id}">${label} <small>${list.length}</small></h2><ul class="icon-list">${list.map(cell).join('')}</ul></section>` : '';
};
const radios = (name, label, options, checked) => `<fieldset class="icon-opt"><legend>${label}</legend>${options.map(([value, text]) => `<label><input type="radio" name="${name}" value="${value}"${value === checked ? ' checked' : ''}> <span>${text}</span></label>`).join('')}</fieldset>`;

const body = `
<h1>Icons</h1>
<p class="lead">${names.length} rounded icons on a 24px grid, in three weights. One class draws one: <code>&lt;i class="xi xi-edit" aria-hidden="true"&gt;&lt;/i&gt;</code>. The size follows the text, the colour is <code>currentColor</code>, and nothing in the element is a character a screen reader or a crawler could read.</p>

<div class="icon-tool" role="search" aria-label="Icon library">
  <div class="icon-find">
    <label for="icon-q">Search icons</label>
    <input id="icon-q" type="search" placeholder="Name or word, e.g. delete, arrow, cloud" autocomplete="off" spellcheck="false">
    <p class="hint" id="icon-count" role="status" aria-live="polite">${names.length} icons</p>
  </div>
  <div class="icon-opts">
    ${radios('weight', 'Weight', [['regular', 'Regular'], ['fill', 'Fill'], ['bold', 'Bold']], 'regular')}
    ${radios('size', 'Size', [['16', '16'], ['24', '24'], ['32', '32'], ['48', '48']], '24')}
    ${radios('tone', 'Colour', [['text', 'Text'], ['accent', 'Accent'], ['success', 'Green'], ['warning', 'Amber'], ['danger', 'Red']], 'text')}
    ${radios('scheme', 'Background', [['light', 'Light'], ['dark', 'Dark']], 'light')}
  </div>
  <div class="icon-cat" role="group" aria-label="Group">
    <button type="button" aria-pressed="true" data-cat="">All</button>${CATEGORIES.map(([id, label]) => `<button type="button" aria-pressed="false" data-cat="${id}">${label.split(' and ')[0]}</button>`).join('')}
  </div>
</div>

<div class="icon-stage" data-weight="regular" data-size="24" data-tone="text" data-scheme="light">
  ${CATEGORIES.map(group).join('\n  ')}
  <p class="icon-none" hidden>No icon matches. Try a shorter word, or a synonym such as <em>remove</em> for delete.</p>
</div>

<aside class="icon-detail" id="icon-detail" aria-label="Selected icon" hidden>
  <div class="icon-detail__head">
    <div class="icon-detail__show" data-scheme="light"><i class="xi xi-2x xi-edit" aria-hidden="true"></i></div>
    <div>
      <h2 id="icon-detail-name">edit</h2>
      <p class="hint" id="icon-detail-tags"></p>
    </div>
  </div>
  <pre class="icon-detail__code" tabindex="0"><code id="icon-detail-code"></code></pre>
  <p class="icon-detail__actions">
    <button type="button" id="icon-copy-class">Copy class</button>
    <button type="button" id="icon-copy-html">Copy HTML</button>
    <button type="button" id="icon-dl">Download SVG</button>
  </p>
  <p class="hint" id="icon-live" role="status" aria-live="polite"></p>
</aside>

<h2 id="use">Use it</h2>
<p>Add the stylesheet once and write the class. The whole set is <code>@xoong/icons/icons.css</code>; the Mist stylesheet and each control's own stylesheet already carry the icons they draw.</p>
<pre tabindex="0"><code>&lt;link rel="stylesheet" href="/@xoong/icons/icons.css"&gt;

&lt;i class="xi xi-edit" aria-hidden="true"&gt;&lt;/i&gt;             regular
&lt;i class="xi xi-fill xi-edit" aria-hidden="true"&gt;&lt;/i&gt;      fill
&lt;i class="xi xi-bold xi-edit xi-lg" aria-hidden="true"&gt;&lt;/i&gt; bold, 1.25em
&lt;i class="xi xi-settings xi-spin" aria-hidden="true"&gt;&lt;/i&gt;   turning

&lt;button&gt;&lt;i class="xi xi-trash" aria-hidden="true"&gt;&lt;/i&gt; Delete&lt;/button&gt;
&lt;button aria-label="Delete"&gt;&lt;i class="xi xi-trash" aria-hidden="true"&gt;&lt;/i&gt;&lt;/button&gt;</code></pre>
<div class="table-wrap"><table>
<thead><tr><th scope="col">Class</th><th scope="col">Effect</th></tr></thead>
<tbody>
<tr><th scope="row"><code>xi</code></th><td>The box: <code>1em</code> square, <code>currentColor</code>, aligned to the text.</td></tr>
<tr><th scope="row"><code>xi-sm</code> <code>xi-lg</code> <code>xi-xl</code> <code>xi-2x</code> <code>xi-3x</code></th><td>Sizes, as a multiple of the text size (<code>font-size</code>): 0.875, 1.25, 1.5, 2 and 3 em.</td></tr>
<tr><th scope="row"><code>xi-fw</code></th><td>A fixed width of 1.25em, so a column of icons lines up.</td></tr>
<tr><th scope="row"><code>xi-spin</code></th><td>Turns once a second (three seconds when the person asked for reduced motion).</td></tr>
<tr><th scope="row"><code>xi-fill</code> <code>xi-bold</code></th><td>The filled drawing, or the same outline with a heavier stroke. An icon without a filled drawing (a plus, an arrow) uses the bold outline for fill.</td></tr>
</tbody></table></div>
<p>An icon next to text is decoration: <code>aria-hidden="true"</code>. An icon alone in a button needs the button's <code>aria-label</code> (the icon is never the name).</p>

<h2 id="subset">Ship only the icons you use</h2>
<p>A set of hundreds should not cost a project hundreds of kilobytes. The <code>xoong-icons</code> command reads your sources, finds the <code>xi-</code> classes (and the old <code>data-ic</code> and <code>var(--ic-…)</code> forms), and writes a stylesheet with just those. The fill and bold weights are added only when <code>xi-fill</code> or <code>xi-bold</code> appear.</p>
<pre tabindex="0"><code>npx xoong-icons --scan src --scan index.html --out public/icons.css
npx xoong-icons --scan src --include star,heart     # names built at run time, which a scan cannot see
npx xoong-icons --list                              # every name</code></pre>

<h2 id="source">The source is SVG</h2>
<p>Each icon is one hand-drawn SVG file on a 24px grid with a 1.75 stroke, round caps and joins: <code>packages/icons/src/svg/&lt;name&gt;.svg</code>, and a <code>fill/</code> drawing where a filled form makes sense. The stylesheet is generated from those files as CSS masks (<code>node tools/build-icons.mjs</code>; a test fails when it drifts), so it needs only <code>img-src data:</code> under a strict Content-Security-Policy, with no inline style or script. The set is drawn for xoong: inspired by the soft, even look of current system icons, not copied from any icon library or from Apple's SF Symbols.</p>
<p>The old <code>&lt;span class="ic" data-ic="edit"&gt;</code> keeps working; new code should use the <code>xi</code> classes.</p>
`;

export const iconsPage = {
  file: 'icons.html', section: 'docs', group: 'Design', nav: 'Icons', title: 'Icons', script: 'page-icons.js', css: ['icons-full.css', 'page-icons.css'],
  description: `${names.length} rounded icons in regular, fill and bold: <i class="xi xi-edit"> classes, a stylesheet of only the icons you use, one SVG source.`.replace(/<[^>]+>/g, '').replace(/\s+/g, ' '),
  body,
};
