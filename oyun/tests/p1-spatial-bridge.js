/* ============================================================================
 * P1 — spatial-bridge.js kabul testleri (gölge modu köprüsü)
 * Kanıtlanan: flag kapalı=no-op, canlı ekonomiye sıfır dokunuş, doğru grid
 * eşlemesi, ve spatial davranışın (bağlantı/güç/tükenme) gölgede gerçekleşmesi.
 * ==========================================================================*/
const B = require('../src/core/spatial-bridge.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); } }

// --- Sahte defs + canlı state (economy şeklini taklit eder) -----------------
const DEFS = {
  machineDef: (id) => ({
    ironMine: { id: 'ironMine', recipe: { in: {}, out: { ironOre: 1 } } },
    ironFurnace: { id: 'ironFurnace', recipe: { in: { ironOre: 1 }, out: { ironPlate: 1 } } },
  })[id] || null,
  plantDef: (id) => ({ coalGen: { id: 'coalGen', fuel: { item: 'coal', rate: 0.5 }, power: 120 } })[id] || null,
  isExtractor: (id) => id === 'ironMine',
  extractorNodeType: (id) => (id === 'ironMine' ? 'ironOre' : null),
  nodeAt: (state, x, y) => state.map.nodes[x + ',' + y] || null,
};

function makeState(enabled) {
  return {
    settings: { spatialSim: !!enabled },
    inventory: { coal: 100, ironOre: 0, ironPlate: 0 },
    machines: { ironMine: { count: 1 }, ironFurnace: { count: 1 } },
    map: { nodes: { '1,1': { type: 'ironOre' } } },
    grid: {
      entities: {
        e1: { id: 'e1', type: 'machine', defId: 'ironMine', x: 1, y: 1 },
        e2: { id: 'e2', type: 'machine', defId: 'ironFurnace', x: 5, y: 1 },
        e3: { id: 'e3', type: 'plant', defId: 'coalGen', x: 1, y: 4 },
      },
      conveyors: [{ from: 'e1', to: 'e2' }],
      powerLines: [{ from: 'e3', to: 'e1' }, { from: 'e3', to: 'e2' }],
    },
  };
}

console.log('P1 spatial-bridge — gölge modu köprüsü\n');

// --- 1) FLAG KAPALI → TAM NO-OP ---------------------------------------------
{
  const s = makeState(false);
  const before = JSON.stringify(s);
  const r = B.shadowTick(s, DEFS, 1);
  ok('1a. flag kapalı → telemetri null', r === null);
  ok('1b. flag kapalı → state hiç değişmedi', JSON.stringify(s) === before);
  ok('1c. flag kapalı → report null', B.report(s) === null);
}

// --- 2) FLAG AÇIK → CANLI EKONOMİYE SIFIR DOKUNUŞ ---------------------------
{
  const s = makeState(true);
  const invBefore = JSON.stringify(s.inventory);
  const machBefore = JSON.stringify(s.machines);
  const gridBefore = JSON.stringify(s.grid);
  for (let i = 0; i < 30; i++) B.shadowTick(s, DEFS, 1);
  ok('2a. inventory değişmedi (gölge canlıyı bozmaz)', JSON.stringify(s.inventory) === invBefore, s.inventory && JSON.stringify(s.inventory));
  ok('2b. machines değişmedi', JSON.stringify(s.machines) === machBefore);
  ok('2c. grid değişmedi', JSON.stringify(s.grid) === gridBefore);
  ok('2d. telemetri üretildi (_spatial var)', !!s._spatial && s._spatial.shadow === true);
}

// --- 3) DOĞRU GRID EŞLEMESİ --------------------------------------------------
{
  const s = makeState(true);
  const built = B.buildFromGrid(s, DEFS);
  const w = built.world;
  ok('3a. 1 madenci eşlendi', Object.keys(w.miners).length === 1);
  ok('3b. 1 fırın eşlendi', Object.keys(w.furnaces).length === 1);
  ok('3c. 1 santral eşlendi', Object.keys(w.plants).length === 1);
  ok('3d. 1 konveyör → 1 bant', Object.keys(w.belts).length === 1);
  ok('3e. güç hatları bağlandı (2)', w.powerLines.length === 2);
  ok('3f. madenci doğru yatağa (ironOre) oturdu', Object.values(w.nodes)[0].item === 'ironOre');
}

// --- 4) GÖLGEDE GERÇEK SPATIAL DAVRANIŞ: bağlıyken akış ---------------------
{
  const s = makeState(true);
  for (let i = 0; i < 40; i++) B.shadowTick(s, DEFS, 1);
  const t = B.report(s);
  const miner = t.machines.find(m => m.kind === 'miner');
  const furnace = t.machines.find(m => m.kind === 'furnace');
  ok('4a. madenci güçlü ve çalışıyor', miner.powered === true && miner.eff > 0);
  ok('4b. fırın güçlü', furnace.powered === true);
  ok('4c. gölge ambarında ironPlate oluştu', (t.warehouse.ironPlate || 0) > 0, 'plate=' + (t.warehouse.ironPlate || 0));
}

// --- 5) GÖLGEDE GÜÇ KESİNTİSİ: hat yoksa üretim 0 ---------------------------
{
  const s = makeState(true);
  s.grid.powerLines = [];                     // hiç güç hattı yok
  for (let i = 0; i < 30; i++) B.shadowTick(s, DEFS, 1);
  const t = B.report(s);
  ok('5a. güç hattı yoksa fırın powered=false', t.machines.find(m => m.kind === 'furnace').powered === false);
  ok('5b. güç yoksa gölge üretimi 0', (t.warehouse.ironPlate || 0) === 0);
}

// --- 6) TOPOLOJİ DEĞİŞİNCE YENİDEN KURULUM ----------------------------------
{
  const s = makeState(true);
  B.shadowTick(s, DEFS, 1);
  const sig1 = B.signature(s);
  // yeni bir fırın ekle → imza değişmeli → köprü yeniden kurmalı
  s.grid.entities.e4 = { id: 'e4', type: 'machine', defId: 'ironFurnace', x: 6, y: 1 };
  const sig2 = B.signature(s);
  ok('6a. topoloji değişince imza değişir', sig1 !== sig2);
  B.shadowTick(s, DEFS, 1);
  const t = B.report(s);
  ok('6b. yeni fırın telemetride görünür', t.machines.filter(m => m.kind === 'furnace').length === 2);
}

// --- 7) setEnabled(false) telemetriyi ve mirror'ı temizler ------------------
{
  const s = makeState(true);
  B.shadowTick(s, DEFS, 1);
  ok('7a. açıkken telemetri var', !!s._spatial);
  B.setEnabled(s, false);
  ok('7b. kapatınca telemetri temizlendi', !s._spatial);
  ok('7c. kapatınca shadowTick null', B.shadowTick(s, DEFS, 1) === null);
}

console.log(`\n=== P1 SPATIAL-BRIDGE: ${pass} PASS, ${fail} FAIL ===`);
process.exit(fail > 0 ? 1 : 0);
