import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { migratePublicAvatars } from '../modules/users/avatar-image';

function loadEnv(file: string) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const i = line.indexOf('=');
      const key = line.slice(0, i).trim();
      if (process.env[key]) continue;
      process.env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* the process environment is enough when the file is missing */
  }
}

loadEnv(join(process.cwd(), '.env'));
loadEnv(join(process.cwd(), '..', '..', '.env'));

const dryRun = process.argv.includes('--dry-run');
const publicDir = join(process.env.UPLOADS_DIR || '/var/www/gotcha/uploads', 'avatars');
const privateDir = process.env.PRIVATE_AVATARS_DIR || '/var/lib/gotcha/private-avatars';

async function main() {
  if (!process.env.PRIVATE_AVATARS_DIR) process.env.PRIVATE_AVATARS_DIR = privateDir;
  const db = new PrismaClient();
  try {
    const sharp = require('sharp') as (input: Buffer, options?: unknown) => {
      rotate: () => {
        resize: (w: number, h: number, opts: { fit: 'inside'; withoutEnlargement: boolean }) => {
          webp: (opts: { quality: number }) => { toBuffer: () => Promise<Buffer> };
        };
      };
      metadata: () => Promise<{ format?: string; width?: number; exif?: Buffer }>;
    };
    const result = await migratePublicAvatars({
      db,
      publicDir,
      privateDir,
      dryRun,
      encode: async (input) => {
        const out = await sharp(input, { limitInputPixels: 4096 * 4096 }).rotate()
          .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        const meta = await sharp(out).metadata();
        if (meta.format !== 'webp' || (meta.width ?? 0) > 512 || meta.exif) throw new Error('verify');
        return out;
      },
    });
    console.log(JSON.stringify(result));
    process.exit(result.failed ? 1 : 0);
  } finally {
    await db.$disconnect();
  }
}

void main();
