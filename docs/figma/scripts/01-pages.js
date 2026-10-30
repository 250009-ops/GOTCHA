// Gotcha Figma — Step 1: Create pages
// skillNames: figma-use,figma-generate-design

await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

const pageNames = [
  '00 Cover',
  '01 Design System',
  '02 Components',
  '03 Mobile App',
  '04 Admin CMS',
  '05 Marketing',
  '06 Prototype',
  '07 Handoff',
];

const createdPageIds = [];

for (const name of pageNames) {
  let page = figma.root.children.find((p) => p.name === name);
  if (!page) {
    page = figma.createPage();
    page.name = name;
  }
  createdPageIds.push(page.id);
}

// Cover page content
const coverPage = figma.root.children.find((p) => p.name === '00 Cover');
await figma.setCurrentPageAsync(coverPage);

const cover = figma.createFrame();
cover.name = 'Cover';
cover.resize(800, 400);
cover.x = 100;
cover.y = 100;
cover.fills = [{ type: 'SOLID', color: { r: 0.427, g: 0.157, b: 0.851 } }];
cover.layoutMode = 'VERTICAL';
cover.primaryAxisAlignItems = 'CENTER';
cover.counterAxisAlignItems = 'CENTER';
cover.paddingTop = 48;
cover.paddingBottom = 48;
cover.paddingLeft = 48;
cover.paddingRight = 48;
cover.itemSpacing = 16;
cover.cornerRadius = 24;

const title = figma.createText();
title.fontName = { family: 'Inter', style: 'Bold' };
title.characters = 'Gotcha — Language Learning';
title.fontSize = 36;
title.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
cover.appendChild(title);

const subtitle = figma.createText();
subtitle.fontName = { family: 'Inter', style: 'Medium' };
subtitle.characters = 'EN · RU · UZ · Reading-first · AI Practice';
subtitle.fontSize = 16;
subtitle.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.85 }];
cover.appendChild(subtitle);

return { createdPageIds, coverId: cover.id };
