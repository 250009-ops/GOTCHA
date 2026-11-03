import * as assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jobHealth, recordJobFailure, resetJobHealth, runTrackedJob, setJobAlertMailer } from './job-health';
import { purgeOldTts } from '../../modules/ai/tts-retention';

(async () => {
  resetJobHealth();
  // stub path: no mailer → returns false, flag flips
  setJobAlertMailer(undefined);
  assert.equal(await recordJobFailure('x', new Error('boom')), false);
  assert.equal(jobHealth().ok, false);
  assert.equal(jobHealth().jobs[0].lastError, 'boom');
  // mail path
  const sent: string[] = [];
  setJobAlertMailer({ isConfigured: () => true, send: async (o) => { sent.push(o.to); return true; } });
  await runTrackedJob('y', async () => { throw new Error('disk'); });
  assert.ok(sent.includes('support@gotchaa.uz'));
  // recovery
  await runTrackedJob('x', async () => 1);
  await runTrackedJob('y', async () => 1);
  assert.equal(jobHealth().ok, true);
  // TTS: unreadable dir surfaces instead of silently returning 0
  if (process.platform !== 'win32' && process.getuid?.() !== 0) {
    const d = await mkdtemp(join(tmpdir(), 'tts-'));
    const f = join(d, 'a.mp3'); await writeFile(f, 'x'); const old = new Date(Date.now() - 40 * 86400000); await utimes(f, old, old);
    await chmod(d, 0o500); // can't unlink
    await assert.rejects(() => purgeOldTts(d, 30), /could not be deleted/);
    await chmod(d, 0o700);
  }
  assert.deepEqual(await purgeOldTts('/nonexistent-dir-xyz', 30), { scanned: 0, deleted: 0, failed: 0 });
  console.log('job-health: OK');
})().catch((e) => { console.error(e); process.exit(1); });
