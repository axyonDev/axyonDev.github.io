/** AXYON: Orbital Ascendancy v4.5.6 U4.3.3 — Planetary Bastions hotfix data overlay. */
(function(global){
  'use strict';
  const A=global.Axyon=global.Axyon||{},D=A.Data,C=A.Canonical?.data;
  if(!D||!C)throw new Error('U3 data overlay requires live Data and frozen Canonical data');
  D.game={title:'AXYON: Orbital Ascendancy',version:'4.5.6-u4.3.3',world:'Kestros İmparatorluğu',subtitle:'Planetary Bastions'};
  const icons={emergencyBarrier:'🧱',ballisticTurret:'🔫',laserPoint:'🔆',missilePod:'🚀',interceptorDrone:'🤖',plasmaTurret:'☄️',planetaryShieldCore:'🛡️',orbitalCannon:'🛰️'};
  const legacy=(D.defenses||[]).map(x=>Object.assign({},x,{legacy:true,hidden:true}));
  const canonicalDefenses=(C.defenses||[]).map(x=>({
    id:x.id,name:x.name,icon:icons[x.id]||'🛡️',attack:Number(x.attack||0),hull:Number(x.hull||0),
    load:Number(x.planetInfrastructureLoad||x.orbitalMassLoad||x.commandLoad||0),tech:x.technology||null,
    cost:Object.fromEntries(Object.entries(x.buildCost||{}).map(([k,v])=>[k,Number(v)])),
    placement:x.placement,defenseClass:x.class,powerDemand:Number(x.powerDemand||0),ammoItem:x.ammoItem||null,
    ammoPerRound:Number(x.ammoPerRound||0),planetInfrastructureLoad:Number(x.planetInfrastructureLoad||0),
    orbitalMassLoad:Number(x.orbitalMassLoad||0),commandLoad:Number(x.commandLoad||0),
    surfaceAreaPerUnitM2:Number(x.surfaceAreaPerUnitM2||x.footprint?.surfaceAreaM2||0),
    heatOutputPerUnit:Number(x.heatOutputPerUnit||0),maintenancePerUnit:Number(x.maintenancePerUnit||0),
    maxCountPerComplex:x.maxCountPerComplex==null?null:Number(x.maxCountPerComplex),leakReduction:Number(x.leakReduction||0),
    maxDefenseShare:Number(x.maxDefenseShare||1),description:x.description||'',footprint:x.footprint||null
  }));
  D.defenses=[...legacy,...canonicalDefenses];
  Object.assign(D.items.scrapMetal||{}, {externalSource:'Savaş, baskın ve söküm enkazı'});
  Object.assign(D.items.wreckCircuit||{}, {externalSource:'Hasarlı gemi, uydu ve savunma enkazı'});
  Object.assign(D.items.alienAlloy||{}, {externalSource:'Uzaylı savaş ve kadim cephe enkazı'});
  const liveShipIds=new Set((D.ships||[]).map(x=>x.id));
  for(const x of C.ships||[]){
    if(liveShipIds.has(x.id))continue;
    D.ships.push({id:x.id,name:x.name,icon:x.icon||'🚀',attack:Number(x.attack||0),hull:Number(x.hull||0),cargo:Number(x.cargo||0),speed:Number(x.speed||1),fuel:Number(x.missionFuel?.baseCost||0),commandLoad:Number(x.commandLoad||1),orbitalMassLoad:Number(x.orbitalMassLoad||1),buildSec:Number(x.buildSeconds||60),tech:x.technology||null,cost:Object.fromEntries(Object.entries(x.buildCost||{}).map(([k,v])=>[k,Number(v)])),role:x.role||'combat'});
  }
  const infrastructureAssets=Object.fromEntries(Object.entries(C.balanceP2.capacityModel.infrastructureAssets||{}).map(([id,x])=>[id,Object.assign({},x,{tech:{coolingHub:'planetaryLogistics',maintenanceDepot:'maintenanceEngineering',commandArray:'fleetCommand',orbitalControlNode:'orbitalCommand'}[id]||null})]));
  D.u3=Object.freeze({
    title:'AXYON: Orbital Ascendancy',subtitle:'Planetary Bastions',
    capacity:Object.assign({},C.balanceP2.capacityModel,{baseMaintenanceCapacityPerSector:18}),planetOverrides:C.balanceP2.planetOverrides,shield:C.balanceP2.shieldModel,battle:C.balanceP2.battleModel,
    defenses:canonicalDefenses,defenseComplexes:C.defenseComplexes,
    infrastructureAssets,
    maxLevels:{infrastructure:10,orbital:10,command:15},
    upgradeTech:{infrastructure:'planetaryLogistics',orbital:'orbitalCommand',command:'fleetCommand'},
    legacyDefenseMap:{turret:'ballisticTurret',interceptor:'interceptorDrone',shield:'planetaryShieldCore'}
  });
})(typeof window!=='undefined'?window:globalThis);
