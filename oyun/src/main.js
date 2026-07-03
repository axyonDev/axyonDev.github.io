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

  // #1: Oto-sat eşik girişi
  UI.el('inventory-list').addEventListener('change', (evt) => {
    const keep = evt.target.closest('[data-keep]');
    if (!keep) return;
    E.setAutoSellKeep(state, keep.dataset.keep, parseFloat(keep.value) || 0);
    S.save(state);
  });

  // Makineler
  UI.el('machines-container').addEventListener('click', (evt) => {
    const btn = evt.target.closest('button[data-action]');
    if (!btn || btn.classList.contains('disabled')) return;
    const a = btn.dataset.action, id = btn.dataset.machine;
    if (a === 'click') {
      const g = E.manualClick(state, id);
      if (g > 0) { const out=Object.keys(E.mDef(id).recipe.out)[0]; const r=btn.getBoundingClientRect();
        UI.spawnFloat(`+${N.format(g)} ${D.items[out].icon}`, r.left+r.width/2+(Math.random()*30-15), r.top); UI.pulse(id); }
      else if (state.machines[id].count === 0) T.show('⚠️ Önce bu makineyi inşa et', 'error');
      else T.show('⚠️ Girdi yok veya depo dolu', 'error');
    } else if (a === 'build') {
      if (E.buildMachine(state, id)) { S.save(state); }
      else if (E.freeLand(state) < E.mDef(id).footprint) T.show('🗺️ Yetersiz arazi — Arazi sekmesinden genişlet', 'error');
    } else if (a === 'manager') {
      if (E.buyManager(state, id)) { T.show('⚙️ Manager alındı — otomatik üretim', 'success'); S.save(state); }
    }
    postAction();
  });

  // Santraller
  UI.el('plants-container').addEventListener('click', (evt) => {
    const btn = evt.target.closest('button[data-action="buildplant"]');
    if (!btn || btn.classList.contains('disabled')) return;
    const id = btn.dataset.plant;
    if (E.buildPlant(state, id)) { T.show(`⚡ ${E.pDef(id).name} kuruldu`, 'success'); S.save(state); }
    else if (E.freeLand(state) < E.pDef(id).footprint) T.show('🗺️ Yetersiz arazi', 'error');
    postAction();
  });

  // Arazi genişlet
  UI.el('land-expand-btn').addEventListener('click', () => {
    if (E.expandLand(state)) { T.show(`🗺️ Arazi +${D.land.expandAmount}m²`, 'success'); S.save(state); postAction(); }
  });

  // Envanter: sat / oto / depo yükselt
  UI.el('inventory-list').addEventListener('click', (evt) => {
    const sell = evt.target.closest('[data-sell]'), auto = evt.target.closest('[data-auto]'), stor = evt.target.closest('[data-stor]');
    if (sell) { const g = E.sellItem(state, sell.dataset.sell); if (g>0) T.show(`💰 +${N.format(g)} 🪙`, 'success'); }
    else if (auto) { E.toggleAutoSell(state, auto.dataset.auto); }
    else if (stor) { const it=stor.dataset.stor; if (E.upgradeStorage(state, it)) T.show(`📦 ${D.items[it].name} deposu büyüdü`, 'success'); else T.show('Yetersiz kredi', 'error'); }
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
    UI.buildMachineCards(); UI.buildPlantCards(); UI.buildInventory(); UI.buildResearch(); UI.render(state,E);
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
