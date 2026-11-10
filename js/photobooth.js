// photobooth.js — webcam, countdown, filters, frames, stickers, strip, download.
import "./nav.js";
import { supabase, uploadPublic } from "./supabaseClient.js";
import { getUser } from "./auth.js";
import { toast, downloadCanvas, canvasToBlob, prefersReducedMotion}from "./utils.js";
import { fillIcons, icon, iconPath } from "./icons.js";
import { flowerImage } from "./flowers.js";
import { createSharedPost, imageDataUrl, renderShareResult } from "./sharing.js";

const $ = (id) => document.getElementById(id);
const video = $("video");
const strip = $("strip");
const SHOT_W = 800, SHOT_H = 600;          // every shot is cropped to 4:3

// CSS filter strings work both on the <video> preview and on canvas (ctx.filter).
const FILTERS = {
  none: "none", bw: "grayscale(1)", sepia: "sepia(.8)", vintage: "sepia(.35) saturate(.8) contrast(.9)",
  soft: "brightness(1.08) saturate(.8)", vivid: "saturate(1.5) contrast(1.05)",
};
const FRAMES = {
  blush: { bg: "#F2CDD2", ink: "#3E2A22", label: "Blush" },
  cream: { bg: "#FFFAF5", ink: "#3E2A22", label: "Cream" },
  sage: { bg: "#DCE5D2", ink: "#3E2A22", label: "Sage" },
  yellow: { bg: "#FFF0B8", ink: "#3E2A22", label: "Butter" },
  terracotta: { bg: "#8B5A44", ink: "#FFFAF5", label: "Terracotta" },
  charcoal: { bg: "#2B1F1A", ink: "#FFFAF5", label: "Charcoal" },
};
const STICKER_GROUPS = {
  none: [],
  blooms: ["sakura", "daisy", "gumamela", "sampaguita"],
  hearts: ["heart"],
  stars: ["star"],
  leaves: ["leaf"],
};
const STICKER_LABELS = { none: "None", blooms: "Blooms", hearts: "Hearts", stars: "Stars", leaves: "Leaves" };
let chosenStickerGroup = "blooms";
let chosenFrame = "blush";
let stream = null;
let shots = [];                              // array of canvases (unfiltered)

// ---------- Frame and sticker choices ----------
$("frame-choices").innerHTML = Object.entries(FRAMES).map(([id, frame]) =>
  `<button type="button" class="frame-swatch" data-frame="${id}" aria-label="${frame.label}"
    aria-pressed="${id === chosenFrame}" title="${frame.label}" style="--frame-color:${frame.bg}"></button>`).join("");
$("pb-stickers").innerHTML = Object.entries(STICKER_LABELS).map(([id, label]) =>
  `<button type="button" class="pill" data-sticker-group="${id}" aria-pressed="${id === chosenStickerGroup}">${label}</button>`).join("");
$("pb-stickers").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sticker-group]"); if (!b) return;
  chosenStickerGroup = b.dataset.stickerGroup;
  $("pb-stickers").querySelectorAll("[data-sticker-group]").forEach(button =>
    button.setAttribute("aria-pressed", String(button === b)));
  drawStrip();
});
$("frame-choices").addEventListener("click", (e) => {
  const b = e.target.closest("[data-frame]"); if (!b) return;
  chosenFrame = b.dataset.frame;
  $("frame-choices").querySelectorAll("[data-frame]").forEach(button =>
    button.setAttribute("aria-pressed", String(button === b)));
  drawStrip();
});

