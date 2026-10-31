import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { ContentController } from './content.controller';
import { UuidOr404Pipe, isUuid } from '../../common/pipes/uuid-or-404.pipe';

// Route order: Nest registers handlers in declaration order, so static GETs must precede ':id'.
const proto = ContentController.prototype as unknown as Record<string, unknown>;
const paths = Object.getOwnPropertyNames(proto)
  .filter((k) => k !== 'constructor')
  .map((k) => Reflect.getMetadata(PATH_METADATA, proto[k] as object) as string)
  .filter(Boolean);
const idIdx = paths.indexOf(':id');
for (const p of ['home', 'search', 'feed', 'languages']) {
  assert.ok(paths.includes(p), `missing route ${p}`);
  assert.ok(paths.indexOf(p) < idIdx, `${p} must be declared before :id (got ${paths.join(',')})`);
}
const pipe = new UuidOr404Pipe();
for (const bad of ['home', 'search', '123', '', 'x'.repeat(36)]) assert.throws(() => pipe.transform(bad), NotFoundException);
assert.equal(pipe.transform('3f1c2b9e-8a4d-4c1e-9b2a-1d2e3f4a5b6c'), '3f1c2b9e-8a4d-4c1e-9b2a-1d2e3f4a5b6c');
assert.ok(!isUuid('home'));

// Handlers delegate to the right service calls.
const calls: string[] = [];
const svc = { getFeed: async () => calls.push('feed'), list: async () => calls.push('list'), getById: async () => calls.push('byId') };
const c = new ContentController(svc as never);
void c.home({ sub: 'u' } as never);
void c.search({ sub: 'u' } as never, {} as never);
assert.deepEqual(calls, ['feed', 'list']);
console.log('content routes: OK');
