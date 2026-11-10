// home.js: the welcome-gate check, counters, painted sprig and petals for the home page.
import "./nav.js";
import { fillIcons } from "./icons.js";
import { flowerSvg } from "./flowers.js";
import { START_DATE, PASSED_KEY, daysBetween, monthsTogether, nextMonthsary, addPetals } from "./utils.js";

// If she hasn't answered the cute question yet, send her to the welcome page first.
// (Cosmetic only. Anyone can skip this. It is NOT security.)
if (localStorage.getItem(PASSED_KEY) !== "yes") {
  location.replace("pages/welcome.html");
}

function render() {
  const today = new Date();
  const days = daysBetween(START_DATE, today);
  const daysEl = document.getElementById("days-together");
  const monthsEl = document.getElementById("months-together");
  const nextEl = document.getElementById("next-monthsary");
  const nextLabel = document.getElementById("next-label");

  if (days < 0) {
    // Before our start date (useful while testing)
    daysEl.textContent = Math.abs(days);
    document.getElementById("days-label").textContent = "days until our story begins";
  } else {
    daysEl.textContent = days;
  }
  const months = monthsTogether(today);
  monthsEl.textContent = months;
  document.getElementById("months-word").textContent = months === 1 ? "month" : "months";

  const until = daysBetween(today, nextMonthsary(today));
  nextEl.textContent = until === 0 ? "Today" : until;
  nextLabel.textContent = until === 0 ? "Happy monthsary, Dafny!"
    : until === 1 ? "day until our next monthsary (the 11th)"
    : "days until our next monthsary (the 11th)";
}

render();
setInterval(render, 60000);          // roll over at midnight if the page stays open
fillIcons();                          // turn every data-icon="..." into a line icon
document.getElementById("sprig").innerHTML = flowerSvg("sampaguita");   // painted flower sprig
addPetals();