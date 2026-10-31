export function isDevAuthEnabled(): boolean {
  return process.env.DEV_AUTH_ANY_CREDENTIAL === 'true';
}
