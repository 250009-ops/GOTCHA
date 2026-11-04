/**
 * Smoke test: login → upload multi-page text PDF → poll until ready.
 * Usage: node scripts/smoke-large-pdf-import.mjs [pdfPath]
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const API = process.env.API_BASE || 'http://localhost:3000/api/v1';
const pdfPath = resolve(process.argv[2] || 'tmp/synthetic-60p.pdf');
const email = process.env.SMOKE_EMAIL || 'learner@gotcha.app';
const password = process.env.SMOKE_PASSWORD;

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON (${res.status}): ${text.slice(0, 300)}`);
  }
}

const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const login = await json(loginRes);
if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(login)}`);
const token = login.accessToken || login.access_token;
if (!token) throw new Error('No access token in login response');

const buf = readFileSync(pdfPath);
const form = new FormData();
form.append('file', new Blob([buf], { type: 'application/pdf' }), 'synthetic.pdf');
form.append('language', 'en');
form.append('title', `Smoke ${pdfPath.split(/[/\\]/).pop()}`);

const importRes = await fetch(`${API}/imports/file`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const created = await json(importRes);
if (!importRes.ok) throw new Error(`Import failed: ${JSON.stringify(created)}`);

console.log(
  JSON.stringify(
    {
      phase: 'submitted',
      id: created.id,
      status: created.ingestionStatus,
      progressPagesDone: created.progressPagesDone,
      progressPagesTotal: created.progressPagesTotal,
    },
    null,
    2,
  ),
);

const started = Date.now();
let last = created;
while (Date.now() - started < 180_000) {
  await new Promise((r) => setTimeout(r, 1500));
  const listRes = await fetch(`${API}/imports?page=1&pageSize=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list = await json(listRes);
  last = (list.items || []).find((i) => i.id === created.id) || last;
  console.log(
    JSON.stringify({
      phase: 'poll',
      status: last.ingestionStatus,
      progressPagesDone: last.progressPagesDone,
      progressPagesTotal: last.progressPagesTotal,
      wordCount: last.content?.wordCount ?? null,
      errorMessage: last.errorMessage ?? null,
      elapsedMs: Date.now() - started,
    }),
  );
  if (last.ingestionStatus === 'ready' || last.ingestionStatus === 'failed') break;
}

if (last.ingestionStatus !== 'ready') {
  console.error(JSON.stringify({ phase: 'failed', last }, null, 2));
  process.exit(1);
}

let segmentCount = null;
if (last.content?.id) {
  const segRes = await fetch(`${API}/content/${last.content.id}/segments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (segRes.ok) {
    const segs = await json(segRes);
    segmentCount = Array.isArray(segs) ? segs.length : segs?.items?.length ?? segs?.segments?.length ?? null;
  }
}

console.log(
  JSON.stringify(
    {
      phase: 'ready',
      id: last.id,
      contentId: last.content?.id,
      wordCount: last.content?.wordCount,
      segmentCount,
      progressPagesDone: last.progressPagesDone,
      progressPagesTotal: last.progressPagesTotal,
      elapsedMs: Date.now() - started,
      pdfPath,
    },
    null,
    2,
  ),
);
