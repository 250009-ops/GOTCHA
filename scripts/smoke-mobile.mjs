/**
 * Mobile pre-production smoke test for the GOTCHA Android app.
 * Validates production API routes the app uses, App Links, billing, and optional device/AAB checks.
 *
 * Usage:
 *   node scripts/smoke-mobile.mjs
 *   node scripts/smoke-mobile.mjs --aab apps/android/app/build/outputs/bundle/release/app-release.aab
 */
const BASE = process.env.GOTCHA_BASE || 'https://gotchaa.uz';
const API = `${BASE}/api/v1`;
const LEARNER_EMAIL = process.env.SMOKE_LEARNER_EMAIL || 'learner@gotcha.app';
const LEARNER_PASSWORD = process.env.SMOKE_LEARNER_PASSWORD;
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD;

const args = process.argv.slice(2);
const aabArgIdx = args.indexOf('--aab');
const aabPath = aabArgIdx >= 0 ? args[aabArgIdx + 1] : null;

const results = [];

function ok(name, pass, detail = '') {
  results.push({ name, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`${mark.padEnd(4)} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, url, { body, token, headers } = {}) {
  const h = { ...(headers || {}) };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, text, json, location: res.headers.get('location') };
}

async function login(email, password) {
  const r = await req('POST', `${API}/auth/login`, { body: { email, password } });
  return { res: r, token: r.json?.accessToken || null };
}

async function checkAuthedRoutes(label, token, paths) {
  if (!token) {
    ok(`${label} authenticated suite`, false, 'skipped — no token');
    return;
  }
  for (const path of paths) {
    const r = await req('GET', `${API}${path}`, { token });
    ok(`${label} ${path}`, r.status >= 200 && r.status < 300, `status=${r.status}`);
  }
}

async function checkAssetLinks() {
  const r = await req('GET', `${BASE}/.well-known/assetlinks.json`);
  if (r.status !== 200) {
    ok('App Links assetlinks.json', false, `status=${r.status}`);
    return;
  }
  let links;
  try {
    links = JSON.parse(r.text);
  } catch {
    ok('App Links assetlinks.json', false, 'invalid JSON');
    return;
  }
  const release = links.find((entry) => entry?.target?.package_name === 'app.gotcha.android');
  const debug = links.find((entry) => entry?.target?.package_name === 'app.gotcha.android.debug');
  ok('App Links release package', !!release, release ? 'app.gotcha.android' : 'missing');
  ok('App Links debug package', !!debug, debug ? 'app.gotcha.android.debug' : 'missing');
  ok(
    'App Links release fingerprint',
    Array.isArray(release?.target?.sha256_cert_fingerprints) && release.target.sha256_cert_fingerprints.length > 0,
    release?.target?.sha256_cert_fingerprints?.[0] || 'none',
  );
}

async function checkBillingGateway() {
  const r = await req('GET', `${API}/billing/gateway-status`);
  const pass = r.status === 200 && r.json?.paymentGatewayEnabled === true;
  ok(
    'Billing gateway enabled',
    pass,
    r.status === 200
      ? `enabled=${r.json?.paymentGatewayEnabled} atmos=${r.json?.atmosConfigured}`
      : `status=${r.status}`,
  );
}

async function checkDeviceOptional() {
  const { execSync } = await import('node:child_process');
  const { existsSync } = await import('node:fs');
  const adbCandidates = [
    process.env.ADB,
    `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`,
    `${process.env.USERPROFILE}/AppData/Local/Android/Sdk/platform-tools/adb.exe`,
  ].filter(Boolean);
  const adb = adbCandidates.find((p) => existsSync(p));
  if (!adb) {
    ok('Connected Android device (optional)', true, 'skipped — adb not found');
    return;
  }
  try {
    const out = execSync(`"${adb}" devices`, { encoding: 'utf8' });
    const devices = out
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line.endsWith('\tdevice'));
    ok('Connected Android device (optional)', devices.length > 0, devices.length ? `${devices.length} device(s)` : 'none');
    if (devices.length === 0) return;
    const packages = execSync(`"${adb}" shell pm list packages`, { encoding: 'utf8' });
    const hasDebug = packages.includes('app.gotcha.android.debug');
    const hasRelease = packages.includes('app.gotcha.android');
    ok('Debug app installed (optional)', hasDebug, hasDebug ? 'app.gotcha.android.debug' : 'not installed');
    ok('Release app installed (optional)', hasRelease, hasRelease ? 'app.gotcha.android' : 'not installed');
    const crashes = execSync(`"${adb}" logcat -d -s AndroidRuntime:E`, { encoding: 'utf8' }).trim();
    ok('Recent AndroidRuntime crashes (optional)', !crashes, crashes ? 'see logcat' : 'none');
  } catch (err) {
    ok('Connected Android device (optional)', false, err.message);
  }
}

async function checkAabOptional() {
  if (!aabPath) {
    ok('Release AAB artifact (optional)', true, 'skipped — pass --aab path');
    return;
  }
  const { existsSync, statSync } = await import('node:fs');
  const { basename, resolve } = await import('node:path');
  const path = resolve(aabPath);
  if (!existsSync(path)) {
    ok('Release AAB artifact (optional)', false, `missing: ${path}`);
    return;
  }
  const size = statSync(path).size;
  ok('Release AAB artifact (optional)', size > 1024 * 1024, `${basename(path)} (${Math.round(size / 1024 / 1024)} MB)`);
}

async function main() {
  console.log(`\n=== GOTCHA mobile smoke — ${BASE} ===\n`);

  {
    const r = await req('GET', `${BASE}/`);
    ok('Marketing HTTPS', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('GET', `${BASE}/learn/login`);
    ok('Learner login page', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('GET', `${BASE}/admin/`);
    ok('Admin shell', r.status === 200, `status=${r.status}`);
  }

  await checkAssetLinks();
  await checkBillingGateway();

  {
    const { res, token } = await login(LEARNER_EMAIL, LEARNER_PASSWORD);
    ok('Demo learner login', res.status === 201 && !!token, `status=${res.status}`);
    await checkAuthedRoutes('Learner', token, [
      '/users/me',
      '/content',
      '/vocabulary',
      '/imports',
      '/users/me/stats',
    ]);
  }

  {
    const { res, token } = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const pass = res.status === 201 && !!token && res.json?.isAdmin === true;
    ok('Demo admin login', pass, `status=${res.status} isAdmin=${res.json?.isAdmin}`);
    await checkAuthedRoutes('Admin', token, [
      '/admin/dashboard',
      '/admin/content',
      '/admin/import-pricing',
      '/admin/me',
    ]);
  }

  {
    const r = await req('GET', `${API}/marketing/plans`);
    ok('Marketing plans', r.status === 200, `status=${r.status}`);
  }

  await checkDeviceOptional();
  await checkAabOptional();

  const failed = results.filter((x) => !x.pass);
  console.log(`\n=== Summary: ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    console.log('Failures:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log('All mobile smoke checks passed.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
