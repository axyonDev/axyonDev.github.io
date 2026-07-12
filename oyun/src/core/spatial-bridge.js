/* ============================================================================
 * AXYON — spatial-bridge.js  (P0 → P1 entegrasyon köprüsü · GÖLGE MODU)
 * ----------------------------------------------------------------------------
 * Amaç: P0 spatial-sim çekirdeğini CANLI grid üzerinde çalıştırıp gerçek
 * per-entity telemetri üretmek — AMA canlı aggregate ekonomiyi DEĞİŞTİRMEDEN.
 *
 * Neden gölge (shadow) modu?
 *   S1 (stabil temel önce) + S9 (veri koruması) + kaydedilen karar
 *   ("flag arkasında olgunlaşana kadar aggregate canlı kalır") gereği,
 *   canlı economy.js bir turda sökülmez. Önce spatial motorun GERÇEK grid'i
 *   aynen kurup doğru per-entity veri ürettiği kanıtlanır (sıfır risk), sonra
 *   tam ekonomi geçişi (runMachine devri) ayrı ve test edilerek yapılır.
 *
 * Garantiler:
 *   - Flag kapalı → tam no-op. state hiç değişmez, telemetri üretilmez.
 *   - Flag açık   → yalnız state.grid/map OKUNUR; yalnız state._spatial
 *     (telemetri) YAZILIR. inventory / machines / grid ASLA değişmez.
 *   - Mirror dünya WeakMap'te tutulur → save'e sızmaz, kalıcılaşmaz.
 *
 * Bağlama (in-game):
 *   const defs = SpatialBridge.defsFromEconomy(Economy, Data);
 *   // ana tick sonunda:
 *   SpatialBridge.shadowTick(state, defs, dt);
 *   // durum çekmecesi:
 *   const t = SpatialBridge.report(state); // null ise flag kapalı
 * ==========================================================================*/
