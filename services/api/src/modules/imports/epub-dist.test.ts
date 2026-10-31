/** Runs against the BUILT dist (nest build), where a default jszip import is undefined without esModuleInterop. */
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
const JSZip = require('jszip');

(async () => {
  const dist = path.resolve(__dirname, '../../../dist/modules/imports/extract-text.js');
  assert.ok(fs.existsSync(dist), `build first: ${dist}`);
  const mod = require(dist);
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/c.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OEBPS/c.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>T</dc:title></metadata><manifest><item id="a" href="a.html" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/></spine></package>');
  zip.file('OEBPS/a.html', `<html><head><title>Unknown</title></head><body><p>One</p><p>${'The train tore along. '.repeat(80)}</p></body></html>`);
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const fn = mod.extractTextFromEpub;
  assert.equal(typeof fn, 'function');
  const out = await fn(buf);
  assert.ok(JSON.stringify(out).includes('The train tore along'));
  console.log('epub-dist: OK');
})().catch((e) => { console.error(e); process.exit(1); });
