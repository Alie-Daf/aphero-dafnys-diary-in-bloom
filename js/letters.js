// letters.js — Letter Room: list letters, "Open when…" envelopes, and the composer.
import "./nav.js";
import { supabase, notConnectedMessage } from "./supabaseClient.js";
import { getUser } from "./auth.js";
import { escapeHtml, spotifyEmbedUrl, spotifyIframe, toast, formatDate } from "./utils.js";
import { PAPERS, FONTS, STICKERS, OPEN_WHEN, ENVELOPES, SEALS, SEAL_ICONS, parseTheme, letterHtml } from "./letterTheme.js";
import { icon } from "./icons.js";
import { createSharedPost, renderShareResult } from "./sharing.js";

const $ = (id) => document.getElementById(id);
const form = $("letter-form");
let user = null;
let editId = null;            // when set, Save updates instead of inserting
let chosenStickers = [];
let lettersByMood = new Map();

// ---------- Build the composer controls from our shared lists ----------
$("openwhen").innerHTML += Object.entries(OPEN_WHEN).map(([k, v]) => `<option value="${k}">Open when ${v.label}</option>`).join("");
$("stickers").innerHTML = STICKERS.map(s =>
  `<button type="button" class="chip" aria-pressed="false" data-s="${s}" aria-label="Sticker ${s}">${icon(s)}</button>`).join("");
const label = (value) => value[0].toUpperCase() + value.slice(1);
$("paper-choices").innerHTML = PAPERS.map(p => `
  <button type="button" class="choice-card paper-choice" data-paper="${p.id}" aria-pressed="${p.id === $("paper").value}">
    <span class="paper-choice__sample paper--${p.id}"></span>${p.label}
  </button>`).join("");
$("font-choices").innerHTML = FONTS.map(f => `
  <button type="button" class="choice-card font-choice" data-font="${f.id}" aria-pressed="${f.id === $("font").value}">
    <span class="font-choice__sample">Dear Dafny</span><small>${f.label}</small>
  </button>`).join("");
$("envelope-choices").innerHTML = Object.entries(ENVELOPES).map(([name, color]) => `
  <button type="button" class="swatch" data-envelope="${name}" aria-label="${label(name)} envelope paper"
    aria-pressed="${name === $("envelope").value}" style="background:${color}"></button>`).join("");
$("seal-icon-choices").innerHTML = SEAL_ICONS.map(name => `
  <button type="button" class="seal-choice" data-seal-icon="${name}" aria-label="${label(name)} wax seal"
    aria-pressed="${name === $("seal-icon").value}">${icon(name)}</button>`).join("");
$("seal-color-choices").innerHTML = Object.entries(SEALS).map(([name, color]) => `
  <button type="button" class="swatch" data-seal="${name}" aria-label="${label(name)} seal colour"
    aria-pressed="${name === $("seal").value}" style="background:${color}"></button>`).join("");

function chooseValue(container, selector, input, dataKey, value) {
  $(container).querySelectorAll(selector).forEach(button => button.setAttribute("aria-pressed", String(button.dataset[dataKey] === value)));
  $(input).value = value;
  renderPreview();
}
$("paper-choices").addEventListener("click", e => {
  const b = e.target.closest("[data-paper]"); if (b) chooseValue("paper-choices", "[data-paper]", "paper", "paper", b.dataset.paper);
});
$("font-choices").addEventListener("click", e => {
  const b = e.target.closest("[data-font]"); if (b) chooseValue("font-choices", "[data-font]", "font", "font", b.dataset.font);
});
$("envelope-choices").addEventListener("click", e => {
  const b = e.target.closest("[data-envelope]"); if (b) chooseValue("envelope-choices", "[data-envelope]", "envelope", "envelope", b.dataset.envelope);
});
$("seal-icon-choices").addEventListener("click", e => {
  const b = e.target.closest("[data-seal-icon]"); if (b) chooseValue("seal-icon-choices", "[data-seal-icon]", "seal-icon", "sealIcon", b.dataset.sealIcon);
});
$("seal-color-choices").addEventListener("click", e => {
  const b = e.target.closest("[data-seal]"); if (b) chooseValue("seal-color-choices", "[data-seal]", "seal", "seal", b.dataset.seal);
});
$("stickers").addEventListener("click", (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  const s = b.dataset.s;
  if (chosenStickers.includes(s)) chosenStickers = chosenStickers.filter(x => x !== s);
  else if (chosenStickers.length < 6) chosenStickers.push(s);
  else toast("You can add up to six stickers.");
  syncStickerButtons();
  renderPreview();
});
function syncStickerButtons() {
  document.querySelectorAll("#stickers .chip").forEach(b => b.setAttribute("aria-pressed", String(chosenStickers.includes(b.dataset.s))));
}

