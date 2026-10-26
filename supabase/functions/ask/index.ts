// Occur — "ask" edge function
//
// Turns a natural-language question into a QuerySpec (see
// src/lib/query/types.ts). It deliberately receives ONLY the question and the
// user's category names — never their event history. The app executes the
// returned spec locally against its data, so every number is exact.
//
// Provider is pluggable via secrets:
//   LLM_PROVIDER = gemini (default) | openai | anthropic
//   GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY
//   LLM_MODEL (optional override)
//
// Deploy:  supabase functions deploy ask
// JWT verification stays on (default), so only signed-in users can call it.

import { buildSystemPrompt, buildUserPrompt, type AskRequest } from './prompt.ts';
import { callProvider } from './providers.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function validate(body: unknown): AskRequest | string {
  if (!body || typeof body !== 'object') return 'Body must be JSON';
  const b = body as Record<string, unknown>;
  if (typeof b.question !== 'string' || !b.question.trim()) return 'question is required';
  if (b.question.length > 300) return 'question is too long';
  if (!Array.isArray(b.categories)) return 'categories must be an array';
  const categories = b.categories
    .slice(0, 80)
    .filter(
      (c): c is { id: string; name: string; emoji?: string } =>
        !!c && typeof c === 'object' && typeof (c as any).id === 'string' && typeof (c as any).name === 'string',
    )
    .map((c) => ({
      id: c.id.slice(0, 64),
      name: c.name.slice(0, 40),
      emoji: typeof c.emoji === 'string' ? c.emoji.slice(0, 8) : undefined,
    }));
  const today = typeof b.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.today) ? b.today : null;
  if (!today) return 'today must be YYYY-MM-DD';
  return {
    question: b.question.trim(),
    categories,
    today,
    weekday: typeof b.weekday === 'string' ? b.weekday.slice(0, 12) : '',
    timezone: typeof b.timezone === 'string' ? b.timezone.slice(0, 64) : 'UTC',
  };
}

/** Pull the first JSON object out of a model response, tolerating code fences. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON');
  return JSON.parse(raw.slice(start, end + 1));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const input = validate(body);
  if (typeof input === 'string') return json({ error: input }, 400);

  try {
    const started = Date.now();
    const { text, provider, model } = await callProvider(buildSystemPrompt(), buildUserPrompt(input));
    const spec = extractJson(text);
    return json({ spec, provider, model, ms: Date.now() - started });
  } catch (err) {
    console.error('ask failed', err);
    // 502 tells the app to fall back to its on-device parser.
    return json({ error: err instanceof Error ? err.message : 'LLM call failed' }, 502);
  }
});
