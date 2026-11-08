// The rich text page: a start value, the media hook and a live view of the sanitised value.
const editor = document.querySelector('#demo-editor');
const out = document.querySelector('#rt-out');
const START = '<h2>Release notes</h2><p>Write <strong>bold</strong>, <em>italic</em> and <u>underlined</u> text, add a <a href="https://example.org">link</a> or a list:</p><ul><li>one</li><li>two</li></ul>';

const show = () => { out.textContent = editor.value; };
customElements.whenDefined('xo-richtext').then(() => {
  editor.value = START;
  show();
});
editor.addEventListener('input', show);

// The image tool asks the app: open your own library, then call insert() now or later.
editor.addEventListener('xo-pick-media', (event) => {
  event.preventDefault();
  const src = new URL('../img/landscape.svg', import.meta.url).pathname;
  event.detail.insert({ src, alt: 'A landscape' });
});

document.querySelector('#expand').addEventListener('click', () => editor.expand());
document.querySelector('#reset').addEventListener('click', () => { editor.value = START; show(); });
