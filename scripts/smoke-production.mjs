/**
 * Production smoke test for https://gotchaa.uz
 * Usage: node scripts/smoke-production.mjs
 */
const BASE = 'https://gotchaa.uz';
const API = `${BASE}/api/v1`;
const stamp = Date.now();
const testEmail = `smoke.${stamp}@gotcha.test`;
const testPass = 'SmokeTest2026!';

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
  return { status: res.status, headers: res.headers, text, json, location: res.headers.get('location') };
}

async function main() {
  console.log(`\n=== GOTCHA production smoke — ${BASE} ===\n`);

  // DNS / TLS / static
  {
    const r = await req('GET', `${BASE}/`);
    ok('Marketing HTTPS', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('GET', `http://gotchaa.uz/`);
    ok('HTTP→HTTPS redirect', r.status === 301 || r.status === 302, `status=${r.status} loc=${r.location || ''}`);
  }
  {
    const r = await req('GET', `${BASE}/learn/`);
    ok('Learner shell', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('GET', `${BASE}/learn/login`);
    ok('Learner login page', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('GET', `${BASE}/learn/register`);
    ok('Learner register page', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('GET', `${BASE}/learn/forgot-password`);
    ok('Forgot password page', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('GET', `${BASE}/learn/verify-email`);
    ok('Verify email page', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('GET', `${BASE}/admin/`);
    ok('Admin shell', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('GET', `${BASE}/api/docs`);
    ok('Swagger docs', r.status === 200 || r.status === 301, `status=${r.status}`);
  }

  // Bundles must not point at localhost
  {
    const html = await (await fetch(`${BASE}/learn/`)).text();
    const m = html.match(/assets\/(index-[^"]+\.js)/);
    if (!m) {
      ok('Learner bundle URL', false, 'no index-*.js in HTML');
    } else {
      const js = await (await fetch(`${BASE}/learn/assets/${m[1]}`)).text();
      const hasLocal = js.includes('localhost:3000');
      const hasProd = js.includes('gotchaa.uz/api/v1');
      ok('Learner build uses prod API', !hasLocal && hasProd, hasLocal ? 'contains localhost:3000' : 'api ok');
    }
  }

  // Auth: demo learner
  let learnerToken = null;
  {
    const r = await req('POST', `${API}/auth/login`, {
      body: { email: 'learner@gotcha.app', password: 'Learner2026!' },
    });
    const pass = r.status === 201 && !!r.json?.accessToken;
    learnerToken = r.json?.accessToken || null;
    ok('Demo learner login', pass, `status=${r.status}`);
  }

  // Auth: user account
  {
    const r = await req('POST', `${API}/auth/login`, {
      body: { email: '250009@tmuni.org', password: 'Ja53j9lCrYYJFjW' },
    });
    ok('User 250009@tmuni.org login', r.status === 201 && !!r.json?.accessToken, `status=${r.status}`);
  }

  // Auth: admin
  let adminToken = null;
  {
    const r = await req('POST', `${API}/auth/login`, {
      body: { email: 'admin@gotcha.app', password: 'GotchaAdmin2026!' },
    });
    const pass = r.status === 201 && !!r.json?.accessToken && r.json?.isAdmin === true;
    adminToken = r.json?.accessToken || null;
    ok('Demo admin login', pass, `status=${r.status} isAdmin=${r.json?.isAdmin}`);
  }

  // Register → verify gate
  {
    const r = await req('POST', `${API}/auth/register`, {
      body: {
        email: testEmail,
        password: testPass,
        displayName: 'Smoke Test',
        nativeLanguage: 'en',
        targetLanguages: ['ru'],
      },
    });
    ok(
      'Register requires email verification',
      r.status === 201 && r.json?.requiresEmailVerification === true,
      `status=${r.status} requires=${r.json?.requiresEmailVerification}`,
    );
  }
  {
    const r = await req('POST', `${API}/auth/login`, {
      body: { email: testEmail, password: testPass },
    });
    ok(
      'Unverified login blocked',
      r.status === 401 && (r.json?.code === 'EMAIL_NOT_VERIFIED' || /verify/i.test(r.json?.message || '')),
      `status=${r.status} code=${r.json?.code || ''}`,
    );
  }
  {
    const r = await req('POST', `${API}/auth/forgot-password`, {
      body: { email: testEmail },
    });
    ok('Forgot password (generic success)', r.status === 201 || r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('POST', `${API}/auth/resend-verification`, {
      body: { email: testEmail },
    });
    ok('Resend verification', r.status === 201 || r.status === 200, `status=${r.status}`);
  }

  // Authenticated learner APIs
  if (learnerToken) {
    {
      const r = await req('GET', `${API}/users/me`, { token: learnerToken });
      ok('GET /users/me', r.status === 200 && !!r.json?.email, `status=${r.status}`);
    }
    {
      const r = await req('GET', `${API}/users/me/stats`, { token: learnerToken });
      ok('GET /users/me/stats', r.status === 200, `status=${r.status}`);
    }
    {
      const r = await req('GET', `${API}/vocabulary`, { token: learnerToken });
      ok('GET /vocabulary', r.status === 200 && Array.isArray(r.json), `status=${r.status} n=${Array.isArray(r.json) ? r.json.length : '?'}`);
    }
    {
      const r = await req('GET', `${API}/content`, { token: learnerToken });
      const items = r.json?.items || r.json?.data || r.json;
      ok('GET /content (library)', r.status === 200, `status=${r.status} type=${Array.isArray(items) ? 'array' : typeof r.json}`);
    }
    {
      const r = await req('GET', `${API}/imports`, { token: learnerToken });
      ok('GET /imports', r.status === 200, `status=${r.status}`);
    }
  } else {
    ok('Learner authenticated suite', false, 'skipped — no token');
  }

  // Admin APIs
  if (adminToken) {
    {
      const r = await req('GET', `${API}/admin/dashboard`, { token: adminToken });
      // endpoint name may vary — try a few
      if (r.status === 404) {
        const r2 = await req('GET', `${API}/admin/analytics`, { token: adminToken });
        ok('Admin analytics/dashboard', r2.status === 200 || r2.status === 201, `analytics status=${r2.status}`);
      } else {
        ok('Admin dashboard', r.status === 200, `status=${r.status}`);
      }
    }
    {
      const r = await req('GET', `${API}/admin/users`, { token: adminToken });
      ok('Admin users', r.status === 200 || r.status === 404, `status=${r.status}`);
    }
  } else {
    ok('Admin authenticated suite', false, 'skipped — no token');
  }

  // Marketing public API
  {
    const r = await req('GET', `${API}/marketing/plans`);
    ok('Marketing plans', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('GET', `${API}/marketing/stats`);
    ok('Marketing stats', r.status === 200, `status=${r.status}`);
  }

  // CORS preflight
  {
    const r = await fetch(`${API}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: BASE,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization',
      },
    });
    const allow = r.headers.get('access-control-allow-origin');
    ok('CORS for gotchaa.uz', r.status < 400 && (!!allow || r.status === 204 || r.status === 200), `status=${r.status} allow=${allow || 'n/a'}`);
  }

  const failed = results.filter((x) => !x.pass);
  console.log(`\n=== Summary: ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    console.log('Failures:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log('All smoke checks passed.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
