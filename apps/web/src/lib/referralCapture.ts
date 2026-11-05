const CODE = /^[A-Z0-9]{4,16}$/;

/** /r/:code sets gotcha_ref for 30 days and sends the browser to register?ref=CODE. */
export function referralCapture(code: string, registerPath = '/register') {
  const normalized = code.trim().toUpperCase().replace(/^R_/, '').replace(/[^A-Z0-9]/g, '');
  if (!CODE.test(normalized)) return null;
  const maxAge = 30 * 24 * 60 * 60;
  const base = registerPath.replace(/\?.*$/, '');
  return {
    code: normalized,
    cookie: `gotcha_ref=${normalized}; Max-Age=${maxAge}; Path=/; SameSite=Lax`,
    location: `${base}?ref=${encodeURIComponent(normalized)}`,
  };
}
