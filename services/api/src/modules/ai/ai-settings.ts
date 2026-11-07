import { openAiChatModel } from './openai-chat';

/** Platform settings keys that control learner-facing AI behavior. */
export const AI_SETTING_KEYS = {
  enabled: 'aiEnabled',
  dailyLimit: 'aiDailyLimit',
  lookupModel: 'aiLookupModel',
  quizModel: 'aiQuizModel',
  importCleanupModel: 'aiImportCleanupModel',
  defaultUserQuota: 'aiDefaultUserQuota',
} as const;

/** Unlimited lookups are null, not a large sentinel. */
export const UNLIMITED_AI_QUOTA = null;

export function coerceNonNegInt(raw: unknown, fallback: number): number {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

/**
 * Free learners follow the admin platform quota.
 * Premium (plan quota ≥ 1e6) stays unlimited.
 * 0 on the platform setting means unlimited for Free.
 */
export function resolveLearnerDailyAiQuota(
  planQuota: number | null | undefined,
  platformDefault: number,
): number {
  // payments-02: a plan quota above the platform (Free) default is enforced as-is (Plus = 200/day).
  // Before this, any plan quota < 1e6 silently fell back to the Free default (Plus would get 50).
  if (planQuota != null && planQuota > platformDefault) return planQuota;
  return platformDefault;
}

export type AiPlatformSettings = {
  enabled: boolean;
  dailyLimit: number;
  lookupModel: string;
  quizModel: string;
  importCleanupModel: string;
  defaultUserQuota: number;
};

export function defaultAiPlatformSettings(): AiPlatformSettings {
  return {
    enabled: true,
    dailyLimit: 150_000,
    lookupModel: openAiChatModel(process.env.OPENAI_MODEL_LOOKUP),
    quizModel: openAiChatModel(process.env.OPENAI_MODEL_QUIZ),
    importCleanupModel: openAiChatModel(process.env.OPENAI_MODEL_IMPORT, process.env.OPENAI_MODEL_LOOKUP),
    defaultUserQuota: 20,
  };
}

export function parseAiPlatformSettings(map: Record<string, unknown>): AiPlatformSettings {
  const defaults = defaultAiPlatformSettings();
  const enabledRaw = map[AI_SETTING_KEYS.enabled];
  const dailyLimitRaw = map[AI_SETTING_KEYS.dailyLimit];
  const lookupModelRaw = map[AI_SETTING_KEYS.lookupModel];
  const quizModelRaw = map[AI_SETTING_KEYS.quizModel];
  const importCleanupModelRaw = map[AI_SETTING_KEYS.importCleanupModel];
  const defaultQuotaRaw = map[AI_SETTING_KEYS.defaultUserQuota];

  return {
    enabled: typeof enabledRaw === 'boolean' ? enabledRaw : defaults.enabled,
    dailyLimit: coerceNonNegInt(dailyLimitRaw, defaults.dailyLimit),
    lookupModel:
      typeof lookupModelRaw === 'string' && lookupModelRaw.trim()
        ? lookupModelRaw.trim()
        : defaults.lookupModel,
    quizModel:
      typeof quizModelRaw === 'string' && quizModelRaw.trim()
        ? quizModelRaw.trim()
        : defaults.quizModel,
    importCleanupModel:
      typeof importCleanupModelRaw === 'string' && importCleanupModelRaw.trim()
        ? importCleanupModelRaw.trim()
        : defaults.importCleanupModel,
    defaultUserQuota: coerceNonNegInt(defaultQuotaRaw, defaults.defaultUserQuota),
  };
}
