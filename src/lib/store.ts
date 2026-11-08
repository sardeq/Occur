/**
 * Local-first data store.
 *
 * Every write (tap, edit, delete) is applied to this in-memory store
 * immediately — the UI never waits for the network — and appended to a
 * persistent mutation queue. The queue is replayed against Firestore in order,
 * with retries and backoff. IDs are generated on the device, so replays are
 * idempotent upserts: tapping 20 times in airplane mode just works.
 *
 * The whole state (categories, events, queue) is cached in local storage per
 * user, so the app opens instantly with the last known data.
 *
 * Firestore layout: users/{uid}/categories/{id} and users/{uid}/events/{id}.
 * Every write stamps `updated_at` with the server time, and deletes leave a
 * tiny tombstone ({ deleted, updated_at }) instead of removing the doc. That
 * lets a pull fetch only what changed since the last one (one read per changed
 * doc, not one per doc in the account), deletes from other devices included.
 */
import * as Crypto from 'expo-crypto';
import {
  collection,
  doc,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase/firestore';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { getDb, getFirebaseAuth, isFirebaseConfigured } from './firebase';
import { kv } from './kv';
import { captureLocation } from './location';
import { deviceTimeZone } from './time';
import type { Category, Goal, OccurEvent } from './types';

// ---------------------------------------------------------------------------
// rows <-> models
// ---------------------------------------------------------------------------

type CategoryRow = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  goal: Goal;
  track_location: boolean;
  created_at: string;
  updated_at?: string;
};

type EventRow = {
  id: string;
  category_id: string;
  occurred_at: string;
  tz: string | null;
  latitude: number | null;
  longitude: number | null;
  place: string | null;
  note: string | null;
  source: OccurEvent['source'];
};

const toCategoryRow = (c: Category): CategoryRow => ({
  id: c.id,
  name: c.name,
  emoji: c.emoji,
  color: c.color,
  goal: c.goal,
  track_location: c.trackLocation,
  created_at: c.createdAt,
});

const fromCategoryRow = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  color: r.color,
  goal: r.goal,
  trackLocation: r.track_location,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toEventRow = (e: OccurEvent): EventRow => ({
  id: e.id,
  category_id: e.categoryId,
  occurred_at: e.occurredAt,
  tz: e.tz ?? null,
  latitude: e.latitude ?? null,
  longitude: e.longitude ?? null,
  place: e.place ?? null,
  note: e.note ?? null,
  source: e.source,
});

const fromEventRow = (r: EventRow): OccurEvent => ({
  id: r.id,
  categoryId: r.category_id,
  occurredAt: new Date(r.occurred_at).toISOString(),
  tz: r.tz,
  latitude: r.latitude,
  longitude: r.longitude,
  place: r.place,
  note: r.note,
  source: r.source,
});

// ---------------------------------------------------------------------------
// mutation queue
// ---------------------------------------------------------------------------

export type Mutation =
  | { kind: 'upsertCategory'; id: string; row: CategoryRow }
  | { kind: 'deleteCategory'; id: string }
  | { kind: 'upsertEvent'; id: string; row: EventRow }
  | { kind: 'deleteEvent'; id: string };

type Mode = 'remote' | 'local';

/** Server time of the newest change already pulled, per collection. */
type Cursor = { s: number; ns: number };
type Cursors = { categories: Cursor | null; events: Cursor | null };

type DataState = {
  userId: string | null;
  mode: Mode;
  hydrated: boolean;
  categories: Category[];
  /** sorted ascending by occurredAt */
  events: OccurEvent[];
  queue: Mutation[];
  syncing: boolean;
  lastSyncedAt: string | null;
  cursors: Cursors;
  syncError: string | null;
};

const initial: DataState = {
  userId: null,
  mode: 'remote',
  hydrated: false,
  categories: [],
  events: [],
  queue: [],
  syncing: false,
  lastSyncedAt: null,
  cursors: { categories: null, events: null },
  syncError: null,
};

export const useData = create<DataState>(() => ({ ...initial }));

const set = useData.setState;
const get = useData.getState;

