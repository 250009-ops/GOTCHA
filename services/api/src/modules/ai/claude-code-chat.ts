import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { extractJsonObject } from './claude-chat';

/**
 * PERSONAL MODE: Gotcha's chat AI through the official Claude Code CLI signed in with the owner's own
 * Claude plan (token from `claude setup-token`, env CLAUDE_CODE_OAUTH_TOKEN). No API key, no API bill.
 *
 * Only for the owner's own learning: AiService enables it just for AI_OWNER_USER_IDS. Other accounts get
 * no AI calls (dictionary/cache only), so the plan is never used to serve other people.
 * Slower than the API (the CLI starts per call) and shares the plan's usage limits with the owner's own Claude use.
 */

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: unknown };
type ChatRequest = { model?: string; messages: ChatMessage[]; response_format?: { type?: string }; stream?: boolean };
type RequestOptions = { timeout?: number; signal?: AbortSignal };

const CLI_TIMEOUT_MS = 90_000;

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p) => (p && typeof p === 'object' && 'text' in p ? String((p as { text: unknown }).text ?? '') : '')).join('');
  }
  return content == null ? '' : String(content);
}

function buildPrompt(req: ChatRequest): string {
  const json = req.response_format?.type === 'json_object';
  const parts: string[] = [
    'You are a backend text function inside a language-learning app. Do not use any tools. Answer directly in one reply.',
  ];
  for (const m of req.messages) {
    const label = m.role === 'system' ? 'INSTRUCTIONS' : m.role === 'user' ? 'INPUT' : 'PREVIOUS ANSWER';
    parts.push(`### ${label}\n${textOf(m.content)}`);
  }
  if (json) parts.push('### OUTPUT\nReply with ONE valid JSON object only. No markdown, no code fences, no other text.');
  return parts.join('\n\n');
}

/** One CLI call at a time: keeps the plan's rate limits calm and the server light. */
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

function runClaude(prompt: string, options?: RequestOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = process.env.CLAUDE_CODE_BIN?.trim() || 'claude';
    const model = process.env.CLAUDE_CODE_MODEL?.trim() || 'haiku';
    const child = spawn(bin, ['-p', '--output-format', 'text', '--model', model, '--max-turns', '1'], {
      // Run outside the repo so the CLI loads no project files or CLAUDE.md.
      cwd: tmpdir(),
      env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN ?? '' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timeoutMs = Math.max(options?.timeout ?? 0, CLI_TIMEOUT_MS);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude-code timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    options?.signal?.addEventListener('abort', () => {
      child.kill('SIGKILL');
      reject(new Error('claude-code aborted'));
    });
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`claude-code not runnable (${bin}): ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude-code exit ${code}: ${(err || out).slice(0, 300)}`));
    });
    child.stdin.end(prompt);
  });
}

export function createClaudeCodeChatClient() {
  return {
    chat: {
      completions: {
        async create(req: ChatRequest, options?: RequestOptions): Promise<any> {
          const json = req.response_format?.type === 'json_object';
          const raw = await serialized(() => runClaude(buildPrompt(req), options));
          const content = json ? extractJsonObject(raw) : raw;
          // The plan is not billed per token: report zero usage so cost logs stay at $0.
          const usage = { prompt_tokens: 0, completion_tokens: 0, prompt_tokens_details: { cached_tokens: 0 } };
          if (req.stream) {
            return (async function* () {
              yield { choices: [{ index: 0, delta: { content } }], usage: null };
              yield { choices: [], usage };
            })();
          }
          return { choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage };
        },
      },
    },
  };
}
