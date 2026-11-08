/**
 * Orchestrates a question:
 *   1. try the LLM edge function → QuerySpec (validated)
 *   2. otherwise parse on device
 *   3. execute deterministically against local data
 */
import { getIdToken } from '../auth';
import { WEEKDAYS_LONG, dayKey, deviceTimeZone } from '../time';
import type { Category, OccurEvent } from '../types';
import { executeQuery } from './execute';
import { parseQuestion } from './parse-local';
import { sanitizeSpec } from './sanitize';
import type { AiIssue, Answer, QuerySpec } from './types';

// the function may retry a rate-limited free model once, so allow a little longer
const TIMEOUT_MS = 14_000;

/**
 * Name of the edge function. Defaults to "ask"; set EXPO_PUBLIC_ASK_FUNCTION if
 * it was deployed under another name (e.g. one picked in the Supabase dashboard).
 */
const FUNCTION_NAME = process.env.EXPO_PUBLIC_ASK_FUNCTION || 'ask';

/**
 * The Ask function still runs on Supabase Edge Functions (Firebase Cloud
 * Functions need the paid Blaze plan). It verifies the caller's Firebase ID
 * token itself, so only the project URL (and publishable key, for the gateway)
 * are needed here — no Supabase SDK or Supabase account on the client.
 */
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

type ModelResult = { spec: QuerySpec } | { issue: AiIssue; detail?: string };

async function specFromModel(question: string, categories: Category[], now: Date): Promise<ModelResult> {
  const token = await getIdToken();
  if (!token) return { issue: 'signedOut', detail: 'no session (demo mode or signed out)' };
  if (!SUPABASE_URL) return { issue: 'missing', detail: 'EXPO_PUBLIC_SUPABASE_URL is not set' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(SUPABASE_KEY ? { apikey: SUPABASE_KEY } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        categories: categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
        today: dayKey(now),
        weekday: WEEKDAYS_LONG[now.getDay()],
        timezone: deviceTimeZone() ?? 'UTC',
      }),
    });
  } catch (e) {
    if (ctrl.signal.aborted) return { issue: 'timeout', detail: `no reply in ${TIMEOUT_MS / 1000}s` };
    return { issue: 'failed', detail: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = `${res.status} ${data?.error ?? data?.message ?? res.statusText}`.trim();
    return { issue: res.status === 404 ? 'missing' : 'failed', detail };
  }
  const spec = data?.spec
    ? sanitizeSpec(
        data.spec,
        categories.map((c) => c.id),
      )
    : null;
  return spec ? { spec } : { issue: 'failed', detail: 'the model returned no usable query' };
}

declare const __DEV__: boolean | undefined;

export async function ask(
  question: string,
  ctx: { categories: Category[]; events: OccurEvent[]; preferDevice?: boolean },
): Promise<Answer> {
  const now = new Date();
  let spec: QuerySpec | null = null;
  let source: Answer['source'] = 'device';
  let aiIssue: AiIssue | undefined;
  if (!ctx.preferDevice) {
    let r: ModelResult;
    try {
      r = await specFromModel(question, ctx.categories, now);
    } catch (e) {
      r = { issue: 'failed', detail: e instanceof Error ? e.message : String(e) };
    }
    if ('spec' in r) {
      spec = r.spec;
      source = 'ai';
    } else {
      aiIssue = r.issue;
      if (typeof __DEV__ !== 'undefined' && __DEV__)
        console.warn(`[ask] AI not used (${r.issue}) via function "${FUNCTION_NAME}": ${r.detail ?? ''}`);
    }
  }
  if (!spec) spec = parseQuestion(question, ctx.categories, now);
  const answer = executeQuery(spec, { categories: ctx.categories, events: ctx.events, now, source });
  return aiIssue ? { ...answer, aiIssue } : answer;
}