(function (root, factory) {
  const api = factory(
    typeof require !== 'undefined' ? require('./spatial-sim.js') : (root.Axyon && root.Axyon.SpatialSim)
  );
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { window.Axyon = window.Axyon || {}; window.Axyon.SpatialBridge = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Sim) {
  'use strict';

  // Mirror dünyaları save'den uzak tutmak için WeakMap (state anahtarlı).
  const MIRROR = new WeakMap(); // state -> {world, signature, handles}

  // --- Flag: kalıcı per-save ayar (varsayılan kapalı) ------------------------
  function isEnabled(state) { return !!(state && state.settings && state.settings.spatialSim === true); }
  function setEnabled(state, on) { state.settings = state.settings || {}; state.settings.spatialSim = !!on; if (!on) { delete state._spatial; MIRROR.delete(state); } }

  // --- defs adaptörü: Economy + Data'dan köprü sözleşmesi --------------------
  function defsFromEconomy(E, D) {
    return {
      machineDef: (id) => (D.machines || []).find(m => m.id === id) || null,
      plantDef: (id) => (D.powerPlants || []).find(p => p.id === id) || null,
      isExtractor: (id) => E.isExtractor(id),
      extractorNodeType: (id) => E.extractorNodeType(id),
      nodeAt: (state, x, y) => (E.nodeAt ? E.nodeAt(state, x, y) : (state.map && state.map.nodes ? state.map.nodes[x + ',' + y] : null)),
    };
  }

  // --- Grid imzası: topoloji değişince yeniden kurmak için -------------------
  function signature(state) {
    const g = state.grid || {};
    const ents = Object.values(g.entities || {}).map(e => `${e.id}:${e.defId}@${e.x},${e.y}`).sort().join('|');
    const conv = (g.conveyors || []).filter(c => c && c.from && c.to).map(c => `${c.from}>${c.to}`).sort().join('|');
    const pow = (g.powerLines || []).filter(l => l && l.from && l.to).map(l => `${l.from}>${l.to}`).sort().join('|');
    const nodes = Object.keys(state.map && state.map.nodes || {}).sort().join('|');
    return ents + '#' + conv + '#' + pow + '#' + nodes;
  }

  // --- Canlı grid → spatial dünya eşlemesi -----------------------------------
  function buildFromGrid(state, defs) {
    const world = Sim.createWorld({ width: 8, height: 8 });
    const handles = { entityToSpatial: {}, miners: [], furnaces: [], plants: [], belts: [] };
    const g = state.grid || {};
    const entities = g.entities || {};

    // 1) plant + machine entity'leri
    for (const e of Object.values(entities)) {
      if (e.type === 'plant') {
        const pd = defs.plantDef(e.defId);
        const sid = Sim.placePlant(world, {
          id: 'sp_' + e.id, x: e.x, y: e.y,
          fuelItem: pd && pd.fuel ? pd.fuel.item : null,
          fuelRate: pd && pd.fuel ? pd.fuel.rate : 0,
          output: pd ? (pd.power || pd.output || 0) : 0,
          fuel: pd && pd.fuel ? Number(getInv(state, pd.fuel.item)) || 0 : 1,
        });
        handles.entityToSpatial[e.id] = { kind: 'plant', sid };
        handles.plants.push(e.id);
      } else if (e.type === 'machine') {
        if (defs.isExtractor(e.defId)) {
          const nodeType = defs.extractorNodeType(e.defId);
          const node = defs.nodeAt(state, e.x, e.y);
          const nid = Sim.addOreNode(world, {
            id: 'sn_' + e.id, x: e.x, y: e.y, item: nodeType,
            remaining: node && Number.isFinite(node.remaining) ? node.remaining : Number.MAX_SAFE_INTEGER,
            richness: node && node.richness ? node.richness : 1,
          });
          const sid = Sim.placeMiner(world, { id: 'sm_' + e.id, x: e.x, y: e.y, nodeId: nid });
          handles.entityToSpatial[e.id] = { kind: 'miner', sid, item: nodeType };
          handles.miners.push(e.id);
        } else {
          const md = defs.machineDef(e.defId);
          if (!md || !md.recipe) continue;
          const sid = Sim.placeFurnace(world, { id: 'sf_' + e.id, x: e.x, y: e.y, recipe: md.recipe });
          handles.entityToSpatial[e.id] = { kind: 'furnace', sid };
          handles.furnaces.push(e.id);
        }
      }
    }

    // 2) konveyörler → bant + iki inserter (kaynak.out → bant → hedef.in)
    for (const c of (g.conveyors || [])) {
      if (!c || !c.from || !c.to) continue;               // freehand konveyör atlanır (topolojik değil)
      const from = handles.entityToSpatial[c.from], to = handles.entityToSpatial[c.to];
      if (!from || !to) continue;
      if (from.kind === 'plant' || to.kind === 'plant') continue;
      const item = from.kind === 'miner' ? from.item : firstOut(defs, entities[c.from]);
      const beltId = Sim.placeBelt(world, { id: 'sb_' + c.from + '_' + c.to });
      Sim.placeInserter(world, { from: from.sid, fromKind: from.kind, to: beltId, toKind: 'belt', item });
      Sim.placeInserter(world, { from: beltId, fromKind: 'belt', to: to.sid, toKind: to.kind, item });
      handles.belts.push({ from: c.from, to: c.to, beltId });
    }

    // 3) fırın çıkışı → ambar (fiziksel bir çıkış tanımlanmadıysa varsayılan tahliye)
    for (const eid of handles.furnaces) {
      const h = handles.entityToSpatial[eid];
      const hasDownstream = handles.belts.some(b => b.from === eid);
      if (!hasDownstream) Sim.placeInserter(world, { from: h.sid, fromKind: 'furnace', to: 'WH', toKind: 'warehouse' });
    }

    // 4) güç hatları
    for (const l of (g.powerLines || [])) {
      if (!l || !l.from || !l.to) continue;
      const a = handles.entityToSpatial[l.from], b = handles.entityToSpatial[l.to];
      if (!a || !b) continue;
      Sim.connectPower(world, a.sid, b.sid);
    }

    return { world, handles, signature: signature(state) };
  }

  function firstOut(defs, entity) { if (!entity) return null; const md = defs.machineDef(entity.defId); return md && md.recipe ? Object.keys(md.recipe.out)[0] : null; }
  function getInv(state, item) { return (state.inventory && state.inventory[item]) || 0; }

  // --- Gölge tik: telemetri üretir, canlı ekonomiyi değiştirmez --------------
  function shadowTick(state, defs, dt) {
    if (!isEnabled(state)) { if (state._spatial) delete state._spatial; return null; }
    dt = dt == null ? 1 : dt;
    let mirror = MIRROR.get(state);
    const sig = signature(state);
    if (!mirror || mirror.signature !== sig) {
      mirror = buildFromGrid(state, defs);
      MIRROR.set(state, mirror);
    }
    Sim.step(mirror.world, dt);
    state._spatial = buildTelemetry(state, mirror);
    return state._spatial;
  }

  function buildTelemetry(state, mirror) {
    const w = mirror.world, h = mirror.handles, machines = [], belts = [];
    for (const eid of h.miners) {
      const m = w.miners[h.entityToSpatial[eid].sid];
      machines.push({ entityId: eid, kind: 'miner', x: m.x, y: m.y, powered: m.powered, eff: m.eff, extracted: m.extractedThisTick, outBuf: Object.assign({}, m.outBuf) });
    }
    for (const eid of h.furnaces) {
      const f = w.furnaces[h.entityToSpatial[eid].sid];
      machines.push({ entityId: eid, kind: 'furnace', x: f.x, y: f.y, powered: f.powered, eff: f.eff, produced: f.producedThisTick, blocked: f.blocked, inBuf: Object.assign({}, f.inBuf), outBuf: Object.assign({}, f.outBuf) });
    }
    for (const b of h.belts) {
      const belt = w.belts[b.beltId]; if (!belt) continue;
      const fill = belt.slots.filter(s => s !== null).length;
      belts.push({ from: b.from, to: b.to, fill, capacity: belt.capacity, saturated: belt.saturated });
    }
    return { tick: w.tick, machines, belts, warehouse: Object.assign({}, w.warehouse), shadow: true };
  }

  function report(state) { return (isEnabled(state) && state._spatial) ? state._spatial : null; }

  return { isEnabled, setEnabled, defsFromEconomy, buildFromGrid, shadowTick, report, signature, _MIRROR: MIRROR };
});