const cacheKey = (uid: string) => `occur:v1:${uid}`;
const byTime = (a: OccurEvent, b: OccurEvent) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt);

function insertSorted(list: OccurEvent[], e: OccurEvent): OccurEvent[] {
  const t = Date.parse(e.occurredAt);
  let i = list.length;
  while (i > 0 && Date.parse(list[i - 1].occurredAt) > t) i--;
  return [...list.slice(0, i), e, ...list.slice(i)];
}

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------

let persistTimer: ReturnType<typeof setTimeout> | null = null;
useData.subscribe((s, prev) => {
  if (!s.userId || !s.hydrated) return;
  if (
    s.categories === prev.categories &&
    s.events === prev.events &&
    s.queue === prev.queue &&
    s.lastSyncedAt === prev.lastSyncedAt &&
    s.cursors === prev.cursors
  )
    return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const { userId, categories, events, queue, lastSyncedAt, cursors } = get();
    if (!userId) return;
    try {
      kv.setItem(cacheKey(userId), JSON.stringify({ categories, events, queue, lastSyncedAt, cursors }));
    } catch (err) {
      console.warn('cache write failed', err);
    }
  }, 300);
});

// ---------------------------------------------------------------------------
// lifecycle
// ---------------------------------------------------------------------------

export function initData(userId: string, mode: Mode, seed?: () => { categories: Category[]; events: OccurEvent[] }) {
  if (get().userId === userId && get().hydrated) return;
  let cached: Partial<DataState> = {};
  let raw: string | null = null;
  try {
    raw = kv.getItem(cacheKey(userId));
    if (raw) cached = JSON.parse(raw);
  } catch {
    cached = {};
  }
  // seed only on the very first run, so "delete everything" really empties it
  if (!raw && seed) cached = { ...cached, ...seed() };
  set({
    ...initial,
    userId,
    mode,
    hydrated: true,
    categories: cached.categories ?? [],
    events: (cached.events ?? []).slice().sort(byTime),
    queue: cached.queue ?? [],
    lastSyncedAt: cached.lastSyncedAt ?? null,
    cursors: cached.cursors ?? initial.cursors,
  });
  if (mode === 'remote') void sync();
}

export function resetData() {
  if (persistTimer) clearTimeout(persistTimer);
  set({ ...initial });
}

export function wipeLocalCache(userId: string) {
  kv.removeItem(cacheKey(userId));
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

export type CategoryInput = {
  name: string;
  emoji: string;
  color: string;
  goal: Goal;
  trackLocation: boolean;
};

export function addCategory(input: CategoryInput): Category {
  const c: Category = {
    id: Crypto.randomUUID(),
    ...input,
    name: input.name.trim(),
    createdAt: new Date().toISOString(),
  };
  set((s) => ({ categories: [...s.categories, c] }));
  enqueue({ kind: 'upsertCategory', id: c.id, row: toCategoryRow(c) });
  return c;
}

export function updateCategory(id: string, patch: Partial<CategoryInput>) {
  const cur = get().categories.find((c) => c.id === id);
  if (!cur) return;
  const next: Category = { ...cur, ...patch, name: (patch.name ?? cur.name).trim() };
  set((s) => ({ categories: s.categories.map((c) => (c.id === id ? next : c)) }));
  enqueue({ kind: 'upsertCategory', id, row: toCategoryRow(next) });
}

export function deleteCategory(id: string) {
  set((s) => ({
    categories: s.categories.filter((c) => c.id !== id),
    events: s.events.filter((e) => e.categoryId !== id),
  }));
  enqueue({ kind: 'deleteCategory', id });
}

/** The one-tap action. Returns the event so the UI can offer Undo. */
export function logEvent(categoryId: string, at: Date = new Date(), source: OccurEvent['source'] = 'tap'): OccurEvent {
  const e: OccurEvent = {
    id: Crypto.randomUUID(),
    categoryId,
    occurredAt: at.toISOString(),
    tz: deviceTimeZone(),
    source,
  };
  set((s) => ({ events: insertSorted(s.events, e) }));
  enqueue({ kind: 'upsertEvent', id: e.id, row: toEventRow(e) });

  // Location is captured *after* the tap is recorded, never blocking it.
  const cat = get().categories.find((c) => c.id === categoryId);
  if (cat?.trackLocation && source === 'tap') {
    captureLocation()
      .then((loc) => {
        if (loc && get().events.some((x) => x.id === e.id)) updateEvent(e.id, loc);
      })
      .catch(() => {});
  }
  return e;
}

export function updateEvent(id: string, patch: Partial<Omit<OccurEvent, 'id'>>) {
  const cur = get().events.find((e) => e.id === id);
  if (!cur) return;
  const next = { ...cur, ...patch };
  set((s) => {
    const rest = s.events.filter((e) => e.id !== id);
    return { events: patch.occurredAt ? insertSorted(rest, next) : s.events.map((e) => (e.id === id ? next : e)) };
  });
  enqueue({ kind: 'upsertEvent', id, row: toEventRow(next) });
}

export function deleteEvent(id: string) {
  set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
  enqueue({ kind: 'deleteEvent', id });
}

/**
 * "Oops, take one away": removes the most recent entry for this category
 * logged today. Returns it so the UI can offer Undo, or null if there was none.
 */
export function removeLatestToday(categoryId: string, now: Date = new Date()): OccurEvent | null {
  const d0 = new Date(now);
  d0.setHours(0, 0, 0, 0);
  const from = d0.getTime();
  const list = get().events;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (Date.parse(e.occurredAt) < from) break;
    if (e.categoryId !== categoryId) continue;
    deleteEvent(e.id);
    return e;
  }
  return null;
}

