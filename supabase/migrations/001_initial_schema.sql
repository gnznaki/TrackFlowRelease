-- TrackFlow initial schema
-- Run this in: Supabase Dashboard → SQL Editor

-- ─────────────────────────────────────────────────────────────
-- PROFILES
-- One row per user. Auto-created by trigger on signup.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  tier         text not null default 'free' check (tier in ('free', 'pro', 'team')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- APP STATE
-- One row per user. Stores the full serialized board state.
-- Phase 2: storage.js will upsert here on every save.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.app_state (
  id             uuid primary key references auth.users(id) on delete cascade,
  state          jsonb not null default '{}',
  schema_version int  not null default 2,
  updated_at     timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "Users can read own state"
  on public.app_state for select
  using (auth.uid() = id);

create policy "Users can upsert own state"
  on public.app_state for all
  using (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- BOARD MEMBERS (Phase 3: collaboration)
-- Links users to shared boards with a role.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.board_members (
  id         uuid primary key default gen_random_uuid(),
  board_id   text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (board_id, user_id)
);

alter table public.board_members enable row level security;

create policy "Members can read their own memberships"
  on public.board_members for select
  using (auth.uid() = user_id);

create policy "Owners can manage board memberships"
  on public.board_members for all
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.board_members bm
      where bm.board_id = board_members.board_id
        and bm.user_id = auth.uid()
        and bm.role = 'owner'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- HELPERS
-- ─────────────────────────────────────────────────────────────

-- Auto-update updated_at on any row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger app_state_updated_at
  before update on public.app_state
  for each row execute procedure public.set_updated_at();

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
