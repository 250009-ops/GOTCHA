// Gotcha Figma — Step 2: Design tokens (color swatches + typography)
// skillNames: figma-use,figma-generate-design

await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

const dsPage = figma.root.children.find((p) => p.name === '01 Design System');
await figma.setCurrentPageAsync(dsPage);

const tokens = [
  { name: 'brand/primary', hex: '#6D28D9', rgb: { r: 0.427, g: 0.157, b: 0.851 } },
  { name: 'brand/accent', hex: '#0D9488', rgb: { r: 0.051, g: 0.580, b: 0.533 } },
  { name: 'brand/warm', hex: '#F59E0B', rgb: { r: 0.961, g: 0.620, b: 0.043 } },
  { name: 'surface/background', hex: '#F8FAFC', rgb: { r: 0.973, g: 0.980, b: 0.988 } },
  { name: 'surface/reader', hex: '#FFFEF9', rgb: { r: 1, g: 0.996, b: 0.976 } },
  { name: 'text/primary', hex: '#0F172A', rgb: { r: 0.059, g: 0.090, b: 0.165 } },
];

const grid = figma.createFrame();
grid.name = 'Color Tokens';
grid.x = 80;
grid.y = 80;
grid.layoutMode = 'HORIZONTAL';
grid.itemSpacing = 24;
grid.fills = [];

const swatchIds = [];

for (const t of tokens) {
  const col = figma.createFrame();
  col.layoutMode = 'VERTICAL';
  col.itemSpacing = 8;
  col.fills = [];

  const swatch = figma.createRectangle();
  swatch.resize(120, 80);
  swatch.cornerRadius = 12;
  swatch.fills = [{ type: 'SOLID', color: t.rgb }];
  col.appendChild(swatch);

  const label = figma.createText();
  label.fontName = { family: 'Inter', style: 'Bold' };
  label.characters = t.name;
  label.fontSize = 12;
  col.appendChild(label);

  const hex = figma.createText();
  hex.fontName = { family: 'Inter', style: 'Medium' };
  hex.characters = t.hex;
  hex.fontSize = 11;
  hex.opacity = 0.7;
  col.appendChild(hex);

  grid.appendChild(col);
  swatchIds.push(swatch.id);
}

// Typography samples
const typeFrame = figma.createFrame();
typeFrame.name = 'Typography';
typeFrame.x = 80;
typeFrame.y = 280;
typeFrame.layoutMode = 'VERTICAL';
typeFrame.itemSpacing = 12;
typeFrame.fills = [];

const samples = [
  { label: 'Display / H1', size: 28, weight: 'Bold' },
  { label: 'Heading / H2', size: 20, weight: 'Bold' },
  { label: 'Body / Reader', size: 18, weight: 'Medium' },
  { label: 'Body / UI', size: 15, weight: 'Medium' },
  { label: 'Caption', size: 13, weight: 'Medium' },
];

const typeIds = [];
for (const s of samples) {
  await figma.loadFontAsync({ family: 'Inter', style: s.weight });
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: s.weight };
  t.characters = `${s.label} — Learn languages by reading`;
  t.fontSize = s.size;
  typeFrame.appendChild(t);
  typeIds.push(t.id);
}

return { gridId: grid.id, swatchIds, typeFrameId: typeFrame.id, typeIds };
