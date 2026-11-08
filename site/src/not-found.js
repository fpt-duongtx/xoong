// The 404 page is served at the address that was not found: show it.
const path = document.querySelector('#lost-path');
if (path) path.textContent = location.pathname;
