// WLF-09: the API refuses to start in production without API_CORS_ORIGINS / ADMIN_APP_URL (no localhost fallback).
import * as assert from 'node:assert/strict';
import { assertProductionUrlConfig, assertProductionAuthConfig, corsOriginsFromEnv } from './runtime-security';

const ok = { NODE_ENV: 'production', API_CORS_ORIGINS: 'https://gotchaa.uz,https://www.gotchaa.uz', ADMIN_APP_URL: 'https://gotchaa.uz/admin' };
assert.doesNotThrow(() => assertProductionUrlConfig(ok));
assert.throws(() => assertProductionUrlConfig({ ...ok, API_CORS_ORIGINS: undefined }), /API_CORS_ORIGINS must be set/);
assert.throws(() => assertProductionUrlConfig({ ...ok, API_CORS_ORIGINS: ' , ' }), /API_CORS_ORIGINS must be set/);
assert.throws(() => assertProductionUrlConfig({ ...ok, ADMIN_APP_URL: undefined }), /ADMIN_APP_URL must be set/);
assert.throws(() => assertProductionUrlConfig({ ...ok, ADMIN_APP_URL: '  ' }), /ADMIN_APP_URL must be set/);
assert.throws(() => assertProductionUrlConfig({ ...ok, API_CORS_ORIGINS: 'https://gotchaa.uz,http://localhost:5173' }), /local origin/);
assert.throws(() => assertProductionUrlConfig({ ...ok, API_CORS_ORIGINS: 'http://127.0.0.1:3000' }), /local origin/);
assert.throws(() => assertProductionUrlConfig({ ...ok, ADMIN_APP_URL: 'http://localhost:5173/' }), /local URL/);
// dev/test: unchanged, localhost defaults still allowed
assert.doesNotThrow(() => assertProductionUrlConfig({ NODE_ENV: 'development' }));
assert.deepEqual(corsOriginsFromEnv({ NODE_ENV: 'development' }), ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']);
assert.deepEqual(corsOriginsFromEnv({ NODE_ENV: 'production' }), []);
assert.deepEqual(corsOriginsFromEnv(ok), ['https://gotchaa.uz', 'https://www.gotchaa.uz']);
// wired into the boot-time check that main.ts calls
const saved = { ...process.env };
try {
  Object.assign(process.env, { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), DEV_AUTH_ANY_CREDENTIAL: 'false' });
  delete process.env.API_CORS_ORIGINS; delete process.env.ADMIN_APP_URL;
  assert.throws(() => assertProductionAuthConfig(), /API_CORS_ORIGINS must be set/);
  process.env.API_CORS_ORIGINS = ok.API_CORS_ORIGINS;
  assert.throws(() => assertProductionAuthConfig(), /ADMIN_APP_URL must be set/);
  process.env.ADMIN_APP_URL = ok.ADMIN_APP_URL;
  assert.doesNotThrow(() => assertProductionAuthConfig());
} finally { process.env = saved; }
console.log('prod-url-config: OK');
