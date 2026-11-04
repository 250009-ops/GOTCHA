import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { AgeBand, isMinorBand } from '../../common/safety/age-policy';
import { usageDayStart } from '../../common/plan-caps';

/** S7: one clear error for every AI entry point when support/admin turned AI off for this account. */
export const AI_DISABLED_CODE = 'AI_DISABLED';
/** Learner switched AI off in Settings (can switch it back on there). */
export const AI_OFF_BY_USER_CODE = 'AI_OFF_BY_USER';
export function aiDisabledError(by?: string | null) {
  return new ForbiddenException({
    statusCode: 403,
    error: 'Forbidden',
    code: by === 'user' ? AI_OFF_BY_USER_CODE : AI_DISABLED_CODE,
    message:
      by === 'user'
        ? 'You turned AI features off. Turn them back on in Settings.'
        : 'AI features are turned off for this account. Contact support@gotchaa.uz to turn them back on.',
  });
}

/** AI-1: extra system instruction for learners under 18 (or unknown age, per AGE_UNKNOWN_BAND). */
export const CHILD_SAFE_INSTRUCTION =
  'The learner may be a child or teenager. Keep every output age-appropriate: no sexual content, no graphic violence or self-harm detail, no slurs or hateful language, no instructions for dangerous or illegal activity. If the source text contains such material, translate or explain it neutrally and briefly without adding detail.';

export function withChildSafe(systemPrompt: string, band: AgeBand): string {
  return isMinorBand(band) ? `${systemPrompt}\n\n${CHILD_SAFE_INSTRUCTION}` : systemPrompt;
}

/** AI-1: replacement when OpenAI moderation flags an output shown to a minor. */
export const MODERATED_PLACEHOLDER = '[hidden for safety]';
const MODERATED_PLACEHOLDERS: Record<string, string> = {
  uz: '[xavfsizlik uchun yashirildi]',
  ru: '[скрыто в целях безопасности]',
  en: MODERATED_PLACEHOLDER,
};
/** Placeholder in the user's UI language (uz/ru/en); English for anything else. */
export function moderatedPlaceholder(lang?: string | null): string {
  return MODERATED_PLACEHOLDERS[(lang ?? '').slice(0, 2).toLowerCase()] ?? MODERATED_PLACEHOLDER;
}

/** TTS per-user daily quota (P1). In-process fallback (memory/dev mode only); with a DB, AiService.hitTts uses ai_usage_daily.tts_count. */
export class DailyCounter {
  private day = '';
  private counts = new Map<string, number>();
  constructor(private limit: () => number) {}
  hit(key: string, now = new Date()): void {
    const d = usageDayStart(now).toISOString().slice(0, 10); // Tashkent calendar day: resets at 00:00 Asia/Tashkent
    if (d !== this.day) {
      this.day = d;
      this.counts.clear();
    }
    const n = (this.counts.get(key) ?? 0) + 1;
    const limit = this.limit();
    if (limit > 0 && n > limit) {
      throw new HttpException(
        { statusCode: 429, code: 'TTS_DAILY_LIMIT', message: 'Daily pronunciation limit reached. Try again tomorrow.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.counts.set(key, n);
  }
}
export function ttsLimitError() {
  return new HttpException(
    { statusCode: 429, code: 'TTS_DAILY_LIMIT', message: 'Daily pronunciation limit reached. Try again tomorrow.' },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
export const ttsDailyLimit = () => {
  const n = Number(process.env.TTS_DAILY_LIMIT_PER_USER ?? 300);
  return Number.isFinite(n) ? n : 300;
};

export const AI_MODERATION_UNAVAILABLE = 'AI_MODERATION_UNAVAILABLE';
type ModerationClient = { moderations: { create(a: { model: string; input: string }): Promise<{ results?: Array<{ flagged: boolean }> }> } };

/**
 * Minors only. Flagged → placeholder. Any moderation error → 503 AI_MODERATION_UNAVAILABLE
 * (fail closed: the unchecked AI output is never returned). The learner shows a neutral retry message.
 */
export async function moderateOrBlock(
  client: ModerationClient,
  text: string,
  onError?: (msg: string) => void,
  lang?: string | null,
): Promise<string> {
  try {
    const res = await client.moderations.create({ model: 'omni-moderation-latest', input: text.slice(0, 4000) });
    if (!res || !Array.isArray(res.results)) throw new Error('empty moderation response');
    return res.results.some((r) => r.flagged) ? moderatedPlaceholder(lang) : text;
  } catch (err) {
    onError?.(err instanceof Error ? err.message : String(err));
    throw new HttpException(
      { statusCode: 503, code: AI_MODERATION_UNAVAILABLE, message: 'This answer could not be checked right now. Please try again.' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
