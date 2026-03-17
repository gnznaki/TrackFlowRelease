import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    "[TrackFlow] Supabase credentials not set. Copy .env.example → .env and fill in your project URL and anon key. Auth features will be unavailable until then."
  );
}

// null when credentials are missing — all consumers must guard against this
export const supabase = url && key ? createClient(url, key) : null;
