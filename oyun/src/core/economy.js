/**
 * Axyon.Economy — çekirdek ekonomi. DOM bilmez.
 *
 * Kısıt katmanları (hepsi runMachine içinde sırayla kontrol edilir):
 *   1) Makine sayısı (count) > 0 mı?
 *   2) GÜÇ: otomatik makineler kW çeker; arz < talep ise hepsi kısılır (brownout).
 *   3) GİRDİ: reçete girdisi envanterde var mı? (darboğaz)
 *   4) DEPO: çıktının deposu dolu mu? doluysa üretim durur.
 * Ayrıca ARAZI (m²): makine/santral inşası yer kaplar, arazi bitince inşa edilemez.
 */
(function (global) {
  const N = global.Axyon.Numbers;
  const D = global.Axyon.Data;

  function createInitialState() {
    const machines = {};
    D.machines.forEach((def) => { machines[def.id] = { count: 0, hasManager: false, eff: 0, milestoneMult: 1 }; });
    const plants = {};
    D.powerPlants.forEach((def) => { plants[def.id] = { count: 0 }; });
    const inventory = {}, autoSell = {}, autoSellKeep = {}, storageLevel = {}, produced = {}, flow = {};
    Object.keys(D.items).forEach((k) => { inventory[k] = 0; autoSell[k] = false; autoSellKeep[k] = 0; storageLevel[k] = 0; produced[k] = 0; flow[k] = 0; });

    const s = {
      version: 8,
      coins: 120, totalEarned: 0, runEarned: 0,
      nexus: 0, prestigeCount: 0,
      inventory, autoSell, autoSellKeep, storageLevel,
      machines, plants,
      researched: {},
      sectorsOpened: 0,
      questIndex: 0, achievements: {},
      stats: { machinesBuilt: 0, plantsBuilt: 0, managersBought: 0, playTimeSec: 0, produced },
      flow,
      settings: { theme: 'dark' },
      _power: { supply: 0, demand: 0, ratio: 1 },
      // === MEKÂNSAL KATMAN ===
      grid: {
        entities: {},      // id -> { id, type, defId, x, y }
        conveyors: [],     // { from, to }
        powerLines: [],    // { from, to }
        nextId: 1,
      },
      // === HARİTA & KEŞİF ===
      map: {
        openSectors: {},   // "sx,sy" -> true  (açık bölgeler)
        nodes: {},         // "x,y" -> { type }  (kaynak yatakları; sadece açık sektörlerdekiler görünür)
        nodeNextSeed: 1,
      },
      topScore: 0,
      lastSeen: Date.now(),
    };
    initMap(s);
    return s;
  }

  // Merkez sektörleri aç ve başlangıç nodlarını yerleştir
  function initMap(s) {
    const M = D.map;
    const sectorsPerSide = Math.floor(M.size / M.sectorSize);
    const mid = Math.floor(sectorsPerSide / 2);
    const r = M.startSectors;
    // merkez r x r blok açık (mid-1 .. mid için 2x2)
    for (let sy = mid - Math.floor(r/2); sy < mid - Math.floor(r/2) + r; sy++)
      for (let sx = mid - Math.floor(r/2); sx < mid - Math.floor(r/2) + r; sx++)
        openSectorInternal(s, sx, sy, true);
    // başlangıç garantili nodları: her guaranteedStart türünden 2'şer, merkez açık alana dağıt
    const startCells = openCells(s);
    const guaranteed = Object.keys(D.resourceNodes).filter((k) => D.resourceNodes[k].guaranteedStart);
    guaranteed.forEach((type) => {
      placeNodeRandom(s, type, startCells);
      placeNodeRandom(s, type, startCells);
    });
    // başlangıçta biraz da rastgele ek nod (çeşitlilik)
    for (let i = 0; i < 3; i++) placeNodeRandom(s, guaranteed[Math.floor(rng(s) * guaranteed.length)], startCells);
  }

  const mDef = (id) => D.machines.find((m) => m.id === id);
  const pDef = (id) => D.powerPlants.find((p) => p.id === id);

  // ===== HARİTA / SEKTÖR =====
  function mapSide(s) { return D.map.size; }
  function sectorsPerSide() { return Math.floor(D.map.size / D.map.sectorSize); }
  const sectorKey = (sx, sy) => `${sx},${sy}`;
  function cellSector(x, y) { return { sx: Math.floor(x / D.map.sectorSize), sy: Math.floor(y / D.map.sectorSize) }; }
  function isSectorOpen(s, sx, sy) { return !!s.map.openSectors[sectorKey(sx, sy)]; }
  function isCellOpen(s, x, y) { const c = cellSector(x, y); return isSectorOpen(s, c.sx, c.sy); }

  function openSectorInternal(s, sx, sy, silent) {
    const sps = sectorsPerSide();
    if (sx < 0 || sy < 0 || sx >= sps || sy >= sps) return false;
    if (s.map.openSectors[sectorKey(sx, sy)]) return false;
    s.map.openSectors[sectorKey(sx, sy)] = true;
    if (!silent) generateSectorNodes(s, sx, sy);
    return true;
  }

  // Açık sektörlerin listesi + komşu (açılabilir) sektörler
  function openSectorList(s) {
    return Object.keys(s.map.openSectors).map((k) => { const [sx, sy] = k.split(',').map(Number); return { sx, sy }; });
  }
  function openableSectors(s) {
    const sps = sectorsPerSide();
    const set = {};
    openSectorList(s).forEach(({ sx, sy }) => {
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
        const nx = sx + dx, ny = sy + dy;
        if (nx >= 0 && ny >= 0 && nx < sps && ny < sps && !isSectorOpen(s, nx, ny)) set[sectorKey(nx, ny)] = { sx: nx, sy: ny };
      });
    });
    return Object.values(set);
  }
  function sectorOpenCost(s) {
    return Math.ceil(D.map.openBaseCost * Math.pow(D.map.openGrowth, s.sectorsOpened));
  }
  function canOpenSector(s) {
    return openableSectors(s).length > 0 && s.coins >= sectorOpenCost(s);
  }
  // Belirli bir sektörü aç (komşu ve açık değilse). Başarılıysa yeni nodları döndür.
  function openSector(s, sx, sy) {
    if (!canOpenSector(s)) return false;
    const ok = openableSectors(s).some((o) => o.sx === sx && o.sy === sy);
    if (!ok) return false;
    s.coins = N.sub(s.coins, sectorOpenCost(s));
    openSectorInternal(s, sx, sy, false);
    s.sectorsOpened += 1;
    return true;
  }

  // ===== KAYNAK NODLARI =====
  const nodeKey = (x, y) => `${x},${y}`;
  function nodeAt(s, x, y) { return s.map.nodes[nodeKey(x, y)] || null; }
  function nodeVisible(s, x, y) { return isCellOpen(s, x, y) && !!nodeAt(s, x, y); }
  // deterministik-yeter rastgele (nodeNextSeed sayacıyla; save'e yazıldığı için tutarlı)
  function rng(s) {
    // xorshift benzeri; seed state'te
    let x = (s.map.nodeNextSeed = (s.map.nodeNextSeed * 1103515245 + 12345) & 0x7fffffff);
    return (x % 100000) / 100000;
  }
  function openCells(s) {
    const cells = [];
    openSectorList(s).forEach(({ sx, sy }) => {
      for (let y = sy * D.map.sectorSize; y < (sy + 1) * D.map.sectorSize; y++)
        for (let x = sx * D.map.sectorSize; x < (sx + 1) * D.map.sectorSize; x++)
          cells.push({ x, y });
    });
    return cells;
  }
  function placeNodeRandom(s, type, cellPool) {
    // boş (nod yok, entity yok) hücre bul
    const free = cellPool.filter((c) => !nodeAt(s, c.x, c.y) && !cellOccupied(s, c.x, c.y));
    if (!free.length) return null;
    const pick = free[Math.floor(rng(s) * free.length)];
    s.map.nodes[nodeKey(pick.x, pick.y)] = { type };
    return pick;
  }
  // Bir sektör açılınca içine rastgele nodlar serp (merkeze uzaklık = nadirlik kapısı)
  function generateSectorNodes(s, sx, sy) {
    const sps = sectorsPerSide();
    const mid = Math.floor(sps / 2);
    const dist = Math.max(Math.abs(sx - mid), Math.abs(sy - mid));
    const cells = [];
    for (let y = sy * D.map.sectorSize; y < (sy + 1) * D.map.sectorSize; y++)
      for (let x = sx * D.map.sectorSize; x < (sx + 1) * D.map.sectorSize; x++)
        cells.push({ x, y });
    // 2-5 nod
    const count = 2 + Math.floor(rng(s) * 4);
    const types = Object.keys(D.resourceNodes).filter((t) => {
      const minD = D.resourceNodes[t].minDistance || 0;
      return dist >= minD;
    });
    for (let i = 0; i < count; i++) {
      // nadirliğe göre ağırlıklı seçim (rarity düşük = yaygın)
      const weighted = [];
      types.forEach((t) => { const w = Math.max(1, 5 - D.resourceNodes[t].rarity); for (let j = 0; j < w; j++) weighted.push(t); });
      const type = weighted[Math.floor(rng(s) * weighted.length)];
      placeNodeRandom(s, type, cells);
    }
  }
  // Bir çıkarıcı makinenin gerektirdiği nod türü (recipe.in boşsa = çıkarıcı, out'u nod türü)
  function extractorNodeType(defId) {
    const def = mDef(defId);
    if (!def || Object.keys(def.recipe.in).length > 0) return null; // çıkarıcı değil
    return Object.keys(def.recipe.out)[0];
  }
  function isExtractor(defId) { return extractorNodeType(defId) !== null; }

  // ===== MEKÂNSAL YERLEŞİM =====
  const CELL_M2 = 4;
  function gridSize(s) { return D.map.size; } // sabit büyük harita
  function entityFootprintCells(defId, type) {
    const def = type === 'plant' ? pDef(defId) : mDef(defId);
    return Math.max(1, Math.round(Math.sqrt(def.footprint / CELL_M2)));
  }
  function cellOccupied(s, x, y, ignoreId) {
    for (const id in s.grid.entities) {
      if (id === ignoreId) continue;
      const e = s.grid.entities[id];
      const sz = entityFootprintCells(e.defId, e.type);
      if (x >= e.x && x < e.x + sz && y >= e.y && y < e.y + sz) return true;
    }
    return false;
  }
  // Yerleştirme kuralları: harita içinde + tüm hücreler AÇIK sektörde + boş +
  // ÇIKARICI ise footprint'in bir hücresinde eşleşen kaynak nodu olmalı (katı kural).
  function canPlaceAt(s, defId, type, x, y) {
    const sz = entityFootprintCells(defId, type);
    const side = gridSize(s);
    if (x < 0 || y < 0 || x + sz > side || y + sz > side) return false;
    let coversNode = false;
    const needNode = (type === 'machine') ? extractorNodeType(defId) : null;
    for (let dx = 0; dx < sz; dx++) for (let dy = 0; dy < sz; dy++) {
      const cx = x + dx, cy = y + dy;
      if (!isCellOpen(s, cx, cy)) return false;        // kapalı bölgeye kurulamaz
      if (cellOccupied(s, cx, cy)) return false;       // dolu
      const nd = nodeAt(s, cx, cy);
      if (needNode) { if (nd && nd.type === needNode) coversNode = true; }
      else { if (nd) return false; }                    // çıkarıcı değilse nodun üstüne kurulamaz (nod boş kalsın)
    }
    if (needNode && !coversNode) return false;          // çıkarıcı ama uygun nod yok
    return true;
  }
  // Bir çıkarıcı için, üstüne kurulabilecek boş (uygun tür + boş) nod var mı?
  function hasFreeNodeFor(s, defId) {
    const type = extractorNodeType(defId);
    if (!type) return true;
    for (const key in s.map.nodes) {
      if (s.map.nodes[key].type !== type) continue;
      const [x, y] = key.split(',').map(Number);
      if (isCellOpen(s, x, y) && !cellOccupied(s, x, y)) return true;
    }
    return false;
  }
  // Yerleştir: ekonomik inşa (para+arazi+kilit) + grid'e ekle. Başarılıysa entity id döner.
  function placeMachine(s, defId, x, y) {
    if (!canPlaceAt(s, defId, 'machine', x, y)) return null;
    if (!buildMachine(s, defId)) return null; // para/arazi/kilit kontrolü + count++
    const id = 'e' + s.grid.nextId++;
    s.grid.entities[id] = { id, type: 'machine', defId, x, y };
    return id;
  }
  function placePlant(s, defId, x, y) {
    if (!canPlaceAt(s, defId, 'plant', x, y)) return null;
    if (!buildPlant(s, defId)) return null;
    const id = 'e' + s.grid.nextId++;
    s.grid.entities[id] = { id, type: 'plant', defId, x, y };
    return id;
  }
  function moveEntity(s, entityId, x, y) {
    const e = s.grid.entities[entityId];
    if (!e) return false;
    if (!canPlaceAt(s, e.defId, e.type, x, y) && !(x === e.x && y === e.y)) {
      // hedef, kendi hücresi hariç doluysa taşıma
      if (cellOccupiedExceptSelf(s, e, x, y)) return false;
    }
    e.x = x; e.y = y;
    return true;
  }
  function cellOccupiedExceptSelf(s, e, x, y) {
    const sz = entityFootprintCells(e.defId, e.type);
    const side = gridSize(s);
    if (x < 0 || y < 0 || x + sz > side || y + sz > side) return true;
    for (let dx = 0; dx < sz; dx++) for (let dy = 0; dy < sz; dy++) {
      if (cellOccupied(s, x + dx, y + dy, e.id)) return true;
    }
    return false;
  }
  // Sil: grid'den çıkar + count-- + bağlı hatları temizle + para İADESİ (yarısı)
  function removeEntity(s, entityId) {
    const e = s.grid.entities[entityId];
    if (!e) return false;
    if (e.type === 'machine') {
      s.machines[e.defId].count = Math.max(0, s.machines[e.defId].count - 1);
      if (s.machines[e.defId].count === 0) s.machines[e.defId].hasManager = false;
    } else {
      s.plants[e.defId].count = Math.max(0, s.plants[e.defId].count - 1);
    }
    delete s.grid.entities[entityId];
    s.grid.conveyors = s.grid.conveyors.filter((c) => c.from !== entityId && c.to !== entityId);
    s.grid.powerLines = s.grid.powerLines.filter((l) => l.from !== entityId && l.to !== entityId);
    return true;
  }
  // Konveyör çek: iki makine arası (görsel akış; Yol A). Aynı çift varsa eklemez.
  function addConveyor(s, fromId, toId) {
    if (fromId === toId) return false;
    const from = s.grid.entities[fromId], to = s.grid.entities[toId];
    if (!from || !to) return false;
    if (s.grid.conveyors.some((c) => c.from === fromId && c.to === toId)) return false;
    s.grid.conveyors.push({ from: fromId, to: toId });
    return true;
  }
  function addPowerLine(s, fromId, toId) {
    const from = s.grid.entities[fromId], to = s.grid.entities[toId];
    if (!from || !to) return false;
    // hat sadece santral -> makine
    if (from.type !== 'plant' || to.type !== 'machine') return false;
    if (s.grid.powerLines.some((l) => l.from === fromId && l.to === toId)) return false;
    s.grid.powerLines.push({ from: fromId, to: toId });
    return true;
  }
  function removeConveyor(s, fromId, toId) {
    s.grid.conveyors = s.grid.conveyors.filter((c) => !(c.from === fromId && c.to === toId));
  }
  function entityCenter(s, e) {
    const sz = entityFootprintCells(e.defId, e.type);
    return { cx: e.x + sz / 2, cy: e.y + sz / 2 };
  }
  // #1: Verilen hücre koordinatına (kesirli, dünya) en yakın konveyör/hattı sil.
  // maxDist = hücre biriminde tolerans. Önce konveyör, sonra hat denenir.
  function removeLineNear(s, wx, wy, maxDist) {
    const tol = maxDist || 0.4;
    let best = null, bestD = Infinity, bestKind = null;
    const check = (arr, kind) => {
      arr.forEach((l, i) => {
        const a = s.grid.entities[l.from], b = s.grid.entities[l.to];
        if (!a || !b) return;
        const ca = entityCenter(s, a), cb = entityCenter(s, b);
        const d = pointSegDist(wx, wy, ca.cx, ca.cy, cb.cx, cb.cy);
        if (d < bestD) { bestD = d; best = i; bestKind = kind; }
      });
    };
    check(s.grid.conveyors, 'conveyor');
    check(s.grid.powerLines, 'power');
    if (best === null || bestD > tol) return false;
    if (bestKind === 'conveyor') s.grid.conveyors.splice(best, 1);
    else s.grid.powerLines.splice(best, 1);
    return true;
  }
  function pointSegDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  // #5: Bileşik skor — toplam kazanç + prestige + araştırma + keşif + üretim ölçeği.
  function computeScore(s) {
    const earn = Math.sqrt(Math.max(0, s.totalEarned)) * 4;
    const nexusPts = s.nexus * 500;
    const techPts = Object.keys(s.researched).length * 250;
    const explorePts = s.sectorsOpened * 150;
    const buildPts = machineCountTotal(s) * 20 + plantCountTotal(s) * 15;
    return Math.floor(earn + nexusPts + techPts + explorePts + buildPts);
  }
  function updateTopScore(s) {
    const sc = computeScore(s);
    if (sc > (s.topScore || 0)) s.topScore = sc;
    return s.topScore;
  }
  const globalMult = (s) => 1 + s.nexus * D.prestige.nexusBonusPerPoint;

  // --- Araştırma / kilit ---
  function isMachineUnlocked(s, id) {
    const def = mDef(id);
    return def.tech === null || !!s.researched[def.tech];
  }
  function isPlantUnlocked(s, id) {
    const def = pDef(id);
    return def.tech === null || !!s.researched[def.tech];
  }

  // --- Depolama ---
  function storageCap(s, item) {
    const base = D.items[item].cap;
    return Math.floor(base * Math.pow(D.economyConfig.storageUpgradeMult, s.storageLevel[item] || 0));
  }
  function storageUpgradeCost(s, item) {
    const cap = storageCap(s, item);
    return Math.ceil(cap * D.economyConfig.storageUpgradeCostPer / 10) * 10;
  }
  function upgradeStorage(s, item) {
    const cost = storageUpgradeCost(s, item);
    if (s.coins < cost) return false;
    s.coins = N.sub(s.coins, cost);
    s.storageLevel[item] = (s.storageLevel[item] || 0) + 1;
    return true;
  }

  // --- Arazi ---
  // Harita istatistikleri (eski m² arazi yerine)
  function totalCells(s) { return Object.keys(s.map.openSectors).length * D.map.sectorSize * D.map.sectorSize; }
  function usedCells(s) {
    let n = 0;
    for (const id in s.grid.entities) { const e = s.grid.entities[id]; const sz = entityFootprintCells(e.defId, e.type); n += sz * sz; }
    return n;
  }
  function freeCells(s) { return totalCells(s) - usedCells(s); }

  // --- İnşa (makine) ---
  function buildCost(s, id) {
    const def = mDef(id);
    return Math.ceil(def.buildCost * Math.pow(def.buildGrowth, s.machines[id].count));
  }
  function canBuild(s, id) {
    const def = mDef(id);
    return isMachineUnlocked(s, id) && s.coins >= buildCost(s, id);
  }
  function buildMachine(s, id) {
    if (!canBuild(s, id)) return false;
    s.coins = N.sub(s.coins, buildCost(s, id));
    s.machines[id].count += 1;
    s.stats.machinesBuilt += 1;
    updateMilestone(s, id);
    return true;
  }
  function updateMilestone(s, id) {
    const c = s.machines[id].count;
    let mult = 1;
    for (const m of D.milestones) if (c >= m.count) mult = m.multiplier;
    s.machines[id].milestoneMult = mult;
  }
  function nextMilestone(s, id) {
    const c = s.machines[id].count;
    for (const m of D.milestones) if (c < m.count) return m;
    return null;
  }

  // --- İnşa (güç santrali) ---
  function plantBuildCost(s, id) {
    const def = pDef(id);
    return Math.ceil(def.buildCost * Math.pow(def.buildGrowth, s.plants[id].count));
  }
  function canBuildPlant(s, id) {
    const def = pDef(id);
    return isPlantUnlocked(s, id) && s.coins >= plantBuildCost(s, id);
  }
  function buildPlant(s, id) {
    if (!canBuildPlant(s, id)) return false;
    s.coins = N.sub(s.coins, plantBuildCost(s, id));
    s.plants[id].count += 1;
    s.stats.plantsBuilt += 1;
    return true;
  }

  // --- Manager ---
  function canBuyManager(s, id) {
    const def = mDef(id);
    return isMachineUnlocked(s, id) && s.machines[id].count > 0 && !s.machines[id].hasManager && s.coins >= def.managerCost;
  }
  function buyManager(s, id) {
    if (!canBuyManager(s, id)) return false;
    s.coins = N.sub(s.coins, mDef(id).managerCost);
    s.machines[id].hasManager = true;
    s.stats.managersBought += 1;
    return true;
  }

  // --- Üretim değeri ---
  function machineRate(s, id) {
    const def = mDef(id), m = s.machines[id];
    return def.baseRate * m.count * m.milestoneMult * globalMult(s);
  }

  // Oto-sat: her ürün için "elde tut" = deponun autoSellKeep[item]% kadarı; üstü satılır.
  // autoSellKeep[item] bir YÜZDE (0,25,50,75,100). 0 = hepsini sat, 100 = hiç satma.
  function runAutoSell(s) {
    for (const [item, on] of Object.entries(s.autoSell)) {
      if (!on || D.items[item].research || D.items[item].sell <= 0) continue;
      if (s.inventory[item] <= 0) continue;
      const cap = storageCap(s, item);
      const keepPct = clampPct(s.autoSellKeep[item]);
      const keepByPct = cap * keepPct / 100;
      const keep = Math.max(fuelReserve(s, item), keepByPct);
      const sellable = Math.max(0, s.inventory[item] - keep);
      if (sellable > 0) { addCoins(s, sellable * D.items[item].sell); s.inventory[item] -= sellable; }
    }
  }
  function clampPct(v) { v = Math.round((v || 0) / 25) * 25; return Math.max(0, Math.min(100, v)); }
  function setAutoSellKeep(s, item, pct) { s.autoSellKeep[item] = clampPct(pct); }

  // Manuel kısmi satış: envanterin fraction'ını (0..1) sat. Yakıt tamponu korunur.
  function sellFraction(s, item, fraction) {
    if (D.items[item].research || D.items[item].sell <= 0) return 0;
    const have = s.inventory[item] || 0;
    if (have <= 0) return 0;
    const reserve = fuelReserve(s, item);
    const avail = Math.max(0, have - reserve);
    const amt = Math.min(avail, have * Math.max(0, Math.min(1, fraction)));
    if (amt <= 0) return 0;
    const gain = amt * D.items[item].sell;
    s.inventory[item] -= amt; addCoins(s, gain);
    return gain;
  }

  // Bir parça güç santrali yakıtıysa, çalışan santrallerin ~30sn'lik ihtiyacını döndürür.
  function fuelReserve(s, item) {
    let reserve = 0;
    D.powerPlants.forEach((def) => {
      if (def.fuel && def.fuel.item === item) {
        reserve += s.plants[def.id].count * def.fuel.rate * 30;
      }
    });
    return reserve;
  }

  // --- Güç ---
  function computePower(s, dt) {
    // Arz: koloninin sabit taban gücü + santraller
    let supply = D.economyConfig.basePower || 0;
    D.powerPlants.forEach((def) => {
      const cnt = s.plants[def.id].count;
      if (cnt <= 0) return;
      if (!def.fuel) { supply += def.output * cnt; return; }
      const need = cnt * def.fuel.rate * dt;
      const have = s.inventory[def.fuel.item] || 0;
      const ratio = need > 0 ? Math.min(1, have / need) : 1;
      s.inventory[def.fuel.item] = Math.max(0, have - need * ratio);
      supply += def.output * cnt * ratio;
    });
    // Talep: otomatik makineler
    let demand = 0;
    D.machines.forEach((def) => {
      const m = s.machines[def.id];
      if (m.count > 0 && m.hasManager) demand += def.power * m.count;
    });
    const ratio = demand > 0 ? Math.min(1, supply / demand) : 1;
    s._power = { supply, demand, ratio };
    return ratio;
  }

  // --- Bir makineyi çalıştır ---
  function runMachine(s, id, seconds, powerRatio) {
    const def = mDef(id), m = s.machines[id];
    if (m.count <= 0) { m.eff = 0; return; }
    let desired = machineRate(s, id) * seconds * powerRatio;
    if (desired <= 0) { m.eff = 0; return; }

    // girdi darboğazı
    let maxCycles = desired;
    for (const [item, need] of Object.entries(def.recipe.in)) {
      maxCycles = Math.min(maxCycles, (s.inventory[item] || 0) / need);
    }
    // depo darboğazı (çıktı yeri var mı?)
    for (const [item, amt] of Object.entries(def.recipe.out)) {
      const room = storageCap(s, item) - (s.inventory[item] || 0);
      maxCycles = Math.min(maxCycles, Math.max(0, room) / amt);
    }
    const actual = Math.max(0, Math.min(desired, maxCycles));
    m.eff = desired > 0 ? actual / desired : 0;
    if (actual <= 0) return;

    for (const [item, need] of Object.entries(def.recipe.in)) {
      s.inventory[item] = Math.max(0, (s.inventory[item] || 0) - actual * need);
    }
    for (const [item, amt] of Object.entries(def.recipe.out)) {
      s.inventory[item] = Math.min(storageCap(s, item), (s.inventory[item] || 0) + actual * amt);
      s.stats.produced[item] = (s.stats.produced[item] || 0) + actual * amt;
    }
  }

  // --- Tick ---
  function tick(s, dt) {
    const before = {};
    Object.keys(D.items).forEach((k) => { before[k] = s.inventory[k] || 0; });

    const powerRatio = computePower(s, dt);
    const ordered = [...D.machines].sort((a, b) => a.tier - b.tier);
    ordered.forEach((def) => {
      const m = s.machines[def.id];
      if (m.count > 0 && m.hasManager) runMachine(s, def.id, dt, powerRatio);
      else m.eff = 0;
    });
    runAutoSell(s);
    // akış (net oran/sn)
    if (dt > 0) {
      Object.keys(D.items).forEach((k) => {
        const delta = (s.inventory[k] || 0) - before[k];
        // oto-sat sıfırladıysa akışı yanıltmasın diye üretilen sayacı da kullanabilirdik; net envanter değişimi yeterli gösterge
        s.flow[k] = delta / dt;
      });
    }
    s.stats.playTimeSec += dt;
    updateTopScore(s);
    return s;
  }

  function manualClick(s, id) {
    const def = mDef(id), m = s.machines[id];
    if (m.count <= 0) return 0;
    const out = Object.keys(def.recipe.out)[0];
    const before = s.inventory[out] || 0;
    // manuel: güç gerekmez (powerRatio=1)
    runMachine(s, id, D.economyConfig.manualBurstSeconds, 1);
    return (s.inventory[out] || 0) - before;
  }

  function addCoins(s, amount) {
    s.coins = N.add(s.coins, amount);
    s.totalEarned = N.add(s.totalEarned, amount);
    s.runEarned = N.add(s.runEarned, amount);
  }
  function sellItem(s, item) {
    if (D.items[item].research || D.items[item].sell <= 0) return 0;
    const amt = s.inventory[item] || 0;
    if (amt <= 0) return 0;
    const gain = amt * D.items[item].sell;
    s.inventory[item] = 0;
    addCoins(s, gain);
    return gain;
  }
  function toggleAutoSell(s, item) { if (!D.items[item].research) s.autoSell[item] = !s.autoSell[item]; }

  // --- Araştırma ---
  function canResearch(s, id) {
    if (s.researched[id]) return false;
    const t = D.research.find((r) => r.id === id);
    if (!t) return false;
    if (!t.prereq.every((p) => s.researched[p])) return false;
    return Object.entries(t.cost).every(([item, n]) => (s.inventory[item] || 0) >= n);
  }
  function isResearchVisible(s, id) {
    const t = D.research.find((r) => r.id === id);
    return t && t.prereq.every((p) => s.researched[p]);
  }
  function doResearch(s, id) {
    if (!canResearch(s, id)) return false;
    const t = D.research.find((r) => r.id === id);
    Object.entries(t.cost).forEach(([item, n]) => { s.inventory[item] = Math.max(0, (s.inventory[item] || 0) - n); });
    s.researched[id] = true;
    return true;
  }

  // --- Offline ---
  function applyOfflineProgress(s) {
    const now = Date.now();
    const elapsed = Math.max(0, (now - s.lastSeen) / 1000);
    const usable = Math.min(elapsed, D.economyConfig.offlineCapSeconds);
    const coinsBefore = s.totalEarned;
    if (usable > 0) {
      const eff = D.economyConfig.offlineRate;
      const powerRatio = computePower(s, usable * eff);
      const ordered = [...D.machines].sort((a, b) => a.tier - b.tier);
      ordered.forEach((def) => {
        const m = s.machines[def.id];
        if (m.count > 0 && m.hasManager) runMachine(s, def.id, usable * eff, powerRatio);
      });
      runAutoSell(s);
    }
    s.lastSeen = now;
    return { earned: s.totalEarned - coinsBefore, usableSeconds: usable, wasCapped: elapsed > D.economyConfig.offlineCapSeconds };
  }

  // --- Prestige ---
  const calcNexus = (r) => Math.floor(Math.sqrt(r / D.prestige.nexusDivisor));
  const canPrestige = (s) => s.runEarned >= D.prestige.runEarnedThreshold;
  const projectedNexus = (s) => calcNexus(s.runEarned);
  function prestige(s) {
    if (!canPrestige(s)) return 0;
    const g = calcNexus(s.runEarned);
    s.nexus += g; s.prestigeCount += 1;
    s.coins = 0; s.runEarned = 0;
    Object.keys(s.inventory).forEach((k) => { s.inventory[k] = 0; });
    Object.keys(s.storageLevel).forEach((k) => { s.storageLevel[k] = 0; });
    D.machines.forEach((def) => { s.machines[def.id] = { count: 0, hasManager: false, eff: 0, milestoneMult: 1 }; });
    D.powerPlants.forEach((def) => { s.plants[def.id] = { count: 0 }; });
    s.researched = {};
    s.sectorsOpened = 0;
    s.grid = { entities: {}, conveyors: [], powerLines: [], nextId: 1 };
    s.map = { openSectors: {}, nodes: {}, nodeNextSeed: (s.map.nodeNextSeed || 1) + 7 };
    initMap(s);
    return g;
  }

  function machineCountTotal(s) {
    let n = 0; D.machines.forEach((d) => n += s.machines[d.id].count); return n;
  }
  function plantCountTotal(s) {
    let n = 0; D.powerPlants.forEach((d) => n += s.plants[d.id].count); return n;
  }

  // #4: Bir materyalin bilgi kartı verisi — açıklama, kim üretir, kim tüketir, değer
  function itemInfo(s, item) {
    const it = D.items[item];
    const producers = D.machines.filter((m) => m.recipe.out[item]).map((m) => m.name);
    const consumers = D.machines.filter((m) => m.recipe.in[item]).map((m) => m.name);
    const fuelFor = D.powerPlants.filter((p) => p.fuel && p.fuel.item === item).map((p) => p.name);
    return {
      id: item, name: it.name, icon: it.icon, tier: it.tier,
      desc: it.desc || '', sell: it.sell, research: !!it.research,
      producers, consumers, fuelFor,
      amount: s ? (s.inventory[item] || 0) : 0,
      cap: s ? storageCap(s, item) : it.cap,
      flow: s ? (s.flow[item] || 0) : 0,
    };
  }

  global.Axyon.Economy = {
    createInitialState, mDef, pDef, globalMult,
    isMachineUnlocked, isPlantUnlocked,
    storageCap, storageUpgradeCost, upgradeStorage,
    totalCells, usedCells, freeCells,
    buildCost, canBuild, buildMachine, nextMilestone,
    plantBuildCost, canBuildPlant, buildPlant,
    canBuyManager, buyManager,
    machineRate, computePower, tick, manualClick,
    addCoins, sellItem, sellFraction, toggleAutoSell, setAutoSellKeep, runAutoSell, itemInfo,
    gridSize, entityFootprintCells, canPlaceAt, placeMachine, placePlant, moveEntity,
    removeEntity, addConveyor, addPowerLine, removeConveyor, removeLineNear, entityCenter, cellOccupiedExceptSelf,
    CELL_M2,
    // harita & keşif & nodlar
    mapSide, sectorsPerSide, cellSector, isSectorOpen, isCellOpen, openSectorList, openableSectors,
    sectorOpenCost, canOpenSector, openSector, nodeAt, nodeVisible, hasFreeNodeFor,
    isExtractor, extractorNodeType,
    // skor
    computeScore, updateTopScore,
    canResearch, isResearchVisible, doResearch,
    applyOfflineProgress, canPrestige, projectedNexus, prestige,
    machineCountTotal, plantCountTotal,
  };
})(typeof window !== 'undefined' ? window : globalThis);
