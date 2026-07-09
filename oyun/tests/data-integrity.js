'use strict';
const fs=require('fs'),path=require('path');
const {root,loadRuntime}=require('./runtime-loader');
const ctx=loadRuntime();
const D=ctx.Axyon.Data,C=ctx.Axyon.Canonical,E=ctx.Axyon.Economy;
const assert=(x,m)=>{if(!x)throw new Error(m);};
const items=new Set(Object.keys(D.items)),techs=new Set(D.research.map(x=>x.id)),machines=new Set(D.machines.map(x=>x.id));

assert(D.game.version==='4.5.6-u4.3.3','game version mismatch');assert(D.game.title==='AXYON: Orbital Ascendancy','product title mismatch');
assert(C&&C.version==='4.4.0','canonical data not loaded');
assert(C.counts.items===52&&C.counts.machines===50&&C.counts.technologies===52&&C.counts.repeatableTechnologies===12,'canonical counts mismatch');
assert(C.counts.ships===10&&C.counts.satellites===3&&C.counts.defenses===8&&C.counts.planetTypes===4,'canonical strategic counts mismatch');
assert(Object.keys(D.items).length===52&&D.machines.length===50&&D.research.length===52&&D.repeatableResearch.length===12,'runtime data bridge counts mismatch');
assert(D.firstOrbit?.enabled,'first-orbit rules missing');
assert(D.firstOrbit.startingCredits===0,'new game must start with zero credits');
assert(E.sellItem(E.createInitialState(),'ironOre',1).eq(0),'local selling must remain disabled');
const contractTotal=D.firstOrbit.foundingContracts.reduce((sum,c)=>sum+c.creditReward,0);
assert(contractTotal===13500,'founding contracts must guarantee 13,500 credits');
assert(D.firstOrbit.marketMk1CreditCost===12000,'Market Mk I cost mismatch');
assert(contractTotal-D.firstOrbit.marketMk1CreditCost>=1500,'Market Mk I guaranteed remainder below 1,500');

const producerByItem=new Map();
for(const m of D.machines){
  assert(m.name&&m.icon&&m.desc!==null,`machine identity missing ${m.id}`);
  for(const k of Object.keys(m.recipe.in))assert(items.has(k),`${m.id} missing input ${k}`);
  for(const k of Object.keys(m.recipe.out)){assert(items.has(k),`${m.id} missing output ${k}`);if(!producerByItem.has(k))producerByItem.set(k,[]);producerByItem.get(k).push(m.id);}
  if(m.tech)assert(techs.has(m.tech),`${m.id} missing tech ${m.tech}`);
  assert(m.materialCost&&Object.keys(m.materialCost).length>0,`${m.id} material build cost missing`);
}
for(const p of D.powerPlants){if(p.tech)assert(techs.has(p.tech),`${p.id} missing tech ${p.tech}`);if(p.fuel)assert(items.has(p.fuel.item),`${p.id} missing fuel`);assert(p.materialCost&&Object.keys(p.materialCost).length>0,`${p.id} material build cost missing`);}
for(const t of D.research){
  assert(D.eraOrder.includes(t.era),`${t.id} era missing`);assert(t.durationSec>0,`${t.id} duration missing`);assert(t.coins>=0,`${t.id} coin cost missing`);
  assert(machines.has(t.lab),`${t.id} lab missing`);for(const x of t.prereq)assert(techs.has(x),`${t.id} prereq missing ${x}`);for(const x of Object.keys(t.cost))assert(items.has(x),`${t.id} cost item missing ${x}`);
}
const reachable=new Set();let changed=true;while(changed){changed=false;for(const t of D.research)if(!reachable.has(t.id)&&t.prereq.every(x=>reachable.has(x))){reachable.add(t.id);changed=true;}}assert(reachable.size===D.research.length,'technology graph contains unreachable nodes');

for(const [id,it] of Object.entries(D.items)){
  assert(it.name&&it.icon&&it.desc,`${id} item documentation missing`);
  if(it.research){assert(it.marketPolicy==='forbidden',`${id} research data leaked into market`);assert(Number(it.sell||0)===0,`${id} research data has a sale price`);}
  assert(producerByItem.has(id)||it.research||it.externalSource||['scrapMetal','wreckCircuit','alienAlloy'].includes(id),`${id} has no producer or system source`);
}

const synthetic=D.research.find(t=>t.id==='syntheticFuelChemistry');assert(synthetic,'synthetic fuel technology missing');
for(const forbidden of ['crudeOil','petrolGas','sulfur'])assert(!(forbidden in synthetic.cost),`synthetic fuel technology illegally requires ${forbidden}`);
assert(producerByItem.has('sectorScannerModule'),'Sector Scanner Module has no producer');
assert(D.firstOrbit.resourceDiscovery.oilFreeRoute.forbid.includes('crudeOil'),'oil-free route does not forbid crude oil');
const prototype=D.satellites.find(s=>s.id===D.firstOrbit.prototypeSatelliteId);assert(prototype,'prototype market satellite missing');
assert(prototype.maintenanceFuel.primary==='compressedNitrogen','Mk0 satellite must use compressed nitrogen');
assert(prototype.maintenanceFuel.primary!=='xenonPropellant','Mk0 satellite must not depend on xenon');
assert(Object.keys(prototype.cost).includes('rocketKerosene')&&Object.keys(prototype.cost).includes('liquidOxygen'),'Mk0 launch fuel chain missing');
assert(D.automation?.maxLevel===5,'five-stage automation config missing');
assert(Array.isArray(D.repairFacilities)&&D.repairFacilities.length===3,'repair facilities missing');
assert(fs.existsSync(path.join(root,'encyclopedia.html')),'encyclopedia missing');
assert(fs.existsSync(path.join(root,'src/ui/help-system.js')),'help system missing');
assert(D.u3&&D.u3.defenses.length===8&&D.u3.defenseComplexes.length===2,'U3 defense/capacity data missing');
assert(D.u3.capacity.baseMaintenanceCapacityPerSector>=18,'starter maintenance capacity is below playable floor');
console.log('PASS data-integrity U3: frozen canonical counts, zero-credit first orbit, DAG, recipes, material construction, synthetic route, research-only data and Mk0 fuel safety');
