// nav.js: builds the top bar (brand + desktop links) and the phone tab bar on every page.
// import.meta.url is this file's own address; one folder up is the site root.
// That works on localhost AND on GitHub Pages (which adds /repo-name/ to the URL).
import { icon } from "./icons.js";
const ROOT = new URL("../", import.meta.url);

const LINKS = [
  { href: "index.html",            icon: "home",   label: "Home" },
  { href: "pages/letters.html",    icon: "letter", label: "Letters" },
  { href: "pages/bouquet.html",    icon: "flower", label: "Bouquet" },
  { href: "pages/photobooth.html", icon: "camera", label: "Photobooth" },
  { href: "pages/memories.html",   icon: "frame",  label: "Memories" },
  { href: "pages/library.html",    icon: "book",   label: "Library" },
];

function buildNav() {
  const here = location.pathname.replace(/\/$/, "/index.html");
  const link = (l, inner) => {
    const url = new URL(l.href, ROOT);
    const current = url.pathname === here ? ' aria-current="page"' : "";
    return `<a href="${url}"${current}>${inner}</a>`;
  };

  // 1) Top bar: brand on the left, text links on desktop
  const top = document.createElement("header");
  top.className = "navbar";
  top.innerHTML = `
    <div class="navbar__inner">
      <a class="navbar__brand" href="${new URL("index.html", ROOT)}">Dafny’s Diary in Bloom</a>
      <nav aria-label="Main"><ul class="navbar__links">
        ${LINKS.map(l => `<li>${link(l, l.label)}</li>`).join("")}
      </ul></nav>
    </div>`;

  // 2) Tab bar: icon + label, phones only (CSS hides it on desktop)
  const tabs = document.createElement("nav");
  tabs.className = "tabbar";
  tabs.setAttribute("aria-label", "Rooms");
  tabs.innerHTML = LINKS.map(l => link(l, `<span class="tab__icon">${icon(l.icon)}</span>${l.label}`)).join("");

  document.body.prepend(top);
  document.body.append(tabs);
}
buildNav();