// Gather everything the form currently says into one object (same shape as a DB row).
function currentLetter() {
  return {
    title: $("title").value.trim(),
    body: $("body").value,
    font: $("font").value,
    song_url: spotifyEmbedUrl($("song").value) || null,
    open_when: $("openwhen").value || null,
    theme: JSON.stringify({ paper: $("paper").value, color: $("color").value, stickers: chosenStickers, envelope: $("envelope").value,
      seal: $("seal").value, sealIcon: $("seal-icon").value, recipient: $("recipient").value.trim(), sender: $("sender").value.trim() }),
  };
}

// ---------- Live preview: re-render on every keystroke ----------
function renderPreview() {
  const l = currentLetter();
  const previewLetter = { ...l, title: l.title || "A little note for you", body: l.body || "Write what is in your heart" };
  const theme = parseTheme(l.theme);
  $("preview").innerHTML = letterHtml(previewLetter);
  const front = $("preview-card").querySelector(".preview-card__front");
  front.classList.remove(...PAPERS.map(p => `paper--${p.id}`));
  front.classList.add(`paper--${theme.paper}`);
  $("preview-card").querySelector(".preview-card__eyebrow").textContent =
    `A letter for ${theme.recipient || "Dafny"}`;
  $("preview-card").querySelector(".preview-card__title").textContent = previewLetter.title;
  $("preview-card").querySelector(".preview-card__icon").innerHTML = icon("letter");
  $("envelope-art").style.setProperty("--env", ENVELOPES[$("envelope").value] || ENVELOPES.kraft);
  $("envelope-art").style.setProperty("--seal", SEALS[$("seal").value] || SEALS.rose);
  $("seal-preview").innerHTML = icon(SEAL_ICONS.includes($("seal-icon").value) ? $("seal-icon").value : "heart");
  $("send-preview").innerHTML = letterHtml(previewLetter);
  $("send-summary").innerHTML = `
    <p><strong>To</strong> ${escapeHtml($("recipient").value.trim() || "Dafny")}</p>
    ${$("sender").value.trim() ? `<p><strong>From</strong> ${escapeHtml($("sender").value.trim())}</p>` : ""}
    <p><strong>Open when</strong> ${escapeHtml(OPEN_WHEN[$("openwhen").value]?.label || "Anytime")}</p>
    <p><strong>Envelope</strong> ${escapeHtml(label($("envelope").value))} with ${escapeHtml(label(SEAL_ICONS.includes($("seal-icon").value) ? $("seal-icon").value : "heart"))} seal</p>
    <p><strong>Song</strong> ${l.song_url ? "Spotify track added" : "None"}</p>`;
  const raw = $("song").value.trim();
  $("spotify-preview").innerHTML = l.song_url ? spotifyIframe(l.song_url)
    : raw ? `<p class="hint">Hmm, that doesn't look like a Spotify link. In Spotify, tap Share → Copy link.</p>` : "";
}
form.addEventListener("input", renderPreview);

