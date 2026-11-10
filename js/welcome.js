// welcome.js — the cute "secret question" ritual.
// HONEST NOTE: the answers below are visible to anyone who opens the page source.
// This is a sweet ritual, not a lock.
import { PASSED_KEY, addPetals } from "./utils.js";
import { fillIcons } from "./icons.js";

// ✏️ Change these to your own question's answers (lowercase).
const ANSWERS = ["september 11", "sept 11", "09/11", "9/11", "11"];
const WRONG_MESSAGES = [
  "Hmm, not quite, my love 🥺 try again!",
  "So close! Think back to our first day 💭",
  "Nope! But I still love you 💗",
  "Hint: it's the day everything started 🌸",
];
let tries = 0;

// Already passed before? Go straight home.
if (localStorage.getItem(PASSED_KEY) === "yes") location.replace("../index.html");

const form = document.getElementById("secret-form");
const input = document.getElementById("answer");
const msg = document.getElementById("message");

// Normalise so "  September 11 " still matches.
const clean = s => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/(st|nd|rd|th)\b/g, "");

form.addEventListener("submit", (e) => {
  e.preventDefault(); // stop the browser from reloading the page
  if (ANSWERS.includes(clean(input.value))) {
    msg.classList.remove("is-wrong");
    msg.textContent = "Yay! Welcome home, Dafny 💗";
    try { localStorage.setItem(PASSED_KEY, "yes"); } catch { /* private mode: fine */ }
    setTimeout(() => location.assign("../index.html"), 900);
  } else {
    msg.textContent = WRONG_MESSAGES[tries++ % WRONG_MESSAGES.length];
    // Restart the wiggle animation by removing and re-adding the class
    msg.classList.remove("is-wrong"); void msg.offsetWidth; msg.classList.add("is-wrong");
    input.select();
  }
});

// Optional skip so she's never stuck.
document.getElementById("skip").addEventListener("click", () => {
  try { localStorage.setItem(PASSED_KEY, "yes"); } catch {}
  location.assign("../index.html");
});

fillIcons();
addPetals(8);
