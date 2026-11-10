// admin.js — the hidden admin page. Only YOU log in here.
// Reminder: the database rules (RLS) are the real lock. Even if someone opened
// this page, they couldn't save anything without your password.
import "./nav.js";
import { supabase, notConnectedMessage, uploadPublic, removePublicFile } from "./supabaseClient.js";
import { getUser, signIn, signOut } from "./auth.js";
import { escapeHtml, toast, formatDate } from "./utils.js";

const $ = (id) => document.getElementById(id);
const MB = 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const tagsFrom = (s) => s.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
const extOf = (name) => (name.split(".").pop() || "bin").toLowerCase();

// ---------- Login ----------
async function showState() {
  if (!supabase) { $("admin-status").textContent = notConnectedMessage(); return; }
  const user = await getUser();
  $("login-box").hidden = !!user;
  $("dash").hidden = !user;
  if (user) { $("my-id").textContent = user.id; refreshAll(); }
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await signIn($("email").value.trim(), $("password").value);
    toast("Welcome back 🌸");
    showState();
  } catch (err) {
    toast("Login failed: " + (err.message || "check your email and password"));
  }
});
$("logout").addEventListener("click", async () => { await signOut(); location.reload(); });

// ---------- Tabs ----------
const tabs = ["memories", "library", "creations", "letters"];
tabs.forEach(name => $("t-" + name).addEventListener("click", () => {
  tabs.forEach(n => {
    const on = n === name;
    $("t-" + n).setAttribute("aria-selected", String(on));
    $("t-" + n).classList.toggle("btn--ghost", !on);
    $("tab-" + n).hidden = !on;
  });
}));

// ---------- Validation ----------
function checkImage(file, maxMb) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error(`${file.name}: only PNG, JPG, WEBP or GIF images`);
  if (file.size > maxMb * MB) throw new Error(`${file.name}: too big (max ${maxMb} MB)`);
}

// ---------- Memories ----------
$("memory-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter; btn.disabled = true;
  try {
    let photo_url = null;
    const file = $("m-photo").files[0];
    if (file) { checkImage(file, 5); photo_url = await uploadPublic("memory-photos", file, extOf(file.name)); }
    const { error } = await supabase.from("memories").insert({
      month_number: Number($("m-month").value), date: $("m-date").value || null,
      title: $("m-title").value.trim(), note: $("m-note").value, photo_url,
    });
    if (error) throw error;
    e.target.reset(); toast("Memory added 🖼️"); loadMemories();
  } catch (err) { toast("Upload failed 🥺 " + err.message); }
  btn.disabled = false;
});

// ---------- Library: bulk upload ----------
$("bulk-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const files = [...$("b-files").files];
  const tags = tagsFrom($("b-tags").value);
  const written_on = $("b-date").value || null;
  const list = $("bulk-progress"); list.innerHTML = "";
  e.submitter.disabled = true;
  for (const file of files) {           // one at a time, so one failure doesn't stop the rest
    const li = document.createElement("li");
    li.textContent = `⏳ ${file.name}`; list.appendChild(li);
    try {
      const ext = extOf(file.name);
      const title = file.name.replace(/\.[^.]+$/, "");
      let row;
      if (ext === "txt" || ext === "md") {
        if (file.size > 1 * MB) throw new Error("text files max 1 MB");
        row = { title, type: ext === "md" ? "markdown" : "text", content: await file.text(), tags, written_on };
      } else {
        checkImage(file, 5);
        row = { title, type: "image", file_url: await uploadPublic("library-files", file, ext), tags, written_on };
      }
      const { error } = await supabase.from("library_items").insert(row);
      if (error) throw error;
      li.textContent = `✅ ${file.name}`;
    } catch (err) { li.textContent = `❌ ${file.name}: ${err.message}`; }
  }
  e.submitter.disabled = false;
  loadLibrary();
});

$("paste-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { error } = await supabase.from("library_items").insert({
    title: $("p-title").value.trim(), type: "text", content: $("p-content").value,
    tags: tagsFrom($("p-tags").value), written_on: $("p-date").value || null,
  });
  if (error) return toast("Couldn't save 🥺 " + error.message);
  e.target.reset(); toast("Added to the library 📚"); loadLibrary();
});

