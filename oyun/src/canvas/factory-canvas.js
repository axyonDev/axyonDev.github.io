/**
 * Axyon.FactoryCanvas — Canvas 2D mekânsal fabrika motoru (Yol A).
 * Gezegen yüzeyi grid'i, pan/zoom, sürükle-bırak yerleşim, konveyör & elektrik
 * hattı çizimi, animasyonlu görsel akış. Ekonomi soyut kalır; bu katman sadece
 * yerleşimi ve akışın GÖRSELİNİ yönetir.
 */
(function (global) {
  const FactoryCanvas = {};
  let canvas, ctx, state, E, callbacks;
  let cam = { x: 0, y: 0, zoom: 1 };
  let cell = 44;                 // ekran-pikselde hücre boyutu (zoom öncesi)
  let mode = 'select';           // select | place | conveyor | power | delete
  let placeDefId = null, placeType = null;
  let dragEntity = null, dragOffset = { x: 0, y: 0 };
  let linkFrom = null;           // konveyör/hat çizerken başlangıç entity
  let hover = { gx: -1, gy: -1, entityId: null };
  let pointer = { x: 0, y: 0, down: false, moved: false, startX: 0, startY: 0 };
  let panning = false;
  let flowT = 0;                 // akış animasyon fazı
  let dpr = 1;

  function init(cv, st, econ, cbs) {
    canvas = cv; state = st; E = econ; callbacks = cbs || {};
    ctx = canvas.getContext('2d');
    resize();
    // kamerayı grid ortasına
    const side = E.gridSize(state);
    centerCamera(side);
    bindEvents();
  }
  function setState(st) { state = st; }
  function centerCamera(side) {
    const w = canvas.width / dpr, h = canvas.height / dpr;
    cam.x = (side * cell) / 2 - w / 2 / cam.zoom;
    cam.y = (side * cell) / 2 - h / 2 / cam.zoom;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ekran -> dünya (grid piksel) -> hücre
  function screenToWorld(sx, sy) {
    return { x: sx / cam.zoom + cam.x, y: sy / cam.zoom + cam.y };
  }
  function worldToCell(wx, wy) {
    return { gx: Math.floor(wx / cell), gy: Math.floor(wy / cell) };
  }
  function screenToCell(sx, sy) {
    const w = screenToWorld(sx, sy);
    return worldToCell(w.x, w.y);
  }
  function entityAtCell(gx, gy) {
    for (const id in state.grid.entities) {
      const e = state.grid.entities[id];
      const sz = E.entityFootprintCells(e.defId, e.type);
      if (gx >= e.x && gx < e.x + sz && gy >= e.y && gy < e.y + sz) return e;
    }
    return null;
  }

  // ===== Mod kontrolü (dışarıdan UI çağırır) =====
  function setMode(m, defId, type) {
    mode = m; placeDefId = defId || null; placeType = type || null; linkFrom = null;
    if (callbacks.onModeChange) callbacks.onModeChange(mode);
  }
  function getMode() { return mode; }

  // ===== Olaylar =====
  function bindEvents() {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', () => { resize(); });
  }
  function localPos(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  function onDown(ev) {
    canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
    const p = localPos(ev);
    pointer.down = true; pointer.moved = false;
    pointer.startX = p.x; pointer.startY = p.y; pointer.x = p.x; pointer.y = p.y;
    const c = screenToCell(p.x, p.y);
    const ent = entityAtCell(c.gx, c.gy);

    if (mode === 'select') {
      if (ent) { dragEntity = ent; const w = screenToWorld(p.x, p.y); dragOffset = { x: w.x / cell - ent.x, y: w.y / cell - ent.y }; }
      else { panning = true; }
    } else if (mode === 'place') {
      panning = false;
    } else if (mode === 'conveyor' || mode === 'power') {
      if (ent) linkFrom = ent; else panning = true;
    } else if (mode === 'delete') {
      panning = false;
    }
  }
  function onMove(ev) {
    const p = localPos(ev);
    const dx = p.x - pointer.x, dy = p.y - pointer.y;
    pointer.x = p.x; pointer.y = p.y;
    if (Math.abs(p.x - pointer.startX) + Math.abs(p.y - pointer.startY) > 4) pointer.moved = true;
    const c = screenToCell(p.x, p.y);
    hover.gx = c.gx; hover.gy = c.gy;
    const ent = entityAtCell(c.gx, c.gy);
    hover.entityId = ent ? ent.id : null;

    if (!pointer.down) return;
    if (panning) { cam.x -= dx / cam.zoom; cam.y -= dy / cam.zoom; }
    else if (mode === 'select' && dragEntity) { /* taşıma önizleme; bırakınca uygula */ }
  }
  function onUp(ev) {
    if (!pointer.down) return;
    const p = localPos(ev);
    const c = screenToCell(p.x, p.y);
    const ent = entityAtCell(c.gx, c.gy);

    if (mode === 'select') {
      if (dragEntity) {
        if (pointer.moved) {
          const w = screenToWorld(p.x, p.y);
          const nx = Math.round(w.x / cell - dragOffset.x), ny = Math.round(w.y / cell - dragOffset.y);
          E.moveEntity(state, dragEntity.id, nx, ny);
          if (callbacks.onChange) callbacks.onChange();
        } else if (callbacks.onSelect) {
          callbacks.onSelect(dragEntity);
        }
        dragEntity = null;
      } else if (!pointer.moved) {
        if (ent && callbacks.onSelect) callbacks.onSelect(ent);
        else if (!ent) {
          // kapalı sektöre tıklama → aç isteği
          const sc = E.cellSector(c.gx, c.gy);
          if (!E.isSectorOpen(state, sc.sx, sc.sy) && callbacks.onSectorClick) callbacks.onSectorClick(sc.sx, sc.sy);
        }
      }
    } else if (mode === 'place' && !pointer.moved) {
      const fn = placeType === 'plant' ? E.placePlant : E.placeMachine;
      const id = fn(state, placeDefId, c.gx, c.gy);
      if (id) { if (callbacks.onChange) callbacks.onChange(); if (callbacks.onPlaced) callbacks.onPlaced(placeDefId); }
      else if (callbacks.onPlaceFail) callbacks.onPlaceFail(placeDefId, placeType);
    } else if (mode === 'conveyor') {
      if (linkFrom && ent && ent.id !== linkFrom.id) {
        if (E.addConveyor(state, linkFrom.id, ent.id) && callbacks.onChange) callbacks.onChange();
      }
      linkFrom = null;
    } else if (mode === 'power') {
      if (linkFrom && ent && ent.id !== linkFrom.id) {
        const okp = E.addPowerLine(state, linkFrom.id, ent.id);
        if (callbacks.onChange) callbacks.onChange();
        if (!okp && callbacks.onPowerFail) callbacks.onPowerFail();
      }
      linkFrom = null;
    } else if (mode === 'delete') {
      if (!pointer.moved) {
        if (ent) { E.removeEntity(state, ent.id); if (callbacks.onChange) callbacks.onChange(); }
        else {
          // #1: bağlantıya (konveyör/hat) tıklandıysa sil
          const w = screenToWorld(p.x, p.y);
          if (E.removeLineNear(state, w.x / cell, w.y / cell, 0.45) && callbacks.onChange) callbacks.onChange();
        }
      }
    }
    pointer.down = false; panning = false;
  }
  function onWheel(ev) {
    ev.preventDefault();
    const p = localPos(ev);
    const before = screenToWorld(p.x, p.y);
    const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    cam.zoom = Math.max(0.35, Math.min(2.4, cam.zoom * factor));
    const after = screenToWorld(p.x, p.y);
    cam.x += before.x - after.x; cam.y += before.y - after.y;
  }
  function zoomBy(f) { cam.zoom = Math.max(0.35, Math.min(2.4, cam.zoom * f)); }
  function recenter() { centerCamera(E.gridSize(state)); }

  // ===== Çizim =====
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  let theme = {};
  function refreshTheme() {
    theme = {
      bg: css('--bg-0') || '#0f1115', grid: css('--border') || '#333944',
      surface: css('--bg-2') || '#1f232b', text: css('--text') || '#e9ebef',
      dim: css('--dim') || '#8b909b', accent: css('--accent') || '#ff8a2b',
      accent2: css('--accent-2') || '#ffd23f', success: css('--success') || '#4ade80',
      danger: css('--danger') || '#f87171', power: css('--accent-2') || '#ffd23f',
      teal: css('--teal') || '#2dd4bf', purple: css('--purple') || '#a78bfa',
    };
  }

  function draw() {
    if (!ctx) return;
    flowT = (flowT + 0.016) % 1000;
    const w = canvas.width / dpr, h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    // arka plan
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    const side = E.gridSize(state);
    drawSurface(side);
    drawSectors(side);
    drawNodes();
    drawGrid(side);
    drawPowerLines();
    drawConveyors();
    drawEntities();
    drawHover(side);
    drawLinkPreview();

    ctx.restore();
  }

  // Açık sektörler aydınlık, kapalı sektörler sisli/kilitli
  function drawSectors(side) {
    const M = window.Axyon.Data.map;
    const sps = Math.floor(M.size / M.sectorSize), ss = M.sectorSize;
    for (let sy = 0; sy < sps; sy++) for (let sx = 0; sx < sps; sx++) {
      const open = E.isSectorOpen(state, sx, sy);
      const px = sx * ss * cell, py = sy * ss * cell, pw = ss * cell;
      if (open) {
        ctx.fillStyle = theme.surface; ctx.globalAlpha = 1;
        ctx.fillRect(px, py, pw, pw);
      } else {
        // sisli kapalı bölge
        ctx.fillStyle = theme.bg; ctx.globalAlpha = 0.82;
        ctx.fillRect(px, py, pw, pw);
        ctx.globalAlpha = 1;
        // açılabilir mi? kilit ikonu
        const openable = E.openableSectors(state).some((o) => o.sx === sx && o.sy === sy);
        ctx.fillStyle = theme.dim;
        ctx.font = `${cell * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = openable ? 0.5 : 0.22;
        ctx.fillText(openable ? '🔓' : '🔒', px + pw / 2, py + pw / 2);
        ctx.globalAlpha = 1;
      }
      // sektör sınırı
      ctx.strokeStyle = open ? theme.grid : (E.openableSectors(state).some((o)=>o.sx===sx&&o.sy===sy) ? theme.accent : theme.grid);
      ctx.globalAlpha = open ? 0.4 : 0.6; ctx.lineWidth = 1.5;
      ctx.strokeRect(px, py, pw, pw); ctx.globalAlpha = 1;
    }
  }

  // Kaynak nodları (sadece açık sektörlerde görünür)
  function drawNodes() {
    const RN = window.Axyon.Data.resourceNodes;
    for (const key in state.map.nodes) {
      const [x, y] = key.split(',').map(Number);
      if (!E.isCellOpen(state, x, y)) continue;
      const nd = state.map.nodes[key], def = RN[nd.type];
      const px = x * cell, py = y * cell;
      // nod zemini (yumuşak renkli daire)
      ctx.fillStyle = def.color; ctx.globalAlpha = 0.28;
      ctx.beginPath(); ctx.arc(px + cell / 2, py + cell / 2, cell * 0.46, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5; ctx.strokeStyle = def.color;
      ctx.beginPath(); ctx.arc(px + cell / 2, py + cell / 2, cell * 0.46, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      // ikon
      ctx.font = `${cell * 0.5}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, px + cell / 2, py + cell / 2);
    }
  }

  function drawSurface(side) { /* zemin drawSectors içinde çizilir */ }
  function drawGrid(side) {
    ctx.strokeStyle = theme.grid; ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = 0; i <= side; i++) {
      ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, side * cell);
      ctx.moveTo(0, i * cell); ctx.lineTo(side * cell, i * cell);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawPowerLines() {
    state.grid.powerLines.forEach((l) => {
      const a = state.grid.entities[l.from], b = state.grid.entities[l.to];
      if (!a || !b) return;
      const ca = E.entityCenter(state, a), cb = E.entityCenter(state, b);
      ctx.strokeStyle = theme.power; ctx.lineWidth = 2; ctx.globalAlpha = 0.55;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(ca.cx * cell, ca.cy * cell); ctx.lineTo(cb.cx * cell, cb.cy * cell); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    });
  }

  function drawConveyors() {
    state.grid.conveyors.forEach((c) => {
      const a = state.grid.entities[c.from], b = state.grid.entities[c.to];
      if (!a || !b) return;
      const ca = E.entityCenter(state, a), cb = E.entityCenter(state, b);
      const x1 = ca.cx * cell, y1 = ca.cy * cell, x2 = cb.cx * cell, y2 = cb.cy * cell;
      // bant
      ctx.strokeStyle = theme.grid; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = theme.dim; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      // akan item (kaynak makine çalışıyorsa)
      const fromM = a.type === 'machine' ? state.machines[a.defId] : null;
      const active = fromM && fromM.hasManager && fromM.eff > 0.02;
      if (active) {
        const outItem = Object.keys(E.mDef(a.defId).recipe.out)[0];
        const icon = window.Axyon.Data.items[outItem].icon;
        const count = 3;
        for (let i = 0; i < count; i++) {
          const t = ((flowT * 0.5 + i / count) % 1);
          const px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
          ctx.font = `${Math.max(10, cell * 0.34)}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(icon, px, py);
        }
      }
      // yön oku
      drawArrowHead(x1, y1, x2, y2);
      ctx.lineCap = 'butt';
    });
  }
  function drawArrowHead(x1, y1, x2, y2) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const s = 7;
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.moveTo(mx + Math.cos(ang) * s, my + Math.sin(ang) * s);
    ctx.lineTo(mx + Math.cos(ang + 2.5) * s, my + Math.sin(ang + 2.5) * s);
    ctx.lineTo(mx + Math.cos(ang - 2.5) * s, my + Math.sin(ang - 2.5) * s);
    ctx.closePath(); ctx.fill();
  }

  function drawEntities() {
    for (const id in state.grid.entities) {
      const e = state.grid.entities[id];
      const def = e.type === 'plant' ? E.pDef(e.defId) : E.mDef(e.defId);
      const sz = E.entityFootprintCells(e.defId, e.type);
      const x = e.x * cell, y = e.y * cell, wsz = sz * cell;
      // gövde
      const isPlant = e.type === 'plant';
      ctx.fillStyle = theme.surface;
      roundRect(x + 3, y + 3, wsz - 6, wsz - 6, 8); ctx.fill();
      // durum kenarı
      let border = theme.grid;
      if (e.type === 'machine') {
        const m = state.machines[e.defId];
        if (m.hasManager && m.eff >= 0.95) border = theme.success;
        else if (m.hasManager && m.eff > 0) border = theme.accent2;
        else if (m.hasManager) border = theme.danger;
      } else border = theme.power;
      ctx.strokeStyle = border; ctx.lineWidth = 2.5;
      roundRect(x + 3, y + 3, wsz - 6, wsz - 6, 8); ctx.stroke();
      // ikon
      ctx.font = `${wsz * 0.42}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, x + wsz / 2, y + wsz / 2 - wsz * 0.05);
      // ad (küçük)
      if (cam.zoom > 0.7) {
        ctx.fillStyle = theme.dim;
        ctx.font = `${Math.max(7, wsz * 0.13)}px sans-serif`;
        ctx.fillText(def.name.length > 12 ? def.name.slice(0, 11) + '…' : def.name, x + wsz / 2, y + wsz - wsz * 0.14);
      }
      // manager yoksa uyarı
      if (e.type === 'machine' && !state.machines[e.defId].hasManager) {
        ctx.fillStyle = theme.dim; ctx.font = `${wsz * 0.22}px sans-serif`;
        ctx.fillText('✋', x + wsz - wsz * 0.2, y + wsz * 0.22);
      }
      // #3: üzerinde mini istatistik (yakınken): güç + üretim/sn
      if (cam.zoom > 0.85) {
        const N = window.Axyon.Numbers;
        let line = '';
        if (e.type === 'machine') {
          const m = state.machines[e.defId];
          const outItem = Object.keys(def.recipe.out)[0];
          const rate = m.hasManager ? E.machineRate(state, e.defId) * m.eff : 0;
          line = `⚡${m.hasManager ? def.power * m.count : 0} · ${N.format(rate)}/s`;
        } else {
          line = `+${def.output * state.plants[e.defId].count}kW`;
        }
        ctx.font = `${Math.max(7, wsz * 0.12)}px sans-serif`;
        const tw = ctx.measureText(line).width + 8;
        ctx.fillStyle = theme.bg; ctx.globalAlpha = 0.72;
        roundRect(x + wsz / 2 - tw / 2, y - wsz * 0.02, tw, wsz * 0.2, 4); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = theme.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(line, x + wsz / 2, y + wsz * 0.08);
      }
    }
  }

  function drawHover(side) {
    if (hover.gx < 0 || hover.gy < 0 || hover.gx >= side || hover.gy >= side) return;
    if (mode === 'place' && placeDefId) {
      const sz = E.entityFootprintCells(placeDefId, placeType);
      const okp = E.canPlaceAt(state, placeDefId, placeType, hover.gx, hover.gy);
      ctx.fillStyle = okp ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)';
      ctx.strokeStyle = okp ? theme.success : theme.danger; ctx.lineWidth = 2;
      roundRect(hover.gx * cell + 2, hover.gy * cell + 2, sz * cell - 4, sz * cell - 4, 6);
      ctx.fill(); ctx.stroke();
    } else if (mode === 'delete' && hover.entityId) {
      const e = state.grid.entities[hover.entityId];
      const sz = E.entityFootprintCells(e.defId, e.type);
      ctx.fillStyle = 'rgba(248,113,113,0.3)';
      roundRect(e.x * cell + 2, e.y * cell + 2, sz * cell - 4, sz * cell - 4, 6); ctx.fill();
    } else if ((mode === 'conveyor' || mode === 'power') && hover.entityId) {
      const e = state.grid.entities[hover.entityId];
      const sz = E.entityFootprintCells(e.defId, e.type);
      ctx.strokeStyle = mode === 'power' ? theme.power : theme.accent; ctx.lineWidth = 2;
      roundRect(e.x * cell + 2, e.y * cell + 2, sz * cell - 4, sz * cell - 4, 6); ctx.stroke();
    }
  }

  function drawLinkPreview() {
    if (!linkFrom) return;
    const ca = E.entityCenter(state, linkFrom);
    const w = screenToWorld(pointer.x, pointer.y);
    ctx.strokeStyle = mode === 'power' ? theme.power : theme.accent;
    ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(ca.cx * cell, ca.cy * cell); ctx.lineTo(w.x, w.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  FactoryCanvas.init = init;
  FactoryCanvas.setState = setState;
  FactoryCanvas.setMode = setMode;
  FactoryCanvas.getMode = getMode;
  FactoryCanvas.draw = draw;
  FactoryCanvas.resize = resize;
  FactoryCanvas.refreshTheme = refreshTheme;
  FactoryCanvas.zoomBy = zoomBy;
  FactoryCanvas.recenter = recenter;

  global.Axyon = global.Axyon || {};
  global.Axyon.FactoryCanvas = FactoryCanvas;
})(window);
