// The animated diagrams (figure.dg-anim, drawn by tools/site/diagrams.mjs): a Pause / Play button in each caption row, and the rules for when they move.
// The packets are SVG animations (SMIL) in one cycle per figure; this file only starts, pauses and stops that clock.
//   - A figure moves only while it is on screen, and it starts from its first step each time it comes into view.
//   - A reader who prefers reduced motion gets a still figure (the dots are hidden by site.css) with a Play button: pressing it is the reader's own choice.
//   - Without script, or in a browser without SMIL, the figure is the still diagram and nothing is hidden or broken.

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

for (const figure of document.querySelectorAll('figure.dg-anim')) {
  const svg = figure.querySelector('svg');
  const caption = figure.querySelector('.dg-cap');
  if (!svg || !caption || typeof svg.pauseAnimations !== 'function') continue;
  const name = svg.querySelector('title')?.textContent ?? 'diagram';

  svg.pauseAnimations(); // nothing moves until the figure is on screen
  figure.classList.add('dg-live'); // site.css shows the moving layer (and the sentence about it) only from now on

  let wanted = !reduced.matches; // what the reader asked for: play or pause
  let visible = false; // is the diagram on screen?
  let started = false;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sm dg-toggle';

  const update = () => {
    if (wanted && visible) {
      if (!started) { svg.setCurrentTime(0); started = true; } // the first time: from the first step
      svg.unpauseAnimations();
    } else svg.pauseAnimations();
    button.textContent = wanted ? 'Pause' : 'Play';
    button.setAttribute('aria-label', `${wanted ? 'Pause' : 'Play'} the animation: ${name}`);
  };

  button.addEventListener('click', () => {
    wanted = !wanted;
    if (wanted && reduced.matches) figure.classList.add('dg-opt'); // a reader who asked for less motion pressed Play: show the dots
    update();
  });
  reduced.addEventListener('change', () => { // the setting changed while the page was open
    wanted = !reduced.matches;
    figure.classList.remove('dg-opt');
    update();
  });

  caption.append(button);
  const frame = figure.querySelector('.dg-scroll') ?? figure;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: 0.2 }).observe(frame);
  } else {
    visible = true;
  }
  update();
}
