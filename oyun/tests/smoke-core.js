const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const ctx = { console, Date, Math, setTimeout, clearTimeout };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const file of ['src/core/numbers.js','data/config.js','src/core/economy.js','src/core/quests.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
}
const { Economy:E, Data:D, Quests:Q } = ctx.Axyon;
function assert(condition, message) { if (!condition) throw new Error(message); }
function findNode(s, type) { for (const key in s.map.nodes) if (s.map.nodes[key].type === type) return key.split(',').map(Number); return null; }
function freeCell(s, defId, type='machine') {
  for (const sec of E.openSectorList(s)) {
    for (let y=sec.sy*D.map.sectorSize; y<(sec.sy+1)*D.map.sectorSize; y++) {
      for (let x=sec.sx*D.map.sectorSize; x<(sec.sx+1)*D.map.sectorSize; x++) {
        if (E.canPlaceAt(s, defId, type, x, y)) return [x,y];
      }
    }
  }
  return null;
}

const s = E.createInitialState();
assert(s.version === 12, 'save schema must be v12');
assert(D.map.size === 300, 'map must be 300x300');
assert(E.sectorsPerSide() === 15, 'map must have 15 sectors per side');
assert(E.openSectorList(s).length === 4, 'start must open 2x2 sectors');
assert(!('nexus' in s) && !('prestigeCount' in s), 'Nexus/prestige state must not exist');

s.coins = 1e9;
const ironNode = findNode(s, 'ironOre');
assert(ironNode, 'guaranteed iron node missing');
assert(E.placeMachine(s, 'ironMine', ironNode[0], ironNode[1]), 'iron mine placement failed');
const furnaceCell = freeCell(s, 'ironFurnace');
assert(furnaceCell && E.placeMachine(s, 'ironFurnace', ...furnaceCell), 'iron furnace placement failed');
assert(E.buyManager(s, 'ironMine'), 'iron mine automation failed');
assert(E.buyManager(s, 'ironFurnace'), 'furnace automation failed');
for (let i=0;i<100;i++) E.tick(s, .1, Date.now()+i*100);
assert(s.stats.produced.ironOre > 0, 'iron production failed');
assert(s.stats.produced.ironPlate > 0, 'production chain failed');

s.researched.marketSatellite = true;
s.market.enabled = true;
E.setGlobalMarketKeep(s, 0);
s.inventory.ironPlate = 500;
s.market.nextDispatchAt = Date.now()-1;
const creditsBefore = s.coins;
E.tick(s, .2, Date.now());
assert(s.stats.marketDispatches === 1, 'market dispatch failed');
assert(s.coins > creditsBefore, 'market revenue missing');
assert(s.market.lastUnits <= E.marketCapacity(s)+0.001, 'market exceeded quota');

s.researched.buildingMk2 = true;
s.inventory.gear = 1000;
s.inventory.circuit = 1000;
assert(E.doUpgradeClass(s, 'ironMine', 'machine'), 'Mk II upgrade failed');
assert(E.machineLevel(s, 'ironMine') === 2, 'machine level did not increase');

for (const id of ['scanner','shipyard','fleetCommand','warpDrive']) s.researched[id] = true;
s.inventory.processor = 10000;
s.inventory.starFuel = 10000;
const target = E.scanNextTarget(s);
assert(target && target.discovered, 'galaxy scan failed');
s.galaxy.ships.fighter = 100;
assert(E.sendFleet(s, target.id, { fighter:50 }), 'fleet launch failed');
const mission = s.galaxy.missions[0];
E.tick(s, 1, mission.arrivalAt+1);
assert(mission.status === 'returning', 'battle did not resolve');
E.tick(s, 1, mission.returnAt+1);
assert(s.galaxy.missions.length === 0, 'fleet did not return');
assert(s.stats.battlesWon + s.stats.battlesLost === 1, 'battle result missing');

// Defeated non-colonized enemies must return stronger; the galaxy cannot become permanently empty.
target.defeated = true;
target.colonized = false;
target.recoveryAt = Date.now()-1;
const recoveredStrength = target.strength;
E.tick(s, .1, Date.now());
assert(!target.defeated && target.strength > recoveredStrength, 'defeated enemy resurgence failed');

