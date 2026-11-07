/**
 * Validate done/ files and upsert them. Invalid items are written to content-gen/rejected/.
 * Usage: npx ts-node --transpile-only scripts/content/import-content.ts [--apply]
 * Without --apply, prints counts and writes rejected files only.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { foldSpace, readingPassage } from '../../src/modules/ai/quiz-grounding';
import { validateDictFile, validateMashqFile, type MashqPage } from '../../src/modules/content/content-gen';

const root = resolve(__dirname, '../../../..');
const dictDir = resolve(root, 'content-gen/dictionary/done');
const mashqDir = resolve(root, 'content-gen/mashq/done');
const rejectedDir = resolve(root, 'content-gen/rejected');
const scratch = resolve(root, 'content-gen/.scratch');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function files(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
  } catch {
    return [];
  }
}

function dollar(value: string): string {
  let tag = 'imp';
  while (value.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${value}$${tag}$`;
}

function dirBytes(dir: string): number {
  return files(dir).reduce((sum, name) => sum + statSync(resolve(dir, name)).size, 0);
}

function main() {
  const apply = process.argv.includes('--apply');
  mkdirSync(rejectedDir, { recursive: true });
  mkdirSync(scratch, { recursive: true });
  const sql: string[] = ['BEGIN;'];
  let dictOk = 0;
  let dictRejected = 0;
  let mashqOk = 0;
  let mashqRejected = 0;
  const segmentsPath = resolve(scratch, 'segments.jsonl');
  const pages = new Map<string, { text: string; sourceLang: string }>();
  try {
    const text = readFileSync(segmentsPath, 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as { id: string; lang: string; text: string };
      pages.set(row.id, { text: readingPassage(row.text).slice(0, 4000), sourceLang: row.lang });
    }
  } catch {
    // Mashq validation needs the page text. Dictionary import still runs.
  }

  for (const name of files(dictDir)) {
    const raw = JSON.parse(readFileSync(resolve(dictDir, name), 'utf8')) as { sourceLang?: string };
    const sourceLang = String(raw.sourceLang ?? '');
    const result = validateDictFile(raw);
    dictOk += result.ok.length;
    dictRejected += result.rejected.length;
    if (result.rejected.length) {
      writeFileSync(resolve(rejectedDir, `dictionary-${name}`), JSON.stringify({ file: name, rejected: result.rejected }, null, 2));
    }
    if (!/^[a-z]{2}$/.test(sourceLang)) continue;
    for (const entry of result.ok) {
      sql.push(`INSERT INTO word_dictionary (id, lemma, source_lang, senses, generator_version, created_at, updated_at)
VALUES (gen_random_uuid(), ${dollar(entry.lemma)}, '${sourceLang}'::"AppLanguage", ${dollar(JSON.stringify(entry.senses))}::jsonb, 'cursor-v1', now(), now())
ON CONFLICT (lemma, source_lang) DO UPDATE SET senses = EXCLUDED.senses, generator_version = 'cursor-v1', updated_at = now();`);
    }
  }

  for (const name of files(mashqDir)) {
    const raw = JSON.parse(readFileSync(resolve(mashqDir, name), 'utf8'));
    const result = validateMashqFile(raw, pages);
    mashqRejected += result.rejected.length;
    if (result.rejected.length) {
      writeFileSync(resolve(rejectedDir, `mashq-${name}`), JSON.stringify({ file: name, rejected: result.rejected }, null, 2));
    }
    for (const page of result.ok) writePage(sql, page, pages.get(page.segmentId)?.text ?? '');
    mashqOk += result.ok.reduce((sum, page) => sum + page.questions.length, 0);
  }
  sql.push('COMMIT;');
  const sqlPath = resolve(scratch, 'import.sql');
  writeFileSync(sqlPath, sql.join('\n'));
  const doneBytes = dirBytes(dictDir) + dirBytes(mashqDir);
  const report = { dictOk, dictRejected, mashqQuestions: mashqOk, mashqRejected, doneBytes, applied: false };
  if (apply && (dictOk || mashqOk)) {
    const out = execFileSync('python', ['scripts/content/remote.py', 'psql', sqlPath], { encoding: 'utf8' });
    report.applied = true;
    const errors = (out.match(/ERROR/g) ?? []).length;
    console.log(JSON.stringify({ ...report, sqlErrors: errors }));
    return;
  }
  console.log(JSON.stringify(report));
}

function writePage(sql: string[], page: MashqPage, pageText: string) {
  if (!UUID.test(page.segmentId)) return;
  const hash = createHash('sha256').update(pageText).digest('hex');
  const plain = foldSpace(pageText);
  for (const item of page.questions) {
    const quote = foldSpace(item.evidenceQuote);
    const at = plain.toLowerCase().indexOf(quote.toLowerCase());
    sql.push(`INSERT INTO page_questions (id, segment_id, content_id, segment_hash, prompt_i18n, options_i18n, answer_index, evidence_start, evidence_end, evidence_quote, explanation_i18n, generator_version, status)
SELECT gen_random_uuid(), '${page.segmentId}'::uuid, s.content_id, ${dollar(hash)}, ${dollar(JSON.stringify(item.promptI18n))}::jsonb, ${dollar(JSON.stringify(item.optionsI18n))}::jsonb, ${item.answerIndex}, ${Math.max(0, at)}, ${at < 0 ? 0 : at + quote.length}, ${dollar(item.evidenceQuote)}, ${dollar(JSON.stringify(item.explanationI18n))}::jsonb, 'cursor-v1', 'active'
FROM content_segments s
WHERE s.id = '${page.segmentId}'::uuid
  AND NOT EXISTS (SELECT 1 FROM page_questions pq WHERE pq.segment_id = s.id AND pq.status = 'active' AND pq.evidence_quote = ${dollar(item.evidenceQuote)});`);
  }
}

main();
