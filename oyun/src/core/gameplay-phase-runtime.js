/**
 * AXYON: Orbital Ascendancy v4.5.5 U4.3.2
 * Power discipline, direct resource placement and deterministic input cancellation.
 */
(function(global){
  'use strict';
  const A=global.Axyon=global.Axyon||{},E=A.Economy,D=A.Data,EN=A.EconomyNumber;
  if(!E||!D||!EN)throw new Error('Gameplay phase runtime requires Economy, Data and EconomyNumber');

  const old={
    createInitialState:E.createInitialState,
    normalizeState:E.normalizeState,
    buildRequirements:E.buildRequirements,
    plantBuildRequirements:E.plantBuildRequirements,
    canBuildPlant:E.canBuildPlant,
    buildPlant:E.buildPlant,
    placePlant:E.placePlant,
    removeEntity:E.removeEntity,
    tick:E.tick,
    applyOfflineProgress:E.applyOfflineProgress,
    operationFeed:E.operationFeed,
    tickGalaxyLegacy:E.tickGalaxyLegacy,
    canScan:E.canScan,
    scanNextTarget:E.scanNextTarget
  };
  const GROUND_BASE_SEC=18*60;
  const GROUND_WARNING_SEC=90;
  const THREAT_MODEL_VERSION=1;
  const BOOTSTRAP_COAL=12;
  const starterTemplate=()=>Object.fromEntries(Object.entries(D.firstOrbit?.starterPackage?.machines||{}).map(([id,n])=>[id,Math.max(0,Math.floor(Number(n)||0))]));
  const starterPlantTemplate=()=>({coalGen:1});
  const now=()=>Date.now();
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const countMachines=s=>D.machines.reduce((n,d)=>n+Number(s.machines?.[d.id]?.count||0),0);
  const countPlants=s=>D.powerPlants.reduce((n,d)=>n+Number(s.plants?.[d.id]?.count||0),0);
  const report=(s,type,title,body,details)=>{
    s.galaxy=s.galaxy||{};s.galaxy.reports=Array.isArray(s.galaxy.reports)?s.galaxy.reports:[];
    const r={id:'phase-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,7),type,title,body,time:now(),details:details||null,read:false};
    s.galaxy.reports.unshift(r);s.galaxy.reports=s.galaxy.reports.slice(0,200);return r;
  };

  function spaceThreatUnlocked(s){
    const sats=s.galaxy?.satellites||{};
    return !!(s.market?.prototypeBuilt||Number(sats.prototypeMarketSatellite||0)>0||Number(sats.marketSatellite||0)>0);
  }
  function factoryStarted(s){return countMachines(s)+countPlants(s)>0;}
  function threatPhase(s){return spaceThreatUnlocked(s)?'space':'ground';}
  function initializeStarterRights(s){
    s.firstOrbit=s.firstOrbit||{};
    s.firstOrbit.starterAllowance=Object.assign(starterTemplate(),s.firstOrbit.starterAllowance||{});
    s.firstOrbit.starterCounts=Object.assign({},s.firstOrbit.starterCounts||{});
    for(const [id,max] of Object.entries(s.firstOrbit.starterAllowance))s.firstOrbit.starterCounts[id]=clamp(Math.floor(Number(s.firstOrbit.starterCounts[id]||0)),0,max);
    s.firstOrbit.starterPlantAllowance=Object.assign(starterPlantTemplate(),s.firstOrbit.starterPlantAllowance||{});
    s.firstOrbit.starterPlantCounts=Object.assign({},s.firstOrbit.starterPlantCounts||{});
    for(const [id,max] of Object.entries(s.firstOrbit.starterPlantAllowance))s.firstOrbit.starterPlantCounts[id]=clamp(Math.floor(Number(s.firstOrbit.starterPlantCounts[id]||0)),0,max);
    s.firstOrbit.landingReactorActive=false;s.firstOrbit.landingReactorPower=0;
    s.firstOrbit.starterApplied=true;
    s.firstOrbit.starterPlacementMode='manual';
    return s;
  }
  function stripAutomaticStarterFactory(s){
    initializeStarterRights(s);
    s.grid.entities={};s.grid.conveyors=[];s.grid.powerLines=[];s.grid.nextId=1;
    for(const d of D.machines){const m=s.machines[d.id];if(!m)continue;m.count=0;m.hasManager=false;m.automationLevel=0;m.eff=0;m.milestoneMult=m.milestoneMult||1;}
    for(const d of D.powerPlants){if(s.plants[d.id])s.plants[d.id].count=0;}
    s.firstOrbit.starterCounts=Object.fromEntries(Object.keys(s.firstOrbit.starterAllowance).map(id=>[id,0]));
    s.firstOrbit.starterPlantCounts=Object.fromEntries(Object.keys(s.firstOrbit.starterPlantAllowance).map(id=>[id,0]));
    s.firstOrbit.landingReactorActive=false;s.firstOrbit.landingReactorPower=0;
    // Finite landing cargo: enough coal to start the first real generator, never free power.
    E._u2.setInv(s,'coal',BOOTSTRAP_COAL);s.firstOrbit.bootstrapCoal=BOOTSTRAP_COAL;
    s.stats.machinesBuilt=0;s.stats.plantsBuilt=0;s.stats.managersBought=0;s.stats.automationUpgrades=0;
    return s;
  }
  function initializeThreatState(s,t=now(),fresh=false){
    s.galaxy=s.galaxy||{};
    if(fresh||Number(s.galaxy.threatModelVersion||0)<THREAT_MODEL_VERSION){
      s.galaxy.threatModelVersion=THREAT_MODEL_VERSION;
      s.galaxy.threatPhase=spaceThreatUnlocked(s)?'space':'ground';
      s.galaxy.spaceDetected=spaceThreatUnlocked(s);
      s.galaxy.groundThreatLevel=Math.max(1,Math.floor(Number(s.galaxy.groundThreatLevel||1)));
      s.galaxy.raidWarningShown=false;
      s.galaxy.nextRaidAt=s.galaxy.spaceDetected?t+D.economyConfig.raidBaseSec*1000:(factoryStarted(s)?t+GROUND_BASE_SEC*1000:0);
      return s;
    }
    s.galaxy.groundThreatLevel=Math.max(1,Math.floor(Number(s.galaxy.groundThreatLevel||1)));
    if(spaceThreatUnlocked(s)&&s.galaxy.threatPhase!=='space'){
      s.galaxy.threatPhase='space';s.galaxy.spaceDetected=true;s.galaxy.raidWarningShown=false;s.galaxy.nextRaidAt=t+D.economyConfig.raidBaseSec*1000;
      report(s,'warning','📡 İlk yörünge izi tespit edildi','İlk orbital varlığımız dış sistemler tarafından algılandı. Bundan sonra tehditler uzaydan gelebilir.',{category:'intel',phase:'space',raidAt:s.galaxy.nextRaidAt});
    }else if(!spaceThreatUnlocked(s)){
      s.galaxy.threatPhase='ground';s.galaxy.spaceDetected=false;
      if(!factoryStarted(s)){s.galaxy.nextRaidAt=0;s.galaxy.raidWarningShown=false;}
      else if(!Number(s.galaxy.nextRaidAt||0)){s.galaxy.nextRaidAt=t+GROUND_BASE_SEC*1000;s.galaxy.raidWarningShown=false;}
    }
    return s;
  }

  function starterFreeRemaining(s,id){
    initializeStarterRights(s);return Math.max(0,Number(s.firstOrbit.starterAllowance[id]||0)-Number(s.firstOrbit.starterCounts[id]||0));
  }
  function starterFreePlantRemaining(s,id){
    initializeStarterRights(s);return Math.max(0,Number(s.firstOrbit.starterPlantAllowance[id]||0)-Number(s.firstOrbit.starterPlantCounts[id]||0));
  }
  function buildRequirements(s,id){if(starterFreeRemaining(s,id)>0)return{};return old.buildRequirements(s,id);}
  function canBuild(s,id){
    const d=E.mDef(id);if(!d||!E.isMachineUnlocked(s,id))return false;
    const cap=E.capacityStatus(s).planet;if(cap.used+(d.load||1)>cap.max)return false;
    if(!E._u2.hasItems(s,buildRequirements(s,id)))return false;
    return !E.isExtractor(id)||E.hasFreeNodeFor(s,id);
  }
  function buildMachine(s,id){
    if(!canBuild(s,id))return false;
    const free=starterFreeRemaining(s,id)>0,cost=buildRequirements(s,id);
    if(!E._u2.spendItems(s,cost))return false;
    const m=s.machines[id];m.count++;s.stats.machinesBuilt++;
    if(m.automationLevel<1){m.automationLevel=1;m.hasManager=true;}
    if(free)s.firstOrbit.starterCounts[id]=(s.firstOrbit.starterCounts[id]||0)+1;
    initializeThreatState(s,now());return true;
  }
  function placeMachine(s,id,x,y){if(!E.canPlaceAt(s,id,'machine',x,y)||!buildMachine(s,id))return null;const eid='e'+s.grid.nextId++;s.grid.entities[eid]={id:eid,type:'machine',defId:id,x,y};return eid;}

  function plantBuildRequirements(s,id){if(starterFreePlantRemaining(s,id)>0)return{};return old.plantBuildRequirements(s,id);}
  function withVirtualPlantCost(s,id,fn){
    const cost=old.plantBuildRequirements(s,id)||{},saved={};
    for(const [k,v] of Object.entries(cost)){saved[k]=E._u2.getInv(s,k);if(EN.lt(saved[k],v))E._u2.setInv(s,k,v);}
    try{return fn();}finally{for(const [k,v] of Object.entries(saved))E._u2.setInv(s,k,v);}
  }
  function canBuildPlant(s,id){
    if(starterFreePlantRemaining(s,id)<=0)return old.canBuildPlant(s,id);
    return withVirtualPlantCost(s,id,()=>old.canBuildPlant(s,id));
  }
  function buildPlant(s,id){
    if(starterFreePlantRemaining(s,id)<=0)return old.buildPlant(s,id);
    if(!canBuildPlant(s,id))return false;
    s.plants[id].count++;s.stats.plantsBuilt++;s.firstOrbit.starterPlantCounts[id]=(s.firstOrbit.starterPlantCounts[id]||0)+1;
    s.firstOrbit.landingReactorActive=false;initializeThreatState(s,now());return true;
  }
  function placePlant(s,id,x,y){if(!E.canPlaceAt(s,id,'plant',x,y)||!buildPlant(s,id))return null;const eid='e'+s.grid.nextId++;s.grid.entities[eid]={id:eid,type:'plant',defId:id,x,y};return eid;}
  function removeEntity(s,id){
    const entity=s.grid?.entities?.[id];if(!entity)return false;
    initializeStarterRights(s);
    if(entity.type==='plant'){
      const plant=s.plants[entity.defId],claimed=Number(s.firstOrbit.starterPlantCounts[entity.defId]||0),isStarter=Number(plant?.count||0)<=claimed;
      if(!isStarter)return old.removeEntity(s,id);
      plant.count=Math.max(0,Number(plant.count||0)-1);s.firstOrbit.starterPlantCounts[entity.defId]=Math.max(0,claimed-1);
      delete s.grid.entities[id];s.grid.conveyors=(s.grid.conveyors||[]).filter(x=>x.from!==id&&x.to!==id);s.grid.powerLines=(s.grid.powerLines||[]).filter(x=>x.from!==id&&x.to!==id);
      if(!factoryStarted(s)){s.galaxy.nextRaidAt=0;s.galaxy.raidWarningShown=false;}return true;
    }
    if(entity.type!=='machine')return old.removeEntity(s,id);
    const m=s.machines[entity.defId],claimed=Number(s.firstOrbit.starterCounts[entity.defId]||0),isStarter=Number(m?.count||0)<=claimed;
    if(!isStarter)return old.removeEntity(s,id);
    m.count=Math.max(0,Number(m.count||0)-1);s.firstOrbit.starterCounts[entity.defId]=Math.max(0,claimed-1);
    delete s.grid.entities[id];s.grid.conveyors=(s.grid.conveyors||[]).filter(x=>x.from!==id&&x.to!==id);s.grid.powerLines=(s.grid.powerLines||[]).filter(x=>x.from!==id&&x.to!==id);
    if(!factoryStarted(s)){s.galaxy.nextRaidAt=0;s.galaxy.raidWarningShown=false;}
    return true;
  }

  function groundSecurityStatus(s){
    const barriers=Number(s.planetary?.defenseCohorts?.emergencyBarrier||0),machines=countMachines(s),plants=countPlants(s),integrity=Number(s.maintenance?.integrity?.planet??100);
    const security=Math.floor(barriers*30+machines*12+plants*24+Number(s.sectorsOpened||0)*10+integrity*.45);
    const level=Math.max(1,Number(s.galaxy?.groundThreatLevel||1)),enemy=Math.floor(55+level*34+machines*5+Number(s.sectorsOpened||0)*16);
    return{security,enemy,barriers,machines,plants,level,ready:security>=enemy};
  }
  function scheduleNextGround(s,t){const level=Math.max(1,Number(s.galaxy.groundThreatLevel||1)),jitter=((Math.floor(t/1000)+level*17)%240);s.galaxy.nextRaidAt=t+(GROUND_BASE_SEC+jitter)*1000;s.galaxy.raidWarningShown=false;}
  function resolveGroundThreat(s,t){
    const status=groundSecurityStatus(s),roll=.92+((Math.floor(Number(s.galaxy.nextRaidAt||t)/1000)%13)/100),won=status.security>=status.enemy*roll;
    let stolen={},lossPct=0,reward={};
    if(won){
      const scrap=Math.max(2,Math.ceil(status.enemy*.045)),gear=Math.max(1,Math.floor(status.level/2));E._u2.addInv(s,'scrapMetal',scrap);E._u2.addInv(s,'gear',gear);reward={scrapMetal:scrap,gear};
      s.stats.raidsWon++;s.galaxy.groundThreatLevel=Math.max(1,status.level-1);
      report(s,'raid-win','🛡️ Yerel saldırı püskürtüldü',`Güvenlik ${status.security} / saldırı ${status.enemy}. Sabotaj timi dağıtıldı; ele geçirilen malzemeler depoya aktarıldı.`,{category:'ground-raid',phase:'ground',outcome:'victory',security:status.security,enemy:status.enemy,reward});
    }else{
      lossPct=clamp(.035+status.level*.006,.04,.12);
      for(const [id,it] of Object.entries(D.items)){
        if(it.research||it.marketPolicy==='protected'||['scrapMetal','wreckCircuit','alienAlloy'].includes(id))continue;
        const current=E._u2.getInv(s,id),amount=EN.toSafeNumber(current,1e12),take=Math.floor(amount*lossPct);if(take<=0)continue;E._u2.setInv(s,id,EN.sub(current,take));stolen[id]=take;
      }
      const damage=clamp(5+status.level*1.5,6,18);s.maintenance.integrity.planet=clamp(Number(s.maintenance.integrity.planet??100)-damage,0,100);s.maintenance.lastDamageAt=t;
      s.stats.raidsLost++;s.galaxy.groundThreatLevel=status.level+1;
      report(s,'raid-loss','🚨 Depo ve üretim sahası baskına uğradı',`Güvenlik ${status.security} / saldırı ${status.enemy}. Kaynakların %${Math.round(lossPct*100)} kadarı çalındı; gezegen altyapısı ${Math.round(damage)} puan hasar aldı.`,{category:'ground-raid',phase:'ground',outcome:'defeat',security:status.security,enemy:status.enemy,inventoryLossPct:lossPct,stolen,planetDamage:damage});
    }
    scheduleNextGround(s,t);return{won,status,stolen,reward};
  }
  function processGroundThreat(s,t){
    const raidAt=Number(s.galaxy.nextRaidAt||0),warnMs=GROUND_WARNING_SEC*1000;
    if(!raidAt)return;
    if(!s.galaxy.raidWarningShown&&raidAt>t&&raidAt-t<=warnMs){
      s.galaxy.raidWarningShown=true;
      const st=groundSecurityStatus(s);
      report(s,'warning','⚠️ Yerel sabotaj hareketliliği','Keşif ekipleri üretim bölgesine yaklaşan silahlı bir grup tespit etti. Acil Barikat ve altyapı hazırlığı yap.',{category:'intel',phase:'ground',raidAt,security:st.security,enemyEstimate:st.enemy});
    }
    if(t>=raidAt)resolveGroundThreat(s,t);
  }
  function tickGalaxyLegacy(s,t){
    initializeThreatState(s,t);
    if(threatPhase(s)==='space')return old.tickGalaxyLegacy(s,t);
    const raidAt=Number(s.galaxy.nextRaidAt||0),savedWarn=!!s.galaxy.raidWarningShown;
    // U2's bridge owns a closed-over reference to the pre-U2 legacy runtime.
    // Hide the ground timer while that bridge processes ships/missions/repairs,
    // then resolve the local threat in this phase-aware layer.
    s.galaxy.nextRaidAt=0;s.galaxy.raidWarningShown=true;
    old.tickGalaxyLegacy(s,t);
    s.galaxy.nextRaidAt=raidAt;s.galaxy.raidWarningShown=savedWarn;
    processGroundThreat(s,t);
  }
  function tick(s,dt,t=now()){
    initializeThreatState(s,t);
    if(threatPhase(s)==='space')return old.tick(s,dt,t);
    const raidAt=Number(s.galaxy.nextRaidAt||0),savedWarn=!!s.galaxy.raidWarningShown;
    // Suppress the legacy alien raid timer inside U2's closed-over tick.
    s.galaxy.nextRaidAt=0;s.galaxy.raidWarningShown=true;
    const out=old.tick(s,dt,t);
    if(spaceThreatUnlocked(s)){
      initializeThreatState(s,t);
      return out;
    }
    s.galaxy.nextRaidAt=raidAt;s.galaxy.raidWarningShown=savedWarn;
    initializeThreatState(s,t);
    processGroundThreat(s,t);
    return out;
  }
  function applyOfflineProgress(s){
    const current=now();
    initializeThreatState(s,current);
    if(threatPhase(s)==='space')return old.applyOfflineProgress(s);
    const start=Number(s.lastSeen||current);
    const elapsed=Math.max(0,(current-start)/1000);
    const usable=Math.min(elapsed,D.economyConfig.offlineCapSeconds);
    const simulatedEnd=start+usable*1000;
    const raidAt=Number(s.galaxy.nextRaidAt||0),savedWarn=!!s.galaxy.raidWarningShown;
    const groundThreatDue=!!raidAt&&raidAt<=simulatedEnd;
    // U2 offline simulation also closes over its legacy alien tick. Keep the
    // local timer invisible for the entire simulation and restore/defer it here.
    s.galaxy.nextRaidAt=0;s.galaxy.raidWarningShown=true;
    const result=old.applyOfflineProgress(s);
    if(spaceThreatUnlocked(s)){
      initializeThreatState(s,current);
      return result;
    }
    if(groundThreatDue){
      s.galaxy.nextRaidAt=current+GROUND_WARNING_SEC*1000;
      s.galaxy.raidWarningShown=true;
      report(s,'warning','⚠️ Yerel saldırı hazırlık süresine alındı','Sen yokken yaklaşan yerel baskın otomatik çözülmedi. Savunma hazırlığı yapabilmen için saldırı geri dönüşünden sonraya ertelendi.',{category:'intel',phase:'ground',raidAt:s.galaxy.nextRaidAt,deferred:true});
      result.raidDeferred=true;
    }else{
      s.galaxy.nextRaidAt=raidAt;
      s.galaxy.raidWarningShown=savedWarn;
    }
    initializeThreatState(s,current);
    return result;
  }
  function operationFeed(s,t=now()){
    const rows=old.operationFeed?old.operationFeed(s,t):[];
    if(threatPhase(s)==='ground')for(const row of rows)if(row.kind==='raid'){row.title='🚨 Yaklaşan yerel saldırı';row.detail='Yeryüzü güvenliği';}
    return rows;
  }
  function canScan(s){return spaceThreatUnlocked(s)&&old.canScan(s);}
  function scanNextTarget(s){return spaceThreatUnlocked(s)?old.scanNextTarget(s):null;}

  function createInitialState(options){const s=stripAutomaticStarterFactory(old.createInitialState(options||{}));initializeThreatState(s,now(),true);return s;}
  function normalizeState(raw){const s=old.normalizeState(raw);initializeStarterRights(s);initializeThreatState(s,now(),false);return s;}

  Object.assign(E,{createInitialState,normalizeState,buildRequirements,plantBuildRequirements,canBuild,canBuildPlant,buildMachine,buildPlant,placeMachine,placePlant,removeEntity,tick,tickGalaxyLegacy,applyOfflineProgress,operationFeed,canScan,scanNextTarget,starterFreeRemaining,starterFreePlantRemaining,spaceThreatUnlocked,threatPhase,groundSecurityStatus,initializeThreatState});
})(typeof window!=='undefined'?window:globalThis);
