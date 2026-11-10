import "./nav.js";
import { supabase } from "./supabaseClient.js";
import { formatDate, toast, spotifyEmbedUrl, spotifyIframe, prefersReducedMotion } from "./utils.js";
import { ownerToken, POST_KINDS, removeSharedPost, safeImageUrl } from "./sharing.js";
import { letterHtml, parseTheme, ENVELOPES, SEALS, SEAL_ICONS } from "./letterTheme.js";
import { icon } from "./icons.js";

const $ = id => document.getElementById(id);
const slug = new URLSearchParams(location.search).get("slug");
const status = $("post-status");
const content = $("post-content");
let post;

function addBody(text) {
  const body = document.createElement("p");
  body.className = "shared-post__body";
  body.textContent = text || "";
  content.append(body);
}

function addImage(value, alt) {
  const src = safeImageUrl(value);
  if (!src) return false;
  const image = document.createElement("img");
  image.className = "shared-post__image";
  image.src = src;
  image.alt = alt;
  image.loading = "lazy";
  content.append(image);
  return true;
}

function renderPost(row) {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  $("post-title").textContent = row.title;
  document.title = `${row.title} | Dafny's Diary in Bloom`;
  content.replaceChildren();

  if (row.kind === "letter") {
    const theme = parseTheme(payload.theme);
    const stage = $("shared-letter-stage");
    stage.hidden = false;
    stage.style.setProperty("--env", ENVELOPES[theme.envelope] || ENVELOPES.kraft);
    stage.style.setProperty("--seal", SEALS[theme.seal] || SEALS.rose);
    $("shared-letter-slot").innerHTML = letterHtml({
      title: row.title,
      body: typeof payload.body === "string" ? payload.body : "",
      font: payload.font,
      theme,
    });
    const song = spotifyEmbedUrl(payload.song_url);
    if (song) $("shared-letter-song").innerHTML = spotifyIframe(song);
    $("shared-letter-seal").innerHTML = icon(SEAL_ICONS.includes(theme.sealIcon) ? theme.sealIcon : "heart");
    const envelope = $("shared-letter-envelope");
    envelope.hidden = false;
    $("shared-letter-hint").hidden = false;
    envelope.addEventListener("click", () => {
      stage.classList.add("is-open");
      setTimeout(() => stage.classList.add("is-revealed"), prefersReducedMotion() ? 0 : 1300);
    }, { once: true });
  } else {
    if (row.kind === "bouquet" || row.kind === "photostrip") {
      addImage(payload.image, row.kind === "bouquet" ? "A shared bouquet" : "A shared photo strip");
    } else {
      addImage(payload.image, `Image shared with ${row.title}`);
      if (typeof payload.body === "string") addBody(payload.body);
      if (Array.isArray(payload.tags) && payload.tags.length) {
        const tags = document.createElement("p");
        tags.className = "shared-post__meta";
        tags.textContent = `Tags: ${payload.tags.filter(tag => typeof tag === "string").slice(0, 10).join(", ")}`;
        content.append(tags);
      }
    }
  }
  const meta = document.createElement("p");
  meta.className = "shared-post__meta";
  meta.textContent = `${POST_KINDS[row.kind] || "Creation"} · ${formatDate(row.created_at)}`;
  (row.kind === "letter" ? $("shared-letter-stage") : content).append(meta);
  if (row.kind !== "letter") content.hidden = false;
  $("post-actions").hidden = false;
  $("report-section").hidden = false;
  const token = ownerToken(row.slug);
  if (token) $("delete-post").hidden = false;
}

$("share-post").addEventListener("click", async () => {
  const url = location.href.split("#")[0];
  if (navigator.share) {
    try { await navigator.share({ title: post.title, url }); }
    catch (error) { if (error.name !== "AbortError") toast("Sharing failed. You can copy the link from the address bar."); }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Share link copied");
  } catch (error) {
    console.error("Could not copy the post link.", error);
    toast("Copy failed. You can copy the link from the address bar.");
  }
});

$("delete-post").addEventListener("click", async () => {
  const token = ownerToken(slug);
  if (!token || !confirm("Delete this public post? This cannot be undone.")) return;
  $("delete-post").disabled = true;
  try {
    await removeSharedPost(slug, token);
    status.textContent = "Your post has been deleted.";
    content.hidden = true;
    $("shared-letter-stage").hidden = true;
    $("post-actions").hidden = true;
    $("report-section").hidden = true;
  } catch (error) {
    console.error("Could not delete the shared post.", error);
    toast(`Delete failed: ${error.message}`);
    $("delete-post").disabled = false;
  }
});

$("report-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!supabase) { toast("The reporting service is unavailable."); return; }
  const button = event.submitter;
  button.disabled = true;
  try {
    const { data, error } = await supabase.rpc("report_shared_post", {
      p_slug: slug,
      p_reason: $("report-reason").value,
      p_note: $("report-note").value.trim(),
    });
    if (error) throw error;
    if (!data) throw new Error("This post could not be found.");
    $("report-section").open = false;
    $("report-form").reset();
    toast("Thanks, your report was sent.");
  } catch (error) {
    console.error("Could not report the shared post.", error);
    toast(`Report failed: ${error.message}`);
  } finally {
    button.disabled = false;
  }
});

async function main() {
  if (!slug) { status.textContent = "This share link is missing its post id."; return; }
  if (!supabase) { status.textContent = "The sharing service is unavailable. Please try again later."; return; }
  const { data, error } = await supabase.from("shared_posts")
    .select("slug,kind,title,payload,created_at").eq("slug", slug).maybeSingle();
  if (error) {
    console.error("Could not load the shared post.", error);
    status.textContent = error.code === "PGRST205"
      ? "Community sharing is not set up yet. The site owner needs to run sql/guest-posts.sql in Supabase."
      : "Couldn't load this creation right now. Please try again later.";
    return;
  }
  if (!data) { status.textContent = "This creation may have been deleted, or the link is incorrect."; return; }
  post = data;
  status.textContent = "";
  renderPost(data);
  const token = ownerToken(slug);
  if (token && location.hash) {
    try {
      localStorage.setItem(`dafnys-diary-post-owner:${slug}`, token);
    } catch (error) {
      console.warn("Could not save the post manage token on this device.", error);
    }
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
}

main();
