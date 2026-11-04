/** First-run learner tour. One device flag; finishing or skipping sets it. */
export const ONBOARDING_DONE_KEY = 'gotcha.onboarding.done';
export const ONBOARDING_STEP_KEY = 'gotcha.onboarding.step';

export const ONBOARDING_STEPS = ['level', 'demo', 'book', 'practice'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isOnboardingDone(storage: Storage | null = store()): boolean {
  return storage?.getItem(ONBOARDING_DONE_KEY) === '1';
}

export function readOnboardingStep(storage: Storage | null = store()): OnboardingStep {
  const raw = storage?.getItem(ONBOARDING_STEP_KEY);
  return (ONBOARDING_STEPS as readonly string[]).includes(raw ?? '') ? (raw as OnboardingStep) : 'level';
}

export function writeOnboardingStep(step: OnboardingStep, storage: Storage | null = store()) {
  storage?.setItem(ONBOARDING_STEP_KEY, step);
}

export function markOnboardingDone(storage: Storage | null = store()) {
  storage?.setItem(ONBOARDING_DONE_KEY, '1');
  storage?.removeItem(ONBOARDING_STEP_KEY);
}
