// bouquet.js: add, drag, resize, rotate and delete painted flowers on a canvas.
import "./nav.js";
import { supabase, uploadPublic } from "./supabaseClient.js";
import { getUser } from "./auth.js";
import { toast, downloadCanvas, canvasToBlob } from "./utils.js";
import { FLOWERS, flowerSvg, flowerImage } from "./flowers.js";
import { createSharedPost, imageDataUrl, renderShareResult } from "./sharing.js";

const $ = (id) => document.getElementById(id);
const canvas = $("bouquet");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

// Wrapper colours: [back layer, front layer]. Ribbon colours are single colours.
const WRAPPERS = { kraft: ["#C9A27E", "#DDBB90"], blush: ["#E8B9BF", "#F8D7DA"], sage: ["#8FA67F", "#B7C9A8"], cream: ["#E0D2C4", "#FFF8F0"] };
const RIBBONS = { pink: "#E58A9A", red: "#C0392B", sage: "#7E9A6C", brown: "#7B5236", gold: "#D4A73C" };

// The whole bouquet is just this array. Each item is a plain object:
//   id   = which flower (matches an id in flowers.js)
//   x, y = where the BOTTOM of the stem sits on the canvas
//   size = how tall the flower is in pixels
//   rot  = tilt in degrees (it swings around the stem bottom, like a real bunch)
let items = [];
let selected = null;
let drag = null;               // { dx, dy } = gap between the finger and the flower's stem bottom
const images = {};             // id -> loaded <img>

// ---------- The tray (tiles you tap to add a flower) ----------
function showTray(kind) {
  $("tray").innerHTML = FLOWERS.filter(f => f.kind === kind).map(f => `
    <button type="button" class="tile" data-id="${f.id}" aria-label="Add ${f.name}">
      <span class="tile__art">${flowerSvg(f.id)}</span>
      <span>${f.name}</span>${f.local ? '<span class="tile__tag">local</span>' : ""}
    </button>`).join("");
  document.querySelectorAll(".tray-tabs .pill").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.kind === kind)));
}
document.querySelector(".tray-tabs").addEventListener("click", (e) => {
  const b = e.target.closest(".pill"); if (b) showTray(b.dataset.kind);
});
$("tray").addEventListener("click", (e) => {
  const b = e.target.closest(".tile"); if (!b) return;
  const it = { id: b.dataset.id, x: 300 + (Math.random() - .5) * 60, y: 490, size: 300, rot: (Math.random() - .5) * 50 };
  items.push(it); select(it);
});

// ---------- Drawing (everything is drawn back to front) ----------
function draw(exporting = false) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#FFF8F0"; ctx.fillRect(0, 0, W, H);
  const wrap = WRAPPERS[$("wrapper").value];

  // 1) back of the wrapper
  if (wrap) {
    ctx.fillStyle = wrap[0];
    ctx.beginPath(); ctx.moveTo(110, 290); ctx.lineTo(490, 290); ctx.lineTo(335, 690); ctx.lineTo(265, 690); ctx.closePath(); ctx.fill();
  }
  // 2) flowers, in array order (last = on top)
  for (const it of items) {
    const img = images[it.id]; if (!img) continue;
    const w = it.size * 0.6;
    ctx.save();
    ctx.translate(it.x, it.y); ctx.rotate(it.rot * Math.PI / 180);
    ctx.drawImage(img, -w / 2, -it.size, w, it.size);
    if (!exporting && it === selected) {            // dashed box so you can see what's selected
      ctx.setLineDash([6, 6]); ctx.strokeStyle = "#4A3328"; ctx.lineWidth = 2;
      ctx.strokeRect(-w / 2, -it.size, w, it.size);
    }
    ctx.restore();
  }
  // 3) front of the wrapper (it covers the bottom of the stems)
  if (wrap) {
    ctx.fillStyle = wrap[1];
    ctx.beginPath(); ctx.moveTo(80, 410); ctx.quadraticCurveTo(300, 470, 520, 410); ctx.lineTo(335, 705); ctx.lineTo(265, 705); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(74,51,40,.16)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(300, 448); ctx.lineTo(300, 700); ctx.moveTo(190, 432); ctx.lineTo(282, 700); ctx.moveTo(410, 432); ctx.lineTo(318, 700); ctx.stroke();
  }
  // 4) ribbon bow
  ctx.fillStyle = RIBBONS[$("ribbon").value];
  ctx.beginPath(); ctx.ellipse(262, 600, 40, 20, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(338, 600, 40, 20, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(292, 606); ctx.lineTo(260, 680); ctx.lineTo(282, 672); ctx.lineTo(300, 612); ctx.fill();
  ctx.beginPath(); ctx.moveTo(308, 606); ctx.lineTo(340, 680); ctx.lineTo(318, 672); ctx.lineTo(300, 612); ctx.fill();
  ctx.beginPath(); ctx.arc(300, 602, 14, 0, Math.PI * 2); ctx.fill();

  // 5) little card tag
  const msg = $("card-msg").value.trim();
  if (msg) {
    ctx.save(); ctx.translate(455, 615); ctx.rotate(0.12);
    ctx.fillStyle = "#FFFFFF"; ctx.shadowColor = "rgba(74,51,40,.25)"; ctx.shadowBlur = 10;
    ctx.fillRect(-90, -55, 180, 110); ctx.shadowBlur = 0;
    ctx.fillStyle = "#4A3328"; ctx.font = "600 26px Caveat, cursive"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    wrapText(msg, 160).slice(0, 3).forEach((line, i, arr) => ctx.fillText(line, 0, (i - (arr.length - 1) / 2) * 28));
    ctx.restore();
  }
}
// Split text into lines that fit a width.
function wrapText(text, maxW) {
  const words = text.split(/\s+/); const lines = []; let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ---------- Selecting and the controls ----------
function select(it) {
  selected = it;
  ["size", "rotate", "front", "delete"].forEach(id => ($(id).disabled = !it));
  if (it) { $("size").value = it.size; $("rotate").value = Math.round(it.rot); }
  draw();
}
$("size").addEventListener("input", (e) => { if (selected) { selected.size = Number(e.target.value); draw(); } });
$("rotate").addEventListener("input", (e) => { if (selected) { selected.rot = Number(e.target.value); draw(); } });
$("front").addEventListener("click", () => { if (!selected) return; items = items.filter(i => i !== selected).concat(selected); draw(); });
$("delete").addEventListener("click", removeSelected);
$("clear").addEventListener("click", () => { if (items.length && confirm("Clear all flowers?")) { items = []; select(null); } });
function removeSelected() { if (!selected) return; items = items.filter(i => i !== selected); select(null); }
["wrapper", "ribbon"].forEach(id => $(id).addEventListener("change", () => draw()));
$("card-msg").addEventListener("input", () => draw());

// ---------- Pointer Events: one code path for mouse, touch and pen ----------
function toCanvas(e) {
  const r = canvas.getBoundingClientRect();           // the canvas is scaled by CSS, so convert
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
// Is the point inside this flower's (tilted) box? Undo the tilt, then check a plain rectangle.
function hitTest(p) {
  for (let i = items.length - 1; i >= 0; i--) {          // top-most first
    const it = items[i], a = -it.rot * Math.PI / 180;
    const dx = p.x - it.x, dy = p.y - it.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) < it.size * 0.3 && ly > -it.size && ly < 0) return it;
  }
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = toCanvas(e); const it = hitTest(p);
  select(it);
  if (it) { drag = { dx: p.x - it.x, dy: p.y - it.y }; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag || !selected) return;
  const p = toCanvas(e);
  selected.x = Math.max(0, Math.min(W, p.x - drag.dx));
  selected.y = Math.max(0, Math.min(H, p.y - drag.dy));
  draw();
});
["pointerup", "pointercancel"].forEach(t => canvas.addEventListener(t, () => (drag = null)));

