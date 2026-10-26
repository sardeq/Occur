import type { GroupBy, Intent, QueryFilter, QuerySpec, RangePreset, RangeSpec } from './types';

/**
 * Model output is untrusted. Everything that comes back from the LLM is
 * validated against the spec shape and the user's real category ids before it
 * is executed. Returns null when the output is unusable.
 */

const INTENTS: Intent[] = ['count', 'peak', 'last', 'first', 'average', 'compare', 'streak', 'gap', 'list', 'ranking'];
const PRESETS: RangePreset[] = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
  'all_time',
  'last_n_days',
];
const GROUPS: GroupBy[] = ['hour', 'weekday', 'day', 'week', 'month'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function range(v: unknown): RangeSpec | null {
  if (!isObj(v)) return null;
  if (typeof v.from === 'string' && typeof v.to === 'string' && DAY_RE.test(v.from) && DAY_RE.test(v.to)) {
    return { from: v.from, to: v.to };
  }
  if (typeof v.preset === 'string' && (PRESETS as string[]).includes(v.preset)) {
    const preset = v.preset as RangePreset;
    if (preset === 'last_n_days') {
      const n = Number(v.n);
      if (!Number.isFinite(n) || n < 1) return { preset, n: 30 };
      return { preset, n: Math.min(3650, Math.round(n)) };
    }
    return { preset };
  }
  return null;
}

function hour(v: unknown, max: number): number | undefined {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : undefined;
}

function filter(v: unknown): QueryFilter | undefined {
  if (!isObj(v)) return undefined;
  const f: QueryFilter = {};
  if (Array.isArray(v.weekdays)) {
    const days = v.weekdays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length && days.length < 7) f.weekdays = [...new Set(days)];
  }
  const from = hour(v.hourFrom, 23);
  const to = hour(v.hourTo, 24);
  if (from !== undefined || to !== undefined) {
    f.hourFrom = from ?? 0;
    f.hourTo = to ?? 24;
    if (f.hourFrom === f.hourTo) {
      delete f.hourFrom;
      delete f.hourTo;
    }
  }
  return Object.keys(f).length ? f : undefined;
}

export function sanitizeSpec(raw: unknown, knownCategoryIds: string[]): QuerySpec | null {
  if (!isObj(raw)) return null;
  const intent = raw.intent;
  if (typeof intent !== 'string' || !(INTENTS as string[]).includes(intent)) return null;
  const known = new Set(knownCategoryIds);
  const ids = Array.isArray(raw.categoryIds)
    ? [...new Set(raw.categoryIds.filter((x): x is string => typeof x === 'string' && known.has(x)))]
    : [];
  const r = range(raw.range) ?? { preset: 'all_time' as const };

  const spec: QuerySpec = { intent: intent as Intent, categoryIds: ids, range: r };
  const cmp = range(raw.compareTo);
  if (spec.intent === 'compare' && cmp) spec.compareTo = cmp;
  if (typeof raw.groupBy === 'string' && (GROUPS as string[]).includes(raw.groupBy))
    spec.groupBy = raw.groupBy as GroupBy;
  if (raw.per === 'day' || raw.per === 'week' || raw.per === 'month') spec.per = raw.per;
  const f = filter(raw.filter);
  if (f) spec.filter = f;
  if (typeof raw.unmatched === 'string' && raw.unmatched.trim() && !ids.length) {
    spec.unmatched = raw.unmatched.trim().slice(0, 40);
  }
  // The model referenced ids that don't exist — treat as unmatched rather than "all".
  if (!ids.length && Array.isArray(raw.categoryIds) && raw.categoryIds.length && !spec.unmatched) {
    return null;
  }
  return spec;
}
