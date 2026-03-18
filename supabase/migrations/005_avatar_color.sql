-- Add avatar_color to profiles (stores one of the AVATAR_GRADIENTS keys)
alter table public.profiles
  add column if not exists avatar_color text default 'lime';
