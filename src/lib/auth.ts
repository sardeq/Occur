import { onAuthStateChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { create } from 'zustand';

import { getFirebaseAuth, isFirebaseConfigured } from './firebase';
import { signInWithGoogleFirebase, signOutGoogle } from './google-sign-in';
import { getLang } from './i18n';
import { kv } from './kv';

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
};

export const useAuth = create<AuthState>(() => ({ status: 'loading', user: null }));

const DEMO_KEY = 'occur:demo';
export const DEMO_USER: AppUser = { id: 'demo', email: null, name: 'Demo', avatarUrl: null, isAnonymous: true };

function toUser(u: User | null): AppUser | null {
  if (!u) return null;
  return {
    id: u.uid,
    email: u.email,
    name: u.displayName,
    avatarUrl: u.photoURL,
    isAnonymous: u.isAnonymous,
  };
}

function setFirebaseUser(u: User | null) {
  useAuth.setState({ user: toUser(u), status: u ? 'signedIn' : 'signedOut' });
}

let booted = false;
export async function bootAuth() {
  if (booted) return;
  booted = true;
  const demo = process.env.EXPO_PUBLIC_DEMO === '1' || kv.getItem(DEMO_KEY) === '1';
  if (demo) useAuth.setState({ status: 'demo', user: DEMO_USER });
  if (!isFirebaseConfigured) {
    if (!demo) useAuth.setState({ status: 'signedOut', user: null });
    return;
  }
  try {
    const auth = getFirebaseAuth();
    // Listen even in demo mode, so signing in with Google after leaving the demo works.
    // The first callback fires once the persisted session has been restored.
    onAuthStateChanged(auth, (u) => {
      if (useAuth.getState().status === 'demo') return;
      setFirebaseUser(u);
    });
  } catch {
    if (!demo) setFirebaseUser(null);
  }
}

/** A fresh Firebase ID token for calling our own backend, or null when signed out. */
export async function getIdToken(): Promise<string | null> {
  if (!isFirebaseConfigured) return null;
  const u = getFirebaseAuth().currentUser;
  return u ? u.getIdToken() : null;
}

/**
 * Google via the native Google Sign-In SDK, exchanged for a Firebase session.
 * Needs a development build (not Expo Go). Returns false if cancelled.
 */
export async function signInWithGoogle(): Promise<boolean> {
  if (!isFirebaseConfigured)
    throw new Error(
      getLang() === 'ar'
        ? 'لم يُضبط Firebase بعد. أضف مفاتيحك إلى ‎.env، أو استكشف التجربة.'
        : 'Firebase is not configured. Add your keys to .env, or explore the demo.',
    );
  return signInWithGoogleFirebase(getFirebaseAuth());
}

/**
 * "Try it without an account": a local-only demo with sample data. Never
 * touches the network, so it works offline or without Firebase configured.
 */
export async function startDemo() {
  kv.setItem(DEMO_KEY, '1');
  useAuth.setState({ status: 'demo', user: DEMO_USER });
}

export async function signOut() {
  const { status } = useAuth.getState();
  if (status === 'demo') {
    kv.removeItem(DEMO_KEY);
    useAuth.setState({ status: 'signedOut', user: null });
    return;
  }
  await Promise.all([firebaseSignOut(getFirebaseAuth()), signOutGoogle()]);
  setFirebaseUser(null);
}
