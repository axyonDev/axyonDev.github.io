/**
 * Axyon.UI — DOM render. Ekonomi hesabı yapmaz.
 * Makine kartları, güç paneli, arazi paneli, araştırma ağacı, envanter dinamik üretilir.
 */
(function (global) {
  const N = global.Axyon.Numbers, D = global.Axyon.Data;
  const el = (id) => document.getElementById(id);

  function recipeHtml(def) {
    const ins = Object.entries(def.recipe.in).map(([k,v]) =>
      `<span class="chip in" data-item="${k}">${D.items[k].icon}${v>1?'×'+v:''}<span class="flowmark" id="fm-${def.id}-${k}"></span></span>`).join('');
    const outs = Object.entries(def.recipe.out).map(([k,v]) =>
      `<span class="chip out">${D.items[k].icon}${v>1?'×'+v:''}</span>`).join('');
    return `${ins}${ins?'<span class="arw">→</span>':''}${outs}`;
  }

  function buildMachineCards() {
    const c = el('machines-container'); if (!c) return; c.innerHTML = '';
    D.machines.forEach((def) => {
      const card = document.createElement('div');
      card.className = 'mcard'; card.id = `card-${def.id}`;
      card.innerHTML = `
        <div class="mc-head">
          <div class="mc-icon">${def.icon}</div>
          <div class="mc-title"><div class="mc-name">${def.name}</div>
            <div class="mc-recipe">${recipeHtml(def)}</div></div>
          <div class="mc-count"><span id="cnt-${def.id}">0</span><small>adet</small></div>
        </div>
        <div class="mc-effrow"><div class="eff-bar"><div class="eff-fill" id="eff-${def.id}"></div></div>
          <span class="eff-label" id="efftxt-${def.id}"></span></div>
        <div class="mc-info">
          <span title="arazi">🗺️ <span id="land-${def.id}">0</span>m²</span>
          <span title="güç">⚡ <span id="pw-${def.id}">0</span>kW</span>
          <span id="ms-${def.id}" class="mc-ms"></span>
        </div>
        <div class="mc-actions">
          <button class="btn-primary" data-action="click" data-machine="${def.id}">Çalıştır</button>
          <div class="btn-row">
            <button class="btn-sub" data-action="build" data-machine="${def.id}"><span>İnşa</span><span class="cost" id="bcost-${def.id}">0</span></button>
            <button class="btn-sub" data-action="manager" data-machine="${def.id}" id="mgr-${def.id}">Manager</button>
          </div>
        </div>
        <div class="lock-overlay"><div class="lock-icon">🔒</div><div class="lock-text" id="locktext-${def.id}">Araştırma gerekli</div></div>`;
      c.appendChild(card);
    });
  }

  function buildPlantCards() {
    const c = el('plants-container'); if (!c) return; c.innerHTML = '';
    D.powerPlants.forEach((def) => {
      const card = document.createElement('div');
      card.className = 'pcard'; card.id = `pcard-${def.id}`;
      const fuel = def.fuel ? `${D.items[def.fuel.item].icon} yakıt` : 'yakıtsız';
      card.innerHTML = `
        <div class="pc-head"><span class="pc-icon">${def.icon}</span>
          <div><div class="pc-name">${def.name}</div><div class="pc-sub">+${def.output}kW · ${fuel} · ${def.footprint}m²</div></div>
          <div class="pc-count"><span id="pcnt-${def.id}">0</span></div></div>
        <button class="btn-sub full" data-action="buildplant" data-plant="${def.id}"><span>Kur</span><span class="cost" id="pcost-${def.id}">0</span></button>
        <div class="lock-overlay"><div class="lock-icon">🔒</div></div>`;
      c.appendChild(card);
    });
  }

  function buildInventory() {
    const inv = el('inventory-list'); inv.innerHTML = '';
    Object.entries(D.items).forEach(([id, item]) => {
      const row = document.createElement('div');
      row.className = 'inv-row'; row.id = `inv-${id}`;
      const sellPart = item.research ? `<span class="inv-research">araştırma</span>`
        : `<button class="inv-btn" data-sell="${id}">Sat</button>
           <button class="inv-auto" data-auto="${id}" id="auto-${id}">OTO</button>
           <input class="inv-keep" data-keep="${id}" id="keep-${id}" type="number" min="0" placeholder="eşik" title="Oto-sat eşiği: bu kadarı elde tutulur, üstü satılır" />`;
      row.innerHTML = `
        <span class="inv-icon" data-info="${id}">${item.icon}</span>
        <span class="inv-name" data-info="${id}">${item.name}</span>
        <span class="inv-flow" id="invflow-${id}"></span>
        <span class="inv-amt"><span id="invamt-${id}">0</span><small id="invcap-${id}">/0</small></span>
        <button class="inv-info" data-info="${id}" title="Bilgi">ⓘ</button>
        <button class="inv-up" data-stor="${id}" id="stor-${id}" title="Depoyu yükselt">⤢</button>
        ${sellPart}`;
      inv.appendChild(row);
    });
  }

  // #4: Materyal bilgi kartını doldur ve göster
  function showItemInfo(state, E, item) {
    const info = E.itemInfo(state, item);
    const body = el('iteminfo-body');
    const tierNames = ['Hammadde','Eritme','Bileşen','Gelişmiş','İleri'];
    const rows = [];
    rows.push(`<div class="ii-desc">${info.desc}</div>`);
    rows.push(`<div class="ii-grid">
      <div><span>Tier</span><b>${tierNames[info.tier] || info.tier}</b></div>
      <div><span>Stok</span><b>${N.format(info.amount)} / ${N.format(info.cap)}</b></div>
      <div><span>Değer</span><b>${info.research ? 'satılmaz' : N.format(info.sell)+' 🪙'}</b></div>
      <div><span>Akış</span><b>${info.flow>0.05?'▲ artıyor':info.flow<-0.05?'▼ azalıyor':'■ sabit'}</b></div>
    </div>`);
    if (info.producers.length) rows.push(`<div class="ii-line"><span>🏭 Üreten:</span> ${info.producers.join(', ')}</div>`);
    if (info.consumers.length) rows.push(`<div class="ii-line"><span>⬇️ Tüketen:</span> ${info.consumers.join(', ')}</div>`);
    if (info.fuelFor.length) rows.push(`<div class="ii-line ii-fuel"><span>⚡ Yakıt:</span> ${info.fuelFor.join(', ')}</div>`);
    if (!info.producers.length) rows.push(`<div class="ii-line ii-dim">Bu bir hammadde/çıkarılan kaynaktır.</div>`);
    body.innerHTML = rows.join('');
    el('iteminfo-title').innerHTML = `${info.icon} ${info.name}`;
    el('iteminfo-modal').classList.remove('hidden');
  }

  function buildResearch() {
    const c = el('research-list'); c.innerHTML = '';
    D.research.forEach((t) => {
      const node = document.createElement('div');
      node.className = 'res-node'; node.id = `res-${t.id}`;
      const cost = Object.entries(t.cost).map(([it,n]) => `${n} ${D.items[it].icon}`).join(' ');
      node.innerHTML = `
        <div class="res-head"><span class="res-icon">${t.icon}</span><span class="res-name">${t.name}</span>
          <span class="res-cost">${cost}</span></div>
        <div class="res-desc">${t.desc}</div>
        <button class="btn-sub res-btn" data-research="${t.id}">Araştır</button>`;
      c.appendChild(node);
    });
  }

  function flowArrow(v) {
    if (v > 0.05) return '<span class="up">▲</span>';
    if (v < -0.05) return '<span class="down">▼</span>';
    return '<span class="flat">■</span>';
  }

  function render(state, E) {
    el('coin-display').textContent = N.format(state.coins);
    el('total-earned').textContent = N.format(state.totalEarned);
    el('nexus-display').textContent = N.format(state.nexus);
    el('multiplier-display').textContent = `x${E.globalMult(state).toFixed(2)}`;

    // Güç & arazi üst panel
    const p = state._power;
    el('power-supply').textContent = N.format(p.supply);
    el('power-demand').textContent = N.format(p.demand);
    const pOk = p.demand === 0 || p.supply >= p.demand;
    el('power-status').textContent = pOk ? 'yeterli' : `%${Math.round(p.ratio*100)} (yetersiz!)`;
    el('power-status').className = 'stat-status ' + (pOk ? 'ok' : 'bad');
    el('power-bar').style.width = `${Math.min(100, p.demand>0 ? p.ratio*100 : 100)}%`;
    el('power-bar').classList.toggle('bad', !pOk);

    const used = E.usedLand(state), total = E.totalLand(state);
    el('land-used').textContent = used; el('land-total').textContent = total;
    el('land-bar').style.width = `${Math.min(100, (used/total)*100)}%`;
    el('land-expand-cost').textContent = N.format(E.landExpandCost(state));
    el('land-expand-btn').classList.toggle('disabled', !E.canExpandLand(state));

    // Makineler (eski panel kartları — grafik arayüzde yok; varsa güncelle)
    D.machines.forEach((def) => {
      const card = el(`card-${def.id}`);
      if (!card) return;
      const m = state.machines[def.id];
      const unlocked = E.isMachineUnlocked(state, def.id);
      card.classList.toggle('locked', !unlocked);
      if (!unlocked) {
        const t = D.research.find(r => r.id === def.tech);
        el(`locktext-${def.id}`).textContent = t ? `${t.icon} ${t.name} gerekli` : 'Kilitli';
        return;
      }
      el(`cnt-${def.id}`).textContent = m.count;
      el(`land-${def.id}`).textContent = m.count * def.footprint;
      el(`pw-${def.id}`).textContent = m.hasManager ? m.count * def.power : 0;

      const eff = (m.count>0 && m.hasManager) ? m.eff : 0;
      const ef = el(`eff-${def.id}`);
      ef.style.width = `${Math.round(eff*100)}%`;
      ef.classList.toggle('starved', m.count>0 && m.hasManager && eff < 0.95);
      const et = el(`efftxt-${def.id}`);
      if (m.count===0) et.textContent = 'inşa et';
      else if (!m.hasManager) et.textContent = 'manuel';
      else if (eff>=0.95) et.textContent = 'tam hız';
      else if (eff>0) et.textContent = 'kısıtlı';
      else et.textContent = 'durdu';

      // girdi akış işaretleri
      Object.keys(def.recipe.in).forEach((it) => {
        const fm = el(`fm-${def.id}-${it}`);
        if (fm) fm.innerHTML = flowArrow(state.flow[it] || 0);
      });

      const bc = el(`bcost-${def.id}`);
      bc.textContent = N.format(E.buildCost(state, def.id));
      const buildBtn = card.querySelector('[data-action="build"]');
      const canB = E.canBuild(state, def.id);
      buildBtn.classList.toggle('disabled', !canB);
      buildBtn.classList.toggle('noland', E.freeLand(state) < def.footprint && state.coins >= E.buildCost(state, def.id));

      const mgr = el(`mgr-${def.id}`);
      if (m.hasManager) { mgr.textContent = '✓ Oto'; mgr.classList.add('owned'); mgr.classList.remove('disabled'); }
      else { mgr.textContent = `Mgr ${N.format(def.managerCost)}`; mgr.classList.toggle('disabled', !E.canBuyManager(state, def.id)); mgr.classList.remove('owned'); }

      const nm = E.nextMilestone(state, def.id);
      el(`ms-${def.id}`).textContent = nm ? `🎯 ${nm.count} adet → x${nm.multiplier}` : (m.count>0?'🎯 MAX':'');
    });

    // Santraller
    D.powerPlants.forEach((def) => {
      const pc = el(`pcard-${def.id}`);
      if (!pc) return;
      const unlocked = E.isPlantUnlocked(state, def.id);
      pc.classList.toggle('locked', !unlocked);
      if (!unlocked) return;
      el(`pcnt-${def.id}`).textContent = state.plants[def.id].count;
      el(`pcost-${def.id}`).textContent = N.format(E.plantBuildCost(state, def.id));
      pc.querySelector('[data-action="buildplant"]').classList.toggle('disabled', !E.canBuildPlant(state, def.id));
    });

    // Envanter
    Object.keys(D.items).forEach((id) => {
      const amt = state.inventory[id] || 0, cap = E.storageCap(state, id);
      el(`invamt-${id}`).textContent = N.format(amt);
      el(`invcap-${id}`).textContent = '/' + N.format(cap);
      el(`invflow-${id}`).innerHTML = flowArrow(state.flow[id] || 0);
      const row = el(`inv-${id}`);
      row.classList.toggle('full', amt >= cap - 0.01 && cap > 0);
      const storBtn = el(`stor-${id}`);
      if (storBtn) storBtn.title = `Depoyu yükselt (${N.format(E.storageUpgradeCost(state, id))} 🪙)`;
      const auto = el(`auto-${id}`);
      if (auto) auto.classList.toggle('on', !!state.autoSell[id]);
      const keepInput = el(`keep-${id}`);
      if (keepInput) {
        keepInput.classList.toggle('active', !!state.autoSell[id]);
        // kullanıcı yazarken üzerine yazma; sadece odakta değilse senkronla
        if (document.activeElement !== keepInput) {
          const kv = state.autoSellKeep[id] || 0;
          keepInput.value = kv > 0 ? kv : '';
        }
      }
    });

    // Araştırma
    D.research.forEach((t) => {
      const node = el(`res-${t.id}`);
      const done = !!state.researched[t.id];
      const visible = E.isResearchVisible(state, t.id);
      node.classList.toggle('done', done);
      node.classList.toggle('hidden-res', !visible && !done);
      const btn = node.querySelector('.res-btn');
      if (done) { btn.textContent = '✓ Tamamlandı'; btn.classList.add('owned'); btn.classList.add('disabled'); }
      else { btn.textContent = 'Araştır'; btn.classList.toggle('disabled', !E.canResearch(state, t.id)); }
    });

    // Prestige
    const canP = E.canPrestige(state), gain = E.projectedNexus(state);
    const pb = el('prestige-btn');
    pb.classList.toggle('disabled', !canP);
    pb.querySelector('span').textContent = canP ? `Nexus Sıfırla  +${gain} 🌟` : 'Nexus Sıfırla';
    el('prestige-bar').style.width = `${Math.min(100,(state.runEarned/D.prestige.runEarnedThreshold)*100)}%`;
    el('prestige-progress').textContent = canP ? `Hazır! +${gain} Nexus`
      : `${N.format(state.runEarned)} / ${N.format(D.prestige.runEarnedThreshold)} 🪙`;

    renderQuest(state);
  }

  function renderQuest(state) {
    const Q = global.Axyon.Quests, p = Q.questProgress(state);
    if (!p) { el('quest-desc').textContent = 'Tüm görevler tamam 🎉'; el('quest-bar').style.width='100%'; el('quest-progress-text').textContent=''; return; }
    el('quest-desc').textContent = p.quest.desc;
    el('quest-bar').style.width = `${Math.min(100,(p.current/p.target)*100)}%`;
    el('quest-progress-text').textContent = `${N.format(Math.min(p.current,p.target))} / ${N.format(p.target)}`;
  }

  function pulse(id) { const b = el(`eff-${id}`); if(b){b.classList.add('pulse'); setTimeout(()=>b.classList.remove('pulse'),150);} }
  function spawnFloat(text,x,y){ const l=el('float-layer'); const n=document.createElement('div'); n.className='float-text'; n.textContent=text; n.style.left=x+'px'; n.style.top=y+'px'; l.appendChild(n); setTimeout(()=>n.remove(),900); }
  const showModal = (id) => el(id).classList.remove('hidden');
  const hideModal = (id) => el(id).classList.add('hidden');

  function renderAchievements(state) {
    const g = el('ach-grid'); g.innerHTML = '';
    D.achievements.forEach((a) => {
      const done = !!state.achievements[a.id];
      const d = document.createElement('div');
      d.className = `ach-item ${done?'done':''}`;
      d.innerHTML = `<span class="ach-icon">${done?'🏆':'🔒'}</span><span>${a.desc}</span>`;
      g.appendChild(d);
    });
  }

  // #2: Fabrika rapor / istatistik paneli — çalışan tüm hatlar, üretim ve durum
  function renderReport(state, E) {
    const list = el('report-list'); if (!list) return;
    const built = D.machines.filter((def) => state.machines[def.id].count > 0);
    if (!built.length) {
      list.innerHTML = '<div class="report-empty">Henüz makine inşa etmedin. Fabrika sekmesinden başla.</div>';
      updateReportSummary(state, E);
      return;
    }
    built.sort((a, b) => a.tier - b.tier);
    list.innerHTML = built.map((def) => {
      const m = state.machines[def.id];
      const rate = E.machineRate(state, def.id);
      const eff = (m.count > 0 && m.hasManager) ? m.eff : 0;
      let statusCls, statusTxt;
      if (!m.hasManager) { statusCls = 'manual'; statusTxt = 'Manuel'; }
      else if (eff >= 0.95) { statusCls = 'ok'; statusTxt = 'Tam hız'; }
      else if (eff > 0) { statusCls = 'warn'; statusTxt = 'Kısıtlı %' + Math.round(eff*100); }
      else { statusCls = 'bad'; statusTxt = 'Durdu'; }
      const out = Object.keys(def.recipe.out)[0];
      const outVal = m.hasManager ? (rate * eff) : 0;
      return `
        <div class="report-row" data-goto="${def.id}">
          <span class="rr-icon">${def.icon}</span>
          <div class="rr-main">
            <div class="rr-name">${def.name} <span class="rr-count">×${m.count}</span></div>
            <div class="rr-sub">${D.items[out].icon} ${N.format(outVal)}/sn · ${m.count*def.footprint}m² · ${m.hasManager?m.count*def.power:0}kW</div>
          </div>
          <div class="rr-eff"><div class="rr-effbar"><div class="rr-efffill ${eff<0.95?'starved':''}" style="width:${Math.round(eff*100)}%"></div></div></div>
          <span class="rr-status ${statusCls}">${statusTxt}</span>
          <span class="rr-arrow">›</span>
        </div>`;
    }).join('');
    updateReportSummary(state, E);
  }
  function updateReportSummary(state, E) {
    const s = el('report-summary'); if (!s) return;
    const built = D.machines.filter((d) => state.machines[d.id].count > 0);
    const auto = built.filter((d) => state.machines[d.id].hasManager);
    const starved = auto.filter((d) => state.machines[d.id].eff < 0.95);
    const stopped = auto.filter((d) => state.machines[d.id].eff <= 0.001);
    s.innerHTML = `
      <div class="rs-box"><span>Hat türü</span><b>${built.length}</b></div>
      <div class="rs-box"><span>Toplam makine</span><b>${E.machineCountTotal(state)}</b></div>
      <div class="rs-box"><span>Otomatik</span><b>${auto.length}</b></div>
      <div class="rs-box ${stopped.length?'bad':''}"><span>Sorunlu hat</span><b>${starved.length}</b></div>`;
  }

  // ===== GRAFİK ARAYÜZ (canvas) yardımcıları =====
  function buildPalette(state, E) {
    const mList = el('fx-palette-machines'), pList = el('fx-palette-plants');
    mList.innerHTML = ''; pList.innerHTML = '';
    D.machines.forEach((def) => {
      if (!E.isMachineUnlocked(state, def.id)) return;
      const item = document.createElement('button');
      item.className = 'fx-palette-item'; item.dataset.place = def.id; item.dataset.ptype = 'machine';
      item.innerHTML = `<span class="pi-icon">${def.icon}</span>
        <span class="pi-body"><span class="pi-name">${def.name}</span>
        <span class="pi-cost">${N.format(E.buildCost(state, def.id))} 🪙 · ${def.footprint}m² · ${def.power}kW</span></span>`;
      mList.appendChild(item);
    });
    D.powerPlants.forEach((def) => {
      if (!E.isPlantUnlocked(state, def.id)) return;
      const fuel = def.fuel ? D.items[def.fuel.item].icon : '☀️';
      const item = document.createElement('button');
      item.className = 'fx-palette-item'; item.dataset.place = def.id; item.dataset.ptype = 'plant';
      item.innerHTML = `<span class="pi-icon">${def.icon}</span>
        <span class="pi-body"><span class="pi-name">${def.name}</span>
        <span class="pi-cost">${N.format(E.plantBuildCost(state, def.id))} 🪙 · +${def.output}kW · ${fuel}</span></span>`;
      pList.appendChild(item);
    });
    if (!mList.children.length) mList.innerHTML = '<div class="fx-palette-empty">Makine yok — araştırma yap.</div>';
    if (!pList.children.length) pList.innerHTML = '<div class="fx-palette-empty">Santral yok — araştırma yap.</div>';
  }

  function showInspector(state, E, entity) {
    const box = el('fx-inspector');
    if (!entity) { box.classList.add('hidden'); return; }
    const def = entity.type === 'plant' ? E.pDef(entity.defId) : E.mDef(entity.defId);
    if (entity.type === 'machine') {
      const m = state.machines[entity.defId];
      const eff = m.hasManager ? Math.round(m.eff * 100) : 0;
      const recipe = Object.entries(def.recipe.in).map(([k,v])=>`${D.items[k].icon}${v>1?'×'+v:''}`).join(' ') || '—';
      const out = Object.entries(def.recipe.out).map(([k,v])=>`${D.items[k].icon}${v>1?'×'+v:''}`).join(' ');
      box.innerHTML = `
        <div class="fxi-head"><span class="fxi-icon">${def.icon}</span>
          <div><div class="fxi-name">${def.name}</div>
          <div class="fxi-sub">${recipe} → ${out}</div></div>
          <button class="x" id="fxi-close">✕</button></div>
        <div class="fxi-stats">
          <span>Durum: <b class="${m.hasManager?(eff>=95?'ok':'warn'):'dim'}">${!m.hasManager?'Manuel':eff>=95?'Tam hız':'Kısıtlı %'+eff}</b></span>
        </div>
        <div class="fxi-actions">
          <button class="fxi-btn" data-fxi="run">▶ Çalıştır</button>
          ${m.hasManager ? '<button class="fxi-btn owned" disabled>✓ Manager</button>'
            : `<button class="fxi-btn" data-fxi="manager" ${E.canBuyManager(state,entity.defId)?'':'disabled'}>⚙️ Manager ${N.format(def.managerCost)}</button>`}
          <button class="fxi-btn" data-fxi="info">ⓘ Bilgi</button>
        </div>`;
    } else {
      const fuel = def.fuel ? `${D.items[def.fuel.item].icon} ${D.items[def.fuel.item].name}` : 'yakıtsız';
      box.innerHTML = `
        <div class="fxi-head"><span class="fxi-icon">${def.icon}</span>
          <div><div class="fxi-name">${def.name}</div>
          <div class="fxi-sub">+${def.output}kW · ${fuel}</div></div>
          <button class="x" id="fxi-close">✕</button></div>
        <div class="fxi-stats"><span>Bu santralden makinelere ⚡ Hat çekerek güç dağıt.</span></div>`;
    }
    box.dataset.entity = entity.id;
    box.classList.remove('hidden');
  }

  function setToolbarMode(mode) {
    document.querySelectorAll('.fx-tool[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    const hints = { select:'Yapıya tıkla: seç · sürükle: taşı · boşluk sürükle: kaydır',
      place:'Yerleştirmek için yüzeye tıkla · yeşil = uygun', conveyor:'Kaynak makineye tıkla, sonra hedefe: konveyör',
      power:'Santrale tıkla, sonra makineye: elektrik hattı', delete:'Silmek için yapıya tıkla (yarı iade)' };
    const h = el('fx-hint'); if (h) h.textContent = hints[mode] || '';
  }

  function switchTab(tab) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    el(`panel-${tab}`).classList.add('active');
    el(`tab-${tab}`).classList.add('active');
  }

  global.Axyon = global.Axyon || {};
  global.Axyon.UI = {
    el, buildMachineCards, buildPlantCards, buildInventory, buildResearch,
    render, pulse, spawnFloat, showModal, hideModal, renderAchievements, switchTab,
    showItemInfo, renderReport,
    buildPalette, showInspector, setToolbarMode,
  };
})(window);