// Get a sticker ready to draw on the canvas (flowers are pictures, icons are line paths).
async function loadSticker(id) {
  if (["sakura", "daisy", "gumamela", "sampaguita"].includes(id)) return { img: await flowerImage(id) };
  const icons = {
    heart: { color: "#D58E9C" },
    star: { color: "#E8BF56" },
    leaf: { color: "#78936B" },
  };
  return { path: new Path2D(iconPath(id)), color: icons[id].color };
}
function drawSticker(ctx, art, cx, cy, size) {
  if (art.img) {                              // crop just the flower head from the tall picture
    const k = art.img.naturalWidth / 120;     // the picture may be bigger than 120 wide, so scale the crop
    ctx.drawImage(art.img, 15 * k, 10 * k, 90 * k, 90 * k, cx - size / 2, cy - size / 2, size, size);
  } else {                                    // icon: pastel fill + brown outline
    ctx.save(); ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / 24, size / 24);
    ctx.fillStyle = art.color; ctx.strokeStyle = "#4A3328"; ctx.lineWidth = 1.5; ctx.lineJoin = "round";
    ctx.fill(art.path); ctx.stroke(art.path); ctx.restore();
  }
}

// ---------- Camera ----------
function camError(msg) { $("cam-error").textContent = msg; $("cam-error").hidden = false; }

async function startCamera() {
  $("cam-error").hidden = true;
  if (!window.isSecureContext) return camError("The camera only works on https:// or localhost. You can still upload photos below 💗");
  if (!navigator.mediaDevices?.getUserMedia) return camError("This browser can't use the camera. Try Chrome or Safari, or upload photos below 💗");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    $("idle").hidden = true;
    $("snap").disabled = false;
    $("start-cam").textContent = "Turn off camera";
  } catch (err) {
    const msgs = {
      NotAllowedError: "Camera permission was blocked 🙈 Tap the lock icon in the address bar to allow it, or upload photos below.",
      NotFoundError: "I couldn't find a camera on this device. You can upload photos below instead 📷",
      NotReadableError: "The camera is busy in another app. Close it and try again 💭",
      OverconstrainedError: "This camera doesn't support the settings I asked for. Try another device or upload photos.",
    };
    camError(msgs[err.name] || "Something went wrong with the camera 🥺 You can upload photos instead.");
  }
}
function stopCamera() {
  stream?.getTracks().forEach(t => t.stop());
  stream = null; video.srcObject = null;
  $("idle").hidden = false; $("snap").disabled = true; $("start-cam").textContent = "Turn on camera";
}
$("start-cam").addEventListener("click", () => (stream ? stopCamera() : startCamera()));
// Turn the camera off when leaving the page, so the light goes out.
window.addEventListener("pagehide", stopCamera);

function setCaptureMode(mode) {
  const isCamera = mode === "camera";
  $("camera-mode").setAttribute("aria-pressed", String(isCamera));
  $("upload-mode").setAttribute("aria-pressed", String(!isCamera));
  $("camera-panel").hidden = !isCamera;
  $("upload-panel").hidden = isCamera;
}
$("camera-mode").addEventListener("click", () => setCaptureMode("camera"));
$("upload-mode").addEventListener("click", () => setCaptureMode("upload"));

function renderShotSlots() {
  const count = Number($("shots").value);
  $("shot-slots").className = `shot-slots shot-slots--${count}`;
  $("shot-slots").innerHTML = Array.from({ length: count }, (_, i) => shots[i]
    ? `<div class="shot-slot"><img src="${shots[i].toDataURL("image/jpeg", .72)}" alt="Photo ${i + 1}"></div>`
    : `<div class="shot-slot" aria-label="Photo ${i + 1} placeholder"></div>`).join("");
}
renderShotSlots();

