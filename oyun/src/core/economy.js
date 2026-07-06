/**
 * Axyon.Economy v4 — DOM'dan bağımsız oyun çekirdeği.
 * Kalıcı fabrika, Mk I–V yükseltme, kotalı pazar, filo ve PvE savaşları.
 */
(function (global) {
  const N = global.Axyon.Numbers;
  const D = global.Axyon.Data;
  const SAVE_VERSION = 12;
  const CELL_M2 = 4;

  const mDef = id => D.machines.find(m => m.id === id);
  const pDef = id => D.powerPlants.find(p => p.id === id);
  const shipDef = id => D.ships.find(x => x.id === id);
  const defenseDef = id => D.defenses.find(x => x.id === id);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const copy = o => JSON.parse(JSON.stringify(o));

  function blankItemMap(value) {
    const out = {};
    Object.keys(D.items).forEach(k => out[k] = typeof value === 'function' ? value(k) : value);
    return out;
  }

  function createInitialState() {
    const machines = {}, plants = {}, machineLevels = {}, plantLevels = {};
    D.machines.forEach(d => { machines[d.id] = {count:0,hasManager:false,eff:0,milestoneMult:1}; machineLevels[d.id]=1; });
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
      researched:{},repeatResearch:{industrialEfficiency:0,marketLogistics:0,weaponSystems:0,shieldSystems:0,warpNavigation:0},
      sectorsOpened:0,questIndex:0,achievements:{},
      stats:{machinesBuilt:0,plantsBuilt:0,managersBought:0,playTimeSec:0,produced:blankItemMap(0),marketDispatches:0,battlesWon:0,battlesLost:0,systemsScanned:0,raidsWon:0,raidsLost:0,buildingUpgrades:0},
      settings:{theme:'dark'},_power:{supply:0,demand:0,ratio:1},
      grid:{entities:{},conveyors:[],powerLines:[],nextId:1},
      map:{openSectors:{},nodes:{},nodeNextSeed:17},
      market:{enabled:false,keepPct:50,level:1,nextDispatchAt:0,lastDispatchAt:0,lastRevenue:0,lastUnits:0,totalRevenue:0},
      galaxy:{ships,defenses,targets,shipQueue:[],missions:[],reports:[],scanCooldownUntil:0,threat:0,nextRaidAt:now+D.economyConfig.raidBaseSec*1000,raidWarningShown:false,colonies:1},
      topScore:0,lastSeen:now,
    };
    initMap(s);
    return s;
  }

  function normalizeState(raw) {
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
    });
    s.plants = {};
    D.powerPlants.forEach(d => {
      s.plants[d.id] = Object.assign({}, base.plants[d.id], raw.plants && raw.plants[d.id] || {});
    });

    s.machineLevels = Object.assign({}, base.machineLevels, raw.machineLevels || {});
    s.plantLevels = Object.assign({}, base.plantLevels, raw.plantLevels || {});
    s.researched = Object.assign({}, raw.researched || {});
    s.repeatResearch = Object.assign({}, base.repeatResearch, raw.repeatResearch || {});
    s.stats = Object.assign({}, base.stats, raw.stats || {});
    s.stats.produced = Object.assign({}, base.stats.produced, raw.stats && raw.stats.produced || {});
    s.settings = Object.assign({}, base.settings, raw.settings || {});
    s.market = Object.assign({}, base.market, raw.market || {});

    s.galaxy = Object.assign({}, base.galaxy, raw.galaxy || {});
    s.galaxy.ships = Object.assign({}, base.galaxy.ships, raw.galaxy && raw.galaxy.ships || {});
    s.galaxy.defenses = Object.assign({}, base.galaxy.defenses, raw.galaxy && raw.galaxy.defenses || {});
    s.galaxy.targets = mergeTargets(raw.galaxy && raw.galaxy.targets);
    s.galaxy.shipQueue = Array.isArray(s.galaxy.shipQueue) ? s.galaxy.shipQueue : [];
    s.galaxy.missions = Array.isArray(s.galaxy.missions) ? s.galaxy.missions : [];
    s.galaxy.reports = Array.isArray(s.galaxy.reports) ? s.galaxy.reports.slice(0,40) : [];

    const needsMapMigration = oldVersion < SAVE_VERSION || !raw.map || (D.map.size !== 48 && oldVersion <= 8);
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
        const count = Math.max(0, Number(machine.count || 0));
        for (let i = 0; i < count; i++) legacyRefund += buildCostFromCount(d, i) * 0.65;
        if (machine.hasManager) legacyRefund += d.managerCost * 0.65;
        s.machines[d.id] = {count:0,hasManager:false,eff:0,milestoneMult:1};
      });
      D.powerPlants.forEach(d => {
        const plant = s.plants[d.id] || base.plants[d.id];
        const count = Math.max(0, Number(plant.count || 0));
        for (let i = 0; i < count; i++) legacyRefund += plantCostFromCount(d, i) * 0.65;
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
    if (!s.galaxy.nextRaidAt) s.galaxy.nextRaidAt = Date.now()+D.economyConfig.raidBaseSec*1000;
    return s;
  }

  function mergeTargets(saved) {
    const byId = {};
    (saved || []).forEach(t => byId[t.id]=t);
    return D.galaxyTargets.map((t,i)=>Object.assign(copy(t),{discovered:false,defeated:false,colonized:false,recoveryAt:0,victories:0,scannedAt:0,index:i},byId[t.id]||{}));
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
  function initMap(s){
    const max=sectorsPerSide(), mid=Math.floor(max/2), r=D.map.startSectors;
    const start=mid-Math.floor(r/2);
    for(let sy=start;sy<start+r;sy++) for(let sx=start;sx<start+r;sx++) openSectorInternal(s,sx,sy,true);
    const cells=openCells(s), guaranteed=Object.keys(D.resourceNodes).filter(k=>D.resourceNodes[k].guaranteedStart);
    guaranteed.forEach(type=>{placeNodeRandom(s,type,cells);placeNodeRandom(s,type,cells);placeNodeRandom(s,type,cells);});
    for(let i=0;i<5;i++) placeNodeRandom(s,guaranteed[Math.floor(rng(s)*guaranteed.length)],cells);
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
  function canBuild(s,id){const d=mDef(id);return isMachineUnlocked(s,id)&&s.coins>=buildCost(s,id)&&(!isExtractor(id)||hasFreeNodeFor(s,id));}
  function buildMachine(s,id){if(!canBuild(s,id))return false;const c=buildCost(s,id);s.coins=N.sub(s.coins,c);s.machines[id].count++;s.stats.machinesBuilt++;updateMilestone(s,id);return true;}
  function canBuildPlant(s,id){return isPlantUnlocked(s,id)&&s.coins>=plantBuildCost(s,id);}
  function buildPlant(s,id){if(!canBuildPlant(s,id))return false;const c=plantBuildCost(s,id);s.coins=N.sub(s.coins,c);s.plants[id].count++;s.stats.plantsBuilt++;return true;}
  function nextMilestone(s,id){const c=s.machines[id].count;return D.milestones.find(x=>x.count>c)||null;}
  function updateMilestone(s,id){let mult=1;D.milestones.forEach(x=>{if(s.machines[id].count>=x.count)mult=x.multiplier;});s.machines[id].milestoneMult=mult;}
  function canBuyManager(s,id){const d=mDef(id),m=s.machines[id];return m.count>0&&!m.hasManager&&s.coins>=d.managerCost;}
  function buyManager(s,id){if(!canBuyManager(s,id))return false;s.coins=N.sub(s.coins,mDef(id).managerCost);s.machines[id].hasManager=true;s.stats.managersBought++;return true;}
  function globalMult(s){return 1+(s.repeatResearch.industrialEfficiency||0)*.05+Math.max(0,(s.galaxy.colonies||1)-1)*.04;}
  function machineLevel(s,id){return clamp(Number(s.machineLevels[id]||1),1,5);}
  function plantLevel(s,id){return clamp(Number(s.plantLevels[id]||1),1,5);}
  function machineRate(s,id){const d=mDef(id),m=s.machines[id],lm=D.levelMultipliers[machineLevel(s,id)-1]||1;return d.baseRate*m.count*(m.milestoneMult||1)*lm*globalMult(s);}
  function machinePowerDemand(s,id){const d=mDef(id),m=s.machines[id],lv=machineLevel(s,id);return m.hasManager?d.power*m.count*(1+.24*(lv-1)):0;}
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
  function manualClick(s,id){const d=mDef(id);if(!d||s.machines[id].count<1)return 0;const out=Object.keys(d.recipe.out)[0],before=s.inventory[out]||0;runMachine(s,id,D.economyConfig.manualBurstSeconds,1);return (s.inventory[out]||0)-before;}
  function addCoins(s,amount){s.coins=N.add(s.coins,amount);s.totalEarned=N.add(s.totalEarned,amount);s.runEarned=N.add(s.runEarned,amount);}

  // ===== Pazar =====
  function clampPct(v){return clamp(Math.round(Number(v||0)/25)*25,0,100);}
  function setAutoSellKeep(s,item,pct){if(D.items[item])s.autoSellKeep[item]=clampPct(pct);}
  function setGlobalMarketKeep(s,pct){pct=clampPct(pct);s.market.keepPct=pct;Object.keys(D.items).forEach(k=>{if(!D.items[k].research&&D.items[k].sell>0)s.autoSellKeep[k]=pct;});}
  function toggleAutoSell(s,item){if(D.items[item]&&!D.items[item].research&&D.items[item].sell>0)s.autoSell[item]=!s.autoSell[item];}
  function setAllAutoSell(s,on){Object.keys(D.items).forEach(k=>{if(!D.items[k].research&&D.items[k].sell>0)s.autoSell[k]=!!on;});}
  function fuelReserve(s,item){let r=0;D.powerPlants.forEach(d=>{if(d.fuel&&d.fuel.item===item)r+=s.plants[d.id].count*d.fuel.rate*45;});if(item==='starFuel')r+=fleetFuelReserve(s);return r;}
  function fleetFuelReserve(s){let n=0;D.ships.forEach(d=>n+=(s.galaxy.ships[d.id]||0)*d.fuel);return n*2;}
  function sellFraction(s,item,fraction){
    const it=D.items[item];if(!it||it.research||it.sell<=0)return 0;const have=s.inventory[item]||0,reserve=fuelReserve(s,item),avail=Math.max(0,have-reserve),amt=Math.min(avail,have*clamp(fraction,0,1));if(amt<=0)return 0;
    const gain=amt*it.sell*D.market.manualPriceFactor;s.inventory[item]-=amt;addCoins(s,gain);return gain;
  }
  function sellItem(s,item){return sellFraction(s,item,1);}
  function marketCapacity(s){return D.market.baseCapacity*Math.pow(D.market.capacityGrowth,(s.market.level||1)-1)*(1+(s.repeatResearch.marketLogistics||0)*.1);}
  function marketCooldownSec(s){return Math.max(15,D.market.baseCooldownSec*Math.pow(D.market.cooldownStep,(s.market.level||1)-1)*Math.pow(.97,s.repeatResearch.marketLogistics||0));}
  function marketUpgradeCost(s){const lv=s.market.level||1;return {coins:Math.ceil(5000*Math.pow(4,lv-1)),items:lv===1?{circuit:40,betaCore:20}:lv===2?{processor:25,gammaCore:30}:lv===3?{titaniumPlate:25,deltaCore:30}:{energyCrystal:35,omegaCore:25}};}
  function canUpgradeMarket(s){if(!s.researched.marketSatellite||s.market.level>=D.market.maxLevel)return false;const c=marketUpgradeCost(s);return s.coins>=c.coins&&Object.entries(c.items).every(([k,v])=>(s.inventory[k]||0)>=v);}
  function upgradeMarket(s){if(!canUpgradeMarket(s))return false;const c=marketUpgradeCost(s);s.coins-=c.coins;Object.entries(c.items).forEach(([k,v])=>s.inventory[k]-=v);s.market.level++;return true;}
  function runMarket(s,now){
    if(!s.researched.marketSatellite||!s.market.enabled)return 0;
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
  function isResearchVisible(s,id){const t=D.research.find(x=>x.id===id);return !!t&&t.prereq.every(p=>s.researched[p]);}
  function canResearch(s,id){const t=D.research.find(x=>x.id===id);return !!t&&!s.researched[id]&&t.prereq.every(p=>s.researched[p])&&Object.entries(t.cost).every(([k,v])=>(s.inventory[k]||0)>=v);}
  function doResearch(s,id){if(!canResearch(s,id))return false;const t=D.research.find(x=>x.id===id);Object.entries(t.cost).forEach(([k,v])=>s.inventory[k]-=v);s.researched[id]=true;return true;}
  function repeatCost(s,id){const r=D.repeatableResearch.find(x=>x.id===id),lv=s.repeatResearch[id]||0,out={};if(!r)return null;Object.entries(r.base).forEach(([k,v])=>out[k]=Math.ceil(v*Math.pow(r.growth,lv)));return out;}
  function canRepeatResearch(s,id){if(!s.researched.omegaScience)return false;const c=repeatCost(s,id);return !!c&&Object.entries(c).every(([k,v])=>(s.inventory[k]||0)>=v);}
  function doRepeatResearch(s,id){if(!canRepeatResearch(s,id))return false;const c=repeatCost(s,id);Object.entries(c).forEach(([k,v])=>s.inventory[k]-=v);s.repeatResearch[id]=(s.repeatResearch[id]||0)+1;return true;}

  // ===== Filo / Galaksi =====
  function targetById(s,id){return s.galaxy.targets.find(t=>t.id===id);}
  function scanCost(s){const i=s.galaxy.targets.filter(t=>t.discovered).length;return {coins:Math.ceil(2500*Math.pow(1.9,i)),processor:Math.ceil(5*Math.pow(1.35,i))};}
  function canScan(s){const c=scanCost(s);return !!s.researched.scanner&&Date.now()>=s.galaxy.scanCooldownUntil&&s.galaxy.targets.some(t=>!t.discovered)&&s.coins>=c.coins&&(s.inventory.processor||0)>=c.processor;}
  function scanNextTarget(s){if(!canScan(s))return null;const c=scanCost(s),t=s.galaxy.targets.find(x=>!x.discovered);s.coins-=c.coins;s.inventory.processor-=c.processor;t.discovered=true;t.scannedAt=Date.now();s.galaxy.scanCooldownUntil=Date.now()+20000;s.stats.systemsScanned++;addReport(s,'scan',`🔭 ${t.name} keşfedildi`,`${t.type} · Mesafe ${t.distance} · Tehdit ${t.threat}`);return t;}

  function colonyCost(s,targetId){
    const t=targetById(s,targetId),n=Math.max(1,s.galaxy.colonies||1);
    return t?{coins:Math.ceil(70000*Math.pow(1.85,n-1)*t.distance),items:{titaniumPlate:20+10*n,machinery:15+8*n,starFuel:20+10*n}}:null;
  }
  function canColonize(s,targetId){
    const t=targetById(s,targetId),c=colonyCost(s,targetId);
    return !!t&&t.defeated&&!t.colonized&&!!s.researched.colonization&&s.coins>=c.coins&&Object.entries(c.items).every(([k,v])=>(s.inventory[k]||0)>=v);
  }
  function colonizeTarget(s,targetId){
    if(!canColonize(s,targetId))return false;const t=targetById(s,targetId),c=colonyCost(s,targetId);s.coins-=c.coins;Object.entries(c.items).forEach(([k,v])=>s.inventory[k]-=v);t.colonized=true;s.galaxy.colonies=(s.galaxy.colonies||1)+1;s.galaxy.threat+=t.threat*.35;addReport(s,'colony',`🪐 ${t.name} kolonileştirildi`,`İmparatorluk üretimine kalıcı +%4 katkı sağlıyor.`);return true;
  }

  function canBuildShip(s,id,count){const d=shipDef(id);count=Math.max(1,Math.floor(count||1));return !!d&&(!d.tech||s.researched[d.tech])&&Object.entries(d.cost).every(([k,v])=>(s.inventory[k]||0)>=v*count);}
  function queueShip(s,id,count){count=clamp(Math.floor(count||1),1,99);if(!canBuildShip(s,id,count))return false;const d=shipDef(id);Object.entries(d.cost).forEach(([k,v])=>s.inventory[k]-=v*count);const last=s.galaxy.shipQueue[s.galaxy.shipQueue.length-1],start=Math.max(Date.now(),last?last.finishAt:0),speed=1+(s.repeatResearch.industrialEfficiency||0)*.02;s.galaxy.shipQueue.push({id:'sq'+Date.now()+Math.random(),shipId:id,count,finishAt:start+d.buildSec*count*1000/speed});return true;}
  function canBuildDefense(s,id,count){const d=defenseDef(id);count=Math.max(1,Math.floor(count||1));return !!d&&(!d.tech||s.researched[d.tech])&&Object.entries(d.cost).every(([k,v])=>(s.inventory[k]||0)>=v*count);}
  function buildDefense(s,id,count){count=clamp(Math.floor(count||1),1,99);if(!canBuildDefense(s,id,count))return false;const d=defenseDef(id);Object.entries(d.cost).forEach(([k,v])=>s.inventory[k]-=v*count);s.galaxy.defenses[id]=(s.galaxy.defenses[id]||0)+count;return true;}
  function fleetStats(selection,s){let attack=0,hull=0,cargo=0,speed=99,fuel=0,total=0;D.ships.forEach(d=>{const n=Math.max(0,Math.floor(selection[d.id]||0));if(!n)return;total+=n;attack+=n*d.attack;hull+=n*d.hull;cargo+=n*d.cargo;speed=Math.min(speed,d.speed);fuel+=n*d.fuel;});return {attack,hull,cargo,speed:speed===99?0:speed,fuel,total};}
  function weaponMult(s){return (s.researched.plasmaWeapons?1.2:1)*(1+(s.repeatResearch.weaponSystems||0)*.07);}
  function shieldMult(s){return (s.researched.phaseShields?1.2:1)*(1+(s.repeatResearch.shieldSystems||0)*.07);}
  function travelSeconds(s,target,selection){const fs=fleetStats(selection,s),warp=1+(s.repeatResearch.warpNavigation||0)*.08+(s.researched.warpDrive?.25:0);return Math.max(12,target.distance*55/(Math.max(.25,fs.speed)*warp));}
  function canSendFleet(s,targetId,selection){const t=targetById(s,targetId),fs=fleetStats(selection,s);if(!t||!t.discovered||t.defeated||!s.researched.fleetCommand||fs.total<1)return false;const available=D.ships.every(d=>(selection[d.id]||0)<=(s.galaxy.ships[d.id]||0));const fuel=fs.fuel*t.distance;return available&&(s.inventory.starFuel||0)>=fuel&&!s.galaxy.missions.some(m=>m.targetId===targetId&&m.status!=='done');}
  function sendFleet(s,targetId,selection){
    selection=Object.fromEntries(D.ships.map(d=>[d.id,Math.max(0,Math.floor(selection[d.id]||0))]));if(!canSendFleet(s,targetId,selection))return false;
    const t=targetById(s,targetId),fs=fleetStats(selection,s),fuel=fs.fuel*t.distance;D.ships.forEach(d=>s.galaxy.ships[d.id]-=selection[d.id]||0);s.inventory.starFuel-=fuel;
    const sec=travelSeconds(s,t,selection);s.galaxy.missions.push({id:'m'+Date.now()+Math.random(),targetId,status:'outbound',ships:selection,arrivalAt:Date.now()+sec*1000,returnAt:0,pendingLoot:null,battle:null});s.galaxy.threat+=t.threat*.6;addReport(s,'mission',`🚀 Filo ${t.name} hedefine çıktı`,`Varış süresi yaklaşık ${Math.ceil(sec)} saniye.`);return true;
  }
  function distributeSurvivors(selection,ratio){const out={};Object.entries(selection).forEach(([k,v])=>out[k]=Math.max(0,Math.floor(v*ratio)));return out;}
  function resolveBattle(s,mission,now){
    const t=targetById(s,mission.targetId),fs=fleetStats(mission.ships,s),roll=.9+Math.random()*.2,pAttack=fs.attack*weaponMult(s)*roll,pHull=fs.hull*shieldMult(s),ePower=t.strength*(.9+Math.random()*.2),enemyAttack=ePower*.62;
    const won=pAttack>=ePower;const lossRatio=clamp(enemyAttack/Math.max(1,pHull),0,1);const surviveRatio=won?clamp(1-lossRatio*.68,.08,1):clamp(1-lossRatio,0,.65);mission.ships=distributeSurvivors(mission.ships,surviveRatio);mission.battle={won,pAttack,ePower,surviveRatio};
    if(won){
      t.defeated=true;t.victories=(t.victories||0)+1;t.recoveryAt=now+(180+t.threat*55)*1000;s.stats.battlesWon++;
      const lootScale=1+(t.victories-1)*.12;mission.pendingLoot={};Object.entries(t.loot).forEach(([k,v])=>mission.pendingLoot[k]=Math.ceil(v*lootScale));
      s.galaxy.threat+=t.threat;addReport(s,'win',`🏆 ${t.name} yenildi`,`Filo kaybı %${Math.round((1-surviveRatio)*100)}. Kolonileştirilmezse düşman yeniden örgütlenecek.`);
    }
    else{s.stats.battlesLost++;addReport(s,'loss',`☠️ ${t.name} saldırısı başarısız`,`Filo kaybı %${Math.round((1-surviveRatio)*100)}. Sağ kalanlar dönüyor.`);}
    mission.status='returning';mission.returnAt=now+travelSeconds(s,t,mission.ships)*1000;
  }
  function deliverMission(s,m){D.ships.forEach(d=>s.galaxy.ships[d.id]=(s.galaxy.ships[d.id]||0)+(m.ships[d.id]||0));if(m.pendingLoot){Object.entries(m.pendingLoot).forEach(([k,v])=>{if(k==='coins')addCoins(s,v);else s.inventory[k]=Math.min(storageCap(s,k),(s.inventory[k]||0)+v);});}m.status='done';addReport(s,'return','🏠 Filo üsse döndü',m.pendingLoot?'Ganimet depoya aktarıldı.':'Sağ kalan gemiler hangara alındı.');}
  function addReport(s,type,title,body){s.galaxy.reports.unshift({id:'r'+Date.now()+Math.random(),type,title,body,time:Date.now()});s.galaxy.reports=s.galaxy.reports.slice(0,40);}
  function defenseStats(s){let attack=0,hull=0;D.defenses.forEach(d=>{const n=s.galaxy.defenses[d.id]||0;attack+=n*d.attack;hull+=n*d.hull;});return {attack:attack*weaponMult(s),hull:hull*shieldMult(s)};}
  function resolveRaid(s,now){
    const threat=Math.max(1,s.galaxy.threat),enemy=150+threat*120+s.stats.battlesWon*170,ds=defenseStats(s),ammoNeed=Math.ceil(enemy*.045),ammoRatio=Math.min(1,(s.inventory.ammunition||0)/Math.max(1,ammoNeed));s.inventory.ammunition=Math.max(0,(s.inventory.ammunition||0)-ammoNeed*ammoRatio);
    const power=(ds.attack+ds.hull*.35)*(.35+.65*ammoRatio),won=power>=enemy;
    if(won){const reward=Math.ceil(enemy*14);addCoins(s,reward);s.stats.raidsWon++;addReport(s,'raid-win','🛡️ Uzaylı saldırısı püskürtüldü',`Savunma hattı dayandı. +${Math.round(reward)} kredi.`);s.galaxy.threat=Math.max(0,s.galaxy.threat*.82);}
    else{const severity=clamp((enemy-power)/enemy,.08,.28);let lostValue=0;Object.keys(D.items).forEach(k=>{const it=D.items[k];if(it.research)return;const loss=(s.inventory[k]||0)*severity;s.inventory[k]-=loss;lostValue+=loss*it.sell;});s.stats.raidsLost++;addReport(s,'raid-loss','🚨 Koloni savunması yarıldı',`Depoların yaklaşık %${Math.round(severity*100)} kadarı yağmalandı. Binalar korunarak devre dışı kalmadı.`);s.galaxy.threat+=1.5;}
    s.galaxy.nextRaidAt=now+(D.economyConfig.raidBaseSec+Math.random()*240)*1000;s.galaxy.raidWarningShown=false;
  }
  function tickGalaxy(s,now){
    while(s.galaxy.shipQueue.length&&s.galaxy.shipQueue[0].finishAt<=now){const q=s.galaxy.shipQueue.shift();s.galaxy.ships[q.shipId]=(s.galaxy.ships[q.shipId]||0)+q.count;addReport(s,'build',`${shipDef(q.shipId).icon} ${q.count} ${shipDef(q.shipId).name} tamamlandı`,'Gemiler hangara eklendi.');}
    s.galaxy.targets.forEach(t=>{if(t.defeated&&!t.colonized&&t.recoveryAt&&t.recoveryAt<=now){t.defeated=false;t.recoveryAt=0;t.strength=Math.ceil(t.strength*1.18);addReport(s,'warning',`⚠️ ${t.name} yeniden örgütlendi`,`Yeni savunma gücü ${Math.ceil(t.strength)}. Her zaferden sonra daha güçlü döner.`);}});
    s.galaxy.missions.forEach(m=>{if(m.status==='outbound'&&m.arrivalAt<=now)resolveBattle(s,m,now);else if(m.status==='returning'&&m.returnAt<=now)deliverMission(s,m);});
    s.galaxy.missions=s.galaxy.missions.filter(m=>m.status!=='done').slice(-20);
    if(!s.galaxy.raidWarningShown&&s.galaxy.nextRaidAt-now<=D.economyConfig.raidWarningSec*1000&&s.galaxy.nextRaidAt>now){s.galaxy.raidWarningShown=true;addReport(s,'warning','⚠️ Uzaylı imzası algılandı','Savunma hazırlığı için kısa süre kaldı.');}
    if(now>=s.galaxy.nextRaidAt)resolveRaid(s,now);
  }

  // ===== Tick / offline =====
  function tick(s,dt,now){now=now||Date.now();const before=blankItemMap(k=>s.inventory[k]||0),power=computePower(s,dt);[...D.machines].sort((a,b)=>a.tier-b.tier).forEach(d=>{const m=s.machines[d.id];if(m.count>0&&m.hasManager)runMachine(s,d.id,dt,power);else m.eff=0;});runMarket(s,now);tickGalaxy(s,now);Object.keys(D.items).forEach(k=>s.flow[k]=dt?((s.inventory[k]||0)-before[k])/dt:0);s.stats.playTimeSec+=dt;s.galaxy.threat=Math.max(s.galaxy.threat,s.sectorsOpened*.08+s.stats.battlesWon*.3);updateTopScore(s);return s;}
  function applyOfflineProgress(s){
    const now=Date.now(),start=Number(s.lastSeen||now),elapsed=Math.max(0,(now-start)/1000),usable=Math.min(elapsed,D.economyConfig.offlineCapSeconds),before=s.totalEarned;
    // Oyuncu çevrimdışıyken ardışık baskınlarla depoları sessizce eritme. Vadesi gelen saldırı,
    // oyuncu döndükten sonra hazırlanabileceği uyarı süresine ertelenir; üretim ve filo süreleri ilerler.
    const simulatedEnd=start+usable*1000,raidDeferred=!!(s.galaxy&&s.galaxy.nextRaidAt&&s.galaxy.nextRaidAt<=simulatedEnd);
    if(raidDeferred){s.galaxy.nextRaidAt=now+D.economyConfig.raidWarningSec*1000;s.galaxy.raidWarningShown=false;}
    if(usable>0){const chunks=Math.min(120,Math.max(1,Math.ceil(usable/60))),step=usable/chunks,dt=step*D.economyConfig.offlineRate;for(let i=0;i<chunks;i++)tick(s,dt,start+(i+1)*step*1000);}
    if(raidDeferred&&!s.galaxy.raidWarningShown){s.galaxy.raidWarningShown=true;addReport(s,'warning','⚠️ Çevrimdışı saldırı ertelendi','Savunma hazırlığı yapabilmen için uzaylı baskını geri dönüşünden sonraya ertelendi.');}
    s.lastSeen=now;return {earned:s.totalEarned-before,usableSeconds:usable,wasCapped:elapsed>D.economyConfig.offlineCapSeconds,raidDeferred};
  }

  // ===== Bilgi / skor =====
  function machineCountTotal(s){return D.machines.reduce((n,d)=>n+s.machines[d.id].count,0);}
  function plantCountTotal(s){return D.powerPlants.reduce((n,d)=>n+s.plants[d.id].count,0);}
  function computeScore(s){return Math.floor(s.totalEarned+Object.keys(s.researched).length*4500+s.sectorsOpened*2000+s.stats.battlesWon*40000+s.stats.buildingUpgrades*8000+machineCountTotal(s)*250);}
  function updateTopScore(s){const x=computeScore(s);if(x>s.topScore)s.topScore=x;return x;}
  function itemInfo(s,item){const it=D.items[item];return {id:item,name:it.name,icon:it.icon,tier:it.tier,desc:it.desc||'',sell:it.sell,research:!!it.research,producers:D.machines.filter(m=>m.recipe.out[item]).map(m=>m.name),consumers:D.machines.filter(m=>m.recipe.in[item]).map(m=>m.name),fuelFor:D.powerPlants.filter(p=>p.fuel&&p.fuel.item===item).map(p=>p.name),amount:s.inventory[item]||0,cap:storageCap(s,item),flow:s.flow[item]||0};}

  global.Axyon.Economy = {
    SAVE_VERSION,createInitialState,normalizeState,mDef,pDef,shipDef,defenseDef,globalMult,
    isMachineUnlocked,isPlantUnlocked,storageCap,storageUpgradeCost,upgradeStorage,totalCells,usedCells,freeCells,
    buildCost,canBuild,buildMachine,nextMilestone,plantBuildCost,canBuildPlant,buildPlant,canBuyManager,buyManager,
    machineRate,machinePowerDemand,plantOutput,machineLevel,plantLevel,upgradeCost,canUpgradeClass,doUpgradeClass,
    computePower,tick,manualClick,addCoins,sellItem,sellFraction,toggleAutoSell,setAutoSellKeep,setGlobalMarketKeep,setAllAutoSell,runAutoSell,
    marketCapacity,marketCooldownSec,marketUpgradeCost,canUpgradeMarket,upgradeMarket,itemInfo,
    gridSize,entityFootprintCells,canPlaceAt,placeMachine,placePlant,moveEntity,removeEntity,addConveyor,addPowerLine,removeConveyor,removeLineNear,entityCenter,cellOccupiedExceptSelf,CELL_M2,
    mapSide,sectorsPerSide,cellSector,isSectorOpen,isCellOpen,openSectorList,openableSectors,sectorOpenCost,canOpenSector,openSector,nodeAt,nodeVisible,hasFreeNodeFor,isExtractor,extractorNodeType,
    computeScore,updateTopScore,canResearch,isResearchVisible,doResearch,repeatCost,canRepeatResearch,doRepeatResearch,applyOfflineProgress,machineCountTotal,plantCountTotal,
    targetById,scanCost,canScan,scanNextTarget,colonyCost,canColonize,colonizeTarget,canBuildShip,queueShip,canBuildDefense,buildDefense,fleetStats,canSendFleet,sendFleet,travelSeconds,defenseStats,weaponMult,shieldMult,
  };
})(typeof window !== 'undefined' ? window : globalThis);
