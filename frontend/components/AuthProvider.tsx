"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { isSampleMode, setAccessTokenProvider } from "@/lib/api";

type AuthValue = { session: Session | null; signOut: () => Promise<void>; mode: "sample" | "local" | "supabase" };
const AuthContext = createContext<AuthValue>({ session: null, signOut: async () => {}, mode: "local" });
export const useAuth = () => useContext(AuthContext);

function SignIn() {
  const client = getSupabaseBrowserClient();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(null);
    const result = signup
      ? await client.auth.signUp({ email, password })
      : await client.auth.signInWithPassword({ email, password });
    if (result.error) setMessage(`${result.error.message} Check your details and try again.`);
    else if (signup && !result.data.session) setMessage("Account created. Check your email to confirm it, then sign in.");
    setBusy(false);
  }
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-border bg-surface p-6 sm:p-8" aria-labelledby="auth-title">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-semibold text-accent-foreground">V</span>
          <div><h1 id="auth-title" className="text-xl font-semibold">{signup ? "Create your VPO account" : "Sign in to VPO Studio"}</h1><p className="mt-1 text-sm text-muted">Your runs, Brand kit and media stay with your account.</p></div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-accent" /></label>
          <label className="block text-sm font-medium">Password<input type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-accent" /></label>
          {message && <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">{message}</p>}
          <button disabled={busy} className="min-h-11 w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground disabled:opacity-60">{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</button>
        </form>
        <button type="button" onClick={() => { setSignup((v) => !v); setMessage(null); }} className="mt-4 min-h-11 w-full rounded-lg text-sm text-muted underline underline-offset-4">{signup ? "Already have an account? Sign in" : "New here? Create an account"}</button>
      </section>
    </main>
  );
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const mode: AuthValue["mode"] = isSampleMode() ? "sample" : process.env.NEXT_PUBLIC_AUTH_MODE === "supabase" ? "supabase" : "local";
  const configured = useMemo(() => {
    if (mode !== "supabase") return { client: null, error: null };
    try { return { client: getSupabaseBrowserClient(), error: null }; }
    catch (e) { return { client: null, error: e instanceof Error ? e.message : "Supabase sign-in is not configured." }; }
  }, [mode]);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(mode !== "supabase" || !!configured.error);
  const [sessionError, setSessionError] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== "supabase") { setAccessTokenProvider(null); return; }
    const client = configured.client;
    if (!client) return;
    setAccessTokenProvider(async () => (await client.auth.getSession()).data.session?.access_token ?? null);
    void client.auth.getSession().then(({ data, error }) => { if (error) setSessionError(error.message); setSession(data.session); setReady(true); });
    const { data } = client.auth.onAuthStateChange((_event, next) => { setSession(next); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, [mode, configured]);
  const value = useMemo<AuthValue>(() => ({ session, mode, signOut: async () => { if (mode === "supabase") await getSupabaseBrowserClient().auth.signOut({ scope: "local" }); } }), [session, mode]);
  if (!ready) return <main className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center px-4"><p role="status" className="text-sm text-muted">Restoring your secure session…</p></main>;
  const authError = configured.error ?? sessionError;
  if (authError) return <main className="mx-auto max-w-lg px-4 py-16"><div role="alert" className="rounded-xl border border-warning/40 bg-surface p-5"><h1 className="font-semibold">Sign-in setup is incomplete</h1><p className="mt-2 text-sm text-muted">{authError}</p></div></main>;
  if (mode === "supabase" && !session) return <SignIn />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
