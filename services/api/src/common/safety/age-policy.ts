/**
 * W-12 / S6 age policy (31 Oct 2026). There is no minimum age.
 *  - under13: messaging and the learner directory are off; minimal data.
 *  - teen (13-17): messaging only with accepted friends; child-safe AI output.
 *  - adult (18+): no restrictions.
 * Unknown age (no birth year): treated as AGE_UNKNOWN_BAND, default "teen" (Kai, 31 Oct; NOT yet confirmed
 * by Sarvarbek). If he picks the stricter default, set AGE_UNKNOWN_BAND=under13; no code change needed.
 */
export type AgeBand = 'under13' | 'teen' | 'adult';

export function ageFromBirthYear(birthYear: number | null | undefined, now = new Date()): number | null {
  if (birthYear == null || !Number.isInteger(birthYear)) return null;
  const age = now.getUTCFullYear() - birthYear;
  // Year only: the birthday may not have happened yet this year, so take the younger bound.
  return Math.max(0, age - 1);
}

export function unknownAgeBand(env: Record<string, string | undefined> = process.env): AgeBand {
  const v = env.AGE_UNKNOWN_BAND?.trim();
  return v === 'under13' || v === 'adult' ? v : 'teen';
}

export function ageBand(birthYear: number | null | undefined, now = new Date(), env = process.env): AgeBand {
  const age = ageFromBirthYear(birthYear, now);
  if (age == null) return unknownAgeBand(env);
  if (age < 13) return 'under13';
  if (age < 18) return 'teen';
  return 'adult';
}

export const isMinorBand = (b: AgeBand) => b !== 'adult';

/** W-12: existing users without a birth year get a one-time prompt on their next login. */
export function needsAgePrompt(u: { birthYear?: number | null; agePromptedAt?: Date | null }): boolean {
  return u.birthYear == null && u.agePromptedAt == null;
}

/** Messaging gate (owner 13:04): under-13 off; 13-17 only with mutually accepted friends; adults open. */
export function canMessage(sender: AgeBand, recipient: AgeBand, areFriends: boolean): boolean {
  if (sender === 'under13' || recipient === 'under13') return false;
  if (sender === 'teen' || recipient === 'teen') return areFriends;
  return true;
}
