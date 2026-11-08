// The menu page: choosing an item runs it as it is (a handler, a link, xo-click); here a click handler notes it.
document.querySelector('#demo-menu').addEventListener('click', (e) => {
  const item = e.target.closest('button:not([xo-menu-trigger]), a');
  if (item) document.querySelector('#menu-out').textContent = item.textContent;
});
