import * as assert from 'node:assert/strict';
import { catalogOrderBy, sortByCatalogOrder } from './catalog-order';

assert.deepEqual(catalogOrderBy()[0], { cefrLevel: 'asc' }, 'default is beginner-first');
assert.deepEqual(catalogOrderBy('newest')[0], { publishedAt: 'desc' });
const items = [
  { id: 'c1', cefrLevel: 'c1', publishedAt: '2026-10-01' },
  { id: 'b2', cefrLevel: 'b2', publishedAt: '2026-10-30' },
  { id: 'a2', cefrLevel: 'a2', publishedAt: '2026-09-01' },
  { id: 'a1old', cefrLevel: 'a1', publishedAt: '2026-01-01' },
  { id: 'a1new', cefrLevel: 'a1', publishedAt: '2026-10-31' },
];
assert.deepEqual(sortByCatalogOrder(items).map((i) => i.id), ['a1new', 'a1old', 'a2', 'b2', 'c1']);
assert.deepEqual(sortByCatalogOrder(items, 'newest').map((i) => i.id), ['a1new', 'b2', 'c1', 'a2', 'a1old']);
console.log('catalog-order: OK');
