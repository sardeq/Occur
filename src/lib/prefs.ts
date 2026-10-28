import { create } from 'zustand';

import { kv } from './kv';

/**
 * Device-level preferences (not synced): how the app looks and how the home
 * screen is laid out. Stored in the same persistent kv as the offline cache.
 */
export type ThemePref = 'system' | 'light' | 'dark';
export type HomeStyle = 'bubbles' | 'list';

type Prefs = { theme: ThemePref; homeStyle: HomeStyle };

const KEY = 'occur.prefs.v1';
const defaults: Prefs = { theme: 'system', homeStyle: 'bubbles' };

function load(): Prefs {
  try {
    const raw = kv.getItem(KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'system',
      homeStyle: p.homeStyle === 'list' ? 'list' : 'bubbles',
    };
  } catch {
    return defaults;
  }
}

export const usePrefs = create<Prefs>(() => load());

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  usePrefs.setState({ [key]: value } as Pick<Prefs, K>);
  try {
    kv.setItem(KEY, JSON.stringify(usePrefs.getState()));
  } catch {}
}