// Force colonization path independently of random battle result.
target.defeated = true;
s.researched.colonization = true;
s.coins = 1e9;
s.inventory.titaniumPlate = 10000;
s.inventory.machinery = 10000;
s.inventory.starFuel = 10000;
const multBefore = E.globalMult(s);
assert(E.colonizeTarget(s, target.id), 'colonization failed');
assert(s.galaxy.colonies === 2, 'colony count failed');
assert(E.globalMult(s) > multBefore, 'colony production bonus missing');

// Raid must resolve without deleting buildings.
const machinesBefore = E.machineCountTotal(s);
s.galaxy.nextRaidAt = Date.now()-1;
E.tick(s, .1, Date.now());
assert(E.machineCountTotal(s) === machinesBefore, 'raid destroyed permanent buildings');
assert(s.stats.raidsWon + s.stats.raidsLost === 1, 'raid did not resolve');

// Old save migration: economy preserved, spatial map rebuilt.
const old = { version:8, coins:1234, inventory:{ironOre:77}, machines:{ironMine:{count:4,hasManager:true,eff:1,milestoneMult:1}}, plants:{}, researched:{basics:true}, map:{openSectors:{'0,0':true},nodes:{},nodeNextSeed:1}, grid:{entities:{old:{id:'old',type:'machine',defId:'ironMine',x:1,y:1}},conveyors:[],powerLines:[],nextId:2}, stats:{produced:{ironOre:5}} };
const migrated = E.normalizeState(old);
assert(migrated.version === 12, 'migration version failed');
assert(migrated.coins >= 1234 && migrated.inventory.ironOre === 77, 'migration lost economy/refund');
assert(migrated.machines.ironMine.count === 0, 'legacy invisible machines must be refunded and reset');
assert(E.openSectorList(migrated).length === 4, 'migration did not rebuild map');
assert(Object.keys(migrated.grid.entities).length === 0, 'legacy spatial entities must reset');

// Research order must remain fully reachable and Mk V upgrades must be executable.
const longGame = E.createInitialState();
longGame.coins = 1e15;
Object.keys(D.items).forEach(k => longGame.inventory[k] = 1e12);
for (const tech of D.research) assert(E.doResearch(longGame, tech.id), `research path blocked at ${tech.id}`);
assert(Object.keys(longGame.researched).length === D.research.length, 'main research tree incomplete');
longGame.machines.ironMine.count = 1;
longGame.plants.solarArray.count = 1;
for (let level=2; level<=5; level++) {
  assert(E.doUpgradeClass(longGame, 'ironMine', 'machine'), `machine Mk ${level} failed`);
  assert(E.doUpgradeClass(longGame, 'solarArray', 'plant'), `plant Mk ${level} failed`);
}
assert(E.machineLevel(longGame,'ironMine') === 5 && E.plantLevel(longGame,'solarArray') === 5, 'Mk V class upgrade incomplete');

// Offline progress may advance industry, but due raids must wait until the player returns.
const offline = E.createInitialState();
offline.lastSeen = Date.now()-60*60*1000;
offline.galaxy.nextRaidAt = offline.lastSeen+1000;
const raidsBefore = offline.stats.raidsWon+offline.stats.raidsLost;
const offlineResult = E.applyOfflineProgress(offline);
assert(offlineResult.raidDeferred, 'due offline raid was not deferred');
assert(offline.stats.raidsWon+offline.stats.raidsLost === raidsBefore, 'offline progress resolved a punitive raid');
assert(offline.galaxy.nextRaidAt > Date.now(), 'deferred raid has no preparation window');

s.sectorsOpened = 1;
s.questIndex = D.quests.findIndex(q=>q.type==='landExpand');
assert(Q.questProgress(s).done, 'sector quest regression');

console.log('PASS smoke-core: map, automation, market, upgrades, galaxy, resurgence, colonization, raids, migration, full research, Mk V, offline safety, quests');
