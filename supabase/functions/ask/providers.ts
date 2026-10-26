// Minimal, dependency-free adapters for three LLM providers.
// Each returns raw text that should contain a JSON object.

type Result = { text: string; provider: string; model: string };

const env = (k: string) => Deno.env.get(k) ?? '';

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 12_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as any)?.error?.message ?? res.statusText;
      throw new Error(`${res.status}: ${msg}`);
    }
    return data as any;
  } finally {
    clearTimeout(t);
  }
}

async function gemini(system: string, user: string): Promise<Result> {
  const key = env('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const model = env('LLM_MODEL') || 'gemini-3.6-flash';
  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { 'x-goog-api-key': key },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    },
  );
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  return { text, provider: 'gemini', model };
}

async function openai(system: string, user: string): Promise<Result> {
  const key = env('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  const model = env('LLM_MODEL') || 'gpt-5-mini';
  const data = await post(
    'https://api.openai.com/v1/chat/completions',
    { Authorization: `Bearer ${key}` },
    {
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
  );
  return { text: data?.choices?.[0]?.message?.content ?? '', provider: 'openai', model };
}

async function anthropic(system: string, user: string): Promise<Result> {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const model = env('LLM_MODEL') || 'claude-haiku-4-5';
  const data = await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    {
      model,
      max_tokens: 500,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: `${user}\n\nRespond with the JSON object only.` }],
    },
  );
  const text = (data?.content ?? []).map((b: any) => (b.type === 'text' ? b.text : '')).join('');
  return { text, provider: 'anthropic', model };
}

export function callProvider(system: string, user: string): Promise<Result> {
  switch ((env('LLM_PROVIDER') || 'gemini').toLowerCase()) {
    case 'openai':
      return openai(system, user);
    case 'anthropic':
    case 'claude':
      return anthropic(system, user);
    default:
      return gemini(system, user);
  }
}
