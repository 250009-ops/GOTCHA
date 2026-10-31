/**
 * S3b (final-6.1): the birth-year prompt never blocks the app. It is shown at most once per account on this
 * device, as a dismissible non-modal card; dismissing (✕, Esc, "prefer not to say") is remembered.
 */
export const AGE_PROMPT_KEY = (userId: string) => `gotcha.agePrompt.dismissed.${userId}`;
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export function shouldShowAgePrompt(user: { id?: string; needsAgePrompt?: boolean } | null | undefined, store: Store | null): boolean {
  if (!user?.id || !user.needsAgePrompt) return false;
  try { return store?.getItem(AGE_PROMPT_KEY(user.id)) !== '1'; } catch { return true; }
}
export function rememberAgePromptDismissed(userId: string | undefined, store: Store | null): void {
  if (!userId) return;
  try { store?.setItem(AGE_PROMPT_KEY(userId), '1'); } catch { /* private mode: in-memory state still hides it */ }
}
/** The prompt must not cover or lock the app: no full-screen backdrop, no aria-modal, pointer events pass through. */
export const AGE_PROMPT_LAYOUT = { modal: false, backdrop: false } as const;
