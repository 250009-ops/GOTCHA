import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

/** Non-UUID ids are a 404, never a 500 from Postgres (DevOps 31 Oct: /content/home, /content/search). */
@Injectable()
export class UuidOr404Pipe implements PipeTransform<string, string> {
  // WL4-01: no constructor params — Nest instantiates pipes used by class reference via DI.
  private readonly what = 'Content';
  transform(value: string): string {
    if (!isUuid(value)) throw new NotFoundException(`${this.what} not found`);
    return value;
  }
}
