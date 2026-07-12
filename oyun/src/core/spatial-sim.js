/* ============================================================================
 * AXYON — spatial-sim.js  (P0 dikey dilim / vertical slice)
 * ----------------------------------------------------------------------------
 * GERÇEK uzaysal Factorio çekirdeği. economy.js'e DOKUNMAZ; onun yanında,
 * ayrı ve deterministik bir modül olarak çalışır. Amaç: tek bir 8x8 kanıt
 * bölgesinde aşağıdaki zinciri gerçek fizikle kanıtlamak —
 *
 *   Tükenen maden yatağı → madenci outBuf → gerçek bant (transport line)
 *   → inserter → güç bağlantılı fırın → outBuf/backpressure → ambar
 *
 * Aggregate modelden farkı: burada KONUM ve BAĞLANTI üretimi belirler.
 * Bant kesilirse fırın durur. Çıkış dolarsa tıkanır. Yatak biterse madenci
 * durur. Güç yoksa üretim sıfırdır.
 *
 * Tasarım (birleşik yol haritası §7):
 *   - Per-entity buffer: her makinenin fiziksel in/out tamponu (kısıtlı).
 *   - Bant = transport line: item'lar segment üzerinde POZİSYON tutar, ayrı
 *     entity değildir (performans). Görsel animasyon simülasyondan ayrıktır.
 *   - Inserter = transfer kuralı (kaynak.outBuf ↔ bant ↔ hedef.inBuf).
 *   - Güç = graf-bağlantı: makine bir bileşende yakıtlı santrale bağlı değilse
 *     powered=false → üretim 0.
 *   - Tükenme: her yatağın remaining'i azalır; 0'da madenci boşta kalır.
 * ==========================================================================*/
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.Axyon = window.Axyon || {};
    window.Axyon.SpatialSim = api;
  }
})(this, function () {
  'use strict';

  // Varsayılan kapasiteler (dengelenebilir; testler bunlara bağlı değil, sadece
  // "dolunca tıkanır / boşalınca durur" davranışına bağlı).
  const DEFAULTS = {
    minerOutCap: 4,
    furnaceInCap: 4,
    furnaceOutCap: 4,
    beltCapacity: 6,
    inserterRate: 1,     // tik başına taşınan birim
    minerRate: 1,        // tik başına çıkarılan cevher
    furnaceRate: 1,      // tik başına üretilen levha (girdi 1:1)
  };

  let _seq = 1;
  const nid = (p) => `${p}_${_seq++}`;

  // ---- Dünya kurulumu -------------------------------------------------------
  function createWorld(opts) {
    opts = opts || {};
    return {
      w: opts.width || 8,
      h: opts.height || 8,
      tick: 0,
      nodes: {},         // yatak: id -> {id,x,y,item,remaining,richness}
      miners: {},        // id -> {id,x,y,nodeId,outBuf,outCap,powered,eff,extractedThisTick}
      belts: {},         // id -> {id,dir,capacity,slots:[itemId|null...],saturated}
      inserters: {},     // id -> {id,from,to,fromKind,toKind,rate,item?,movedThisTick}
      furnaces: {},      // id -> {id,x,y,recipe,inBuf,inCap,outBuf,outCap,powered,eff,producedThisTick,blocked}
      plants: {},        // id -> {id,x,y,fuelItem,fuelRate,output,fuel}
      powerLines: [],    // {from,to}  (plant<->machine)
      warehouse: {},     // itemId -> amount (merkezi ambar; market/araştırma buradan çeker)
      cfg: Object.assign({}, DEFAULTS, opts.cfg || {}),
      _power: null,
    };
  }

  // ---- Yerleştirme yardımcıları --------------------------------------------
  function addOreNode(w, o) {
    const id = o.id || nid('node');
    w.nodes[id] = { id, x: o.x, y: o.y, item: o.item, remaining: o.remaining, richness: o.richness || 1 };
    return id;
  }
  function placeMiner(w, o) {
    const id = o.id || nid('miner');
    w.miners[id] = { id, x: o.x, y: o.y, nodeId: o.nodeId, outBuf: {}, outCap: w.cfg.minerOutCap, powered: false, eff: 0, extractedThisTick: 0 };
    return id;
  }
  function placeBelt(w, o) {
    const id = o.id || nid('belt');
    const cap = o.capacity || w.cfg.beltCapacity;
    w.belts[id] = { id, dir: o.dir || 'E', capacity: cap, slots: new Array(cap).fill(null), saturated: false };
    return id;
  }
  function placeInserter(w, o) {
    // from/to: entity id; fromKind/toKind: 'miner'|'belt'|'furnace'|'warehouse'
    const id = o.id || nid('ins');
    w.inserters[id] = { id, from: o.from, to: o.to, fromKind: o.fromKind, toKind: o.toKind, rate: o.rate || w.cfg.inserterRate, item: o.item || null, movedThisTick: 0 };
    return id;
  }
  function placeFurnace(w, o) {
    const id = o.id || nid('furnace');
    w.furnaces[id] = {
      id, x: o.x, y: o.y,
      recipe: o.recipe, // {in:{ironOre:1}, out:{ironPlate:1}}
      inBuf: {}, inCap: w.cfg.furnaceInCap,
      outBuf: {}, outCap: w.cfg.furnaceOutCap,
      powered: false, eff: 0, producedThisTick: 0, blocked: false,
    };
    return id;
  }
  function placePlant(w, o) {
    const id = o.id || nid('plant');
    w.plants[id] = { id, x: o.x, y: o.y, fuelItem: o.fuelItem, fuelRate: o.fuelRate || 0.75, output: o.output || 120, fuel: o.fuel || 0 };
    return id;
  }
  function connectPower(w, from, to) { w.powerLines.push({ from, to }); }
  function removeBelt(w, id) { delete w.belts[id]; }
  function removeInserter(w, id) { delete w.inserters[id]; }
  function removePowerTo(w, entityId) { w.powerLines = w.powerLines.filter(l => l.from !== entityId && l.to !== entityId); }

  // ---- Buffer yardımcıları --------------------------------------------------
  function bufTotal(buf) { let t = 0; for (const k in buf) t += buf[k]; return t; }
  function bufHas(buf, item, n) { return (buf[item] || 0) >= n; }
  function bufRoom(buf, cap) { return cap - bufTotal(buf); }
  function bufAdd(buf, item, n) { buf[item] = (buf[item] || 0) + n; }
  function bufTake(buf, item, n) { const have = buf[item] || 0; const take = Math.min(have, n); buf[item] = have - take; if (buf[item] <= 0) delete buf[item]; return take; }

  // ---- Güç grafiği (gerçek bağlı-bileşen) ----------------------------------
  // Bir makine (miner/furnace), yakıtı olan bir santralle aynı bileşende değilse
  // powered=false. Bileşen arzı >= talebi ise ratio=1, değilse oranlı.
  function computePower(w, dt) {
    dt = dt == null ? 1 : dt;
    const nodes = new Map(); // entityId -> {kind, ref}
    for (const id in w.plants) nodes.set(id, { kind: 'plant', ref: w.plants[id] });
    for (const id in w.miners) nodes.set(id, { kind: 'machine', ref: w.miners[id], demand: 10 });
    for (const id in w.furnaces) nodes.set(id, { kind: 'machine', ref: w.furnaces[id], demand: 25 });

    const adj = new Map(); for (const id of nodes.keys()) adj.set(id, new Set());
    for (const l of w.powerLines) {
      if (!nodes.has(l.from) || !nodes.has(l.to)) continue;
      const a = nodes.get(l.from), b = nodes.get(l.to);
      // yalnız plant<->machine kenarı
      if ((a.kind === 'plant' && b.kind === 'machine') || (a.kind === 'machine' && b.kind === 'plant')) {
        adj.get(l.from).add(l.to); adj.get(l.to).add(l.from);
      }
    }
    // varsayılan: her makine güçsüz
    for (const id in w.miners) w.miners[id].powered = false;
    for (const id in w.furnaces) w.furnaces[id].powered = false;

    const seen = new Set();
    for (const id of [...adj.keys()].sort()) {
      if (seen.has(id) || !adj.get(id).size) continue;
      const q = [id], comp = []; seen.add(id);
      while (q.length) { const x = q.shift(); comp.push(x); for (const n of adj.get(x)) if (!seen.has(n)) { seen.add(n); q.push(n); } }
      const plants = comp.filter(i => nodes.get(i).kind === 'plant').map(i => w.plants[i]);
      const machines = comp.filter(i => nodes.get(i).kind === 'machine');
      if (!plants.length || !machines.length) continue;

      // arz: yakıtı olan santraller (yakıt bileşen içinde gerçekten tüketilir)
      let supply = 0;
      for (const p of plants) {
        const need = (p.fuelRate || 0) * Math.max(0, dt);
        const have = Math.max(0, p.fuel || 0);
        const ratio = need > 0 ? Math.min(1, have / need) : (have > 0 ? 1 : 0);
        const use = need * ratio; p.fuel = Math.max(0, have - use);
        supply += (p.output || 0) * ratio;
      }
      let demand = 0; for (const i of machines) demand += (nodes.get(i).demand || 0);
      const ratio = demand > 0 ? Math.min(1, supply / demand) : (supply > 0 ? 1 : 0);
      for (const i of machines) {
        const ref = nodes.get(i).ref; ref.powered = ratio > 0; ref.powerRatio = ratio;
      }
    }
    w._power = { requiresLines: true };
    return w;
  }

  // ---- Tek tik simülasyonu --------------------------------------------------
  // Sıra (deterministik): güç → fırın üret → inserter'lar (out→ambar, bant→in,
  // miner→bant) → bant ilerlet → maden çıkar. Backpressure ve durma bu sıradan
  // birkaç tik içinde doğal olarak oluşur.
  function step(w, dt) {
    dt = dt == null ? 1 : dt;
    w.tick++;
    computePower(w, dt);

    // sayaç sıfırla
    for (const id in w.miners) w.miners[id].extractedThisTick = 0;
    for (const id in w.furnaces) { w.furnaces[id].producedThisTick = 0; w.furnaces[id].blocked = false; }

    // 1) Fırın üretimi: powered && inBuf>=girdi && outBuf'ta yer varsa
    for (const id in w.furnaces) {
      const f = w.furnaces[id];
      if (!f.powered) { f.eff = 0; continue; }
      const rate = w.cfg.furnaceRate;
      let can = rate;
      for (const [k, v] of Object.entries(f.recipe.in)) can = Math.min(can, Math.floor((f.inBuf[k] || 0) / v));
      const room = bufRoom(f.outBuf, f.outCap);
      let outNeed = 0; for (const v of Object.values(f.recipe.out)) outNeed += v;
      if (outNeed > 0) can = Math.min(can, Math.floor(room / outNeed));
      if (can <= 0) {
        f.eff = 0;
        // girdi var ama çıkış doluysa: TIKANMA (backpressure)
        if (room <= 0) f.blocked = true;
        continue;
      }
      for (const [k, v] of Object.entries(f.recipe.in)) bufTake(f.inBuf, k, can * v);
      for (const [k, v] of Object.entries(f.recipe.out)) { bufAdd(f.outBuf, k, can * v); f.producedThisTick += can * v; }
      f.eff = can / rate;
    }

    // 2) Inserter'lar (out→hedef). Kaynak/hedef türüne göre.
    for (const id in w.inserters) {
      const ins = w.inserters[id]; ins.movedThisTick = 0;
      const src = resolveEndpoint(w, ins.from, ins.fromKind);
      const dst = resolveEndpoint(w, ins.to, ins.toKind);
      if (!src || !dst) continue; // bant/kaynak silinmişse taşıma olmaz
      for (let n = 0; n < ins.rate; n++) {
        const item = peekItem(src, ins.item);
        if (!item) break;
        if (!canAccept(dst, item)) break;   // hedef dolu → backpressure
        takeItem(src, item, 1);
        putItem(dst, item, 1);
        ins.movedThisTick++;
      }
    }

    // 3) Bant ilerlet (transport line): item'lar çıkış ucuna doğru 1 slot kayar
    for (const id in w.belts) advanceBelt(w.belts[id]);

    // 4) Maden çıkarma: powered && yatak remaining>0 && outBuf'ta yer varsa
    for (const id in w.miners) {
      const m = w.miners[id];
      if (!m.powered) { m.eff = 0; continue; }
      const node = w.nodes[m.nodeId];
      if (!node || node.remaining <= 0) { m.eff = 0; continue; } // yatak tükendi → dur
      const room = bufRoom(m.outBuf, m.outCap);
      const can = Math.min(w.cfg.minerRate * (node.richness || 1), node.remaining, room);
      if (can <= 0) { m.eff = 0; continue; }
      node.remaining -= can;
      bufAdd(m.outBuf, node.item, can);
      m.extractedThisTick = can;
      m.eff = 1;
    }
    return w;
  }

  // ---- Endpoint çözümleme (inserter kaynağı/hedefi) -------------------------
  function resolveEndpoint(w, id, kind) {
    if (kind === 'miner') return w.miners[id] ? { kind, ref: w.miners[id] } : null;
    if (kind === 'furnace') return w.furnaces[id] ? { kind, ref: w.furnaces[id] } : null;
    if (kind === 'belt') return w.belts[id] ? { kind, ref: w.belts[id] } : null;
    if (kind === 'warehouse') return { kind, ref: w.warehouse };
    return null;
  }
  function peekItem(ep, filter) {
    if (ep.kind === 'miner') { for (const k in ep.ref.outBuf) if (ep.ref.outBuf[k] > 0 && (!filter || k === filter)) return k; return null; }
    if (ep.kind === 'furnace') { for (const k in ep.ref.outBuf) if (ep.ref.outBuf[k] > 0 && (!filter || k === filter)) return k; return null; }
    if (ep.kind === 'belt') { const s = ep.ref.slots; const head = s[s.length - 1]; return head && (!filter || head === filter) ? head : null; }
    return null;
  }
  function takeItem(ep, item, n) {
    if (ep.kind === 'miner' || ep.kind === 'furnace') return bufTake(ep.ref.outBuf, item, n);
    if (ep.kind === 'belt') { const s = ep.ref.slots; if (s[s.length - 1] === item) { s[s.length - 1] = null; return 1; } return 0; }
    return 0;
  }
  function canAccept(ep, item) {
    if (ep.kind === 'furnace') return bufRoom(ep.ref.inBuf, ep.ref.inCap) > 0;
    if (ep.kind === 'belt') { const s = ep.ref.slots; return s[0] === null; } // giriş ucu boşsa
    if (ep.kind === 'warehouse') return true; // ambar sınırsız (slice)
    if (ep.kind === 'miner') return bufRoom(ep.ref.outBuf, ep.ref.outCap) > 0;
    return false;
  }
  function putItem(ep, item, n) {
    if (ep.kind === 'furnace') { bufAdd(ep.ref.inBuf, item, n); return; }
    if (ep.kind === 'belt') { ep.ref.slots[0] = item; return; } // giriş ucuna koy
    if (ep.kind === 'warehouse') { ep.ref[item] = (ep.ref[item] || 0) + n; return; }
  }

  // ---- Bant ilerletme (backpressure'lı transport line) ----------------------
  // index 0 = giriş ucu (tail), index len-1 = çıkış ucu (head).
  // Item'lar düşük index'ten yüksek index'e (çıkışa) doğru 1 slot ilerler.
  // Çıkış ucu boşalmazsa arkadaki item'lar birikir → doygunluk (saturated).
  function advanceBelt(belt) {
    const s = belt.slots, len = s.length;
    for (let i = len - 1; i >= 1; i--) {
      if (s[i] === null && s[i - 1] !== null) { s[i] = s[i - 1]; s[i - 1] = null; }
    }
    // doygunluk: çıkış ucu dolu ve giriş ucu da doluysa hat tıkalı
    belt.saturated = s[len - 1] !== null && s[0] !== null;
  }

  // ---- Eski v16 (aggregate) kaydı → ambara güvenli aktarım ------------------
  // Uzaysal motor temiz başlar; eski aggregate inventory merkezi ambara taşınır.
  // Yerleşik makineler/bantlar burada default buffer ile yeniden kurulabilir.
  // Amaç: 0 crash. (Migrasyon v16→v17 sözleşmesinin çekirdeği.)
  function loadLegacyIntoWarehouse(legacy, opts) {
    const w = createWorld(opts || {});
    if (legacy && typeof legacy === 'object') {
      const inv = legacy.inventory || legacy.s?.inventory || {};
      for (const k in inv) {
        const n = Number(inv[k]);
        if (Number.isFinite(n) && n > 0) w.warehouse[k] = n; // NaN/negatif/bozuk atlanır
      }
    }
    return w;
  }

  // ---- 8x8 kanıt bölgesi (canonical dikey dilim) ---------------------------
  function buildProofRegion(w) {
    w = w || createWorld({ width: 8, height: 8 });
    const nodeId = addOreNode(w, { x: 1, y: 1, item: 'ironOre', remaining: 1000 });
    const minerId = placeMiner(w, { x: 1, y: 1, nodeId });
    const beltId = placeBelt(w, { x: 2, y: 1, dir: 'E' });
    const furnaceId = placeFurnace(w, { x: 5, y: 1, recipe: { in: { ironOre: 1 }, out: { ironPlate: 1 } } });
    const plantId = placePlant(w, { x: 1, y: 4, fuelItem: 'coal', fuelRate: 0.75, output: 120, fuel: 1000 });
    // zincir: miner.out → [insA] → belt → [insB] → furnace.in ; furnace.out → [insC] → ambar
    const insA = placeInserter(w, { from: minerId, fromKind: 'miner', to: beltId, toKind: 'belt', item: 'ironOre' });
    const insB = placeInserter(w, { from: beltId, fromKind: 'belt', to: furnaceId, toKind: 'furnace', item: 'ironOre' });
    const insC = placeInserter(w, { from: furnaceId, fromKind: 'furnace', to: 'WH', toKind: 'warehouse', item: 'ironPlate' });
    // güç: santral → miner ve santral → fırın
    connectPower(w, plantId, minerId);
    connectPower(w, plantId, furnaceId);
    return { w, nodeId, minerId, beltId, furnaceId, plantId, insA, insB, insC };
  }

  return {
    createWorld, addOreNode, placeMiner, placeBelt, placeInserter, placeFurnace, placePlant,
    connectPower, removeBelt, removeInserter, removePowerTo,
    computePower, step, advanceBelt, loadLegacyIntoWarehouse, buildProofRegion,
    _bufTotal: bufTotal,
  };
});
