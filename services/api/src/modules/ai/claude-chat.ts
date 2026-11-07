import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude (Anthropic API) behind the small slice of the OpenAI chat interface that AiService uses:
 * `chat.completions.create(request, options)`, with and without `stream: true`.
 * The rest of AiService stays unchanged: same prompts, same JSON parsing, same usage fields.
 *
 * OpenAI is still used only for child-safety moderation and text-to-speech (Claude has neither).
 */

export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-5-5';

/** Admin settings / env may still hold an OpenAI model name: anything that is not a Claude id maps to ANTHROPIC_MODEL. */
export function claudeModel(requested?: string | null): string {
  const asked = requested?.trim();
  if (asked && asked.startsWith('claude-')) return asked;
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_CLAUDE_MODEL;
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: unknown };
type ChatRequest = {
  model?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  response_format?: { type?: string };
  stream?: boolean;
};
type RequestOptions = { timeout?: number; maxRetries?: number; signal?: AbortSignal };

const JSON_ONLY =
  'Output format: reply with ONE valid JSON object only. No markdown, no code fences, no text before or after the JSON.';

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text: unknown }).text ?? '') : ''))
      .join('');
  }
  return content == null ? '' : String(content);
}

/** Claude sometimes wraps JSON in ```json fences; keep only the object so JSON.parse in AiService works. */
export function extractJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return raw.trim();
  return raw.slice(start, end + 1);
}

function toUsage(u: Record<string, number | null | undefined> | undefined) {
  const input = u?.input_tokens ?? 0;
  const cacheRead = u?.cache_read_input_tokens ?? 0;
  const cacheWrite = u?.cache_creation_input_tokens ?? 0;
  return {
    prompt_tokens: input + cacheRead + cacheWrite,
    completion_tokens: u?.output_tokens ?? 0,
    prompt_tokens_details: { cached_tokens: cacheRead },
  };
}

function buildParams(req: ChatRequest) {
  const json = req.response_format?.type === 'json_object';
  const systemText = req.messages
    .filter((m) => m.role === 'system')
    .map((m) => textOf(m.content))
    .filter(Boolean)
    .join('\n\n');
  const system = [systemText, json ? JSON_ONLY : ''].filter(Boolean).join('\n\n');

  // Claude needs alternating user/assistant turns; merge neighbours with the same role.
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const m of req.messages) {
    if (m.role === 'system') continue;
    const text = textOf(m.content);
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${text}`;
    else turns.push({ role: m.role, content: text });
  }
  if (!turns.length || turns[0].role !== 'user') turns.unshift({ role: 'user', content: '.' });

  const params: Record<string, unknown> = {
    model: claudeModel(req.model),
    max_tokens: req.max_tokens ?? req.max_completion_tokens ?? 1024,
    // Static instructions first + cache_control → repeated lookups reuse the cached prefix (faster, cheaper).
    ...(system ? { system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] } : {}),
    messages: turns,
  };
  // Off by default: some Claude models only accept the default temperature.
  if (process.env.ANTHROPIC_SEND_TEMPERATURE === '1' && typeof req.temperature === 'number') {
    params.temperature = req.temperature;
  }
  return { params, json };
}

export function createClaudeChatClient(apiKey: string) {
  const anthropic = new Anthropic({ apiKey });
  // The SDK's types are strict per model/param; this adapter builds plain params, so call through a loose handle.
  const messages = anthropic.messages as unknown as {
    create: (params: Record<string, unknown>, options?: RequestOptions) => Promise<any>;
  };

  async function* streamChunks(params: Record<string, unknown>, json: boolean, options?: RequestOptions) {
    const events: AsyncIterable<any> = await messages.create({ ...params, stream: true }, options);
    let usage: Record<string, number> = {};
    let started = !json;
    let pending = '';
    for await (const event of events) {
      if (event?.type === 'message_start') {
        usage = { ...(event.message?.usage ?? {}) };
      } else if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        let text: string = event.delta.text ?? '';
        if (!text) continue;
        if (json) {
          // Drop a leading ```json fence (and anything before the first "{"), and stray fences after it.
          if (!started) {
            pending += text;
            const at = pending.indexOf('{');
            if (at === -1) continue;
            text = pending.slice(at);
            pending = '';
            started = true;
          }
          text = text.replace(/```(?:json)?/g, '');
          if (!text) continue;
        }
        yield { choices: [{ index: 0, delta: { content: text } }], usage: null };
      } else if (event?.type === 'message_delta' && event.usage) {
        usage = { ...usage, ...event.usage };
      }
    }
    yield { choices: [], usage: toUsage(usage) };
  }

  return {
    chat: {
      completions: {
        async create(req: ChatRequest, options?: RequestOptions): Promise<any> {
          const { params, json } = buildParams(req);
          if (req.stream) return streamChunks(params, json, options);
          const res = await messages.create(params, options);
          const raw = (res?.content ?? [])
            .filter((b: { type?: string }) => b?.type === 'text')
            .map((b: { text?: string }) => b.text ?? '')
            .join('');
          const content = json ? extractJsonObject(raw) : raw;
          return {
            id: res?.id,
            model: res?.model,
            choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: res?.stop_reason ?? 'stop' }],
            usage: toUsage(res?.usage),
          };
        },
      },
    },
  };
}
