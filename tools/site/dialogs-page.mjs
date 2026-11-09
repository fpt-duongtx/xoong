// The "Dialogs and modals" page: the built-in questions (confirm, alert, prompt, ask), the titled modal (<xo-dialog heading>) and which popup to use when.
// Every button below runs for real: site/src/page-dialogs.js calls the same functions the code tabs show.
import { example, tabs, callout } from './lib.mjs';

export const dialogsPage = {
  file: 'dialogs.html', section: 'docs', group: 'Overlays', nav: 'Dialogs and modals', title: 'Dialogs and modals', script: 'page-dialogs.js',
  description: 'Confirmation, warning, info and error dialogs, a prompt, a choice, and a titled modal: built in, native, accessible.',
  body: `
<h1>Dialogs and modals</h1>
<p class="lead">The common questions are built in: <code>confirm</code>, <code>alert</code>, <code>prompt</code> and <code>ask</code>, plus a titled modal, <code>&lt;xo-dialog heading&gt;</code>. They are the browser's own <code>&lt;dialog&gt;</code>: the page behind is inert, the focus stays inside, Escape answers "no". Import <code>@xoong/ui</code> and they work; there is nothing to configure.</p>
<xo-toast></xo-toast>

<h2>Which one to use</h2>
<div class="table-wrap"><table>
<thead><tr><th>You want to</th><th>Use</th><th>Blocks the page</th></tr></thead>
<tbody>
<tr><td>Ask yes or no before something that cannot be undone</td><td><code>confirm()</code>, or <code>xo-confirm</code> on a button</td><td>Yes</td></tr>
<tr><td>Tell the person something they must see (info, success, warning, error)</td><td><code>alert()</code></td><td>Yes</td></tr>
<tr><td>Ask for one line of text</td><td><code>prompt()</code></td><td>Yes</td></tr>
<tr><td>Offer two or three named choices (Save, Don't save, Keep editing)</td><td><code>ask()</code></td><td>Yes</td></tr>
<tr><td>Show a form or any content in a window</td><td><code>&lt;xo-dialog heading&gt;</code></td><td>Yes</td></tr>
<tr><td>Say "done" without asking anything, maybe with Undo</td><td>A toast: <code>xo-notice</code> or <code>toast.show()</code></td><td>No</td></tr>
<tr><td>Show a small panel next to a button</td><td><a href="more-controls.html"><code>&lt;xo-popover&gt;</code></a></td><td>No</td></tr>
<tr><td>List actions for one item</td><td><a href="menu.html"><code>&lt;xo-menu&gt;</code></a></td><td>No</td></tr>
<tr><td>Explain an icon button on hover or focus</td><td><a href="menu.html"><code>xo-tooltip</code></a></td><td>No</td></tr>
</tbody></table></div>
<p>Rule of thumb: block the page only when the person must decide or must see it. Everything that can be undone is better as a toast with Undo than as a question.</p>

<h2>Confirmation</h2>
<p><code>confirm(message, options)</code> resolves to <code>true</code> or <code>false</code>. The focus starts on Cancel, the safe choice. With no <code>kind</code> the confirming button is red, as for a delete. A <code>kind</code> of <code>warning</code>, <code>info</code> or <code>success</code> adds an icon and colours the button to match; <code>title</code> adds a heading and <code>detail</code> a second, quieter line.</p>
${example({
  label: 'confirm()',
  preview: `
<p class="toolbar">
  <button data-demo="confirm-plain">Plain</button>
  <button data-demo="confirm-danger">Danger</button>
  <button data-demo="confirm-warning">Warning</button>
  <button data-demo="confirm-info">Info</button>
</p>
<p class="hint">Answer: <output id="out-confirm">nothing yet</output></p>`,
  extra: [['JavaScript', 'js', `
import { confirm } from '@xoong/ui';

if (await confirm('The 14 articles in it are deleted too.', {
  kind: 'danger',          // 'danger' | 'warning' | 'info' | 'success'
  title: 'Delete project?',
  ok: 'Delete',            // the text of the confirming button
  cancel: 'Keep it',
  detail: 'You can restore it for 30 days.',
})) {
  // go on
}`]],
})}
<p>On a button that runs an operation, the same question is an attribute. The extra attributes tune the dialog; the button is red unless <code>xo-confirm-kind</code> says otherwise.</p>
${tabs('xo-confirm', [['HTML', 'html', `
<button xo-click="deletePerson" xo-confirm="Delete {name}? Their posts stay."
        xo-confirm-title="Delete person" xo-confirm-ok="Delete" xo-confirm-kind="danger" xo-notice="Deleted">Delete</button>

<button xo-click="publishPost" xo-confirm="Subscribers get an e-mail." xo-confirm-kind="info"
        xo-confirm-title="Publish now?" xo-confirm-ok="Publish">Publish</button>`]])}

<h2>Alert: info, success, warning, error</h2>
<p><code>alert(message, options)</code> shows one OK button and resolves when it is closed. <code>kind</code> defaults to <code>info</code>; use <code>success</code>, <code>warning</code> or <code>danger</code> (also written <code>error</code>). The focus starts on OK. An alert is announced as an <code>alertdialog</code> with the title as its name and the message as its description.</p>
${example({
  label: 'alert()',
  preview: `
<p class="toolbar">
  <button data-demo="alert-info">Info</button>
  <button data-demo="alert-success">Success</button>
  <button data-demo="alert-warning">Warning</button>
  <button data-demo="alert-error">Error</button>
</p>
<p class="hint">Result: <output id="out-alert">nothing yet</output></p>`,
  extra: [['JavaScript', 'js', `
import { alert } from '@xoong/ui';

await alert('We e-mail you when the file is ready.', { title: 'Export started' });                  // info
await alert('Your changes are live.', { kind: 'success', title: 'Published' });
await alert('Two of the five images have no description.', { kind: 'warning', title: 'Saved with warnings' });
await alert('The file is larger than 10 MB.', { kind: 'error', title: 'Upload failed', detail: 'Choose a smaller file.' });`]],
})}

<h2>Prompt</h2>
<p><code>prompt(message, options)</code> asks for a line of text: it resolves with the text, or <code>null</code> when cancelled. The field is a native input, so <code>type</code>, <code>required</code> and <code>pattern</code> are checked by the browser, Enter submits, and an empty required field keeps the dialog open and marks the field invalid.</p>
${example({
  label: 'prompt()',
  preview: `
<p class="toolbar">
  <button data-demo="prompt">Name a view</button>
  <button data-demo="prompt-required">Required web address</button>
</p>
<p class="hint">Answer: <output id="out-prompt">nothing yet</output></p>`,
  extra: [['JavaScript', 'js', `
import { prompt } from '@xoong/ui';

const name = await prompt('Name this view', { title: 'Save view', label: 'Name', value: 'My view' });
if (name !== null) save(name);                       // null means cancelled

const href = await prompt('Where should the link point?', { label: 'Address', type: 'url', required: true });`]],
})}

<h2>Choices</h2>
<p><code>ask(message, { buttons })</code> offers any set of choices and resolves with the <code>value</code> of the one pressed. Mark one button <code>primary</code> (the filled one), one <code>danger</code> if it destroys something, and one <code>cancel</code>: Escape answers with its value, and the focus starts on it. Without a <code>cancel</code> button, Escape resolves <code>null</code>.</p>
${example({
  label: 'ask()',
  preview: `
<p class="toolbar"><button data-demo="ask">Leave with unsaved changes</button></p>
<p class="hint">Answer: <output id="out-ask">nothing yet</output></p>`,
  extra: [['JavaScript', 'js', `
import { ask } from '@xoong/ui';

const answer = await ask('You have unsaved changes.', {
  kind: 'warning',
  title: 'Leave this page?',
  buttons: [
    { label: "Don't save", value: 'discard', danger: true },
    { label: 'Keep editing', value: 'stay', cancel: true },
    { label: 'Save and leave', value: 'save', primary: true },
  ],
});
// 'discard' | 'stay' | 'save'`]],
})}

