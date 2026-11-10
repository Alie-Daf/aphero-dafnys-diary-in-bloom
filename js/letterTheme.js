// letterTheme.js — shared by the Letter Room (editor preview) and letter-view (reading).
// Keeping it in one file means a letter looks the SAME in both places.
import { escapeHtml } from "./utils.js";
import { icon } from "./icons.js";

export const PAPERS = [
  { id: "cream", label: "Cream" }, { id: "lined", label: "Lined" }, { id: "grid", label: "Grid" },
  { id: "blush", label: "Blush" }, { id: "sage", label: "Sage" }, { id: "kraft", label: "Kraft" },
];
export const FONTS = [
  { id: "caveat", label: "Caveat", css: '"Caveat", cursive' },
  { id: "indie", label: "Indie Flower", css: '"Indie Flower", cursive' },
  { id: "playfair", label: "Playfair Display", css: '"Playfair Display", serif' },
  { id: "nunito", label: "Nunito", css: '"Nunito", sans-serif' },
];
// Stickers are icon names now (see icons.js). Old emoji stickers are simply ignored.
export const STICKERS = ["flower", "heart", "star", "leaf", "moon", "sparkle"];
export const OPEN_WHEN = {
  sad:   { label: "you're sad",       icon: "rain" },
  happy: { label: "you're happy",     icon: "sun" },
  miss:  { label: "you miss me",      icon: "heart" },
  sleep: { label: "you can't sleep",  icon: "moon" },
};
// Envelope paper colours and wax seal colours (used when she opens a letter)
export const ENVELOPES = { kraft: "#DDBB90", ivory: "#FFF8F0", blush: "#F8D7DA", sage: "#CBD9BE", lavender: "#D9CBEA" };
export const SEALS = { rose: "#B5535F", chestnut: "#8A5A44", sage: "#6F8A5E", plum: "#7B5A8C" };
export const SEAL_ICONS = ["heart", "flower", "star", "leaf", "moon", "key"];

const DEFAULT_THEME = { paper: "cream", color: "#4A3328", stickers: [], envelope: "kraft", seal: "rose", sealIcon: "heart", recipient: "Dafny", sender: "" };

// The `theme` column stores JSON text like {"paper":"lined","color":"#4A3328","stickers":["flower"],"envelope":"kraft","seal":"rose"}
export function parseTheme(t) {
  try { return { ...DEFAULT_THEME, ...(typeof t === "string" ? JSON.parse(t) : t || {}) }; }
  catch { return { ...DEFAULT_THEME }; }
}

const safeColor = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : DEFAULT_THEME.color);
const safePaper = p => (PAPERS.some(x => x.id === p) ? p : "cream");
const SPOTS = ["tl", "tr", "bl", "br", "ml", "mr"];

export function letterHtml(letter) {
  const th = parseTheme(letter.theme);
  const font = FONTS.find(f => f.id === letter.font)
    || (letter.font === "patrick" ? FONTS.find(f => f.id === "playfair") : null)
    || FONTS[0];
  const stickers = (th.stickers || []).filter(s => STICKERS.includes(s)).slice(0, 6);
  return `
    <article class="letter paper--${safePaper(th.paper)}" style="--letter-ink:${safeColor(th.color)};--letter-font:${escapeHtml(font.css)}">
      ${stickers.map((s, i) => `<span class="letter__sticker spot-${SPOTS[i]}" aria-hidden="true">${icon(s)}</span>`).join("")}
      <h2 class="letter__title">${escapeHtml(letter.title || "Untitled letter")}</h2>
      <p class="letter__address">${th.recipient ? `To ${escapeHtml(th.recipient)}` : ""}${th.sender ? ` · From ${escapeHtml(th.sender)}` : ""}</p>
      <div class="letter__body">${escapeHtml(letter.body || "")}</div>
    </article>`;
}