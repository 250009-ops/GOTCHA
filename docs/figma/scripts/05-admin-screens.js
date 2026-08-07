// Gotcha Figma — Step 5: Admin CMS (1440x900)
// skillNames: figma-use,figma-generate-design

await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

const page = figma.root.children.find((p) => p.name === '04 Admin CMS');
await figma.setCurrentPageAsync(page);

const PURPLE = { r: 0.427, g: 0.157, b: 0.851 };
const BG = { r: 0.973, g: 0.980, b: 0.988 };

const dashboard = figma.createFrame();
dashboard.name = 'Admin / Dashboard';
dashboard.x = 80;
dashboard.y = 80;
dashboard.resize(1440, 900);
dashboard.clipsContent = true;
dashboard.fills = [{ type: 'SOLID', color: BG }];

const sidebar = figma.createFrame();
sidebar.name = 'Sidebar';
sidebar.resize(260, 900);
sidebar.fills = [{ type: 'SOLID', color: PURPLE }];
sidebar.layoutMode = 'VERTICAL';
sidebar.paddingTop = 32;
sidebar.paddingLeft = 16;
sidebar.paddingRight = 16;
sidebar.itemSpacing = 8;

const logo = figma.createText();
logo.fontName = { family: 'Inter', style: 'Bold' };
logo.characters = 'Gotcha Admin';
logo.fontSize = 20;
logo.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
sidebar.appendChild(logo);

for (const item of ['Dashboard', 'Content', 'Licenses', 'Moderation', 'Ingestion']) {
  const nav = figma.createText();
  nav.fontName = { family: 'Inter', style: 'Medium' };
  nav.characters = item;
  nav.fontSize = 14;
  nav.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  sidebar.appendChild(nav);
}

dashboard.appendChild(sidebar);

const main = figma.createFrame();
main.name = 'Main';
main.x = 260;
main.y = 0;
main.resize(1180, 900);
main.fills = [];
main.layoutMode = 'VERTICAL';
main.paddingTop = 40;
main.paddingLeft = 40;
main.paddingRight = 40;
main.itemSpacing = 24;

const title = figma.createText();
title.fontName = { family: 'Inter', style: 'Bold' };
title.characters = 'Dashboard';
title.fontSize = 28;
main.appendChild(title);

const stats = figma.createFrame();
stats.layoutMode = 'HORIZONTAL';
stats.itemSpacing = 16;
stats.fills = [];

for (const stat of [
  ['Users', '128'],
  ['Published', '52'],
  ['Moderation', '3'],
  ['AI lookups', '1.2k'],
]) {
  const card = figma.createFrame();
  card.resize(180, 100);
  card.cornerRadius = 16;
  card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  card.strokes = [{ type: 'SOLID', color: { r: 0.886, g: 0.910, b: 0.941 } }];
  card.strokeWeight = 1;
  card.layoutMode = 'VERTICAL';
  card.paddingTop = 16;
  card.paddingLeft = 16;
  card.itemSpacing = 8;
  const lbl = figma.createText();
  lbl.fontName = { family: 'Inter', style: 'Medium' };
  lbl.characters = stat[0];
  lbl.fontSize = 12;
  lbl.opacity = 0.6;
  const val = figma.createText();
  val.fontName = { family: 'Inter', style: 'Bold' };
  val.characters = stat[1];
  val.fontSize = 28;
  card.appendChild(lbl);
  card.appendChild(val);
  stats.appendChild(card);
}

main.appendChild(stats);
dashboard.appendChild(main);

return { dashboardId: dashboard.id };
