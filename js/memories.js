// memories.js — timeline by month + saved creations.
import "./nav.js";
import { supabase, notConnectedMessage } from "./supabaseClient.js";
import { escapeHtml, formatDate, monthsaryDate, toast } from "./utils.js";
import { createSharedPost, imageDataUrl, postUrl, renderShareResult, safeImageUrl } from "./sharing.js";

const $ = (id) => document.getElementById(id);
let creations = [];
let communityPosts = [];
let activeFilter = "all";
let communityUnavailable = false;

async function main() {
  if (!supabase) { $("mem-status").textContent = notConnectedMessage(); return; }
  const [mem, cre, shared] = await Promise.all([
    supabase.from("memories").select("*").order("month_number").order("date"),
    supabase.from("creations").select("*").order("created_at", { ascending: false }),
    supabase.from("shared_posts").select("slug,kind,title,payload,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  if (mem.error || cre.error) { $("mem-status").textContent = "Couldn't load memories right now. Check your internet connection."; return; }
  renderTimeline(mem.data);
  creations = cre.data;
  renderCreations(activeFilter);
  if (shared.error) {
    console.error("Could not load community creations.", shared.error);
    communityUnavailable = true;
    renderCommunity([], activeFilter);
  } else {
    renderCommunity(shared.data, activeFilter);
  }
}

$("memory-post-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const file = $("memory-post-image").files[0];
    const payload = {
      body: $("memory-post-body").value.trim(),
      image: file ? await imageDataUrl(file) : null,
    };
    const shared = await createSharedPost("memory", $("memory-post-title").value.trim(), payload);
    renderShareResult($("memory-share-result"), shared);
    event.target.reset();
    toast("Your memory is now public");
    const { data, error } = await supabase.from("shared_posts")
      .select("slug,kind,title,payload,created_at").eq("slug", shared.slug).single();
    if (error) throw error;
    renderCommunity([data, ...communityPosts.filter(post => post.slug !== data.slug)], activeFilter);
  } catch (error) {
    console.error("Could not publish the memory.", error);
    toast("Publishing failed: " + error.message);
  } finally {
    button.disabled = false;
  }
});

function renderTimeline(rows) {
  if (!rows.length) { $("mem-status").textContent = "Our first memories are still being pinned up"; return; }
  $("mem-status").textContent = "";
  // Group rows into { monthNumber: [rows] }
  const groups = rows.reduce((acc, r) => ((acc[r.month_number] ??= []).push(r), acc), {});
  $("timeline").innerHTML = Object.entries(groups).map(([n, list]) => `
    <section class="month" aria-labelledby="m-${n}">
      <h2 id="m-${n}">${Number(n) === 0 ? "The beginning" : `Month ${n}`}</h2>
      <p class="month__date">${formatDate(monthsaryDate(Number(n)))}</p>
      <div class="mem-grid">
        ${list.map(m => `
          <button class="memory-card" type="button" aria-pressed="false"
            aria-label="Flip to reveal details for ${escapeHtml(m.title)}">
            <span class="memory-card__inner">
              <span class="memory-card__face memory-card__front" aria-hidden="false">
                ${m.photo_url
                  ? `<img src="${escapeHtml(m.photo_url)}" alt="" loading="lazy">`
                  : `<span class="memory-card__placeholder">A little note</span>`}
                <span class="memory-card__title">${escapeHtml(m.title)}</span>
                ${m.date ? `<span class="memory-card__date">${formatDate(m.date)}</span>` : ""}
                <span class="memory-card__hint">Tap to flip</span>
              </span>
              <span class="memory-card__face memory-card__back" aria-hidden="true">
                <span class="memory-card__back-title">${escapeHtml(m.title)}</span>
                ${m.date ? `<span class="memory-card__date">${formatDate(m.date)}</span>` : ""}
                <span class="memory-card__note">${m.note ? escapeHtml(m.note) : "A little moment to keep close."}</span>
                <span class="memory-card__hint">Tap to flip back</span>
              </span>
            </span>
          </button>`).join("")}
      </div>
    </section>`).join("");
}

// A card can be flipped with a tap, click, or keyboard activation.
$("timeline").addEventListener("click", (e) => {
  const card = e.target.closest(".memory-card");
  if (!card) return;
  const flipped = card.getAttribute("aria-pressed") !== "true";
  card.setAttribute("aria-pressed", String(flipped));
  card.setAttribute("aria-label", `${flipped ? "Show front" : "Reveal details"} for ${card.querySelector(".memory-card__title").textContent}`);
  card.querySelector(".memory-card__front").setAttribute("aria-hidden", String(flipped));
  card.querySelector(".memory-card__back").setAttribute("aria-hidden", String(!flipped));
});

function renderCreations(filter) {
  const list = creations.filter(c => filter === "all" || c.type === filter);
  $("cre-grid").innerHTML = list.length ? list.map(c => `
    <figure class="polaroid">
      <img src="${escapeHtml(c.image_url)}" alt="${c.type === "bouquet" ? "A bouquet" : "A photo strip"} made on ${formatDate(c.created_at)}" loading="lazy">
      <figcaption>${formatDate(c.created_at)}</figcaption>
    </figure>`).join("") : `<p class="hint">Nothing here yet. Make a bouquet or a photo strip!</p>`;
}

function renderCommunity(posts, filter) {
  communityPosts = posts;
  const grid = $("community-grid");
  grid.replaceChildren();
  if (communityUnavailable) {
    $("community-status").textContent = "Community posts couldn't be loaded. Please try again later.";
    return;
  }
  const visiblePosts = posts.filter(post => filter === "all" || post.kind === filter);
  const kindLabel = filter === "bouquet" ? "bouquet" : "photo strip";
  $("community-status").textContent = filter === "all"
    ? visiblePosts.length ? `${visiblePosts.length} recent public post${visiblePosts.length === 1 ? "" : "s"}` : "No community posts yet. Share a memory, letter, bouquet or photo strip!"
    : visiblePosts.length ? `${visiblePosts.length} recent public ${kindLabel}${visiblePosts.length === 1 ? "" : "s"}`
      : `No public ${kindLabel}s yet.`;
  visiblePosts.forEach(post => {
    const link = document.createElement("a");
    link.className = "community-card polaroid";
    link.href = postUrl(post.slug);
    const image = safeImageUrl(post.payload?.image);
    if (image) {
      const preview = document.createElement("img");
      preview.src = image;
      preview.alt = `${post.title} — ${post.kind === "bouquet" ? "shared bouquet" : post.kind === "photostrip" ? "shared photo strip" : "shared image"}`;
      preview.loading = "lazy";
      link.append(preview);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "community-card__placeholder";
      placeholder.textContent = post.title;
      link.append(placeholder);
    }
    const caption = document.createElement("figcaption");
    caption.textContent = post.title;
    link.append(caption);
    grid.append(link);
  });
}

$("cre-filter").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  document.querySelectorAll("#cre-filter button").forEach(x => {
    const on = x === b; x.setAttribute("aria-pressed", String(on)); x.classList.toggle("btn--ghost", !on);
  });
  activeFilter = b.dataset.f;
  renderCreations(activeFilter);
  renderCommunity(communityPosts, activeFilter);
});

main();
