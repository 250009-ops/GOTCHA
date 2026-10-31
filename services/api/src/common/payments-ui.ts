/**
 * Payments on/off, ONE flag (final-6): the API env PAYMENT_GATEWAY_ENABLED (true/1/yes/on), the same value
 * import-commerce.gatewayEnabled() and GET /billing/gateway-status report. IMPORTS_UNLIMITED / DEV_UNLIMITED_IMPORTS
 * turn it off (dev only; leave unset in prod). final-5's separate PAYMENTS_UI_ENABLED gate is retired: a second,
 * default-off flag would force payments off in prod while the gateway is on.
 */
const on = (v: unknown) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').trim().toLowerCase());

export function paymentsUiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (on(env.IMPORTS_UNLIMITED) || on(env.DEV_UNLIMITED_IMPORTS)) return false;
  return on(env.PAYMENT_GATEWAY_ENABLED);
}
