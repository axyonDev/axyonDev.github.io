/**
 * Axyon v4.4 U2 — frozen canonical data to legacy runtime bridge.
 *
 * This file is loaded after data/config.js and before Economy. It converts the
 * P4-frozen JSON structures into the compact runtime shapes used by the current
 * browser game. It does not invent a second balance table: every v4.4 recipe,
 * research requirement and first-orbit rule comes from CanonicalDataPayload.
 */
(function(global){
  'use strict';
  global.Axyon=global.Axyon||{};
  const flags=global.Axyon.FeatureFlags||{};
  if(flags.V44_CANONICAL_DATA_ENABLED===false)return;
  const D=global.Axyon.Data, C=global.Axyon.CanonicalDataPayload;
  if(!D||!C)throw new Error('U2 First Orbit bridge requires legacy Data and frozen canonical payload');
  const n=v=>Number(v||0);
  const mapNumbers=obj=>Object.fromEntries(Object.entries(obj||{}).map(([k,v])=>[k,n(v)]));
  const byId=list=>Object.fromEntries((list||[]).map(x=>[x.id,x]));

  // Items: canonical data owns market policy, storage and descriptions.
  for(const x of C.items||[]){
    D.items[x.id]={
      name:x.name,icon:x.icon||'📦',tier:Number(x.tier||0),sell:n(x.basePrice),cap:Number(x.storageBase||500),
      desc:x.description||'',research:!!x.researchOnly,marketPolicy:x.marketPolicy||'allowed',category:x.category||'material',tags:[...(x.tags||[])]
    };
  }

  const oldMachines=byId(D.machines), oldPlants=byId(D.powerPlants);
  D.machines=(C.machines||[]).map(x=>{
    const prior=oldMachines[x.id]||{}, recipe=(x.recipes||[])[0]||{inputs:{},outputs:{},cycleSeconds:1};
    return {
      id:x.id,name:x.name,icon:x.icon||prior.icon||'🏭',tier:Number(x.tier||0),
      recipe:{in:mapNumbers(recipe.inputs),out:mapNumbers(recipe.outputs)},baseRate:1/Math.max(.001,n(recipe.cycleSeconds)||1),
      footprint:Number(x.footprint?.cells||prior.footprint||4),power:n(x.powerDemand),buildCost:0,buildGrowth:prior.buildGrowth||1.15,
      managerCost:prior.managerCost||Math.max(80,Math.round(120*Math.pow(2,Number(x.tier||0)))),tech:x.technology||null,maxLevel:Number(x.maxMk||5),
      materialCost:mapNumbers(x.buildCost),requiresResourceNode:x.requiresResourceNode||null,load:Number(x.planetInfrastructureLoad||1),
      heatOutput:n(x.heatOutput),maintenanceDemand:n(x.maintenanceDemand),description:x.description||`${x.name} üretim tesisi.`,
      canonicalRecipeId:recipe.id||`${x.id}.default`
    };
  });

  D.powerPlants=(C.powerPlants||[]).map(x=>{
    const prior=oldPlants[x.id]||{};
    return {
      id:x.id,name:x.name,icon:x.icon||prior.icon||'⚡',output:n(x.powerOutput),fuel:x.fuel?{item:x.fuel.item,rate:n(x.fuel.perSecond)}:null,
      footprint:Number(x.footprint?.cells||prior.footprint||4),buildCost:0,buildGrowth:prior.buildGrowth||1.18,tech:x.technology||null,maxLevel:Number(x.maxMk||5),
      materialCost:mapNumbers(x.buildCost),load:Number(x.planetInfrastructureLoad||1),heatOutput:n(x.heatOutput),maintenanceDemand:n(x.maintenanceDemand)
    };
  });

  D.research=(C.technologies||[]).map(x=>({
    id:x.id,name:x.name,icon:x.icon||'🔬',era:x.era||'alpha',durationSec:Number(x.durationSeconds||60),coins:n(x.creditCost),
    cost:mapNumbers(x.itemCost),prereq:[...(x.prerequisitesAll||[])],prereqAny:[...(x.prerequisitesAny||[])],requirements:Object.assign({},x.requirements||{}),
    lab:x.laboratory||'alphaLab',labLevel:Number(x.laboratoryMk||1),desc:x.description||'',unlocks:[...(x.unlocks||[])],maxLevel:Number(x.maxLevel||1)
  }));
  D.repeatableResearch=(C.repeatableTechnologies||[]).map(x=>({
    id:x.id,name:x.name,icon:x.icon||'∞',base:mapNumbers(x.base),growth:n(x.growth),durationSec:Number(x.durationSeconds||3600),desc:x.desc||x.description||''
  }));
  D.eraOrder=['alpha','beta','gamma','delta','omega'];
  D.eraLabels={alpha:'Alfa Çağı',beta:'Beta Çağı',gamma:'Gama Çağı',delta:'Delta Çağı',omega:'Omega Çağı'};

  D.ships=(C.ships||[]).map(x=>({
    id:x.id,name:x.name,icon:x.icon||'🚀',attack:n(x.attack),hull:n(x.hull),cargo:n(x.cargo),speed:n(x.speed),fuel:n(x.missionFuel?.baseCost),
    commandLoad:Number(x.commandLoad||1),orbitalMassLoad:Number(x.orbitalMassLoad||1),buildSec:Number(x.buildSeconds||30),tech:x.technology||null,cost:mapNumbers(x.buildCost),
    launchFuel:mapNumbers(x.launchFuel),missionFuel:Object.assign({},x.missionFuel||{}),role:x.role||'combat'
  }));
  D.satellites=(C.satellites||[]).map(x=>({
    id:x.id,name:x.name,icon:x.role==='marketPrototype'?'🛰️':x.role==='market'?'📦':'📡',tech:x.technology||null,maxCount:Number(x.maxCount||99),
    commandLoad:Number(x.commandLoad||1),orbitalMassLoad:Number(x.orbitalMassLoad||1),buildSec:Number(C.balanceP1?.operationDurations?.satelliteLaunchSeconds||120),
    cost:mapNumbers(x.buildCost),maintenanceFuel:Object.assign({},x.maintenanceFuel||{}),role:x.role||'utility'
  }));

  // U2 keeps the existing small-defense UI until the full cohort gameplay step,
  // but definitions are read from canonical data and remain resource-bound.
  D.defenses=(C.defenses||[]).filter(x=>x.id!=='emergencyBarrier').map(x=>({
    id:x.id,name:x.name,icon:x.class==='strategic'?'🛡️':x.class==='heavy'?'💥':'🔫',attack:n(x.attack),hull:n(x.hull),
    load:n(x.planetInfrastructureLoad)||1,tech:x.technology||null,cost:mapNumbers(x.buildCost),powerDemand:n(x.powerDemand),ammoItem:x.ammoItem||null,ammoPerRound:n(x.ammoPerRound),
    placement:x.placement,class:x.class,description:x.description||''
  }));

  D.market={
    baseCapacity:n(C.market.capacityByMk['1']),capacityGrowth:n(C.market.capacityByMk['2'])/Math.max(1,n(C.market.capacityByMk['1'])),
    baseCooldownSec:Number(C.market.cooldownSecondsByMk['1']),cooldownStep:Number(C.market.cooldownSecondsByMk['2'])/Math.max(1,Number(C.market.cooldownSecondsByMk['1'])),
    maxLevel:3,satellitesPerLevel:3,maxSatellites:9,capacityByMk:Object.fromEntries(Object.entries(C.market.capacityByMk).map(([k,v])=>[k,n(v)])),
    cooldownSecondsByMk:Object.fromEntries(Object.entries(C.market.cooldownSecondsByMk).map(([k,v])=>[k,Number(v)])),
    commissionByMk:Object.fromEntries(Object.entries(C.market.commissionByMk).map(([k,v])=>[k,n(v)])),
    demandRange:(C.market.demandRange||['0.8','1.2']).map(n),demandPeriodSeconds:Number(C.market.demandPeriodSeconds||21600),saturationFloor:n(C.market.saturationFloor)
  };

  D.firstOrbit={
    enabled:true,startingCredits:n(C.rules.startingCredits),creditUnlockTechnology:C.rules.marketUnlockTechnology,
    foundingContracts:(C.contracts||[]).map(x=>({id:x.id,name:x.name,requires:mapNumbers(x.requires),creditReward:n(x.creditReward),prerequisites:[...(x.prerequisites||[])],marketModifiersApply:!!x.marketModifiersApply})),
    resourceDiscovery:JSON.parse(JSON.stringify(C.resourceDiscovery||{})),starterPackage:JSON.parse(JSON.stringify(C.balanceP1?.starterPackage||{})),
    operationDurations:JSON.parse(JSON.stringify(C.balanceP1?.operationDurations||{})),mkRules:JSON.parse(JSON.stringify(C.balanceP1?.mkRules||{})),
    prototypeSatelliteId:'prototypeMarketSatellite',marketSatelliteId:'marketSatellite',prototypeTechnology:'prototypeOrbitalTrade',marketTechnology:'marketNetworkMk1',
    foundingGuaranteedCredits:n(C.rules.foundingContractGuaranteedCredits),marketMk1CreditCost:n(C.rules.marketMk1CreditCost),minimumPostMarketCredits:n(C.rules.minimumPostMarketCredits)
  };

  // The first six quests teach material production. Credits do not exist before
  // the prototype satellite; rewards therefore remain physical/data rewards.
  D.quests=[
    {id:'q1',type:'itemProduced',item:'ironOre',target:40,desc:'40 Demir Cevheri üret',reward:{ironPlate:10}},
    {id:'q2',type:'buildCount',target:3,desc:'3 üretim yapısı kur',reward:{gear:12,copperPlate:8}},
    {id:'q3',type:'itemProduced',item:'alphaCore',target:15,desc:'15 Alfa Veri üret',reward:{alphaCore:10}},
    {id:'q4',type:'research',target:1,desc:'İlk araştırmanı tamamla',reward:{steel:12}},
    {id:'q5',type:'powerBuilt',target:1,desc:'Kalıcı güç santrali kur',reward:{circuit:8}},
    {id:'q6',type:'landExpand',target:1,desc:'Sektör Tarama Modülü ile yeni bölge aç',reward:{betaCore:20}},
    {id:'q7',type:'marketDispatch',target:1,desc:'İlk kuruluş sözleşmesini teslim et',reward:{betaCore:20}},
    {id:'q8',type:'buildingLevel',target:2,desc:'Bir bina sınıfını Mk II yap',reward:{gammaCore:15}},
    {id:'q9',type:'scan',target:1,desc:'Bir yıldız sistemi keşfet',reward:{deltaCore:15}},
    {id:'q10',type:'battleWin',target:1,desc:'İlk uzay savaşını kazan',reward:{omegaCore:10}}
  ];

  D.resourceNodes=Object.fromEntries(Object.entries(D.items).filter(([,x])=>x.category==='raw').map(([id,x])=>[id,Object.assign({},D.resourceNodes?.[id]||{}, {icon:x.icon,name:`${x.name} Yatağı`,color:D.resourceNodes?.[id]?.color||'#94a3b8',rarity:D.resourceNodes?.[id]?.rarity||1})]));
  for(const id of C.resourceDiscovery?.startingNodes||[])if(D.resourceNodes[id])D.resourceNodes[id].guaranteedStart=true;
  D.game={title:'Axyon Idle Factory: First Orbit & Dominion — U2 First Orbit',version:'4.4.0-u2',world:'Kestros İmparatorluğu'};
  D.resource={id:'credit',name:'Kredi',symbol:'🪙',lockedUntil:D.firstOrbit.creditUnlockTechnology};
  D.map.size=Number(C.rules.worldSize||300);D.map.sectorSize=Number(C.rules.chunkSize||20);D.map.openBaseCost=0;D.map.openGrowth=1;
  D.economyConfig.basePower=0;
  D.canonicalVersion=C.meta?.balanceVersion||C.meta?.designVersion||'4.4.0';
  D.localSellingEnabled=false;
  Object.freeze(D.firstOrbit.foundingContracts);
})(typeof window!=='undefined'?window:globalThis);
