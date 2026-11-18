// Injects a stand-in site header and the practice tabs, and applies
// ?theme=light|dark so the gallery can switch every mock at once.
const theme = new URLSearchParams(location.search).get("theme");
if (theme) document.documentElement.dataset.theme = theme;

const TABS = [
  ["catalogue", "Exercises"],
  ["drills", "Function practice"],
  ["tracks", "Learning tracks"],
  ["interview", "Interview prep"],
  ["daily", "Daily exercise"],
  ["mock", "Mock assessments"],
  ["progress", "Progress"],
];
const active = document.body.dataset.tab;
document.body.insertAdjacentHTML(
  "afterbegin",
  `<header class="m-header"><div class="container">
    <span class="m-logo"><i></i>Excel Exercises</span>
    <span class="m-search">Search exercises and functions</span>
    <nav class="m-nav"><span>Practice</span><span>Learn</span><span>Pricing</span><span>Log in</span></nav>
    <span class="button button-primary">Sign up</span>
  </div></header>
  <div class="container"><nav class="m-tabs">${TABS.map(
    ([id, label]) => `<a href="#"${id === active ? ' aria-current="page"' : ""}>${label}</a>`,
  ).join("")}</nav></div>`,
);
// On a phone the tab row scrolls; bring the current tab into view.
const tabs = document.querySelector(".m-tabs");
const current = tabs.querySelector("[aria-current]");
if (current) tabs.scrollLeft = current.offsetLeft - (tabs.clientWidth - current.offsetWidth) / 2;
