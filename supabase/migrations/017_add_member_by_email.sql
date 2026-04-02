-- ─── Migration 017: add_member_by_email RPC + avatars bucket ────────────────────────────────────

-- 1. Ensure the avatars storage bucket exists (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Drop and recreate storage policies cleanly
drop policy if exists "Avatars are publicly readable"       on storage.objects;
drop policy if exists "Users can upload their own avatar"   on storage.objects;
drop policy if exists "Users can update their own avatar"   on storage.objects;
drop policy if exists "Users can delete their own avatar"   on storage.objects;

create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 2. add_member_by_email: owner can invite any registered TrackFlow user directly
create or replace function public.add_member_by_email(
  p_board_id  text,
  p_email     text,
  p_role      text default 'viewer'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_email   text;
  v_display text;
  v_color   text;
begin
  -- Only the board owner may invite
  if not exists (
    select 1 from public.board_members
    where board_id = p_board_id
      and user_id  = auth.uid()
      and role     = 'owner'
  ) then
    return jsonb_build_object('error', 'Only the board owner can add members');
  end if;

  -- Find user by email (case-insensitive) in auth.users
  select id, email into v_user_id, v_email
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('error', 'No TrackFlow account found with that email');
  end if;

  if v_user_id = auth.uid() then
    return jsonb_build_object('error', 'You are already the owner of this board');
  end if;

  -- Add or update member row
  insert into public.board_members (board_id, user_id, role)
  values (p_board_id, v_user_id, p_role)
  on conflict (board_id, user_id) do update set role = excluded.role;

  -- Pull profile details
  select display_name, avatar_color into v_display, v_color
  from public.profiles where id = v_user_id;

  return jsonb_build_object(
    'error',        null,
    'user_id',      v_user_id,
    'email',        v_email,
    'display_name', v_display,
    'avatar_color', v_color,
    'role',         p_role
  );
end;
$$;
