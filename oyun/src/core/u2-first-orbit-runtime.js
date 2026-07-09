/**
 * Axyon First Orbit Runtime Bridge v4.4 U2
 *
 * Converts the v4.3 playable simulation to the frozen v4.4 First Orbit rules
 * without duplicating the canonical balance tables. Economy quantities are
 * break_eternity Decimal values; structural counts remain bounded integers.
 */
(function(global){
  'use strict';
  const A=global.Axyon=global.Axyon||{};
  const Base=A.Economy,D=A.Data,N=A.Numbers,EN=A.EconomyNumber;
  if(!Base||!D||!EN||!D.firstOrbit)throw new Error('U2 runtime requires Economy, EconomyNumber and First Orbit data');
  const E=Object.assign({},Base);
  const CELL_M2=Base.CELL_M2||4;
  const now=()=>Date.now();
  const clone=o=>JSON.parse(JSON.stringify(o));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const asInt=(v,f=0,min=0,max=1e9)=>{const n=Math.floor(Number(v));return Number.isFinite(n)?clamp(n,min,max):f;};
  const dec=v=>EN.safe(v===undefined||v===null?0:v);
  const signed=v=>EN.signed(v===undefined||v===null?0:v);
  const add=(a,b)=>EN.add(a,b),sub=(a,b)=>EN.sub(a,b),mul=(a,b)=>EN.mul(a,b),div=(a,b)=>EN.div(a,b);
  const gte=(a,b)=>EN.gte(a,b),gt=(a,b)=>EN.gt(a,b),lt=(a,b)=>EN.lt(a,b),eq=(a,b)=>EN.eq(a,b);
  const toNum=(v,max=Number.MAX_SAFE_INTEGER)=>EN.toSafeNumber(v,max);
  const mDef=id=>D.machines.find(x=>x.id===id),pDef=id=>D.powerPlants.find(x=>x.id===id),rDef=id=>D.research.find(x=>x.id===id),satDef=id=>(D.satellites||[]).find(x=>x.id===id);
  const itemKeys=()=>Object.keys(D.items);
  const sortedMachines=[...D.machines].sort((a,b)=>a.tier-b.tier);

  function normalizeDecimalMaps(s){
    s.coins=dec(s.coins);s.totalEarned=dec(s.totalEarned);s.runEarned=dec(s.runEarned);s.topScore=dec(s.topScore);
    s.inventory=s.inventory||{};s.flow=s.flow||{};s.stats=s.stats||{};s.stats.produced=s.stats.produced||{};
    for(const k of itemKeys()){
      s.inventory[k]=dec(s.inventory[k]);s.flow[k]=signed(s.flow[k]);s.stats.produced[k]=dec(s.stats.produced[k]);
      if(s.autoSell?.[k]===undefined)s.autoSell[k]=!D.items[k].research&&D.items[k].marketPolicy!=='forbidden'&&D.items[k].sell>0;
      if(s.autoSellKeep?.[k]===undefined)s.autoSellKeep[k]=50;
    }
    s.market=s.market||{};
    for(const k of ['lastRevenue','lastUnits','totalRevenue'])s.market[k]=dec(s.market[k]);
    return s;
  }
  function getInv(s,k){return dec(s.inventory?.[k]);}
  function setInv(s,k,v){s.inventory[k]=dec(v);return s.inventory[k];}
  function addInv(s,k,v,cap=true){let x=add(getInv(s,k),v);if(cap&&D.items[k])x=EN.min(x,storageCap(s,k));return setInv(s,k,x);}
  function hasItems(s,cost,multiplier=1){return Object.entries(cost||{}).every(([k,v])=>gte(getInv(s,k),mul(v,multiplier)));}
  function spendItems(s,cost,multiplier=1){if(!hasItems(s,cost,multiplier))return false;for(const[k,v]of Object.entries(cost||{}))setInv(s,k,sub(getInv(s,k),mul(v,multiplier)));return true;}
  function refundItems(s,cost,ratio=.45){for(const[k,v]of Object.entries(cost||{}))addInv(s,k,mul(v,ratio));}
  function hasCredits(s,value){return gte(s.coins,value||0);}
  function spendCredits(s,value){if(!hasCredits(s,value))return false;s.coins=sub(s.coins,value);return true;}
  function addCoins(s,value){const v=dec(value);s.coins=add(s.coins,v);s.totalEarned=add(s.totalEarned,v);s.runEarned=add(s.runEarned,v);return v;}
  function creditsVisible(s){return !!(s.market?.creditEconomyUnlocked||s.market?.legacyAccess||s.researched?.marketNetworkMk1);}

  function ensureFirstOrbitState(s,options){
    const route=options?.route||s.firstOrbit?.route||((s.empire?.planetType||s.planet?.type)==='frontier'?'synthetic':'oil');
    s.firstOrbit=Object.assign({
      route,landingReactorActive:false,landingReactorPower:0,
      starterApplied:false,starterCounts:{},sectorScans:[],firstSectorScanCompleted:false,discoveries:0
    },s.firstOrbit||{});
    s.firstOrbit.route=route;
    s.firstOrbit.sectorScans=Array.isArray(s.firstOrbit.sectorScans)?s.firstOrbit.sectorScans.filter(x=>x&&Number.isFinite(Number(x.finishAt))).slice(0,1):[];
    s.market=Object.assign({enabled:false,keepPct:50,level:0,networkMk:0,prototypeBuilt:false,creditEconomyUnlocked:false,legacyAccess:false,foundingContractsCompleted:[],contractMissions:[]},s.market||{});
    s.market.level=asInt(s.market.networkMk??s.market.level,0,0,3);s.market.networkMk=s.market.level;
    s.market.foundingContractsCompleted=Array.isArray(s.market.foundingContractsCompleted)?[...new Set(s.market.foundingContractsCompleted)].filter(id=>D.firstOrbit.foundingContracts.some(c=>c.id===id)):[];
    s.market.contractMissions=Array.isArray(s.market.contractMissions)?s.market.contractMissions.filter(x=>x&&D.firstOrbit.foundingContracts.some(c=>c.id===x.contractId)&&Number.isFinite(Number(x.finishAt))).slice(0,1):[];
    s.galaxy=s.galaxy||{};s.galaxy.satellites=Object.assign({},Object.fromEntries((D.satellites||[]).map(x=>[x.id,0])),s.galaxy.satellites||{});
    s.galaxy.satelliteQueue=Array.isArray(s.galaxy.satelliteQueue)?s.galaxy.satelliteQueue.filter(q=>q&&satDef(q.satelliteId)&&Number.isFinite(Number(q.finishAt))).slice(0,250):[];
    if(s.market.legacyAccess){s.market.creditEconomyUnlocked=true;s.market.prototypeBuilt=true;if(s.market.level<1)s.market.level=s.market.networkMk=1;}
    return s;
  }

  function openSectorCoords(s){const keys=Object.keys(s.map?.openSectors||{});return keys.map(k=>{const [sx,sy]=k.split(',').map(Number);return{sx,sy};});}
  function firstOpenSector(s){return openSectorCoords(s)[0]||{sx:Math.floor(Base.sectorsPerSide()/2),sy:Math.floor(Base.sectorsPerSide()/2)};}
  function sectorCells(s,sx,sy){const out=[],ss=D.map.sectorSize;for(let y=sy*ss;y<(sy+1)*ss;y++)for(let x=sx*ss;x<(sx+1)*ss;x++)out.push({x,y});return out;}
  function placeNode(s,type,cells){for(const p of cells){const key=`${p.x},${p.y}`;if(!s.map.nodes[key]&&!Object.values(s.grid.entities||{}).some(e=>e.x===p.x&&e.y===p.y)){s.map.nodes[key]={type};return p;}}return null;}
  function freeCellFor(s,defId,type){for(const {sx,sy} of openSectorCoords(s))for(const p of sectorCells(s,sx,sy))if(Base.canPlaceAt(s,defId,type,p.x,p.y))return p;return null;}
  function addStarterEntity(s,id){const def=mDef(id);if(!def)return false;let p=null;const nodeType=Base.extractorNodeType(id);if(nodeType){for(const [key,node] of Object.entries(s.map.nodes||{})){if(node.type!==nodeType)continue;const[x,y]=key.split(',').map(Number);if(Base.canPlaceAt(s,id,'machine',x,y)){p={x,y};break;}}}else p=freeCellFor(s,id,'machine');if(!p)return false;const eid='e'+s.grid.nextId++;s.grid.entities[eid]={id:eid,type:'machine',defId:id,x:p.x,y:p.y};const m=s.machines[id];m.count=(m.count||0)+1;m.hasManager=true;m.automationLevel=Math.max(1,m.automationLevel||0);m.milestoneMult=m.milestoneMult||1;s.firstOrbit.starterCounts[id]=(s.firstOrbit.starterCounts[id]||0)+1;return true;}
  function applyStarterPackage(s){if(s.firstOrbit.starterApplied)return s;const pack=D.firstOrbit.starterPackage||{};for(const[id,count]of Object.entries(pack.machines||{}))for(let i=0;i<Number(count||0);i++)addStarterEntity(s,id);for(const[k,v]of Object.entries(pack.stock||{}))addInv(s,k,v);s.firstOrbit.starterApplied=true;return s;}

  function createInitialState(options){
    const s=normalizeDecimalMaps(Base.createInitialState(options||{}));s.version=16;
    ensureFirstOrbitState(s,options||{});
    s.coins=dec(D.firstOrbit.startingCredits||0);s.totalEarned=dec(0);s.runEarned=dec(0);s.topScore=dec(0);
    s.market.enabled=false;s.market.level=0;s.market.networkMk=0;s.market.prototypeBuilt=false;s.market.creditEconomyUnlocked=false;s.market.legacyAccess=false;s.market.foundingContractsCompleted=[];s.market.contractMissions=[];s.market.lastRevenue=dec(0);s.market.lastUnits=dec(0);s.market.totalRevenue=dec(0);
    s.galaxy.satellites=Object.fromEntries((D.satellites||[]).map(x=>[x.id,0]));s.galaxy.satelliteQueue=[];
    applyStarterPackage(s);return s;
  }
  function captureExactEconomy(raw){
    const source=raw&&typeof raw==='object'?raw:{};
    return{
      oldVersion:Number(source.version||0),
      rootValid:Object.fromEntries(['coins','totalEarned','runEarned','topScore'].map(k=>[k,EN.finite(source[k])&&!EN.signed(source[k]).lt(0)])),
      roots:{coins:dec(source.coins),totalEarned:dec(source.totalEarned),runEarned:dec(source.runEarned),topScore:dec(source.topScore)},
      inventory:Object.fromEntries(itemKeys().map(k=>[k,dec(source.inventory?.[k])])),
      produced:Object.fromEntries(itemKeys().map(k=>[k,dec(source.stats?.produced?.[k])])),
      flow:Object.fromEntries(itemKeys().map(k=>[k,signed(source.flow?.[k])]))
    };
  }
  function mergeNormalizedEconomy(s,exact){
    for(const k of Object.keys(exact.roots)){
      // Only v8-and-older spatial migrations legitimately add an economy
      // refund during Base normalization.  Defaults such as the old 180-credit
      // starter value must never leak into malformed or new v16 saves.
      if(exact.oldVersion<=8&&exact.rootValid[k]){
        const before=toNum(exact.roots[k]),after=Number(s[k]||0),delta=after-before;
        s[k]=delta>=0?add(exact.roots[k],delta):sub(exact.roots[k],-delta);
      }else s[k]=exact.roots[k];
    }
    for(const k of itemKeys()){
      s.inventory[k]=exact.inventory[k];
      s.stats.produced[k]=exact.produced[k];
      // Flow is an instantaneous signed read-model. Sanitization may reset a
      // malformed value, but a valid Decimal/string must survive save reloads.
      s.flow[k]=exact.flow[k];
    }
    return s;
  }
  function normalizeState(raw){
    const exact=captureExactEconomy(raw);
    const s=Base.normalizeState(raw);
    mergeNormalizedEconomy(s,exact);normalizeDecimalMaps(s);s.version=16;ensureFirstOrbitState(s,raw||{});
    if(!s.firstOrbit.starterApplied&&Object.keys(s.grid?.entities||{}).length===0&&!s.market.legacyAccess)applyStarterPackage(s);
    return s;
  }

  function storageCap(s,item){const it=D.items[item];return mul(it?.cap||0,Math.pow(D.economyConfig.storageUpgradeMult,s.storageLevel?.[item]||0));}
  function storageUpgradeCost(s,item){return dec(Math.ceil((D.items[item]?.cap||500)*D.economyConfig.storageUpgradeCostPer*Math.pow(1.7,s.storageLevel?.[item]||0)));}
  function upgradeStorage(s,item){const c=storageUpgradeCost(s,item);if(!creditsVisible(s)||!spendCredits(s,c))return false;s.storageLevel[item]=(s.storageLevel[item]||0)+1;return true;}

  function scaledMaterialCost(def,count,starterCount=0){const exponent=Math.max(0,Number(count||0)-Number(starterCount||0)),growth=Number(def.buildGrowth||1.15),out={};for(const[k,v]of Object.entries(def.materialCost||{}))out[k]=dec(Math.ceil(Number(v)*Math.pow(growth,exponent)));return out;}
  function buildRequirements(s,id){const d=mDef(id),starter=s.firstOrbit?.starterCounts?.[id]||0;return d?scaledMaterialCost(d,s.machines[id]?.count||0,starter):{};}
  function plantBuildRequirements(s,id){const d=pDef(id);return d?scaledMaterialCost(d,s.plants[id]?.count||0,0):{};}
  function buildCost(){return dec(0);}function plantBuildCost(){return dec(0);}
  function canBuild(s,id){const d=mDef(id);return !!d&&Base.isMachineUnlocked(s,id)&&Base.capacityStatus(s).planet.used+(d.load||1)<=Base.capacityStatus(s).planet.max&&hasItems(s,buildRequirements(s,id))&&(!Base.isExtractor(id)||Base.hasFreeNodeFor(s,id));}
  function buildMachine(s,id){if(!canBuild(s,id)||!spendItems(s,buildRequirements(s,id)))return false;s.machines[id].count++;s.stats.machinesBuilt++;if(s.machines[id].automationLevel<1){s.machines[id].automationLevel=1;s.machines[id].hasManager=true;}return true;}
  function canBuildPlant(s,id){const d=pDef(id);return !!d&&Base.isPlantUnlocked(s,id)&&Base.capacityStatus(s).planet.used+(d.load||1)<=Base.capacityStatus(s).planet.max&&hasItems(s,plantBuildRequirements(s,id));}
  function buildPlant(s,id){if(!canBuildPlant(s,id)||!spendItems(s,plantBuildRequirements(s,id)))return false;s.plants[id].count++;s.stats.plantsBuilt++;s.firstOrbit.landingReactorActive=false;return true;}
  function placeMachine(s,id,x,y){if(!Base.canPlaceAt(s,id,'machine',x,y)||!buildMachine(s,id))return null;const eid='e'+s.grid.nextId++;s.grid.entities[eid]={id:eid,type:'machine',defId:id,x,y};return eid;}
  function placePlant(s,id,x,y){if(!Base.canPlaceAt(s,id,'plant',x,y)||!buildPlant(s,id))return null;const eid='e'+s.grid.nextId++;s.grid.entities[eid]={id:eid,type:'plant',defId:id,x,y};return eid;}
  function removeEntity(s,id){const e=s.grid.entities[id];if(!e)return false;const def=e.type==='plant'?pDef(e.defId):mDef(e.defId);const count=e.type==='plant'?s.plants[e.defId].count:s.machines[e.defId].count;const starter=e.type==='machine'?(s.firstOrbit?.starterCounts?.[e.defId]||0):0;const paidIndex=Math.max(starter,count-1);const cost=scaledMaterialCost(def,paidIndex,starter);if(e.type==='plant')s.plants[e.defId].count=Math.max(0,count-1);else s.machines[e.defId].count=Math.max(0,count-1);refundItems(s,cost,.45);delete s.grid.entities[id];s.grid.conveyors=(s.grid.conveyors||[]).filter(x=>x.from!==id&&x.to!==id);s.grid.powerLines=(s.grid.powerLines||[]).filter(x=>x.from!==id&&x.to!==id);return true;}

  function sectorOpenRequirements(){return Object.fromEntries(Object.entries(D.firstOrbit.resourceDiscovery?.sectorOpenCost||D.resourceDiscovery?.sectorOpenCost||{}).map(([k,v])=>[k,dec(v)]));}
  function sectorOpenCost(){return dec(0);}
  function canOpenSector(s,sx,sy){const openable=Base.openableSectors(s);if(s.firstOrbit.sectorScans.length)return false;if(Number.isFinite(sx)&&Number.isFinite(sy)&&!openable.some(o=>o.sx===sx&&o.sy===sy))return false;return openable.length>0&&hasItems(s,sectorOpenRequirements());}
  function openSector(s,sx,sy){if(!canOpenSector(s,sx,sy))return false;const target=Base.openableSectors(s).find(o=>o.sx===sx&&o.sy===sy)||Base.openableSectors(s)[0];if(!target||!spendItems(s,sectorOpenRequirements()))return false;const seconds=s.firstOrbit.firstSectorScanCompleted?Number(D.firstOrbit.operationDurations.sectorScanSeconds||90):Number(D.firstOrbit.operationDurations.firstSectorScanSeconds||420);s.firstOrbit.sectorScans=[{id:'scan-'+now(),sx:target.sx,sy:target.sy,startedAt:now(),finishAt:now()+seconds*1000}];return true;}
  function guaranteedDiscovery(s,index){const route=s.firstOrbit.route==='synthetic'?'oil_free':'normal_near',rules=D.firstOrbit?.resourceDiscovery?.scenarioRules?.[route]||null;if(rules)return rules.sectorDiscoveries?.[index]||{};if(index===0)return{water:1,stone:1};if(index===1)return s.firstOrbit.route==='synthetic'?{coal:2}:{crudeOil:2};return{};}
  function completeSectorScan(s,job){s.map.openSectors[`${job.sx},${job.sy}`]=true;s.sectorsOpened++;const cells=sectorCells(s,job.sx,job.sy),guaranteed=guaranteedDiscovery(s,s.firstOrbit.discoveries||0);for(const[type,count]of Object.entries(guaranteed))for(let i=0;i<Number(count||0);i++)placeNode(s,type,cells);const forbidden=new Set(s.firstOrbit.route==='synthetic'?(D.firstOrbit.resourceDiscovery?.oilFreeRoute?.forbid||['crudeOil']):[]),candidates=Object.keys(D.resourceNodes||{}).filter(t=>!guaranteed[t]&&!forbidden.has(t));for(let i=0;i<4;i++)placeNode(s,candidates[(s.map.nodeNextSeed+i*7)%Math.max(1,candidates.length)]||'ironOre',cells);s.map.nodeNextSeed=(s.map.nodeNextSeed+31)%2147483647;s.firstOrbit.discoveries=(s.firstOrbit.discoveries||0)+1;s.firstOrbit.firstSectorScanCompleted=true;}
  function tickSectorScans(s,t){const done=s.firstOrbit.sectorScans.filter(x=>x.finishAt<=t);s.firstOrbit.sectorScans=s.firstOrbit.sectorScans.filter(x=>x.finishAt>t);done.forEach(x=>completeSectorScan(s,x));return done;}

  function machineRate(s,id){const d=mDef(id),m=s.machines[id];if(!d||!m)return 0;return Base.machineRate(s,id);}
  function powerGraph(s){
    const entities=s.grid?.entities||{},adj=new Map();
    for(const id of Object.keys(entities))adj.set(id,new Set());
    for(const line of s.grid?.powerLines||[]){
      const a=entities[line?.from],b=entities[line?.to];if(!a||!b)continue;
      if(!((a.type==='plant'&&b.type==='machine')||(a.type==='machine'&&b.type==='plant')))continue;
      adj.get(a.id)?.add(b.id);adj.get(b.id)?.add(a.id);
    }
    const seen=new Set(),components=[];
    for(const id of [...adj.keys()].sort()){
      if(seen.has(id)||!adj.get(id)?.size)continue;const queue=[id],nodes=[];seen.add(id);
      while(queue.length){const x=queue.shift();nodes.push(x);for(const n of adj.get(x)||[])if(!seen.has(n)){seen.add(n);queue.push(n);}}
      components.push(nodes.sort());
    }
    return components;
  }
  function computePower(s,dt){
    if(s.firstOrbit){s.firstOrbit.landingReactorActive=false;s.firstOrbit.landingReactorPower=0;}
    const entities=s.grid?.entities||{},components=powerGraph(s),entityRatios={},machineRatioSum={},machineEntityCounts={},fuelBudget={},fuelUsed={};
    for(const d of D.powerPlants)if(d.fuel)fuelBudget[d.fuel.item]=toNum(getInv(s,d.fuel.item),Number.MAX_VALUE);
    for(const e of Object.values(entities))if(e.type==='machine')machineEntityCounts[e.defId]=(machineEntityCounts[e.defId]||0)+1;
    let connectedSupply=0,totalDemand=0,connectedDemand=0,delivered=0,poweredMachines=0;
    for(const d of D.machines)totalDemand+=Base.machinePowerDemand(s,d.id);
    for(const nodes of components){
      const plants=nodes.map(id=>entities[id]).filter(e=>e?.type==='plant'),machines=nodes.map(id=>entities[id]).filter(e=>e?.type==='machine');
      if(!plants.length||!machines.length)continue;
      let demand=0;for(const e of machines){const count=Math.max(1,Number(s.machines[e.defId]?.count||1));demand+=Base.machinePowerDemand(s,e.defId)/count;}
      const planned=[];let available=0;
      for(const e of plants){const d=pDef(e.defId),count=Math.max(1,Number(s.plants[e.defId]?.count||1)),maxOutput=Base.plantOutput(s,e.defId)/count;let reserve=0,ratio=1;
        if(d?.fuel){const need=Math.max(0,Number(d.fuel.rate||0)*Math.max(0,dt)*(1+.12*((s.plantLevels[e.defId]||1)-1)));const item=d.fuel.item,have=Math.max(0,Number(fuelBudget[item]||0));ratio=need>0?Math.min(1,have/need):(have>0?1:0);reserve=need*ratio;fuelBudget[item]=Math.max(0,have-reserve);planned.push({item,reserve,maxOutput,ratio});}
        else planned.push({item:null,reserve:0,maxOutput,ratio:1});available+=maxOutput*ratio;
      }
      const componentRatio=demand>0?Math.min(1,available/demand):0,loadFactor=available>0?Math.min(1,demand/available):0;
      for(const p of planned)if(p.item&&p.reserve>0){const use=p.reserve*loadFactor;fuelUsed[p.item]=(fuelUsed[p.item]||0)+use;fuelBudget[p.item]=(fuelBudget[p.item]||0)+(p.reserve-use);}
      connectedSupply+=available;connectedDemand+=demand;delivered+=demand*componentRatio;
      for(const e of machines){entityRatios[e.id]=componentRatio;machineRatioSum[e.defId]=(machineRatioSum[e.defId]||0)+componentRatio;if(componentRatio>0)poweredMachines++;}
    }
    for(const [item,used] of Object.entries(fuelUsed))setInv(s,item,sub(getInv(s,item),used));
    const machineRatios={};for(const d of D.machines){const count=Math.max(0,Number(s.machines[d.id]?.count||0));machineRatios[d.id]=count?Math.max(0,Math.min(1,(machineRatioSum[d.id]||0)/count)):0;}
    const unpoweredMachines=Math.max(0,Object.values(machineEntityCounts).reduce((a,b)=>a+b,0)-poweredMachines),ratio=totalDemand?Math.max(0,Math.min(1,delivered/totalDemand)):1;
    s._power={supply:connectedSupply,demand:totalDemand,connectedDemand,unconnectedDemand:Math.max(0,totalDemand-connectedDemand),delivered,ratio,machineRatios,entityRatios,poweredMachines,unpoweredMachines,requiresLines:true};return ratio;
  }
  function runMachine(s,id,seconds,powerRatio){const d=mDef(id),m=s.machines[id];if(!d||!m||m.count<=0){if(m)m.eff=0;return;}let desired=machineRate(s,id)*seconds*Math.max(0,Math.min(1,Number(powerRatio)||0));if(desired<=0){m.eff=0;return;}let actual=desired;for(const[k,v]of Object.entries(d.recipe.in))actual=Math.min(actual,toNum(div(getInv(s,k),v),Number.MAX_VALUE));for(const[k,v]of Object.entries(d.recipe.out))actual=Math.min(actual,toNum(div(sub(storageCap(s,k),getInv(s,k)),v),Number.MAX_VALUE));actual=Math.max(0,Math.min(desired,actual));m.eff=desired?actual/desired:0;if(!actual)return;for(const[k,v]of Object.entries(d.recipe.in))setInv(s,k,sub(getInv(s,k),actual*v));for(const[k,v]of Object.entries(d.recipe.out)){addInv(s,k,actual*v);s.stats.produced[k]=add(s.stats.produced[k],actual*v);}}
  function manualClick(s,id){const d=mDef(id),m=s.machines[id];if(!d||!m||m.count<1)return dec(0);const ratio=Number(s._power?.machineRatios?.[id]||0);if(ratio<=0)return dec(0);const out=Object.keys(d.recipe.out)[0],before=getInv(s,out);runMachine(s,id,D.economyConfig.manualBurstSeconds/Math.max(1,m.count),ratio);return sub(getInv(s,out),before);}
  function entityPowerStatus(s,entityId){const e=s.grid?.entities?.[entityId];if(!e)return{linked:false,powered:false,ratio:0};if(e.type==='plant')return{linked:(s.grid?.powerLines||[]).some(l=>l.from===entityId||l.to===entityId),powered:true,ratio:1};const linked=(s.grid?.powerLines||[]).some(l=>l.from===entityId||l.to===entityId),ratio=Math.max(0,Math.min(1,Number(s._power?.entityRatios?.[entityId]||0)));return{linked,powered:linked&&ratio>0,ratio};}

  function researchLabSpeed(s,t){const lab=t.lab||'alphaLab',m=s.machines[lab],lv=Base.machineLevel(s,lab);if(!m||m.count<1||lv<(t.labLevel||1))return 0;return Math.min(4,Math.max(1,(1+(lv-1)*.25)*(1+Math.log2(Math.max(1,m.count))*.4)));}
  function researchQueueCapacity(s){return s.researched.omegaScience?3:s.researched.advElectronics?2:1;}
  function isScheduled(s,kind,id){return !!(s.researchProgress.active&&s.researchProgress.active.kind===kind&&s.researchProgress.active.id===id)||(s.researchProgress.queue||[]).some(x=>x.kind===kind&&x.id===id);}
  function discovered(s,type){return Object.values(s.map.nodes||{}).some(n=>n.type===type);}
  function requirementMissing(s,t){const out=[],r=t.requirements||{},lab=mDef(t.lab||'alphaLab');if(!researchLabSpeed(s,t))out.push(`${lab?.name||'Laboratuvar'} Mk ${t.labLevel||1} ve en az 1 adet gerekli`);for(const id of t.prereq||[])if(!s.researched[id])out.push(`${rDef(id)?.name||id} tamamlanmalı`);for(const group of t.prereqAny||[]){const ids=Array.isArray(group)?group:[group];if(ids.length&&!ids.some(id=>s.researched[id]))out.push(`Şunlardan biri gerekli: ${ids.map(id=>rDef(id)?.name||id).join(' / ')}`);}if(!hasCredits(s,t.coins||0))out.push(`${N.format(sub(t.coins||0,s.coins))} kredi eksik`);for(const[k,v]of Object.entries(t.cost||{}))if(!gte(getInv(s,k),v))out.push(`${D.items[k]?.name||k}: ${N.format(sub(v,getInv(s,k)))} eksik`);if(r.machineTotal&&Base.machineCountTotal(s)<r.machineTotal)out.push(`Toplam ${r.machineTotal} makine gerekli`);if(r.sectors&&Base.openSectorList(s).length<r.sectors)out.push(`${r.sectors} açık bölge gerekli`);for(const type of r.resourceDiscovered||[])if(!discovered(s,type))out.push(`${D.items[type]?.name||type} kaynağı keşfedilmeli`);for(const id of r.contractsCompleted||[])if(!s.market.foundingContractsCompleted.includes(id))out.push(`${D.firstOrbit.foundingContracts.find(c=>c.id===id)?.name||id} tamamlanmalı`);if(r.satellitesOperational&&marketSatelliteCount(s)<r.satellitesOperational)out.push(`${r.satellitesOperational} çalışan uydu gerekli`);if(r.ships&&D.ships.reduce((n,d)=>n+(s.galaxy.ships[d.id]||0),0)<r.ships)out.push(`${r.ships} gemi gerekli`);if(r.battlesWon&&(s.stats.battlesWon||0)<r.battlesWon)out.push(`${r.battlesWon} uzay zaferi gerekli`);return out;}
  function isResearchVisible(s,id){const t=rDef(id);return !!t&&(s.researched[id]||!(t.prereq||[]).length||(t.prereq||[]).some(p=>s.researched[p]));}
  function researchMissing(s,id){const t=rDef(id);if(!t)return['Araştırma bulunamadı'];if(s.researched[id])return['Tamamlandı'];if(isScheduled(s,'main',id))return['Araştırma sırasına alındı'];const out=requirementMissing(s,t);if((s.researchProgress.active?1:0)+s.researchProgress.queue.length>=researchQueueCapacity(s))out.push('Araştırma kuyruğu dolu');return out;}
  function canResearch(s,id){return researchMissing(s,id).length===0;}
  function activateJob(s,job,start){const t=job.kind==='main'?rDef(job.id):D.repeatableResearch.find(x=>x.id===job.id),speed=job.kind==='main'?researchLabSpeed(s,t):researchLabSpeed(s,{lab:'omegaLab',labLevel:1});job.startedAt=start||now();job.finishAt=job.startedAt+Math.ceil(job.durationSec/Math.max(1,speed))*1000;s.researchProgress.active=job;}
  function enqueue(s,job){if(!s.researchProgress.active)activateJob(s,job,now());else s.researchProgress.queue.push(job);}
  function doResearch(s,id){if(!canResearch(s,id))return false;const t=rDef(id);if(!spendCredits(s,t.coins||0)||!spendItems(s,t.cost||{}))return false;enqueue(s,{kind:'main',id,cost:clone(t.cost||{}),coins:EN.toStorage(dec(t.coins||0)),durationSec:t.durationSec,lab:t.lab,labLevel:t.labLevel,startedAt:0,finishAt:0});return true;}
  function repeatCost(s,id){const r=D.repeatableResearch.find(x=>x.id===id),lv=s.repeatResearch[id]||0,out={};if(!r)return null;for(const[k,v]of Object.entries(r.base||{}))out[k]=dec(Math.ceil(Number(v)*Math.pow(r.growth,lv)));return out;}
  function repeatDuration(s,id){const r=D.repeatableResearch.find(x=>x.id===id),lv=s.repeatResearch[id]||0;return Math.ceil((r?.durationSec||259200)*Math.pow(1.22,lv));}
  function repeatMissing(s,id){const r=D.repeatableResearch.find(x=>x.id===id);if(!r)return['Araştırma bulunamadı'];if(!s.researched.omegaScience)return['Omega Bilimi gerekli'];if(isScheduled(s,'repeat',id))return['Araştırma sırasına alındı'];const out=[],cost=repeatCost(s,id);if(!researchLabSpeed(s,{lab:'omegaLab',labLevel:1}))out.push('En az 1 Omega İstasyonu gerekli');for(const[k,v]of Object.entries(cost||{}))if(!gte(getInv(s,k),v))out.push(`${D.items[k]?.name||k}: ${N.format(sub(v,getInv(s,k)))} eksik`);if((s.researchProgress.active?1:0)+s.researchProgress.queue.length>=researchQueueCapacity(s))out.push('Araştırma kuyruğu dolu');return out;}
  function canRepeatResearch(s,id){return repeatMissing(s,id).length===0;}
  function doRepeatResearch(s,id){if(!canRepeatResearch(s,id))return false;const cost=repeatCost(s,id),r=D.repeatableResearch.find(x=>x.id===id);if(!spendItems(s,cost))return false;enqueue(s,{kind:'repeat',id,cost:Object.fromEntries(Object.entries(cost).map(([k,v])=>[k,EN.toStorage(v)])),coins:'0',durationSec:repeatDuration(s,id),lab:'omegaLab',labLevel:1,startedAt:0,finishAt:0});return true;}
  function completeJob(s,job){if(job.kind==='main'){s.researched[job.id]=true;if(job.id==='marketNetworkMk1'){s.market.level=s.market.networkMk=1;s.market.creditEconomyUnlocked=true;s.market.enabled=false;}}else s.repeatResearch[job.id]=(s.repeatResearch[job.id]||0)+1;}
  function tickResearch(s,t){const done=[];while(s.researchProgress.active&&s.researchProgress.active.finishAt<=t){const job=s.researchProgress.active,at=job.finishAt;completeJob(s,job);done.push(job);s.researchProgress.active=null;const next=s.researchProgress.queue.shift();if(next)activateJob(s,next,at);}return done;}
  function cancelResearch(s){const a=s.researchProgress.active;if(!a)return false;addCoins(s,mul(a.coins||0,.7));for(const[k,v]of Object.entries(a.cost||{}))addInv(s,k,mul(v,.7));s.researchProgress.active=null;const next=s.researchProgress.queue.shift();if(next)activateJob(s,next,now());return true;}
  function researchProgressInfo(s,t=now()){const a=s.researchProgress.active;if(!a)return null;const total=Math.max(1,a.finishAt-a.startedAt),left=Math.max(0,a.finishAt-t);return Object.assign({},a,{progress:clamp(1-left/total,0,1),leftSec:Math.floor(left/1000)});}

  function marketSatelliteLimit(s){const mk=asInt(s.market?.networkMk??s.market?.level,0,0,3);return Number((D.firstOrbit?.resourceDiscovery?.satelliteLimitsByMarketMk||D.rules?.satelliteLimitsByMarketMk||{0:1,1:3,2:6,3:9})[mk]||([1,3,6,9][mk]));}
  function marketSatelliteCount(s){return asInt(s.galaxy.satellites.prototypeMarketSatellite,0,0,1)+asInt(s.galaxy.satellites.marketSatellite,0,0,9);}
  function marketCapacity(s){const mk=asInt(s.market.networkMk??s.market.level,0,0,3),base=dec(D.market.capacityByMk[mk]||0),limit=marketSatelliteLimit(s),count=marketSatelliteCount(s);return limit?mul(base,count/limit):dec(0);}
  function marketCooldownSec(s){const mk=asInt(s.market.networkMk??s.market.level,0,0,3);return Math.max(15,Number(D.market.cooldownSecondsByMk[mk]||180));}
  function satelliteTotalQueued(s,id){return (s.galaxy.satelliteQueue||[]).filter(q=>q.satelliteId===id).reduce((n,q)=>n+q.count,0);}
  function canBuildSatellite(s,id,count=1){const d=satDef(id);count=asInt(count,1,1,99);if(!d||!s.researched[d.tech])return false;if(id==='prototypeMarketSatellite'&&s.market.prototypeBuilt)return false;if(marketSatelliteCount(s)+satelliteTotalQueued(s,id)+count>marketSatelliteLimit(s))return false;return hasItems(s,d.cost,count);}
  function queueSatellite(s,id,count=1){count=asInt(count,1,1,99);if(!canBuildSatellite(s,id,count)||!spendItems(s,satDef(id).cost,count))return false;s.galaxy.satelliteQueue.push({id:'sat-'+now()+'-'+Math.random().toString(36).slice(2),satelliteId:id,count,startedAt:now(),finishAt:now()+Number(satDef(id).buildSec||120)*count*1000});s.galaxy.satelliteQueue.sort((a,b)=>a.finishAt-b.finishAt);return true;}
  function tickSatellites(s,t){while(s.galaxy.satelliteQueue.length&&s.galaxy.satelliteQueue[0].finishAt<=t){const q=s.galaxy.satelliteQueue.shift();s.galaxy.satellites[q.satelliteId]=(s.galaxy.satellites[q.satelliteId]||0)+q.count;if(q.satelliteId==='prototypeMarketSatellite')s.market.prototypeBuilt=true;}}
  function contractDef(id){return D.firstOrbit.foundingContracts.find(x=>x.id===id);}
  function nextContract(s){return D.firstOrbit.foundingContracts.find(c=>!s.market.foundingContractsCompleted.includes(c.id)&&!s.market.contractMissions.some(m=>m.contractId===c.id));}
  function contractPrerequisiteMet(s,id){return !!rDef(id)?!!s.researched[id]:s.market.foundingContractsCompleted.includes(id);}
  function canStartFoundingContract(s,id){const c=contractDef(id);if(!c||!s.market.prototypeBuilt||s.market.contractMissions.length||s.market.foundingContractsCompleted.includes(id))return false;if((c.prerequisites||[]).some(x=>!contractPrerequisiteMet(s,x)))return false;return hasItems(s,c.requires);}
  function startFoundingContract(s,id){if(!canStartFoundingContract(s,id)||!spendItems(s,contractDef(id).requires))return false;const seconds=Number(D.firstOrbit.operationDurations.foundingContractTransitSeconds||575);s.market.contractMissions=[{id:'contract-'+now(),contractId:id,startedAt:now(),finishAt:now()+seconds*1000}];return true;}
  function tickContracts(s,t){const done=s.market.contractMissions.filter(x=>x.finishAt<=t);s.market.contractMissions=s.market.contractMissions.filter(x=>x.finishAt>t);for(const m of done){const c=contractDef(m.contractId);if(!c||s.market.foundingContractsCompleted.includes(c.id))continue;s.market.foundingContractsCompleted.push(c.id);addCoins(s,c.creditReward);s.market.creditEconomyUnlocked=true;s.stats.marketDispatches++;}return done;}
  function setAutoSellKeep(s,item,pct){if(D.items[item])s.autoSellKeep[item]=clamp(Math.round(Number(pct||0)/25)*25,0,100);}
  function setGlobalMarketKeep(s,pct){pct=clamp(Math.round(Number(pct||0)/25)*25,0,100);s.market.keepPct=pct;for(const k of itemKeys())if(!D.items[k].research&&D.items[k].marketPolicy!=='forbidden'&&D.items[k].sell>0)s.autoSellKeep[k]=pct;}
  function toggleAutoSell(s,item){if(D.items[item]&&!D.items[item].research&&D.items[item].marketPolicy!=='forbidden'&&D.items[item].sell>0)s.autoSell[item]=!s.autoSell[item];}
  function setAllAutoSell(s,on){for(const k of itemKeys())if(!D.items[k].research&&D.items[k].marketPolicy!=='forbidden'&&D.items[k].sell>0)s.autoSell[k]=!!on;}
  function demandFactor(s,t){const period=Math.floor(t/(Number(D.market.demandPeriodSeconds||21600)*1000)),seed=(s.market.demandSeed||17)+period*1103515245;const x=((seed>>>0)%10000)/10000,[lo,hi]=D.market.demandRange;return lo+(hi-lo)*x;}
  function fuelReserve(s,item){let r=0;for(const d of D.powerPlants)if(d.fuel?.item===item)r+=(s.plants[d.id]?.count||0)*d.fuel.rate*45;return dec(r);}
  function runMarket(s,t){if(!s.researched.marketNetworkMk1||!s.market.enabled||marketSatelliteCount(s)<1)return dec(0);if(!s.market.nextDispatchAt){s.market.nextDispatchAt=t+marketCooldownSec(s)*1000;return dec(0);}if(t<s.market.nextDispatchAt)return dec(0);let remain=marketCapacity(s),units=dec(0),revenue=dec(0),demand=demandFactor(s,t),commission=Number(D.market.commissionByMk[s.market.networkMk||1]||.2);const ids=itemKeys().filter(k=>!D.items[k].research&&D.items[k].marketPolicy!=='forbidden'&&D.items[k].sell>0&&s.autoSell[k]).sort((a,b)=>D.items[b].tier-D.items[a].tier);for(const k of ids){if(!gt(remain,0))break;const reserve=fuelReserve(s,k),keep=EN.max(reserve,mul(storageCap(s,k),(s.autoSellKeep[k]||0)/100)),avail=sub(getInv(s,k),keep),amount=EN.min(avail,remain);if(gt(amount,0)){setInv(s,k,sub(getInv(s,k),amount));remain=sub(remain,amount);units=add(units,amount);revenue=add(revenue,mul(amount,D.items[k].sell*demand*(1-commission)));}}if(gt(revenue,0)){addCoins(s,revenue);s.stats.marketDispatches++;s.market.totalRevenue=add(s.market.totalRevenue,revenue);}s.market.lastRevenue=revenue;s.market.lastUnits=units;s.market.lastDispatchAt=t;s.market.nextDispatchAt=t+marketCooldownSec(s)*1000;return revenue;}
  function marketUpgradeCost(s){const mk=s.market.networkMk||0;if(mk===0)return{coins:dec(D.firstOrbit.marketMk1CreditCost),items:{betaCore:dec(80),electronics:dec(20),orbitalBus:dec(2)}};const map={1:{coins:50000,items:{processor:25,gammaCore:30}},2:{coins:250000,items:{titaniumPlate:25,deltaCore:30}}};const c=map[mk];return c?{coins:dec(c.coins),items:Object.fromEntries(Object.entries(c.items).map(([k,v])=>[k,dec(v)]))}:null;}
  function canUpgradeMarket(s){const c=marketUpgradeCost(s);if(!c||s.market.networkMk>=3)return false;return hasCredits(s,c.coins)&&hasItems(s,c.items);}
  function upgradeMarket(s){const c=marketUpgradeCost(s);if(!canUpgradeMarket(s)||!spendCredits(s,c.coins)||!spendItems(s,c.items))return false;s.market.networkMk++;s.market.level=s.market.networkMk;return true;}
  function buyMarketSatellites(s,count=1){return queueSatellite(s,'marketSatellite',count);}

  /**
   * U2 still reuses the battle/maintenance/galaxy implementation from v4.3.
   * Those routines were written for native Number values.  Running them
   * directly against Decimal inventory silently converts touched fields back
   * to Number.  This bridge gives the legacy action a bounded Number view,
   * then merges only its economy deltas into the exact Decimal state.
   */
  function runLegacyEconomyAction(s,fn,args){
    if(typeof fn!=='function')return false;
    const inventoryExact=Object.fromEntries(itemKeys().map(k=>[k,getInv(s,k)]));
    const producedExact=Object.fromEntries(itemKeys().map(k=>[k,dec(s.stats.produced[k])]));
    const flowExact=Object.fromEntries(itemKeys().map(k=>[k,signed(s.flow[k])]));
    const roots={coins:dec(s.coins),totalEarned:dec(s.totalEarned),runEarned:dec(s.runEarned),topScore:dec(s.topScore)};
    const numericBefore={inventory:{},roots:{}};
    for(const k of itemKeys()){
      numericBefore.inventory[k]=toNum(inventoryExact[k]);
      s.inventory[k]=numericBefore.inventory[k];
      s.stats.produced[k]=toNum(producedExact[k]);
      s.flow[k]=toNum(flowExact[k],Number.MAX_VALUE)*(flowExact[k].sign<0?-1:1);
    }
    for(const k of Object.keys(roots)){numericBefore.roots[k]=toNum(roots[k]);s[k]=numericBefore.roots[k];}
    let result;
    try{result=fn(s,...(args||[]));}
    finally{
      for(const k of itemKeys()){
        const after=Number(s.inventory[k]||0),before=numericBefore.inventory[k],delta=after-before;
        s.inventory[k]=delta>=0?add(inventoryExact[k],delta):sub(inventoryExact[k],-delta);
        s.stats.produced[k]=producedExact[k];
        s.flow[k]=flowExact[k];
      }
      for(const k of Object.keys(roots)){
        const after=Number(s[k]||0),before=numericBefore.roots[k],delta=after-before;
        s[k]=delta>=0?add(roots[k],delta):sub(roots[k],-delta);
      }
    }
    return result;
  }
  const legacyAction=name=>(s,...args)=>runLegacyEconomyAction(s,Base[name],args);

  function bridgeGalaxyTick(s,t){
    // Legacy combat remains authoritative in U2. Economy maps are temporarily
    // represented as bounded numbers, then exact deltas are merged back.
    const invExact=Object.fromEntries(itemKeys().map(k=>[k,getInv(s,k)])),prodExact=Object.fromEntries(itemKeys().map(k=>[k,dec(s.stats.produced[k])])),coinsExact=dec(s.coins),earnedExact=dec(s.totalEarned),runExact=dec(s.runEarned),scoreExact=dec(s.topScore);
    const invBefore={};for(const k of itemKeys()){invBefore[k]=toNum(invExact[k]);s.inventory[k]=invBefore[k];s.stats.produced[k]=toNum(prodExact[k]);s.flow[k]=0;}const coinBefore=toNum(coinsExact);s.coins=coinBefore;s.totalEarned=toNum(earnedExact);s.runEarned=toNum(runExact);s.topScore=toNum(scoreExact);
    Base.tickGalaxyLegacy(s,t);
    const coinAfter=Number(s.coins||0),earnedAfter=Number(s.totalEarned||0),runAfter=Number(s.runEarned||0);for(const k of itemKeys()){const after=Number(s.inventory[k]||0),delta=after-invBefore[k];s.inventory[k]=delta>=0?add(invExact[k],delta):sub(invExact[k],-delta);s.stats.produced[k]=prodExact[k];s.flow[k]=signed(0);}s.coins=coinAfter>=coinBefore?add(coinsExact,coinAfter-coinBefore):sub(coinsExact,coinBefore-coinAfter);s.totalEarned=earnedAfter>=toNum(earnedExact)?add(earnedExact,earnedAfter-toNum(earnedExact)):earnedExact;s.runEarned=runAfter>=toNum(runExact)?add(runExact,runAfter-toNum(runExact)):runExact;s.topScore=scoreExact;
  }
  function galaxyEventDue(s,t){
    if(s.galaxy?.shipQueue?.[0]?.finishAt<=t)return true;
    if((s.galaxy?.missions||[]).some(m=>(m.status==='outbound'&&m.arrivalAt<=t)||(m.status==='returning'&&m.returnAt<=t)))return true;
    if((s.maintenance?.repairQueue||[]).some(j=>j.finishAt<=t))return true;
    if((s.galaxy?.targets||[]).some(x=>x.defeated&&!x.colonized&&x.recoveryAt&&x.recoveryAt<=t))return true;
    const raidAt=Number(s.galaxy?.nextRaidAt||0),warning=Number(D.economyConfig.raidWarningSec||0)*1000;
    return !!raidAt&&(raidAt<=t||(!s.galaxy.raidWarningShown&&raidAt-t<=warning));
  }
  function computeScore(s){return add(add(add(add(s.totalEarned,Object.keys(s.researched).length*4500),s.sectorsOpened*2000),(s.stats.battlesWon||0)*40000),Base.machineCountTotal(s)*250);}
  function updateTopScore(s){const v=computeScore(s);if(gt(v,s.topScore))s.topScore=v;return v;}
  function tick(s,dt,t=now()){tickResearch(s,t);tickSectorScans(s,t);tickSatellites(s,t);tickContracts(s,t);const before=Object.fromEntries(itemKeys().map(k=>[k,getInv(s,k)])),power=computePower(s,dt),powerStatus=Object.assign({},s._power);for(const d of sortedMachines){const m=s.machines[d.id],machinePower=Number(s._power?.machineRatios?.[d.id]??power);if(m?.count>0&&m.hasManager)runMachine(s,d.id,dt,machinePower);else if(m)m.eff=0;}runMarket(s,t);if(galaxyEventDue(s,t))bridgeGalaxyTick(s,t);s._power=powerStatus;for(const k of itemKeys())s.flow[k]=dt?EN.divSigned(EN.subSigned(getInv(s,k),before[k]),dt):signed(0);s.stats.playTimeSec+=dt;updateTopScore(s);return s;}
  function applyOfflineProgress(s){
    const t=now(),start=Number(s.lastSeen||t),elapsed=Math.max(0,(t-start)/1000),usable=Math.min(elapsed,D.economyConfig.offlineCapSeconds),before=dec(s.totalEarned);
    const simulatedEnd=start+usable*1000;
    const raidDeferred=!!(s.galaxy?.nextRaidAt&&s.galaxy.nextRaidAt<=simulatedEnd);
    if(raidDeferred){
      s.galaxy.nextRaidAt=t+D.economyConfig.raidWarningSec*1000;
      s.galaxy.raidWarningShown=true;
      s.galaxy.reports=s.galaxy.reports||[];
      s.galaxy.reports.unshift({id:'offline-raid-'+t,type:'warning',title:'⚠️ Çevrimdışı saldırı ertelendi',body:'Savunma hazırlığı yapabilmen için uzaylı baskını geri dönüşünden sonraya ertelendi.',createdAt:t,details:{category:'intel',raidAt:s.galaxy.nextRaidAt}});
      s.galaxy.reports=s.galaxy.reports.slice(0,120);
    }
    if(usable>0){const chunks=Math.min(120,Math.max(1,Math.ceil(usable/60))),step=usable/chunks,rate=D.economyConfig.offlineRate;for(let i=0;i<chunks;i++)tick(s,step*rate,start+(i+1)*step*1000);}
    tickResearch(s,t);tickSectorScans(s,t);tickSatellites(s,t);tickContracts(s,t);s.lastSeen=t;
    return{earned:sub(s.totalEarned,before),usableSeconds:usable,wasCapped:elapsed>D.economyConfig.offlineCapSeconds,raidDeferred};
  }

  function itemInfo(s,item){const it=D.items[item];return{id:item,name:it.name,icon:it.icon,tier:it.tier,desc:it.desc||'',sell:it.sell,research:!!it.research,producers:D.machines.filter(m=>m.recipe.out[item]).map(m=>m.name),consumers:D.machines.filter(m=>m.recipe.in[item]).map(m=>m.name),fuelFor:D.powerPlants.filter(p=>p.fuel?.item===item).map(p=>p.name),amount:getInv(s,item),cap:storageCap(s,item),flow:s.flow[item]||signed(0)};}
  function operationFeed(s,t=now()){const out=Base.operationFeed?Base.operationFeed(s,t):[],push=(kind,title,deadline,detail,priority)=>out.push({kind,title,deadline,leftSec:Math.max(0,Math.floor((deadline-t)/1000)),detail,priority});for(const q of s.firstOrbit.sectorScans)push('scan','🧭 Sektör taraması',q.finishAt,`${q.sx},${q.sy} bölgesi`,7);for(const q of s.market.contractMissions){const c=contractDef(q.contractId);push('contract',`📦 ${c?.name||q.contractId}`,q.finishAt,'Kuruluş sözleşmesi',7);}return out.sort((a,b)=>(a.deadline||Infinity)-(b.deadline||Infinity)||(b.priority||0)-(a.priority||0)).slice(0,5);}
  function researchUnlocks(id){const out=Base.researchUnlocks?Base.researchUnlocks(id):[];for(const token of rDef(id)?.unlocks||[]){const[type,key]=String(token).split(':');let name=key;if(type==='machine')name=mDef(key)?.name||key;else if(type==='satellite')name=satDef(key)?.name||key;else if(type==='contract')name=contractDef(key)?.name||key;out.push(`${type==='machine'?'🏭':type==='satellite'?'🛰️':type==='contract'?'📦':'🔓'} ${name}`);}return[...new Set(out)];}

  Object.assign(E,{
    SAVE_VERSION:16,createInitialState,normalizeState,creditsVisible,
    storageCap,storageUpgradeCost,upgradeStorage,buildCost,plantBuildCost,buildRequirements,plantBuildRequirements,canBuild,buildMachine,canBuildPlant,buildPlant,placeMachine,placePlant,removeEntity,
    sectorOpenRequirements,sectorOpenCost,canOpenSector,openSector,
    computePower,tick,manualClick,entityPowerStatus,addCoins,applyOfflineProgress,itemInfo,computeScore,updateTopScore,
    researchLabSpeed,researchQueueCapacity,isResearchVisible,researchMissing,canResearch,doResearch,repeatCost,repeatDuration,repeatMissing,canRepeatResearch,doRepeatResearch,tickResearch,cancelResearch,researchProgressInfo,researchUnlocks,
    marketSatelliteLimit,marketSatelliteCount,marketCapacity,marketCooldownSec,canBuildSatellite,queueSatellite,contractDef,nextContract,canStartFoundingContract,startFoundingContract,setAutoSellKeep,setGlobalMarketKeep,toggleAutoSell,setAllAutoSell,runAutoSell:s=>runMarket(s,now()),marketUpgradeCost,canUpgradeMarket,upgradeMarket,buyMarketSatellites,operationFeed,
    // Legacy gameplay systems, protected by Decimal delta bridges.
    buyManager:legacyAction('buyManager'),upgradeAutomation:legacyAction('upgradeAutomation'),doUpgradeClass:legacyAction('doUpgradeClass'),
    upgradeInfrastructure:legacyAction('upgradeInfrastructure'),upgradeFacility:legacyAction('upgradeFacility'),
    scanNextTarget:legacyAction('scanNextTarget'),spyTarget:legacyAction('spyTarget'),
    queueShip:legacyAction('queueShip'),buildDefense:legacyAction('buildDefense'),
    sendFleet:legacyAction('sendFleet'),sendSpyMission:legacyAction('sendSpyMission'),sendSalvageMission:legacyAction('sendSalvageMission'),
    sendInvasionMission:legacyAction('sendInvasionMission'),colonizeTarget:legacyAction('colonizeTarget'),queueRepair:legacyAction('queueRepair'),
    sellItem:()=>dec(0),sellFraction:()=>dec(0),
    _u2:{normalizeDecimalMaps,tickSectorScans,tickSatellites,tickContracts,runMarket,runMachine,hasItems,spendItems,getInv,setInv,addInv,applyStarterPackage,runLegacyEconomyAction}
  });
  A.Economy=E;
})(typeof window!=='undefined'?window:globalThis);
