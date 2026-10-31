/**
 * round-3b WLF-16: prisma/seed.ts is a dev/test fixture loader, never a prod tool.
 * Refuses unless ALLOW_SEED=1, NODE_ENV is not production, and the DB host is local/test.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres', 'db', 'host.docker.internal']);

export function seedRefusal(env: NodeJS.ProcessEnv = process.env): string | null {
  if (String(env.NODE_ENV ?? '').trim().toLowerCase() === 'production') return 'NODE_ENV=production';
  if (env.ALLOW_SEED !== '1') return 'ALLOW_SEED=1 is not set';
  const url = env.DATABASE_URL ?? '';
  let host = '';
  let db = '';
  try { const u = new URL(url); host = u.hostname.toLowerCase(); db = u.pathname.replace(/^\//, '').toLowerCase(); } catch { return 'DATABASE_URL is missing or invalid'; }
  const testy = /(^|[_-])(test|dev|local|qa|ci|seed)([_-]|\d|$)/.test(db);
  if (!LOCAL_HOSTS.has(host) && !host.endsWith('.local') && !testy) return `DB host ${host} is not local/test`;
  return null;
}
