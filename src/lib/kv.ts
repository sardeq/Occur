// Native: expo-sqlite provides a synchronous, persistent `localStorage`.
// It backs both the Firebase session and the offline cache/queue.
import 'expo-sqlite/localStorage/install';

export const kv: Storage = globalThis.localStorage;
