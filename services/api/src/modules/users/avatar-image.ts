import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
type SharpChain = {
  rotate: () => SharpChain;
  resize: (w: number, h: number, opts: { fit: 'inside'; withoutEnlargement: boolean }) => SharpChain;
  webp: (opts: { quality: number }) => { toBuffer: () => Promise<Buffer> };
  metadata: () => Promise<{ format?: string; width?: number; height?: number; exif?: unknown }>;
  jpeg: () => { toBuffer: () => Promise<Buffer> };
};

function loadSharp(): ((input?: unknown, options?: unknown) => SharpChain) | null {
  try {
    const impl = require('sharp') as { default?: unknown };
    const fn = (impl?.default ?? impl) as (input?: unknown, options?: unknown) => SharpChain;
    return typeof fn === 'function' ? fn : null;
  } catch {
    return null;
  }
}

const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpe?g|png)$/i;

/** Avatars live outside the nginx `/uploads/` alias so a logged-out GET cannot read them. */
export function privateAvatarsDir() {
  return (
    process.env.PRIVATE_AVATARS_DIR ??
    join(process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads'), '..', 'private-avatars')
  );
}

export function avatarPublicPath(fileName: string) {
  return `/api/v1/users/avatars/${fileName}`;
}

export function avatarFileName(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = url.split('?')[0] ?? '';
  const name = path.split('/').pop() ?? '';
  return FILE_NAME.test(name) ? name : null;
}

/** Drop hotlinked and legacy public paths. Only the authenticated avatar route is returned. */
export function safeAvatarUrl(url: string | null | undefined): string | null {
  const name = avatarFileName(url);
  if (!name) return null;
  const path = (url ?? '').split('?')[0];
  if (!path.endsWith(`/users/avatars/${name}`)) return null;
  return url ?? null;
}

/** Drop JPEG APP1 (EXIF/GPS) and APP13 when this host cannot run sharp. */
export function stripJpegMetadata(input: Buffer): Buffer {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return input;
  const parts: Buffer[] = [input.subarray(0, 2)];
  let i = 2;
  while (i + 4 < input.length && input[i] === 0xff) {
    const marker = input[i + 1];
    if (marker === 0xda || marker === 0xd9) {
      parts.push(input.subarray(i));
      break;
    }
    const len = input.readUInt16BE(i + 2);
    const start = i;
    i += 2 + len;
    if (marker === 0xe1 || marker === 0xed) continue;
    parts.push(input.subarray(start, i));
  }
  return Buffer.concat(parts);
}

/** Re-encode to WebP, max 512px, no EXIF/GPS when sharp loads. Otherwise strip JPEG metadata only. */
export async function encodeAvatar(input: Buffer): Promise<{ bytes: Buffer; ext: 'webp' | 'jpg' | 'png' }> {
  const sharp = loadSharp();
  if (sharp) {
    const bytes = await sharp(input, { failOn: 'none', unlimited: false })
      .rotate()
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { bytes, ext: 'webp' };
  }
  if (input[0] === 0x89 && input[1] === 0x50) return { bytes: input, ext: 'png' };
  if (input[0] === 0xff && input[1] === 0xd8) return { bytes: stripJpegMetadata(input), ext: 'jpg' };
  return { bytes: input, ext: 'webp' };
}

type AvatarDb = {
  user: {
    updateMany(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<Array<{ id: string; avatarUrl: string | null }>>;
    update(args: unknown): Promise<unknown>;
  };
};

/** One-shot: drop stock-photo URLs and re-encode files that still sit in the public uploads folder. */
export async function reprocessAvatarsOnce(db: AvatarDb) {
  const dir = privateAvatarsDir();
  await mkdir(dir, { recursive: true });
  const marker = join(dir, '.reprocessed-v1');
  if (existsSync(marker)) return;
  await db.user.updateMany({
    where: {
      OR: [
        { avatarUrl: { startsWith: 'https://images.unsplash.com/' } },
        { avatarUrl: { startsWith: 'http://' } },
        { avatarUrl: { startsWith: 'https://' } },
      ],
    },
    data: { avatarUrl: null },
  });
  const publicDir = join(process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads'), 'avatars');
  let names: string[] = [];
  try {
    names = await readdir(publicDir);
  } catch {
    names = [];
  }
  const users = await db.user.findMany({
    where: { avatarUrl: { contains: '/uploads/avatars/' } },
    select: { id: true, avatarUrl: true },
  });
  for (const user of users) {
    const oldName = (user.avatarUrl ?? '').split('?')[0]?.split('/').pop();
    if (!oldName || !names.includes(oldName)) {
      await db.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
      continue;
    }
    try {
      const raw = await readFile(join(publicDir, oldName));
      const encoded = await encodeAvatar(raw);
      const fileName = `${randomUUID()}.${encoded.ext}`;
      await writeFile(join(dir, fileName), encoded.bytes);
      await db.user.update({
        where: { id: user.id },
        data: { avatarUrl: `${avatarPublicPath(fileName)}?v=${Date.now()}` },
      });
      await rm(join(publicDir, oldName), { force: true });
    } catch {
      await db.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
    }
  }
  await writeFile(marker, new Date().toISOString());
}
