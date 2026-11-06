import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators';

/** S4 (final-6.1): build id written by build-dists into dist/build-info.json ({ sha, date }); never secrets. */
export function readBuildInfo(dir = __dirname): { sha: string; date: string } {
  try {
    const j = JSON.parse(readFileSync(join(dir, 'build-info.json'), 'utf8')) as { sha?: unknown; date?: unknown };
    return { sha: typeof j.sha === 'string' ? j.sha : 'dev', date: typeof j.date === 'string' ? j.date : 'unknown' };
  } catch {
    return { sha: 'dev', date: 'unknown' };
  }
}

function readMashqProgress(dir = process.cwd()): { done: number; total: number; failed: number; costUsd: number; stopped: string | null } | null {
  try {
    const row = JSON.parse(readFileSync(join(dir, 'mashq-progress.json'), 'utf8')) as {
      done?: unknown; total?: unknown; failed?: unknown; costUsd?: unknown; stopped?: unknown;
    };
    return {
      done: Number(row.done ?? 0),
      total: Number(row.total ?? 0),
      failed: Number(row.failed ?? 0),
      costUsd: Number(row.costUsd ?? 0),
      stopped: typeof row.stopped === 'string' ? row.stopped : null,
    };
  } catch {
    return null;
  }
}

/** WL4-01: liveness for the boot smoke test and uptime checks. No DB call, no secrets. */
@Controller('health')
export class HealthController {
  private readonly build = readBuildInfo();

  @Public()
  @Get()
  health() {
    return { ok: true, build: this.build, mashq: readMashqProgress() };
  }

  @Public()
  @Get('version')
  version() {
    return this.build;
  }
}
