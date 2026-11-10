// library.js — bookshelf, search/filter, and a page-turning book reader.
// Search is a simple "contains" check; no extra library needed for a few hundred items.
import "./nav.js";
import { supabase, notConnectedMessage } from "./supabaseClient.js";
import { escapeHtml, formatDate, prefersReducedMotion, toast } from "./utils.js";
import { createSharedPost, imageDataUrl, renderShareResult } from "./sharing.js";

const $ = (id) => document.getElementById(id);
const COLORS = ["#F8D7DA", "#B7C9A8", "#E3C9A8", "#FFF8F0", "#E8A9B0", "#E3ECDB"];
let items = [];

async function main() {
  if (!supabase) { $("lib-status").textContent = notConnectedMessage(); return; }
  const { data, error } = await supabase.from("library_items").select("*").order("written_on", { ascending: false, nullsFirst: false });
  if (error) { $("lib-status").textContent = "The library door is stuck 🥺 Check your internet and refresh."; return; }
  items = data;
  const tags = [...new Set(items.flatMap(i => i.tags))].sort();
  $("tag").innerHTML += tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  render();
}

// A stable "random" number from text, so each book keeps the same colour/height.
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function filtered() {
  const q = $("q").value.trim().toLowerCase();
  const tag = $("tag").value, from = $("from").value, to = $("to").value;
  return items.filter(i =>
    (!q || [i.title, i.content || "", i.tags.join(" ")].join(" ").toLowerCase().includes(q)) &&
    (!tag || i.tags.includes(tag)) &&
    (!from || (i.written_on && i.written_on >= from)) &&
    (!to || (i.written_on && i.written_on <= to)));     // "YYYY-MM-DD" strings compare correctly
}

function render() {
  const list = filtered();
  $("lib-status").textContent = items.length === 0 ? "The shelves are empty for now… new books coming soon"
    : list.length === 0 ? "No books match that search 🔍" : `${list.length} book${list.length === 1 ? "" : "s"} on the shelf`;
  $("shelf").innerHTML = list.map(i => {
    const h = hash(i.id);
    return `<button class="spine" data-id="${i.id}" style="--c:${COLORS[h % COLORS.length]};--h:${160 + (h % 50)}px"
      aria-label="Open ${escapeHtml(i.title)}${i.written_on ? ", written " + formatDate(i.written_on) : ""}">${escapeHtml(i.title)}</button>`;
  }).join("");
}
["q", "tag", "from", "to"].forEach(id => $(id).addEventListener("input", render));

// ---------- Book reader ----------
const book = $("book");
let pages = [], pageIndex = 0;

// Break long text into ~page-sized chunks at paragraph boundaries.
function paginate(text, max = 750) {
  const out = []; let cur = "";
  for (let para of text.split(/\n{2,}/)) {
    while (para.length > max) {                       // very long paragraph: hard split at a space
      const cut = para.lastIndexOf(" ", max) > 0 ? para.lastIndexOf(" ", max) : max;
      if (cur) { out.push(cur); cur = ""; }
      out.push(para.slice(0, cut)); para = para.slice(cut).trim();
    }
    if ((cur + "\n\n" + para).length > max && cur) { out.push(cur); cur = para; }
    else cur = cur ? cur + "\n\n" + para : para;
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}

const isSpread = () => window.innerWidth >= 820;
const step = () => (isSpread() ? 2 : 1);

function showPages(animate) {
  const el = $("book-pages");
  el.classList.toggle("is-spread", isSpread());
  const visible = pages.slice(pageIndex, pageIndex + step());
  el.innerHTML = visible.map((p, k) => `<div class="page">${p}<span class="page__num">${pageIndex + k + 1}</span></div>`).join("");
  $("page-count").textContent = `Page ${pageIndex + 1}${visible.length > 1 ? "–" + (pageIndex + 2) : ""} of ${pages.length}`;
  $("prev").disabled = pageIndex === 0;
  $("next").disabled = pageIndex + step() >= pages.length;
  if (animate && !prefersReducedMotion()) { el.classList.remove("turn"); void el.offsetWidth; el.classList.add("turn"); }
}

function openBook(item) {
  $("book-title").textContent = item.title;
  const meta = `<em>${item.written_on ? "Written " + formatDate(item.written_on) : ""}${item.tags.length ? " · " + escapeHtml(item.tags.join(", ")) : ""}</em>`;
  if (item.type === "image") {
    pages = [`<img src="${escapeHtml(item.file_url)}" alt="${escapeHtml(item.title)}">`];
    if (item.content) pages.push(escapeHtml(item.content));
    pages[0] = meta + "\n" + pages[0];
  } else {
    pages = paginate(item.content || "").map(escapeHtml);
    pages[0] = meta + "\n\n" + pages[0];
  }
  pageIndex = 0;
  book.showModal();          // <dialog> handles focus trapping and Escape for us
  showPages(false);
}
function turn(dir) {
  const ni = pageIndex + dir * step();
  if (ni < 0 || ni >= pages.length) return;
  pageIndex = ni; showPages(true);
}

$("shelf").addEventListener("click", (e) => {
  const b = e.target.closest(".spine"); if (!b) return;
  openBook(items.find(i => i.id === b.dataset.id));
});
$("prev").addEventListener("click", () => turn(-1));
$("next").addEventListener("click", () => turn(1));
$("book-close").addEventListener("click", () => book.close());
book.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") turn(1); if (e.key === "ArrowLeft") turn(-1); });
// Swipe to turn pages on phones
let sx = null;
$("book-pages").addEventListener("pointerdown", (e) => (sx = e.clientX));
$("book-pages").addEventListener("pointerup", (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 50) turn(e.clientX < sx ? 1 : -1); sx = null; });
window.addEventListener("resize", () => { if (book.open) { pageIndex -= pageIndex % step(); showPages(false); } });

main();

$("library-post-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const file = $("library-post-image").files[0];
    const body = $("library-post-body").value.trim();
    if (!body && !file) throw new Error("Add some writing or choose an image first.");
    const tags = $("library-post-tags").value.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 10);
    const payload = {
      body,
      tags,
      image: file ? await imageDataUrl(file) : null,
    };
    const shared = await createSharedPost("library", $("library-post-title").value.trim(), payload);
    renderShareResult($("library-share-result"), shared);
    event.target.reset();
    toast("Your post is now public");
  } catch (error) {
    console.error("Could not publish the library post.", error);
    toast("Publishing failed: " + error.message);
  } finally {
    button.disabled = false;
  }
});
