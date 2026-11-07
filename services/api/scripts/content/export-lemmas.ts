/**
 * Distinct catalog lemmas, 300 per file, most frequent first.
 * Usage: npx ts-node --transpile-only scripts/content/export-lemmas.ts <segments.jsonl>
 */
import { createReadStream, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { catalogLemmas } from '../../src/modules/ai/lookup-normalize';
import { DICTIONARY_CHUNK, chunkBy } from '../../src/modules/content/content-gen';

const root = resolve(__dirname, '../../../..');
const outDir = resolve(root, 'content-gen/dictionary/todo');
const laterDir = resolve(root, 'content-gen/dictionary/later');

function emptyJson(dir: string) {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.json')) unlinkSync(resolve(dir, name));
  }
}

type Row = { lang?: string; text?: string };

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('segments jsonl required');
  const byLang = new Map<string, Map<string, number>>();
  const tokens = new Map<string, number>();
  const rl = createInterface({ input: createReadStream(source, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let row: Row;
    try {
      row = JSON.parse(line) as Row;
    } catch {
      continue;
    }
    const lang = String(row.lang ?? '');
    if (!lang) continue;
    const counts = byLang.get(lang) ?? new Map<string, number>();
    byLang.set(lang, counts);
    for (const lemma of catalogLemmas(String(row.text ?? ''))) {
      counts.set(lemma, (counts.get(lemma) ?? 0) + 1);
      tokens.set(lang, (tokens.get(lang) ?? 0) + 1);
    }
  }

  emptyJson(outDir);
  emptyJson(laterDir);
  const summary: Array<Record<string, number | string>> = [];
  let priorityFiles = 0;
  let priorityLemmas = 0;
  for (const lang of [...byLang.keys()].sort()) {
    const counts = byLang.get(lang)!;
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const totalTokens = tokens.get(lang) ?? 0;
    let covered = 0;
    let need95 = ranked.length;
    for (let i = 0; i < ranked.length; i++) {
      covered += ranked[i][1];
      if (totalTokens > 0 && covered / totalTokens >= 0.95) {
        need95 = i + 1;
        break;
      }
    }
    const priority = chunkBy(ranked.slice(0, need95), DICTIONARY_CHUNK);
    const later = chunkBy(ranked.slice(need95), DICTIONARY_CHUNK);
    const writeChunk = (dir: string, chunk: Array<[string, number]>, index: number) => {
      const name = `${lang}-${String(index + 1).padStart(3, '0')}.json`;
      writeFileSync(resolve(dir, name), JSON.stringify({
        sourceLang: lang,
        lemmas: chunk.map(([lemma, count]) => ({ lemma, count })),
      }));
    };
    priority.forEach((chunk, index) => writeChunk(outDir, chunk, index));
    later.forEach((chunk, index) => writeChunk(laterDir, chunk, priority.length + index));
    priorityFiles += priority.length;
    priorityLemmas += need95;
    summary.push({
      lang,
      lemmas: ranked.length,
      tokens: totalTokens,
      files: priority.length + later.length,
      lemmasFor95Pct: need95,
      filesFor95Pct: priority.length,
      laterFiles: later.length,
    });
    console.log(`${lang}\tlemmas=${ranked.length}\tfiles=${priority.length + later.length}\ttokens=${totalTokens}\tlemmas_for_95pct=${need95}\tfiles_for_95pct=${priority.length}\tlater_files=${later.length}`);
  }
  console.log(JSON.stringify({ priorityLemmas, priorityFiles }));
  console.log(JSON.stringify({ directory: 'content-gen/dictionary/todo', languages: summary }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'export failed');
  process.exit(1);
});