/** Puts back an entry that was just removed (Undo), with its original id, time and place. */
export function restoreEvent(e: OccurEvent) {
  if (get().events.some((x) => x.id === e.id)) return;
  set((s) => ({ events: insertSorted(s.events, e) }));
  enqueue({ kind: 'upsertEvent', id: e.id, row: toEventRow(e) });
}

/** Deletes every category (and, by cascade, every event) for this user. */
export function deleteAllData() {
  const ids = get().categories.map((c) => c.id);
  ids.forEach(deleteCategory);
}

// ---------------------------------------------------------------------------
// sync engine
// ---------------------------------------------------------------------------

const inFlight = new Set<Mutation>();
let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = 2000;

function enqueue(m: Mutation) {
  if (get().mode === 'local') return; // demo mode: the cache is the database
  set((s) => {
    let q = s.queue;
    const pending = (x: Mutation) => !inFlight.has(x);
    if (m.kind === 'upsertEvent' || m.kind === 'upsertCategory') {
      // collapse repeated edits of the same row that haven't been sent yet
      const idx = q.findIndex((x) => x.kind === m.kind && x.id === m.id && pending(x));
      if (idx >= 0) return { queue: q.map((x, i) => (i === idx ? m : x)) };
      return { queue: [...q, m] };
    }
    if (m.kind === 'deleteEvent') {
      q = q.filter((x) => !(x.kind === 'upsertEvent' && x.id === m.id && pending(x)));
    }
    if (m.kind === 'deleteCategory') {
      q = q.filter(
        (x) =>
          !(
            pending(x) &&
            ((x.kind === 'upsertCategory' && x.id === m.id) || (x.kind === 'upsertEvent' && x.row.category_id === m.id))
          ),
      );
    }
    return { queue: [...q, m] };
  });
  scheduleFlush(250);
}

function scheduleFlush(ms: number) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), ms);
}

// Firestore error codes that won't succeed on retry (bad data, rules). Everything
// else — unavailable, deadline-exceeded, resource-exhausted (the free tier's daily
// quota), unauthenticated (token refresh) — is retried with backoff.
const PERMANENT = new Set([
  'permission-denied',
  'invalid-argument',
  'failed-precondition',
  'not-found',
  'already-exists',
  'out-of-range',
  'unimplemented',
  'data-loss',
]);

