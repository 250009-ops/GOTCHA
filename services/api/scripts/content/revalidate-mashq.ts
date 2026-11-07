/**
 * Re-check already-paid OpenAI batch outputs with the 5–8 grounded-question rule.
 * Writes SQL for the rows that pass. Does not call the model.
 *
 * Usage: npx ts-node --transpile-only scripts/content/revalidate-mashq.ts <segments.jsonl>
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import OpenAI from 'openai';
import { acceptPageQuiz, foldSpace, readingPassage } from '../../src/modules/ai/quiz-grounding';

const root = resolve(__dirname, '../../../..');
const scratch = resolve(root, 'content-gen/.scratch');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function apiKey(): string {
  const line = readFileSync(resolve(root, 'deploy/.env'), 'utf8').split(/\n/).find((row) => row.startsWith('OPENAI_API_KEY='));
  if (!line) throw new Error('OPENAI_API_KEY missing');
  let value = line.slice('OPENAI_API_KEY='.length).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!value) throw new Error('OPENAI_API_KEY empty');
  return value;
}

function dollar(value: string): string {
  let tag = 'mq';
  while (value.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${value}$${tag}$`;
}

type Segment = { id: string; contentId: string; text: string; active: number };

async function loadSegments(path: string): Promise<Map<string, Segment>> {
  const map = new Map<string, Segment>();
  const rl = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as Segment;
    if (row.id) map.set(row.id, row);
  }
  return map;
}

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('segments jsonl required');
  const segments = await loadSegments(source);
  const listed = JSON.parse(execFileSync('python', ['scripts/content/remote.py', 'batches'], { encoding: 'utf8' })) as {
    batches: Array<{ id: string; status: string }>;
  };
  const client = new OpenAI({ apiKey: apiKey() });
  mkdirSync(scratch, { recursive: true });
  const sqlPath = resolve(scratch, 'mashq-revalidate.sql');
  const sql = createWriteStream(sqlPath, { encoding: 'utf8' });
  const inserted: Record<string, number> = {};
  let lines = 0;
  let acceptedPages = 0;
  let acceptedQuestions = 0;
  let rejected = 0;
  let skippedReady = 0;
  let missing = 0;
  let errors = 0;

  sql.write(`BEGIN;
CREATE TEMP TABLE mashq_before AS
SELECT segment_id, count(*)::int AS n FROM page_questions WHERE status = 'active' GROUP BY segment_id;
`);
  for (const batch of listed.batches) {
    const remote = await client.batches.retrieve(batch.id);
    if (remote.status !== 'completed' || !remote.output_file_id) {
      errors += 1;
      continue;
    }
    const file = await client.files.content(remote.output_file_id);
    const text = await file.text();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      lines += 1;
      let row: { custom_id?: string; error?: unknown; response?: { status_code?: number; body?: { choices?: Array<{ message?: { content?: string } }> } } };
      try {
        row = JSON.parse(line) as typeof row;
      } catch {
        errors += 1;
        continue;
      }
      const segmentId = row.custom_id ?? '';
      const segment = segments.get(segmentId);
      if (!segment || !UUID.test(segment.id) || !UUID.test(segment.contentId)) {
        missing += 1;
        continue;
      }
      if (Number(segment.active) >= 5) {
        skippedReady += 1;
        continue;
      }
      if (row.error || row.response?.status_code !== 200) {
        rejected += 1;
        continue;
      }
      let questions: unknown;
      try {
        questions = JSON.parse(row.response?.body?.choices?.[0]?.message?.content ?? '{}').questions;
      } catch {
        questions = null;
      }
      const items = acceptPageQuiz(questions, segment.text);
      if (!items) {
        rejected += 1;
        continue;
      }
      const passage = readingPassage(segment.text);
      const hash = createHash('sha256').update(passage).digest('hex');
      const plain = foldSpace(segment.text);
      for (const item of items) {
        const quote = foldSpace(item.evidenceQuote);
        const at = plain.toLowerCase().indexOf(quote.toLowerCase());
        const prompt = JSON.stringify({ ...item.prompt });
        const options = JSON.stringify({ ...item.options });
        const explanation = JSON.stringify({ ...item.explanation });
        sql.write(`INSERT INTO page_questions (id, segment_id, content_id, segment_hash, prompt_i18n, options_i18n, answer_index, evidence_start, evidence_end, evidence_quote, explanation_i18n, generator_version, status)
SELECT gen_random_uuid(), '${segment.id}'::uuid, '${segment.contentId}'::uuid, ${dollar(hash)}, ${dollar(prompt)}::jsonb, ${dollar(options)}::jsonb, ${item.answerIndex}, ${Math.max(0, at)}, ${at < 0 ? 0 : at + quote.length}, ${dollar(item.evidenceQuote)}, ${dollar(explanation)}::jsonb, 'openai-batch', 'active'
WHERE coalesce((SELECT n FROM mashq_before WHERE segment_id = '${segment.id}'::uuid), 0) < 5
  AND NOT EXISTS (SELECT 1 FROM page_questions WHERE segment_id = '${segment.id}'::uuid AND status = 'active' AND evidence_quote = ${dollar(item.evidenceQuote)});\n`);
      }
      inserted[segment.id] = items.length;
      acceptedPages += 1;
      acceptedQuestions += items.length;
    }
  }
  sql.write(`UPDATE content_segments s
SET quiz_ready_count = (SELECT count(*) FROM page_questions pq WHERE pq.segment_id = s.id AND pq.status = 'active')
WHERE s.id IN (SELECT DISTINCT segment_id FROM page_questions WHERE generator_version = 'openai-batch');\n`);
  sql.write('COMMIT;\n');
  await new Promise((resolveClose, rejectClose) => {
    sql.end(() => resolveClose(undefined));
    sql.on('error', rejectClose);
  });
  writeFileSync(resolve(scratch, 'mashq-inserted.json'), JSON.stringify(inserted));
  const report = { lines, acceptedPages, acceptedQuestions, rejected, skippedReady, missing, errors, sql: 'content-gen/.scratch/mashq-revalidate.sql' };
  writeFileSync(resolve(scratch, 'mashq-revalidate-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

main().catch((error) => {
  const status = typeof error === 'object' && error && 'status' in error ? (error as { status?: number }).status : '';
  console.error(`revalidate failed${status ? ` status=${status}` : ''}`);
  process.exit(1);
});
