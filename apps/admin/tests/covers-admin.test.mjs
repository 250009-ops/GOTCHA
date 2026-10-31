// covers-01: admin book page shows the template cover and per-book Use template / Use upload / Revert to original.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ed = readFileSync(new URL('../src/pages/ContentEditorPage.tsx', import.meta.url), 'utf8');
const pv = readFileSync(new URL('../src/components/LibraryPreviewModal.tsx', import.meta.url), 'utf8');
const bc = readFileSync(new URL('../src/components/cover/BookCover.tsx', import.meta.url), 'utf8');
assert.match(ed, /<BookCover[\s\S]*variant="card"/);
assert.match(ed, />\s*Use template\s*</);
assert.match(ed, />\s*Revert to original\s*</);
assert.match(ed, />\s*Use upload\s*</);
assert.match(ed, /`\/admin\/content\/\$\{id\}\/cover-mode`/);
assert.match(ed, /method: 'PATCH', body: JSON.stringify\(\{ coverMode: mode \}\)/);
assert.match(ed, /originalCoverUrl \?/); // revert only offered when an original exists
assert.match(ed, /apiUpload\(`\/admin\/content\/\$\{id\}\/cover`, coverFile\)/); // upload override kept
assert.match(pv, /<BookCover/);
assert.doesNotMatch(pv, /from-black\/40 to-transparent/);
assert.match(bc, /covers-01/);
console.log('covers-admin: OK');
