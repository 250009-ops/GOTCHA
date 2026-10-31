// Lists every bare require/import in the given dirs and fails if one is not in package.json dependencies.
// Usage: node scripts/check-runtime-deps.mjs <pkgRoot> dist src
import fs from 'fs';import path from 'path';import {builtinModules} from 'module';
const root=process.argv[2];const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
const deps=new Set(Object.keys(pkg.dependencies||{}));const found=new Map();
const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(e.name!=='node_modules')walk(p)}else if(/\.(js|ts|mjs|cjs)$/.test(e.name)&&!/\.d\.ts$/.test(e.name)&&!/\.test\.|\.spec\./.test(e.name)){const s=fs.readFileSync(p,'utf8');
for(const m of s.matchAll(/(?:require\(\s*|import\(\s*|from\s+|^\s*import\s+)['"]([^'"]+)['"]/gm)){let n=m[1];if(n.startsWith('.')||n.startsWith('/')||n.startsWith('node:'))continue;
if(/\s/.test(n))continue;const b=n.startsWith('@')?n.split('/').slice(0,2).join('/'):n.split('/')[0];if(builtinModules.includes(b))continue;
if(/^import\s+type/.test(s.slice(m.index,m.index+40)))continue;(found.get(b)||found.set(b,new Set()).get(b)).add(path.relative(root,p))}}}};
for(const d of process.argv.slice(3))if(fs.existsSync(path.join(root,d)))walk(path.join(root,d));
let bad=0;for(const [b,f] of [...found].sort()){const ok=deps.has(b);if(!ok)bad++;console.log((ok?'OK  ':'MISSING ')+b+'  '+[...f].slice(0,2).join(','))}
process.exit(bad?1:0)