<h2>A titled modal</h2>
<p>Give <code>&lt;xo-dialog&gt;</code> a <code>heading</code> and it becomes a window: a header with the title and a Close button, the content as the body, and anything marked <code>slot="footer"</code> as the footer. <code>size</code> is <code>sm</code>, the default, <code>wide</code> or <code>full</code>; on a phone it fills the screen. <code>dismiss</code> closes it on a click outside it, which is right for a harmless dialog and wrong for a form with unsaved input, so it is off by default.</p>
<p>A footer button outside the form still submits it with <code>form="id"</code>; with <code>method="dialog"</code> the form closes the dialog and the button's <code>value</code> is the answer.</p>
${example({
  label: '<xo-dialog heading>',
  preview: `
<p class="toolbar">
  <button xo-open="#d-edit">Edit person</button>
  <button xo-open="#d-small">Small, click outside closes</button>
  <button xo-open="#d-wide">Wide</button>
</p>
<p class="hint">Closed by: <output id="out-modal">nothing yet</output></p>

<xo-dialog id="d-edit" heading="Edit person" data-out="out-modal">
  <form method="dialog" id="edit-form" class="xo-fields">
    <label>Name <input name="name" value="Ada Lovelace" autocomplete="off"></label>
    <label>E-mail <input type="email" name="email" value="ada@example.org" autocomplete="off"></label>
  </form>
  <button slot="footer" type="button" xo-close>Cancel</button>
  <button slot="footer" type="submit" form="edit-form" value="saved" class="primary">Save</button>
</xo-dialog>

<xo-dialog id="d-small" heading="Keyboard shortcuts" size="sm" dismiss data-out="out-modal">
  <p>Press <kbd>Ctrl</kbd> + <kbd>K</kbd> for the command palette.</p>
  <button slot="footer" type="button" xo-close value="got it" class="primary">Got it</button>
</xo-dialog>

<xo-dialog id="d-wide" heading="Release notes" size="wide" data-out="out-modal">
  <p>Wide dialogs suit tables and side-by-side content. The body scrolls when it is taller than the window; the header and footer stay put.</p>
  <button slot="footer" type="button" xo-close>Close</button>
</xo-dialog>`,
  extra: [['JavaScript', 'js', `
// xo-open="#id" opens it from markup; from JavaScript, open() resolves with the answer
const answer = await document.querySelector('#d-edit').open();   // 'saved' | '' (Escape, Cancel, Close)`]],
})}
<p>A form made by xoong goes in the same way: put <code>&lt;xo-form op="createPerson"&gt;</code> in the body and the dialog closes by itself when the form succeeds (<code>xo-done</code>). <code>&lt;xo-dialog&gt;</code> without a <code>heading</code> stays a plain wrapper around whatever you put in it, as before.</p>

