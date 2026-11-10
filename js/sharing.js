import { supabase } from "./supabaseClient.js";
import { toast } from "./utils.js";

const OWNER_KEY = "dafnys-diary-post-owner:";
const MAX_IMAGE_BYTES = 420_000;

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function createSharedPost(kind, title, payload) {
  if (!supabase) throw new Error("Sharing needs the site database. Please check the Supabase setup.");
  const token = randomToken();
  const { data, error } = await supabase.rpc("create_shared_post", {
    p_kind: kind,
    p_title: title.trim(),
    p_payload: payload,
    p_owner_token: token,
  });
  if (error) throw error;
  if (!data?.slug) throw new Error("The post was created but the share link was not returned.");
  let manageStored = true;
  try {
    localStorage.setItem(`${OWNER_KEY}${data.slug}`, token);
  } catch (storageError) {
    manageStored = false;
    console.warn("Could not save the private manage token on this device.", storageError);
  }
  return { slug: data.slug, shareUrl: postUrl(data.slug), manageUrl: manageUrl(data.slug, token), manageStored };
}

export function postUrl(slug) {
  return new URL(`post.html?slug=${encodeURIComponent(slug)}`, location.href).href;
}

function manageUrl(slug, token) {
  const url = new URL(postUrl(slug));
  url.hash = `manage=${token}`;
  return url.href;
}

export async function removeSharedPost(slug, token) {
  if (!supabase) throw new Error("The site database is unavailable.");
  const { data, error } = await supabase.rpc("delete_shared_post", { p_slug: slug, p_owner_token: token });
  if (error) throw error;
  if (!data) throw new Error("This manage link is invalid or has expired.");
  try {
    localStorage.removeItem(`${OWNER_KEY}${slug}`);
  } catch (storageError) {
    console.warn("Could not clear the deleted post token from this device.", storageError);
  }
}

export function ownerToken(slug) {
  let fromDevice = null;
  try {
    fromDevice = localStorage.getItem(`${OWNER_KEY}${slug}`);
  } catch (storageError) {
    console.warn("Could not read the post manage token from this device.", storageError);
  }
  if (fromDevice) return fromDevice;
  const token = new URLSearchParams(location.hash.slice(1)).get("manage");
  return /^[0-9a-f]{64}$/.test(token || "") ? token : null;
}

export function renderShareResult(container, { shareUrl, manageUrl: privateUrl, manageStored = true }) {
  container.replaceChildren();
  const publicLabel = document.createElement("strong");
  publicLabel.textContent = "Your public share link";
  const publicLink = document.createElement("a");
  publicLink.href = shareUrl;
  publicLink.textContent = shareUrl;
  publicLink.target = "_blank";
  publicLink.rel = "noopener";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "btn btn--small";
  copy.textContent = "Copy share link";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast("Share link copied");
    } catch (error) {
      console.error("Could not copy the share link.", error);
      toast("Copy failed. Select and copy the link above.");
    }
  });
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = manageStored
    ? "Private manage/delete link — do not share"
    : "Save this private manage/delete link — it could not be stored on this device";
  details.open = !manageStored;
  const privateLink = document.createElement("a");
  privateLink.href = privateUrl;
  privateLink.textContent = "Open this on your device to delete your post";
  privateLink.target = "_blank";
  privateLink.rel = "noopener noreferrer";
  details.append(summary, privateLink);
  container.append(publicLabel, publicLink, copy, details);
}

export async function imageDataUrl(blob, maxBytes = MAX_IMAGE_BYTES) {
  if (!(blob instanceof Blob) || !blob.type.startsWith("image/")) {
    throw new Error("Choose a valid image.");
  }
  if (blob.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.");
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error("That image could not be opened.");
  }
  try {
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error("That image is too large to process.");
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare the image.");
    while (width > 1 && height > 1) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      for (const quality of [0.82, 0.7, 0.58, 0.46]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const approxBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
        if (approxBytes <= maxBytes) return dataUrl;
      }
      width = Math.floor(width * 0.75);
      height = Math.floor(height * 0.75);
    }
    throw new Error("That image is too large to share. Try a smaller image.");
  } finally {
    bitmap.close();
  }
}

export function safeImageUrl(value) {
  return typeof value === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value)
    ? value
    : null;
}

export const POST_KINDS = {
  letter: "Letter",
  bouquet: "Bouquet",
  photostrip: "Photo strip",
  memory: "Memory",
  library: "Library",
};