function isPermanent(err: any): boolean {
  return PERMANENT.has(String(err?.code ?? '').replace(/^firestore\//, ''));
}

// Firestore keeps offline writes pending instead of failing them, so a commit
// never settles while offline. Give up after a while; our own queue keeps the
// mutation and replays it (the writes are idempotent, so a late duplicate is harmless).
const WRITE_TIMEOUT_MS = 15_000;
const MAX_BATCH = 450; // Firestore allows 500 writes per batch

function commit(batch: WriteBatch): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Object.assign(new Error('Write timed out'), { code: 'deadline-exceeded' })),
      WRITE_TIMEOUT_MS,
    );
    batch.commit().then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const col = (uid: string, name: 'categories' | 'events') => collection(getDb(), 'users', uid, name);
const tombstone = () => ({ deleted: true, updated_at: serverTimestamp() });

/** The signed-in Firebase user, if it's the one whose data is loaded. */
function currentUid(): string | null {
  if (!isFirebaseConfigured) return null;
  const uid = getFirebaseAuth().currentUser?.uid ?? null;
  return uid && uid === get().userId ? uid : null;
}

/** Replays the queue in order. Consecutive event writes are batched. */
export async function flush(): Promise<boolean> {
  if (!isFirebaseConfigured || get().mode !== 'remote' || flushing) return false;
  const uid = currentUid();
  if (!uid) return false;
  flushing = true;
  try {
    return await drain(uid);
  } finally {
    flushing = false;
  }
}

/** Tombstones a category and every event that points at it (Firestore has no cascade). */
async function deleteCategoryRemote(uid: string, id: string) {
  const db = getDb();
  const snap = await getDocsFromServer(query(col(uid, 'events'), where('category_id', '==', id)));
  const refs = snap.docs.map((d) => d.ref);
  // events first and the category last, so an interrupted delete is simply redone
  for (let i = 0; i < refs.length; i += MAX_BATCH) {
    const b = writeBatch(db);
    refs.slice(i, i + MAX_BATCH).forEach((r) => b.set(r, tombstone()));
    await commit(b);
  }
  const b = writeBatch(db);
  b.set(doc(col(uid, 'categories'), id), tombstone());
  await commit(b);
}

async function drain(uid: string): Promise<boolean> {
  const db = getDb();
  while (get().queue.length) {
    if (get().userId !== uid) return false; // signed out / switched account mid-flush
    const queue = get().queue;
    const head = queue[0];
    // batch a run of the same simple kind
    let batch: Mutation[] = [head];
    if (head.kind === 'upsertEvent' || head.kind === 'deleteEvent') {
      batch = [];
      for (const m of queue) {
        if (m.kind !== head.kind || batch.length >= 200) break;
        batch.push(m);
      }
    }
    batch.forEach((m) => inFlight.add(m));
    try {
      if (head.kind === 'deleteCategory') {
        await deleteCategoryRemote(uid, head.id);
      } else {
        const b = writeBatch(db);
        if (head.kind === 'upsertCategory') {
          b.set(doc(col(uid, 'categories'), head.id), { ...head.row, updated_at: serverTimestamp() });
        } else if (head.kind === 'upsertEvent') {
          for (const m of batch as Extract<Mutation, { kind: 'upsertEvent' }>[])
            b.set(doc(col(uid, 'events'), m.id), { ...m.row, id: m.id, updated_at: serverTimestamp() });
        } else {
          for (const m of batch) b.set(doc(col(uid, 'events'), m.id), tombstone());
        }
        await commit(b);
      }
      const sent = new Set(batch);
      set((s) => ({ queue: s.queue.filter((m) => !sent.has(m)), syncError: null }));
      backoff = 2000;
    } catch (err: any) {
      if (isPermanent(err)) {
        // drop the poison item so it can't block everything behind it
        console.warn('dropping mutation', head.kind, err?.code, err?.message);
        const sent = new Set(batch);
        set((s) => ({
          queue: s.queue.filter((m) => !sent.has(m)),
          syncError: err?.message ?? 'Sync error',
        }));
        continue;
      }
      const code = String(err?.code ?? '');
      set({
        syncError: code.endsWith('resource-exhausted')
          ? 'The server is over its daily limit — changes will sync later.'
          : 'Offline — changes will sync when you reconnect.',
      });
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void sync(), backoff);
      backoff = Math.min(backoff * 2, 60_000);
      return false;
    } finally {
      inFlight.clear();
    }
  }
  return true;
}

