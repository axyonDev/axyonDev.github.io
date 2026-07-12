/** AXYON: Orbital Ascendancy v4.4 U3 — capacity, orbital load and cohort defense runtime. */
(function(global){
  'use strict';
  const A=global.Axyon=global.Axyon||{},Base=A.Economy,D=A.Data,U=D.u3,N=A.Numbers,EN=A.EconomyNumber,C=A.Canonical;
  if(!Base||!U||!C)throw new Error('U3 runtime dependencies missing');
  const old={
    createInitialState:Base.createInitialState,normalizeState:Base.normalizeState,tick:Base.tick,applyOfflineProgress:Base.applyOfflineProgress,
    canBuild:Base.canBuild,canBuildPlant:Base.canBuildPlant,placeMachine:Base.placeMachine,placePlant:Base.placePlant,
    buildMachine:Base.buildMachine,buildPlant:Base.buildPlant,capacityStatus:Base.capacityStatus,defenseStats:Base.defenseStats,
    canBuildDefense:Base.canBuildDefense,buildDefense:Base.buildDefense,queueShip:Base.queueShip,canBuildSatellite:Base.canBuildSatellite,queueSatellite:Base.queueSatellite,removeEntity:Base.removeEntity,researchUnlocks:Base.researchUnlocks
  };
  const now=()=>Date.now(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=v=>Number(v||0),int=(v,d=0)=>Math.max(0,Math.floor(Number(v??d)||0));
  const dec=v=>EN.safe(v||0),gte=(a,b)=>EN.gte(a,b),sub=(a,b)=>EN.sub(a,b),add=(a,b)=>EN.add(a,b),mul=(a,b)=>EN.mul(a,b);
  const openSectors=s=>Base.openSectorList(s).length;
  const planetDef=s=>U.planetOverrides[s.planet?.type||'temperate']||U.planetOverrides.temperate;
  const canonicalMachine=id=>C.indexes.machines[id]||C.indexes.powerPlants[id]||null;
  const defenseDef=id=>U.defenses.find(x=>x.id===id)||null;
  const complexDef=id=>U.defenseComplexes.find(x=>x.id===id)||null;
  const shipCanonical=id=>C.indexes.ships[id]||null;
  const satelliteCanonical=id=>C.indexes.satellites[id]||null;
  const clone=o=>JSON.parse(JSON.stringify(o));

  function defaultPlanetary(){
    return{
      infrastructureLevel:1,orbitalLevel:0,commandLevel:0,
      assets:{coolingHub:0,maintenanceDepot:0,commandArray:0,orbitalControlNode:0},
      complexes:{surfaceDefenseComplex:{count:1,mk:1},orbitalDefenseRing:{count:0,mk:1}},
      defenseCohorts:Object.fromEntries(U.defenses.map(x=>[x.id,0])),legacyMapped:false,legacyOverflow:false,
      lastCapacityWarning:'',lastUpdatedAt:now()
    };
  }
  function ensureState(s,raw){
    const defaults=defaultPlanetary(),p=(s.planetary&&typeof s.planetary==='object')?s.planetary:{};
    for(const [k,v] of Object.entries(defaults))if(p[k]===undefined)p[k]=clone(v);
    p.assets=Object.assign({},defaults.assets,p.assets||{});
    p.complexes=Object.assign({},defaults.complexes,p.complexes||{});
    for(const id of Object.keys(p.complexes))p.complexes[id]=Object.assign({count:0,mk:1},p.complexes[id]||{});
    p.defenseCohorts=Object.assign(defaultPlanetary().defenseCohorts,p.defenseCohorts||{});
    p.infrastructureLevel=clamp(int(p.infrastructureLevel,1),1,U.maxLevels.infrastructure);
    p.orbitalLevel=clamp(int(p.orbitalLevel,0),0,U.maxLevels.orbital);
    p.commandLevel=clamp(int(p.commandLevel,0),0,U.maxLevels.command);
    for(const k of Object.keys(p.assets))p.assets[k]=int(p.assets[k]);
    for(const [id,c] of Object.entries(p.complexes)){c.count=int(c.count);c.mk=clamp(int(c.mk,1),1,5);}
    if(!p.legacyMapped){
      for(const [from,to] of Object.entries(U.legacyDefenseMap)){
        const n=int(s.galaxy?.defenses?.[from]);if(n){p.defenseCohorts[to]=(p.defenseCohorts[to]||0)+n;s.galaxy.defenses[from]=0;}
      }
      p.legacyMapped=true;
    }
    for(const d of U.defenses){
      const existing=Math.max(int(p.defenseCohorts[d.id]),int(s.galaxy?.defenses?.[d.id]));
      p.defenseCohorts[d.id]=existing;s.galaxy.defenses[d.id]=existing;
      s.maintenance.damagedDefenses[d.id]=int(s.maintenance.damagedDefenses[d.id]);
    }
    s.planetary=p;
    return s;
  }
  function refreshLegacyOverflow(s){const over=!capacityStatusRaw(s).ok;s.planetary.legacyOverflow=over;return over;}
  function createInitialState(options){const s=old.createInitialState(options);ensureState(s,{});refreshLegacyOverflow(s);return s;}
  function normalizeState(raw){const s=old.normalizeState(raw);ensureState(s,raw||{});refreshLegacyOverflow(s);return s;}

  function complexState(s,id){return s.planetary.complexes[id]||(s.planetary.complexes[id]={count:0,mk:1});}
  function complexCapacity(s,klass,placement='surface'){
    let cap=0;
    for(const def of U.defenseComplexes){if(def.placement!==placement)continue;const cs=complexState(s,def.id),arr=def.capacityByMk?.[klass]||[];cap+=cs.count*Number(arr[Math.max(0,cs.mk-1)]||0);}
    return cap;
  }
  function surfaceComplexLimit(s){return Math.min(U.capacity.maxSurfaceComplexesHardCap,Math.max(1,Math.ceil(openSectors(s)/U.capacity.surfaceComplexSectorsPerSlot)));}
  function orbitalRingLimit(s){return Math.min(5,Math.max(0,Math.floor((s.planetary.orbitalLevel+2)/3)));}
  function entityUsage(s){
    let surface=0,infra=0,heat=0,maintenance=0;
    for(const e of Object.values(s.grid.entities||{})){
      const d=canonicalMachine(e.defId),cells=Number(d?.footprint?.cells||Base.entityFootprintCells(e.defId,e.type)**2||1);
      surface+=Number(d?.footprint?.surfaceAreaM2||cells*U.capacity.gridCellAreaM2);
      infra+=Number(d?.planetInfrastructureLoad||1);heat+=Number(d?.heatOutput||0);maintenance+=Number(d?.maintenanceDemand||0);
    }
    return{surface,infra,heat,maintenance};
  }
  function defenseUsage(s){
    let surface=0,infra=0,orbitalMass=0,command=0,power=0,heat=0,maintenance=0,ammoPerRound=0,total=0,normal=0;
    for(const d of U.defenses){const n=int(s.planetary.defenseCohorts[d.id]);if(!n)continue;total+=n;if(d.id!=='emergencyBarrier')normal+=n;surface+=d.surfaceAreaPerUnitM2*n;infra+=d.planetInfrastructureLoad*n;orbitalMass+=d.orbitalMassLoad*n;command+=d.commandLoad*n;power+=d.powerDemand*n;heat+=d.heatOutputPerUnit*n;maintenance+=d.maintenancePerUnit*n;if(d.ammoItem)ammoPerRound+=d.ammoPerRound*n;}
    for(const def of U.defenseComplexes){const cs=complexState(s,def.id),i=Math.max(0,cs.mk-1);surface+=Number(def.footprint?.surfaceAreaM2||0)*cs.count;infra+=Number(def.planetInfrastructureLoadByMk?.[i]||0)*cs.count;orbitalMass+=Number(def.orbitalMassLoadByMk?.[i]||0)*cs.count;}
    return{surface,infra,orbitalMass,command,power,heat,maintenance,ammoPerRound,total,normal};
  }
  function assetUsage(s){
    let surface=0,infra=0,orbitalMass=0,slots=0,command=0,power=0,heat=0,maintenance=0,heatDissipation=0,maintenanceCapacity=0,orbitalMassCapacity=0,orbitalSlotCapacity=0,commandCapacity=0;
    for(const [id,n0] of Object.entries(s.planetary.assets||{})){const n=int(n0),d=U.infrastructureAssets[id];if(!d||!n)continue;surface+=num(d.surfaceAreaM2)*n;infra+=num(d.planetInfrastructureLoad)*n;orbitalMass+=num(d.orbitalMassLoad)*n;slots+=num(d.orbitalSlots)*n;command+=num(d.commandLoad)*n;power+=num(d.powerDemand)*n;heat+=num(d.heatOutput)*n;maintenance+=num(d.maintenanceDemand)*n;heatDissipation+=num(d.heatDissipation)*n;maintenanceCapacity+=num(d.maintenanceCapacity)*n;orbitalMassCapacity+=num(d.orbitalMassCapacity)*n;orbitalSlotCapacity+=num(d.orbitalSlotCapacity)*n;commandCapacity+=num(d.commandCapacity)*n;}
    return{surface,infra,orbitalMass,slots,command,power,heat,maintenance,heatDissipation,maintenanceCapacity,orbitalMassCapacity,orbitalSlotCapacity,commandCapacity};
  }
  function orbitalUsage(s){
    let mass=0,slots=0,command=0;
    for(const d of D.ships){const c=shipCanonical(d.id),atBase=int(s.galaxy.ships[d.id])+int(s.maintenance.damagedShips[d.id]);mass+=atBase*num(c?.orbitalMassLoad??d.orbitalMassLoad??d.commandLoad??1);command+=atBase*num(c?.commandLoad??d.commandLoad??1);if(atBase)slots+=1;}
    for(const m of s.galaxy.missions||[])for(const d of D.ships){const c=shipCanonical(d.id),n=int(m.ships?.[d.id])+int(m.damagedShips?.[d.id]);mass+=n*num(c?.orbitalMassLoad??d.commandLoad??1);command+=n*num(c?.commandLoad??d.commandLoad??1);}
    for(const q of s.galaxy.shipQueue||[]){const c=shipCanonical(q.shipId),n=int(q.count);mass+=n*num(c?.orbitalMassLoad||1);command+=n*num(c?.commandLoad||1);}
    for(const [id,n0] of Object.entries(s.galaxy.satellites||{})){const n=int(n0),c=satelliteCanonical(id);if(!c||!n)continue;mass+=n*num(c.orbitalMassLoad);command+=n*num(c.commandLoad);slots+=n;}
    for(const q of s.galaxy.satelliteQueue||[]){const c=satelliteCanonical(q.satelliteId),n=int(q.count);if(c){mass+=n*num(c.orbitalMassLoad);command+=n*num(c.commandLoad);slots+=n;}}
    return{mass,slots,command};
  }
  function capacityStatus(s){
    ensureState(s,s);const pt=planetDef(s),sec=openSectors(s),eu=entityUsage(s),du=defenseUsage(s),au=assetUsage(s),ou=orbitalUsage(s);
    const surfaceMax=sec*U.capacity.sectorCells*U.capacity.gridCellAreaM2*num(pt.surfaceAreaMultiplier);
    const infrastructureMax=sec*U.capacity.planetInfrastructurePerSector*num(pt.infrastructureMultiplier)*(1+s.planetary.infrastructureLevel*U.capacity.infrastructureResearchGrowthPerLevel);
    const orbitalMassMax=(U.capacity.baseOrbitalMass+s.planetary.orbitalLevel*U.capacity.orbitalMassPerResearchLevel+au.orbitalMassCapacity)*num(pt.orbitalMassMultiplier);
    const orbitalSlotsMax=U.capacity.baseOrbitalSlots+s.planetary.orbitalLevel*U.capacity.orbitalSlotsPerResearchLevel+au.orbitalSlotCapacity;
    const commandMax=U.capacity.baseCommandCapacity+s.planetary.commandLevel*U.capacity.commandCapacityPerResearchLevel+au.commandCapacity;
    const heatMax=sec*U.capacity.baseHeatDissipationPerSector*num(pt.heatDissipationMultiplier)+au.heatDissipation;
    const maintenanceMax=sec*U.capacity.baseMaintenanceCapacityPerSector*num(pt.maintenanceMultiplier)+au.maintenanceCapacity;
    const powerDemand=num(s._power?.demand)+du.power+au.power,powerSupply=num(s._power?.supply);
    const out={
      surface:{used:eu.surface+du.surface+au.surface,max:surfaceMax},
      planet:{used:eu.infra+du.infra+au.infra,max:infrastructureMax},
      orbitalMass:{used:du.orbitalMass+au.orbitalMass+ou.mass,max:orbitalMassMax},
      orbitalSlots:{used:au.slots+ou.slots,max:orbitalSlotsMax},
      command:{used:du.command+au.command+ou.command,max:commandMax},
      heat:{used:eu.heat+du.heat+au.heat,max:heatMax},
      maintenance:{used:eu.maintenance+du.maintenance+au.maintenance,max:maintenanceMax},
      power:{used:powerDemand,max:powerSupply},
      fleet:{used:du.command+au.command+ou.command,max:commandMax},
      defense:{used:du.total,max:Math.max(1,['micro','light','medium','heavy','strategic'].reduce((n,k)=>n+complexCapacity(s,k,'surface')+complexCapacity(s,k,'orbital'),0)+(du.normal>0?Math.max(1,Math.floor(du.normal*0.05)):100))},
      marketSatellites:{used:Base.marketSatelliteCount(s),max:Base.marketSatelliteLimit(s)},
      legacyOverflow:!!s.planetary.legacyOverflow
    };
    out.ok=Object.entries(out).filter(([,v])=>v&&typeof v==='object'&&'used'in v).every(([,v])=>v.used<=v.max+1e-9);
    if(s.planetary.legacyOverflow&&out.ok)s.planetary.legacyOverflow=false;
    out.legacyOverflow=!!s.planetary.legacyOverflow;
    return out;
  }
  function isOverCapacity(s){try{const c=capacityStatusRaw(s);return !c.ok;}catch(_){return false;}}
  function capacityStatusRaw(s){const prev=s.planetary?.legacyOverflow;if(s.planetary)s.planetary.legacyOverflow=false;const c=capacityStatus(s);if(s.planetary)s.planetary.legacyOverflow=prev;return c;}
  function projectedFits(s,delta,maxDelta){const c=capacityStatus(s),gains=maxDelta||{};for(const [k,v] of Object.entries(delta||{})){if(c[k]&&c[k].used+num(v)>c[k].max+num(gains[k])+1e-9)return false;}for(const [k,gain] of Object.entries(gains)){if(c[k]&&c[k].used+num(delta?.[k])>c[k].max+num(gain)+1e-9)return false;}return true;}
  function legacyBlocked(s){if(!s.planetary.legacyOverflow)return false;return refreshLegacyOverflow(s);}
  function machineDelta(id,type){const d=canonicalMachine(id),cells=Number(d?.footprint?.cells||Base.entityFootprintCells(id,type)**2||1);return{surface:Number(d?.footprint?.surfaceAreaM2||cells*U.capacity.gridCellAreaM2),planet:Number(d?.planetInfrastructureLoad||1),heat:Number(d?.heatOutput||0),maintenance:Number(d?.maintenanceDemand||0)};}
  function canBuild(s,id){const d=Base.mDef(id);return !!d&&!legacyBlocked(s)&&projectedFits(s,machineDelta(id,'machine'))&&Base.isMachineUnlocked(s,id)&&Base._u2.hasItems(s,Base.buildRequirements(s,id))&&(!Base.isExtractor(id)||Base.hasFreeNodeFor(s,id));}
  function buildMachine(s,id){if(!canBuild(s,id)||!Base._u2.spendItems(s,Base.buildRequirements(s,id)))return false;s.machines[id].count++;s.stats.machinesBuilt++;if(s.machines[id].automationLevel<1){s.machines[id].automationLevel=1;s.machines[id].hasManager=true;}return true;}
  function canBuildPlant(s,id){const d=Base.pDef(id);return !!d&&!legacyBlocked(s)&&projectedFits(s,machineDelta(id,'plant'))&&Base.isPlantUnlocked(s,id)&&Base._u2.hasItems(s,Base.plantBuildRequirements(s,id));}
  function buildPlant(s,id){if(!canBuildPlant(s,id)||!Base._u2.spendItems(s,Base.plantBuildRequirements(s,id)))return false;s.plants[id].count++;s.stats.plantsBuilt++;if(s.firstOrbit)s.firstOrbit.landingReactorActive=false;return true;}
  function placeMachine(s,id,x,y){if(!Base.canPlaceAt(s,id,'machine',x,y)||!buildMachine(s,id))return null;const eid='e'+s.grid.nextId++;s.grid.entities[eid]={id:eid,type:'machine',defId:id,x,y};refreshLegacyOverflow(s);return eid;}
  function placePlant(s,id,x,y){if(!Base.canPlaceAt(s,id,'plant',x,y)||!buildPlant(s,id))return null;const eid='e'+s.grid.nextId++;s.grid.entities[eid]={id:eid,type:'plant',defId:id,x,y};refreshLegacyOverflow(s);return eid;}
  function removeEntity(s,id){const ok=old.removeEntity(s,id);if(ok){ensureState(s,s);refreshLegacyOverflow(s);}return ok;}


  function defenseCapacityFor(s,d){if(d.placement==='orbital')return complexCapacity(s,d.defenseClass,'orbital');if(d.defenseClass==='failsafe')return num(d.maxCountPerComplex)*complexState(s,'surfaceDefenseComplex').count;if(d.placement==='cohort')return Math.min(complexCapacity(s,d.defenseClass,'surface'),d.maxCountPerComplex==null?Infinity:d.maxCountPerComplex*complexState(s,'surfaceDefenseComplex').count);return d.defenseClass==='strategic'?complexCapacity(s,'strategic','surface'):complexCapacity(s,'heavy','surface');}
  function defenseBuildCost(d,count){return Object.fromEntries(Object.entries(d.cost||{}).map(([k,v])=>[k,mul(v,count)]));}
  function canBuildDefense(s,id,count=1){
    ensureState(s,s);const d=defenseDef(id);count=clamp(int(count,1),1,2000000);if(!d||d.legacy||(d.tech&&!s.researched[d.tech]))return false;
    const current=int(s.planetary.defenseCohorts[id]);if(current+count>defenseCapacityFor(s,d))return false;
    if(id==='emergencyBarrier'){
      const normal=defenseUsage(s).normal,max=normal>0?Math.max(1,Math.floor(normal*d.maxDefenseShare)):100;if(current+count>max)return false;
    }
    const delta={surface:d.surfaceAreaPerUnitM2*count,planet:d.planetInfrastructureLoad*count,orbitalMass:d.orbitalMassLoad*count,command:d.commandLoad*count,heat:d.heatOutputPerUnit*count,maintenance:d.maintenancePerUnit*count,power:d.powerDemand*count};
    if(!projectedFits(s,delta))return false;
    const cost=defenseBuildCost(d,count);return Object.entries(cost).every(([k,v])=>gte(s.inventory[k]||0,v));
  }
  function buildDefense(s,id,count=1){const d=defenseDef(id);count=clamp(int(count,1),1,2000000);if(!canBuildDefense(s,id,count))return false;const cost=defenseBuildCost(d,count);if(!Base._u2.spendItems(s,cost))return false;s.planetary.defenseCohorts[id]=(s.planetary.defenseCohorts[id]||0)+count;s.galaxy.defenses[id]=s.planetary.defenseCohorts[id];s.planetary.lastUpdatedAt=now();return true;}
  function defenseOperational(s,d,status){if(d.id==='emergencyBarrier')return 1;const power=status.power.used?clamp(status.power.max/status.power.used,0,1):1,heat=status.heat.used?clamp(status.heat.max/status.heat.used,0,1):1,maint=status.maintenance.used?clamp(status.maintenance.max/status.maintenance.used,0,1):1;let ammo=1;if(d.ammoItem){const need=d.ammoPerRound*int(s.planetary.defenseCohorts[d.id]);ammo=need?clamp(EN.toSafeNumber(s.inventory[d.ammoItem]||0,1e15)/need,0,1):1;}return Math.min(power,heat,maint,ammo);}
  function defenseStats(s){const status=capacityStatus(s);let attack=0,hull=0,operational=0,total=0,leakReduction=0,ammoNeed=0;const byType={};for(const d of U.defenses){const n=int(s.planetary.defenseCohorts[d.id]);if(!n)continue;const ratio=defenseOperational(s,d,status),active=n*ratio;total+=n;operational+=active;attack+=active*d.attack;hull+=active*d.hull;ammoNeed+=active*d.ammoPerRound;leakReduction+=n*d.leakReduction;byType[d.id]={count:n,operational:active,ratio};}return{attack,hull,operational,total,operationalRatio:total?operational/total:1,leakReduction:Math.min(U.battle.emergencyBarrierLeakReductionCap,leakReduction),ammoNeed,byType,status};}

  function complexCost(id,mk,count=1){const orbital=id==='orbitalDefenseRing',factor=Math.pow(2.1,Math.max(0,mk-1))*count;return orbital?{titaniumPlate:dec(Math.ceil(45*factor)),orbitalParts:dec(Math.ceil(30*factor)),electronics:dec(Math.ceil(20*factor))}:{steel:dec(Math.ceil(80*factor)),frame:dec(Math.ceil(25*factor)),circuit:dec(Math.ceil(30*factor))};}
  function canBuildComplex(s,id){const d=complexDef(id);if(!d||(d.technology&&!s.researched[d.technology]))return false;const cs=complexState(s,id),limit=id==='surfaceDefenseComplex'?surfaceComplexLimit(s):orbitalRingLimit(s);if(cs.count>=limit)return false;const cost=complexCost(id,1,1);const delta=id==='surfaceDefenseComplex'?{surface:num(d.footprint?.surfaceAreaM2),planet:num(d.planetInfrastructureLoadByMk?.[0])}:{orbitalMass:num(d.orbitalMassLoadByMk?.[0]),orbitalSlots:1};return projectedFits(s,delta)&&Object.entries(cost).every(([k,v])=>gte(s.inventory[k]||0,v));}
  function buildComplex(s,id){if(!canBuildComplex(s,id))return false;const cost=complexCost(id,1,1);if(!Base._u2.spendItems(s,cost))return false;complexState(s,id).count++;return true;}
  function canUpgradeComplex(s,id){const d=complexDef(id),cs=complexState(s,id);if(!d||cs.count<1||cs.mk>=5||(d.technology&&!s.researched[d.technology]))return false;const i=Math.max(0,cs.mk-1),j=i+1,delta=id==='surfaceDefenseComplex'?{planet:(num(d.planetInfrastructureLoadByMk?.[j])-num(d.planetInfrastructureLoadByMk?.[i]))*cs.count}:{orbitalMass:(num(d.orbitalMassLoadByMk?.[j])-num(d.orbitalMassLoadByMk?.[i]))*cs.count};const cost=complexCost(id,cs.mk+1,cs.count);return projectedFits(s,delta)&&Object.entries(cost).every(([k,v])=>gte(s.inventory[k]||0,v));}
  function upgradeComplex(s,id){if(!canUpgradeComplex(s,id))return false;const cs=complexState(s,id),cost=complexCost(id,cs.mk+1,cs.count);if(!Base._u2.spendItems(s,cost))return false;cs.mk++;return true;}

  function capacityUpgradeCost(s,kind){const key=kind==='infrastructure'?'infrastructureLevel':kind==='orbital'?'orbitalLevel':'commandLevel',lv=int(s.planetary[key]),target=lv+1,max=U.maxLevels[kind];if(target>max)return null;const f=Math.pow(1.72,lv),items=kind==='infrastructure'?{steel:dec(Math.ceil(80*f)),machinery:dec(Math.ceil(15*f)),circuit:dec(Math.ceil(20*f))}:kind==='orbital'?{titaniumPlate:dec(Math.ceil(40*f)),orbitalParts:dec(Math.ceil(20*f)),electronics:dec(Math.ceil(18*f))}:{electronics:dec(Math.ceil(35*f)),processor:dec(Math.ceil(20*f)),quantumCore:dec(Math.ceil(4*f))};return{target,items,tech:U.upgradeTech[kind]};}
  function canUpgradeCapacity(s,kind){const c=capacityUpgradeCost(s,kind);return !!c&&(!c.tech||s.researched[c.tech])&&Object.entries(c.items).every(([k,v])=>gte(s.inventory[k]||0,v));}
  function upgradeCapacity(s,kind){if(!canUpgradeCapacity(s,kind))return false;const c=capacityUpgradeCost(s,kind);if(!Base._u2.spendItems(s,c.items))return false;const key=kind==='infrastructure'?'infrastructureLevel':kind==='orbital'?'orbitalLevel':'commandLevel';s.planetary[key]=c.target;refreshLegacyOverflow(s);return true;}
  function assetCost(id,count=1){const f=Math.pow(1.55,int(count)),base={coolingHub:{steel:40,circuit:15,machinery:8},maintenanceDepot:{steel:55,repairKit:12,machinery:10},commandArray:{electronics:20,processor:12,steel:35},orbitalControlNode:{titaniumPlate:25,orbitalParts:20,electronics:18}}[id]||{};return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,dec(Math.ceil(v*f))]));}
  function canBuildAsset(s,id){const d=U.infrastructureAssets[id];if(!d||(d.tech&&!s.researched[d.tech]))return false;const cost=assetCost(id,s.planetary.assets[id]);const delta={surface:num(d.surfaceAreaM2),planet:num(d.planetInfrastructureLoad),orbitalMass:num(d.orbitalMassLoad),orbitalSlots:num(d.orbitalSlots),command:num(d.commandLoad),heat:num(d.heatOutput),maintenance:num(d.maintenanceDemand),power:num(d.powerDemand)},gains={heat:num(d.heatDissipation),maintenance:num(d.maintenanceCapacity),orbitalMass:num(d.orbitalMassCapacity),orbitalSlots:num(d.orbitalSlotCapacity),command:num(d.commandCapacity)};return projectedFits(s,delta,gains)&&Object.entries(cost).every(([k,v])=>gte(s.inventory[k]||0,v));}
  function buildAsset(s,id){if(!canBuildAsset(s,id))return false;const cost=assetCost(id,s.planetary.assets[id]);if(!Base._u2.spendItems(s,cost))return false;s.planetary.assets[id]++;return true;}

  function canBuildShip(s,id,count=1){const d=D.ships.find(x=>x.id===id),c=shipCanonical(id),n=clamp(int(count,1),1,9999);if(!d||!c||(d.tech&&!s.researched[d.tech]))return false;if(!projectedFits(s,{orbitalMass:num(c.orbitalMassLoad)*n,command:num(c.commandLoad)*n}))return false;return Object.entries(d.cost||{}).every(([k,v])=>gte(s.inventory[k]||0,mul(v,n)));}
  function queueShip(s,id,count=1){const d=D.ships.find(x=>x.id===id),n=clamp(int(count,1),1,9999);if(!canBuildShip(s,id,n)||!Base._u2.spendItems(s,Object.fromEntries(Object.entries(d.cost||{}).map(([k,v])=>[k,mul(v,n)]))))return false;const last=s.galaxy.shipQueue[s.galaxy.shipQueue.length-1],start=Math.max(now(),last?.finishAt||0);s.galaxy.shipQueue.push({id:'u3sq-'+now()+'-'+Math.random().toString(36).slice(2),shipId:id,count:n,finishAt:start+num(d.buildSec||60)*n*1000});return true;}

  function satelliteQueued(s,id){return (s.galaxy.satelliteQueue||[]).filter(q=>q.satelliteId===id).reduce((n,q)=>n+int(q.count),0);}
  function canBuildSatellite(s,id,count=1){const d=Base.satelliteDef(id),c=satelliteCanonical(id),n=clamp(int(count,1),1,99);if(!d||!c||(d.tech&&!s.researched[d.tech]))return false;const existing=int(s.galaxy.satellites?.[id])+satelliteQueued(s,id);if(c.maxCount!=null&&existing+n>int(c.maxCount))return false;if((id==='prototypeMarketSatellite'||id==='marketSatellite')&&Base.marketSatelliteCount(s)+satelliteQueued(s,'prototypeMarketSatellite')+satelliteQueued(s,'marketSatellite')+n>Base.marketSatelliteLimit(s))return false;if(!projectedFits(s,{orbitalMass:num(c.orbitalMassLoad)*n,orbitalSlots:n,command:num(c.commandLoad)*n}))return false;return Object.entries(d.cost||{}).every(([k,v])=>gte(s.inventory[k]||0,mul(v,n)));}
  function queueSatellite(s,id,count=1){const d=Base.satelliteDef(id),n=clamp(int(count,1),1,99);if(!canBuildSatellite(s,id,n)||!Base._u2.spendItems(s,d.cost,n))return false;const last=s.galaxy.satelliteQueue[s.galaxy.satelliteQueue.length-1],start=Math.max(now(),last?.finishAt||0);s.galaxy.satelliteQueue.push({id:'u3sat-'+now()+'-'+Math.random().toString(36).slice(2),satelliteId:id,count:n,startedAt:start,finishAt:start+num(d.buildSec||120)*n*1000});s.galaxy.satelliteQueue.sort((a,b)=>a.finishAt-b.finishAt);return true;}

  function researchUnlocks(id){
    const out=old.researchUnlocks?old.researchUnlocks(id):[];
    for(const [key,d] of Object.entries(U.infrastructureAssets||{}))if(d.tech===id)out.push(`🏗️ ${d.name}: ${key==='coolingHub'?'ısı kapasitesini':key==='maintenanceDepot'?'bakım kapasitesini':key==='commandArray'?'komuta kapasitesini':'yörünge kütle ve slot kapasitesini'} artırır`);
    for(const d of U.defenseComplexes||[])if(d.technology===id)out.push(`${d.placement==='orbital'?'🛡️':'🏰'} ${d.name}: Mk I–V savunma cohort kapasitesi`);
    for(const [kind,tech] of Object.entries(U.upgradeTech||{}))if(tech===id)out.push(kind==='infrastructure'?'🌍 Gezegen altyapı kapasitesi Sv. 1–10':kind==='orbital'?'🛰️ Yörünge kütle ve slot kapasitesi Sv. 1–10':'🎛️ Filo ve savunma komuta kapasitesi Sv. 1–15');
    return[...new Set(out)];
  }

  function productionCapacityRatio(s){const c=capacityStatus(s),ratio=x=>x.used>0?clamp(x.max/x.used,0,1):1;return Math.min(1,ratio(c.planet),ratio(c.heat),ratio(c.maintenance));}
  function tick(s,dt,t=now()){
    const raidDue=Number(s.galaxy?.nextRaidAt||0)<=t,original={},ratios={},beforePlay=num(s.stats?.playTimeSec),capacityRatio=productionCapacityRatio(s);
    if(raidDue){const ds=defenseStats(s);for(const d of U.defenses){const total=int(s.planetary.defenseCohorts[d.id]);original[d.id]=total;ratios[d.id]=ds.byType[d.id]?.ratio??1;s.galaxy.defenses[d.id]=Math.floor(total*ratios[d.id]);}}
    const result=old.tick(s,Math.max(0,dt)*capacityRatio,t);
    s.stats.playTimeSec=beforePlay+Math.max(0,dt);s._capacityEfficiency=capacityRatio;ensureState(s,s);
    if(raidDue){for(const d of U.defenses){const before=int(original[d.id]),effectiveBefore=Math.floor(before*ratios[d.id]),effectiveAfter=int(s.galaxy.defenses[d.id]),lost=Math.max(0,effectiveBefore-effectiveAfter);s.planetary.defenseCohorts[d.id]=Math.max(0,before-lost);s.galaxy.defenses[d.id]=s.planetary.defenseCohorts[d.id];}}
    s.planetary.lastUpdatedAt=t;return result;
  }
  function applyOfflineProgress(s){const out=old.applyOfflineProgress(s);ensureState(s,s);return out;}

  Object.assign(Base,{
    createInitialState,normalizeState,capacityStatus,canBuild,buildMachine,canBuildPlant,buildPlant,placeMachine,placePlant,removeEntity,
    canBuildDefense,buildDefense,defenseStats,canBuildShip,queueShip,canBuildSatellite,queueSatellite,tick,applyOfflineProgress,
    defenseDefU3:defenseDef,complexDef,complexState,complexCapacity,surfaceComplexLimit,orbitalRingLimit,
    canBuildComplex,buildComplex,canUpgradeComplex,upgradeComplex,complexCost,
    capacityUpgradeCost,canUpgradeCapacity,upgradeCapacity,assetCost,canBuildAsset,buildAsset,researchUnlocks,
    defenseOperational,projectedFits,productionCapacityRatio,
    _u3:{ensureState,refreshLegacyOverflow,entityUsage,defenseUsage,assetUsage,orbitalUsage,capacityStatusRaw,defenseCapacityFor}
  });
  A.Economy=Base;
})(typeof window!=='undefined'?window:globalThis);
