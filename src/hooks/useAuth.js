import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const OFFLINE_KEY = "trackflow-offline-mode";

export function useAuth() {
  // undefined = still resolving, null = no session, object = signed in
  const [user, setUser] = useState(undefined);
  const [isOffline, setIsOffline] = useState(
    () => localStorage.getItem(OFFLINE_KEY) === "true"
  );

  useEffect(() => {
    // If supabase isn't configured, treat as offline immediately
    if (!supabase) {
      setUser(null);
      return;
    }

    // Restore existing session (instant if token is in localStorage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Keep in sync across tabs / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    if (!supabase) return { error: new Error("Supabase not configured") };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp(email, password) {
    if (!supabase) return { error: new Error("Supabase not configured") };
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }

  function goOffline() {
    localStorage.setItem(OFFLINE_KEY, "true");
    setIsOffline(true);
  }

  function leaveOffline() {
    localStorage.removeItem(OFFLINE_KEY);
    setIsOffline(false);
  }

  // Still resolving session — only block if not already in offline mode
  const loading = user === undefined && !isOffline;

  // The user's display initial for the avatar
  const initial = user?.email?.[0]?.toUpperCase() ?? null;

  return { user, loading, isOffline, initial, signIn, signUp, signOut, goOffline, leaveOffline };
}
