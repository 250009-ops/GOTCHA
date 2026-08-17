import { lookup } from 'dns/promises';
import { isIP } from 'net';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
]);

function ipv4Octets(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

export function isBlockedIpAddress(ip: string): boolean {
  const value = ip.trim().toLowerCase();
  if (!value) return true;
  if (value.startsWith('::ffff:')) return isBlockedIpAddress(value.slice(7));
  if (value.includes(':')) {
    if (value === '::' || value === '::1') return true;
    if (value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('ff')) {
      return true;
    }
    return false;
  }
  const oct = ipv4Octets(value);
  if (!oct) return true;
  const [a, b] = oct;
  if (a === 0 || a === 10 || a === 127 || a >= 240) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export async function assertSafePublicUrl(raw: string, label = 'URL'): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} is not valid.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must use http or https.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not include credentials.`);
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error(`${label} is not allowed.`);
  }
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) {
      throw new Error(`${label} is not allowed.`);
    }
    const dotted = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    if (isBlockedIpAddress(dotted)) throw new Error(`${label} is not allowed.`);
    return parsed;
  }
  if (isIP(host)) {
    if (isBlockedIpAddress(host)) throw new Error(`${label} is not allowed.`);
    return parsed;
  }
  let records: Array<{ address: string }>;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`${label} could not be resolved.`);
  }
  if (!records.length || records.some((row) => isBlockedIpAddress(row.address))) {
    throw new Error(`${label} is not allowed.`);
  }
  return parsed;
}
