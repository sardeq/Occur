/**
 * Orchestrates a question:
 *   1. try the LLM edge function → QuerySpec (validated)
 *   2. otherwise parse on device
 *   3. execute deterministically against local data
 */
import { isSupabaseConfigured, supabase } from '../supabase';
import { WEEKDAYS_LONG, dayKey, deviceTimeZone } from '../time';
import type { Category, OccurEvent } from '../types';
import { executeQuery } from './execute';
import { parseQuestion } from './parse-local';
import { sanitizeSpec } from './sanitize';
import type { Answer, QuerySpec } from './types';

const TIMEOUT_MS = 9000;

async function specFromModel(question: string, categories: Category[], now: Date): Promise<QuerySpec | null> {
  if (!isSupabaseConfigured) return null;
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return null;

  const call = supabase.functions.invoke('ask', {
    body: {
      question,
      categories: categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
      today: dayKey(now),
      weekday: WEEKDAYS_LONG[now.getDay()],
      timezone: deviceTimeZone() ?? 'UTC',
    },
  });
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  const res = await Promise.race([call, timeout]);
  if (!res || res.error || !res.data?.spec) return null;
  return sanitizeSpec(
    res.data.spec,
    categories.map((c) => c.id),
  );
}

export async function ask(
  question: string,
  ctx: { categories: Category[]; events: OccurEvent[]; preferDevice?: boolean },
): Promise<Answer> {
  const now = new Date();
  let spec: QuerySpec | null = null;
  let source: Answer['source'] = 'device';
  if (!ctx.preferDevice) {
    try {
      spec = await specFromModel(question, ctx.categories, now);
      if (spec) source = 'ai';
    } catch {
      spec = null;
    }
  }
  if (!spec) spec = parseQuestion(question, ctx.categories, now);
  return executeQuery(spec, { categories: ctx.categories, events: ctx.events, now, source });
}
