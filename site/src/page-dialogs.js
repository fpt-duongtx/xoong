// The dialogs page: each button calls one of the built-in dialogs of @xoong/ui and writes the answer next to it.
import { confirm, alert, prompt, ask, toast } from '@xoong/ui';

const show = (id, value) => { document.querySelector(`#${id}`).textContent = typeof value === 'string' ? `"${value}"` : String(value); };

const demos = {
  'confirm-plain': async () => show('out-confirm', await confirm('Discard the draft?')),
  'confirm-danger': async () => show('out-confirm', await confirm('The 14 articles in it are deleted too.', { kind: 'danger', title: 'Delete project?', ok: 'Delete' })),
  'confirm-warning': async () => show('out-confirm', await confirm('The page was edited by someone else since you opened it.', { kind: 'warning', title: 'Publish over newer changes?', ok: 'Publish anyway' })),
  'confirm-info': async () => show('out-confirm', await confirm('Subscribers get an e-mail about this post.', { kind: 'info', title: 'Publish now?', ok: 'Publish' })),

  'alert-info': async () => { await alert('We e-mail you when the file is ready.', { title: 'Export started' }); show('out-alert', 'closed'); },
  'alert-success': async () => { await alert('Your changes are live.', { kind: 'success', title: 'Published' }); show('out-alert', 'closed'); },
  'alert-warning': async () => { await alert('Two of the five images have no description.', { kind: 'warning', title: 'Saved with warnings' }); show('out-alert', 'closed'); },
  'alert-error': async () => { await alert('The file is larger than 10 MB.', { kind: 'danger', title: 'Upload failed', detail: 'Choose a smaller file and try again.' }); show('out-alert', 'closed'); },

  'prompt': async () => show('out-prompt', await prompt('Name this view', { title: 'Save view', label: 'Name', value: 'My view' })),
  'prompt-required': async () => show('out-prompt', await prompt('Where should the link point?', { title: 'Add link', label: 'Address', type: 'url', placeholder: 'https://', required: true })),

  'ask': async () => show('out-ask', await ask('You have unsaved changes.', {
    kind: 'warning', title: 'Leave this page?',
    buttons: [{ label: "Don't save", value: 'discard', danger: true }, { label: 'Keep editing', value: 'stay', cancel: true }, { label: 'Save and leave', value: 'save', primary: true }],
  })),

  'toast': () => toast.show({ message: 'Article moved to the trash', action: { label: 'Undo', run: () => toast.show({ message: 'Restored' }) } }),
};
document.addEventListener('click', (event) => { const button = event.target.closest?.('[data-demo]'); if (button) demos[button.dataset.demo]?.(); });

// A modal dialog tells how it was closed with the value of the button (`<button value="save">` in a form with method="dialog", or xo-close value="...").
for (const dialog of document.querySelectorAll('xo-dialog[data-out]')) {
  dialog.addEventListener('close', (event) => show(dialog.dataset.out, event.target.returnValue || 'dismissed'), true); // `close` does not bubble: listen while it passes down
}
