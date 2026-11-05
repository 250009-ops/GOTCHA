/** Uzbekistan numbers become E.164 (+998XXXXXXXXX). Spaces, dashes and a leading 0 are accepted. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.trim().replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^998\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+998${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `+998${digits}`;
  return null;
}

/** +998901234567 → +998 90 *** ** 67 */
export function maskPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 12 || !digits.startsWith('998')) return null;
  const operator = digits.slice(3, 5);
  const last = digits.slice(-2);
  return `+998 ${operator} *** ** ${last}`;
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
