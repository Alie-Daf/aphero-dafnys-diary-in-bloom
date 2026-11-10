// auth.js — admin login helpers. Visitors never log in.
// NOTE: checking "is someone logged in" in the browser only decides which
// buttons to SHOW. The real protection is Row Level Security in the database.
import { supabase } from "./supabaseClient.js";

export async function getUser() {
  if (!supabase) return null;
  // getUser() re-checks the session with Supabase instead of trusting local data.
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}
