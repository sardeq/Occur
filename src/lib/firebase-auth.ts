// Native: persist the Firebase session in the same synchronous expo-sqlite
// localStorage that backs the offline cache, wrapped in the async interface
// Firebase expects (no extra AsyncStorage dependency).
import type { FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import type { Auth, Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

import { kv } from './kv';

// Metro resolves @firebase/auth's "react-native" build, which exports this, but
// the package's typings list "types" before "react-native", so TypeScript only
// ever sees the browser declarations.
const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence: (storage: ReactNativeAsyncStorage) => Persistence;
};

const storage: ReactNativeAsyncStorage = {
  getItem: async (key) => kv.getItem(key),
  setItem: async (key, value) => kv.setItem(key, value),
  removeItem: async (key) => kv.removeItem(key),
};

export function createAuth(app: FirebaseApp): Auth {
  return FirebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(storage) });
}
