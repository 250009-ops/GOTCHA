// Gotcha Figma — Step 6: Marketing landing (1440px)
// skillNames: figma-use,figma-generate-design

await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

const page = figma.root.children.find((p) => p.name === '05 Marketing');
await figma.setCurrentPageAsync(page);

const PURPLE = { r: 0.427, g: 0.157, b: 0.851 };
const TEAL = { r: 0.051, g: 0.580, b: 0.533 };
const BG = { r: 0.973, g: 0.980, b: 0.988 };

const landing = figma.createFrame();
landing.name = 'Marketing / Landing 1440';
landing.x = 80;
landing.y = 80;
landing.resize(1440, 2400);
landing.fills = [{ type: 'SOLID', color: BG }];
landing.layoutMode = 'VERTICAL';
landing.itemSpacing = 0;

// Nav
const nav = figma.createFrame();
nav.resize(1440, 72);
nav.layoutMode = 'HORIZONTAL';
nav.primaryAxisAlignItems = 'SPACE_BETWEEN';
nav.counterAxisAlignItems = 'CENTER';
nav.paddingLeft = 80;
nav.paddingRight = 80;
nav.fills = [{ type: 'SOLID', color: BG }];
const navLogo = figma.createText();
navLogo.fontName = { family: 'Inter', style: 'Bold' };
navLogo.characters = 'Gotcha';
navLogo.fontSize = 22;
navLogo.fills = [{ type: 'SOLID', color: PURPLE }];
nav.appendChild(navLogo);
landing.appendChild(nav);

// Hero
const hero = figma.createFrame();
hero.resize(1440, 520);
hero.layoutMode = 'HORIZONTAL';
hero.paddingLeft = 80;
hero.paddingRight = 80;
hero.paddingTop = 80;
hero.itemSpacing = 60;
hero.fills = [];

const heroText = figma.createFrame();
heroText.layoutMode = 'VERTICAL';
heroText.itemSpacing = 20;
heroText.layoutGrow = 1;
heroText.fills = [];
const h1 = figma.createText();
h1.fontName = { family: 'Inter', style: 'Bold' };
h1.characters = 'Learn languages by\nreading what you love';
h1.fontSize = 52;
h1.lineHeight = { unit: 'PIXELS', value: 58 };
heroText.appendChild(h1);
const sub = figma.createText();
sub.fontName = { family: 'Inter', style: 'Medium' };
sub.characters = 'Gotcha combines authentic reading with AI-powered vocabulary and practice for EN, RU, and UZ learners.';
sub.fontSize = 18;
sub.opacity = 0.7;
sub.resize(520, 80);
heroText.appendChild(sub);
hero.appendChild(heroText);

const mock = figma.createFrame();
mock.resize(420, 360);
mock.cornerRadius = 32;
mock.fills = [{ type: 'SOLID', color: PURPLE }];
const mockInner = figma.createFrame();
mockInner.resize(360, 300);
mockInner.x = 30;
mockInner.y = 30;
mockInner.cornerRadius = 20;
mockInner.fills = [{ type: 'SOLID', color: { r: 1, g: 0.996, b: 0.976 } }];
mock.appendChild(mockInner);
hero.appendChild(mock);

landing.appendChild(hero);

// Features row
const features = figma.createFrame();
features.resize(1440, 280);
features.layoutMode = 'HORIZONTAL';
features.paddingLeft = 80;
features.paddingRight = 80;
features.paddingTop = 60;
features.itemSpacing = 24;
features.fills = [];

for (const feat of ['Read authentic texts', 'Tap to learn in context', 'Practice from your reading']) {
  const card = figma.createFrame();
  card.resize(400, 180);
  card.cornerRadius = 20;
  card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  card.layoutMode = 'VERTICAL';
  card.paddingTop = 24;
  card.paddingLeft = 24;
  card.itemSpacing = 12;
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Bold' };
  t.characters = feat;
  t.fontSize = 18;
  card.appendChild(t);
  features.appendChild(card);
}

landing.appendChild(features);

return { landingId: landing.id };
