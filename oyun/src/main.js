/**
 * main.js — giriş: state, game loop, olaylar.
 */
(function () {
  const E=window.Axyon.Economy, Q=window.Axyon.Quests, S=window.Axyon.SaveService;
  const UI=window.Axyon.UI, T=window.Axyon.Toast, N=window.Axyon.Numbers, D=window.Axyon.Data;

  let state = S.load(); let isNew = false;
  if (!state) { state = E.createInitialState(); isNew = true; }
  applyTheme(state.settings.theme);

  if (!isNew) {
    const off = E.applyOfflineProgress(state);
    if (off.earned > 0) {
      UI.el('offline-text').innerHTML = `Yokken kolonin çalıştı, <strong>+${N.format(off.earned)} 🪙</strong> kazandın (${N.formatTime(off.usableSeconds)}, %${D.economyConfig.offlineRate*100} verim).` + (off.wasCapped?` Offline sınırı (${N.formatTime(D.economyConfig.offlineCapSeconds)}).`:'');
      UI.showModal('offline-modal');
    }
  }

  UI.buildMachineCards(); UI.buildPlantCards(); UI.buildInventory(); UI.buildResearch();
  UI.render(state, E);

  // ===== GRAFİK FABRİKA (canvas) =====
  const FC = window.Axyon.FactoryCanvas;
  const canvasEl = UI.el('factory-canvas');
  let selectedEntity = null;

  function fcChange() { S.save(state); UI.buildPalette(state, E); postAction(); }
  FC.refreshTheme();
  FC.init(canvasEl, state, E, {
    onChange: fcChange,
    onSelect: (ent) => { selectedEntity = ent; UI.showInspector(state, E, ent); },
    onPlaced: (defId) => { T.show(`🏗️ ${E.mDef(defId)?.name || E.pDef(defId)?.name} yerleştirildi`, 'success'); },
    onPlaceFail: (defId, type) => {
      const cost = type === 'plant' ? E.plantBuildCost(state, defId) : E.buildCost(state, defId);
      if (state.coins < cost) { T.show('💰 Yetersiz kredi', 'error'); return; }
      if (type === 'machine' && E.isExtractor(defId)) {
        const nodeType = E.extractorNodeType(defId);
        const nodeName = D.resourceNodes[nodeType]?.name || 'kaynak';
        if (!E.hasFreeNodeFor(state, defId)) T.show(`⛏️ Boş ${nodeName} yok — keşfet ve nod bul`, 'error');
        else T.show(`⛏️ Bu maden sadece ${nodeName} üzerine kurulur`, 'error');
      } else T.show('⛔ Buraya kurulamaz (kapalı bölge / dolu / nod üstü)', 'error');
    },
    onPowerFail: () => T.show('⚡ Hat sadece santralden makineye çekilir', 'error'),
    onModeChange: (m) => UI.setToolbarMode(m),
    onSectorClick: (sx, sy) => tryOpenSector(sx, sy),
  });
  UI.buildPalette(state, E);
  UI.setToolbarMode('select');

  // Bölge açma (canvas tıklaması veya HUD butonu)
  function tryOpenSector(sx, sy) {
    if (!E.canOpenSector(state)) {
      if (E.coins < E.sectorOpenCost(state)) T.show('💰 Bölge açmak için yeterli kredi yok', 'error');
      return;
    }
    const okOpen = E.openSector(state, sx, sy);
    if (okOpen) { T.show(`🧭 Yeni bölge keşfedildi! Kaynak yatakları ortaya çıktı.`, 'success'); S.save(state); UI.buildPalette(state, E); FC.recenter(); postAction(); }
    else T.show('🔒 Bu bölge açık bir bölgeye komşu değil', 'error');
  }

  // canvas render döngüsü
  function fcLoop() { if (UI.el('panel-factory').classList.contains('active')) FC.draw(); requestAnimationFrame(fcLoop); }
  requestAnimationFrame(fcLoop);

  // Araç çubuğu
  document.querySelectorAll('.fx-tool[data-mode]').forEach((b) => b.addEventListener('click', () => {
    FC.setMode(b.dataset.mode); UI.el('fx-palette').classList.add('hidden');
  }));
  UI.el('fx-build-toggle').addEventListener('click', () => {
    UI.buildPalette(state, E); UI.el('fx-palette').classList.toggle('hidden');
  });
  UI.el('fx-palette-close').addEventListener('click', () => UI.el('fx-palette').classList.add('hidden'));
  document.querySelectorAll('.fx-pt').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.fx-pt').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    UI.el('fx-palette-machines').classList.toggle('hidden', b.dataset.ptab !== 'machines');
    UI.el('fx-palette-plants').classList.toggle('hidden', b.dataset.ptab !== 'plants');
  }));
  UI.el('fx-palette').addEventListener('click', (evt) => {
    const item = evt.target.closest('[data-place]');
    if (!item) return;
    FC.setMode('place', item.dataset.place, item.dataset.ptype);
    UI.el('fx-palette').classList.add('hidden');
    T.show(`📍 Yerleştirmek için yüzeye tıkla`, 'info');
  });
  UI.el('fx-zoomin').addEventListener('click', () => FC.zoomBy(1.2));
  UI.el('fx-zoomout').addEventListener('click', () => FC.zoomBy(1/1.2));
  UI.el('fx-recenter').addEventListener('click', () => FC.recenter());

  // Inspector aksiyonları
  UI.el('fx-inspector').addEventListener('click', (evt) => {
    if (evt.target.id === 'fxi-close') { UI.el('fx-inspector').classList.add('hidden'); selectedEntity = null; return; }
    const btn = evt.target.closest('[data-fxi]'); if (!btn || !selectedEntity) return;
    const act = btn.dataset.fxi, defId = selectedEntity.defId;
    if (act === 'run') {
      const g = E.manualClick(state, defId);
      if (g > 0) T.show(`+${N.format(g)} ${D.items[Object.keys(E.mDef(defId).recipe.out)[0]].icon}`, 'success');
      else T.show('⚠️ Girdi yok veya depo dolu', 'error');
    } else if (act === 'manager') {
      if (E.buyManager(state, defId)) { T.show('⚙️ Manager alındı', 'success'); S.save(state); }
    } else if (act === 'info') {
      const out = Object.keys(E.mDef(defId).recipe.out)[0]; UI.showItemInfo(state, E, out);
    }
    UI.showInspector(state, E, selectedEntity); UI.render(state, E);
  });

  // Sekmeler
  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
    UI.switchTab(b.dataset.tab);
    if (b.dataset.tab === 'report') UI.renderReport(state, E);
  }));

  // #2: Rapor satırına tıkla → ilgili fabrikaya git
  UI.el('report-list').addEventListener('click', (evt) => {
    const row = evt.target.closest('[data-goto]');
    if (!row) return;
    const id = row.dataset.goto;
    UI.switchTab('factory');
    const card = UI.el(`card-${id}`);
    if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.add('highlight'); setTimeout(() => card.classList.remove('highlight'), 1600); }
  });

  // #4: Materyal bilgi — tık (ⓘ / ikon / isim) ve mobilde basılı tut
  UI.el('inventory-list').addEventListener('click', (evt) => {
    const info = evt.target.closest('[data-info]');
    if (info) { UI.showItemInfo(state, E, info.dataset.info); }
  });
  let pressTimer = null;
  UI.el('inventory-list').addEventListener('touchstart', (evt) => {
    const info = evt.target.closest('[data-info]');
    if (!info) return;
    pressTimer = setTimeout(() => { UI.showItemInfo(state, E, info.dataset.info); }, 450);
  }, { passive: true });
  UI.el('inventory-list').addEventListener('touchend', () => { if (pressTimer) clearTimeout(pressTimer); });
  UI.el('inventory-list').addEventListener('touchmove', () => { if (pressTimer) clearTimeout(pressTimer); });

  // Santraller (güç sekmesinden hızlı kurulum → haritada uygun boş hücreye yerleştir)
  const plantsC = UI.el('plants-container');
  if (plantsC) plantsC.addEventListener('click', (evt) => {
    const btn = evt.target.closest('button[data-action="buildplant"]');
    if (!btn || btn.classList.contains('disabled')) return;
    const id = btn.dataset.plant;
    const spot = findFreeCell(id, 'plant');
    if (!spot) { T.show('🧭 Açık bölgede boş yer yok — yeni bölge keşfet', 'error'); return; }
    if (E.placePlant(state, id, spot.x, spot.y)) { T.show(`⚡ ${E.pDef(id).name} kuruldu`, 'success'); S.save(state); UI.buildPalette(state, E); }
    else T.show('💰 Yetersiz kredi', 'error');
    postAction();
  });

  // Uygun boş hücre bulucu (otomatik yerleştirme; çıkarıcıysa nod ister)
  function findFreeCell(defId, type) {
    const side = E.gridSize(state);
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      if (E.canPlaceAt(state, defId, type, x, y)) return { x, y };
    }
    return null;
  }

  // Bölge aç (HUD butonu → ilk açılabilir komşu bölgeyi aç)
  UI.el('land-expand-btn').addEventListener('click', () => {
    const openable = E.openableSectors(state);
    if (!openable.length) { T.show('🧭 Açılacak komşu bölge kalmadı', 'info'); return; }
    tryOpenSector(openable[0].sx, openable[0].sy);
  });

  // #4: Envanter — bilgi/depo/OTO/%seçici/hızlı sat + toplu işlemler
  UI.el('inventory-list').addEventListener('click', (evt) => {
    const auto = evt.target.closest('[data-auto]');
    const stor = evt.target.closest('[data-stor]');
    const keep = evt.target.closest('[data-keep]');
    const frac = evt.target.closest('[data-sellfrac]');
    if (auto) { E.toggleAutoSell(state, auto.dataset.auto); }
    else if (stor) { const it = stor.dataset.stor; if (E.upgradeStorage(state, it)) T.show(`📦 ${D.items[it].name} deposu büyüdü`, 'success'); else T.show('Yetersiz kredi', 'error'); }
    else if (keep) { E.setAutoSellKeep(state, keep.dataset.keep, parseInt(keep.dataset.pct, 10)); if (!state.autoSell[keep.dataset.keep]) E.toggleAutoSell(state, keep.dataset.keep); }
    else if (frac) { const g = E.sellFraction(state, frac.dataset.sellfrac, parseFloat(frac.dataset.frac)); if (g > 0) T.show(`💰 +${N.format(g)} 🪙`, 'success'); else T.show('Satılacak stok yok', 'info'); }
    else return;
    S.save(state); postAction();
  });
  // checkbox değişimi → sayaç güncelle
  UI.el('inventory-list').addEventListener('change', (evt) => {
    if (evt.target.closest('[data-check]')) UI.render(state, E);
  });

  // #4: Toplu işlem çubuğu
  UI.el('bulk-selall').addEventListener('change', (evt) => {
    const on = evt.target.checked;
    Object.keys(D.items).forEach((id) => { const c = UI.el(`check-${id}`); if (c) c.checked = on && !D.items[id].research; });
    UI.render(state, E);
  });
  document.querySelectorAll('[data-bulksell]').forEach((b) => b.addEventListener('click', () => {
    const frac = parseFloat(b.dataset.bulksell);
    const sel = UI.selectedItems();
    if (!sel.length) { T.show('☑ Önce ürün seç', 'info'); return; }
    let total = 0;
    sel.forEach((id) => { total += E.sellFraction(state, id, frac); });
    if (total > 0) T.show(`💰 Toplu satış: +${N.format(total)} 🪙`, 'success'); else T.show('Satılacak stok yok', 'info');
    S.save(state); postAction();
  }));
  UI.el('bulk-oto').addEventListener('click', () => {
    const sel = UI.selectedItems();
    if (!sel.length) { T.show('☑ Önce ürün seç', 'info'); return; }
    // seçililerden herhangi biri kapalıysa hepsini aç, hepsi açıksa hepsini kapat
    const anyOff = sel.some((id) => !state.autoSell[id]);
    sel.forEach((id) => { if (state.autoSell[id] !== anyOff) E.toggleAutoSell(state, id); });
    T.show(anyOff ? '✓ Seçililer için OTO açıldı' : 'OTO kapatıldı', 'success');
    S.save(state); postAction();
  });

  // Araştırma
  UI.el('research-list').addEventListener('click', (evt) => {
    const btn = evt.target.closest('[data-research]');
    if (!btn || btn.classList.contains('disabled')) return;
    const id = btn.dataset.research;
    if (E.doResearch(state, id)) { const t=D.research.find(r=>r.id===id); T.show(`🔬 Araştırıldı: ${t.name}`, 'success'); S.save(state); UI.render(state,E); postAction(); }
  });

  // Prestige
  UI.el('prestige-btn').addEventListener('click', () => {
    if (!E.canPrestige(state)) return;
    if (!confirm('Nexus sıfırlama: kredi, envanter, tüm makineler, güç, arazi ve araştırma sıfırlanır. Kalıcı Nexus bonusu kazanırsın. Devam?')) return;
    const g = E.prestige(state); S.save(state);
    FC.setState(state); UI.buildPalette(state, E); UI.el('fx-inspector').classList.add('hidden'); FC.recenter();
    UI.render(state, E);
    UI.el('prestige-result').innerHTML = `<strong>+${g} Nexus 🌟</strong> kazandın. Kalıcı üretim çarpanı: x${E.globalMult(state).toFixed(2)}.`;
    UI.showModal('prestige-modal');
  });

  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => UI.hideModal(b.dataset.close)));
  UI.el('btn-achievements').addEventListener('click', () => { UI.renderAchievements(state); UI.showModal('ach-modal'); });
  UI.el('btn-settings').addEventListener('click', () => { UI.el('export-code').value=''; UI.showModal('settings-modal'); });
  UI.el('theme-toggle').addEventListener('click', () => { state.settings.theme = state.settings.theme==='dark'?'light':'dark'; applyTheme(state.settings.theme); S.save(state); });
  UI.el('do-export').addEventListener('click', () => { UI.el('export-code').value = S.exportString(state); UI.el('export-code').select(); T.show('📋 Kod hazır', 'info'); });
  UI.el('do-import').addEventListener('click', () => {
    if (!UI.el('import-code').value.trim()) return;
    const r = S.importString(UI.el('import-code').value);
    if (!r.ok) { T.show('❌ '+r.error, 'error'); return; }
    if (!confirm('Mevcut kaydın üzerine yazılacak. Emin misin?')) return;
    state = r.state; S.save(state); applyTheme(state.settings.theme);
    if (!state.grid) state.grid = { entities: {}, conveyors: [], powerLines: [], nextId: 1 };
    if (!state.map) state.map = { openSectors: {}, nodes: {}, nodeNextSeed: 1 };
    UI.buildMachineCards(); UI.buildPlantCards(); UI.buildInventory(); UI.buildResearch();
    FC.setState(state); UI.buildPalette(state, E); UI.el('fx-inspector').classList.add('hidden');
    UI.render(state,E);
    UI.hideModal('settings-modal'); T.show('✅ Yüklendi', 'success');
  });
  UI.el('do-reset').addEventListener('click', () => { if (confirm('TÜM ilerleme silinecek. Emin misin?')) { S.reset(); location.reload(); } });

  function postAction() {
    let c = Q.tryComplete(state);
    while (c) { T.show(`✅ Görev: ${c.desc}<br><span class="toast-reward">${c.rewardText}</span>`, 'success'); c = Q.tryComplete(state); }
    Q.checkAchievements(state).forEach(a => T.show(`🏆 ${a.desc}`, 'achievement'));
    UI.render(state, E);
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const tt = UI.el('theme-toggle'); if (tt) tt.textContent = t==='dark'?'☀️ Açık tema':'🌙 Koyu tema';
  }

  // Game loop
  let last = performance.now(), sinceCheck = 0, sinceReport = 0;
  setInterval(() => {
    const now = performance.now(), dt = (now-last)/1000; last = now;
    E.tick(state, dt); UI.render(state, E);
    sinceCheck += dt; if (sinceCheck >= 0.5) { sinceCheck = 0; postAction(); }
    sinceReport += dt;
    if (sinceReport >= 0.5) { sinceReport = 0; if (UI.el('panel-report').classList.contains('active')) UI.renderReport(state, E); }
  }, D.economyConfig.tickIntervalMs);
  setInterval(() => S.save(state), D.economyConfig.autosaveIntervalMs);
  window.addEventListener('beforeunload', () => S.save(state));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState==='hidden') S.save(state); });
  window.__axyon = { state, E, S, Q, UI };
})();
