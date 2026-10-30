// Gotcha Figma — Step 4: Mobile screens (390x844)
// skillNames: figma-use,figma-generate-design

await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

const page = figma.root.children.find((p) => p.name === '03 Mobile App');
await figma.setCurrentPageAsync(page);

const PURPLE = { r: 0.427, g: 0.157, b: 0.851 };
const BG = { r: 0.973, g: 0.980, b: 0.988 };
const READER_BG = { r: 1, g: 0.996, b: 0.976 };
const TEXT = { r: 0.059, g: 0.090, b: 0.165 };
const HIGHLIGHT = { r: 0.996, g: 0.953, b: 0.780 };

function phone(name, x, y, body) {
  const frame = figma.createFrame();
  frame.name = name;
  frame.x = x;
  frame.y = y;
  frame.resize(390, 844);
  frame.clipsContent = true;
  frame.cornerRadius = 24;
  frame.fills = [{ type: 'SOLID', color: BG }];
  frame.strokes = [{ type: 'SOLID', color: { r: 0.886, g: 0.910, b: 0.941 } }];
  frame.strokeWeight = 1;
  body(frame);
  return frame;
}

const ids = [];

// Library
ids.push(phone('Library / Discover', 80, 80, (f) => {
  const header = figma.createText();
  header.fontName = { family: 'Inter', style: 'Bold' };
  header.characters = 'Library';
  header.fontSize = 24;
  header.x = 20;
  header.y = 56;
  f.appendChild(header);

  const section = figma.createText();
  section.fontName = { family: 'Inter', style: 'Bold' };
  section.characters = 'Continue reading';
  section.fontSize = 16;
  section.x = 20;
  section.y = 110;
  f.appendChild(section);

  const card = figma.createFrame();
  card.x = 20;
  card.y = 140;
  card.resize(350, 88);
  card.cornerRadius = 16;
  card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  card.strokes = [{ type: 'SOLID', color: { r: 0.886, g: 0.910, b: 0.941 } }];
  card.strokeWeight = 1;
  const ct = figma.createText();
  ct.fontName = { family: 'Inter', style: 'Bold' };
  ct.characters = 'A Morning in Tashkent';
  ct.fontSize = 15;
  ct.x = 16;
  ct.y = 16;
  card.appendChild(ct);
  const cm = figma.createText();
  cm.fontName = { family: 'Inter', style: 'Medium' };
  cm.characters = 'EN · A2 · 45% complete';
  cm.fontSize = 12;
  cm.opacity = 0.6;
  cm.x = 16;
  cm.y = 40;
  card.appendChild(cm);
  f.appendChild(card);
}).id);

// Reader
ids.push(phone('Reader / Tap word', 500, 80, (f) => {
  f.fills = [{ type: 'SOLID', color: READER_BG }];
  const bar = figma.createFrame();
  bar.resize(390, 56);
  bar.fills = [{ type: 'SOLID', color: READER_BG }];
  const back = figma.createText();
  back.fontName = { family: 'Inter', style: 'Medium' };
  back.characters = '← Part 1';
  back.fontSize = 14;
  back.x = 20;
  back.y = 20;
  bar.appendChild(back);
  f.appendChild(bar);

  const body = figma.createText();
  body.fontName = { family: 'Inter', style: 'Medium' };
  body.characters = 'The sun rose over Tashkent, painting the streets in soft gold. Students walked quickly toward the metro, carrying books and hope.';
  body.fontSize = 18;
  body.lineHeight = { unit: 'PIXELS', value: 30 };
  body.resize(350, 200);
  body.x = 20;
  body.y = 80;
  body.fills = [{ type: 'SOLID', color: { r: 0.11, g: 0.098, b: 0.09 } }];
  f.appendChild(body);

  const hl = figma.createRectangle();
  hl.x = 248;
  hl.y = 168;
  hl.resize(42, 24);
  hl.cornerRadius = 4;
  hl.fills = [{ type: 'SOLID', color: HIGHLIGHT }];
  f.appendChild(hl);

  const sheet = figma.createFrame();
  sheet.resize(390, 180);
  sheet.y = 664;
  sheet.cornerRadius = 20;
  sheet.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  const trans = figma.createText();
  trans.fontName = { family: 'Inter', style: 'Bold' };
  trans.characters = 'hope → umid';
  trans.fontSize = 22;
  trans.x = 20;
  trans.y = 20;
  sheet.appendChild(trans);
  const note = figma.createText();
  note.fontName = { family: 'Inter', style: 'Medium' };
  note.characters = 'noun · feeling of expectation and desire';
  note.fontSize = 14;
  note.opacity = 0.7;
  note.x = 20;
  note.y = 52;
  sheet.appendChild(note);
  const saveBtn = figma.createFrame();
  saveBtn.x = 20;
  saveBtn.y = 100;
  saveBtn.resize(120, 44);
  saveBtn.cornerRadius = 12;
  saveBtn.fills = [{ type: 'SOLID', color: PURPLE }];
  const saveLbl = figma.createText();
  saveLbl.fontName = { family: 'Inter', style: 'Bold' };
  saveLbl.characters = 'Save word';
  saveLbl.fontSize = 14;
  saveLbl.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  saveBtn.appendChild(saveLbl);
  sheet.appendChild(saveBtn);
  f.appendChild(sheet);
}).id);

// Vocab + Practice + Profile (compact placeholders)
const screens = [
  ['Vocabulary', 'Saved words · 24 total · 5 due'],
  ['Practice', 'Comprehension quiz from last read'],
  ['Profile', 'Demo Learner · 7 day streak'],
];

screens.forEach((s, i) => {
  ids.push(phone(s[0], 80 + i * 420, 980, (f) => {
    const h = figma.createText();
    h.fontName = { family: 'Inter', style: 'Bold' };
    h.characters = s[0];
    h.fontSize = 24;
    h.x = 20;
    h.y = 56;
    f.appendChild(h);
    const sub = figma.createText();
    sub.fontName = { family: 'Inter', style: 'Medium' };
    sub.characters = s[1];
    sub.fontSize = 14;
    sub.opacity = 0.7;
    sub.x = 20;
    sub.y = 100;
    f.appendChild(sub);
  }).id);
});

return { createdNodeIds: ids };
