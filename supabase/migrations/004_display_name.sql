-- Add display_name to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
