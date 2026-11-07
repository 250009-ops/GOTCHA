#!/usr/bin/env node
// Claude speed test for Gotcha word taps. No installs needed (Node 18+).
// PLAN MODE (your Claude Pro plan, no API key):
//   1) npm i -g @anthropic-ai/claude-code     2) claude   (sign in with your Claude account once, then /exit)
//   3) node services/api/scripts/claude-speed-test.mjs --plan
// API MODE: put ANTHROPIC_API_KEY=sk-ant-... in deploy/.env, then run without --plan.
// Keys/tokens are never printed.

import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
function envKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY.trim();
  try {
    const env = readFileSync(join(root, 'deploy', '.env'), 'utf8');
    const line = env.split(/\r?\n/).find((l) => l.trim().startsWith('ANTHROPIC_API_KEY='));
    return line ? line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

const PLAN = process.argv.includes('--plan');
const KEY = PLAN ? '' : envKey();
const MODEL = PLAN ? 'haiku (Claude Code, your plan)' : process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
if (!PLAN && !KEY) {
  console.error('No ANTHROPIC_API_KEY found. Add it to deploy/.env and run again.');
  process.exit(1);
}

const SYSTEM =
  'You are a dictionary for language learners. For TARGET as used in SENTENCE, reply with ONE JSON object only: ' +
  '{"lemma": base form, "translation": 1-3 word meaning in GLOSS LANGUAGE, "contextualMeaning": short in-context meaning in GLOSS LANGUAGE}. ' +
  'Uzbek in Latin script with oʻ/gʻ. No markdown.';

const CASES = [
  ['looked', 'She looked out of the window for a long time.', 'English', 'Uzbek'],
  ['gave up', 'He finally gave up smoking last year.', 'English', 'Uzbek'],
  ['pearl', 'Kino found the greatest pearl in the world.', 'English', 'Russian'],
  ['стал', 'Он стал врачом через десять лет.', 'Russian', 'Uzbek'],
  ['шинель', 'Акакий Акакиевич купил новую шинель.', 'Russian', 'English'],
  ['будто', 'Ему казалось, будто все смотрят на него.', 'Russian', 'Uzbek'],
  ['wurde', 'Das Haus wurde im Jahr 1900 gebaut.', 'German', 'Uzbek'],
  ['Irrenhaus', 'Die Physiker leben in einem Irrenhaus.', 'German', 'Russian'],
  ['einmal', 'Ich war nur einmal in Berlin.', 'German', 'English'],
  ['şimdi', 'Şimdi eve gitmek istiyorum.', 'Turkish', 'Uzbek'],
  ['ses', 'Gecenin içinde güzel bir ses duydum.', 'Turkish', 'Russian'],
  ['dala', 'Otamdan qolgan dalalar hali ham koʻm-koʻk.', 'Uzbek', 'Russian'],
  ['ketdi', 'U erta tongda shaharga ketdi.', 'Uzbek', 'English'],
  ['brave', 'The brave girl walked into the dark forest.', 'English', 'Russian'],
  ['however', 'However, the plan did not work.', 'English', 'Uzbek'],
  ['nichts', 'Er hat nichts gesagt.', 'German', 'Uzbek'],
  ['ведь', 'Ты ведь знаешь, что я прав.', 'Russian', 'English'],
  ['run out of', 'We have run out of milk again.', 'English', 'Uzbek'],
  ['başka', 'Başka bir yol bulmalıyız.', 'Turkish', 'English'],
  ['katta', 'Bu juda katta uy ekan.', 'Uzbek', 'English'],
];

function lookupPlan([target, sentence, source, gloss]) {
  const t0 = performance.now();
  const prompt = `${SYSTEM}\nDo not use tools. Answer directly.\n\nTARGET: "${target}"\nSENTENCE: "${sentence}"\nSOURCE LANGUAGE: ${source}\nGLOSS LANGUAGE: ${gloss}`;
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'text', '--model', 'haiku', '--max-turns', '1'], {
      cwd: tmpdir(),
      shell: process.platform === 'win32',
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => reject(new Error(`claude CLI not found: ${e.message}`)));
    child.on('close', (code) => {
      const total = performance.now() - t0;
      if (code !== 0) return reject(new Error(`exit ${code}: ${(err || out).slice(0, 200)}`));
      let translation = out.trim();
      try {
        translation = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)).translation ?? translation;
      } catch {
        /* raw */
      }
      resolve({ first: total, total, translation });
    });
    child.stdin.end(prompt);
  });
}

async function lookup([target, sentence, source, gloss]) {
  const t0 = performance.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      stream: true,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `TARGET: "${target}"\nSENTENCE: "${sentence}"\nSOURCE LANGUAGE: ${source}\nGLOSS LANGUAGE: ${gloss}` }],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  let first = null;
  let text = '';
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      try {
        const ev = JSON.parse(line.slice(5));
        if (ev.type === 'content_block_delta' && ev.delta?.text) {
          if (first === null) first = performance.now() - t0;
          text += ev.delta.text;
        }
      } catch {
        /* keep-alive */
      }
    }
  }
  const total = performance.now() - t0;
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  let translation = text.trim();
  try {
    translation = JSON.parse(json).translation ?? translation;
  } catch {
    /* show raw */
  }
  return { first: first ?? total, total, translation };
}

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

console.log(`Model: ${MODEL}\n`);
console.log('word'.padEnd(12), 'gloss'.padEnd(8), 'first ms'.padStart(9), 'total ms'.padStart(9), '  translation');
const firsts = [];
const totals = [];
for (const c of CASES) {
  try {
    const r = PLAN ? await lookupPlan(c) : await lookup(c);
    firsts.push(r.first);
    totals.push(r.total);
    console.log(c[0].padEnd(12), c[3].slice(0, 7).padEnd(8), r.first.toFixed(0).padStart(9), r.total.toFixed(0).padStart(9), ' ', r.translation);
  } catch (e) {
    console.log(c[0].padEnd(12), 'ERROR', e.message);
    if (/401|403/.test(e.message)) break;
  }
}
if (totals.length) {
  console.log(`\nFirst text   p50 ${pct(firsts, 50).toFixed(0)} ms   p95 ${pct(firsts, 95).toFixed(0)} ms`);
  console.log(`Full answer  p50 ${pct(totals, 50).toFixed(0)} ms   p95 ${pct(totals, 95).toFixed(0)} ms`);
  console.log(pct(totals, 50) < 2000 ? '\nFAST ENOUGH for word taps.' : '\nSlower than the 2 s target.');
}
