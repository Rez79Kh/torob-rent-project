const BASE_URL: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  openrouter: "https://openrouter.ai/api/v1",
};

const DEFAULT_MODEL: Record<string, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  openrouter: "openai/gpt-4o-mini",
};

export interface LlmConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export function llmConfig(): LlmConfig | null {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const provider = (process.env.LLM_PROVIDER ?? "openrouter").toLowerCase();
  const baseUrl = BASE_URL[provider];
  if (!baseUrl) return null;
  return { provider, apiKey, model: process.env.LLM_MODEL || DEFAULT_MODEL[provider], baseUrl };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const cache = new Map<string, unknown>();
const CACHE_MAX = 500;

/** One OpenAI-compatible JSON call with a hard timeout. Throws on any failure so callers can fall back. */
export async function chatJSON<T = unknown>(
  messages: ChatMessage[],
  opts: { timeoutMs?: number; temperature?: number } = {},
): Promise<{ data: T; model: string }> {
  const cfg = llmConfig();
  if (!cfg) throw new Error("llm_not_configured");
  const key = JSON.stringify([cfg.model, messages]);
  if (cache.has(key)) return { data: cache.get(key) as T, model: cfg.model };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 2500);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
        ...(cfg.provider === "openrouter" ? { "X-Title": "Torob Ejareh" } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: opts.temperature ?? 0,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`llm_http_${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content ?? "";
    const json = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, json);
    return { data: json, model: cfg.model };
  } finally {
    clearTimeout(timer);
  }
}
