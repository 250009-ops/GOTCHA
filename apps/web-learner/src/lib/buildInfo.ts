/** S4 (final-6.1): build id stamped by build-dists (VITE_BUILD_SHA = git short sha, VITE_BUILD_DATE = UTC date). */
export function buildLabel(env: Record<string, unknown> = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {}): string {
  const sha = String(env.VITE_BUILD_SHA || 'dev').trim();
  const date = String(env.VITE_BUILD_DATE || '').trim();
  return date ? `build ${sha} · ${date}` : `build ${sha}`;
}
