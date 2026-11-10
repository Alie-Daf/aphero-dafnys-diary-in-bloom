-- Guest publishing for the public community wall.
-- Run after sql/schema.sql in the Supabase SQL Editor.

create table if not exists public.shared_posts (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique default encode(gen_random_bytes(9), 'hex'),
  kind       text not null check (kind in ('letter', 'bouquet', 'photostrip', 'memory', 'library')),
  title      text not null check (char_length(title) between 1 and 200),
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.shared_post_owners (
  post_id    uuid primary key references public.shared_posts(id) on delete cascade,
  token_hash text not null
);

create table if not exists public.guest_post_limits (
  ip_hash      text not null,
  window_start timestamptz not null,
  post_count   integer not null default 0,
  primary key (ip_hash, window_start)
);

create table if not exists public.shared_post_reports (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.shared_posts(id) on delete cascade,
  reason     text not null check (reason in ('spam', 'inappropriate', 'private_info', 'other')),
  note       text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

alter table public.shared_posts enable row level security;
alter table public.shared_post_owners enable row level security;
alter table public.guest_post_limits enable row level security;
alter table public.shared_post_reports enable row level security;

drop policy if exists "shared posts are public" on public.shared_posts;
create policy "shared posts are public" on public.shared_posts
  for select to anon, authenticated using (true);

drop policy if exists "admins read shared post reports" on public.shared_post_reports;
create policy "admins read shared post reports" on public.shared_post_reports
  for select to authenticated using (public.is_admin());

revoke all on public.shared_posts, public.shared_post_owners, public.guest_post_limits, public.shared_post_reports from anon, authenticated;
grant select on public.shared_posts to anon, authenticated;
grant select on public.shared_post_reports to authenticated;

create or replace function public.create_shared_post(
  p_kind text,
  p_title text,
  p_payload jsonb,
  p_owner_token text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_headers jsonb;
  v_ip text;
  v_ip_hash text;
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
  v_id uuid;
  v_slug text;
begin
  if p_kind not in ('letter', 'bouquet', 'photostrip', 'memory', 'library') then
    raise exception 'Unsupported post type.';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 200 then
    raise exception 'Title must be between 1 and 200 characters.';
  end if;
  if coalesce(jsonb_typeof(p_payload), '') <> 'object'
     or octet_length(p_payload::text) > 900000 then
    raise exception 'Post content is invalid or too large.';
  end if;
  if coalesce(p_owner_token, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid owner token.';
  end if;

  v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_ip := split_part(coalesce(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', 'unknown'), ',', 1);
  v_ip_hash := encode(digest(convert_to(v_ip, 'UTF8'), 'sha256'), 'hex');
  delete from public.guest_post_limits where window_start < v_window - interval '48 hours';

  insert into public.guest_post_limits (ip_hash, window_start, post_count)
  values (v_ip_hash, v_window, 1)
  on conflict (ip_hash, window_start) do update
    set post_count = public.guest_post_limits.post_count + 1
  returning post_count into v_count;
  if v_count > 5 then
    raise exception 'Posting limit reached. Please try again later.';
  end if;

  insert into public.shared_posts (kind, title, payload)
  values (p_kind, trim(p_title), p_payload)
  returning id, slug into v_id, v_slug;

  insert into public.shared_post_owners (post_id, token_hash)
  values (v_id, encode(digest(convert_to(p_owner_token, 'UTF8'), 'sha256'), 'hex'));

  return jsonb_build_object('slug', v_slug);
end;
$$;

create or replace function public.delete_shared_post(p_slug text, p_owner_token text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(p_owner_token, '') !~ '^[0-9a-f]{64}$' then return false; end if;
  select p.id into v_id
  from public.shared_posts p
  join public.shared_post_owners o on o.post_id = p.id
  where p.slug = p_slug
    and o.token_hash = encode(digest(convert_to(p_owner_token, 'UTF8'), 'sha256'), 'hex');
  if v_id is null then return false; end if;
  delete from public.shared_posts where id = v_id;
  return true;
end;
$$;

create or replace function public.report_shared_post(p_slug text, p_reason text, p_note text default '')
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_headers jsonb;
  v_ip text;
  v_ip_hash text;
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
  v_id uuid;
begin
  if p_reason not in ('spam', 'inappropriate', 'private_info', 'other') then
    raise exception 'Choose a valid report reason.';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception 'Report note must be 500 characters or fewer.';
  end if;
  select id into v_id from public.shared_posts where slug = p_slug;
  if v_id is null then return false; end if;

  v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_ip := split_part(coalesce(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', 'unknown'), ',', 1);
  v_ip_hash := encode(digest(convert_to('report:' || v_ip, 'UTF8'), 'sha256'), 'hex');
  delete from public.guest_post_limits where window_start < v_window - interval '48 hours';
  insert into public.guest_post_limits (ip_hash, window_start, post_count)
  values (v_ip_hash, v_window, 1)
  on conflict (ip_hash, window_start) do update
    set post_count = public.guest_post_limits.post_count + 1
  returning post_count into v_count;
  if v_count > 10 then
    raise exception 'Report limit reached. Please try again later.';
  end if;

  insert into public.shared_post_reports (post_id, reason, note)
  values (v_id, p_reason, trim(coalesce(p_note, '')));
  return true;
end;
$$;

create or replace function public.admin_delete_shared_post(p_slug text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_deleted bigint;
begin
  if not public.is_admin() then
    raise exception 'Only the site owner can remove reported posts.';
  end if;
  delete from public.shared_posts where slug = p_slug;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.create_shared_post(text, text, jsonb, text) from public;
revoke all on function public.delete_shared_post(text, text) from public;
revoke all on function public.report_shared_post(text, text, text) from public;
revoke all on function public.admin_delete_shared_post(text) from public;
grant execute on function public.create_shared_post(text, text, jsonb, text) to anon, authenticated;
grant execute on function public.delete_shared_post(text, text) to anon, authenticated;
grant execute on function public.report_shared_post(text, text, text) to anon, authenticated;
grant execute on function public.admin_delete_shared_post(text) to authenticated;
