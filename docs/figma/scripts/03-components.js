// Gotcha Figma — Step 3: Core components
// skillNames: figma-use,figma-generate-design

await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

const page = figma.root.children.find((p) => p.name === '02 Components');
await figma.setCurrentPageAsync(page);

const PURPLE = { r: 0.427, g: 0.157, b: 0.851 };
const TEAL = { r: 0.051, g: 0.580, b: 0.533 };
const WHITE = { r: 1, g: 1, b: 1 };
const BORDER = { r: 0.886, g: 0.910, b: 0.941 };

function btn(label, fill, textColor, x, y) {
  const f = figma.createFrame();
  f.name = `Button/${label}`;
  f.x = x;
  f.y = y;
  f.layoutMode = 'HORIZONTAL';
  f.primaryAxisAlignItems = 'CENTER';
  f.counterAxisAlignItems = 'CENTER';
  f.paddingLeft = 20;
  f.paddingRight = 20;
  f.paddingTop = 12;
  f.paddingBottom = 12;
  f.cornerRadius = 12;
  f.fills = [{ type: 'SOLID', color: fill }];
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Bold' };
  t.characters = label;
  t.fontSize = 14;
  t.fills = [{ type: 'SOLID', color: textColor }];
  f.appendChild(t);
  return f;
}

const primaryBtn = btn('Primary', PURPLE, WHITE, 80, 80);
const accentBtn = btn('Accent', TEAL, WHITE, 80, 150);
const outlineBtn = btn('Outline', WHITE, PURPLE, 80, 220);
outlineBtn.strokes = [{ type: 'SOLID', color: PURPLE }];
outlineBtn.strokeWeight = 2;

// Content card
const card = figma.createFrame();
card.name = 'ContentCard';
card.x = 320;
card.y = 80;
card.resize(320, 100);
card.layoutMode = 'HORIZONTAL';
card.itemSpacing = 16;
card.paddingLeft = 16;
card.paddingRight = 16;
card.paddingTop = 16;
card.paddingBottom = 16;
card.cornerRadius = 16;
card.fills = [{ type: 'SOLID', color: WHITE }];
card.strokes = [{ type: 'SOLID', color: BORDER }];
card.strokeWeight = 1;

const avatar = figma.createEllipse();
avatar.resize(48, 48);
avatar.fills = [{ type: 'SOLID', color: { r: 0.933, g: 0.914, b: 0.996 } }];
card.appendChild(avatar);

const cardText = figma.createFrame();
cardText.layoutMode = 'VERTICAL';
cardText.itemSpacing = 4;
cardText.fills = [];
const cardTitle = figma.createText();
cardTitle.fontName = { family: 'Inter', style: 'Bold' };
cardTitle.characters = 'A Morning in Tashkent';
cardTitle.fontSize = 16;
const cardMeta = figma.createText();
cardMeta.fontName = { family: 'Inter', style: 'Medium' };
cardMeta.characters = 'A2 · 120 words · culture';
cardMeta.fontSize = 12;
cardMeta.opacity = 0.6;
cardText.appendChild(cardTitle);
cardText.appendChild(cardMeta);
card.appendChild(cardText);

// Bottom nav
const nav = figma.createFrame();
nav.name = 'BottomNav';
nav.x = 80;
nav.y = 320;
nav.resize(390, 64);
nav.layoutMode = 'HORIZONTAL';
nav.primaryAxisAlignItems = 'CENTER';
nav.counterAxisAlignItems = 'CENTER';
nav.primaryAxisSizingMode = 'FIXED';
nav.counterAxisSizingMode = 'FIXED';
nav.itemSpacing = 0;
nav.fills = [{ type: 'SOLID', color: WHITE }];
nav.strokes = [{ type: 'SOLID', color: BORDER }];
nav.strokeWeight = 1;

const tabs = ['Library', 'Vocab', 'Practice', 'Import', 'Profile'];
for (const tab of tabs) {
  const item = figma.createFrame();
  item.layoutMode = 'VERTICAL';
  item.primaryAxisAlignItems = 'CENTER';
  item.counterAxisAlignItems = 'CENTER';
  item.layoutGrow = 1;
  item.layoutSizingHorizontal = 'FILL';
  item.fills = [];
  const dot = figma.createEllipse();
  dot.resize(8, 8);
  dot.fills = [{ type: 'SOLID', color: tab === 'Library' ? PURPLE : { r: 0.8, g: 0.8, b: 0.8 } }];
  item.appendChild(dot);
  const lbl = figma.createText();
  lbl.fontName = { family: 'Inter', style: 'Medium' };
  lbl.characters = tab;
  lbl.fontSize = 10;
  item.appendChild(lbl);
  nav.appendChild(item);
}

return {
  createdNodeIds: [primaryBtn.id, accentBtn.id, outlineBtn.id, card.id, nav.id],
};
