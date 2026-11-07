/**
 * Distinct catalog lemmas, 300 per file, most frequent first.
 * Usage: npx ts-node --transpile-only scripts/content/export-lemmas.ts <segments.jsonl>
 */
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { catalogLemmas } from '../../src/modules/ai/lookup-normalize';
import { DICTIONARY_CHUNK, chunkBy } from '../../src/modules/content/content-gen';

const root = resolve(__dirname, '../../../..');
const outDir = resolve(root, 'content-gen/dictionary/todo');

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

  mkdirSync(outDir, { recursive: true });
  const summary: Array<Record<string, number | string>> = [];
  for (const lang of [...byLang.keys()].sort()) {
    const counts = byLang.get(lang)!;
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const files = chunkBy(ranked, DICTIONARY_CHUNK);
    files.forEach((chunk, index) => {
      const name = `${lang}-${String(index + 1).padStart(3, '0')}.json`;
      writeFileSync(resolve(outDir, name), JSON.stringify({
        sourceLang: lang,
        lemmas: chunk.map(([lemma, count]) => ({ lemma, count })),
      }));
    });
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
    summary.push({
      lang,
      lemmas: ranked.length,
      tokens: totalTokens,
      files: files.length,
      lemmasFor95Pct: need95,
    });
    console.log(`${lang}\tlemmas=${ranked.length}\tfiles=${files.length}\ttokens=${totalTokens}\tlemmas_for_95pct=${need95}`);
  }
  console.log(JSON.stringify({ directory: 'content-gen/dictionary/todo', languages: summary }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'export failed');
  process.exit(1);
});
