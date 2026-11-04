import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { signAvatar } from './avatar-sign';
type SharpChain = {
  rotate: () => SharpChain;
  resize: (w: number, h: number, opts: { fit: 'inside'; withoutEnlargement: boolean }) => SharpChain;
  webp: (opts: { quality: number }) => { toBuffer: () => Promise<Buffer> };
  metadata: () => Promise<{ format?: string; width?: number; height?: number; exif?: unknown }>;
  jpeg: () => { toBuffer: () => Promise<Buffer> };
};

export function loadSharp(): ((input?: unknown, options?: unknown) => SharpChain) | null {
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
  const configured = process.env.PRIVATE_AVATARS_DIR;
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PRIVATE_AVATARS_DIR is required in production');
    }
    return join(process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads'), '..', 'private-avatars');
  }
  return configured;
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

/** Sign a private avatar, or drop a legacy public path (logged, never rewritten here). */
export function safeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = url.split('?')[0] ?? '';
  if (path.includes('/uploads/avatars/')) {
    console.warn(`avatar-legacy left unmigrated ${path.split('/').pop()}`);
    return null;
  }
  const name = avatarFileName(url);
  if (!name || !path.endsWith(`/users/avatars/${name}`)) return null;
  return signAvatar(name);
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

/** Re-encode to WebP, max 512px, no EXIF. Throws when sharp cannot load — callers must not store the original. */
export async function encodeAvatar(input: Buffer): Promise<{ bytes: Buffer; ext: 'webp' }> {
  const sharp = loadSharp();
  if (!sharp) {
    const err = new Error('AVATAR_PROCESSING_UNAVAILABLE');
    throw err;
  }
  const inputMeta = await sharp(input, { failOn: 'none', limitInputPixels: 4096 * 4096 }).metadata();
  if ((inputMeta.width ?? 0) < 64 || (inputMeta.height ?? 0) < 64) {
    throw new Error('Image must be at least 64 pixels on each side.');
  }
  const bytes = await sharp(input, { failOn: 'none', limitInputPixels: 4096 * 4096 })
    .rotate()
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const meta = await sharp(bytes).metadata();
  if (meta.format !== 'webp' || (meta.width ?? 0) > 512 || meta.exif) {
    throw new Error('Could not process that image.');
  }
  return { bytes, ext: 'webp' };
}

const LEGACY_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpe?g|png)$/i;

export type AvatarMigrateDb = {
  user: {
    findFirst(args: unknown): Promise<{ id: string; avatarUrl: string | null } | null>;
    update(args: unknown): Promise<unknown>;
  };
};

/**
 * Move public `uploads/avatars/<userId>.<ext>` files into the private dir.
 * A missing or unreadable file is a failure: the database URL is left as it is.
 * The marker is written only when nothing failed.
 */
export async function migratePublicAvatars(opts: {
  db: AvatarMigrateDb;
  publicDir: string;
  privateDir: string;
  dryRun?: boolean;
  encode?: (input: Buffer) => Promise<Buffer>;
}): Promise<{ ok: number; skipped: number; failed: number }> {
  const { db, publicDir, privateDir, dryRun } = opts;
  const encode = opts.encode ?? (async (input: Buffer) => (await encodeAvatar(input)).bytes);
  let names: string[] = [];
  try {
    names = (await readdir(publicDir, { withFileTypes: true })).filter((d) => d.isFile()).map((d) => d.name);
  } catch (err) {
    console.error(`avatar-migrate fail readdir ${(err as Error).message}`);
    return { ok: 0, skipped: 0, failed: 1 };
  }
  await mkdir(privateDir, { recursive: true });
  await mkdir(join(publicDir, '.migrated'), { recursive: true });
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const name of names) {
    if (!LEGACY_FILE.test(name)) {
      skipped++;
      console.log(`avatar-migrate skip ${name} not-a-user-file`);
      continue;
    }
    const id = name.replace(/\.(jpe?g|png|webp)$/i, '');
    const user = await db.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, avatarUrl: true } }).catch(() => null);
    if (!user) {
      skipped++;
      console.log(`avatar-migrate skip ${name} no-live-user`);
      continue;
    }
    if (user.avatarUrl && user.avatarUrl.includes('/users/avatars/')) {
      skipped++;
      console.log(`avatar-migrate skip ${name} user-has-new-avatar`);
      continue;
    }
    try {
      const raw = await readFile(join(publicDir, name));
      const out = await encode(raw);
      const fn = `${randomUUID()}.webp`;
      if (!dryRun) {
        await writeFile(join(privateDir, `${fn}.tmp`), out);
        await rename(join(privateDir, `${fn}.tmp`), join(privateDir, fn));
        await db.user.update({ where: { id }, data: { avatarUrl: `${avatarPublicPath(fn)}?v=${Date.now()}` } });
        await rename(join(publicDir, name), join(publicDir, '.migrated', name));
      }
      ok++;
      console.log(`avatar-migrate ok user=${id} src=${name} -> ${fn}${dryRun ? ' dry' : ''}`);
    } catch (err) {
      failed++;
      console.error(`avatar-migrate fail user=${id} src=${name} ${(err as Error).message}`);
    }
  }
  if (!dryRun && failed === 0) {
    await writeFile(
      join(privateDir, '.reprocessed-v2'),
      JSON.stringify({ at: new Date().toISOString(), ok, skipped, failed }),
    );
  }
  return { ok, skipped, failed };
}
