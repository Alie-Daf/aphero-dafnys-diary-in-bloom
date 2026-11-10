// supabaseClient.js — ONE shared connection to Supabase for every page.
//
// How it works:
// 1. We try to load your keys from js/config.js (which is git-ignored).
// 2. We load the official supabase-js library from a CDN (esm.sh).
// 3. If either fails, `supabase` stays null and pages show a friendly message
//    instead of crashing. "Top-level await" pauses this module until it's ready.
let supabase = null;
let reason = "";

try {
  const cfg = await import("./config.js");
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR-PROJECT")) throw new Error("placeholder config");
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  } catch (e) {
    reason = "offline";
    console.warn("Could not load Supabase library:", e);
  }
} catch (e) {
  reason = "not-configured";
  console.warn("js/config.js missing or still has placeholder values. Copy config.example.js to config.js.");
}

export { supabase };

export function notConnectedMessage() {
  return reason === "offline"
    ? "The database couldn't be reached. Check your connection and refresh."
    : "This room isn't connected to its database yet. Set up js/config.js — see docs/PHASES.md, Phase 2.";
}

// Upload a file/blob to a PUBLIC bucket and return its public URL.
// Only works when the admin is logged in (Storage policies block everyone else).
export async function uploadPublic(bucket, file, ext) {
  if (!supabase) throw new Error(notConnectedMessage());
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(name, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(name).data.publicUrl;
}

// Given a public URL, delete the underlying storage file (admin only).
export async function removePublicFile(bucket, url) {
  if (!supabase || !url) return;
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return;
  await supabase.storage.from(bucket).remove([decodeURIComponent(url.slice(i + marker.length))]);
}
