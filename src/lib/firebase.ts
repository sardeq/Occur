import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

import { createAuth } from './firebase-auth';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

/** When false the app runs in local demo mode (no backend, data stays on device). */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

// Created lazily: Firebase throws on an empty API key, and demo mode never needs it.
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function firebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured');
  if (!app) app = getApps().length ? getApp() : initializeApp(config);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = createAuth(firebaseApp());
  return auth;
}

export function getDb(): Firestore {
  if (!db) {
    // No persistent cache on React Native (no IndexedDB): the app keeps its own
    // offline cache and mutation queue in store.ts.
    db = initializeFirestore(firebaseApp(), { ignoreUndefinedProperties: true });
  }
  return db;
}
