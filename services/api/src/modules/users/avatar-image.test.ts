import * as assert from 'node:assert/strict';
import sharpImpl = require('sharp');
const sharp = (((sharpImpl as unknown as { default?: unknown }).default ?? sharpImpl) as unknown) as (input?: unknown, options?: unknown) => {
  jpeg: () => { toBuffer: () => Promise<Buffer> };
  metadata: () => Promise<{ format?: string; width?: number; height?: number; exif?: unknown }>;
};
import { encodeAvatar, safeAvatarUrl } from './avatar-image';

const id = '11111111-1111-4111-8111-111111111111';

assert.equal(safeAvatarUrl('https://images.unsplash.com/photo-1'), null);
assert.equal(safeAvatarUrl(`/uploads/avatars/${id}.jpg`), null);
assert.equal(safeAvatarUrl(`/api/v1/users/avatars/${id}.webp?v=1`), `/api/v1/users/avatars/${id}.webp?v=1`);

void (async () => {
  const input = await sharp({
    create: { width: 800, height: 400, channels: 3, background: { r: 20, g: 40, b: 200 } },
  }).jpeg().toBuffer();
  const out = await encodeAvatar(input);
  const meta = await sharp(out).metadata();
  assert.equal(meta.format, 'webp');
  assert.ok((meta.width ?? 0) <= 512);
  assert.ok((meta.height ?? 0) <= 512);
  assert.equal(meta.exif, undefined);
  console.log('avatar-image: OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
