/** Learner-facing chat model. Speech stays on OPENAI_MODEL_TTS. */
export const DEFAULT_OPENAI_CHAT_MODEL = 'gpt-6-astra';

export function openAiChatModel(...candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    const model = candidate?.trim();
    if (model) return model;
  }
  return DEFAULT_OPENAI_CHAT_MODEL;
}

/**
 * gpt-6 accepts only the default temperature, and it counts reasoning toward
 * max_completion_tokens. Older models keep temperature and max_tokens.
 */
export function openAiChatSampling(
  model: string,
  opts: { temperature?: number; maxTokens?: number } = {},
): { temperature?: number; max_tokens?: number; max_completion_tokens?: number } {
  const locked = model.startsWith('gpt-6');
  const sampling: { temperature?: number; max_tokens?: number; max_completion_tokens?: number } = {};
  if (opts.maxTokens != null) {
    if (locked) sampling.max_completion_tokens = opts.maxTokens + 256;
    else sampling.max_tokens = opts.maxTokens;
  }
  if (opts.temperature != null && !locked) sampling.temperature = opts.temperature;
  return sampling;
}