/** Every doc in the collection changed after `cursor` (all of them when null). */
async function fetchChanges(
  uid: string,
  name: 'categories' | 'events',
  cursor: Cursor | null,
): Promise<{ docs: QueryDocumentSnapshot<DocumentData>[]; cursor: Cursor | null }> {
  const page = 500;
  const docs: QueryDocumentSnapshot<DocumentData>[] = [];
  let last: QueryDocumentSnapshot<DocumentData> | null = null;
  for (;;) {
    const parts: QueryConstraint[] = [];
    if (cursor) parts.push(where('updated_at', '>', new Timestamp(cursor.s, cursor.ns)));
    parts.push(orderBy('updated_at'));
    // page by document (not timestamp): a batch shares one server timestamp
    if (last) parts.push(startAfter(last));
    parts.push(limit(page));
    // FromServer: never mistake an empty offline cache for "nothing changed"
    const snap = await getDocsFromServer(query(col(uid, name), ...parts));
    docs.push(...snap.docs);
    if (snap.docs.length < page) break;
    last = snap.docs[snap.docs.length - 1];
  }
  const newest = docs.length ? (docs[docs.length - 1].get('updated_at') as Timestamp | undefined) : undefined;
  return { docs, cursor: newest ? { s: newest.seconds, ns: newest.nanoseconds } : cursor };
}

const isoOf = (v: unknown): string | undefined =>
  v instanceof Timestamp ? v.toDate().toISOString() : typeof v === 'string' ? v : undefined;

/** Server changes merged into the local cache, with still-pending local changes re-applied on top. */
export async function pull(): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  const { cursors } = get();
  const [catChanges, evChanges] = await Promise.all([
    fetchChanges(uid, 'categories', cursors.categories),
    fetchChanges(uid, 'events', cursors.events),
  ]);
  if (get().userId !== uid) return;

  const categories = new Map(get().categories.map((c) => [c.id, c]));
  const events = new Map(get().events.map((e) => [e.id, e]));
  for (const d of catChanges.docs) {
    const data = d.data();
    if (data.deleted) categories.delete(d.id);
    else categories.set(d.id, fromCategoryRow({ ...(data as CategoryRow), id: d.id, updated_at: isoOf(data.updated_at) }));
  }
  for (const d of evChanges.docs) {
    const data = d.data();
    if (data.deleted) events.delete(d.id);
    else events.set(d.id, fromEventRow({ ...(data as EventRow), id: d.id }));
  }
  for (const m of get().queue) {
    if (m.kind === 'upsertCategory') categories.set(m.id, fromCategoryRow(m.row));
    else if (m.kind === 'deleteCategory') categories.delete(m.id);
    else if (m.kind === 'upsertEvent') events.set(m.id, fromEventRow(m.row));
    else events.delete(m.id);
  }
  set({
    categories: [...categories.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    // an event whose category is gone went with it
    events: [...events.values()].filter((e) => categories.has(e.categoryId)).sort(byTime),
    cursors: { categories: catChanges.cursor, events: evChanges.cursor },
    lastSyncedAt: new Date().toISOString(),
  });
}

let syncing: Promise<void> | null = null;
export function sync(): Promise<void> {
  if (get().mode !== 'remote' || !isFirebaseConfigured) return Promise.resolve();
  if (syncing) return syncing;
  syncing = (async () => {
    set({ syncing: true });
    try {
      const flushed = await flush();
      if (flushed) await pull();
      if (flushed) set({ syncError: null });
    } catch (err: any) {
      set({ syncError: err?.message ?? 'Could not reach the server.' });
    } finally {
      set({ syncing: false });
      syncing = null;
    }
  })();
  return syncing;
}

AppState.addEventListener('change', (state) => {
  if (state === 'active' && get().userId) void sync();
});
