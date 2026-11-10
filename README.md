# Dafny's Diary in Bloom

A handmade, scrapbook-style monthsary gift for Dafny. We started on **September 11, 2026**,
so every 11th is our monthsary. It's a cozy little world: one home page and six rooms.

![Screenshot placeholder](assets/images/screenshot-home.png)
<!-- Add your own screenshot later. Make sure it shows nothing private. -->

## Features
- **Welcome door**: a cute secret question (just for fun) that remembers she passed it.
- **Home**: live "days together" counter and a "next monthsary in X days" countdown.
- **Letter Room**: a letter-browsing screen with "Open when…" shelves and a separate four-step composer. Anyone can publish letters; "Open when…" letters appear on their matching shelf and have a public share link.
- **Photobooth**: choose a 2-, 3-, 4- or 6-photo layout, capture with the webcam or upload images, then style and publish a shareable photo strip.
- **Bouquet Builder**: drag, resize, rotate and delete flowers, choose a wrapper and ribbon, add a card, download or publish a shareable bouquet.
- **Memory Wall**: a month-by-month timeline plus a public community feed. Bouquet and photo-strip filters apply to both saved creations and matching community posts. Visitors can publish a memory, letter, bouquet, photo strip, or library post.
- **Library**: curated books and public community writing share a searchable bookshelf with tag and date filters and an inline page-turning reader.
- **Admin page** (`pages/admin.html`, not linked anywhere): owner-only login to manage curated content and review reports on public posts.

## Tech
Plain HTML, CSS and JavaScript (ES modules), no framework. Supabase (database, storage, and the admin's login). Guest community posts are public, limited to five per IP per hour, and image uploads are compressed and stored in the database payload.
The only outside library is the official `supabase-js` client, loaded from esm.sh. Images use the native Canvas API.

## Setup
1. **Supabase**: create a project at supabase.com.
2. **Admin user**: Authentication → Users → *Add user* (your email and a strong password, with auto-confirm on). Copy the user's **UID**.
3. **Database**: open `sql/schema.sql` and replace the example admin UUID in `public.is_admin()` with your Supabase user ID. Paste the whole file into the SQL Editor and click Run.
4. **Guest publishing**: paste `sql/guest-posts.sql` into the Supabase SQL Editor and click Run. This creates the public community feed, post/report functions, and rate limits. Run it after `schema.sql`.
5. **Keys**: copy `js/config.example.js` to `js/config.js` and paste your Project URL and **anon / publishable** key (Settings → API).
6. **Run locally**: `python3 -m http.server 8000` → http://localhost:8000
7. **Log in** at http://localhost:8000/pages/admin.html to manage curated content and review or remove reported community posts.

## Deploy to GitHub Pages
1. Push the project to a **public** GitHub repo, e.g. `dafnys-diary`. Check that `js/config.js` is NOT in the commit (it's git-ignored).
2. Pages needs the config file to exist on the live site. Pick one of these:
   - **Simple:** commit `js/config.js` anyway. The anon key is *meant* to be public, and RLS protects the data. Just never put the service_role key in it.
   - **Tidy:** keep it ignored and use a GitHub Action to write it from repository secrets. The key still ends up public on the live site, so this only keeps it out of the git history.
3. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / root → Save.
4. Wait 1–2 minutes. Your site will be at `https://YOUR-USERNAME.github.io/dafnys-diary/`.
5. In Supabase → Authentication → URL Configuration, add that URL as the Site URL.

## Privacy note
- Community posts and their images are public to anyone with the link and also appear on the Memory Wall. Links get forwarded, and screenshots can't be undone. Visitors do not need an account to post.
- Each guest post includes a separate private manage link containing a secret token. Keep it private; anyone who has it can delete that post. A copy is also stored in that browser's local storage.
- Guest posts are limited to five per IP per hour. This is a basic anti-spam limit, not a substitute for moderation; review reports in the Admin Corner.
- No full names, addresses, phone numbers, school or workplace, or intimate photos. Nothing you'd be upset to see shared.
- The secret question is a ritual, **not security**. The answer is visible in the page source.
- `noindex` and `robots.txt` politely *ask* search engines not to list the site. They don't hide it.
- The repo is public, so never commit passwords, the service_role key, or personal photos in `/assets`.

## Credits
- Fonts: Caveat, Nunito, Indie Flower, Playfair Display and Cormorant Garamond (Google Fonts, Open Font License).
- Interface icons are rendered as inline SVG.
- Database and storage: Supabase.
- Made with love by me, for Dafny.
