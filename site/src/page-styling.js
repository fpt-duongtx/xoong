// The styling page: set tokens on the sample panel with the CSS object model (allowed under a strict CSP).
const panel = document.querySelector('#playground');
const set = (name, value) => panel.style.setProperty(name, value);

document.querySelector('#p-accent').addEventListener('input', (e) => set('--xo-color-accent', e.target.value));
document.querySelector('#p-radius').addEventListener('input', (e) => {
  set('--xo-radius', `${e.target.value / 16}rem`);
  document.querySelector('#p-radius-out').textContent = `${e.target.value}px`;
});
document.querySelector('#p-scheme').addEventListener('change', (e) => set('color-scheme', e.target.value));
