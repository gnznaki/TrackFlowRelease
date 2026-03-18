-- Fix tier constraint: drop old values, add 'premium', migrate 'pro' → 'premium'
-- Run in: Supabase Dashboard → SQL Editor

-- 1. Drop whatever check constraint exists
alter table public.profiles drop constraint if exists profiles_tier_check;

-- 2. Allow both old and new values during migration
alter table public.profiles
  add constraint profiles_tier_check
  check (tier in ('free', 'pro', 'team', 'premium', 'ongoing'));

-- 3. Migrate old tier names → new ones
update public.profiles set tier = 'premium' where tier = 'pro';
update public.profiles set tier = 'premium' where tier = 'team';
update public.profiles set tier = 'premium' where tier = 'ongoing';

-- 4. Tighten to final allowed values
alter table public.profiles drop constraint profiles_tier_check;
alter table public.profiles
  add constraint profiles_tier_check
  check (tier in ('free', 'premium'));
