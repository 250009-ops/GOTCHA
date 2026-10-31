import * as assert from 'node:assert/strict';
import { ocrConcurrency, resetNativeTesseractCache, tesseractLangFor } from './ocr-pdf';

assert.equal(tesseractLangFor('en').lang, 'eng');
assert.equal(tesseractLangFor(null).lang, 'eng');
assert.equal(tesseractLangFor('ru').lang, 'rus+eng');
assert.equal(tesseractLangFor('uz').lang, 'eng');
assert.equal(tesseractLangFor('fr').lang, 'fra+eng');
assert.equal(tesseractLangFor('de').lang, 'deu+eng');

const prev = process.env.OCR_CONCURRENCY;
try {
  process.env.OCR_CONCURRENCY = '3';
  assert.equal(ocrConcurrency(true), 3);
  process.env.OCR_CONCURRENCY = '99';
  assert.equal(ocrConcurrency(true), 8);
  process.env.OCR_CONCURRENCY = '0';
  const autoNative = ocrConcurrency(true);
  const autoWasm = ocrConcurrency(false);
  assert.ok(autoNative >= 1 && autoNative <= 4);
  assert.ok(autoWasm >= 1 && autoWasm <= 2);
  assert.ok(autoWasm <= autoNative || autoNative === 1);
} finally {
  if (prev === undefined) delete process.env.OCR_CONCURRENCY;
  else process.env.OCR_CONCURRENCY = prev;
  resetNativeTesseractCache();
}

console.log('ocr-pdf tests passed');
