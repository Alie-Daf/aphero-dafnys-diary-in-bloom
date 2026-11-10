// utils.js — small helpers shared by every page.

// Our anniversary. Months are 0-based in JavaScript: 8 = September.
export const START_DATE = new Date(2026, 8, 11);
export const MONTHSARY_DAY = 11;
export const PASSED_KEY = "olc-passed-welcome";

// Strip the time so day math isn't thrown off by hours.
export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Whole days between two dates (Math.round handles daylight-saving shifts).
export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

// Completed months since start (a month counts once the 11th arrives).
export function monthsTogether(today = new Date()) {
  let m = (today.getFullYear() - START_DATE.getFullYear()) * 12 + (today.getMonth() - START_DATE.getMonth());
  if (today.getDate() < START_DATE.getDate()) m -= 1;
  return Math.max(0, m);
}

// The next 11th that is today or later.
export function nextMonthsary(today = new Date()) {
  const t = startOfDay(today);
  let next = new Date(t.getFullYear(), t.getMonth(), MONTHSARY_DAY);
  if (next < t) next = new Date(t.getFullYear(), t.getMonth() + 1, MONTHSARY_DAY);
  return next;
}

// Fill the screen with gentle falling petals and leaves (skipped if reduced motion is on).
const PETAL = '<svg viewBox="0 0 24 24"><path d="M12 2C19 8 19 17 12 22C5 17 5 8 12 2Z" fill="#F4B8BF" stroke="#E58A9A" stroke-opacity=".5" stroke-width="1"/></svg>';
const LEAF  = '<svg viewBox="0 0 24 24"><path d="M3 21C3 10 10 4 21 3C21 14 14 21 3 21Z" fill="#B7C9A8" stroke="#6F8A5E" stroke-opacity=".5" stroke-width="1"/></svg>';
export function addPetals(count = 12) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "petals";
  box.setAttribute("aria-hidden", "true"); // decoration only
  const shapes = [PETAL, LEAF, PETAL, PETAL];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "petal";
    p.innerHTML = shapes[i % shapes.length];
    p.style.left = Math.random() * 100 + "vw";
    p.style.animationDuration = 9 + Math.random() * 8 + "s";
    p.style.animationDelay = -Math.random() * 15 + "s"; // negative = already mid-fall
    box.appendChild(p);
  }
  document.body.appendChild(box);
}

// ---------- Added in later phases ----------

// Turn user text into safe HTML text. ALWAYS use this before putting
// database content into innerHTML, so nobody can inject scripts.
export function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Convert any Spotify share link into an embed link (no API key needed).
// Works for: https://open.spotify.com/track/ID, /intl-xx/track/ID, spotify:track:ID
// (and album / playlist / episode links too).
export function spotifyEmbedUrl(input) {
  if (!input) return null;
  const m = String(input).match(/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?|spotify:)(track|album|playlist|episode)[/:]([A-Za-z0-9]{22})/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}

export function spotifyIframe(url, autoplay = false) {
  const src = new URL(url);
  if (autoplay) src.searchParams.set("autoplay", "1");
  return `<iframe title="Spotify player" src="${src.href}" width="100%" height="152" style="border:0;border-radius:12px"
    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="${autoplay ? "eager" : "lazy"}"></iframe>`;
}

let spotifyIframeApiPromise;
function loadSpotifyIframeApi() {
  if (window.SpotifyIframeApi) return Promise.resolve(window.SpotifyIframeApi);
  if (!spotifyIframeApiPromise) {
    spotifyIframeApiPromise = new Promise((resolve, reject) => {
      window.onSpotifyIframeApiReady = api => {
        window.SpotifyIframeApi = api;
        resolve(api);
      };
      const script = document.createElement("script");
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      script.onerror = () => reject(new Error("Spotify's player controls could not be loaded."));
      document.head.appendChild(script);
    });
  }
  return spotifyIframeApiPromise;
}

export async function mountSpotifyPlayer(container, button, status, url) {
  const match = new URL(url).pathname.match(/^\/embed\/(track|album|playlist|episode)\/([A-Za-z0-9]{22})$/);
  if (!match) throw new Error("This Spotify link is not supported.");

  button.hidden = false;
  button.disabled = true;
  button.textContent = "Loading player…";
  status.textContent = "Loading the song player here on the page…";

  try {
    const api = await loadSpotifyIframeApi();
    const controller = await new Promise((resolve, reject) => {
      try {
        api.createController(container, {
          uri: `spotify:${match[1]}:${match[2]}`,
          width: "100%",
          height: "152",
        }, resolve);
      } catch (error) {
        reject(error);
      }
    });

    let isPlaying = false;
    controller.addListener("playback_update", event => {
      isPlaying = !event.data.isPaused;
      button.textContent = isPlaying ? "Pause song" : "Play song";
      button.setAttribute("aria-pressed", String(isPlaying));
      status.textContent = isPlaying ? "Playing here while you read 💚" : "Use Play song to listen here while you read.";
    });
    button.disabled = false;
    button.textContent = "Play song";
    status.textContent = "Tap Play song to listen here while you read.";
    button.addEventListener("click", () => {
      try {
        if (isPlaying) controller.pause();
        else controller.play();
      } catch (error) {
        console.error("Could not control Spotify playback.", error);
        status.textContent = "Couldn't start playback. Try the play control in the player below.";
      }
    });
  } catch (error) {
    console.error("Could not load the Spotify player controls.", error);
    container.innerHTML = spotifyIframe(url);
    button.hidden = true;
    status.textContent = "The player is still here on the page. Use its play control to listen.";
  }
}

// A small pop-up message at the bottom of the screen (read aloud by screen readers).
export function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast"; el.className = "toast";
    el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("is-show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("is-show"), 3800);
}

// Canvas -> PNG Blob (a file in memory)
export const canvasToBlob = (canvas) => new Promise(res => canvas.toBlob(res, "image/png"));

// Download a canvas as a PNG file.
export async function downloadCanvas(canvas, filename) {
  const blob = await canvasToBlob(canvas);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

// "2026-10-11" -> "October 11, 2026" (adds a time so it doesn't shift a day in some timezones)
export function formatDate(d) {
  if (!d) return "";
  const date = typeof d === "string" && d.length === 10 ? new Date(d + "T00:00:00") : new Date(d);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// The date of monthsary number n (1 = Oct 11, 2026)
export function monthsaryDate(n) {
  return new Date(START_DATE.getFullYear(), START_DATE.getMonth() + n, START_DATE.getDate());
}

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
