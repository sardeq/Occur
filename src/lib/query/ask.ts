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
import type { AiIssue, Answer, QuerySpec } from './types';

const TIMEOUT_MS = 9000;

/**
 * Name of the edge function. Defaults to "ask"; set EXPO_PUBLIC_ASK_FUNCTION if
 * it was deployed under another name (e.g. one picked in the Supabase dashboard).
 */
const FUNCTION_NAME = process.env.EXPO_PUBLIC_ASK_FUNCTION || 'ask';

type ModelResult = { spec: QuerySpec } | { issue: AiIssue; detail?: string };

async function specFromModel(question: string, categories: Category[], now: Date): Promise<ModelResult> {
  if (!isSupabaseConfigured) return { issue: 'signedOut', detail: 'Supabase is not configured' };
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return { issue: 'signedOut', detail: 'no session (demo mode or signed out)' };

  const call = supabase.functions.invoke(FUNCTION_NAME, {
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
  if (!res) return { issue: 'timeout', detail: `no reply in ${TIMEOUT_MS / 1000}s` };
  if (res.error) {
    const ctx = (res.error as { context?: Response }).context;
    const status = ctx?.status;
    let detail = res.error.message;
    try {
      const body = await ctx?.clone().json();
      detail = `${status ?? ''} ${body?.error ?? body?.message ?? detail}`.trim();
    } catch {}
    return { issue: status === 404 ? 'missing' : 'failed', detail };
  }
  const spec = res.data?.spec
    ? sanitizeSpec(
        res.data.spec,
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
