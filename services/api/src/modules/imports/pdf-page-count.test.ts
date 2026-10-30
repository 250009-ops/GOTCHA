import * as assert from 'node:assert/strict';
import { countPdfPagesFromLatin1 } from './pdf-page-count';

const twoPagePdf = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj
4 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj
trailer<< /Root 1 0 R >>
%%EOF
`;

assert.equal(countPdfPagesFromLatin1(twoPagePdf), 2);

const thirtyEight = twoPagePdf.replace('/Count 2', '/Count 38');
assert.equal(countPdfPagesFromLatin1(thirtyEight), 38);

assert.equal(countPdfPagesFromLatin1('not a pdf'), null);

console.log('pdf-page-count tests passed');
