// The animated diagrams (figure.dg-anim, drawn by tools/site/diagrams.mjs): a player under each one. It has a Pause / Play button, a slider with one numbered
// marker per step, and the sentence of the step, "Step 3 of 9: ...". The figure is one SVG clock (SMIL), so moving the slider is setCurrentTime(): the packets,
// the arrows and boxes that light up and the screen mock all follow. This file only starts, pauses, stops and moves that clock.
//   - A figure moves only while it is on screen, and it starts from its first step the first time it comes into view.
//   - The slider and the markers are the reader's own control: using one pauses the figure and shows that step. Play goes on from there.
//   - A reader who prefers reduced motion gets a still figure (site.css hides the dots and the changing screen); Play or the slider is that reader's choice.
//   - Without script, or in a browser without SMIL, the figure is the still diagram and nothing is hidden or broken.

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

for (const figure of document.querySelectorAll('figure.dg-anim')) {
  const svg = figure.querySelector('svg');
  const hint = figure.querySelector(':scope > .hint');
  if (!svg || !hint || typeof svg.pauseAnimations !== 'function') continue;
  const name = svg.querySelector('title')?.textContent ?? 'diagram';
  const dur = parseFloat(figure.dataset.dur) || 10;
  const steps = JSON.parse(figure.dataset.steps || '[]').map(([n, text, start, at]) => ({ n, text, start, at }));
  if (!steps.length) continue;

  svg.pauseAnimations(); // nothing moves until the figure is on screen
  figure.classList.add('dg-live'); // site.css shows the moving layer (and the sentence about it) only from now on

  let wanted = !reduced.matches; // what the reader asked for: play or pause
  let visible = false; // is the diagram on screen?
  let started = false;
  let current = 0;
  let frame = 0;

  // ---- the player ----
  const player = document.createElement('div');
  player.className = 'dg-player';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sm dg-toggle';
  const track = document.createElement('div');
  track.className = 'dg-track';
  const range = document.createElement('input');
  range.type = 'range';
  range.className = 'dg-range';
  range.min = '0';
  range.max = String(steps.length - 1);
  range.step = '1';
  range.value = '0';
  range.setAttribute('aria-label', `Steps: ${name}`);
  const marks = document.createElement('ol');
  marks.className = 'dg-marks';
  marks.setAttribute('aria-hidden', 'true'); // the slider is the control for assistive technology; the numbers are for the pointer
  const buttons = steps.map((step, i) => {
    const item = document.createElement('li');
    const mark = document.createElement('button');
    mark.type = 'button';
    mark.tabIndex = -1;
    mark.className = 'dg-mark';
    mark.textContent = step.n;
    mark.addEventListener('click', () => seek(i));
    item.append(mark);
    marks.append(item);
    return mark;
  });
  const say = document.createElement('p');
  say.className = 'dg-say';
  say.setAttribute('aria-hidden', 'true'); // the slider's value text says the same
  track.append(range, marks);
  player.append(button, track, say);
  hint.before(player);

  /** Show step `i` in the player: the slider, the markers, the sentence. */
  const show = (i) => {
    current = i;
    const text = `Step ${i + 1} of ${steps.length}: ${steps[i].text}`;
    range.value = String(i);
    range.style.setProperty('--v', steps.length > 1 ? String(i / (steps.length - 1)) : '0');
    range.setAttribute('aria-valuetext', text);
    say.replaceChildren();
    const head = document.createElement('b');
    head.textContent = `Step ${i + 1} of ${steps.length}: `;
    say.append(head, steps[i].text);
    buttons.forEach((mark, j) => {
      mark.classList.toggle('dg-done', j < i);
      if (j === i) mark.setAttribute('aria-current', 'step'); else mark.removeAttribute('aria-current');
    });
  };

  /** The step that is playing at time `t` of the cycle: the last one that has begun. */
  const stepAt = (t) => {
    let found = 0;
    steps.forEach((step, i) => { if (step.start <= t) found = i; });
    return found;
  };

  const tick = () => {
    frame = 0;
    if (!(wanted && visible)) return;
    const i = stepAt(svg.getCurrentTime() % dur);
    if (i !== current) show(i);
    frame = requestAnimationFrame(tick);
  };

  const update = () => {
    if (wanted && visible) {
      if (!started) { svg.setCurrentTime(0); started = true; } // the first time: from the first step
      svg.unpauseAnimations();
      if (!frame) frame = requestAnimationFrame(tick);
    } else svg.pauseAnimations();
    button.textContent = wanted ? 'Pause' : 'Play';
    button.setAttribute('aria-label', `${wanted ? 'Pause' : 'Play'} the animation: ${name}`);
  };

  /** The reader picked step `i`: pause there, and show it. */
  const seek = (i) => {
    wanted = false;
    started = true;
    if (reduced.matches) figure.classList.add('dg-opt'); // a reader who asked for less motion chose to look: show the dots and the screen
    svg.setCurrentTime(steps[i].at);
    show(i);
    update();
  };

  range.addEventListener('input', () => seek(Number(range.value)));
  button.addEventListener('click', () => {
    wanted = !wanted;
    if (wanted && reduced.matches) figure.classList.add('dg-opt');
    update();
  });
  reduced.addEventListener('change', () => { // the setting changed while the page was open
    wanted = !reduced.matches;
    figure.classList.remove('dg-opt');
    update();
  });

  show(0);
  const frameOfFigure = figure.querySelector('.dg-scroll') ?? figure;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: 0.2 }).observe(frameOfFigure);
  } else {
    visible = true;
  }
  update();
}
