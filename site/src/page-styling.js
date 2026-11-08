// The styling page: set tokens on the sample panel with the CSS object model (allowed under a strict CSP).
const panel = document.querySelector('#playground');
const set = (name, value) => panel.style.setProperty(name, value);

// The colour picker starts at the live accent token (the palette's), not at a literal.
const live = document.createElement('span');
live.style.color = 'var(--xo-color-accent)';
document.body.append(live);
const [r, g, b] = getComputedStyle(live).color.match(/\d+/g).map(Number);
live.remove();
document.querySelector('#p-accent').value = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

document.querySelector('#p-accent').addEventListener('input', (e) => set('--xo-color-accent', e.target.value));
document.querySelector('#p-radius').addEventListener('input', (e) => {
  set('--xo-radius', `${e.target.value / 16}rem`);
  document.querySelector('#p-radius-out').textContent = `${e.target.value}px`;
});
document.querySelector('#p-scheme').addEventListener('change', (e) => set('color-scheme', e.target.value));
