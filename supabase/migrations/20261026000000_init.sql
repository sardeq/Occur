-- Occur — "How many times, and when?"
-- Two tables. Everything is owned by auth.uid() and guarded by RLS.
-- IDs are generated on the device so taps can be recorded offline and
-- replayed later without creating duplicates (upserts are idempotent).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- categories: the things a user counts ("Coffee", "Smoking", "Headache"…)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (char_length(trim(name)) between 1 and 40),
  emoji           text not null default '•' check (char_length(emoji) <= 16),
  color           text not null default 'apricot',
  -- what the user wants from this count: just observe, do it more, do it less.
  -- Drives how deltas are coloured (more coffee ≠ good, more reading = good).
  goal            text not null default 'track' check (goal in ('track', 'more', 'less')),
  track_location  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists categories_user_name_key
  on public.categories (user_id, lower(name));
create index if not exists categories_user_idx on public.categories (user_id);

-- ---------------------------------------------------------------------------
-- events: one row per tap
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id   uuid not null references public.categories (id) on delete cascade,
  occurred_at   timestamptz not null default now(),
  -- IANA zone the device was in when the event happened, so "what hour do I
  -- usually…" stays correct even after the user travels.
  tz            text,
  latitude      double precision check (latitude between -90 and 90),
  longitude     double precision check (longitude between -180 and 180),
  place         text check (char_length(place) <= 120),
  note          text check (char_length(note) <= 280),
  source        text not null default 'tap' check (source in ('tap', 'manual', 'import')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists events_user_time_idx on public.events (user_id, occurred_at desc);
create index if not exists events_category_time_idx on public.events (category_id, occurred_at desc);

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists categories_touch on public.categories;
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.events enable row level security;

drop policy if exists "own categories: read" on public.categories;
drop policy if exists "own categories: insert" on public.categories;
drop policy if exists "own categories: update" on public.categories;
drop policy if exists "own categories: delete" on public.categories;

create policy "own categories: read" on public.categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own categories: insert" on public.categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own categories: update" on public.categories
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "own categories: delete" on public.categories
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own events: read" on public.events;
drop policy if exists "own events: insert" on public.events;
drop policy if exists "own events: update" on public.events;
drop policy if exists "own events: delete" on public.events;

create policy "own events: read" on public.events
  for select to authenticated using (user_id = (select auth.uid()));
-- an event may only point at one of the caller's own categories
create policy "own events: insert" on public.events
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.categories c
                where c.id = category_id and c.user_id = (select auth.uid()))
  );
create policy "own events: update" on public.events
  for update to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.categories c
                where c.id = category_id and c.user_id = (select auth.uid()))
  );
create policy "own events: delete" on public.events
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Server-side summary (handy for SQL consumers / future widgets).
-- The app computes stats on-device from its synced cache, but this gives the
-- same numbers straight from Postgres, in the caller's time zone.
-- ---------------------------------------------------------------------------
create or replace function public.category_summary(p_tz text default 'UTC')
returns table (
  category_id uuid,
  today bigint,
  this_week bigint,
  this_month bigint,
  all_time bigint,
  last_event timestamptz
)
language sql stable security invoker as $$
  with bounds as (
    select
      (date_trunc('day',   now() at time zone p_tz)) at time zone p_tz as d,
      (date_trunc('week',  now() at time zone p_tz)) at time zone p_tz as w,
      (date_trunc('month', now() at time zone p_tz)) at time zone p_tz as m
  )
  select
    c.id,
    count(e.id) filter (where e.occurred_at >= b.d),
    count(e.id) filter (where e.occurred_at >= b.w),
    count(e.id) filter (where e.occurred_at >= b.m),
    count(e.id),
    max(e.occurred_at)
  from public.categories c
  cross join bounds b
  left join public.events e on e.category_id = c.id
  where c.user_id = (select auth.uid())
  group by c.id;
$$;

grant execute on function public.category_summary(text) to authenticated;
