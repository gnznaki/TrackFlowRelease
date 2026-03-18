-- Rename tiers: pro → premium, team → ongoing
-- Run in: Supabase Dashboard → SQL Editor

-- 1. Drop the old check constraint
alter table public.profiles drop constraint if exists profiles_tier_check;

-- 2. Re-add with new valid values (keep old ones during transition)
alter table public.profiles
  add constraint profiles_tier_check
  check (tier in ('free', 'pro', 'team', 'premium', 'ongoing'));

-- 3. Migrate existing rows
update public.profiles set tier = 'premium' where tier = 'pro';
update public.profiles set tier = 'ongoing' where tier = 'team';

-- 4. Tighten constraint to new values only
alter table public.profiles drop constraint profiles_tier_check;
alter table public.profiles
  add constraint profiles_tier_check
  check (tier in ('free', 'premium', 'ongoing'));
