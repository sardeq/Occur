import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { kv } from './kv';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** When false the app runs in local demo mode (no backend, data stays on device). */
export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient(url || 'http://localhost:54321', key || 'public-anon-key', {
  auth: {
    storage: kv,
    autoRefreshToken: isSupabaseConfigured,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE: the OAuth redirect carries a one-time code, not tokens
    flowType: 'pkce',
  },
});

// Only refresh tokens while the app is in the foreground.
if (Platform.OS !== 'web' && isSupabaseConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
