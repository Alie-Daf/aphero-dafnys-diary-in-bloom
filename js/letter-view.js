// letter-view.js — opens ONE letter by its secret slug: letter-view.html?slug=abc123...
import "./nav.js";
import { supabase, notConnectedMessage } from "./supabaseClient.js";
import { spotifyEmbedUrl, mountSpotifyPlayer, prefersReducedMotion } from "./utils.js";
import { letterHtml, parseTheme, ENVELOPES, SEALS, SEAL_ICONS } from "./letterTheme.js";
import { icon } from "./icons.js";

const $ = (id) => document.getElementById(id);
const status = $("view-status");
const slug = new URLSearchParams(location.search).get("slug");

async function main() {
  if (!slug) { status.textContent = "This envelope is empty… the link might be missing a part 🥺"; return; }
  if (!supabase) { status.textContent = notConnectedMessage(); return; }

  const { data: letter, error } = await supabase.from("letters").select("*").eq("share_slug", slug).maybeSingle();
  if (error) { status.textContent = "Couldn't fetch the letter right now. Check your internet and try again 💭"; return; }
  if (!letter) { status.textContent = "Hmm, I can't find this letter. Double-check the link 💌"; return; }

  document.title = `${letter.title} | Dafny's Diary in Bloom`;
  $("letter-slot").innerHTML = letterHtml(letter);
  const song = spotifyEmbedUrl(letter.song_url);          // re-validate before embedding

  status.hidden = true;
  // Paint the envelope and the wax seal with the colours chosen for this letter
  const th = parseTheme(letter.theme);
  const stage = $("stage");
  stage.style.setProperty("--env", ENVELOPES[th.envelope] || ENVELOPES.kraft);
  stage.style.setProperty("--seal", SEALS[th.seal] || SEALS.rose);
  $("envelope-seal").innerHTML = icon(SEAL_ICONS.includes(th.sealIcon) ? th.sealIcon : "heart");
  const env = $("envelope");
  env.hidden = false; $("envelope-hint").hidden = false;
  env.focus();

  env.addEventListener("click", () => {
    const stage = $("stage");
    if (song) mountSpotifyPlayer($("letter-song-player"), $("letter-song-toggle"), $("letter-song-status"), song);
    stage.classList.add("is-open");
    if (song) $("envelope-hint").textContent = "Opening your letter…";
    // Wait for the flap + paper animation, then show the full letter.
    setTimeout(() => stage.classList.add("is-revealed"), prefersReducedMotion() ? 0 : 1300);
  }, { once: true });
}
main();
