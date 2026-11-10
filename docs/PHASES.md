# Build guide: phase by phase

Each phase lists: what was built, new concepts, how to test it, common errors, and a challenge.

---
## Phase 0: Architecture and setup
**How it fits together.** Every page is a plain `.html` file. They share:
- **Styles**: every page links `variables.css` → `base.css` → `components.css`, then its own page CSS file.
- **Navbar**: `js/nav.js` injects the same menu into every page.
- **Supabase**: `js/supabaseClient.js` creates ONE client. Pages import it.

**Checklist:** a Supabase project, a public GitHub repo, a local server (`python3 -m http.server 8000` or VS Code Live Server).

---
## Phase 1: Design system, navbar, home, welcome
- **CSS variables** (`--blush`, `--space-3`…) are named values you reuse. Change one and the whole site updates.
- **ES modules** (`type="module"`) let files `import` from each other. They need a server, not `file://`.
- **localStorage** is a small notepad the browser keeps for each site. We use it to remember that she passed the door.

**Test:** answer wrong, then right. The counters should match a calendar.
**Errors:** a blank page means you opened the file directly. Use the local server.
**Challenge:** add a `--lavender` colour token and use it on one card.

---
## Phase 2: Supabase, SQL, RLS, buckets, admin login
Files: `sql/schema.sql`, `sql/guest-posts.sql`, `js/supabaseClient.js`, `js/auth.js`, `pages/admin.html`, `js/admin.js`.
- **Row Level Security (RLS)** means the database checks every request. Our rules: anyone can SELECT, and only `is_admin()` (your user id) can INSERT, UPDATE or DELETE.
- **Anon key vs service_role key**: the anon key is public and limited by RLS. The service_role key skips RLS, so it must never touch the frontend or GitHub.
- **Public buckets**: images get permanent public URLs. Size and type limits are set on each bucket.
- **Guest publishing**: after the main schema, run `sql/guest-posts.sql`. Guests can publish public posts without accounts; database functions limit posting and keep private delete tokens out of public reads.

**Test:**
1. Log in on `pages/admin.html` and add a memory.
2. Log out and open the Memory Wall. You can still see it.
3. Try adding while logged out. It fails.

**Errors:**
- "new row violates row-level security": your UID in `is_admin()` is wrong, or you aren't logged in.
- "Invalid login credentials": the user isn't confirmed. Turn on auto-confirm when adding the user.
- "This room isn't connected": `js/config.js` is missing.

**Challenge:** in the SQL editor, run `select public.is_admin();`. It returns false there, because the editor isn't "you". Can you explain why?

---
## Phase 3: Photobooth
- **getUserMedia** asks for the camera. It only works on https or localhost, and the user must allow it.
- **Canvas** is a drawing surface. We crop each shot to 4:3, apply filters, and draw a strip or six-photo grid.
- If there's no camera or permission is denied, a friendly message appears, and uploading photos still works.

**Test:** take a strip and a six-photo grid, change the filter or frame, then download. Deny camera permission and check the message.
**Errors:** a black video on iPhone means the `<video>` needs `playsinline` (already added).
**Challenge:** add a new frame colour to `FRAMES`.

---
## Phase 4: Letter Room and Spotify
- The Letter Room starts with the open-when shelves and saved letters. The separate four-step composer collects paper, writing, envelope and wax-seal choices, then reviews before publishing. Its flip-card preview updates as you type.
- Guests can publish letters, bouquets, photo strips, memories, and library posts to the public Community Creations feed. Each post has a share link and a private manage/delete link; reports are reviewed in Admin Corner.
- A letter's look and optional recipient/sender are stored as JSON in `theme`. `letterTheme.js` renders it the same way in the preview and viewer.
- **Spotify embeds**: we turn `open.spotify.com/track/ID` into `/embed/track/ID`. No API key needed.
- **Share slugs**: 18 random characters made by the database, so letter links are hard to guess. The Letter Room still lists every letter, so think of slugs as tidy links, not secret ones.
- **Escaping**: every piece of database text goes through `escapeHtml()` so nobody can inject scripts.

**Test:**
1. Publish a letter, open its share link, and try its "Open when…" shelf.
2. Share a bouquet and a photo strip; check they appear on the Memory Wall.
3. Use a private manage link to delete a test post, then submit and review a report in Admin Corner.

**Errors:** "doesn't look like a Spotify link" usually means a shortened `spotify.link` URL. Open it in a browser first, then copy the full link.
**Challenge:** add a seventh paper style.

---
## Phase 5: Library and uploads
- **Bulk upload** loops over the chosen files one at a time, so one bad file doesn't stop the rest.
- `.txt` and `.md` are read in the browser with `file.text()` and stored as text. Images go to the `library-files` bucket.
- **`<dialog>`** gives us a modal with focus trapping and Escape-to-close for free.

**Test:** upload 3 files with tags, then search, filter and turn pages (arrows, buttons or swipe).
**Errors:** "mime type not supported" means the file type isn't allowed by the bucket.
**Challenge:** show a 🌟 on spines tagged "favorite".

---
## Phase 6: Bouquet Builder
- **Pointer Events** use one code path for mouse, finger and pen. `setPointerCapture` keeps the drag going even if the finger slides off the canvas.
- Hit-testing "un-rotates" the tap point to check whether it lands inside a rotated flower.
- The selection outline is hidden while exporting.

**Test:** add flowers, drag, resize, rotate, delete, add a card, then download.
**Errors:** if the page scrolls instead of dragging, the canvas needs `touch-action: none` (already in CSS).
**Challenge:** add a "Duplicate" button.

---
## Phase 7: Memory Wall
Memories are grouped by `month_number`, and the date shown is that monthsary (Sep 11 plus n months). Tap a memory card to flip it and read its note; tap again to return to the photo side. Creations get a filter.
**Test:** tap a memory card (or focus it and press Space/Enter) to reveal its note, then activate it again to return to the front.

**Decision for "Save to Memory Wall":** visitors download PNGs and send them to you, and you upload them as admin (Admin → Creations).
When you're logged in, Save buttons appear in Photobooth and Bouquet. We did NOT allow anonymous uploads, because anyone with the link could fill your storage with spam or upload something nasty.
**Challenge:** show the newest month first.

---
## Phase 8: Polish, accessibility, testing, deploy
- Every page has `noindex`. Decorations use `aria-hidden`, buttons are at least 44px, every form field has a label, and motion turns off with reduced-motion.
- **Phone test:** run `python3 -m http.server 8000`, find your computer's local IP, and open `http://YOUR-IP:8000` on your phone (same Wi-Fi).
  - The camera needs https, so test it on the deployed GitHub Pages site.
- **Deploy:** see README → "Deploy to GitHub Pages".
- **Challenge:** run Lighthouse in Chrome DevTools and fix one suggestion.
