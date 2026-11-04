import * as assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migratePublicAvatars } from './avatar-image';

const id = '22222222-2222-4222-8222-222222222222';

function db(url: string | null) {
  const row = { id, avatarUrl: url };
  return {
    row,
    user: {
      findFirst: async () => row,
      update: async (args: { data: { avatarUrl: string } }) => {
        row.avatarUrl = args.data.avatarUrl;
        return row;
      },
    },
  };
}

void (async () => {
  const root = await mkdtemp(join(tmpdir(), 'avatar-migrate-'));
  const publicDir = join(root, 'avatars');
  const privateDir = join(root, 'private');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(publicDir, { recursive: true });
  const name = `${id}.jpg`;
  await writeFile(join(publicDir, name), Buffer.from('not-an-image'));
  const broken = db(null);
  const failed = await migratePublicAvatars({
    db: broken,
    publicDir,
    privateDir,
    encode: async () => {
      throw new Error('corrupt');
    },
  });
  assert.equal(failed.failed, 1);
  assert.equal(broken.row.avatarUrl, null);
  await assert.rejects(readFile(join(privateDir, '.reprocessed-v2')));
  assert.equal(await readFile(join(publicDir, name), 'utf8'), 'not-an-image');

  const missing = await migratePublicAvatars({
    db: db('/uploads/avatars/missing.jpg'),
    publicDir: join(root, 'does-not-exist'),
    privateDir: join(root, 'private-missing'),
    encode: async () => Buffer.from('webp'),
  });
  assert.equal(missing.failed, 1);

  const good = db(null);
  const ok = await migratePublicAvatars({
    db: good,
    publicDir,
    privateDir,
    encode: async () => Buffer.from('webp-bytes'),
  });
  assert.equal(ok.ok, 1);
  assert.equal(ok.failed, 0);
  assert.match(good.row.avatarUrl ?? '', /\/users\/avatars\/.+\.webp/);
  const marker = JSON.parse(await readFile(join(privateDir, '.reprocessed-v2'), 'utf8')) as { failed: number };
  assert.equal(marker.failed, 0);
  await readFile(join(publicDir, '.migrated', name));

  await rm(root, { recursive: true, force: true });
  console.log('avatar-migrate: OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
