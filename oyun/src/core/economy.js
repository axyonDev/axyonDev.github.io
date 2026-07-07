/**
 * Axyon.Economy v4.3 — DOM'dan bağımsız oyun çekirdeği.
 * Kalıcı fabrika, Mk I–V yükseltme, kotalı pazar, filo ve PvE savaşları.
 */
(function (global) {
  const N = global.Axyon.Numbers;
  const D = global.Axyon.Data;
  const SAVE_VERSION = 15;
  const CELL_M2 = 4;

  const mDef = id => D.machines.find(m => m.id === id);
  const pDef = id => D.powerPlants.find(p => p.id === id);
  const shipDef = id => D.ships.find(x => x.id === id);
  const defenseDef = id => D.defenses.find(x => x.id === id);
  const satelliteDef = id => (D.satellites||[]).find(x => x.id === id);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const MAX_SAFE = Number.MAX_SAFE_INTEGER;
  const safeNumber = (v,fallback=0,min=0,max=MAX_SAFE) => {const n=Number(v);return Number.isFinite(n)?clamp(n,min,max):fallback;};
  const safeInt = (v,fallback=0,min=0,max=10000000) => Math.floor(safeNumber(v,fallback,min,max));
  const copy = o => JSON.parse(JSON.stringify(o));
  function geometricInvestment(def,count){count=safeInt(count,0,0,1000000);if(!count)return 0;const g=safeNumber(def.buildGrowth,1,1,10),base=safeNumber(def.buildCost,0);const value=g===1?base*count:base*(Math.pow(g,count)-1)/(g-1);return Number.isFinite(value)?Math.min(MAX_SAFE,value):MAX_SAFE;}

  function blankItemMap(value) {
    const out = {};
    Object.keys(D.items).forEach(k => out[k] = typeof value === 'function' ? value(k) : value);
    return out;
  }

  function createInitialStateBase() {
    const machines = {}, plants = {}, machineLevels = {}, plantLevels = {};
    D.machines.forEach(d => { machines[d.id] = {count:0,hasManager:false,automationLevel:0,eff:0,milestoneMult:1}; machineLevels[d.id]=1; });
    D.powerPlants.forEach(d => { plants[d.id] = {count:0}; plantLevels[d.id]=1; });
    const ships = {}, defenses = {};
    D.ships.forEach(d => ships[d.id]=0);
    D.defenses.forEach(d => defenses[d.id]=0);
    const targets = D.galaxyTargets.map((t,i)=>Object.assign(copy(t),{discovered:false,defeated:false,colonized:false,recoveryAt:0,victories:0,scannedAt:0,index:i}));
    const now = Date.now();
    const s = {
      version:SAVE_VERSION,
      coins:180,totalEarned:0,runEarned:0,
      inventory:blankItemMap(0),storageLevel:blankItemMap(0),flow:blankItemMap(0),
      autoSell:blankItemMap(k=>!D.items[k].research && D.items[k].sell>0),
      autoSellKeep:blankItemMap(50),
      machines,plants,machineLevels,plantLevels,
      researched:{},repeatResearch:{industrialEfficiency:0,marketLogistics:0,weaponSystems:0,shieldSystems:0,warpNavigation:0,repairEfficiency:0,salvageRecovery:0,automationDepth:0,frontierLogistics:0},researchProgress:{active:null,queue:[]},
      sectorsOpened:0,questIndex:0,achievements:{},
      stats:{machinesBuilt:0,plantsBuilt:0,managersBought:0,automationUpgrades:0,playTimeSec:0,produced:blankItemMap(0),marketDispatches:0,battlesWon:0,battlesLost:0,systemsScanned:0,raidsWon:0,raidsLost:0,buildingUpgrades:0,salvageRecovered:0,repairsCompleted:0,frontierVictories:0},
      settings:{theme:'dark'},planet:{type:'temperate',startRegion:'center',capacityBonus:0,threatBonus:0},_power:{supply:0,demand:0,ratio:1},
      grid:{entities:{},conveyors:[],powerLines:[],nextId:1},
      map:{openSectors:{},nodes:{},nodeNextSeed:17},
      market:{enabled:false,keepPct:50,level:1,nextDispatchAt:0,lastDispatchAt:0,lastRevenue:0,lastUnits:0,totalRevenue:0},
      galaxy:{ships,defenses,targets,shipQueue:[],missions:[],reports:[],scanCooldownUntil:0,threat:0,nextRaidAt:now+D.economyConfig.raidBaseSec*1000,raidWarningShown:false,colonies:1,frontierDepth:0,frontierGenerated:0},
      maintenance:{integrity:{planet:100,orbital:100,satellite:100},facilities:{planetWorkshop:0,orbitalDrydock:0,satelliteHub:0},damagedShips:Object.assign({},ships),damagedDefenses:Object.assign({},defenses),repairQueue:[],lastDamageAt:0},
      topScore:0,lastSeen:now,
    };
    initMap(s);
    return s;
  }

  function normalizeStateBase(raw) {
    if (!raw || typeof raw !== 'object') return createInitialState();
    const base = createInitialState();
    // Eski v8 kayıtlarında ekonomi korunur; 48x48 mekânsal düzen güvenli biçimde yeniden kurulur.
    const oldVersion = Number(raw.version || 0);
    const s = Object.assign({}, base, raw);
    s.version = SAVE_VERSION;

    // İç içe nesneleri her zaman taze varsayılanların üzerine kur. Böylece eksik/eski kayıtlar
    // yeni makine, ürün veya filo türleri eklendiğinde undefined alan üretmez.
    s.inventory = Object.assign({}, base.inventory, raw.inventory || {});
    s.storageLevel = Object.assign({}, base.storageLevel, raw.storageLevel || {});
    s.flow = Object.assign({}, base.flow, raw.flow || {});
    s.autoSell = Object.assign({}, base.autoSell, raw.autoSell || {});
    s.autoSellKeep = Object.assign({}, base.autoSellKeep, raw.autoSellKeep || {});

    s.machines = {};
    D.machines.forEach(d => {
      s.machines[d.id] = Object.assign({}, base.machines[d.id], raw.machines && raw.machines[d.id] || {});
      if(!Number.isFinite(Number(s.machines[d.id].automationLevel)))s.machines[d.id].automationLevel=s.machines[d.id].hasManager?1:0;
      s.machines[d.id].automationLevel=clamp(Math.floor(Number(s.machines[d.id].automationLevel||0)),0,D.automation.maxLevel);
      s.machines[d.id].hasManager=s.machines[d.id].automationLevel>0;
    });
    s.plants = {};
    D.powerPlants.forEach(d => {
      s.plants[d.id] = Object.assign({}, base.plants[d.id], raw.plants && raw.plants[d.id] || {});
    });

    s.machineLevels = Object.assign({}, base.machineLevels, raw.machineLevels || {});
    s.plantLevels = Object.assign({}, base.plantLevels, raw.plantLevels || {});
    s.researched = Object.assign({}, raw.researched || {});
    s.repeatResearch = Object.assign({}, base.repeatResearch, raw.repeatResearch || {});
    s.researchProgress = Object.assign({}, base.researchProgress, raw.researchProgress || {});
    s.researchProgress.active = s.researchProgress.active || null;
    s.researchProgress.queue = Array.isArray(s.researchProgress.queue) ? s.researchProgress.queue : [];
    s.stats = Object.assign({}, base.stats, raw.stats || {});
    s.stats.produced = Object.assign({}, base.stats.produced, raw.stats && raw.stats.produced || {});
    s.settings = Object.assign({}, base.settings, raw.settings || {});
    s.planet = Object.assign({}, base.planet, raw.planet || {});
    if(!D.planetTypes[s.planet.type]) s.planet.type='temperate';
    const pt=D.planetTypes[s.planet.type]||D.planetTypes.temperate; s.planet.capacityBonus=Number(pt.capacityBonus||0); s.planet.threatBonus=Number(pt.threatBonus||0);
    s.market = Object.assign({}, base.market, raw.market || {});
    s.market.satellites = safeInt(s.market.satellites || 0, 0, 0, D.market.maxSatellites||9);

    s.galaxy = Object.assign({}, base.galaxy, raw.galaxy || {});
    s.galaxy.ships = Object.assign({}, base.galaxy.ships, raw.galaxy && raw.galaxy.ships || {});
    s.galaxy.defenses = Object.assign({}, base.galaxy.defenses, raw.galaxy && raw.galaxy.defenses || {});
    s.galaxy.targets = mergeTargets(raw.galaxy && raw.galaxy.targets);
    s.galaxy.shipQueue = Array.isArray(s.galaxy.shipQueue) ? s.galaxy.shipQueue : [];
    s.galaxy.missions = Array.isArray(s.galaxy.missions) ? s.galaxy.missions : [];
    s.galaxy.reports = Array.isArray(s.galaxy.reports) ? s.galaxy.reports.slice(0,200) : [];

    s.maintenance = Object.assign({}, base.maintenance, raw.maintenance || {});
    s.maintenance.integrity = Object.assign({}, base.maintenance.integrity, raw.maintenance && raw.maintenance.integrity || {});
    ['planet','orbital','satellite'].forEach(k=>s.maintenance.integrity[k]=clamp(Number(s.maintenance.integrity[k]??100),0,100));
    s.maintenance.facilities = Object.assign({}, base.maintenance.facilities, raw.maintenance && raw.maintenance.facilities || {});
    s.maintenance.damagedShips = Object.assign({}, base.maintenance.damagedShips, raw.maintenance && raw.maintenance.damagedShips || {});
    s.maintenance.damagedDefenses = Object.assign({}, base.maintenance.damagedDefenses, raw.maintenance && raw.maintenance.damagedDefenses || {});
    s.maintenance.repairQueue = Array.isArray(s.maintenance.repairQueue)?s.maintenance.repairQueue:[];

    const needsMapMigration = oldVersion <= 8 || !raw.map || !raw.grid || !!raw.__needsFreshMap;
    if (needsMapMigration) {
      s.grid = {entities:{},conveyors:[],powerLines:[],nextId:1};
      s.map = {openSectors:{},nodes:{},nodeNextSeed:(raw.map && raw.map.nodeNextSeed || 17)+31};
      s.sectorsOpened = 0;
      initMap(s);

      // Eski görünmez bina sayaçlarını yeni 300x300 haritaya taşımak veri/yerleşim tutarsızlığı
      // doğurur. Binalar sıfırlanır, yatırımın %65'i kredi olarak geri verilir.
      let legacyRefund = 0;
      D.machines.forEach(d => {
        const machine = s.machines[d.id] || base.machines[d.id];
        const count = safeInt(machine.count);
        legacyRefund += geometricInvestment(d,count) * 0.65;
        if (machine.hasManager) legacyRefund += d.managerCost * 0.65;
        s.machines[d.id] = {count:0,hasManager:false,automationLevel:0,eff:0,milestoneMult:1};
      });
      D.powerPlants.forEach(d => {
        const plant = s.plants[d.id] || base.plants[d.id];
        const count = safeInt(plant.count);
        legacyRefund += geometricInvestment(d,count) * 0.65;
        s.plants[d.id] = {count:0};
      });
      s.coins = N.add(Number(s.coins || 0), Math.floor(legacyRefund));
    } else {
      s.grid = Object.assign({}, base.grid, raw.grid || {});
      s.grid.entities = Object.assign({}, base.grid.entities, raw.grid && raw.grid.entities || {});
      s.grid.conveyors = Array.isArray(s.grid.conveyors) ? s.grid.conveyors : [];
      s.grid.powerLines = Array.isArray(s.grid.powerLines) ? s.grid.powerLines : [];
      s.map = Object.assign({}, base.map, raw.map || {});
      s.map.openSectors = Object.assign({}, base.map.openSectors, raw.map && raw.map.openSectors || {});
      s.map.nodes = Object.assign({}, base.map.nodes, raw.map && raw.map.nodes || {});
    }
    sanitizeState(s,base);
    if (!s.galaxy.nextRaidAt) s.galaxy.nextRaidAt = Date.now()+D.economyConfig.raidBaseSec*1000;
    return s;
  }


  function sanitizeState(s,base){
    ['coins','totalEarned','runEarned','topScore'].forEach(k=>s[k]=safeNumber(s[k],base[k]||0));
    s.sectorsOpened=safeInt(s.sectorsOpened,0,0,225);
    s.questIndex=safeInt(s.questIndex,0,0,D.quests.length);
    s.lastSeen=safeNumber(s.lastSeen,Date.now(),0,MAX_SAFE);
    Object.keys(D.items).forEach(k=>{
      s.inventory[k]=safeNumber(s.inventory[k],0);
      s.storageLevel[k]=safeInt(s.storageLevel[k],0,0,250);
      s.flow[k]=safeNumber(s.flow[k],0,-MAX_SAFE,MAX_SAFE);
      s.autoSell[k]=!!s.autoSell[k];
      s.autoSellKeep[k]=clamp(safeInt(s.autoSellKeep[k],50,0,100),0,100);
    });
    D.machines.forEach(d=>{const m=s.machines[d.id];m.count=safeInt(m.count);m.automationLevel=safeInt(m.automationLevel,0,0,D.automation.maxLevel);m.hasManager=m.automationLevel>0;m.eff=safeNumber(m.eff,0,0,1);m.milestoneMult=safeNumber(m.milestoneMult,1,1,1000);s.machineLevels[d.id]=safeInt(s.machineLevels[d.id],1,1,5);});
    D.powerPlants.forEach(d=>{s.plants[d.id].count=safeInt(s.plants[d.id].count);s.plantLevels[d.id]=safeInt(s.plantLevels[d.id],1,1,5);});
    const researched={};D.research.forEach(t=>{if(s.researched[t.id])researched[t.id]=true;});s.researched=researched;
    D.repeatableResearch.forEach(r=>s.repeatResearch[r.id]=safeInt(s.repeatResearch[r.id],0,0,100000));
    Object.keys(base.stats).forEach(k=>{if(k!=='produced')s.stats[k]=safeNumber(s.stats[k],0);});Object.keys(D.items).forEach(k=>s.stats.produced[k]=safeNumber(s.stats.produced[k],0));
    s.settings.theme=s.settings.theme==='light'?'light':'dark';
    s.market.enabled=!!s.market.enabled;s.market.keepPct=clamp(safeInt(s.market.keepPct,50,0,100),0,100);s.market.level=safeInt(s.market.level,1,1,D.market.maxLevel);s.market.satellites=safeInt(s.market.satellites||0,0,0,D.market.maxSatellites||9);['nextDispatchAt','lastDispatchAt','lastRevenue','lastUnits','totalRevenue'].forEach(k=>s.market[k]=safeNumber(s.market[k],0));
    D.ships.forEach(d=>{s.galaxy.ships[d.id]=safeInt(s.galaxy.ships[d.id]);s.maintenance.damagedShips[d.id]=safeInt(s.maintenance.damagedShips[d.id]);});
    D.defenses.forEach(d=>{s.galaxy.defenses[d.id]=safeInt(s.galaxy.defenses[d.id]);s.maintenance.damagedDefenses[d.id]=safeInt(s.maintenance.damagedDefenses[d.id]);});
    ['threat','colonies','frontierDepth','frontierGenerated','scanCooldownUntil','nextRaidAt'].forEach(k=>s.galaxy[k]=safeNumber(s.galaxy[k],k==='colonies'?1:0));s.galaxy.raidWarningShown=!!s.galaxy.raidWarningShown;
    s.galaxy.targets=s.galaxy.targets.filter(t=>t&&typeof t.id==='string').slice(0,500).map(t=>Object.assign(t,{distance:safeNumber(t.distance,1,.1,100000),strength:safeNumber(t.strength,1,1,MAX_SAFE),threat:safeNumber(t.threat,1,0,1000),recoveryAt:safeNumber(t.recoveryAt,0),victories:safeInt(t.victories),discovered:!!t.discovered,defeated:!!t.defeated,colonized:!!t.colonized}));
    s.galaxy.shipQueue=s.galaxy.shipQueue.filter(q=>q&&shipDef(q.shipId)&&Number.isFinite(Number(q.finishAt))).slice(0,500).map(q=>Object.assign(q,{count:safeInt(q.count,1,1,99),finishAt:safeNumber(q.finishAt,Date.now())}));
    s.galaxy.missions=s.galaxy.missions.filter(m=>m&&targetById(s,m.targetId)&&['outbound','returning'].includes(m.status)).slice(-30);s.galaxy.missions.forEach(m=>{D.ships.forEach(d=>{m.ships=m.ships||{};m.ships[d.id]=safeInt(m.ships[d.id]);if(m.damagedShips){m.damagedShips[d.id]=safeInt(m.damagedShips[d.id]);}});m.arrivalAt=safeNumber(m.arrivalAt,Date.now());m.returnAt=safeNumber(m.returnAt,0);});
    s.galaxy.reports=s.galaxy.reports.filter(r=>r&&typeof r.id==='string'&&typeof r.title==='string').slice(0,200);
    ['planet','orbital','satellite'].forEach(k=>s.maintenance.integrity[k]=safeNumber(s.maintenance.integrity[k],100,0,100));
    D.repairFacilities.forEach(f=>s.maintenance.facilities[f.id]=safeInt(s.maintenance.facilities[f.id],0,0,f.maxLevel));
    s.maintenance.repairQueue=s.maintenance.repairQueue.filter(j=>j&&['zone','ship','defense'].includes(j.kind)&&D.repairFacilities.some(f=>f.id===j.facility)&&Number.isFinite(Number(j.finishAt))).slice(0,500).map(j=>Object.assign(j,{amount:safeInt(j.amount,1,1,100000),startedAt:safeNumber(j.startedAt,Date.now()),finishAt:safeNumber(j.finishAt,Date.now())}));
    s.maintenance.lastDamageAt=safeNumber(s.maintenance.lastDamageAt,0);
    const validOpen={};for(const key of Object.keys(s.map.openSectors||{})){const m=/^(\d+),(\d+)$/.exec(key);if(!m)continue;const sx=Number(m[1]),sy=Number(m[2]);if(sx>=0&&sy>=0&&sx<sectorsPerSide()&&sy<sectorsPerSide())validOpen[key]=true;}s.map.openSectors=validOpen;
    const validNodes={};for(const [key,node] of Object.entries(s.map.nodes||{})){const m=/^(\d+),(\d+)$/.exec(key);if(!m||!node||!D.resourceNodes[node.type])continue;const x=Number(m[1]),y=Number(m[2]);if(x>=0&&y>=0&&x<D.map.size&&y<D.map.size)validNodes[key]={type:node.type};}s.map.nodes=validNodes;s.map.nodeNextSeed=safeInt(s.map.nodeNextSeed,17,1,0x7fffffff);
    if(!Object.keys(s.map.openSectors).length)initMap(s);
    const validEntities={};for(const [id,e] of Object.entries(s.grid.entities||{})){if(!e||!['machine','plant'].includes(e.type))continue;const def=e.type==='machine'?mDef(e.defId):pDef(e.defId);if(!def)continue;const x=safeInt(e.x,-1,-1,D.map.size-1),y=safeInt(e.y,-1,-1,D.map.size-1);if(x<0||y<0)continue;validEntities[id]={id,type:e.type,defId:e.defId,x,y};}s.grid.entities=validEntities;s.grid.nextId=safeInt(s.grid.nextId,1,1,MAX_SAFE);s.grid.conveyors=(s.grid.conveyors||[]).filter(x=>x&&Number.isFinite(Number(x.x1))&&Number.isFinite(Number(x.y1))&&Number.isFinite(Number(x.x2))&&Number.isFinite(Number(x.y2))).slice(0,20000);s.grid.powerLines=(s.grid.powerLines||[]).filter(x=>x&&Number.isFinite(Number(x.x1))&&Number.isFinite(Number(x.y1))&&Number.isFinite(Number(x.x2))&&Number.isFinite(Number(x.y2))).slice(0,20000);
    const mainIds=new Set(D.research.map(t=>t.id)),repeatIds=new Set(D.repeatableResearch.map(r=>r.id));const validJob=j=>j&&((j.kind==='main'&&mainIds.has(j.id))||(j.kind==='repeat'&&repeatIds.has(j.id)))&&Number.isFinite(Number(j.durationSec));
    s.researchProgress.active=validJob(s.researchProgress.active)?s.researchProgress.active:null;s.researchProgress.queue=(s.researchProgress.queue||[]).filter(validJob).slice(0,3);if(s.researchProgress.active){s.researchProgress.active.startedAt=safeNumber(s.researchProgress.active.startedAt,Date.now());s.researchProgress.active.finishAt=safeNumber(s.researchProgress.active.finishAt,Date.now()+1000);}
  }

  function mergeTargets(saved) {
    const byId = {};
    (saved || []).forEach(t => {if(t&&t.id)byId[t.id]=t;});
    const fixed=D.galaxyTargets.map((t,i)=>Object.assign(copy(t),{discovered:false,defeated:false,colonized:false,recoveryAt:0,victories:0,scannedAt:0,index:i},byId[t.id]||{}));
    const procedural=(saved||[]).filter(t=>t&&t.procedural&&!D.galaxyTargets.some(x=>x.id===t.id)).map(t=>Object.assign({discovered:false,defeated:false,colonized:false,recoveryAt:0,victories:0,scannedAt:0,colonizable:false},t));
    return fixed.concat(procedural);
  }

  // ===== Harita =====
  const sectorKey = (sx,sy)=>`${sx},${sy}`;
  const nodeKey = (x,y)=>`${x},${y}`;
  function sectorsPerSide(){ return Math.floor(D.map.size/D.map.sectorSize); }
  function mapSide(){ return D.map.size; }
  function gridSize(){ return D.map.size; }
  function cellSector(x,y){ return {sx:Math.floor(x/D.map.sectorSize),sy:Math.floor(y/D.map.sectorSize)}; }
  function isSectorOpen(s,sx,sy){ return !!s.map.openSectors[sectorKey(sx,sy)]; }
  function isCellOpen(s,x,y){ const q=cellSector(x,y); return isSectorOpen(s,q.sx,q.sy); }
  function openSectorList(s){ return Object.keys(s.map.openSectors).map(k=>{const [sx,sy]=k.split(',').map(Number);return {sx,sy};}); }
  function openableSectors(s){
    const max=sectorsPerSide(), out={};
    openSectorList(s).forEach(({sx,sy})=>[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
      const x=sx+dx,y=sy+dy,k=sectorKey(x,y);
      if(x>=0&&y>=0&&x<max&&y<max&&!s.map.openSectors[k]) out[k]={sx:x,sy:y};
    }));
    return Object.values(out);
  }
  function openSectorInternal(s,sx,sy,silent){
    const max=sectorsPerSide();
    if(sx<0||sy<0||sx>=max||sy>=max||isSectorOpen(s,sx,sy)) return false;
    s.map.openSectors[sectorKey(sx,sy)]=true;
    if(!silent) generateSectorNodes(s,sx,sy);
    return true;
  }
  function startSectorCoords(s){
    const max=sectorsPerSide(), mid=Math.floor(max/2), r=s?.planet?.startRegion||'center';
    const map={center:[mid,mid],north:[mid,1],south:[mid,max-2],west:[1,mid],east:[max-2,mid]};
    const a=map[r]||map.center; return {sx:clamp(a[0],0,max-1),sy:clamp(a[1],0,max-1)};
  }
  function initMap(s){
    const st=startSectorCoords(s); openSectorInternal(s,st.sx,st.sy,true);
    const cells=openCells(s);
    ['ironOre','copperOre','coal'].forEach(type=>placeNodeRandom(s,type,cells));
    const pt=D.planetTypes[s.planet?.type||'temperate']||D.planetTypes.temperate, bias=pt.resourceBias||['ironOre','copperOre','coal'];
    for(let i=0;i<3;i++) placeNodeRandom(s,bias[Math.floor(rng(s)*bias.length)]||'ironOre',cells);
  }
  function rng(s){ let x=(s.map.nodeNextSeed=(s.map.nodeNextSeed*1103515245+12345)&0x7fffffff); return (x%100000)/100000; }
  function openCells(s){
    const cells=[],ss=D.map.sectorSize;
    openSectorList(s).forEach(({sx,sy})=>{for(let y=sy*ss;y<(sy+1)*ss;y++)for(let x=sx*ss;x<(sx+1)*ss;x++)cells.push({x,y});});
    return cells;
  }
  function nodeAt(s,x,y){ return s.map.nodes[nodeKey(x,y)]||null; }
  function nodeVisible(s,x,y){ return isCellOpen(s,x,y)&&!!nodeAt(s,x,y); }
  function placeNodeRandom(s,type,cells){
    for(let attempt=0;attempt<80;attempt++){
      const p=cells[Math.floor(rng(s)*cells.length)];
      if(p&&!nodeAt(s,p.x,p.y)&&!cellOccupied(s,p.x,p.y)){s.map.nodes[nodeKey(p.x,p.y)]={type};return p;}
    }
    return null;
  }
  function generateSectorNodes(s,sx,sy){
    const max=sectorsPerSide(),mid=Math.floor(max/2),dist=Math.max(Math.abs(sx-mid),Math.abs(sy-mid)),ss=D.map.sectorSize,cells=[];
    for(let y=sy*ss;y<(sy+1)*ss;y++)for(let x=sx*ss;x<(sx+1)*ss;x++)cells.push({x,y});
    const types=Object.keys(D.resourceNodes).filter(t=>dist>=(D.resourceNodes[t].minDistance||0));
    const weighted=[];types.forEach(t=>{for(let i=0;i<Math.max(1,7-D.resourceNodes[t].rarity);i++)weighted.push(t);});
    const count=5+Math.floor(rng(s)*7);
    for(let i=0;i<count;i++) placeNodeRandom(s,weighted[Math.floor(rng(s)*weighted.length)],cells);
  }
  function sectorOpenCost(s){ return Math.ceil(D.map.openBaseCost*Math.pow(D.map.openGrowth,s.sectorsOpened)); }
  function canOpenSector(s){ return openableSectors(s).length>0&&s.coins>=sectorOpenCost(s); }
  function openSector(s,sx,sy){
    if(!canOpenSector(s)||!openableSectors(s).some(o=>o.sx===sx&&o.sy===sy)) return false;
    s.coins=N.sub(s.coins,sectorOpenCost(s));openSectorInternal(s,sx,sy,false);s.sectorsOpened++;return true;
  }

  // ===== Yerleşim =====
  function extractorNodeType(defId){const d=mDef(defId);return d&&Object.keys(d.recipe.in).length===0?Object.keys(d.recipe.out)[0]:null;}
  function isExtractor(id){return !!extractorNodeType(id);}
  function entityFootprintCells(defId,type){const d=type==='plant'?pDef(defId):mDef(defId);return d?Math.max(1,Math.round(Math.sqrt(d.footprint/CELL_M2))):1;}
  function cellOccupied(s,x,y,ignoreId){
    for(const id in s.grid.entities){if(id===ignoreId)continue;const e=s.grid.entities[id],z=entityFootprintCells(e.defId,e.type);if(x>=e.x&&x<e.x+z&&y>=e.y&&y<e.y+z)return true;}return false;
  }
  function canPlaceAt(s,defId,type,x,y,ignoreId){
    const d=type==='plant'?pDef(defId):mDef(defId);if(!d)return false;
    const z=entityFootprintCells(defId,type),need=type==='machine'?extractorNodeType(defId):null;let covers=false;
    if(x<0||y<0||x+z>D.map.size||y+z>D.map.size)return false;
    for(let dx=0;dx<z;dx++)for(let dy=0;dy<z;dy++){
      const cx=x+dx,cy=y+dy;if(!isCellOpen(s,cx,cy)||cellOccupied(s,cx,cy,ignoreId))return false;
      const nd=nodeAt(s,cx,cy);if(need){if(nd&&nd.type===need)covers=true;}else if(nd)return false;
    }
    return !need||covers;
  }
  function hasFreeNodeFor(s,id){const t=extractorNodeType(id);if(!t)return true;for(const k in s.map.nodes){if(s.map.nodes[k].type!==t)continue;const [x,y]=k.split(',').map(Number);if(isCellOpen(s,x,y)&&!cellOccupied(s,x,y))return true;}return false;}
  function placeMachine(s,id,x,y){if(!canPlaceAt(s,id,'machine',x,y)||!buildMachine(s,id))return null;const eid='e'+s.grid.nextId++;s.grid.entities[eid]={id:eid,type:'machine',defId:id,x,y};return eid;}
  function placePlant(s,id,x,y){if(!canPlaceAt(s,id,'plant',x,y)||!buildPlant(s,id))return null;const eid='e'+s.grid.nextId++;s.grid.entities[eid]={id:eid,type:'plant',defId:id,x,y};return eid;}
  function moveEntity(s,id,x,y){const e=s.grid.entities[id];if(!e||!canPlaceAt(s,e.defId,e.type,x,y,id))return false;e.x=x;e.y=y;return true;}
  function cellOccupiedExceptSelf(s,e,x,y){return !canPlaceAt(s,e.defId,e.type,x,y,e.id);}
  function removeEntity(s,id){
    const e=s.grid.entities[id];if(!e)return false;
    if(e.type==='machine'){const d=mDef(e.defId),m=s.machines[e.defId];if(m.count>0)m.count--;s.coins=N.add(s.coins,buildCostFromCount(d,Math.max(0,m.count))*.45);}
    else{const d=pDef(e.defId),p=s.plants[e.defId];if(p.count>0)p.count--;s.coins=N.add(s.coins,plantCostFromCount(d,Math.max(0,p.count))*.45);}
    delete s.grid.entities[id];s.grid.conveyors=s.grid.conveyors.filter(x=>x.from!==id&&x.to!==id);s.grid.powerLines=s.grid.powerLines.filter(x=>x.from!==id&&x.to!==id);return true;
  }
  function entityCenter(s,e){const z=entityFootprintCells(e.defId,e.type);return {cx:e.x+z/2,cy:e.y+z/2};}
  function addConveyor(s,from,to){if(!s.grid.entities[from]||!s.grid.entities[to]||s.grid.conveyors.some(x=>x.from===from&&x.to===to))return false;s.grid.conveyors.push({from,to});return true;}
  function addPowerLine(s,from,to){const a=s.grid.entities[from],b=s.grid.entities[to];if(!a||!b||a.type!=='plant'||b.type!=='machine'||s.grid.powerLines.some(x=>x.from===from&&x.to===to))return false;s.grid.powerLines.push({from,to});return true;}
  function removeConveyor(s,from,to){const n=s.grid.conveyors.length;s.grid.conveyors=s.grid.conveyors.filter(x=>!(x.from===from&&x.to===to));return s.grid.conveyors.length<n;}
  function pointSegDist(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;if(!l)return Math.hypot(px-ax,py-ay);let t=((px-ax)*dx+(py-ay)*dy)/l;t=clamp(t,0,1);return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));}
  function removeLineNear(s,x,y,r){
    for(const key of ['conveyors','powerLines']) for(let i=s.grid[key].length-1;i>=0;i--){const l=s.grid[key][i],a=s.grid.entities[l.from],b=s.grid.entities[l.to];if(!a||!b)continue;const ca=entityCenter(s,a),cb=entityCenter(s,b);if(pointSegDist(x,y,ca.cx,ca.cy,cb.cx,cb.cy)<=r){s.grid[key].splice(i,1);return true;}}return false;
  }

  // ===== Ekonomi =====
  function isMachineUnlocked(s,id){const d=mDef(id);return !!d&&(!d.tech||!!s.researched[d.tech]);}
  function isPlantUnlocked(s,id){const d=pDef(id);return !!d&&(!d.tech||!!s.researched[d.tech]);}
  function buildCostFromCount(d,count){return Math.ceil(d.buildCost*Math.pow(d.buildGrowth,count));}
  function plantCostFromCount(d,count){return Math.ceil(d.buildCost*Math.pow(d.buildGrowth,count));}
  function buildCost(s,id){const d=mDef(id);return buildCostFromCount(d,s.machines[id].count);}
  function plantBuildCost(s,id){const d=pDef(id);return plantCostFromCount(d,s.plants[id].count);}
  function totalCells(s){return openSectorList(s).length*D.map.sectorSize*D.map.sectorSize;}
  function usedCells(s){let n=0;Object.values(s.grid.entities).forEach(e=>{const z=entityFootprintCells(e.defId,e.type);n+=z*z;});return n;}
  function freeCells(s){return Math.max(0,totalCells(s)-usedCells(s));}
  function infraLevel(s,key){s.infrastructure=s.infrastructure||{planetMk:1,orbitMk:1};return clamp(Math.floor(Number(s.infrastructure[key]||1)),1,5);}
  function buildingLoad(s){let n=0;Object.values(s.grid.entities||{}).forEach(e=>{const def=e.type==='plant'?pDef(e.defId):mDef(e.defId),lv=e.type==='plant'?plantLevel(s,e.defId):machineLevel(s,e.defId);const eff=(D.capacity.loadEfficiencyByClass||[1,.9,.8,.7,.6])[Math.max(0,lv-1)]||1;n+=(def?.load||Math.ceil((def?.footprint||4)/CELL_M2))*eff;});return Math.ceil(n);}
  function planetCapacity(s){const pt=D.planetTypes[s.planet?.type||'temperate']||D.planetTypes.temperate,reg=(D.startRegions||{})[s.planet?.startRegion||'center']||{};const mk=infraLevel(s,'planetMk'),base=(D.capacity.planetByMk&&D.capacity.planetByMk[mk])||85;return Math.max(10,Math.floor((base+openSectorList(s).length*(D.capacity.sectorPlanetBonus||8)+(reg.capacityBonus||0))*(1+(pt.capacityBonus||0))));}
  function marketSatelliteLimit(s){return Math.min(D.market.maxSatellites||9,(s.market.level||1)*(D.market.satellitesPerLevel||3));}
  function marketSatelliteCount(s){return clamp(s.market.satellites||0,0,marketSatelliteLimit(s));}
  function orbitCapacity(s){const mk=infraLevel(s,'orbitMk'),base=(D.capacity.orbitByMk&&D.capacity.orbitByMk[mk])||18;return Math.floor(base+Math.max(0,(s.galaxy.colonies||1)-1)*4+(s.repeatResearch.frontierLogistics||0)*2);}
  function shipLoadOf(d,n){return (d.commandLoad||1)*Math.max(0,n||0);}
  function fleetLoad(s){const ships=D.ships.reduce((n,d)=>n+shipLoadOf(d,(s.galaxy.ships[d.id]||0)+(s.maintenance?.damagedShips?.[d.id]||0)),0);const missions=(s.galaxy.missions||[]).reduce((n,m)=>n+D.ships.reduce((a,d)=>a+shipLoadOf(d,(m.ships?.[d.id]||0)+(m.damagedShips?.[d.id]||0)),0),0);const queue=(s.galaxy.shipQueue||[]).reduce((n,q)=>{const d=shipDef(q.shipId);return n+shipLoadOf(d,q.count||0);},0);const sats=marketSatelliteCount(s)*(D.capacity.marketSatelliteLoad||1);return ships+missions+queue+sats;}
  function fleetCapacity(s){return orbitCapacity(s);}
  function defenseLoad(s){return D.defenses.reduce((n,d)=>n+(d.load||1)*((s.galaxy.defenses[d.id]||0)+(s.maintenance?.damagedDefenses?.[d.id]||0)),0);}
  function defenseCapacity(s){return Math.floor(planetCapacity(s)*.45+(s.repeatResearch.shieldSystems||0)*2);}
  function capacityStatus(s){return {planet:{used:buildingLoad(s),max:planetCapacity(s)},fleet:{used:fleetLoad(s),max:fleetCapacity(s)},defense:{used:defenseLoad(s),max:defenseCapacity(s)},marketSatellites:{used:marketSatelliteCount(s),max:marketSatelliteLimit(s)}};}
  function canAddBuildingLoad(s,defId,type){const d=type==='plant'?pDef(defId):mDef(defId);return buildingLoad(s)+(d?.load||Math.ceil((d?.footprint||4)/CELL_M2))<=planetCapacity(s);}
  function canBuild(s,id){const d=mDef(id);return isMachineUnlocked(s,id)&&s.coins>=buildCost(s,id)&&canAddBuildingLoad(s,id,'machine')&&(!isExtractor(id)||hasFreeNodeFor(s,id));}
  function buildMachine(s,id){if(!canBuild(s,id))return false;const c=buildCost(s,id);s.coins=N.sub(s.coins,c);s.machines[id].count++;s.stats.machinesBuilt++;updateMilestone(s,id);return true;}
  function canBuildPlant(s,id){return isPlantUnlocked(s,id)&&s.coins>=plantBuildCost(s,id)&&canAddBuildingLoad(s,id,'plant');}
  function buildPlant(s,id){if(!canBuildPlant(s,id))return false;const c=plantBuildCost(s,id);s.coins=N.sub(s.coins,c);s.plants[id].count++;s.stats.plantsBuilt++;return true;}
  function nextMilestone(s,id){const c=s.machines[id].count;return D.milestones.find(x=>x.count>c)||null;}
  function updateMilestone(s,id){let mult=1;D.milestones.forEach(x=>{if(s.machines[id].count>=x.count)mult=x.multiplier;});s.machines[id].milestoneMult=mult;}
  function automationLevel(s,id){const m=s.machines[id];return m?clamp(Math.floor(Number(m.automationLevel||0)),0,D.automation.maxLevel):0;}
  function automationUpgradeCost(s,id){
    const d=mDef(id),lv=automationLevel(s,id),target=lv+1;if(!d||target>D.automation.maxLevel)return null;
    const coins=Math.ceil(d.managerCost*Math.pow(D.automation.costGrowth,target-1));const items={};
    if(target===2){items.gear=18;items.circuit=10;}
    if(target===3){items.processor=16;items.drone=8;}
    if(target===4){items.electronics=24;items.machinery=20;items.deltaCore=12;}
    if(target===5){items.nanoGel=15;items.quantumCore=18;items.omegaCore=20;}
    return {coins,items,target,tech:D.automation.techByLevel[target]||null};
  }
  function canUpgradeAutomation(s,id){const d=mDef(id),m=s.machines[id],c=automationUpgradeCost(s,id);if(!d||!m||m.count<1||!c)return false;if(c.tech&&!s.researched[c.tech])return false;return s.coins>=c.coins&&Object.entries(c.items).every(([k,v])=>(s.inventory[k]||0)>=v);}
  function upgradeAutomation(s,id){if(!canUpgradeAutomation(s,id))return false;const c=automationUpgradeCost(s,id),m=s.machines[id];s.coins=N.sub(s.coins,c.coins);Object.entries(c.items).forEach(([k,v])=>s.inventory[k]-=v);m.automationLevel=c.target;m.hasManager=true;if(c.target===1)s.stats.managersBought++;else s.stats.automationUpgrades++;return true;}
  function canBuyManager(s,id){return automationLevel(s,id)===0&&canUpgradeAutomation(s,id);}
  function buyManager(s,id){return upgradeAutomation(s,id);}
  function integrityFactor(s,zone,min){const x=clamp(Number(s.maintenance?.integrity?.[zone]??100),0,100)/100;return (min||.55)+(1-(min||.55))*x;}
  function globalMult(s){const base=1+(s.repeatResearch.industrialEfficiency||0)*.05+Math.max(0,(s.galaxy.colonies||1)-1)*.04;return base*integrityFactor(s,'planet',.58);}
  function machineLevel(s,id){return clamp(Number(s.machineLevels[id]||1),1,5);}
  function plantLevel(s,id){return clamp(Number(s.plantLevels[id]||1),1,5);}
  function automationRateMult(s,id){const lv=automationLevel(s,id),repeat=s.repeatResearch.automationDepth||0;return lv?1+(lv-1)*D.automation.rateBonusPerLevel+repeat*.03:1;}
  function machineRate(s,id){const d=mDef(id),m=s.machines[id],lm=D.levelMultipliers[machineLevel(s,id)-1]||1;return d.baseRate*m.count*(m.milestoneMult||1)*lm*globalMult(s)*automationRateMult(s,id);}
  function machinePowerDemand(s,id){const d=mDef(id),m=s.machines[id],lv=machineLevel(s,id),al=automationLevel(s,id);if(al<1)return 0;const save=Math.max(.7,1-(al-1)*D.automation.powerSavingPerLevel);return d.power*m.count*(1+.24*(lv-1))*save;}
  function plantOutput(s,id){const d=pDef(id),p=s.plants[id],lm=D.plantMultipliers[plantLevel(s,id)-1]||1;return d.output*p.count*lm;}
  function storageCap(s,item){return D.items[item].cap*Math.pow(D.economyConfig.storageUpgradeMult,s.storageLevel[item]||0);}
  function storageUpgradeCost(s,item){return Math.ceil(D.items[item].cap*D.economyConfig.storageUpgradeCostPer*Math.pow(1.7,s.storageLevel[item]||0));}
  function upgradeStorage(s,item){const c=storageUpgradeCost(s,item);if(s.coins<c)return false;s.coins=N.sub(s.coins,c);s.storageLevel[item]=(s.storageLevel[item]||0)+1;return true;}

  function upgradeCost(def,level,type){
    const target=level+1, items={};let coins=Math.ceil(def.buildCost*Math.pow(target,3.15)*8);
    if(target===2){items.gear=25;items.circuit=12;}
    if(target===3){items.machinery=18;items.betaCore=30;}
    if(target===4){items.titaniumPlate=35;items.deltaCore=40;}
    if(target===5){items.energyCrystal=60;items.omegaCore=55;items.machinery=70;}
    if(type==='plant') coins=Math.ceil(coins*1.25);
    return {coins,items};
  }
  function canUpgradeClass(s,id,type){
    const def=type==='plant'?pDef(id):mDef(id),current=type==='plant'?plantLevel(s,id):machineLevel(s,id),cnt=type==='plant'?s.plants[id].count:s.machines[id].count;
    if(!def||cnt<1||current>=5||!s.researched[D.levelTech[current+1]])return false;
    const c=upgradeCost(def,current,type);return s.coins>=c.coins&&Object.entries(c.items).every(([k,v])=>(s.inventory[k]||0)>=v);
  }
  function doUpgradeClass(s,id,type){
    if(!canUpgradeClass(s,id,type))return false;const current=type==='plant'?plantLevel(s,id):machineLevel(s,id),def=type==='plant'?pDef(id):mDef(id),c=upgradeCost(def,current,type);
    s.coins=N.sub(s.coins,c.coins);Object.entries(c.items).forEach(([k,v])=>s.inventory[k]-=v);
    if(type==='plant')s.plantLevels[id]=current+1;else s.machineLevels[id]=current+1;s.stats.buildingUpgrades++;return true;
  }

  function computePower(s,dt){
    let supply=D.economyConfig.basePower;
    D.powerPlants.forEach(d=>{const cnt=s.plants[d.id].count;if(!cnt)return;let ratio=1;if(d.fuel){const need=cnt*d.fuel.rate*dt*(1+.12*(plantLevel(s,d.id)-1)),have=s.inventory[d.fuel.item]||0;ratio=need>0?Math.min(1,have/need):1;s.inventory[d.fuel.item]=Math.max(0,have-need*ratio);}supply+=plantOutput(s,d.id)*ratio;});
    let demand=0;D.machines.forEach(d=>demand+=machinePowerDemand(s,d.id));const ratio=demand?Math.min(1,supply/demand):1;s._power={supply,demand,ratio};return ratio;
  }
  function runMachine(s,id,seconds,powerRatio){
    const d=mDef(id),m=s.machines[id];if(!d||m.count<=0){if(m)m.eff=0;return;}
    let desired=machineRate(s,id)*seconds*powerRatio;if(desired<=0){m.eff=0;return;}
    let actual=desired;
    Object.entries(d.recipe.in).forEach(([k,v])=>actual=Math.min(actual,(s.inventory[k]||0)/v));
    Object.entries(d.recipe.out).forEach(([k,v])=>actual=Math.min(actual,Math.max(0,storageCap(s,k)-(s.inventory[k]||0))/v));
    actual=Math.max(0,Math.min(desired,actual));m.eff=desired?actual/desired:0;if(!actual)return;
    Object.entries(d.recipe.in).forEach(([k,v])=>s.inventory[k]=Math.max(0,(s.inventory[k]||0)-actual*v));
    Object.entries(d.recipe.out).forEach(([k,v])=>{s.inventory[k]=Math.min(storageCap(s,k),(s.inventory[k]||0)+actual*v);s.stats.produced[k]=(s.stats.produced[k]||0)+actual*v;});
  }
  function manualClick(s,id){
    const d=mDef(id),m=s.machines[id];
    if(!d||!m||m.count<1)return 0;
    const out=Object.keys(d.recipe.out)[0],before=s.inventory[out]||0;
    // Manuel üretim tek bir makinenin kısa vardiyasını temsil eder. Makine sayısı arttıkça
    // tıklama ödülünün katlanması, otomasyon ekonomisini bozan bir açık oluşturuyordu.
    runMachine(s,id,D.economyConfig.manualBurstSeconds/Math.max(1,m.count),1);
    return (s.inventory[out]||0)-before;
  }
  function addCoins(s,amount){s.coins=N.add(s.coins,amount);s.totalEarned=N.add(s.totalEarned,amount);s.runEarned=N.add(s.runEarned,amount);}

  // ===== Pazar =====
  function clampPct(v){return clamp(Math.round(Number(v||0)/25)*25,0,100);}
  function setAutoSellKeep(s,item,pct){if(D.items[item])s.autoSellKeep[item]=clampPct(pct);}
  function setGlobalMarketKeep(s,pct){pct=clampPct(pct);s.market.keepPct=pct;Object.keys(D.items).forEach(k=>{if(!D.items[k].research&&D.items[k].sell>0)s.autoSellKeep[k]=pct;});}
  function toggleAutoSell(s,item){if(D.items[item]&&!D.items[item].research&&D.items[item].sell>0)s.autoSell[item]=!s.autoSell[item];}
  function setAllAutoSell(s,on){Object.keys(D.items).forEach(k=>{if(!D.items[k].research&&D.items[k].sell>0)s.autoSell[k]=!!on;});}
  function fuelReserve(s,item){let r=0;D.powerPlants.forEach(d=>{if(d.fuel&&d.fuel.item===item)r+=s.plants[d.id].count*d.fuel.rate*45;});if(item==='starFuel')r+=fleetFuelReserve(s);return r;}
  function fleetFuelReserve(s){let n=0;D.ships.forEach(d=>n+=(s.galaxy.ships[d.id]||0)*d.fuel);return n*2;}
  function sellFraction(s,item,fraction){return 0;} // v4.3: yerel satış kapalı; tüm ticaret pazar uydusundan yapılır.
  function sellItem(s,item){return sellFraction(s,item,1);}
  function marketSatelliteLimit(s){return Math.min(D.market.maxSatellites||9,(s.market.level||1)*(D.market.satellitesPerLevel||3));}
  function marketSatelliteCount(s){return clamp(s.market.satellites||0,0,marketSatelliteLimit(s));}
  function marketCapacity(s){return D.market.baseCapacity*Math.pow(D.market.capacityGrowth,(s.market.level||1)-1)*Math.max(0,marketSatelliteCount(s))*(1+(s.repeatResearch.marketLogistics||0)*.1)*integrityFactor(s,'satellite',.45);}
  function marketCooldownSec(s){const damagePenalty=1/integrityFactor(s,'satellite',.5);return Math.max(15,D.market.baseCooldownSec*Math.pow(D.market.cooldownStep,(s.market.level||1)-1)*Math.pow(.97,s.repeatResearch.marketLogistics||0)*damagePenalty);}
  function marketUpgradeCost(s){const lv=s.market.level||1;return {coins:Math.ceil(5000*Math.pow(4,lv-1)),items:lv===1?{circuit:40,betaCore:20}:lv===2?{processor:25,gammaCore:30}:lv===3?{titaniumPlate:25,deltaCore:30}:{energyCrystal:35,omegaCore:25}};}
  function canUpgradeMarket(s){if(!s.researched.marketSatellite||s.market.level>=D.market.maxLevel)return false;const c=marketUpgradeCost(s);return s.coins>=c.coins&&Object.entries(c.items).every(([k,v])=>(s.inventory[k]||0)>=v);}
  function upgradeMarket(s){if(!canUpgradeMarket(s))return false;const c=marketUpgradeCost(s);s.coins-=c.coins;Object.entries(c.items).forEach(([k,v])=>s.inventory[k]-=v);s.market.level++;s.market.satellites=Math.min(marketSatelliteLimit(s),s.market.satellites+(D.market.satellitesPerLevel||3));return true;}
  function buyMarketSatellites(s,count){count=clamp(Math.floor(count||1),1,marketSatelliteLimit(s)-marketSatelliteCount(s));if(count<=0)return false;const cost={coins:Math.ceil(6000*Math.pow(1.55,marketSatelliteCount(s))*count),items:{circuit:15*count,orbitalParts:Math.max(0,3*count)}};if(fleetLoad(s)+count>fleetCapacity(s)||s.coins<cost.coins||Object.entries(cost.items).some(([k,v])=>(s.inventory[k]||0)<v))return false;s.coins-=cost.coins;Object.entries(cost.items).forEach(([k,v])=>s.inventory[k]-=v);s.market.satellites=marketSatelliteCount(s)+count;return true;}
  function runMarket(s,now){
    if(!s.researched.marketSatellite||!s.market.enabled||marketSatelliteCount(s)<1)return 0;
    if(!s.market.nextDispatchAt){s.market.nextDispatchAt=now+marketCooldownSec(s)*1000;return 0;}
    if(now<s.market.nextDispatchAt)return 0;
    let remain=marketCapacity(s),units=0,revenue=0;
    const ids=Object.keys(D.items).filter(k=>!D.items[k].research&&D.items[k].sell>0&&s.autoSell[k]).sort((a,b)=>D.items[b].tier-D.items[a].tier);
    ids.forEach(k=>{if(remain<=0)return;const have=s.inventory[k]||0,reserve=fuelReserve(s,k),keep=Math.max(reserve,storageCap(s,k)*(s.autoSellKeep[k]||0)/100),avail=Math.max(0,have-keep),amt=Math.min(avail,remain);if(amt>0){s.inventory[k]-=amt;remain-=amt;units+=amt;revenue+=amt*D.items[k].sell;}});
    if(revenue>0){addCoins(s,revenue);s.stats.marketDispatches++;s.market.totalRevenue+=revenue;}
    s.market.lastRevenue=revenue;s.market.lastUnits=units;s.market.lastDispatchAt=now;s.market.nextDispatchAt=now+marketCooldownSec(s)*1000;return revenue;
  }
  function runAutoSell(s){return runMarket(s,Date.now());}

  // ===== Araştırma =====
  const researchDef=id=>D.research.find(x=>x.id===id);
  const repeatDef=id=>D.repeatableResearch.find(x=>x.id===id);
  function researchQueueCapacity(s){return s.researched.omegaScience?3:s.researched.advElectronics?2:1;}
  function researchLabSpeed(s,t){
    const lab=t.lab||'alphaLab',m=s.machines[lab],lv=machineLevel(s,lab);
    if(!m||m.count<1||lv<(t.labLevel||1))return 0;
    // Laboratuvar spam'i araştırmayı anlamsızlaştırmasın: adet katkısı logaritmik,
    // bina seviyesi katkısı kontrollü ve toplam hız en fazla x4'tür.
    const levelBonus=1+(lv-1)*.25;
    const countBonus=1+Math.log2(Math.max(1,m.count))*.4;
    return Math.min(4,Math.max(1,levelBonus*countBonus));
  }
  function requirementMissing(s,t){
    const out=[],r=t.requirements||{},lab=mDef(t.lab||'alphaLab'),speed=researchLabSpeed(s,t);
    if(!speed)out.push(`${lab?lab.name:'Laboratuvar'} Mk ${t.labLevel||1} ve en az 1 adet gerekli`);
    (t.prereq||[]).forEach(id=>{if(!s.researched[id])out.push(`${researchDef(id)?.name||id} tamamlanmalı`);});
    if(s.coins<(t.coins||0))out.push(`${N.format((t.coins||0)-s.coins)} kredi eksik`);
    Object.entries(t.cost||{}).forEach(([k,v])=>{if((s.inventory[k]||0)<v)out.push(`${D.items[k].name}: ${N.format(v-(s.inventory[k]||0))} eksik`);});
    if(r.machineTotal&&machineCountTotal(s)<r.machineTotal)out.push(`Toplam ${r.machineTotal} makine gerekli`);
    if(r.sectors&&openSectorList(s).length<r.sectors)out.push(`${r.sectors} açık bölge gerekli`);
    if(r.ships&&D.ships.reduce((n,d)=>n+(s.galaxy.ships[d.id]||0),0)<r.ships)out.push(`${r.ships} gemi gerekli`);
    if(r.battlesWon&&(s.stats.battlesWon||0)<r.battlesWon)out.push(`${r.battlesWon} uzay zaferi gerekli`);
    return out;
  }
  function isResearchVisible(s,id){const t=researchDef(id);return !!t&&((t.prereq||[]).some(p=>s.researched[p])||!(t.prereq||[]).length||s.researched[id]);}
  function isResearchScheduled(s,kind,id){const rp=s.researchProgress||{};return !!(rp.active&&rp.active.kind===kind&&rp.active.id===id)||(rp.queue||[]).some(x=>x.kind===kind&&x.id===id);}
  function researchMissing(s,id){const t=researchDef(id);if(!t)return ['Araştırma bulunamadı'];if(s.researched[id])return ['Tamamlandı'];if(isResearchScheduled(s,'main',id))return ['Araştırma sırasına alındı'];const out=requirementMissing(s,t);if((s.researchProgress.active?1:0)+s.researchProgress.queue.length>=researchQueueCapacity(s))out.push('Araştırma kuyruğu dolu');return out;}
  function canResearch(s,id){return researchMissing(s,id).length===0;}
  function makeResearchJob(s,kind,id,cost,coins,durationSec,lab,labLevel){return {kind,id,cost:copy(cost||{}),coins:coins||0,durationSec,lab,labLevel,startedAt:0,finishAt:0};}
  function activateResearch(s,job,startAt){const t=job.kind==='main'?researchDef(job.id):repeatDef(job.id),speed=job.kind==='main'?researchLabSpeed(s,t):researchLabSpeed(s,{lab:'omegaLab',labLevel:1});job.startedAt=startAt||Date.now();job.finishAt=job.startedAt+Math.ceil(job.durationSec/Math.max(1,speed))*1000;s.researchProgress.active=job;}
  function enqueueJob(s,job){if(!s.researchProgress.active)activateResearch(s,job,Date.now());else s.researchProgress.queue.push(job);}
  function doResearch(s,id){if(!canResearch(s,id))return false;const t=researchDef(id);s.coins-=t.coins||0;Object.entries(t.cost).forEach(([k,v])=>s.inventory[k]-=v);enqueueJob(s,makeResearchJob(s,'main',id,t.cost,t.coins,t.durationSec,t.lab,t.labLevel));return true;}
  function repeatCost(s,id){const r=repeatDef(id),lv=s.repeatResearch[id]||0,out={};if(!r)return null;Object.entries(r.base).forEach(([k,v])=>out[k]=Math.ceil(v*Math.pow(r.growth,lv)));return out;}
  function repeatDuration(s,id){const r=repeatDef(id),lv=s.repeatResearch[id]||0;return Math.ceil((r?.durationSec||259200)*Math.pow(1.22,lv));}
  function repeatMissing(s,id){const r=repeatDef(id);if(!r)return ['Araştırma bulunamadı'];if(!s.researched.omegaScience)return ['Omega Bilimi gerekli'];if(isResearchScheduled(s,'repeat',id))return ['Araştırma sırasına alındı'];const out=[],cost=repeatCost(s,id);if(!researchLabSpeed(s,{lab:'omegaLab',labLevel:1}))out.push('En az 1 Omega İstasyonu gerekli');Object.entries(cost||{}).forEach(([k,v])=>{if((s.inventory[k]||0)<v)out.push(`${D.items[k].name}: ${N.format(v-(s.inventory[k]||0))} eksik`);});if((s.researchProgress.active?1:0)+s.researchProgress.queue.length>=researchQueueCapacity(s))out.push('Araştırma kuyruğu dolu');return out;}
  function canRepeatResearch(s,id){return repeatMissing(s,id).length===0;}
  function doRepeatResearch(s,id){if(!canRepeatResearch(s,id))return false;const c=repeatCost(s,id),r=repeatDef(id);Object.entries(c).forEach(([k,v])=>s.inventory[k]-=v);enqueueJob(s,makeResearchJob(s,'repeat',id,c,0,repeatDuration(s,id),'omegaLab',1));return true;}
  function completeResearchJob(s,job){if(job.kind==='main')s.researched[job.id]=true;else s.repeatResearch[job.id]=(s.repeatResearch[job.id]||0)+1;}
  function tickResearch(s,now){
    let completed=[];while(s.researchProgress.active&&s.researchProgress.active.finishAt<=now){const done=s.researchProgress.active,at=done.finishAt;completeResearchJob(s,done);completed.push(done);s.researchProgress.active=null;const next=s.researchProgress.queue.shift();if(next)activateResearch(s,next,at);}return completed;
  }
  function cancelResearch(s){const a=s.researchProgress.active;if(!a)return false;const refund=.7;s.coins+=Math.floor((a.coins||0)*refund);Object.entries(a.cost||{}).forEach(([k,v])=>s.inventory[k]=Math.min(storageCap(s,k),(s.inventory[k]||0)+v*refund));s.researchProgress.active=null;const next=s.researchProgress.queue.shift();if(next)activateResearch(s,next,Date.now());return true;}
  function researchProgressInfo(s,now){const a=s.researchProgress.active;if(!a)return null;now=now||Date.now();const total=Math.max(1,a.finishAt-a.startedAt),left=Math.max(0,a.finishAt-now);return Object.assign({},a,{progress:clamp(1-left/total,0,1),leftSec:left/1000});}

  // ===== Filo / Galaksi / Savaş / Bakım =====
  function targetById(s,id){return s.galaxy.targets.find(t=>t.id===id);}
  function reportById(s,id){return (s.galaxy.reports||[]).find(r=>r.id===id)||null;}
  function addReport(s,type,title,body,details){
    const report={id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),type,title,body,time:Date.now(),details:details||null,read:false};
    s.galaxy.reports.unshift(report);s.galaxy.reports=s.galaxy.reports.slice(0,200);return report;
  }
  function frontierTarget(s){
    const depth=Math.max(1,(s.galaxy.frontierGenerated||0)+1),types=['Korsan Konfederasyonu','Biyolojik Kovan','Makine Uygarlığı','Rakip İmparatorluk','Kadim Muhafız'];
    const type=types[(depth-1)%types.length],strength=Math.ceil(D.frontier.baseStrength*Math.pow(D.frontier.strengthGrowth,depth-1));
    const distance=Number((D.frontier.distanceBase+(depth-1)*D.frontier.distanceGrowth).toFixed(1)),lootScale=Math.pow(1.42,depth-1);
    return {id:`frontier-${depth}`,name:`Sonsuz Cephe ${String(depth).padStart(2,'0')}`,type,distance,strength,loot:{coins:Math.ceil(750000*lootScale),omegaCore:Math.ceil(30+depth*8),alienAlloy:Math.ceil(18+depth*5),starFuel:Math.ceil(40+depth*7)},threat:Math.min(20,7+depth*.65),discovered:false,defeated:false,colonized:false,recoveryAt:0,victories:0,scannedAt:0,index:D.galaxyTargets.length+depth-1,procedural:true,frontierDepth:depth,colonizable:depth%5===0};
  }
  function scanCost(s){
    const discovered=s.galaxy.targets.filter(t=>t.discovered).length,frontier=Math.max(0,s.galaxy.frontierGenerated||0);
    if(frontier>0||(!s.galaxy.targets.some(t=>!t.discovered)&&s.researched.frontierDoctrine))return {coins:Math.ceil(D.frontier.scanCoinBase*Math.pow(D.frontier.scanGrowth,frontier)),processor:Math.ceil(40*Math.pow(1.22,frontier)),starFuel:Math.ceil(12+frontier*4)};
    return {coins:Math.ceil(2500*Math.pow(1.9,discovered)),processor:Math.ceil(5*Math.pow(1.35,discovered)),starFuel:0};
  }
  function canScan(s){
    const c=scanCost(s),hasTarget=s.galaxy.targets.some(t=>!t.discovered)||!!s.researched.frontierDoctrine;
    return !!s.researched.scanner&&Date.now()>=s.galaxy.scanCooldownUntil&&hasTarget&&s.coins>=c.coins&&(s.inventory.processor||0)>=c.processor&&(s.inventory.starFuel||0)>=(c.starFuel||0);
  }
  function scanNextTarget(s){
    if(!canScan(s))return null;const c=scanCost(s);let t=s.galaxy.targets.find(x=>!x.discovered);
    if(!t&&s.researched.frontierDoctrine){t=frontierTarget(s);s.galaxy.targets.push(t);s.galaxy.frontierGenerated=t.frontierDepth;}
    if(!t)return null;s.coins-=c.coins;s.inventory.processor-=c.processor||0;s.inventory.starFuel-=c.starFuel||0;t.discovered=true;t.scannedAt=Date.now();s.galaxy.scanCooldownUntil=Date.now()+30000;s.stats.systemsScanned++;
    addReport(s,'scan',`🔭 ${t.name} keşfedildi`,`${t.type} · Mesafe ${t.distance} LY · Tahmini güç ${N.format(t.strength)}`,{category:'intel',target:copy(t),cost:copy(c)});return t;
  }


  function canSpyTarget(s,targetId){const t=targetById(s,targetId);return !!t&&t.discovered&&!t.defeated&&!!s.researched.scanner&&(s.galaxy.ships.spyProbe||0)>0&&(s.inventory.starFuel||0)>=Math.max(1,t.distance*.5);}
  function spyTarget(s,targetId){
    const t=targetById(s,targetId); if(!canSpyTarget(s,targetId))return false;
    s.galaxy.ships.spyProbe--; s.inventory.starFuel-=Math.max(1,t.distance*.5);
    const loss=Math.random()<Math.min(.35,.06+t.threat*.025); if(!loss)s.galaxy.ships.spyProbe++;
    const intel={category:'intel',target:{id:t.id,name:t.name,type:t.type,strength:t.strength,distance:t.distance,threat:t.threat},espionage:{probeLost:loss,defenseHint:Math.round(t.strength*(.92+Math.random()*.16)),lootHint:copy(t.loot||{}),counterRisk:Math.round(Math.min(95,(t.threat*7)+(loss?20:0)))} };
    addReport(s,'spy',`📡 ${t.name} casusluk raporu`,`${loss?'Casus sondası kaybedildi.':'Casus sondası geri döndü.'} Tahmini savunma ${N.format(intel.espionage.defenseHint)} · Karşı saldırı riski %${intel.espionage.counterRisk}.`,intel);
    s.galaxy.threat+=loss?0.25:0.1; return true;
  }

  function colonyCost(s,targetId){
    const t=targetById(s,targetId),n=Math.max(1,s.galaxy.colonies||1);
    return t?{coins:Math.ceil(70000*Math.pow(1.85,n-1)*t.distance),items:{titaniumPlate:20+10*n,machinery:15+8*n,starFuel:20+10*n,orbitalParts:Math.max(0,5*(n-1))}}:null;
  }
  function canColonize(s,targetId){
    const t=targetById(s,targetId),c=colonyCost(s,targetId);
    return !!t&&t.defeated&&!t.colonized&&t.colonizable!==false&&!!s.researched.colonization&&s.coins>=c.coins&&Object.entries(c.items).every(([k,v])=>(s.inventory[k]||0)>=v);
  }
  function colonizeTarget(s,targetId){
    if(!canColonize(s,targetId))return false;const t=targetById(s,targetId),c=colonyCost(s,targetId);s.coins-=c.coins;Object.entries(c.items).forEach(([k,v])=>s.inventory[k]-=v);t.colonized=true;s.galaxy.colonies=(s.galaxy.colonies||1)+1;s.galaxy.threat+=t.threat*.35;addReport(s,'colony',`🪐 ${t.name} kolonileştirildi`,`İmparatorluk üretimine kalıcı +%4 katkı sağlıyor.`,{category:'empire',targetId:t.id,colonyCount:s.galaxy.colonies});return true;
  }

  function canBuildShip(s,id,count){const d=shipDef(id);count=Math.max(1,Math.floor(count||1));return !!d&&(!d.tech||s.researched[d.tech])&&fleetLoad(s)+count<=fleetCapacity(s)&&Object.entries(d.cost).every(([k,v])=>(s.inventory[k]||0)>=v*count);}
  function queueShip(s,id,count){
    count=clamp(Math.floor(count||1),1,99);if(!canBuildShip(s,id,count))return false;const d=shipDef(id);Object.entries(d.cost).forEach(([k,v])=>s.inventory[k]-=v*count);
    const last=s.galaxy.shipQueue[s.galaxy.shipQueue.length-1],start=Math.max(Date.now(),last?last.finishAt:0),speed=(1+(s.repeatResearch.industrialEfficiency||0)*.02)*integrityFactor(s,'orbital',.45);
    s.galaxy.shipQueue.push({id:'sq'+Date.now()+Math.random(),shipId:id,count,finishAt:start+d.buildSec*count*1000/Math.max(.1,speed)});return true;
  }
  function canBuildDefense(s,id,count){const d=defenseDef(id);count=Math.max(1,Math.floor(count||1));return !!d&&(!d.tech||s.researched[d.tech])&&defenseLoad(s)+count<=defenseCapacity(s)&&Object.entries(d.cost).every(([k,v])=>(s.inventory[k]||0)>=v*count);}
  function buildDefense(s,id,count){count=clamp(Math.floor(count||1),1,99);if(!canBuildDefense(s,id,count))return false;const d=defenseDef(id);Object.entries(d.cost).forEach(([k,v])=>s.inventory[k]-=v*count);s.galaxy.defenses[id]=(s.galaxy.defenses[id]||0)+count;return true;}
  function fleetStats(selection,s){let attack=0,hull=0,cargo=0,speed=99,fuel=0,total=0;D.ships.forEach(d=>{const n=Math.max(0,Math.floor(selection[d.id]||0));if(!n)return;total+=n;attack+=n*d.attack;hull+=n*d.hull;cargo+=n*d.cargo;speed=Math.min(speed,d.speed);fuel+=n*d.fuel;});return {attack,hull,cargo,speed:speed===99?0:speed,fuel,total};}
  function weaponMult(s){return (s.researched.plasmaWeapons?1.2:1)*(1+(s.repeatResearch.weaponSystems||0)*.07)*integrityFactor(s,'orbital',.75);}
  function shieldMult(s){return (s.researched.phaseShields?1.2:1)*(1+(s.repeatResearch.shieldSystems||0)*.07);}
  function travelSeconds(s,target,selection){const fs=fleetStats(selection,s),warp=1+(s.repeatResearch.warpNavigation||0)*.08+(s.researched.warpDrive ? .25 : 0),frontier=1+(s.repeatResearch.frontierLogistics||0)*.025;return Math.max(12,target.distance*55/(Math.max(.25,fs.speed)*warp*frontier*integrityFactor(s,'orbital',.6)));}
  function canSendFleet(s,targetId,selection){const t=targetById(s,targetId),fs=fleetStats(selection,s);if(!t||!t.discovered||t.defeated||!s.researched.fleetCommand||fs.total<1)return false;const available=D.ships.every(d=>(selection[d.id]||0)<=(s.galaxy.ships[d.id]||0));const fuel=fs.fuel*t.distance/Math.max(1,1+(s.repeatResearch.frontierLogistics||0)*.02);return available&&(s.inventory.starFuel||0)>=fuel&&!s.galaxy.missions.some(m=>m.targetId===targetId&&m.status!=='done');}
  function sendFleet(s,targetId,selection){
    selection=Object.fromEntries(D.ships.map(d=>[d.id,Math.max(0,Math.floor(selection[d.id]||0))]));if(!canSendFleet(s,targetId,selection))return false;
    const t=targetById(s,targetId),fs=fleetStats(selection,s),fuel=fs.fuel*t.distance/Math.max(1,1+(s.repeatResearch.frontierLogistics||0)*.02);D.ships.forEach(d=>s.galaxy.ships[d.id]-=selection[d.id]||0);s.inventory.starFuel-=fuel;
    const sec=travelSeconds(s,t,selection);s.galaxy.missions.push({id:'m'+Date.now()+Math.random(),targetId,status:'outbound',ships:selection,initialShips:copy(selection),arrivalAt:Date.now()+sec*1000,returnAt:0,pendingLoot:null,pendingSalvage:null,damagedShips:null,battle:null});s.galaxy.threat+=t.threat*.6;addReport(s,'mission',`🚀 Filo ${t.name} hedefine çıktı`,`Varış süresi yaklaşık ${N.formatTime(sec)}.`,{category:'mission',targetId,ships:copy(selection),fuel,travelSec:sec});return true;
  }
  function splitFleet(selection,surviveRatio,damageRatio){
    const operational={},damaged={},lost={};D.ships.forEach(d=>{const before=Math.max(0,Math.floor(selection[d.id]||0)),survive=Math.max(0,Math.min(before,Math.floor(before*surviveRatio))),hurt=Math.max(0,Math.min(survive,Math.round(survive*damageRatio)));damaged[d.id]=hurt;operational[d.id]=survive-hurt;lost[d.id]=before-survive;});return {operational,damaged,lost};
  }
  function salvageFromBattle(s,target,lost,won){
    let hullLost=0,electronicsLost=0;D.ships.forEach(d=>{const n=lost[d.id]||0;hullLost+=n*d.hull;electronicsLost+=n*(d.attack+d.cargo)*.08;});
    const bonus=1+(s.repeatResearch.salvageRecovery||0)*.06,enemy=won?target.strength:target.strength*.12;
    return {scrapMetal:Math.ceil((hullLost*.17+enemy*.025)*bonus),wreckCircuit:Math.ceil((electronicsLost*.12+enemy*.004)*bonus),alienAlloy:Math.ceil((won?target.threat*2+enemy*.0008:enemy*.00015)*bonus)};
  }
  function simulateBattle(s,target,selection){
    const fs=fleetStats(selection,s),pStart=Math.max(1,fs.hull*shieldMult(s)),eStart=Math.max(1,target.strength*1.28),basePlayerAttack=fs.attack*weaponMult(s),baseEnemyAttack=target.strength*.57;
    let pHull=pStart,eHull=eStart;const rounds=[];for(let round=1;round<=6&&pHull>0&&eHull>0;round++){
      const pRoll=.88+Math.random()*.24,eRoll=.88+Math.random()*.24,pCondition=.55+.45*(pHull/pStart),eCondition=.55+.45*(eHull/eStart),pDamage=basePlayerAttack*pRoll*pCondition,eDamage=baseEnemyAttack*eRoll*eCondition;
      eHull=Math.max(0,eHull-pDamage);pHull=Math.max(0,pHull-eDamage);rounds.push({round,playerRoll:pRoll,enemyRoll:eRoll,playerDamage:pDamage,enemyDamage:eDamage,playerHull:pHull,enemyHull:eHull});
    }
    const pRatio=pHull/pStart,eRatio=eHull/eStart,won=eHull<=0||(pHull>0&&pRatio>eRatio*1.08),surviveRatio=clamp(won ? .18+.82*pRatio : .62*pRatio,0,1),damageRatio=clamp(.16+(1-pRatio)*.62+(won?0:.12),.08,.82),split=splitFleet(selection,surviveRatio,damageRatio);
    return {won,rounds,playerStartHull:pStart,enemyStartHull:eStart,playerEndHull:pHull,enemyEndHull:eHull,playerAttack:basePlayerAttack,enemyAttack:baseEnemyAttack,surviveRatio,damageRatio,...split};
  }
  function mergeFleetCounts(a,b){const out={};D.ships.forEach(d=>out[d.id]=(a?.[d.id]||0)+(b?.[d.id]||0));return out;}
  function loadCargo(items,capacity){
    const loaded={},abandoned={};let left=Math.max(0,Math.floor(capacity||0)),used=0;
    Object.entries(items||{}).forEach(([k,v])=>{const amount=Math.max(0,Math.floor(v||0)),take=Math.min(left,amount);if(take)loaded[k]=take;if(amount>take)abandoned[k]=amount-take;left-=take;used+=take;});
    return {loaded,abandoned,used,capacity:Math.max(0,Math.floor(capacity||0))};
  }
  function resolveBattle(s,mission,now){
    const t=targetById(s,mission.targetId),sim=simulateBattle(s,t,mission.ships);mission.ships=sim.operational;mission.damagedShips=sim.damaged;mission.battle=sim;
    const survivors=mergeFleetCounts(sim.operational,sim.damaged),survivorStats=fleetStats(survivors,s),hasSurvivor=survivorStats.total>0;
    const rawSalvage=salvageFromBattle(s,t,sim.lost,sim.won),lootScale=sim.won?(1+(t.victories||0)*.12)*(1+(s.repeatResearch.frontierLogistics||0)*.05):0,rawLoot={};
    if(sim.won)Object.entries(t.loot||{}).forEach(([k,v])=>rawLoot[k]=Math.ceil(v*lootScale));
    const coinLoot=hasSurvivor?Math.max(0,rawLoot.coins||0):0;delete rawLoot.coins;
    const lootCargo=loadCargo(hasSurvivor?rawLoot:{},survivorStats.cargo),salvageCargo=loadCargo(hasSurvivor?rawSalvage:{},Math.max(0,survivorStats.cargo-lootCargo.used));
    mission.pendingLoot=sim.won&&hasSurvivor?Object.assign(coinLoot?{coins:coinLoot}:{},lootCargo.loaded):{};
    mission.pendingSalvage=salvageCargo.loaded;
    mission.unrecovered={loot:lootCargo.abandoned,salvage:salvageCargo.abandoned};
    if(sim.won){
      t.defeated=true;t.victories=(t.victories||0)+1;t.recoveryAt=now+(t.procedural?D.frontier.recoverySec:180+t.threat*55)*1000;s.stats.battlesWon++;if(t.procedural){s.galaxy.frontierDepth=Math.max(s.galaxy.frontierDepth||0,t.frontierDepth||0);s.stats.frontierVictories++;}
      s.galaxy.threat+=t.threat;
    }else s.stats.battlesLost++;
    const losses=Object.values(sim.lost).reduce((a,b)=>a+b,0),damaged=Object.values(sim.damaged).reduce((a,b)=>a+b,0),title=sim.won?`🏆 ${t.name} yenildi`:`☠️ ${t.name} saldırısı başarısız`,body=`${sim.rounds.length} tur · ${losses} gemi kaybı · ${damaged} gemi hasarlı · ${hasSurvivor?`${lootCargo.used+salvageCargo.used}/${survivorStats.cargo} kargo kullanıldı`:'geri dönen gemi yok'}.`;
    const r=addReport(s,sim.won?'battle-win':'battle-loss',title,body,{category:'battle',outcome:sim.won?'victory':'defeat',target:{id:t.id,name:t.name,type:t.type,strength:t.strength,threat:t.threat},fleetBefore:copy(mission.initialShips||mission.ships),operational:copy(sim.operational),damaged:copy(sim.damaged),lost:copy(sim.lost),rounds:copy(sim.rounds),modifiers:{weapon:weaponMult(s),shield:shieldMult(s),orbitalIntegrity:s.maintenance.integrity.orbital},cargo:{capacity:survivorStats.cargo,used:lootCargo.used+salvageCargo.used},salvage:copy(mission.pendingSalvage),loot:copy(mission.pendingLoot),unrecovered:copy(mission.unrecovered)});mission.reportId=r.id;
    mission.status='returning';mission.returnAt=now+travelSeconds(s,t,survivors)*1000;
  }
  function addInventoryCapped(s,k,v){if(!D.items[k])return;s.inventory[k]=Math.min(storageCap(s,k),(s.inventory[k]||0)+Math.max(0,v||0));}
  function deliverMission(s,m){
    D.ships.forEach(d=>{s.galaxy.ships[d.id]=(s.galaxy.ships[d.id]||0)+(m.ships[d.id]||0);s.maintenance.damagedShips[d.id]=(s.maintenance.damagedShips[d.id]||0)+(m.damagedShips?.[d.id]||0);});
    if(m.pendingLoot)Object.entries(m.pendingLoot).forEach(([k,v])=>{if(k==='coins')addCoins(s,v);else addInventoryCapped(s,k,v);});
    if(m.pendingSalvage){Object.entries(m.pendingSalvage).forEach(([k,v])=>addInventoryCapped(s,k,v));s.stats.salvageRecovered+=Object.values(m.pendingSalvage).reduce((a,b)=>a+b,0);}
    m.status='done';addReport(s,'return','🏠 Filo üsse döndü',m.pendingLoot?'Ganimet ve enkaz depoya aktarıldı; hasarlı gemiler kuru havuza alındı.':'Sağ kalan gemiler üsse döndü.',{category:'mission',sourceReportId:m.reportId,damaged:copy(m.damagedShips||{}),salvage:copy(m.pendingSalvage||{})});
  }
  function defenseStats(s){let attack=0,hull=0;D.defenses.forEach(d=>{const n=s.galaxy.defenses[d.id]||0;attack+=n*d.attack;hull+=n*d.hull;});return {attack:attack*weaponMult(s),hull:hull*shieldMult(s)};}
  function damageDefenses(s,severity){
    const damaged={},destroyed={};D.defenses.forEach(d=>{const n=s.galaxy.defenses[d.id]||0,affected=Math.min(n,Math.floor(n*clamp(severity*.72,0,.75))),dead=Math.min(affected,Math.floor(affected*.24));damaged[d.id]=affected-dead;destroyed[d.id]=dead;s.galaxy.defenses[d.id]-=affected;s.maintenance.damagedDefenses[d.id]=(s.maintenance.damagedDefenses[d.id]||0)+damaged[d.id];});return {damaged,destroyed};
  }
  function applyZoneDamage(s,zone,points){s.maintenance.integrity[zone]=clamp((s.maintenance.integrity[zone]??100)-Math.max(0,points),0,100);s.maintenance.lastDamageAt=Date.now();}
  function resolveRaid(s,now){
    const threat=Math.max(1,s.galaxy.threat),enemy=220+threat*145+s.stats.battlesWon*180+(s.galaxy.frontierDepth||0)*420,ds=defenseStats(s),ammoNeed=Math.ceil(enemy*.05),ammoHave=s.inventory.ammunition||0,ammoRatio=Math.min(1,ammoHave/Math.max(1,ammoNeed));s.inventory.ammunition=Math.max(0,ammoHave-ammoNeed*ammoRatio);
    const defensePower=(ds.attack+ds.hull*.34)*(.28+.72*ammoRatio)*integrityFactor(s,'planet',.65),won=defensePower>=enemy,severity=won?clamp(enemy/Math.max(1,defensePower)*.035,.01,.07):clamp((enemy-defensePower)/enemy,.10,.34),defLoss=damageDefenses(s,severity);
    applyZoneDamage(s,'orbital',severity*(won?18:42));applyZoneDamage(s,'satellite',severity*(won?24:58));applyZoneDamage(s,'planet',severity*(won?12:48));
    const salvageBonus=1+(s.repeatResearch.salvageRecovery||0)*.06,salvage={scrapMetal:Math.ceil(enemy*.018*salvageBonus),wreckCircuit:Math.ceil(enemy*.0035*salvageBonus),alienAlloy:Math.ceil(threat*.7*salvageBonus)};Object.entries(salvage).forEach(([k,v])=>addInventoryCapped(s,k,v));s.stats.salvageRecovered+=Object.values(salvage).reduce((a,b)=>a+b,0);
    let inventoryLossPct=0,reward=0;if(won){reward=Math.ceil(enemy*13);addCoins(s,reward);s.stats.raidsWon++;s.galaxy.threat=Math.max(0,s.galaxy.threat*.84);}else{inventoryLossPct=clamp(severity*.42,.04,.16);Object.keys(D.items).forEach(k=>{const it=D.items[k];if(it.research||['scrapMetal','wreckCircuit','alienAlloy'].includes(k))return;s.inventory[k]=Math.max(0,(s.inventory[k]||0)*(1-inventoryLossPct));});s.stats.raidsLost++;s.galaxy.threat+=1.4;}
    const title=won?'🛡️ Uzaylı baskını püskürtüldü':'🚨 Koloni savunması yarıldı',body=`Savunma ${N.format(defensePower)} / düşman ${N.format(enemy)} · Mühimmat etkinliği %${Math.round(ammoRatio*100)} · Hasar bakım sistemine kaydedildi.`;
    addReport(s,won?'raid-win':'raid-loss',title,body,{category:'raid',outcome:won?'victory':'defeat',enemyPower:enemy,defensePower,ammoNeed,ammoUsed:Math.min(ammoHave,ammoNeed),ammoRatio,phases:[{name:'Yörünge Hattı',damage:severity*(won?18:42),integrity:s.maintenance.integrity.orbital},{name:'Uydu Ağı',damage:severity*(won?24:58),integrity:s.maintenance.integrity.satellite},{name:'Gezegen Yüzeyi',damage:severity*(won?12:48),integrity:s.maintenance.integrity.planet}],defenses:copy(defLoss),inventoryLossPct,salvage,reward});
    s.galaxy.nextRaidAt=now+(D.economyConfig.raidBaseSec+Math.random()*420)*1000;s.galaxy.raidWarningShown=false;
  }

  const facilityDef=id=>(D.repairFacilities||[]).find(x=>x.id===id);
  function facilityLevel(s,id){return clamp(Math.floor(Number(s.maintenance.facilities[id]||0)),0,5);}
  function facilityUpgradeCost(s,id){const d=facilityDef(id),lv=facilityLevel(s,id),target=lv+1;if(!d||target>d.maxLevel)return null;const items={repairKit:10*target};if(d.zone!=='planet')items.orbitalParts=5*target;if(target>=3)items.machinery=8*target;if(target>=5)items.nanoGel=10;return {target,coins:Math.ceil(18000*Math.pow(3.1,target-1)),items,tech:d.tech};}

  // v4.3: büyük bağlantı listelerinde fabrika silme işlemini sabit bellekle yap.
  // Array.filter ile iki yeni dev dizi üretmek, bazı cihazlarda ana thread'i kilitliyordu.
  function compactLinksInPlace(list,id){
    let write=0;
    for(let read=0;read<list.length;read++){
      const link=list[read];
      if(link&&link.from!==id&&link.to!==id) list[write++]=link;
    }
    list.length=write;
  }
  function removeEntity(s,id){
    const e=s.grid.entities[id];if(!e)return false;
    if(e.type==='machine'){
      const d=mDef(e.defId),m=s.machines[e.defId];
      if(m&&m.count>0)m.count--;
      if(d&&m)s.coins=N.add(s.coins,buildCostFromCount(d,Math.max(0,m.count))*.45);
    }else{
      const d=pDef(e.defId),p=s.plants[e.defId];
      if(p&&p.count>0)p.count--;
      if(d&&p)s.coins=N.add(s.coins,plantCostFromCount(d,Math.max(0,p.count))*.45);
    }
    delete s.grid.entities[id];
    compactLinksInPlace(s.grid.conveyors,id);
    compactLinksInPlace(s.grid.powerLines,id);
    return true;
  }

  function canUpgradeFacility(s,id){const c=facilityUpgradeCost(s,id);if(!c||!s.researched[c.tech])return false;return s.coins>=c.coins&&Object.entries(c.items).every(([k,v])=>(s.inventory[k]||0)>=v);}
  function upgradeFacility(s,id){if(!canUpgradeFacility(s,id))return false;const c=facilityUpgradeCost(s,id);s.coins-=c.coins;Object.entries(c.items).forEach(([k,v])=>s.inventory[k]-=v);s.maintenance.facilities[id]=c.target;return true;}
  function repairEfficiency(s){return Math.max(.45,1-(s.repeatResearch.repairEfficiency||0)*.04);}
  function repairJobCost(s,kind,id,amount){amount=Math.max(1,Math.floor(amount||1));const items={};let points=amount,facility='planetWorkshop';
    if(kind==='zone'){facility=id==='planet'?'planetWorkshop':id==='orbital'?'orbitalDrydock':'satelliteHub';items.repairKit=Math.ceil(points*.45*repairEfficiency(s));if(id!=='planet')items.orbitalParts=Math.ceil(points*.16*repairEfficiency(s));if(points>25)items.nanoGel=Math.ceil(points/25);}
    else if(kind==='ship'){const d=shipDef(id);facility='orbitalDrydock';points=d.hull*amount/20;items.repairKit=Math.ceil(d.hull*amount/32*repairEfficiency(s));items.orbitalParts=Math.ceil(amount*.6*repairEfficiency(s));if(d.hull>=250)items.nanoGel=Math.ceil(amount*.35);}
    else {const d=defenseDef(id);facility='planetWorkshop';points=d.hull*amount/25;items.repairKit=Math.ceil(d.hull*amount/45*repairEfficiency(s));if(d.id==='shield')items.nanoGel=Math.ceil(amount*.3);}
    const fd=facilityDef(facility),lv=facilityLevel(s,facility),seconds=Math.ceil(points*(fd?.baseSecPerPoint||20)/Math.max(1,lv)*repairEfficiency(s));return {kind,id,amount,facility,items,seconds:Math.max(5,seconds)};
  }
  function repairAvailableAmount(s,kind,id){
    if(kind==='zone'){
      const raw=Math.floor(Math.max(0,100-(s.maintenance.integrity[id]??100)));
      const reserved=(s.maintenance.repairQueue||[]).filter(j=>j.kind==='zone'&&j.targetId===id).reduce((n,j)=>n+(j.amount||0),0);
      return Math.max(0,raw-reserved);
    }
    if(kind==='ship')return s.maintenance.damagedShips[id]||0;
    return s.maintenance.damagedDefenses[id]||0;
  }
  function canQueueRepair(s,kind,id,amount){const c=repairJobCost(s,kind,id,amount);if(facilityLevel(s,c.facility)<1||!s.researched[facilityDef(c.facility)?.tech])return false;if(repairAvailableAmount(s,kind,id)<c.amount)return false;return Object.entries(c.items).every(([k,v])=>(s.inventory[k]||0)>=v);}
  function queueRepair(s,kind,id,amount){
    amount=Math.max(1,Math.floor(amount||1));if(!canQueueRepair(s,kind,id,amount))return false;const c=repairJobCost(s,kind,id,amount);Object.entries(c.items).forEach(([k,v])=>s.inventory[k]-=v);if(kind==='ship')s.maintenance.damagedShips[id]-=amount;else if(kind==='defense')s.maintenance.damagedDefenses[id]-=amount;
    const facilityJobs=s.maintenance.repairQueue.filter(j=>j.facility===c.facility),last=facilityJobs.reduce((a,j)=>!a||j.finishAt>a.finishAt?j:a,null),start=Math.max(Date.now(),last?last.finishAt:0);s.maintenance.repairQueue.push({id:'rep'+Date.now()+Math.random(),kind,targetId:id,amount,facility:c.facility,cost:copy(c.items),startedAt:start,finishAt:start+c.seconds*1000});return true;
  }
  function finishRepair(s,j){if(j.kind==='zone')s.maintenance.integrity[j.targetId]=clamp((s.maintenance.integrity[j.targetId]||0)+j.amount,0,100);else if(j.kind==='ship')s.galaxy.ships[j.targetId]=(s.galaxy.ships[j.targetId]||0)+j.amount;else s.galaxy.defenses[j.targetId]=(s.galaxy.defenses[j.targetId]||0)+j.amount;s.stats.repairsCompleted+=(j.amount||1);addReport(s,'repair','🧰 Tamirat tamamlandı',`${j.amount} ${j.kind==='zone'?'hasar puanı':j.kind==='ship'?shipDef(j.targetId)?.name:defenseDef(j.targetId)?.name} yeniden hizmete alındı.`,{category:'maintenance',job:copy(j)});}
  function tickMaintenance(s,now){
    const done=s.maintenance.repairQueue.filter(j=>j.finishAt<=now).sort((a,b)=>a.finishAt-b.finishAt);
    s.maintenance.repairQueue=s.maintenance.repairQueue.filter(j=>j.finishAt>now);
    done.forEach(j=>finishRepair(s,j));
  }
  function maintenanceStatus(s){return {integrity:copy(s.maintenance.integrity),facilities:copy(s.maintenance.facilities),damagedShips:copy(s.maintenance.damagedShips),damagedDefenses:copy(s.maintenance.damagedDefenses),queue:copy(s.maintenance.repairQueue)};}

  function tickGalaxy(s,now){
    while(s.galaxy.shipQueue.length&&s.galaxy.shipQueue[0].finishAt<=now){const q=s.galaxy.shipQueue.shift();s.galaxy.ships[q.shipId]=(s.galaxy.ships[q.shipId]||0)+q.count;addReport(s,'build',`${shipDef(q.shipId).icon} ${q.count} ${shipDef(q.shipId).name} tamamlandı`,'Gemiler hangara eklendi.',{category:'production',shipId:q.shipId,count:q.count});}
    s.galaxy.targets.forEach(t=>{if(t.defeated&&!t.colonized&&t.recoveryAt&&t.recoveryAt<=now){t.defeated=false;t.recoveryAt=0;t.strength=Math.ceil(t.strength*(t.procedural?1.12:1.18));addReport(s,'warning',`⚠️ ${t.name} yeniden örgütlendi`,`Yeni savunma gücü ${N.format(t.strength)}.`,{category:'intel',targetId:t.id,strength:t.strength});}});
    s.galaxy.missions.forEach(m=>{if(m.status==='outbound'&&m.arrivalAt<=now)resolveBattle(s,m,now);else if(m.status==='returning'&&m.returnAt<=now)deliverMission(s,m);});s.galaxy.missions=s.galaxy.missions.filter(m=>m.status!=='done').slice(-30);
    tickMaintenance(s,now);
    if(!s.galaxy.raidWarningShown&&s.galaxy.nextRaidAt-now<=D.economyConfig.raidWarningSec*1000&&s.galaxy.nextRaidAt>now){s.galaxy.raidWarningShown=true;addReport(s,'warning','⚠️ Uzaylı imzası algılandı','Savunma, mühimmat ve bakım ekiplerini hazırla.',{category:'intel',raidAt:s.galaxy.nextRaidAt});}
    if(now>=s.galaxy.nextRaidAt)resolveRaid(s,now);
  }

  // ===== Orbital Dominion v4.3 overrides =====
  // Bu bölüm v4.3 çekirdeğinin güvenli migrasyonunu koruyarak yeni kapasite,
  // uydu, casusluk, enkaz ve istila akışlarını tek source of truth altında toplar.
  function createInitialState(options){
    options=options||{};const s=createInitialStateBase(),planetType=D.planetTypes[options.planetType]?options.planetType:'temperate',startRegion=D.startRegions[options.startRegion]?options.startRegion:'center';
    s.version=SAVE_VERSION;s.empire={planetType,startRegion};s.planet={type:planetType,startRegion,threatBonus:D.planetTypes[planetType]?.threatBonus||0};s.infrastructure={level:1};s.settings=Object.assign({},s.settings,{operationsExpanded:false});
    D.repeatableResearch.forEach(r=>{if(!Number.isFinite(Number(s.repeatResearch[r.id])))s.repeatResearch[r.id]=0;});
    const sats={};(D.satellites||[]).forEach(d=>sats[d.id]=0);s.galaxy.satellites=sats;s.galaxy.satelliteQueue=[];
    s.galaxy.targets=mergeTargets(s.galaxy.targets);s.market.level=1;delete s.market.satellites;
    s.map={openSectors:{},nodes:{},nodeNextSeed:17};s.grid={entities:{},conveyors:[],powerLines:[],nextId:1};s.sectorsOpened=0;initMap(s);return s;
  }
  function normalizeState(raw){
    if(!raw||typeof raw!=='object')return createInitialState();const s=normalizeStateBase(raw),planetType=D.planetTypes[raw.empire?.planetType||raw.planet?.type]?raw.empire?.planetType||raw.planet?.type:'temperate',startRegion=D.startRegions[raw.empire?.startRegion||raw.planet?.startRegion]?raw.empire?.startRegion||raw.planet?.startRegion:'center';
    s.version=SAVE_VERSION;s.empire={planetType,startRegion};s.planet={type:planetType,startRegion,threatBonus:D.planetTypes[planetType]?.threatBonus||0};s.infrastructure={level:clamp(safeInt(raw.infrastructure?.level||raw.infrastructureLevel||1,1,1,D.infrastructure.maxLevel),1,D.infrastructure.maxLevel)};s.settings.operationsExpanded=!!raw.settings?.operationsExpanded;
    D.repeatableResearch.forEach(r=>s.repeatResearch[r.id]=safeInt(s.repeatResearch[r.id],0,0,100000));
    s.galaxy.satellites=Object.assign({},Object.fromEntries((D.satellites||[]).map(d=>[d.id,0])),raw.galaxy?.satellites||{});(D.satellites||[]).forEach(d=>s.galaxy.satellites[d.id]=safeInt(s.galaxy.satellites[d.id]));
    s.galaxy.satelliteQueue=Array.isArray(raw.galaxy?.satelliteQueue)?raw.galaxy.satelliteQueue.filter(q=>q&&satelliteDef(q.satelliteId)&&Number.isFinite(Number(q.finishAt))).slice(0,250).map(q=>({id:String(q.id||('sat'+Date.now())),satelliteId:q.satelliteId,count:safeInt(q.count,1,1,99),finishAt:safeNumber(q.finishAt,Date.now())})):[];
    s.galaxy.targets=mergeTargets(raw.galaxy?.targets||s.galaxy.targets);s.galaxy.missions=(s.galaxy.missions||[]).map(m=>Object.assign({type:'attack',satellites:{}},m));
    if(raw.__needsFreshMap||!Object.keys(s.map.openSectors||{}).length){s.map={openSectors:{},nodes:{},nodeNextSeed:17};s.grid={entities:{},conveyors:[],powerLines:[],nextId:1};s.sectorsOpened=0;initMap(s);}return s;
  }
  function mergeTargets(saved){
    const byId={};(saved||[]).forEach(t=>{if(t&&t.id)byId[t.id]=t;});const defaults={discovered:false,defeated:false,colonized:false,recoveryAt:0,victories:0,scannedAt:0,intelLevel:0,debris:{scrapMetal:0,wreckCircuit:0,alienAlloy:0}};
    const fixed=D.galaxyTargets.map((t,i)=>Object.assign(copy(defaults),copy(t),{index:i},byId[t.id]||{}));const procedural=(saved||[]).filter(t=>t&&t.procedural&&!D.galaxyTargets.some(x=>x.id===t.id)).map(t=>Object.assign(copy(defaults),{colonizable:false},t));
    return fixed.concat(procedural).map(t=>{t.intelLevel=clamp(safeInt(t.intelLevel,0,0,3),0,3);t.debris=Object.assign({scrapMetal:0,wreckCircuit:0,alienAlloy:0},t.debris||{});Object.keys(t.debris).forEach(k=>t.debris[k]=safeInt(t.debris[k]));return t;});
  }
  function startSectorCoords(s){const r=D.startRegions[s?.empire?.startRegion||s?.planet?.startRegion||'center']||D.startRegions.center;return {sx:clamp(r.sx,0,sectorsPerSide()-1),sy:clamp(r.sy,0,sectorsPerSide()-1)};}
  function initMap(s){const st=startSectorCoords(s);openSectorInternal(s,st.sx,st.sy,true);const ss=D.map.sectorSize,cells=[];for(let y=st.sy*ss;y<(st.sy+1)*ss;y++)for(let x=st.sx*ss;x<(st.sx+1)*ss;x++)cells.push({x,y});['ironOre','copperOre','coal'].forEach(type=>placeNodeRandom(s,type,cells));const region=D.startRegions[s?.empire?.startRegion||'center'],planet=D.planetTypes[s?.empire?.planetType||'temperate'];const bonus=region?.bonusNode||planet?.resourceBias?.find(x=>!['ironOre','copperOre','coal'].includes(x));if(bonus&&!['ironOre','copperOre','coal'].includes(bonus))placeNodeRandom(s,bonus,cells);}

  function planetTypeDef(s){return D.planetTypes[s?.empire?.planetType||s?.planet?.type||'temperate']||D.planetTypes.temperate;}
  function startRegionDef(s){return D.startRegions[s?.empire?.startRegion||s?.planet?.startRegion||'center']||D.startRegions.center;}
  function infrastructureLevel(s){return clamp(safeInt(s.infrastructure?.level,1,1,D.infrastructure.maxLevel),1,D.infrastructure.maxLevel);}
  function marketSatelliteCount(s){return s.researched.marketSatellite?Math.min(D.market.maxSatellites,(s.market.level||1)*(D.market.satellitesPerLevel||3)):0;}
  function marketSatelliteLimit(){return D.market.maxSatellites||9;}
  function structureLoad(s,id,type){const d=type==='plant'?pDef(id):mDef(id);if(!d)return 0;const lv=type==='plant'?plantLevel(s,id):machineLevel(s,id),eff=D.capacity.loadEfficiencyByClass[lv-1]||1;return Math.max(1,Math.ceil((d.footprint||4)/CELL_M2*eff));}
  function planetCapacity(s){const lv=infrastructureLevel(s),base=D.capacity.planetByMk[lv]||0,sector=openSectorList(s).length*(D.capacity.sectorPlanetBonus||0),region=startRegionDef(s).capacityBonus||0,pct=1+(planetTypeDef(s).capacityBonus||0)+(s.repeatResearch.planetaryExpansion||0)*.04;return Math.max(10,Math.floor((base+sector+region)*pct));}
  function orbitCapacity(s){const lv=infrastructureLevel(s),base=D.capacity.orbitByMk[lv]||0,colony=Math.max(0,(s.galaxy.colonies||1)-1)*5,pct=1+(s.repeatResearch.fleetCoordination||0)*.04;return Math.max(5,Math.floor((base+colony)*pct));}
  function missionShipLoad(m){return D.ships.reduce((n,d)=>n+(m.ships?.[d.id]||0)*(d.commandLoad||1)+(m.damagedShips?.[d.id]||0)*(d.commandLoad||1),0)+(D.satellites||[]).reduce((n,d)=>n+(m.satellites?.[d.id]||0)*(d.commandLoad||1),0);}
  function planetLoadBreakdown(s){let structures=0;Object.values(s.grid.entities||{}).forEach(e=>structures+=structureLoad(s,e.defId,e.type));const defenses=D.defenses.reduce((n,d)=>n+(s.galaxy.defenses[d.id]||0)*(d.load||1)+(s.maintenance.damagedDefenses[d.id]||0)*(d.load||1),0),maintenance=(s.maintenance.facilities.planetWorkshop||0)*(facilityDef('planetWorkshop')?.load||0);return {structures,defenses,maintenance,total:Math.ceil(structures+defenses+maintenance)};}
  function orbitLoadBreakdown(s){const hangar=D.ships.reduce((n,d)=>n+(s.galaxy.ships[d.id]||0)*(d.commandLoad||1)+(s.maintenance.damagedShips[d.id]||0)*(d.commandLoad||1),0),queued=(s.galaxy.shipQueue||[]).reduce((n,q)=>n+(q.count||0)*(shipDef(q.shipId)?.commandLoad||1),0),missions=(s.galaxy.missions||[]).reduce((n,m)=>n+missionShipLoad(m),0),market=marketSatelliteCount(s)*(D.capacity.marketSatelliteLoad||1),satellites=(D.satellites||[]).reduce((n,d)=>n+(s.galaxy.satellites?.[d.id]||0)*(d.commandLoad||1),0),satQueue=(s.galaxy.satelliteQueue||[]).reduce((n,q)=>n+(q.count||0)*(satelliteDef(q.satelliteId)?.commandLoad||1),0),maintenance=(s.maintenance.facilities.orbitalDrydock||0)*(facilityDef('orbitalDrydock')?.load||0)+(s.maintenance.facilities.satelliteHub||0)*(facilityDef('satelliteHub')?.load||0);return {hangar,queued,missions,market,satellites,satQueue,maintenance,total:Math.ceil(hangar+queued+missions+market+satellites+satQueue+maintenance)};}
  function planetLoad(s){return planetLoadBreakdown(s).total;}function orbitLoad(s){return orbitLoadBreakdown(s).total;}function planetLoadFactor(s){return Math.max(D.capacity.overloadFloor||.25,Math.min(1,planetCapacity(s)/Math.max(1,planetLoad(s))));}function orbitLoadFactor(s){return Math.max(D.capacity.overloadFloor||.25,Math.min(1,orbitCapacity(s)/Math.max(1,orbitLoad(s))));}function canFitPlanetLoad(s,add){return planetLoad(s)+Math.max(0,add||0)<=planetCapacity(s);}function canFitOrbitLoad(s,add){return orbitLoad(s)+Math.max(0,add||0)<=orbitCapacity(s);}
  function capacityStatus(s){return {planet:{used:planetLoad(s),max:planetCapacity(s),detail:planetLoadBreakdown(s)},fleet:{used:orbitLoad(s),max:orbitCapacity(s),detail:orbitLoadBreakdown(s)},orbit:{used:orbitLoad(s),max:orbitCapacity(s),detail:orbitLoadBreakdown(s)},defense:{used:planetLoadBreakdown(s).defenses,max:planetCapacity(s)},marketSatellites:{used:marketSatelliteCount(s),max:marketSatelliteLimit(s)},infrastructure:infrastructureLevel(s)};}
  function infrastructureUpgradeCost(s){const lv=infrastructureLevel(s),target=lv+1;if(target>D.infrastructure.maxLevel)return null;const items={};if(target===2){items.steel=80;items.machinery=18;}if(target===3){items.titaniumPlate=55;items.electronics=35;}if(target===4){items.orbitalParts=60;items.energyCrystal=40;}if(target===5){items.omegaCore=75;items.machinery=120;items.nanoGel=45;}return {target,tech:D.infrastructure.techByLevel[target],coins:Math.ceil(75000*Math.pow(5.2,target-2)),items};}
  function canUpgradeInfrastructure(s){const c=infrastructureUpgradeCost(s);return !!c&&(!c.tech||s.researched[c.tech])&&s.coins>=c.coins&&Object.entries(c.items).every(([k,v])=>(s.inventory[k]||0)>=v);}
  function upgradeInfrastructure(s){if(!canUpgradeInfrastructure(s))return false;const c=infrastructureUpgradeCost(s);s.coins-=c.coins;Object.entries(c.items).forEach(([k,v])=>s.inventory[k]-=v);s.infrastructure.level=c.target;return true;}
  function canAddBuildingLoad(s,id,type){return canFitPlanetLoad(s,structureLoad(s,id,type));}
  function canBuild(s,id){const d=mDef(id);return !!d&&isMachineUnlocked(s,id)&&s.coins>=buildCost(s,id)&&canAddBuildingLoad(s,id,'machine')&&(!isExtractor(id)||hasFreeNodeFor(s,id));}
  function canBuildPlant(s,id){return isPlantUnlocked(s,id)&&s.coins>=plantBuildCost(s,id)&&canAddBuildingLoad(s,id,'plant');}
  function globalMult(s){const base=1+(s.repeatResearch.industrialEfficiency||0)*.05+Math.max(0,(s.galaxy.colonies||1)-1)*.04;return base*integrityFactor(s,'planet',.58)*planetLoadFactor(s);}

  function marketCapacity(s){return D.market.baseCapacity*Math.pow(D.market.capacityGrowth,(s.market.level||1)-1)*marketSatelliteCount(s)*(1+(s.repeatResearch.marketLogistics||0)*.1)*integrityFactor(s,'satellite',.45)*orbitLoadFactor(s);}
  function marketCooldownSec(s){const damagePenalty=1/integrityFactor(s,'satellite',.5),loadPenalty=1/orbitLoadFactor(s);return Math.ceil(Math.max(15,D.market.baseCooldownSec*Math.pow(D.market.cooldownStep,(s.market.level||1)-1)*Math.pow(.97,s.repeatResearch.marketLogistics||0)*damagePenalty*loadPenalty));}
  function canUpgradeMarket(s){if(!s.researched.marketSatellite||s.market.level>=D.market.maxLevel)return false;const c=marketUpgradeCost(s),added=(D.market.satellitesPerLevel||3)*(D.capacity.marketSatelliteLoad||1);return canFitOrbitLoad(s,added)&&s.coins>=c.coins&&Object.entries(c.items).every(([k,v])=>(s.inventory[k]||0)>=v);}
  function upgradeMarket(s){if(!canUpgradeMarket(s))return false;const c=marketUpgradeCost(s);s.coins-=c.coins;Object.entries(c.items).forEach(([k,v])=>s.inventory[k]-=v);s.market.level++;return true;}
  function buyMarketSatellites(){return false;}

  function canBuildShip(s,id,count){const d=shipDef(id);count=Math.max(1,Math.floor(count||1));return !!d&&(!d.tech||s.researched[d.tech])&&canFitOrbitLoad(s,(d.commandLoad||1)*count)&&Object.entries(d.cost).every(([k,v])=>(s.inventory[k]||0)>=v*count);}
  function queueShip(s,id,count){count=clamp(Math.floor(count||1),1,99);if(!canBuildShip(s,id,count))return false;const d=shipDef(id);Object.entries(d.cost).forEach(([k,v])=>s.inventory[k]-=v*count);const last=s.galaxy.shipQueue[s.galaxy.shipQueue.length-1],start=Math.max(Date.now(),last?last.finishAt:0),speed=(1+(s.repeatResearch.industrialEfficiency||0)*.02)*integrityFactor(s,'orbital',.45)*orbitLoadFactor(s);s.galaxy.shipQueue.push({id:'sq'+Date.now()+Math.random(),shipId:id,count,finishAt:start+Math.ceil(d.buildSec*count*1000/Math.max(.1,speed))});return true;}
  function canBuildSatellite(s,id,count){const d=satelliteDef(id);count=Math.max(1,Math.floor(count||1));return !!d&&(!d.tech||s.researched[d.tech])&&canFitOrbitLoad(s,(d.commandLoad||1)*count)&&Object.entries(d.cost).every(([k,v])=>(s.inventory[k]||0)>=v*count);}
  function queueSatellite(s,id,count){count=clamp(Math.floor(count||1),1,25);if(!canBuildSatellite(s,id,count))return false;const d=satelliteDef(id);Object.entries(d.cost).forEach(([k,v])=>s.inventory[k]-=v*count);const last=s.galaxy.satelliteQueue[s.galaxy.satelliteQueue.length-1],start=Math.max(Date.now(),last?last.finishAt:0);s.galaxy.satelliteQueue.push({id:'satq'+Date.now()+Math.random(),satelliteId:id,count,finishAt:start+d.buildSec*count*1000});return true;}
  function canBuildDefense(s,id,count){const d=defenseDef(id);count=Math.max(1,Math.floor(count||1));return !!d&&(!d.tech||s.researched[d.tech])&&canFitPlanetLoad(s,(d.load||1)*count)&&Object.entries(d.cost).every(([k,v])=>(s.inventory[k]||0)>=v*count);}
  function travelSeconds(s,target,selection){const fs=fleetStats(selection,s),warp=1+(s.repeatResearch.warpNavigation||0)*.08+(s.researched.warpDrive?.25:0),frontier=1+(s.repeatResearch.frontierLogistics||0)*.025;return Math.ceil(Math.max(12,target.distance*55/(Math.max(.25,fs.speed)*warp*frontier*integrityFactor(s,'orbital',.6)*orbitLoadFactor(s))));}
  function spyTravelSeconds(s,target){return Math.ceil(Math.max(8,target.distance*32/((1+(s.repeatResearch.espionageMastery||0)*.03)*integrityFactor(s,'satellite',.65))));}
  function debrisTotal(t){return Object.values(t?.debris||{}).reduce((a,b)=>a+Math.max(0,b||0),0);}
  function canSendSpyMission(s,targetId){const t=targetById(s,targetId);return !!t&&t.discovered&&!t.colonized&&!!s.researched.espionageNetwork&&(s.galaxy.satellites.spySatellite||0)>0&&(s.inventory.starFuel||0)>=Math.max(1,Math.ceil(t.distance*.4))&&!s.galaxy.missions.some(m=>m.targetId===targetId&&m.type==='spy'&&m.status!=='done');}
  function sendSpyMission(s,targetId){if(!canSendSpyMission(s,targetId))return false;const t=targetById(s,targetId),fuel=Math.max(1,Math.ceil(t.distance*.4)),sec=spyTravelSeconds(s,t);s.galaxy.satellites.spySatellite--;s.inventory.starFuel-=fuel;s.galaxy.missions.push({id:'spy'+Date.now()+Math.random(),type:'spy',targetId,status:'outbound',ships:{},satellites:{spySatellite:1},arrivalAt:Date.now()+sec*1000,returnAt:0});addReport(s,'mission',`📡 Casus uydusu ${t.name} hedefine çıktı`,`Varış ${N.formatTime(sec)}.`,{category:'mission',targetId,travelSec:sec});return true;}
  function canSendSalvageMission(s,targetId,count){const t=targetById(s,targetId);count=Math.max(1,Math.floor(count||1));return !!t&&t.discovered&&debrisTotal(t)>0&&!!s.researched.debrisRecovery&&(s.galaxy.ships.recycler||0)>=count&&(s.inventory.starFuel||0)>=Math.ceil(t.distance*10*count);}
  function sendSalvageMission(s,targetId,count){count=Math.max(1,Math.floor(count||1));if(!canSendSalvageMission(s,targetId,count))return false;const t=targetById(s,targetId),selection=Object.fromEntries(D.ships.map(d=>[d.id,d.id==='recycler'?count:0])),fuel=Math.ceil(t.distance*10*count),sec=travelSeconds(s,t,selection);s.galaxy.ships.recycler-=count;s.inventory.starFuel-=fuel;s.galaxy.missions.push({id:'salv'+Date.now()+Math.random(),type:'salvage',targetId,status:'outbound',ships:selection,initialShips:copy(selection),satellites:{},arrivalAt:Date.now()+sec*1000,returnAt:0,pendingSalvage:{}});return true;}
  function canSendInvasionMission(s,targetId,selection){const t=targetById(s,targetId),fs=fleetStats(selection||{},s);return !!t&&t.defeated&&!t.colonized&&t.colonizable!==false&&!!s.researched.planetaryInvasion&&(selection?.colonyShip||0)>=1&&D.ships.every(d=>(selection?.[d.id]||0)<=(s.galaxy.ships[d.id]||0))&&(s.inventory.starFuel||0)>=fs.fuel*t.distance;}
  function sendInvasionMission(s,targetId,selection){selection=Object.fromEntries(D.ships.map(d=>[d.id,Math.max(0,Math.floor(selection?.[d.id]||0))]));if(!canSendInvasionMission(s,targetId,selection))return false;const t=targetById(s,targetId),fs=fleetStats(selection,s),fuel=Math.ceil(fs.fuel*t.distance),sec=travelSeconds(s,t,selection);D.ships.forEach(d=>s.galaxy.ships[d.id]-=selection[d.id]||0);s.inventory.starFuel-=fuel;s.galaxy.missions.push({id:'inv'+Date.now()+Math.random(),type:'invasion',targetId,status:'outbound',ships:selection,initialShips:copy(selection),satellites:{},arrivalAt:Date.now()+sec*1000,returnAt:0});return true;}
  function canColonize(s,targetId){return canSendInvasionMission(s,targetId,{colonyShip:1});}function colonizeTarget(s,targetId){return sendInvasionMission(s,targetId,{colonyShip:1});}
  function canSendFleet(s,targetId,selection){const t=targetById(s,targetId),fs=fleetStats(selection,s);if(!t||!t.discovered||t.defeated||!s.researched.fleetCommand||fs.total<1)return false;const available=D.ships.every(d=>(selection[d.id]||0)<=(s.galaxy.ships[d.id]||0)),fuel=fs.fuel*t.distance/Math.max(1,1+(s.repeatResearch.frontierLogistics||0)*.02);return available&&(s.inventory.starFuel||0)>=fuel&&!s.galaxy.missions.some(m=>m.targetId===targetId&&m.type==='attack'&&m.status!=='done');}
  function sendFleet(s,targetId,selection){selection=Object.fromEntries(D.ships.map(d=>[d.id,Math.max(0,Math.floor(selection[d.id]||0))]));if(!canSendFleet(s,targetId,selection))return false;const t=targetById(s,targetId),fs=fleetStats(selection,s),fuel=fs.fuel*t.distance/Math.max(1,1+(s.repeatResearch.frontierLogistics||0)*.02);D.ships.forEach(d=>s.galaxy.ships[d.id]-=selection[d.id]||0);s.inventory.starFuel-=fuel;const sec=travelSeconds(s,t,selection);s.galaxy.missions.push({id:'m'+Date.now()+Math.random(),type:'attack',targetId,status:'outbound',ships:selection,initialShips:copy(selection),satellites:{},arrivalAt:Date.now()+sec*1000,returnAt:0,pendingLoot:null,pendingSalvage:null,damagedShips:null,battle:null});s.galaxy.threat+=t.threat*.6;addReport(s,'mission',`🚀 Filo ${t.name} hedefine çıktı`,`Varış süresi ${N.formatTime(sec)}.`,{category:'mission',targetId,ships:copy(selection),fuel,travelSec:sec});return true;}
  function resolveBattle(s,mission,now){
    const t=targetById(s,mission.targetId),sim=simulateBattle(s,t,mission.ships);mission.ships=sim.operational;mission.damagedShips=sim.damaged;mission.battle=sim;const survivors=mergeFleetCounts(sim.operational,sim.damaged),survivorStats=fleetStats(survivors,s),hasSurvivor=survivorStats.total>0,rawSalvage=salvageFromBattle(s,t,sim.lost,sim.won),lootScale=sim.won?(1+(t.victories||0)*.12)*(1+(s.repeatResearch.frontierLogistics||0)*.05):0,rawLoot={};if(sim.won)Object.entries(t.loot||{}).forEach(([k,v])=>rawLoot[k]=Math.ceil(v*lootScale));const coinLoot=hasSurvivor?Math.max(0,rawLoot.coins||0):0;delete rawLoot.coins;const lootCargo=loadCargo(hasSurvivor?rawLoot:{},survivorStats.cargo),salvageCargo=loadCargo(hasSurvivor?rawSalvage:{},Math.max(0,survivorStats.cargo-lootCargo.used));mission.pendingLoot=sim.won&&hasSurvivor?Object.assign(coinLoot?{coins:coinLoot}:{},lootCargo.loaded):{};mission.pendingSalvage=salvageCargo.loaded;mission.unrecovered={loot:lootCargo.abandoned,salvage:salvageCargo.abandoned};t.debris=t.debris||{scrapMetal:0,wreckCircuit:0,alienAlloy:0};Object.entries(salvageCargo.abandoned).forEach(([k,v])=>t.debris[k]=(t.debris[k]||0)+v);if(!hasSurvivor)Object.entries(rawSalvage).forEach(([k,v])=>t.debris[k]=(t.debris[k]||0)+v);
    if(sim.won){t.defeated=true;t.victories=(t.victories||0)+1;t.recoveryAt=now+(t.procedural?D.frontier.recoverySec:180+t.threat*55)*1000;s.stats.battlesWon++;if(t.procedural){s.galaxy.frontierDepth=Math.max(s.galaxy.frontierDepth||0,t.frontierDepth||0);s.stats.frontierVictories++;}s.galaxy.threat+=t.threat;}else s.stats.battlesLost++;const losses=Object.values(sim.lost).reduce((a,b)=>a+b,0),damaged=Object.values(sim.damaged).reduce((a,b)=>a+b,0),title=sim.won?`🏆 ${t.name} yenildi`:`☠️ ${t.name} saldırısı başarısız`,body=`${sim.rounds.length} tur · ${losses} gemi kaybı · ${damaged} gemi hasarlı · Enkaz alanı ${N.format(debrisTotal(t))}.`;const r=addReport(s,sim.won?'battle-win':'battle-loss',title,body,{category:'battle',outcome:sim.won?'victory':'defeat',target:{id:t.id,name:t.name,type:t.type,strength:t.strength,threat:t.threat},fleetBefore:copy(mission.initialShips||mission.ships),operational:copy(sim.operational),damaged:copy(sim.damaged),lost:copy(sim.lost),rounds:copy(sim.rounds),modifiers:{weapon:weaponMult(s),shield:shieldMult(s),orbitalIntegrity:s.maintenance.integrity.orbital},cargo:{capacity:survivorStats.cargo,used:lootCargo.used+salvageCargo.used},salvage:copy(mission.pendingSalvage),loot:copy(mission.pendingLoot),unrecovered:copy(mission.unrecovered),persistentDebris:copy(t.debris)});mission.reportId=r.id;mission.status='returning';mission.returnAt=now+travelSeconds(s,t,survivors)*1000;
  }
  function resolveMissionArrival(s,m,now){const t=targetById(s,m.targetId);if(m.type==='spy'){const mastery=s.repeatResearch.espionageMastery||0,loss=Math.random()<Math.max(.04,Math.min(.55,.08+t.threat*.035-mastery*.012));t.intelLevel=Math.min(3,(t.intelLevel||0)+1);if(loss)m.satellites.spySatellite=0;addReport(s,'spy',`📡 ${t.name} istihbarat raporu`,`${loss?'Casus uydusu kaybedildi.':'Uydu dönüş yolunda.'} İstihbarat ${t.intelLevel}/3 · Savunma ${N.format(t.strength)} · Enkaz ${N.format(debrisTotal(t))}.`,{category:'intel',target:copy(t),probeLost:loss});m.status='returning';m.returnAt=now+spyTravelSeconds(s,t)*1000;return;}if(m.type==='salvage'){const d=shipDef('recycler'),count=m.ships.recycler||0,capacity=count*(d?.cargo||0),cargo=loadCargo(t.debris||{},capacity);m.pendingSalvage=cargo.loaded;Object.entries(cargo.loaded).forEach(([k,v])=>t.debris[k]=Math.max(0,(t.debris[k]||0)-v));m.status='returning';m.returnAt=now+travelSeconds(s,t,m.ships)*1000;addReport(s,'salvage',`♻️ ${t.name} enkazı toplandı`,`${N.format(cargo.used)} birim hurda dönüş yolunda; sahada ${N.format(debrisTotal(t))} kaldı.`,{category:'mission',salvage:copy(cargo.loaded),remaining:copy(t.debris)});return;}if(m.type==='invasion'){if(t.defeated&&!t.colonized){t.colonized=true;t.recoveryAt=0;s.galaxy.colonies=(s.galaxy.colonies||1)+1;s.galaxy.threat+=t.threat*.35;m.ships.colonyShip=0;addReport(s,'colony',`🪐 ${t.name} işgal edildi`,`Koloni kuruldu. Üretim +%4 ve yörünge kapasitesi desteği sağlıyor.`,{category:'empire',targetId:t.id,colonyCount:s.galaxy.colonies});}m.status='returning';m.returnAt=now+travelSeconds(s,t,m.ships)*1000;return;}resolveBattle(s,m,now);}
  function deliverMission(s,m){D.ships.forEach(d=>{s.galaxy.ships[d.id]=(s.galaxy.ships[d.id]||0)+(m.ships?.[d.id]||0);s.maintenance.damagedShips[d.id]=(s.maintenance.damagedShips[d.id]||0)+(m.damagedShips?.[d.id]||0);});(D.satellites||[]).forEach(d=>s.galaxy.satellites[d.id]=(s.galaxy.satellites[d.id]||0)+(m.satellites?.[d.id]||0));if(m.pendingLoot)Object.entries(m.pendingLoot).forEach(([k,v])=>{if(k==='coins')addCoins(s,v);else addInventoryCapped(s,k,v);});if(m.pendingSalvage){Object.entries(m.pendingSalvage).forEach(([k,v])=>addInventoryCapped(s,k,v));s.stats.salvageRecovered+=Object.values(m.pendingSalvage).reduce((a,b)=>a+b,0);}m.status='done';addReport(s,'return','🏠 Görev birimleri üsse döndü',m.pendingSalvage?'Enkaz depoya aktarıldı.':'Filo ve uydular hangara alındı.',{category:'mission',sourceReportId:m.reportId});}
  function tickGalaxy(s,now){while(s.galaxy.shipQueue.length&&s.galaxy.shipQueue[0].finishAt<=now){const q=s.galaxy.shipQueue.shift(),d=shipDef(q.shipId);s.galaxy.ships[q.shipId]=(s.galaxy.ships[q.shipId]||0)+q.count;addReport(s,'build',`${d.icon} ${q.count} ${d.name} tamamlandı`,'Gemiler hangara eklendi.',{category:'production'});}while(s.galaxy.satelliteQueue.length&&s.galaxy.satelliteQueue[0].finishAt<=now){const q=s.galaxy.satelliteQueue.shift(),d=satelliteDef(q.satelliteId);s.galaxy.satellites[q.satelliteId]=(s.galaxy.satellites[q.satelliteId]||0)+q.count;addReport(s,'build',`${d.icon} ${q.count} ${d.name} tamamlandı`,'Uydular hangara eklendi.',{category:'production'});}s.galaxy.targets.forEach(t=>{const inv=s.galaxy.missions.some(m=>m.targetId===t.id&&m.type==='invasion'&&m.status!=='done');if(t.defeated&&!t.colonized&&!inv&&t.recoveryAt&&t.recoveryAt<=now){t.defeated=false;t.recoveryAt=0;t.strength=Math.ceil(t.strength*(t.procedural?1.12:1.18));addReport(s,'warning',`⚠️ ${t.name} yeniden örgütlendi`,`Yeni savunma gücü ${N.format(t.strength)}.`,{category:'intel'});}});s.galaxy.missions.forEach(m=>{if(m.status==='outbound'&&m.arrivalAt<=now)resolveMissionArrival(s,m,now);else if(m.status==='returning'&&m.returnAt<=now)deliverMission(s,m);});s.galaxy.missions=s.galaxy.missions.filter(m=>m.status!=='done').slice(-60);tickMaintenance(s,now);if(!s.galaxy.raidWarningShown&&s.galaxy.nextRaidAt-now<=D.economyConfig.raidWarningSec*1000&&s.galaxy.nextRaidAt>now){s.galaxy.raidWarningShown=true;addReport(s,'warning','⚠️ Uzaylı imzası algılandı','Savunma, mühimmat ve bakım ekiplerini hazırla.',{category:'intel',raidAt:s.galaxy.nextRaidAt});}if(now>=s.galaxy.nextRaidAt)resolveRaid(s,now);}

  // v4.3: büyük bağlantı listelerinde fabrika silme işlemini sabit bellekle yap.
  // Array.filter ile iki yeni dev dizi üretmek, bazı cihazlarda ana thread'i kilitliyordu.
  function compactLinksInPlace(list,id){
    let write=0;
    for(let read=0;read<list.length;read++){
      const link=list[read];
      if(link&&link.from!==id&&link.to!==id) list[write++]=link;
    }
    list.length=write;
  }
  function removeEntity(s,id){
    const e=s.grid.entities[id];if(!e)return false;
    if(e.type==='machine'){
      const d=mDef(e.defId),m=s.machines[e.defId];
      if(m&&m.count>0)m.count--;
      if(d&&m)s.coins=N.add(s.coins,buildCostFromCount(d,Math.max(0,m.count))*.45);
    }else{
      const d=pDef(e.defId),p=s.plants[e.defId];
      if(p&&p.count>0)p.count--;
      if(d&&p)s.coins=N.add(s.coins,plantCostFromCount(d,Math.max(0,p.count))*.45);
    }
    delete s.grid.entities[id];
    compactLinksInPlace(s.grid.conveyors,id);
    compactLinksInPlace(s.grid.powerLines,id);
    return true;
  }

  function canUpgradeFacility(s,id){const c=facilityUpgradeCost(s,id),d=facilityDef(id),added=d?.load||0;if(!c||!s.researched[c.tech])return false;const fit=d.zone==='planet'?canFitPlanetLoad(s,added):canFitOrbitLoad(s,added);return fit&&s.coins>=c.coins&&Object.entries(c.items).every(([k,v])=>(s.inventory[k]||0)>=v);}
  function operationFeed(s,now){now=now||Date.now();const out=[],add=(kind,title,deadline,detail,priority)=>out.push({kind,title,deadline:deadline||0,leftSec:deadline?Math.max(0,Math.floor((deadline-now)/1000)):0,detail:detail||'',priority:priority||0});const rp=researchProgressInfo(s,now);if(rp){const d=rp.kind==='main'?researchDef(rp.id):repeatDef(rp.id);add('research',`🔬 ${d?.name||rp.id}`,rp.finishAt,'Araştırma tamamlanıyor',4);}if(s.researched.marketSatellite&&s.market.enabled)add('market',`🛰️ Pazar filosu · ${marketSatelliteCount(s)} uydu`,s.market.nextDispatchAt||now+marketCooldownSec(s)*1000,`Kota ${N.format(marketCapacity(s))}`,3);(s.galaxy.shipQueue||[]).slice(0,2).forEach(q=>add('build',`🚀 ${q.count} ${shipDef(q.shipId)?.name||q.shipId}`,q.finishAt,'Tersane üretimi',2));(s.galaxy.satelliteQueue||[]).slice(0,2).forEach(q=>add('build',`📡 ${q.count} ${satelliteDef(q.satelliteId)?.name||q.satelliteId}`,q.finishAt,'Uydu üretimi',2));(s.galaxy.missions||[]).forEach(m=>{const t=targetById(s,m.targetId),icons={attack:'⚔️',spy:'📡',salvage:'♻️',invasion:'🪐'},stage=m.status==='outbound'?'Varış':'Dönüş';add(m.type,`${icons[m.type]||'🚀'} ${t?.name||m.targetId}`,m.status==='outbound'?m.arrivalAt:m.returnAt,`${stage} · ${m.type==='attack'?'Savaş':m.type==='spy'?'Casusluk':m.type==='salvage'?'Enkaz toplama':'İstila'}`,5);});if(s.galaxy.nextRaidAt)add('raid','🚨 Yaklaşan uzaylı baskını',s.galaxy.nextRaidAt,'Gezegen savunması',6);(s.maintenance.repairQueue||[]).slice(0,2).forEach(j=>add('repair','🧰 Tamirat',j.finishAt,`${j.amount} birim`,2));return out.sort((a,b)=>a.deadline-b.deadline||b.priority-a.priority).slice(0,5);}
  function researchUnlocks(id){const out=[];D.machines.filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));D.powerPlants.filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));D.ships.filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));(D.satellites||[]).filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));D.defenses.filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));D.repairFacilities.filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));Object.entries(D.infrastructure.techByLevel||{}).forEach(([lv,tech])=>{if(tech===id)out.push(`🏗️ Gezegen ve Yörünge Altyapısı Mk ${lv}`);});Object.entries(D.automation.techByLevel||{}).forEach(([lv,tech])=>{if(tech===id)out.push(`🧠 Otomasyon Seviye ${lv}`);});Object.entries(D.levelTech||{}).forEach(([lv,tech])=>{if(tech===id)out.push(`🏭 Tüm bina sınıfları Mk ${lv}`);});const special={marketSatellite:['🛰️ Pazar filosu: 3 uydu ve otomatik satış'],scanner:['🔭 Yıldız sistemi taraması'],fleetCommand:['⚔️ Saldırı görevleri'],espionageNetwork:['📡 Casusluk görevleri'],debrisRecovery:['♻️ Kalıcı enkaz alanı toplama'],planetaryInvasion:['🪐 Gezegen istilası ve koloni gemisi'],frontierDoctrine:['🗺️ Sonsuz Cephe'],combatAnalytics:['📊 Ayrıntılı tur tur savaş analizi']};(special[id]||[]).forEach(x=>out.push(x));return [...new Set(out)];}

  // ===== Tick / offline =====
  function tick(s,dt,now){now=now||Date.now();tickResearch(s,now);const before=blankItemMap(k=>s.inventory[k]||0),power=computePower(s,dt);[...D.machines].sort((a,b)=>a.tier-b.tier).forEach(d=>{const m=s.machines[d.id];if(m.count>0&&m.hasManager)runMachine(s,d.id,dt,power);else m.eff=0;});runMarket(s,now);tickGalaxy(s,now);Object.keys(D.items).forEach(k=>s.flow[k]=dt?((s.inventory[k]||0)-before[k])/dt:0);s.stats.playTimeSec+=dt;s.galaxy.threat=Math.max(s.galaxy.threat,(s.sectorsOpened*.08+s.stats.battlesWon*.3)*(1+(s.planet?.threatBonus||0)));updateTopScore(s);return s;}
  function applyOfflineProgress(s){
    const now=Date.now(),start=Number(s.lastSeen||now),elapsed=Math.max(0,(now-start)/1000),usable=Math.min(elapsed,D.economyConfig.offlineCapSeconds),before=s.totalEarned;
    // Oyuncu çevrimdışıyken ardışık baskınlarla depoları sessizce eritme. Vadesi gelen saldırı,
    // oyuncu döndükten sonra hazırlanabileceği uyarı süresine ertelenir; üretim ve filo süreleri ilerler.
    const simulatedEnd=start+usable*1000,raidDeferred=!!(s.galaxy&&s.galaxy.nextRaidAt&&s.galaxy.nextRaidAt<=simulatedEnd);
    if(raidDeferred){s.galaxy.nextRaidAt=now+D.economyConfig.raidWarningSec*1000;s.galaxy.raidWarningShown=false;}
    if(usable>0){const chunks=Math.min(120,Math.max(1,Math.ceil(usable/60))),step=usable/chunks,dt=step*D.economyConfig.offlineRate;for(let i=0;i<chunks;i++)tick(s,dt,start+(i+1)*step*1000);}
    if(raidDeferred&&!s.galaxy.raidWarningShown){s.galaxy.raidWarningShown=true;addReport(s,'warning','⚠️ Çevrimdışı saldırı ertelendi','Savunma hazırlığı yapabilmen için uzaylı baskını geri dönüşünden sonraya ertelendi.');}
    tickResearch(s,now);s.lastSeen=now;return {earned:s.totalEarned-before,usableSeconds:usable,wasCapped:elapsed>D.economyConfig.offlineCapSeconds,raidDeferred};
  }

  // ===== Bilgi / skor =====
  function machineCountTotal(s){return D.machines.reduce((n,d)=>n+s.machines[d.id].count,0);}
  function plantCountTotal(s){return D.powerPlants.reduce((n,d)=>n+s.plants[d.id].count,0);}
  function computeScore(s){return Math.floor(s.totalEarned+Object.keys(s.researched).length*4500+s.sectorsOpened*2000+s.stats.battlesWon*40000+s.stats.buildingUpgrades*8000+machineCountTotal(s)*250);}
  function updateTopScore(s){const x=computeScore(s);if(x>s.topScore)s.topScore=x;return x;}
  function itemInfo(s,item){const it=D.items[item];return {id:item,name:it.name,icon:it.icon,tier:it.tier,desc:it.desc||'',sell:it.sell,research:!!it.research,producers:D.machines.filter(m=>m.recipe.out[item]).map(m=>m.name),consumers:D.machines.filter(m=>m.recipe.in[item]).map(m=>m.name),fuelFor:D.powerPlants.filter(p=>p.fuel&&p.fuel.item===item).map(p=>p.name),amount:s.inventory[item]||0,cap:storageCap(s,item),flow:s.flow[item]||0};}

  global.Axyon.Economy = {
    SAVE_VERSION,createInitialState,normalizeState,mDef,pDef,shipDef,defenseDef,satelliteDef,globalMult,
    isMachineUnlocked,isPlantUnlocked,storageCap,storageUpgradeCost,upgradeStorage,totalCells,usedCells,freeCells,
    buildCost,canBuild,buildMachine,nextMilestone,plantBuildCost,canBuildPlant,buildPlant,canBuyManager,buyManager,automationLevel,automationUpgradeCost,canUpgradeAutomation,upgradeAutomation,
    machineRate,machinePowerDemand,plantOutput,machineLevel,plantLevel,upgradeCost,canUpgradeClass,doUpgradeClass,integrityFactor,
    computePower,tick,manualClick,addCoins,sellItem,sellFraction,toggleAutoSell,setAutoSellKeep,setGlobalMarketKeep,setAllAutoSell,runAutoSell,
    marketCapacity,marketCooldownSec,marketUpgradeCost,canUpgradeMarket,upgradeMarket,buyMarketSatellites,marketSatelliteLimit,marketSatelliteCount,capacityStatus,planetTypeDef,startRegionDef,infrastructureLevel,planetCapacity,orbitCapacity,planetLoadBreakdown,orbitLoadBreakdown,planetLoad,orbitLoad,planetLoadFactor,orbitLoadFactor,canFitPlanetLoad,canFitOrbitLoad,infrastructureUpgradeCost,canUpgradeInfrastructure,upgradeInfrastructure,structureLoad,itemInfo,
    gridSize,entityFootprintCells,canPlaceAt,placeMachine,placePlant,moveEntity,removeEntity,addConveyor,addPowerLine,removeConveyor,removeLineNear,entityCenter,cellOccupiedExceptSelf,CELL_M2,
    mapSide,sectorsPerSide,cellSector,isSectorOpen,isCellOpen,openSectorList,openableSectors,sectorOpenCost,canOpenSector,openSector,nodeAt,nodeVisible,hasFreeNodeFor,isExtractor,extractorNodeType,
    computeScore,updateTopScore,canResearch,isResearchVisible,doResearch,researchMissing,researchQueueCapacity,researchLabSpeed,researchProgressInfo,cancelResearch,repeatCost,repeatDuration,canRepeatResearch,repeatMissing,doRepeatResearch,tickResearch,applyOfflineProgress,machineCountTotal,plantCountTotal,
    targetById,reportById,scanCost,canScan,scanNextTarget,canSpyTarget,spyTarget,colonyCost,canColonize,colonizeTarget,canBuildShip,queueShip,canBuildSatellite,queueSatellite,canSendSpyMission,sendSpyMission,canSendSalvageMission,sendSalvageMission,canSendInvasionMission,sendInvasionMission,debrisTotal,spyTravelSeconds,canBuildDefense,buildDefense,fleetStats,canSendFleet,sendFleet,travelSeconds,defenseStats,weaponMult,shieldMult,simulateBattle,
    facilityLevel,facilityUpgradeCost,canUpgradeFacility,upgradeFacility,repairJobCost,repairAvailableAmount,canQueueRepair,queueRepair,maintenanceStatus,tickMaintenance,operationFeed,researchUnlocks,
  };
})(typeof window !== 'undefined' ? window : globalThis);
