const CODE = /^[A-Z0-9]{4,16}$/;

/** Normalise a referral code. Returns null when it cannot be a code. */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase().replace(/^R_/, '').replace(/[^A-Z0-9]/g, '');
  return CODE.test(code) ? code : null;
}

/**
 * Website /r/:code capture. Cookie lasts 30 days, SameSite=Lax.
 * `registerPath` is the learner register URL the browser is sent to.
 */
export function referralCapture(code: string, registerPath = '/register') {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const maxAge = 30 * 24 * 60 * 60;
  const base = registerPath.replace(/\?.*$/, '');
  return {
    code: normalized,
    cookie: `gotcha_ref=${normalized}; Max-Age=${maxAge}; Path=/; SameSite=Lax`,
    location: `${base}?ref=${encodeURIComponent(normalized)}`,
  };
}

export type StartRoute =
  | { type: 'start' }
  | { type: 'signup' }
  | { type: 'referral'; code: string }
  | { type: 'login'; token: string };

export function parseStartParam(payload: string | null | undefined): StartRoute {
  const value = (payload ?? '').trim();
  if (!value) return { type: 'start' };
  if (value === 'signup') return { type: 'signup' };
  if (value.startsWith('r_')) {
    const code = normalizeReferralCode(value.slice(2));
    return code ? { type: 'referral', code } : { type: 'start' };
  }
  if (value.startsWith('login_')) {
    const token = value.slice('login_'.length).trim();
    return token ? { type: 'login', token } : { type: 'start' };
  }
  return { type: 'start' };
}