// Crop any image/video to 4:3 ("cover") onto a new canvas.
function grab(source, sw, sh, mirror) {
  const c = document.createElement("canvas"); c.width = SHOT_W; c.height = SHOT_H;
  const ctx = c.getContext("2d");
  const scale = Math.max(SHOT_W / sw, SHOT_H / sh);
  const w = sw * scale, h = sh * scale;
  if (mirror) { ctx.translate(SHOT_W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, (SHOT_W - w) / 2, (SHOT_H - h) / 2, w, h);
  return c;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

$("snap").addEventListener("click", async () => {
  const n = Number($("shots").value);
  shots = [];
  renderShotSlots();
  $("snap").disabled = true; $("start-cam").disabled = true;
  const tick = prefersReducedMotion() ? 500 : 1000;
  const delay = Number($("delay").value);
  try {
    for (let i = 0; i < n; i++) {
      for (let c = delay; c > 0; c--) { $("countdown").textContent = c; await sleep(tick); }
      $("countdown").textContent = "";
      $("flash").classList.remove("go"); void $("flash").offsetWidth; $("flash").classList.add("go");
      shots.push(grab(video, video.videoWidth, video.videoHeight, true));
      renderShotSlots();
      toast(`Shot ${i + 1} of ${n} 📸`);
      await sleep(600);
    }
    drawStrip();
  } catch (err) {
    console.error("Could not capture the photo strip.", err);
    camError("The camera stopped unexpectedly. Please turn it on and try again.");
  } finally {
    $("countdown").textContent = "";
    $("snap").disabled = !stream;
    $("start-cam").disabled = false;
  }
});

// ---------- Upload fallback ----------
$("upload").addEventListener("change", async (e) => {
  const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const files = [...e.target.files].filter(f => supportedTypes.includes(f.type)).slice(0, Number($("shots").value));
  if (!files.length) return toast("Choose JPG, PNG, GIF or WebP photos");
  try {
    shots = [];
    for (const f of files) {
      const bmp = await createImageBitmap(f);
      shots.push(grab(bmp, bmp.width, bmp.height, false));
    }
    renderShotSlots();
    drawStrip();
  } catch (err) {
    console.error("Could not read the selected photos.", err);
    toast("Couldn't read those photos. Choose another JPG, PNG, GIF or WebP.");
  }
});

// ---------- Filters (with a fallback for browsers without ctx.filter) ----------
function drawFiltered(ctx, img, x, y, w, h, f) {
  if ("filter" in ctx) {
    ctx.filter = FILTERS[f]; ctx.drawImage(img, x, y, w, h); ctx.filter = "none";
    return;
  }
  ctx.drawImage(img, x, y, w, h);
  if (f === "none") return;
  // Pixel-by-pixel fallback for browsers without CanvasRenderingContext2D.filter.
  const d = ctx.getImageData(x, y, w, h); const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2], gray = 0.3 * r + 0.59 * g + 0.11 * b;
    if (f === "bw") { p[i] = p[i + 1] = p[i + 2] = gray; }
    else if (f === "sepia") { p[i] = Math.min(255, gray * 1.07 + 40); p[i + 1] = Math.min(255, gray * .95 + 20); p[i + 2] = gray * .82; }
    else if (f === "vintage") { p[i] = Math.min(255, r * .9 + 25); p[i + 1] = Math.min(255, g * .88 + 18); p[i + 2] = b * .82; }
    else if (f === "soft") { p[i] = Math.min(255, r * .82 + 42); p[i + 1] = Math.min(255, g * .82 + 42); p[i + 2] = Math.min(255, b * .82 + 42); }
    else if (f === "vivid") {
      p[i] = Math.max(0, Math.min(255, gray + (r - gray) * 1.5));
      p[i + 1] = Math.max(0, Math.min(255, gray + (g - gray) * 1.5));
      p[i + 2] = Math.max(0, Math.min(255, gray + (b - gray) * 1.5));
    }
  }
  ctx.putImageData(d, x, y);
}

