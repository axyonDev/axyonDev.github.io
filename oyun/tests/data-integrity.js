const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),ctx={console,Date,Math};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['data/feature-flags.js','vendor/break_eternity/break_eternity.min.js','src/core/economy-number.js','src/core/lossless-json.js','src/services/save-migrator-v16.js','data/canonical/game-data.v4.4.final.js','src/core/canonical-data-loader.js','src/core/numbers.js','data/config.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const D=ctx.Axyon.Data,assert=(x,m)=>{if(!x)throw new Error(m)},items=new Set(Object.keys(D.items)),techs=new Set(D.research.map(x=>x.id)),machines=new Set(D.machines.map(x=>x.id));
assert(D.game.version==='4.4.0-u1','game version mismatch');assert(D.eraOrder.length===5,'research eras missing');const C=ctx.Axyon.Canonical;assert(C&&C.version==='4.4.0','canonical data not loaded');assert(C.counts.items===52&&C.counts.machines===50,'canonical counts mismatch');

assert(D.automation&&D.automation.maxLevel===5,'five-stage automation config missing');
for(const [level,tech] of Object.entries(D.automation.techByLevel||{}))assert(techs.has(tech),`automation level ${level} missing tech ${tech}`);
assert(Array.isArray(D.repairFacilities)&&D.repairFacilities.length===3,'planet/orbital/satellite repair facilities missing');
for(const f of D.repairFacilities){assert(['planet','orbital','satellite'].includes(f.zone),`${f.id} invalid repair zone`);assert(techs.has(f.tech),`${f.id} missing repair technology`);assert(f.maxLevel===5&&f.baseSecPerPoint>0,`${f.id} invalid facility progression`);}
assert(D.frontier&&D.frontier.strengthGrowth>1&&D.frontier.scanGrowth>1,'procedural frontier scaling missing');
D.machines.forEach(m=>{assert(m.name&&m.icon&&m.desc!==null,`machine identity missing ${m.id}`);Object.keys(m.recipe.in).forEach(k=>assert(items.has(k),`${m.id} missing input ${k}`));Object.keys(m.recipe.out).forEach(k=>assert(items.has(k),`${m.id} missing output ${k}`));if(m.tech)assert(techs.has(m.tech),`${m.id} missing tech ${m.tech}`)});
D.powerPlants.forEach(p=>{if(p.tech)assert(techs.has(p.tech),`${p.id} missing tech ${p.tech}`);if(p.fuel)assert(items.has(p.fuel.item),`${p.id} missing fuel`) });
D.research.forEach(t=>{assert(D.eraOrder.includes(t.era),`${t.id} era missing`);assert(t.durationSec>0,`${t.id} duration missing`);assert(t.coins>=0,`${t.id} coin cost missing`);assert(machines.has(t.lab),`${t.id} lab missing`);t.prereq.forEach(x=>assert(techs.has(x),`${t.id} prereq missing ${x}`));Object.keys(t.cost).forEach(x=>assert(items.has(x),`${t.id} cost item missing ${x}`));});
const reachable=new Set();let changed=true;while(changed){changed=false;for(const t of D.research)if(!reachable.has(t.id)&&t.prereq.every(x=>reachable.has(x))){reachable.add(t.id);changed=true;}}assert(reachable.size===D.research.length,'technology graph contains unreachable nodes');
const repeat20=D.repeatableResearch.reduce((sum,r)=>sum+Array.from({length:20},(_,i)=>r.durationSec*Math.pow(1.22,i)).reduce((a,b)=>a+b,0),0);
assert(repeat20>10*365*86400,'repeatable research horizon is not multi-year');
assert(repeat20/4>3*365*86400,'max laboratory acceleration collapses long-term research below three years');
for(const [id,it] of Object.entries(D.items)){assert(it.name&&it.icon&&it.desc,`${id} item documentation missing`);const made=D.machines.some(m=>m.recipe.out[id]);assert(made||it.research||it.externalSource,`${id} has no producer or system source`);}
assert(fs.existsSync(path.join(root,'encyclopedia.html')),'encyclopedia missing');assert(fs.existsSync(path.join(root,'src/ui/help-system.js')),'help system missing');
console.log('PASS data-integrity: technology, recipes, multi-year research horizon, documentation and encyclopedia references');