function showStep(step) {
  const number = Math.max(1, Math.min(4, Number(step)));
  $("letter-page-title").textContent = ["", "Write a letter", "Write a letter", "Envelope and seal", "Review and send"][number];
  $("letter-page-sub").hidden = true;
  document.querySelectorAll(".letter-step-panel").forEach(panel => {
    panel.hidden = Number(panel.dataset.panel) !== number;
  });
  document.querySelectorAll(".letter-step").forEach(button => {
    const active = Number(button.dataset.step) === number;
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  if (number === 4) renderPreview();
  $("letter-form").dataset.currentStep = String(number);
  if (window.matchMedia("(max-width: 819px)").matches) $("letter-page-title").scrollIntoView({ behavior: "smooth", block: "start" });
}
function openComposer(step = 1) {
  $("composer").hidden = false;
  $("openwhen-section").hidden = true;
  $("openwhen-collection").hidden = true;
  $("all-letters-section").hidden = true;
  $("start-letter").hidden = true;
  showStep(step);
}
function closeComposer() {
  $("composer").hidden = true;
  $("openwhen-section").hidden = false;
  $("openwhen-collection").hidden = true;
  $("all-letters-section").hidden = false;
  $("start-letter").hidden = false;
  $("letter-page-title").textContent = "Notes for you";
  $("letter-page-sub").hidden = false;
  $("letter-page-title").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("start-letter").addEventListener("click", () => openComposer());
$("back-to-letters").addEventListener("click", closeComposer);
document.querySelectorAll(".letter-step").forEach(button => button.addEventListener("click", () => showStep(button.dataset.step)));
document.querySelectorAll(".letter-next").forEach(button => button.addEventListener("click", () => showStep(Number(form.dataset.currentStep || 1) + 1)));
document.querySelectorAll(".letter-back").forEach(button => button.addEventListener("click", () => showStep(Number(form.dataset.currentStep || 1) - 1)));
$("preview-flip").addEventListener("click", () => {
  const flipped = $("preview-card").classList.toggle("is-flipped");
  $("preview-flip").setAttribute("aria-pressed", String(flipped));
  $("preview-flip").textContent = flipped ? "Flip card back" : "Flip card";
});
$("back-to-folders").addEventListener("click", () => {
  $("openwhen-collection").hidden = true;
  $("openwhen-section").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("openwhen-grid").addEventListener("click", event => {
  const folder = event.target.closest("[data-openwhen]");
  if (!folder) return;
  const mood = folder.dataset.openwhen;
  const info = OPEN_WHEN[mood];
  if (!info) return;

  const letters = lettersByMood.get(mood) || [];
  $("openwhen-collection-title").textContent = `Open when ${info.label}`;
  $("openwhen-collection-status").textContent = letters.length
    ? `${letters.length} ${letters.length === 1 ? "letter" : "letters"} in this folder`
    : "This folder is empty for now. Write a letter and choose this mood to add it.";
  $("openwhen-collection-list").innerHTML = renderLetterList(letters);
  $("openwhen-collection").hidden = false;
  $("openwhen-collection").scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---------- Load and show letters ----------
async function loadLetters() {
  if (!supabase) { $("letters-status").textContent = notConnectedMessage(); renderOpenWhen([]); return; }
  const [lettersResult, postsResult] = await Promise.all([
    supabase.from("letters").select("id,title,body,open_when,share_slug,created_at").order("created_at", { ascending: false }),
    supabase.from("shared_posts").select("slug,title,payload,created_at")
      .eq("kind", "letter").order("created_at", { ascending: false }),
  ]);
  if (lettersResult.error) { $("letters-status").textContent = "Couldn't load letters right now. Try refreshing."; console.error(lettersResult.error); return; }
  const data = lettersResult.data;
  const sharedLetters = postsResult.error ? [] : postsResult.data.map(post => ({
    ...post,
    open_when: post.payload?.open_when || null,
    body: typeof post.payload?.body === "string" ? post.payload.body : "",
    shared: true,
  }));
  if (postsResult.error) console.error("Could not load community letters.", postsResult.error);
  const normalized = value => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const letterKey = letter => JSON.stringify([
    normalized(letter.title),
    normalized(letter.body),
    letter.open_when || "",
  ]);
  const seenLetters = new Set(data.map(letterKey));
  const uniqueSharedLetters = sharedLetters.filter(letter => {
    const key = letterKey(letter);
    if (seenLetters.has(key)) return false;
    seenLetters.add(key);
    return true;
  });
  lettersByMood = new Map(Object.keys(OPEN_WHEN).map(mood => [mood, [
    ...data.filter(letter => letter.open_when === mood).map(letter => ({
      ...letter,
      href: `letter-view.html?slug=${encodeURIComponent(letter.share_slug)}`,
    })),
    ...uniqueSharedLetters.filter(letter => letter.open_when === mood).map(letter => ({
      ...letter,
      href: `post.html?slug=${encodeURIComponent(letter.slug)}`,
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))]));
  renderOpenWhen(data, uniqueSharedLetters);
  const regular = [
    ...data.filter(l => !l.open_when).map(l => ({ ...l, href: `letter-view.html?slug=${encodeURIComponent(l.share_slug)}` })),
    ...uniqueSharedLetters.filter(l => !l.open_when).map(l => ({ ...l, href: `post.html?slug=${encodeURIComponent(l.slug)}` })),
  ];
  $("letters-status").textContent = regular.length ? "" : "No letters yet… one is on its way";
  $("letter-list").innerHTML = renderLetterList(regular);
}

function renderLetterList(letters) {
  return letters.map(letter => `
    <li>
      <a class="open" href="${letter.href}"><span aria-hidden="true">${icon("letter")}</span>${escapeHtml(letter.title)}</a>
      <time datetime="${escapeHtml(letter.created_at)}">${formatDate(letter.created_at)}</time>
      ${user && !letter.shared ? `<a class="btn btn--small btn--ghost" href="?edit=${encodeURIComponent(letter.id)}">Edit</a>` : ""}
    </li>`).join("");
}

function renderOpenWhen(letters, sharedLetters = []) {
  $("openwhen-grid").innerHTML = Object.entries(OPEN_WHEN).map(([key, v]) => {
    const count = letters.filter(letter => letter.open_when === key).length
      + sharedLetters.filter(letter => letter.open_when === key).length;
    const inner = `<span class="icon-badge ow-card__icon" aria-hidden="true">${icon(v.icon)}</span><span class="ow-card__label">Open when ${v.label}</span>`;
    return `<button class="ow-card" type="button" data-openwhen="${key}" aria-label="Open when ${escapeHtml(v.label)} folder, ${count} ${count === 1 ? "letter" : "letters"}">
      ${inner}<span class="hint">${count} ${count === 1 ? "letter" : "letters"}</span>
    </button>`;
  }).join("");
}

// ---------- Edit mode (?edit=id) ----------
async function loadForEdit(id) {
  const { data, error } = await supabase.from("letters").select("*").eq("id", id).maybeSingle();
  if (error || !data) { toast("Couldn't find that letter to edit."); return; }
  editId = id;
  const th = parseTheme(data.theme);
  const font = data.font === "patrick" ? "playfair" : data.font;
  $("title").value = data.title; $("body").value = data.body;
  $("paper").value = th.paper; $("font").value = font; $("color").value = th.color;
  $("recipient").value = th.recipient || "Dafny"; $("sender").value = th.sender || "";
  $("song").value = data.song_url || ""; $("openwhen").value = data.open_when || "";
  chosenStickers = th.stickers || []; syncStickerButtons();
  $("envelope").value = th.envelope; $("seal").value = th.seal; $("seal-icon").value = th.sealIcon || "heart";
  [["paper-choices", "[data-paper]", "paper", th.paper], ["font-choices", "[data-font]", "font", font],
    ["envelope-choices", "[data-envelope]", "envelope", th.envelope], ["seal-color-choices", "[data-seal]", "seal", th.seal],
    ["seal-icon-choices", "[data-seal-icon]", "sealIcon", th.sealIcon || "heart"]].forEach(([container, selector, key, value]) => {
    $(container).querySelectorAll(selector).forEach(button => button.setAttribute("aria-pressed", String(button.dataset[key] === value)));
  });
  $("cancel-edit").hidden = false; $("cancel-edit").style.display = "";
  $("save-btn").textContent = "Update letter";
  openComposer(2);
  renderPreview();
  $("composer").scrollIntoView({ behavior: "smooth" });
}
$("cancel-edit").addEventListener("click", () => location.assign("letters.html"));
$("publish-letter").addEventListener("click", async () => {
  const letter = currentLetter();
  if (!letter.title) { $("title").focus(); return toast("Give your letter a title first."); }
  const button = $("publish-letter");
  button.disabled = true;
  try {
    const shared = await createSharedPost("letter", letter.title, letter);
    renderShareResult($("share-out"), shared);
    toast("Your letter is published on the Memory Wall.");
  } catch (error) {
    console.error("Could not publish the letter.", error);
    toast("Publishing failed: " + error.message);
  } finally {
    button.disabled = false;
  }
});

// ---------- Save ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabase) return toast(notConnectedMessage());
  if (!user) return toast("Only the site owner can save letters, but your preview is lovely");
  const letter = currentLetter();
  if (!letter.title) { $("title").focus(); return toast("Give your letter a title first."); }
  $("save-btn").disabled = true;
  const q = editId
    ? supabase.from("letters").update(letter).eq("id", editId).select().single()
    : supabase.from("letters").insert(letter).select().single();
  const { data, error } = await q;
  $("save-btn").disabled = false;
  if (error) { console.error(error); return toast("Saving failed" + error.message); }
  const link = new URL(`letter-view.html?slug=${data.share_slug}`, location.href).href;
  $("share-out").innerHTML = `Saved! Share link: <a href="${link}">${escapeHtml(link)}</a>`;
  navigator.clipboard?.writeText(link).then(() => toast("Saved, and the link is copied"), () => toast("Saved"));
  loadLetters();
});

// ---------- Start ----------
user = await getUser();
$("save-btn").hidden = !user;
if (user) $("composer-note").textContent = "You're logged in as admin. You can save a letter or publish it to the Community Wall.";
renderPreview();
await loadLetters();
const editParam = new URLSearchParams(location.search).get("edit");
if (editParam && user) loadForEdit(editParam);
