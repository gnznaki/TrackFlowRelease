-- Phase 4: Stripe billing
-- Run this in: Supabase Dashboard → SQL Editor

-- Add Stripe customer ID to profiles
alter table public.profiles
  add column if not exists stripe_customer_id text;

-- Enable Realtime on profiles so useTier hook receives live tier updates
-- after the Stripe webhook fires
alter publication supabase_realtime add table public.profiles;
