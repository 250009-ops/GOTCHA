/** Platform settings keys that control learner-facing AI behavior. */
export const AI_SETTING_KEYS = {
  enabled: 'aiEnabled',
  dailyLimit: 'aiDailyLimit',
  lookupModel: 'aiLookupModel',
  quizModel: 'aiQuizModel',
  defaultUserQuota: 'aiDefaultUserQuota',
} as const;

export type AiPlatformSettings = {
  enabled: boolean;
  dailyLimit: number;
  lookupModel: string;
  quizModel: string;
  defaultUserQuota: number;
};

export function defaultAiPlatformSettings(): AiPlatformSettings {
  return {
    enabled: true,
    dailyLimit: 150_000,
    lookupModel: process.env.OPENAI_MODEL_LOOKUP ?? 'gpt-4.1-mini',
    quizModel: process.env.OPENAI_MODEL_QUIZ ?? 'gpt-4.1-mini',
    defaultUserQuota: 50,
  };
}

export function parseAiPlatformSettings(map: Record<string, unknown>): AiPlatformSettings {
  const defaults = defaultAiPlatformSettings();
  const enabledRaw = map[AI_SETTING_KEYS.enabled];
  const dailyLimitRaw = map[AI_SETTING_KEYS.dailyLimit];
  const lookupModelRaw = map[AI_SETTING_KEYS.lookupModel];
  const quizModelRaw = map[AI_SETTING_KEYS.quizModel];
  const defaultQuotaRaw = map[AI_SETTING_KEYS.defaultUserQuota];

  return {
    enabled: typeof enabledRaw === 'boolean' ? enabledRaw : defaults.enabled,
    dailyLimit:
      typeof dailyLimitRaw === 'number' && Number.isFinite(dailyLimitRaw)
        ? Math.max(0, Math.floor(dailyLimitRaw))
        : defaults.dailyLimit,
    lookupModel:
      typeof lookupModelRaw === 'string' && lookupModelRaw.trim()
        ? lookupModelRaw.trim()
        : defaults.lookupModel,
    quizModel:
      typeof quizModelRaw === 'string' && quizModelRaw.trim()
        ? quizModelRaw.trim()
        : defaults.quizModel,
    defaultUserQuota:
      typeof defaultQuotaRaw === 'number' && Number.isFinite(defaultQuotaRaw)
        ? Math.max(0, Math.floor(defaultQuotaRaw))
        : defaults.defaultUserQuota,
  };
}