// ---------- Creations ----------
$("creation-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  e.submitter.disabled = true;
  try {
    const file = $("c-file").files[0];
    checkImage(file, 8);
    const image_url = await uploadPublic("creations", file, extOf(file.name));
    const { error } = await supabase.from("creations").insert({ type: $("c-type").value, image_url });
    if (error) throw error;
    e.target.reset(); toast("Added to the Memory Wall 💐"); loadCreations();
  } catch (err) { toast("Upload failed 🥺 " + err.message); }
  e.submitter.disabled = false;
});

// ---------- Manage lists (with delete) ----------
function renderList(el, rows, label, onDelete) {
  el.innerHTML = rows.length ? "" : "<li>Nothing here yet.</li>";
  rows.forEach(row => {
    const li = document.createElement("li");
    li.innerHTML = label(row);
    const del = document.createElement("button");
    del.className = "btn btn--small btn--danger"; del.textContent = "Delete";
    del.setAttribute("aria-label", "Delete " + (row.title || row.type));
    del.addEventListener("click", async () => {
      if (!confirm("Delete this forever?")) return;
      try { await onDelete(row); toast("Deleted"); li.remove(); } catch (err) { toast("Delete failed: " + err.message); }
    });
    li.appendChild(del); el.appendChild(li);
  });
}
const thumb = (url, alt) => url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy">` : "";

async function del(table, row, bucket, urlField) {
  const { error } = await supabase.from(table).delete().eq("id", row.id);
  if (error) throw error;
  if (bucket && row[urlField]) await removePublicFile(bucket, row[urlField]);
}

async function loadMemories() {
  const { data = [] } = await supabase.from("memories").select("*").order("month_number").order("date");
  renderList($("list-memories"), data || [], r => `${thumb(r.photo_url, r.title)}<span>Month ${r.month_number}: ${escapeHtml(r.title)}</span>`,
    r => del("memories", r, "memory-photos", "photo_url"));
}
async function loadLibrary() {
  const { data = [] } = await supabase.from("library_items").select("id,title,type,file_url,tags").order("created_at", { ascending: false });
  renderList($("list-library"), data || [], r => `${thumb(r.file_url, r.title)}<span>${escapeHtml(r.title)} <small>(${r.type}${r.tags.length ? ", " + escapeHtml(r.tags.join(", ")) : ""})</small></span>`,
    r => del("library_items", r, "library-files", "file_url"));
}
async function loadCreations() {
  const { data = [] } = await supabase.from("creations").select("*").order("created_at", { ascending: false });
  renderList($("list-creations"), data || [], r => `${thumb(r.image_url, r.type)}<span>${r.type} · ${formatDate(r.created_at)}</span>`,
    r => del("creations", r, "creations", "image_url"));
}
async function loadLetters() {
  const { data = [] } = await supabase.from("letters").select("id,title,share_slug").order("created_at", { ascending: false });
  renderList($("list-letters"), data || [], r => `<span><a href="letter-view.html?slug=${r.share_slug}">${escapeHtml(r.title)}</a> · <a href="letters.html?edit=${r.id}">edit</a></span>`,
    r => del("letters", r));
}
async function loadSharedReports() {
  const { data, error } = await supabase.from("shared_post_reports")
    .select("id,reason,note,created_at,shared_posts!inner(slug,title)").order("created_at", { ascending: false }).limit(100);
  if (error) {
    console.error("Could not load community post reports.", error);
    $("list-shared-reports").innerHTML = "<li>Reports are unavailable. Check that sql/guest-posts.sql has been run.</li>";
    return;
  }
  renderList($("list-shared-reports"), data || [], report => {
    const post = Array.isArray(report.shared_posts) ? report.shared_posts[0] : report.shared_posts;
    return `<span><strong>${escapeHtml(post?.title || "Deleted post")}</strong> · ${escapeHtml(report.reason)}<br>
      <small>${escapeHtml(report.note || "No details")} · ${formatDate(report.created_at)}</small>
      ${post ? `<br><a href="post.html?slug=${encodeURIComponent(post.slug)}" target="_blank" rel="noopener">View post</a>` : ""}</span>`;
  }, async report => {
    const post = Array.isArray(report.shared_posts) ? report.shared_posts[0] : report.shared_posts;
    if (!post) return;
    const { data: removed, error: removeError } = await supabase.rpc("admin_delete_shared_post", { p_slug: post.slug });
    if (removeError) throw removeError;
    if (!removed) throw new Error("The post could not be removed.");
    await loadSharedReports();
  });
}
function refreshAll() { loadMemories(); loadLibrary(); loadCreations(); loadLetters(); loadSharedReports(); }

showState();