<h2>Notices that need no answer</h2>
<p>If nothing has to be decided, do not block the page. <code>xo-notice="Saved"</code> on a button or form raises a toast after success; from JavaScript use <code>toast.show()</code>, with an action such as Undo.</p>
${example({
  label: 'toast.show()',
  preview: `<p class="toolbar"><button data-demo="toast">Move to the trash</button></p>`,
  extra: [['JavaScript', 'js', `
import { toast } from '@xoong/ui';

toast.show({ message: 'Article moved to the trash', action: { label: 'Undo', run: () => restore() } });`]],
})}

<h2>Behaviour and accessibility</h2>
<ul>
<li><strong>Native.</strong> Each dialog is a <code>&lt;dialog&gt;</code> opened with <code>showModal()</code>: it is in the top layer, the page behind is inert, Tab stays inside, and Escape closes it. When it closes the browser returns the focus to the element that opened it.</li>
<li><strong>Names.</strong> The built-in dialogs are <code>role="alertdialog"</code>. The title (or the message, when there is no title) is the name and the message is the description. <code>&lt;xo-dialog heading&gt;</code> is named by its heading.</li>
<li><strong>Where the focus starts.</strong> Cancel for a question, OK for a notice, the field for a prompt, the <code>cancel</code> button (else the primary one) for <code>ask()</code>.</li>
<li><strong>One at a time.</strong> A built-in dialog that opens while another is showing answers the first one "no" and takes its place. Modals made with <code>&lt;xo-dialog&gt;</code> stack like any native modals.</li>
<li><strong>The icon is decoration.</strong> The kind is conveyed by the icon, the colour <em>and</em> the words you write, never by colour alone.</li>
<li><strong>Without <code>@xoong/ui</code></strong> the question behind <code>xo-confirm</code> falls back to the browser's own <code>confirm()</code>, which headless browsers dismiss silently, so import it.</li>
</ul>
<h3>Texts and languages</h3>
<p>Every built-in text is a catalog key (<code>xoong.confirm.ok</code>, <code>xoong.confirm.cancel</code>, <code>xoong.dialog.ok</code>, <code>xoong.dialog.close</code>), Vietnamese included. For one call pass <code>ok</code> and <code>cancel</code>; for the whole app set <code>confirmLabels.ok = 'Delete'</code>.</p>
<h3>Your own dialog</h3>
<p>To draw the question yourself, for <code>xo-confirm</code> and for the leave-this-page question of a dirty form, install a replacement; resolve to <code>true</code> to go on.</p>
${tabs('setConfirm', [['JavaScript', 'js', `
import { setConfirm } from '@xoong/ui';

setConfirm(async (message, context) => {
  // context: { kind: 'action', element } for xo-confirm, { kind: 'leave', forms } for the leave guard
  return myDialog(message);
});`]])}
<h3>In tests</h3>
<p>Happy-dom has no <code>showModal()</code>; xoong then sets the <code>open</code> attribute instead, so a test finds <code>dialog.xo-confirm</code>, reads its text and clicks its buttons like any other markup: <code>screen.$('dialog.xo-confirm .xo-confirm-ok').click()</code>.</p>
${callout('info', 'Look and feel: the dialogs follow the page\'s tokens (<code>--xo-color-*</code>, <code>--xo-radius</code>) and the palette. Style <code>.xo-confirm</code> for the built-in questions and <code>.xo-modal</code> for titled modals.')}
`,
};
