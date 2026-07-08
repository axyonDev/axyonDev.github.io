/* ============================================================================
 * P0 — spatial-sim.js kabul testleri (5 bitiş kriteri)
 * Her test, aggregate modelden GERÇEK farkı kanıtlar.
 * ==========================================================================*/
const S = require('../src/core/spatial-sim.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
function run(w, n) { for (let i = 0; i < n; i++) S.step(w, 1); }

console.log('P0 spatial-sim — 5 bitiş kriteri\n');

// --- Kriter 0 (ön koşul): tam zincir gerçekten AKIYOR mu? -------------------
{
  const { w, furnaceId } = S.buildProofRegion();
  run(w, 40);
  ok('0. tam zincir akıyor (ambarda ironPlate var)',
     (w.warehouse.ironPlate || 0) > 0,
     'ironPlate=' + (w.warehouse.ironPlate || 0));
}

// --- Kriter 1: BANT KESİLİNCE FIRIN DURUR -----------------------------------
// Aggregate modelde bant kozmetikti; burada bant hayat çizgisi.
{
  const R = S.buildProofRegion();
  const { w, beltId, furnaceId } = R;
  run(w, 40);                                   // akış otursun
  const plateBefore = w.warehouse.ironPlate || 0;
  S.removeBelt(w, beltId);                       // BANTI KES
  run(w, 40);                                    // inBuf boşalsın, fırın dursun
  const f = w.furnaces[furnaceId];
  const plateAfter = w.warehouse.ironPlate || 0;
  ok('1a. bant kesilince fırın verimi 0', f.eff === 0, 'eff=' + f.eff);
  ok('1b. bant kesilince fırın girdisi tükendi', (f.inBuf.ironOre || 0) === 0, 'inBuf=' + (f.inBuf.ironOre || 0));
  // kesimden sonra üretim durdu: son 10 tikte artış olmamalı
  const beforeLast = w.warehouse.ironPlate || 0; run(w, 10);
  ok('1c. kesimden sonra üretim durdu (plato)', (w.warehouse.ironPlate || 0) === beforeLast);
}

// --- Kriter 2: ÇIKIŞ DOLARSA TIKANIR (backpressure) ------------------------
// Ambar inserter'ını kaldır → fırın outBuf dolar → fırın kendini durdurur.
{
  const R = S.buildProofRegion();
  const { w, furnaceId, insC } = R;
  S.removeInserter(w, insC);                     // çıkış tahliyesini kes
  run(w, 60);
  const f = w.furnaces[furnaceId];
  ok('2a. çıkış tamponu doldu', S._bufTotal(f.outBuf) === f.outCap, 'outBuf=' + S._bufTotal(f.outBuf) + '/' + f.outCap);
  ok('2b. tıkanma bayrağı (backpressure) set', f.blocked === true);
  ok('2c. tıkanınca üretim durdu', f.producedThisTick === 0);
  ok('2d. ambara hiç levha gitmedi', (w.warehouse.ironPlate || 0) === 0);
}

// --- Kriter 3: YATAK TÜKENİNCE MADENCİ DURUR --------------------------------
{
  const w = S.createWorld({ width: 8, height: 8 });
  const nodeId = S.addOreNode(w, { x: 1, y: 1, item: 'ironOre', remaining: 5 }); // az yatak
  const minerId = S.placeMiner(w, { x: 1, y: 1, nodeId });
  const plantId = S.placePlant(w, { x: 1, y: 3, fuelItem: 'coal', fuelRate: 0.75, output: 120, fuel: 1000 });
  // madenciyi tüketen bir kanal: outBuf'u boşaltan ambar inserter'ı
  const insDrain = S.placeInserter(w, { from: minerId, fromKind: 'miner', to: 'WH', toKind: 'warehouse', item: 'ironOre' });
  S.connectPower(w, plantId, minerId);
  run(w, 50);
  const m = w.miners[minerId], node = w.nodes[nodeId];
  ok('3a. yatak tükendi (remaining=0)', node.remaining === 0, 'remaining=' + node.remaining);
  ok('3b. toplam çıkarılan = başlangıç zenginliği (5)', (w.warehouse.ironOre || 0) === 5, 'ore=' + (w.warehouse.ironOre || 0));
  ok('3c. tükenince madenci durdu', m.eff === 0 && m.extractedThisTick === 0);
}

// --- Kriter 4: GÜÇ YOKSA ÜRETİM 0 -------------------------------------------
// (a) fırının güç hattını kes → fırın 0. (b) santral yakıtı 0 → her şey 0.
{
  const R = S.buildProofRegion();
  const { w, furnaceId, minerId } = R;
  run(w, 20);                                    // önce akıyordu
  S.removePowerTo(w, furnaceId);                 // fırının hattını kes
  const plateBefore = w.warehouse.ironPlate || 0;
  run(w, 20);
  const f = w.furnaces[furnaceId];
  ok('4a. güç hattı kesilince fırın powered=false', f.powered === false);
  ok('4b. güçsüz fırın verimi 0', f.eff === 0);

  // (b) yakıt bitir senaryosu — ayrı temiz kurulum
  const R2 = S.buildProofRegion();
  R2.w.plants[R2.plantId].fuel = 0;              // santral yakıtı yok
  run(R2.w, 20);
  ok('4c. yakıtsız santral → madenci güçsüz', R2.w.miners[R2.minerId].powered === false);
  ok('4d. yakıtsız santral → fırın güçsüz', R2.w.furnaces[R2.furnaceId].powered === false);
  ok('4e. yakıtsız → hiç üretim yok', (R2.w.warehouse.ironPlate || 0) === 0);
}

// --- Kriter 5: ESKİ v16 (aggregate) KAYIT 0 CRASH YÜKLENİR ------------------
{
  let threw = false, w = null;
  const legacy = {
    inventory: { ironPlate: 100, ironOre: 42, coal: 'oops', badVal: NaN, neg: -5, circuit: 7 },
  };
  try { w = S.loadLegacyIntoWarehouse(legacy, { width: 8, height: 8 }); }
  catch (e) { threw = true; console.log('    throw:', e.message); }
  ok('5a. eski kayıt yüklenirken crash yok', threw === false);
  ok('5b. geçerli değerler ambara taşındı', w && w.warehouse.ironPlate === 100 && w.warehouse.ironOre === 42 && w.warehouse.circuit === 7);
  ok('5c. bozuk değerler (string/NaN/negatif) atlandı',
     w && w.warehouse.coal === undefined && w.warehouse.badVal === undefined && w.warehouse.neg === undefined);
  // migrasyon sonrası dünya çalışır durumda mı?
  if (w) { let okStep = true; try { S.step(w, 1); } catch (e) { okStep = false; } ok('5d. migrasyon sonrası simülasyon çalışıyor', okStep); }
}

console.log(`\n=== P0 SPATIAL-SIM: ${pass} PASS, ${fail} FAIL ===`);
process.exit(fail > 0 ? 1 : 0);
