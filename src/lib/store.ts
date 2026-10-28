/**
 * Local-first data store.
 *
 * Every write (tap, edit, delete) is applied to this in-memory store
 * immediately — the UI never waits for the network — and appended to a
 * persistent mutation queue. The queue is replayed against Supabase in order,
 * with retries and backoff. IDs are generated on the device, so replays are
 * idempotent upserts: tapping 20 times in airplane mode just works.
 *
 * The whole state (categories, events, queue) is cached in local storage per
 * user, so the app opens instantly with the last known data.
 */
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { kv } from './kv';
import { captureLocation } from './location';
import { isSupabaseConfigured, supabase } from './supabase';
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
    s.lastSyncedAt === prev.lastSyncedAt
  )
    return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const { userId, categories, events, queue, lastSyncedAt } = get();
    if (!userId) return;
    try {
      kv.setItem(cacheKey(userId), JSON.stringify({ categories, events, queue, lastSyncedAt }));
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

function isPermanent(err: any): boolean {
  // Postgres / PostgREST errors are permanent (bad data, RLS). Network errors are not.
  const code = String(err?.code ?? '');
  return /^(22|23|42|PGRST)/.test(code);
}

/** Replays the queue in order. Consecutive event writes are batched. */
export async function flush(): Promise<boolean> {
  if (!isSupabaseConfigured || get().mode !== 'remote' || flushing) return false;
  flushing = true;
  try {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return false;
    return await drain();
  } finally {
    flushing = false;
  }
}

async function drain(): Promise<boolean> {
  while (get().queue.length) {
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
      let error: any = null;
      if (head.kind === 'upsertCategory') {
        ({ error } = await supabase.from('categories').upsert(head.row, { onConflict: 'id' }));
      } else if (head.kind === 'deleteCategory') {
        ({ error } = await supabase.from('categories').delete().eq('id', head.id));
      } else if (head.kind === 'upsertEvent') {
        const rows = batch.map((m) => (m as Extract<Mutation, { kind: 'upsertEvent' }>).row);
        ({ error } = await supabase.from('events').upsert(rows, { onConflict: 'id' }));
      } else {
        ({ error } = await supabase
          .from('events')
          .delete()
          .in(
            'id',
            batch.map((m) => m.id),
          ));
      }
      if (error) throw error;
      const sent = new Set(batch);
      set((s) => ({ queue: s.queue.filter((m) => !sent.has(m)), syncError: null }));
      backoff = 2000;
    } catch (err: any) {
      if (isPermanent(err)) {
        // drop the poison item so it can't block everything behind it
        console.warn('dropping mutation', head.kind, err?.message);
        const sent = new Set(batch);
        set((s) => ({
          queue: s.queue.filter((m) => !sent.has(m)),
          syncError:
            err?.code === '23505' ? 'A category with that name already exists.' : (err?.message ?? 'Sync error'),
        }));
        continue;
      }
      set({ syncError: 'Offline — changes will sync when you reconnect.' });
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

async function fetchAll<T>(table: 'categories' | 'events', order: string): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(order, { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

/** Server snapshot, with any still-pending local changes re-applied on top. */
export async function pull(): Promise<void> {
  const [catRows, evRows] = await Promise.all([
    fetchAll<CategoryRow>('categories', 'created_at'),
    fetchAll<EventRow>('events', 'occurred_at'),
  ]);
  let categories = catRows.map(fromCategoryRow);
  let events = evRows.map(fromEventRow);
  for (const m of get().queue) {
    if (m.kind === 'upsertCategory') {
      categories = [...categories.filter((c) => c.id !== m.id), fromCategoryRow(m.row)];
    } else if (m.kind === 'deleteCategory') {
      categories = categories.filter((c) => c.id !== m.id);
      events = events.filter((e) => e.categoryId !== m.id);
    } else if (m.kind === 'upsertEvent') {
      events = [...events.filter((e) => e.id !== m.id), fromEventRow(m.row)];
    } else {
      events = events.filter((e) => e.id !== m.id);
    }
  }
  set({ categories, events: events.sort(byTime), lastSyncedAt: new Date().toISOString() });
}

let syncing: Promise<void> | null = null;
export function sync(): Promise<void> {
  if (get().mode !== 'remote' || !isSupabaseConfigured) return Promise.resolve();
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
