// Live pricing bugs 2026-10-31: "0 soʻm" tier and missing 41–100 tier. Fixture = live landing.json tiers.
import * as assert from 'node:assert/strict';
import {
  assertNoPageTierOverlap, assertPageTierPrice, labelRangeMismatch, pageTierRangeLabel,
  parseLabelRange, publicPageTiers, validatePageTierSet,
} from './page-tiers';
import { toPaymentSummary } from './import-commerce.service';

const LIVE = [
  { id: 't1', label: '1 - 40 pages', minPages: 1, maxPages: 100, priceUzs: 500 },
  { id: 't2', label: '101 - 200 pages', minPages: 101, maxPages: 200, priceUzs: 32000 },
  { id: 't3', label: '201 - 400 pages', minPages: 201, maxPages: 400, priceUzs: 48000 },
  { id: 't4', label: '401 - 600 pages', minPages: 401, maxPages: 600, priceUzs: 56000 },
  { id: 't5', label: '601 - 900 pages', minPages: 601, maxPages: 900, priceUzs: 64000 },
  { id: 't6', label: '901 - 1500 pages', minPages: 901, maxPages: 1500, priceUzs: 0 },
];
const MIN = 500;

assert.deepEqual(parseLabelRange('1 - 40 pages'), { min: 1, max: 40 });
assert.deepEqual(parseLabelRange('100+ pages'), { min: 100, max: null });
assert.equal(parseLabelRange('Short docs'), null);
assert.equal(labelRangeMismatch('1 - 40 pages', 1, 100), true, 'live label drift');
assert.equal(labelRangeMismatch('1 - 40 pages', 1, 40), false);
assert.equal(labelRangeMismatch('100+ pages', 101, null), false, 'seed convention');
assert.equal(labelRangeMismatch('Short docs', 1, 10), false);
assert.equal(pageTierRangeLabel(41, 100), '41 - 100 pages');

// Live set: both bugs detected
const issues = validatePageTierSet(LIVE, MIN);
assert.ok(issues.some((i) => i.code === 'zero_price' && i.tierId === 't6'), 'flags 0 soʻm tier');
assert.ok(issues.some((i) => i.code === 'label_mismatch' && i.tierId === 't1'), 'flags 1-40 label on 1-100');
assert.equal(issues.some((i) => i.code === 'gap'), false, 'range has no gap; the "missing" 41–100 is label drift');

// Public payload: 0-priced tier hidden, label rebuilt — never "0 soʻm", never a fake 41–100 hole
const pub = publicPageTiers(LIVE, MIN);
assert.equal(pub.some((t) => t.priceUzs <= 0), false);
assert.equal(pub.length, 5);
assert.equal(pub[0].label, '1 - 100 pages');
assert.equal(publicPageTiers([{ ...LIVE[1], active: false }], MIN).length, 0);
assert.equal(publicPageTiers([{ ...LIVE[1], priceUzs: 499 }], MIN).length, 0);

// Proposed data fix shape is clean
const FIXED = [
  { id: 't1', label: '1 - 40 pages', minPages: 1, maxPages: 40, priceUzs: 500 },
  { id: 'n', label: '41 - 100 pages', minPages: 41, maxPages: 100, priceUzs: 16000 },
  ...LIVE.slice(1, 5),
  { ...LIVE[5], priceUzs: 72000 },
];
assert.deepEqual(validatePageTierSet(FIXED, MIN), []);

// gaps / overlaps / unbounded
assert.deepEqual(
  validatePageTierSet([{ id: 'a', label: '1 - 40 pages', minPages: 1, maxPages: 40, priceUzs: 900 }, { id: 'b', label: '101 - 200 pages', minPages: 101, maxPages: 200, priceUzs: 900 }], MIN)
    .filter((i) => i.code === 'gap'),
  [{ code: 'gap', afterTierId: 'a', fromPage: 41, toPage: 100 }],
);
assert.ok(validatePageTierSet([{ id: 'a', label: 'x', minPages: 1, maxPages: 50, priceUzs: 900 }, { id: 'b', label: 'y', minPages: 40, maxPages: 60, priceUzs: 900 }], MIN).some((i) => i.code === 'overlap'));
assert.ok(validatePageTierSet([{ id: 'a', label: 'x', minPages: 1, maxPages: null, priceUzs: 900 }, { id: 'b', label: 'y', minPages: 40, maxPages: 60, priceUzs: 900 }], MIN).some((i) => i.code === 'unbounded_not_last'));

// admin guards
assert.throws(() => assertPageTierPrice(0, 'x', MIN), /at least 500/);
assert.throws(() => assertPageTierPrice(499, 'x', MIN), /Atmos minimum/);
assert.doesNotThrow(() => assertPageTierPrice(500, 'x', MIN));
assert.throws(() => assertNoPageTierOverlap(LIVE, { id: null, minPages: 41, maxPages: 100 }), /overlap/);
assert.doesNotThrow(() => assertNoPageTierOverlap(LIVE, { id: 't1', minPages: 1, maxPages: 40 }));
assert.doesNotThrow(() => assertNoPageTierOverlap(FIXED, { id: 'n', minPages: 41, maxPages: 100 }));

// payment history projection: no raw provider JSON / ids; receipt only https
const s = toPaymentSummary({
  id: 'p', account: 'cat_abc', status: 'paid', amountTiyins: 50_000, currency: 'UZS', estimatedPages: 1,
  contentFormat: 'catalog', createdAt: new Date('2026-10-31T08:00:00Z'), paidAt: null, ofdUrl: 'javascript:alert(1)',
  // extra fields must not leak
  ...({ rawCreateJson: { secret: 1 }, providerPaymentId: '123' } as object),
} as Parameters<typeof toPaymentSummary>[0]);
assert.equal(s.kind, 'catalog');
assert.equal(s.amountUzs, 500);
assert.equal(s.receiptUrl, null);
assert.equal('rawCreateJson' in s || 'providerPaymentId' in s, false);

console.log('page-tiers.test: ok');