// ---------- Build the strip ----------
async function drawStrip() {
  if (!shots.length) return;
  await document.fonts.ready;                // make sure Caveat is loaded before drawing text
  const frame = FRAMES[chosenFrame];
  const W = 600, pad = 34, isGrid = $("shots").value === "6", gap = isGrid ? 12 : 22, footer = 120;
  const sw = isGrid ? (W - pad * 2 - gap) / 2 : W - pad * 2;
  const sh = sw * 3 / 4, rows = isGrid ? Math.ceil(shots.length / 2) : shots.length;
  const H = pad + rows * (sh + gap) - gap + footer;
  strip.width = W; strip.height = H;
  const ctx = strip.getContext("2d");

  ctx.fillStyle = frame.bg; ctx.fillRect(0, 0, W, H);
  const f = $("filter").value;
  const stickerIds = STICKER_GROUPS[chosenStickerGroup];
  const art = await Promise.all(stickerIds.map(loadSticker));
  shots.forEach((shot, i) => {
    const x = isGrid ? pad + (i % 2) * (sw + gap) : pad;
    const y = pad + (isGrid ? Math.floor(i / 2) : i) * (sh + gap);
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(x - 6, y - 6, sw + 12, sh + 12);
    drawFiltered(ctx, shot, x, y, sw, sh, f);
    // Stickers: rotate through the chosen ones at alternating corners
    if (art.length) {
      const [sx, sy] = i % 2 ? [x + 24, y + sh - 22] : [x + sw - 24, y + 22];
      drawSticker(ctx, art[i % art.length], sx, sy, 64);
    }
  });
  ctx.fillStyle = frame.ink; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.font = "700 48px Caveat, cursive";
  ctx.fillText($("caption").value || "", W / 2, H - footer / 2 + 8);
  ctx.font = "600 20px Nunito, sans-serif";
  ctx.fillText(new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }), W / 2, H - 22);

  $("strip-wrap").hidden = false;
  $("capture-stage").hidden = true;
  $("edit-stage").hidden = false;
}
$("caption").addEventListener("input", drawStrip);
$("filter").addEventListener("change", () => {
  video.style.filter = FILTERS[$("filter").value];
  drawStrip();
});

// ---------- Layout buttons (set the hidden "shots" box) ----------
$("layouts").addEventListener("click", (e) => {
  const b = e.target.closest(".layout"); if (!b) return;
  $("shots").value = b.dataset.n;
  shots = shots.slice(0, Number(b.dataset.n));
  renderShotSlots();
  document.querySelectorAll("#layouts .layout").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  $("snap").textContent = `Start capture (${b.dataset.n} photos)`;
});

// ---------- Filter pills (set the hidden "filter" box) ----------
const FILTER_NAMES = { none: "No filter", bw: "Black and white", sepia: "Sepia", vintage: "Vintage", soft: "Soft", vivid: "Vivid" };
$("filters").innerHTML = Object.entries(FILTER_NAMES).map(([k, n]) => `<button type="button" class="pill" data-f="${k}" aria-pressed="${k === "none"}">${n}</button>`).join("");
$("filters").addEventListener("click", (e) => {
  const b = e.target.closest(".pill"); if (!b) return;
  $("filter").value = b.dataset.f;
  $("filter").dispatchEvent(new Event("change"));
  document.querySelectorAll("#filters .pill").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
});
fillIcons();
$("download").addEventListener("click", () => downloadCanvas(strip, `photostrip-${Date.now()}.png`));
$("share-strip").addEventListener("click", async () => {
  const button = $("share-strip");
  button.disabled = true;
  try {
    const image = await imageDataUrl(await canvasToBlob(strip));
    const title = $("caption").value.trim() || "A shared photo strip";
    const shared = await createSharedPost("photostrip", title, { image });
    renderShareResult($("strip-share-result"), shared);
    toast("Your photo strip is published 📸");
  } catch (error) {
    console.error("Could not publish the photo strip.", error);
    toast("Publishing failed: " + error.message);
  } finally {
    button.disabled = false;
  }
});
$("retake").addEventListener("click", () => {
  shots = [];
  renderShotSlots();
  $("strip-wrap").hidden = true;
  $("edit-stage").hidden = true;
  $("capture-stage").hidden = false;
  $("upload").value = "";
  $("snap").textContent = `Start capture (${$("shots").value} photos)`;
  $("snap").focus();
});

// Admin-only: save straight to the Memory Wall (RLS blocks everyone else anyway).
const user = await getUser();
if (user) { $("save").hidden = false; $("save-hint").textContent = "Admin mode: you can save this straight to the Memory Wall."; }
$("save").addEventListener("click", async () => {
  $("save").disabled = true;
  try {
    const url = await uploadPublic("creations", await canvasToBlob(strip), "png");
    const { error } = await supabase.from("creations").insert({ type: "photostrip", image_url: url });
    if (error) throw error;
    toast("Pinned to the Memory Wall");
  } catch (err) { toast("Saving failed" + err.message); }
  $("save").disabled = false;
});
