import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { create } from 'zustand';

import { kv } from './kv';
import { isSupabaseConfigured, supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'demo';

export type AppUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
};

type AuthState = {
  status: AuthStatus;
  user: AppUser | null;
  session: Session | null;
};

export const useAuth = create<AuthState>(() => ({ status: 'loading', user: null, session: null }));

const DEMO_KEY = 'occur:demo';
export const DEMO_USER: AppUser = { id: 'demo', email: null, name: 'Demo', avatarUrl: null, isAnonymous: true };

function toUser(session: Session | null): AppUser | null {
  const u = session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, any>;
  return {
    id: u.id,
    email: u.email ?? null,
    name: meta.full_name ?? meta.name ?? null,
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
    isAnonymous: Boolean((u as any).is_anonymous),
  };
}

function setSession(session: Session | null) {
  useAuth.setState({ session, user: toUser(session), status: session ? 'signedIn' : 'signedOut' });
}

let booted = false;
export async function bootAuth() {
  if (booted) return;
  booted = true;
  if (process.env.EXPO_PUBLIC_DEMO === '1' || kv.getItem(DEMO_KEY) === '1') {
    useAuth.setState({ status: 'demo', user: DEMO_USER, session: null });
    return;
  }
  if (!isSupabaseConfigured) {
    useAuth.setState({ status: 'signedOut', user: null, session: null });
    return;
  }
  supabase.auth.onAuthStateChange((_event, session) => {
    if (useAuth.getState().status === 'demo') return;
    setSession(session);
  });
  const { data } = await supabase.auth.getSession();
  setSession(data.session);
}

/** Pulls the PKCE code (or legacy tokens) out of an OAuth redirect URL. */
export async function completeAuthFromUrl(url: string) {
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.includes('?') ? beforeHash.slice(beforeHash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  new URLSearchParams(hash).forEach((v, k) => params.set(k, v));

  const err = params.get('error_description') ?? params.get('error');
  if (err) throw new Error(err.replace(/\+/g, ' '));

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return true;
  }
  return false;
}

export function authRedirectUrl() {
  return Linking.createURL('auth/callback');
}

async function runBrowserFlow(url: string, redirectTo: string): Promise<boolean> {
  const res = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (res.type !== 'success') return false; // user cancelled
  return completeAuthFromUrl(res.url);
}

/**
 * Google via Supabase OAuth inside ASWebAuthenticationSession (the iOS system
 * sign-in sheet). Works in Expo Go and production builds alike.
 */
export async function signInWithGoogle(): Promise<boolean> {
  if (!isSupabaseConfigured)
    throw new Error('Supabase is not configured. Add your keys to .env.local, or explore the demo.');
  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
  return runBrowserFlow(data.url, redirectTo);
}

/** Try the app without an account (Supabase anonymous user). Can be upgraded to Google later. */
export async function continueAsGuest(): Promise<void> {
  if (!isSupabaseConfigured) return startDemo();
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

/** Upgrade a guest account to Google, keeping all data (same user id). */
export async function linkGoogle(): Promise<boolean> {
  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) return false;
  const ok = await runBrowserFlow(data.url, redirectTo);
  if (ok) {
    const { data: s } = await supabase.auth.refreshSession();
    setSession(s.session);
  }
  return ok;
}

/** Local-only demo with sample data — no backend required. */
export async function startDemo() {
  kv.setItem(DEMO_KEY, '1');
  useAuth.setState({ status: 'demo', user: DEMO_USER, session: null });
}

export async function signOut() {
  const { status } = useAuth.getState();
  if (status === 'demo') {
    kv.removeItem(DEMO_KEY);
    useAuth.setState({ status: 'signedOut', user: null, session: null });
    return;
  }
  await supabase.auth.signOut();
  setSession(null);
}
