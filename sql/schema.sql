-- =====================================================================
-- Dafny's Diary in Bloom — database setup (Phase 2)
-- Run this ONCE in Supabase: Dashboard -> SQL Editor -> New query -> Run.
--
-- BEFORE running: replace 00000000-0000-0000-0000-000000000000 below with
-- YOUR admin user id (Dashboard -> Authentication -> Users -> your user -> copy "UID").
-- =====================================================================

create extension if not exists pgcrypto;  -- gives us gen_random_bytes() for slugs

-- One place that answers "is the current user the admin?"
-- auth.uid() is the id of whoever is logged in (null for visitors).
create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select coalesce(auth.uid() = 'e6ded616-796d-435d-9f13-91f4a887a4df'::uuid, false)
$$;

-- ---------- TABLES ----------

create table if not exists public.letters (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) <= 200),
  body        text not null default '' check (char_length(body) <= 20000),
  theme       text not null default '{}',          -- JSON: paper, ink color, stickers
  font        text not null default 'caveat',
  song_url    text,                                 -- Spotify embed URL
  open_when   text check (open_when in ('sad','happy','miss','sleep')),
  created_at  timestamptz not null default now(),
  -- 18 random hex characters: unguessable share link
  share_slug  text not null unique default encode(gen_random_bytes(9), 'hex')
);

create table if not exists public.library_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) <= 200),
  type        text not null check (type in ('text','markdown','image')),
  content     text default '',
  file_url    text,
  tags        text[] not null default '{}',
  written_on  date,
  created_at  timestamptz not null default now()
);

create table if not exists public.memories (
  id            uuid primary key default gen_random_uuid(),
  month_number  int not null check (month_number >= 0),
  date          date,
  title         text not null check (char_length(title) <= 200),
  note          text default '',
  photo_url     text
);

create table if not exists public.creations (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('bouquet','photostrip')),
  image_url   text not null,
  created_at  timestamptz not null default now()
);

-- ---------- GRANTS (who may even try) ----------
-- Visitors (anon) may only read. Logged-in users may try to write,
-- but the policies below only let the ADMIN actually succeed.
grant usage on schema public to anon, authenticated;
grant select on public.letters, public.library_items, public.memories, public.creations to anon, authenticated;
grant insert, update, delete on public.letters, public.library_items, public.memories, public.creations to authenticated;
grant all on public.letters, public.library_items, public.memories, public.creations to service_role;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.letters        enable row level security;
alter table public.library_items  enable row level security;
alter table public.memories       enable row level security;
alter table public.creations      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['letters','library_items','memories','creations'] loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('drop policy if exists "admin insert" on public.%I', t);
    execute format('drop policy if exists "admin update" on public.%I', t);
    execute format('drop policy if exists "admin delete" on public.%I', t);
    execute format('create policy "public read"  on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin insert" on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "admin update" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- ---------- STORAGE BUCKETS (public read, size + type limits) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('library-files', 'library-files', true, 5242880,  array['image/png','image/jpeg','image/webp','image/gif','text/plain','text/markdown']),
  ('memory-photos', 'memory-photos', true, 5242880,  array['image/png','image/jpeg','image/webp','image/gif']),
  ('creations',     'creations',     true, 8388608,  array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: anyone reads, only admin writes.
drop policy if exists "diary public read"  on storage.objects;
drop policy if exists "diary admin insert" on storage.objects;
drop policy if exists "diary admin update" on storage.objects;
drop policy if exists "diary admin delete" on storage.objects;

create policy "diary public read" on storage.objects for select to anon, authenticated
  using (bucket_id in ('library-files','memory-photos','creations'));
create policy "diary admin insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('library-files','memory-photos','creations') and public.is_admin());
create policy "diary admin update" on storage.objects for update to authenticated
  using (bucket_id in ('library-files','memory-photos','creations') and public.is_admin());
create policy "diary admin delete" on storage.objects for delete to authenticated
  using (bucket_id in ('library-files','memory-photos','creations') and public.is_admin());

-- Done! Test: open a page while logged out — reading works, saving fails. 🌸
