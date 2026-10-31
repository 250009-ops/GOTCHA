import * as assert from 'node:assert/strict';
import { mkdtemp, writeFile, utimes, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { purgeOldTts, ttsRetentionDays } from './tts-retention';

(async () => {
  assert.equal(ttsRetentionDays({}), 30);
  assert.equal(ttsRetentionDays({ TTS_RETENTION_DAYS: '7' }), 7);
  assert.equal(ttsRetentionDays({ TTS_RETENTION_DAYS: '0' }), 0);
  assert.equal(ttsRetentionDays({ TTS_RETENTION_DAYS: 'abc' }), 30);
  const dir = await mkdtemp(join(tmpdir(), 'tts-'));
  const now = Date.now();
  const mk = async (name: string, ageDays: number) => {
    const f = join(dir, name);
    await writeFile(f, 'x');
    const t = new Date(now - ageDays * 86_400_000) ;
    await utimes(f, t, t);
  };
  await mk('old.mp3', 31); await mk('edge.mp3', 29.9); await mk('new.mp3', 1); await mk('keep.txt', 90);
  assert.deepEqual(await purgeOldTts(dir, 30, now), { scanned: 3, deleted: 1 });
  assert.deepEqual((await readdir(dir)).sort(), ['edge.mp3', 'keep.txt', 'new.mp3']);
  assert.deepEqual(await purgeOldTts(dir, 0, now), { scanned: 0, deleted: 0 }); // disabled
  assert.deepEqual(await purgeOldTts(join(dir, 'missing'), 30, now), { scanned: 0, deleted: 0 });
  await rm(dir, { recursive: true });
  console.log('tts-retention: OK');
})().catch((e) => { console.error(e); process.exit(1); });
