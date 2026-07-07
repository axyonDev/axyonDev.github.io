'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),assert=(x,m)=>{if(!x)throw new Error(m);};
function idList(html){return [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);}
function ids(html){return new Set(idList(html));}
function assertUniqueIds(name,html){const list=idList(html),seen=new Set(),dupes=new Set();for(const id of list){if(seen.has(id))dupes.add(id);seen.add(id);}assert(!dupes.size,`${name} duplicate ids: ${[...dupes].join(', ')}`);}
function localAssets(html){return [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]).filter(x=>!x.startsWith('#')&&!/^(?:https?:|data:|mailto:)/.test(x));}

const index=read('index.html'),indexIds=ids(index);assertUniqueIds('index.html',index);
for(const asset of ['data/feature-flags.js','vendor/break_eternity/break_eternity.min.js','src/core/economy-number.js','src/core/lossless-json.js','src/services/save-migrator-v16.js','data/canonical/game-data.v4.4.final.js','src/core/canonical-data-loader.js','data/u2-first-orbit-data.js','data/u3-planetary-bastions-data.js','src/core/u2-first-orbit-runtime.js','src/core/u3-planetary-bastions-runtime.js'])assert(index.includes(asset),`U2 script missing ${asset}`);
for(const id of ['first-orbit-status','founding-contracts','commander-onboarding','first-commander-name','panel-infrastructure','capacity-grid','defense-complex-list','cohort-defense-list','save-warning'])assert(indexIds.has(id),`U2 DOM id missing ${id}`);

const ui=read('src/ui/ui.js'),combat=read('src/ui/combat-ui.js'),main=read('src/main.js'),refs=new Set();
for(const source of [ui,combat,main])for(const m of source.matchAll(/(?:UI\.)?el\(['"]([^'"]+)['"]\)/g))refs.add(m[1]);
const missing=[...refs].filter(id=>!indexIds.has(id)&&id!=='fleet-preview');assert(!missing.length,'index.html missing static DOM ids: '+missing.join(', '));

const encyclopedia=read('encyclopedia.html'),encIds=ids(encyclopedia),encJs=read('src/ui/encyclopedia.js');assertUniqueIds('encyclopedia.html',encyclopedia);
const encRefs=[...encJs.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]),encMissing=[...new Set(encRefs)].filter(id=>!encIds.has(id));assert(!encMissing.length,'encyclopedia.html missing DOM ids: '+encMissing.join(', '));
assert(encyclopedia.includes('data/u2-first-orbit-data.js'),'encyclopedia is not connected to U2 data bridge');assert(encyclopedia.includes('data/u3-planetary-bastions-data.js'),'encyclopedia is not connected to U3 data overlay');
for(const [name,html] of [['index.html',index],['encyclopedia.html',encyclopedia]]){const absent=localAssets(html).filter(a=>!fs.existsSync(path.join(root,a.replace(/^\.\//,''))));assert(!absent.length,`${name} missing local assets: ${absent.join(', ')}`);}

const help=read('src/ui/help-system.js'),uiBlock=help.slice(help.indexOf('const uiHelp={'),help.indexOf('};',help.indexOf('const uiHelp={'))),uiHelpKeys=new Set([...uiBlock.matchAll(/\b([A-Za-z0-9_]+):\{title:/g)].map(m=>m[1])),requested=[];
for(const source of [index,ui,combat])for(const m of source.matchAll(/data-help=(?:\\?["'])ui:([A-Za-z0-9_]+)/g))requested.push(m[1]);
const missingHelp=[...new Set(requested)].filter(k=>!uiHelpKeys.has(k));assert(!missingHelp.length,'undefined UI help keys: '+missingHelp.join(', '));

const sw=read('sw.js'),cached=[...sw.matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]).filter(Boolean),missingCached=[...new Set(cached)].filter(a=>!fs.existsSync(path.join(root,a)));assert(!missingCached.length,'service worker missing cached assets: '+missingCached.join(', '));
assert(sw.includes('axyon-orbital-ascendancy-v4-4-u3'),'service worker cache version is stale');assert(cached.includes('data/u2-first-orbit-data.js')&&cached.includes('src/core/u2-first-orbit-runtime.js'),'U2 runtime is not cached for offline mode');assert(cached.includes('data/u3-planetary-bastions-data.js')&&cached.includes('src/core/u3-planetary-bastions-runtime.js'),'U3 runtime is not cached for offline mode');assert(cached.includes('src/ui/combat-ui.js'),'combat UI is not cached');
const manifest=JSON.parse(read('manifest.json'));assert(manifest.name.includes('Orbital Ascendancy'),'manifest product name is stale');assert((manifest.version||'').includes('4.4.0-u3'),'manifest version is stale');

const scriptOrder=[...index.matchAll(/<script\s+src=["']([^"']+)["']/g)].map(m=>m[1]);
for(const required of ['src/core/numbers.js','data/config.js','data/u2-first-orbit-data.js','data/u3-planetary-bastions-data.js','src/core/economy.js','src/core/u2-first-orbit-runtime.js','src/core/u3-planetary-bastions-runtime.js','src/services/save-service.js','src/ui/help-system.js','src/canvas/factory-canvas.js','src/ui/ui.js','src/ui/combat-ui.js','src/main.js'])assert(scriptOrder.includes(required),`missing script ${required}`);
assert(scriptOrder.indexOf('data/config.js')<scriptOrder.indexOf('data/u2-first-orbit-data.js'),'config must load before U2 data bridge');assert(scriptOrder.indexOf('data/u2-first-orbit-data.js')<scriptOrder.indexOf('data/u3-planetary-bastions-data.js'),'U2 data must load before U3 overlay');assert(scriptOrder.indexOf('data/u3-planetary-bastions-data.js')<scriptOrder.indexOf('src/core/economy.js'),'U3 data overlay must load before economy');assert(scriptOrder.indexOf('src/core/economy.js')<scriptOrder.indexOf('src/core/u2-first-orbit-runtime.js'),'legacy core must load before U2 runtime');assert(scriptOrder.indexOf('src/core/u2-first-orbit-runtime.js')<scriptOrder.indexOf('src/core/u3-planetary-bastions-runtime.js'),'U2 runtime must load before U3 runtime');assert(scriptOrder.indexOf('src/core/u3-planetary-bastions-runtime.js')<scriptOrder.indexOf('src/services/save-service.js'),'U3 runtime must load before save service');

const css=read('css/style.css');assert(css.includes('/* v4.4 U2 — First Orbit bridge */'),'U2 CSS section missing');assert(css.includes('.first-orbit-status{'),'first orbit status styles missing');assert(css.includes('.founding-contracts{'),'founding contract styles missing');assert(css.includes('.report-workspace{display:grid'),'combat report workspace styles missing');assert(css.includes('.hud{grid-template-columns:minmax(0,1fr)!important}'),'mobile HUD shrink rule missing');
assert(css.includes('U3 Planetary Bastions / Orbital Ascendancy'),'U3 CSS section missing');assert(css.includes('safe-area-inset-top'),'safe-area support missing');
console.log('PASS dom-contract U3: static ids, local assets, offline cache, U2 script order, encyclopedia bridge and responsive First Orbit UI');
