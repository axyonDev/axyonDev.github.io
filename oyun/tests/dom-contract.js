const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const assert=(x,m)=>{if(!x)throw new Error(m)};

function idList(html){return [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);}
function ids(html){return new Set(idList(html));}
function assertUniqueIds(name,html){const list=idList(html),seen=new Set(),dupes=new Set();for(const id of list){if(seen.has(id))dupes.add(id);seen.add(id);}assert(!dupes.size,`${name} duplicate ids: ${[...dupes].join(', ')}`);}
function localAssets(html){
  return [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]).filter(x=>!x.startsWith('#')&&!/^(?:https?:|data:|mailto:)/.test(x));
}
const index=read('index.html'),indexIds=ids(index);assertUniqueIds('index.html',index);for(const asset of ['data/feature-flags.js','vendor/break_eternity/break_eternity.min.js','src/core/economy-number.js','src/core/lossless-json.js','src/services/save-migrator-v16.js','data/canonical/game-data.v4.4.final.js','src/core/canonical-data-loader.js'])assert(index.includes(asset),`U1 script missing ${asset}`);
const ui=read('src/ui/ui.js'),combat=read('src/ui/combat-ui.js'),main=read('src/main.js');
const refs=new Set();
for(const source of [ui,combat,main]){
  for(const m of source.matchAll(/(?:UI\.)?el\(['"]([^'"]+)['"]\)/g))refs.add(m[1]);
}
const dynamicAllowed=new Set(['fleet-preview']);
const missing=[...refs].filter(id=>!indexIds.has(id)&&!dynamicAllowed.has(id));
assert(!missing.length,'index.html missing static DOM ids: '+missing.join(', '));

const encyclopedia=read('encyclopedia.html'),encIds=ids(encyclopedia),encJs=read('src/ui/encyclopedia.js');assertUniqueIds('encyclopedia.html',encyclopedia);
const encRefs=[...encJs.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]);
const encMissing=[...new Set(encRefs)].filter(id=>!encIds.has(id));
assert(!encMissing.length,'encyclopedia.html missing DOM ids: '+encMissing.join(', '));

for(const [name,html] of [['index.html',index],['encyclopedia.html',encyclopedia]]){
  const absent=localAssets(html).filter(a=>!fs.existsSync(path.join(root,a.replace(/^\.\//,''))));
  assert(!absent.length,`${name} missing local assets: ${absent.join(', ')}`);
}

const help=read('src/ui/help-system.js');
const uiBlock=help.slice(help.indexOf('const uiHelp={'),help.indexOf('};',help.indexOf('const uiHelp={')));
const uiHelpKeys=new Set([...uiBlock.matchAll(/\b([A-Za-z0-9_]+):\{title:/g)].map(m=>m[1]));
const helpSources=[index,ui,combat];
const requested=[];
for(const source of helpSources)for(const m of source.matchAll(/data-help=(?:\\?["'])ui:([A-Za-z0-9_]+)/g))requested.push(m[1]);
const missingHelp=[...new Set(requested)].filter(k=>!uiHelpKeys.has(k));
assert(!missingHelp.length,'undefined UI help keys: '+missingHelp.join(', '));


const sw=read('sw.js');
const cached=[...sw.matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]).filter(Boolean);
const missingCached=[...new Set(cached)].filter(a=>!fs.existsSync(path.join(root,a)));
assert(!missingCached.length,'service worker missing cached assets: '+missingCached.join(', '));
assert(sw.includes('axyon-first-orbit-v4-4-u1'),'service worker cache version is stale');
assert(cached.includes('src/ui/combat-ui.js'),'combat UI is not cached for offline mode');
const manifest=JSON.parse(read('manifest.json'));assert(manifest.name.includes('First Orbit'),'manifest product name is stale');assert(manifest.description.includes('tamir'),'manifest does not describe maintenance system');

const scriptOrder=[...index.matchAll(/<script\s+src=["']([^"']+)["']/g)].map(m=>m[1]);
for(const required of ['src/core/numbers.js','data/config.js','src/core/economy.js','src/services/save-service.js','src/ui/help-system.js','src/canvas/factory-canvas.js','src/ui/ui.js','src/ui/combat-ui.js','src/main.js'])assert(scriptOrder.includes(required),`missing script ${required}`);
assert(scriptOrder.indexOf('data/config.js')<scriptOrder.indexOf('src/core/economy.js'),'config must load before economy');
assert(scriptOrder.indexOf('src/ui/help-system.js')<scriptOrder.indexOf('src/main.js'),'help system must load before main');
assert(scriptOrder.indexOf('src/ui/combat-ui.js')<scriptOrder.indexOf('src/main.js'),'combat UI must load before main');

const css=read('css/style.css'),v42=css.slice(css.lastIndexOf('Axyon Idle Factory v4.3'));
assert(v42.includes('.live-ticker{'),'v4.3 research responsive override missing');
assert(v42.includes('.inv-row{display:grid!important;min-width:0!important'),'v4.3 storage responsive override missing');
assert(v42.includes('.report-workspace{display:grid'),'combat report workspace styles missing');
assert(v42.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important'),'mobile tab wrapping missing');
assert(v42.includes('.hud{grid-template-columns:minmax(0,1fr)!important}'),'mobile HUD shrink rule missing');
assert(index.includes('id="commander-onboarding"')&&index.includes('id="first-commander-name"'),'mandatory commander onboarding missing');

console.log('PASS dom-contract: static ids, help keys, responsive UI contracts, combat page, script order and local assets');
