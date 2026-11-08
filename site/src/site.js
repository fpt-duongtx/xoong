// Every page: the controls (the code tabs are <xo-tabs>) and a Copy button on each code block.
import '@xoong/controls';

for (const pre of document.querySelectorAll('pre[data-lang]')) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy the code');
  button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pre.querySelector('code').textContent); button.textContent = 'Copied'; } catch { button.textContent = 'Press Ctrl+C'; }
    setTimeout(() => { button.textContent = 'Copy'; }, 1600);
  });
  pre.append(button);
}
