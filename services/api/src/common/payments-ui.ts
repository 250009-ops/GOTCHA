/**
 * final-5 B4: paid-import / pay-as-you-go upsells and checkout copy stay hidden until payments-02 is live.
 * PAYMENTS_UI_ENABLED=true turns them on; anything else (including unset) = off.
 */
export function paymentsUiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(env.PAYMENTS_UI_ENABLED ?? '').trim().toLowerCase());
}
