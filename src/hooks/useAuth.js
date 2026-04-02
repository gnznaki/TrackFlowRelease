import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  // undefined = still resolving, null = no session, object = signed in
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    // If supabase isn't configured, treat as signed out immediately
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

  async function resetPassword(email) {
    if (!supabase) return { error: new Error("Supabase not configured") };
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }

  // Still resolving session
  const loading = user === undefined;

  // The user's display initial for the avatar
  const initial = user?.email?.[0]?.toUpperCase() ?? null;

  return { user, loading, initial, signIn, signUp, signOut, resetPassword };
}
