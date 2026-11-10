// library.js — bookshelf, search/filter, and a page-turning book reader.
// Search is a simple "contains" check; no extra library needed for a few hundred items.
import "./nav.js";
import { supabase, notConnectedMessage } from "./supabaseClient.js";
import { escapeHtml, formatDate, prefersReducedMotion, toast } from "./utils.js";
import { createSharedPost, imageDataUrl, renderShareResult, safeImageUrl } from "./sharing.js";

const $ = (id) => document.getElementById(id);
const COLORS = ["#F8D7DA", "#B7C9A8", "#E3C9A8", "#FFF8F0", "#E8A9B0", "#E3ECDB"];
let items = [];
let communityUnavailable = false;

async function main() {
  if (!supabase) { $("lib-status").textContent = notConnectedMessage(); return; }
  const [curated, shared] = await Promise.all([
    supabase.from("library_items").select("*").order("written_on", { ascending: false, nullsFirst: false }),
    supabase.from("shared_posts").select("slug,title,payload,created_at")
      .eq("kind", "library").order("created_at", { ascending: false }),
  ]);
  if (curated.error) {
    $("lib-status").textContent = "The library couldn't load. Check your internet and try again.";
    console.error("Could not load library books.", curated.error);
    return;
  }
  items = curated.data.map(item => ({
    ...item,
    tags: Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === "string") : [],
    shared: false,
  }));
  if (shared.error) {
    communityUnavailable = true;
    console.error("Could not load community library books.", shared.error);
  } else {
    items.push(...shared.data.map(communityBook));
  }
  updateTagOptions();
  render();
}

function communityBook(post) {
  const payload = post.payload && typeof post.payload === "object" && !Array.isArray(post.payload) ? post.payload : {};
  const image = safeImageUrl(payload.image);
  return {
    id: `community-${post.slug}`,
    slug: post.slug,
    title: post.title,
    content: typeof payload.body === "string" ? payload.body : "",
    tags: Array.isArray(payload.tags) ? payload.tags.filter(tag => typeof tag === "string") : [],
    written_on: typeof post.created_at === "string" ? post.created_at.slice(0, 10) : null,
    type: image ? "image" : "text",
    file_url: image,
    shared: true,
  };
}

function updateTagOptions() {
  const tags = [...new Set(items.flatMap(item => item.tags))].sort((a, b) => a.localeCompare(b));
  $("tag").innerHTML = `<option value="">All tags</option>${tags.map(tag =>
    `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")}`;
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
  const message = items.length === 0 ? "The shelves are empty for now… new books coming soon"
    : list.length === 0 ? "No books match those filters" : `${list.length} book${list.length === 1 ? "" : "s"} on the shelf`;
  $("lib-status").textContent = communityUnavailable ? `${message}. Community books couldn't be loaded.` : message;
  $("shelf").innerHTML = list.map(i => {
    const h = hash(i.id);
    return `<button class="spine" data-id="${escapeHtml(String(i.id))}" style="--c:${COLORS[h % COLORS.length]};--h:${160 + (h % 50)}px"
      aria-label="Open ${escapeHtml(i.title)}${i.written_on ? ", written " + formatDate(i.written_on) : ""}">${escapeHtml(i.title)}</button>`;
  }).join("");
}
["q", "tag", "from", "to"].forEach(id => {
  $(id).addEventListener("input", render);
  $(id).addEventListener("change", render);
});

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
  el.innerHTML = visible.length
    ? visible.map((p, k) => `<div class="page">${p}<span class="page__num">${pageIndex + k + 1}</span></div>`).join("")
    : `<div class="page reading-empty">Choose a book from the shelf to read it here.</div>`;
  $("page-count").textContent = pages.length
    ? `Page ${pageIndex + 1}${visible.length > 1 ? "–" + (pageIndex + 2) : ""} of ${pages.length}`
    : "Choose a book";
  $("prev").disabled = !pages.length || pageIndex === 0;
  $("next").disabled = !pages.length || pageIndex + step() >= pages.length;
  if (animate && !prefersReducedMotion()) { el.classList.remove("turn"); void el.offsetWidth; el.classList.add("turn"); }
}

function openBook(item) {
  if (!item) return;
  $("book-title").textContent = item.title;
  $("book-close").hidden = false;
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const meta = `<em>${item.written_on ? "Written " + formatDate(item.written_on) : ""}${tags.length ? " · " + escapeHtml(tags.join(", ")) : ""}</em>`;
  if (item.type === "image") {
    pages = [`<img src="${escapeHtml(item.file_url)}" alt="${escapeHtml(item.title)}">`];
    if (item.content) pages.push(escapeHtml(item.content));
    pages[0] = meta + "\n" + pages[0];
  } else {
    pages = paginate(item.content || "").map(escapeHtml);
    pages[0] = meta + "\n\n" + pages[0];
  }
  pageIndex = 0;
  book.scrollIntoView({ behavior: "smooth", block: "start" });
  showPages(false);
}
function turn(dir) {
  const ni = pageIndex + dir * step();
  if (ni < 0 || ni >= pages.length) return;
  pageIndex = ni;
  showPages(true);
}

$("shelf").addEventListener("click", (e) => {
  const b = e.target.closest(".spine"); if (!b) return;
  openBook(items.find(i => i.id === b.dataset.id));
});
$("prev").addEventListener("click", () => turn(-1));
$("next").addEventListener("click", () => turn(1));
$("book-close").addEventListener("click", () => {
  pages = [];
  pageIndex = 0;
  $("book-title").textContent = "Choose a book from the shelf";
  $("book-close").hidden = true;
  showPages(false);
});
book.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") turn(1); if (e.key === "ArrowLeft") turn(-1); });
// Swipe to turn pages on phones
let sx = null;
$("book-pages").addEventListener("pointerdown", (e) => (sx = e.clientX));
$("book-pages").addEventListener("pointerup", (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 50) turn(e.clientX < sx ? 1 : -1); sx = null; });
window.addEventListener("resize", () => {
  if (pages.length) {
    pageIndex -= pageIndex % step();
    showPages(false);
  }
});

showPages(false);
main();

$("library-post-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const file = $("library-post-image").files[0];
    const body = $("library-post-body").value.trim();
    if (!body && !file) throw new Error("Add some writing or choose an image first.");
    const title = $("library-post-title").value.trim();
    const tags = $("library-post-tags").value.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 10);
    const payload = {
      body,
      tags,
      image: file ? await imageDataUrl(file) : null,
    };
    const shared = await createSharedPost("library", title, payload);
    items.unshift(communityBook({ slug: shared.slug, title, payload, created_at: new Date().toISOString() }));
    communityUnavailable = false;
    updateTagOptions();
    render();
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
