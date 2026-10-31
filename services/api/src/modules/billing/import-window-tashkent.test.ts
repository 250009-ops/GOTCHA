/** Round-3: free-import day/month windows start at Asia/Tashkent midnight (UTC+5), not UTC midnight. */
import * as assert from 'node:assert/strict';
import { ImportCommerceService } from './import-commerce.service';
const s: any = Object.create(ImportCommerceService.prototype);
// 31 Oct 2026 23:30 Tashkent = 18:30Z → day starts 30 Oct 19:00Z (= 31 Oct 00:00 Tashkent)
assert.equal(s.startOfTashkentDay(new Date('2026-10-31T18:30:00Z')).toISOString(), '2026-10-30T19:00:00.000Z');
// 1 Nov 00:30 Tashkent = 31 Oct 19:30Z → new day AND new month already in Tashkent
assert.equal(s.startOfTashkentDay(new Date('2026-10-31T19:30:00Z')).toISOString(), '2026-10-31T19:00:00.000Z');
assert.equal(s.startOfTashkentMonth(new Date('2026-10-31T19:30:00Z')).toISOString(), '2026-10-31T19:00:00.000Z');
assert.equal(s.startOfTashkentMonth(new Date('2026-10-31T18:30:00Z')).toISOString(), '2026-09-30T19:00:00.000Z');
assert.equal(s.startOfTashkentYear(new Date('2026-12-31T19:30:00Z')).toISOString(), '2026-12-31T19:00:00.000Z');
console.log('import-window-tashkent: OK');
