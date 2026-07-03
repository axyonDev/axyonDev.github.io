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

    return {
      version: 6,
      coins: 120, totalEarned: 0, runEarned: 0,
      nexus: 0, prestigeCount: 0,
      inventory, autoSell, autoSellKeep, storageLevel,
      machines, plants,
      researched: {},
      landExpansions: 0,
      questIndex: 0, achievements: {},
      stats: { machinesBuilt: 0, plantsBuilt: 0, managersBought: 0, playTimeSec: 0, produced },
      flow,
      settings: { theme: 'dark' },
      // güç anlık değerleri (UI için, tick'te güncellenir)
      _power: { supply: 0, demand: 0, ratio: 1 },
      lastSeen: Date.now(),
    };
  }

  const mDef = (id) => D.machines.find((m) => m.id === id);
  const pDef = (id) => D.powerPlants.find((p) => p.id === id);
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
  function totalLand(s) { return D.land.baseArea + s.landExpansions * D.land.expandAmount; }
  function usedLand(s) {
    let used = 0;
    D.machines.forEach((def) => { used += s.machines[def.id].count * def.footprint; });
    D.powerPlants.forEach((def) => { used += s.plants[def.id].count * def.footprint; });
    return used;
  }
  function freeLand(s) { return totalLand(s) - usedLand(s); }
  function landExpandCost(s) { return Math.ceil(D.land.expandBaseCost * Math.pow(D.land.expandGrowth, s.landExpansions)); }
  function canExpandLand(s) { return s.coins >= landExpandCost(s); }
  function expandLand(s) {
    if (!canExpandLand(s)) return false;
    s.coins = N.sub(s.coins, landExpandCost(s));
    s.landExpansions += 1;
    return true;
  }

  // --- İnşa (makine) ---
  function buildCost(s, id) {
    const def = mDef(id);
    return Math.ceil(def.buildCost * Math.pow(def.buildGrowth, s.machines[id].count));
  }
  function canBuild(s, id) {
    const def = mDef(id);
    return isMachineUnlocked(s, id) && s.coins >= buildCost(s, id) && freeLand(s) >= def.footprint;
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
    return isPlantUnlocked(s, id) && s.coins >= plantBuildCost(s, id) && freeLand(s) >= def.footprint;
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

  // Oto-sat: kullanıcı eşiğinin (autoSellKeep) ve güç yakıtı tamponunun üstündeki fazlayı satar.
  function runAutoSell(s) {
    for (const [item, on] of Object.entries(s.autoSell)) {
      if (on && !D.items[item].research && s.inventory[item] > 0 && D.items[item].sell > 0) {
        const keep = Math.max(fuelReserve(s, item), s.autoSellKeep[item] || 0);
        const sellable = Math.max(0, s.inventory[item] - keep);
        if (sellable > 0) {
          addCoins(s, sellable * D.items[item].sell);
          s.inventory[item] -= sellable;
        }
      }
    }
  }
  function setAutoSellKeep(s, item, value) {
    s.autoSellKeep[item] = Math.max(0, Math.floor(value) || 0);
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
    s.landExpansions = 0;
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
    totalLand, usedLand, freeLand, landExpandCost, canExpandLand, expandLand,
    buildCost, canBuild, buildMachine, nextMilestone,
    plantBuildCost, canBuildPlant, buildPlant,
    canBuyManager, buyManager,
    machineRate, computePower, tick, manualClick,
    addCoins, sellItem, toggleAutoSell, setAutoSellKeep, runAutoSell, itemInfo,
    canResearch, isResearchVisible, doResearch,
    applyOfflineProgress, canPrestige, projectedNexus, prestige,
    machineCountTotal, plantCountTotal,
  };
})(typeof window !== 'undefined' ? window : globalThis);
