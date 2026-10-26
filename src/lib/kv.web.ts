// Web (used for quick previews): the browser's own localStorage.
const memory = new Map<string, string>();
const fallback: Storage = {
  get length() {
    return memory.size;
  },
  clear: () => memory.clear(),
  getItem: (k) => memory.get(k) ?? null,
  key: (i) => [...memory.keys()][i] ?? null,
  removeItem: (k) => void memory.delete(k),
  setItem: (k, v) => void memory.set(k, v),
};

export const kv: Storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : fallback;