// Keyboard support (accessibility)
canvas.addEventListener("keydown", (e) => {
  if (!selected) return;
  const step = e.shiftKey ? 20 : 5;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) { e.preventDefault(); selected.x += moves[e.key][0]; selected.y += moves[e.key][1]; draw(); }
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
});

// ---------- Export ----------
async function exportCanvas(fn) { draw(true); try { await fn(); } finally { draw(); } }   // draw without the dashed box
$("b-download").addEventListener("click", () => exportCanvas(() => downloadCanvas(canvas, `bouquet-${Date.now()}.png`)));
$("share-bouquet").addEventListener("click", async () => exportCanvas(async () => {
  const button = $("share-bouquet");
  button.disabled = true;
  try {
    const image = await imageDataUrl(await canvasToBlob(canvas));
    const title = $("card-msg").value.trim() || "A shared bouquet";
    const shared = await createSharedPost("bouquet", title, { image });
    renderShareResult($("bouquet-share-result"), shared);
    toast("Your bouquet is published.");
  } catch (error) {
    console.error("Could not publish the bouquet.", error);
    toast("Publishing failed: " + error.message);
  } finally {
    button.disabled = false;
  }
}));

const user = await getUser();
if (user) $("b-save").hidden = false;                      // only the admin sees this button
$("b-save").addEventListener("click", () => exportCanvas(async () => {
  $("b-save").disabled = true;
  try {
    const url = await uploadPublic("creations", await canvasToBlob(canvas), "png");
    const { error } = await supabase.from("creations").insert({ type: "bouquet", image_url: url });
    if (error) throw error;
    toast("Your bouquet is on the Memory Wall.");
  } catch (err) { toast("Saving failed. " + err.message); }
  $("b-save").disabled = false;
}));

// ---------- Start: load every flower picture once, then show a starter bouquet ----------
showTray("flower");
await Promise.all(FLOWERS.map(async f => { images[f.id] = await flowerImage(f.id); }));
items = [
  { id: "babys-breath", x: 290, y: 480, size: 330, rot: -40 },
  { id: "eucalyptus",   x: 310, y: 480, size: 340, rot: 34 },
  { id: "lavender",     x: 280, y: 482, size: 330, rot: -24 },
  { id: "sampaguita",   x: 320, y: 482, size: 320, rot: 26 },
  { id: "gumamela",     x: 270, y: 484, size: 300, rot: -10 },
  { id: "kalachuchi",   x: 330, y: 484, size: 290, rot: 12 },
  { id: "peony",        x: 300, y: 486, size: 320, rot: 0 },
];
await document.fonts.ready;
select(null);