/** Axyon.UI v4 — ekran üretimi ve salt görünüm yardımcıları. */
(function(global){
  const D=global.Axyon.Data,N=global.Axyon.Numbers;
  const el=id=>document.getElementById(id);
  const fmtCost=obj=>Object.entries(obj||{}).map(([k,v])=>`${D.items[k]?.icon||''}${N.format(v)}`).join(' ');
  const roman=n=>['0','I','II','III','IV','V'][n]||n;
  const escapeHtml=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function buildMachineCards(){}
  function buildPlantCards(state,E){
    const root=el('plants-container');if(!root)return;
    root.innerHTML=D.powerPlants.map(d=>{
      const p=state.plants[d.id],lv=E.plantLevel(state,d.id),locked=!E.isPlantUnlocked(state,d.id),cost=E.plantBuildCost(state,d.id),up=lv<5?E.upgradeCost(d,lv,'plant'):null;
      return `<article class="plant-card ${locked?'locked':''}" id="plant-${d.id}"><div class="card-top"><span class="card-icon">${d.icon}</span><div><h3>${d.name} <small>Mk ${roman(lv)}</small></h3><p>${d.fuel?`${D.items[d.fuel.item].icon} yakıtlı`:'yakıtsız'} · +${N.format(E.plantOutput(state,d.id))} kW</p></div><b>×${p.count}</b></div>${locked?`<div class="locked-note">🔒 ${d.tech}</div>`:`<div class="card-actions"><button data-buildplant="${d.id}" class="btn-setting" ${E.canBuildPlant(state,d.id)?'':'disabled'}>Kur · ${N.format(cost)}🪙</button><button data-upgradeplant="${d.id}" class="btn-setting" ${E.canUpgradeClass(state,d.id,'plant')?'':'disabled'}>${lv>=5?'Mk V tamam':`Mk ${roman(lv+1)} · ${N.format(up.coins)}🪙 ${fmtCost(up.items)}`}</button></div>`}</article>`;
    }).join('');
  }

  function buildInventory(state,E){
    const root=el('inventory-list');if(!root)return;
    root.innerHTML=Object.entries(D.items).map(([id,it])=>{
      const sellable=!it.research&&it.sell>0,cap=E.storageCap(state,id),pct=state.autoSellKeep[id]||0;
      return `<div class="inv-row ${it.research?'research-item':''}" id="inv-${id}">
        <label class="inv-check"><input type="checkbox" id="check-${id}" data-check="${id}" ${sellable?'':'disabled'}></label>
        <button class="inv-info" data-info="${id}"><span class="inv-icon">${it.icon}</span><span><b>${it.name}</b><small>${it.research?'Araştırma verisi':`${it.sell}🪙 liste fiyatı`}</small></span></button>
        <div class="inv-amount"><b id="amt-${id}">0</b><small>/<span id="cap-${id}">${N.format(cap)}</span> <span id="flow-${id}"></span></small></div>
        ${sellable?`<button class="auto-toggle ${state.autoSell[id]?'on':''}" data-auto="${id}">${state.autoSell[id]?'UYDU ✓':'UYDU'}</button><div class="keep-set">${[0,25,50,75,100].map(v=>`<button data-keep="${id}" data-pct="${v}" class="${pct===v?'active':''}">${v}</button>`).join('')}</div><button class="quick-sell" data-sellfrac="${id}" data-frac=".5">%50 sat</button>`:'<span class="no-sell">Satılmaz</span>'}
        <button class="storage-up" data-stor="${id}">⤢</button>
      </div>`;
    }).join('');
  }

  function buildResearch(state,E){
    const root=el('research-list');if(root)root.innerHTML=D.research.map(t=>`<article class="res-card" id="res-${t.id}"><div class="res-icon">${t.icon}</div><div class="res-body"><h3>${t.name}</h3><p>${t.desc}</p><div class="res-cost">${fmtCost(t.cost)}</div></div><button class="res-btn" data-research="${t.id}">Araştır</button></article>`).join('');
    const rr=el('repeat-research-list');if(rr)rr.innerHTML=D.repeatableResearch.map(t=>`<article class="res-card repeat" id="repeat-${t.id}"><div class="res-icon">${t.icon}</div><div class="res-body"><h3>${t.name} <small>Sv. <span id="repeat-level-${t.id}">0</span></small></h3><p>${t.desc}</p><div class="res-cost" id="repeat-cost-${t.id}"></div></div><button class="res-btn" data-repeat="${t.id}">Geliştir</button></article>`).join('');
  }

  function selectedItems(){return [...document.querySelectorAll('[data-check]:checked')].map(x=>x.dataset.check);}

  function render(state,E){
    el('coin-display').textContent=N.format(state.coins);el('total-earned').textContent=N.format(state.totalEarned);el('multiplier-display').textContent='x'+E.globalMult(state).toFixed(2);el('threat-display').textContent=(state.galaxy.threat||0).toFixed(1);el('fleet-display').textContent=N.format(D.ships.reduce((n,d)=>n+(state.galaxy.ships[d.id]||0),0));
    const score=E.computeScore(state);el('score-display').textContent=N.format(score);el('topscore-display').textContent=N.format(state.topScore||score);
    const p=state._power||{supply:0,demand:0,ratio:1};el('power-supply').textContent=N.format(p.supply);el('power-demand').textContent=N.format(p.demand);el('power-bar').style.width=`${Math.min(100,p.demand?100*p.supply/p.demand:100)}%`;const ps=el('power-status');ps.textContent=p.ratio>=.99?'yeterli':p.ratio>0?'kısıtlı':'çöktü';ps.className='stat-status '+(p.ratio>=.99?'ok':p.ratio>.25?'warn':'bad');
    const opened=E.openSectorList(state).length,total=E.sectorsPerSide()**2;el('land-used').textContent=opened;el('land-total').textContent=total;el('land-bar').style.width=`${opened/total*100}%`;el('land-expand-cost').textContent=N.format(E.sectorOpenCost(state));el('land-expand-btn').disabled=!E.canOpenSector(state);
    Object.keys(D.items).forEach(id=>{const a=el(`amt-${id}`);if(!a)return;a.textContent=N.format(state.inventory[id]||0);el(`cap-${id}`).textContent=N.format(E.storageCap(state,id));const f=state.flow[id]||0,fe=el(`flow-${id}`);fe.textContent=Math.abs(f)<.01?'':`${f>0?'▲':'▼'}${N.format(Math.abs(f))}/sn`;fe.className=f>=0?'flow-up':'flow-down';const row=el(`inv-${id}`);row?.querySelector('[data-auto]')?.classList.toggle('on',!!state.autoSell[id]);if(row?.querySelector('[data-auto]'))row.querySelector('[data-auto]').textContent=state.autoSell[id]?'UYDU ✓':'UYDU';row?.querySelectorAll('[data-keep]').forEach(b=>b.classList.toggle('active',Number(b.dataset.pct)===(state.autoSellKeep[id]||0)));});
    const sel=selectedItems();el('bulk-count').textContent=`${sel.length} seçili`;
    renderMarket(state,E);renderResearchState(state,E);renderQuest(state);
    if(el('panel-power')?.classList.contains('active'))buildPlantCards(state,E);
    if(el('panel-report')?.classList.contains('active'))renderReport(state,E);
    if(el('panel-galaxy')?.classList.contains('active'))renderGalaxy(state,E);
  }

  function renderMarket(state,E){
    el('market-level').textContent=`Mk ${roman(state.market.level||1)}`;el('market-capacity').textContent=N.format(E.marketCapacity(state));el('market-cooldown').textContent=N.formatTime(E.marketCooldownSec(state));el('market-last').textContent=N.format(state.market.lastRevenue||0);
    const master=el('market-master'),unlocked=!!state.researched.marketSatellite;master.disabled=!unlocked;master.textContent=!unlocked?'🔒 ARAŞTIR':state.market.enabled?'AUTO AÇIK':'AUTO KAPALI';master.classList.toggle('active',unlocked&&state.market.enabled);
    const next=state.market.nextDispatchAt?Math.max(0,(state.market.nextDispatchAt-Date.now())/1000):0;el('market-next').textContent=!unlocked?'Kilitli':state.market.enabled?N.formatTime(next):'Durduruldu';document.querySelectorAll('[data-globalkeep]').forEach(b=>b.classList.toggle('active',Number(b.dataset.globalkeep)===(state.market.keepPct||0)));
    const up=el('market-upgrade');up.disabled=!E.canUpgradeMarket(state);if(state.market.level>=D.market.maxLevel)up.textContent='Uydu Mk V tamam';else{const c=E.marketUpgradeCost(state);up.textContent=`Uydu Mk ${roman(state.market.level+1)} · ${N.format(c.coins)}🪙 ${fmtCost(c.items)}`;}
  }

  function renderResearchState(state,E){
    D.research.forEach(t=>{const node=el(`res-${t.id}`);if(!node)return;const done=!!state.researched[t.id],visible=E.isResearchVisible(state,t.id);node.classList.toggle('done',done);node.classList.toggle('hidden-res',!visible&&!done);const b=node.querySelector('[data-research]');b.textContent=done?'✓ Tamamlandı':'Araştır';b.disabled=done||!E.canResearch(state,t.id);});
    D.repeatableResearch.forEach(t=>{const node=el(`repeat-${t.id}`),cost=E.repeatCost(state,t.id);el(`repeat-level-${t.id}`).textContent=state.repeatResearch[t.id]||0;el(`repeat-cost-${t.id}`).textContent=fmtCost(cost);node.classList.toggle('hidden-res',!state.researched.omegaScience);node.querySelector('[data-repeat]').disabled=!E.canRepeatResearch(state,t.id);});
  }
  function renderQuest(state){const Q=global.Axyon.Quests,p=Q.questProgress(state);if(!p){el('quest-desc').textContent='Ana görevler tamam — imparatorluk büyümeye devam ediyor';el('quest-bar').style.width='100%';el('quest-progress-text').textContent='∞';return;}el('quest-desc').textContent=p.quest.desc;el('quest-bar').style.width=`${Math.min(100,p.current/p.target*100)}%`;el('quest-progress-text').textContent=`${N.format(Math.min(p.current,p.target))} / ${N.format(p.target)}`;}

  function renderReport(state,E){
    const built=D.machines.filter(d=>state.machines[d.id].count>0),root=el('report-list');
    el('report-summary').innerHTML=`<div class="rs-box"><span>Hat türü</span><b>${built.length}</b></div><div class="rs-box"><span>Toplam makine</span><b>${E.machineCountTotal(state)}</b></div><div class="rs-box"><span>Yükseltme</span><b>${state.stats.buildingUpgrades||0}</b></div><div class="rs-box ${(state.galaxy.threat||0)>5?'bad':''}"><span>Tehdit</span><b>${(state.galaxy.threat||0).toFixed(1)}</b></div>`;
    if(!built.length){root.innerHTML='<div class="report-empty">Henüz üretim hattı yok.</div>';return;}
    root.innerHTML=built.sort((a,b)=>a.tier-b.tier).map(d=>{const m=state.machines[d.id],lv=E.machineLevel(state,d.id),rate=E.machineRate(state,d.id),eff=m.hasManager?m.eff:0,status=!m.hasManager?'Manuel':eff>=.95?'Tam hız':eff>0?`Kısıtlı %${Math.round(eff*100)}`:'Durdu',cls=!m.hasManager?'manual':eff>=.95?'ok':eff>0?'warn':'bad',out=Object.keys(d.recipe.out)[0];return `<div class="report-row"><span class="rr-icon">${d.icon}</span><div class="rr-main"><div class="rr-name">${d.name} <span class="rr-count">Mk ${roman(lv)} · ×${m.count}</span></div><div class="rr-sub">${D.items[out].icon} ${N.format(m.hasManager?rate*eff:0)}/sn · ${N.format(E.machinePowerDemand(state,d.id))}kW</div></div><span class="rr-status ${cls}">${status}</span></div>`;}).join('');
  }

  function buildPalette(state,E){
    const m=el('fx-palette-machines'),p=el('fx-palette-plants');m.innerHTML='';p.innerHTML='';
    D.machines.forEach(d=>{if(!E.isMachineUnlocked(state,d.id))return;const lv=E.machineLevel(state,d.id),b=document.createElement('button');b.className='fx-palette-item';b.dataset.place=d.id;b.dataset.ptype='machine';b.innerHTML=`<span class="pi-icon">${d.icon}</span><span class="pi-body"><span class="pi-name">${d.name} · Mk ${roman(lv)}</span><span class="pi-cost">${N.format(E.buildCost(state,d.id))}🪙 · ${d.footprint}m² · ${N.format(E.machinePowerDemand({...state,machines:{...state.machines,[d.id]:{...state.machines[d.id],count:1,hasManager:true}}},d.id))}kW</span></span>`;m.appendChild(b);});
    D.powerPlants.forEach(d=>{if(!E.isPlantUnlocked(state,d.id))return;const b=document.createElement('button');b.className='fx-palette-item';b.dataset.place=d.id;b.dataset.ptype='plant';b.innerHTML=`<span class="pi-icon">${d.icon}</span><span class="pi-body"><span class="pi-name">${d.name} · Mk ${roman(E.plantLevel(state,d.id))}</span><span class="pi-cost">${N.format(E.plantBuildCost(state,d.id))}🪙 · +${N.format(d.output)}kW</span></span>`;p.appendChild(b);});
  }

  function showInspector(state,E,entity){
    const box=el('fx-inspector');if(!entity){box.classList.add('hidden');return;}const d=entity.type==='plant'?E.pDef(entity.defId):E.mDef(entity.defId),lv=entity.type==='plant'?E.plantLevel(state,entity.defId):E.machineLevel(state,entity.defId),up=lv<5?E.upgradeCost(d,lv,entity.type):null;
    if(entity.type==='machine'){
      const m=state.machines[entity.defId],recipe=Object.entries(d.recipe.in).map(([k,v])=>`${D.items[k].icon}${v!==1?'×'+v:''}`).join(' ')||'Kaynak yatağı',out=Object.entries(d.recipe.out).map(([k,v])=>`${D.items[k].icon}${v!==1?'×'+v:''}`).join(' ');
      box.innerHTML=`<div class="fxi-head"><span class="fxi-icon">${d.icon}</span><div><div class="fxi-name">${d.name} · Mk ${roman(lv)}</div><div class="fxi-sub">${recipe} → ${out}</div></div><button class="x" id="fxi-close">✕</button></div><div class="fxi-stats"><span>Sınıf adedi <b>${m.count}</b></span><span>Üretim <b>${N.format(E.machineRate(state,d.id))}/sn</b></span></div><div class="fxi-actions"><button class="fxi-btn" data-fxi="run">▶ Çalıştır</button>${m.hasManager?'<button class="fxi-btn owned" disabled>✓ Otomatik</button>':`<button class="fxi-btn" data-fxi="manager" ${E.canBuyManager(state,d.id)?'':'disabled'}>⚙️ Otomasyon ${N.format(d.managerCost)}🪙</button>`}<button class="fxi-btn" data-fxi="upgrade" ${E.canUpgradeClass(state,d.id,'machine')?'':'disabled'}>${lv>=5?'Mk V tamam':`⬆ Mk ${roman(lv+1)} · ${N.format(up.coins)}🪙 ${fmtCost(up.items)}`}</button><button class="fxi-btn" data-fxi="info">ⓘ Bilgi</button></div>`;
    }else box.innerHTML=`<div class="fxi-head"><span class="fxi-icon">${d.icon}</span><div><div class="fxi-name">${d.name} · Mk ${roman(lv)}</div><div class="fxi-sub">+${N.format(E.plantOutput(state,d.id))} kW</div></div><button class="x" id="fxi-close">✕</button></div><div class="fxi-actions"><button class="fxi-btn" data-fxi="upgrade" ${E.canUpgradeClass(state,d.id,'plant')?'':'disabled'}>${lv>=5?'Mk V tamam':`⬆ Mk ${roman(lv+1)} · ${N.format(up.coins)}🪙 ${fmtCost(up.items)}`}</button></div>`;
    box.dataset.entity=entity.id;box.classList.remove('hidden');
  }

  function showItemInfo(state,E,id){const x=E.itemInfo(state,id);el('iteminfo-title').textContent=`${x.icon} ${x.name}`;el('iteminfo-body').innerHTML=`<p>${escapeHtml(x.desc)}</p><div class="info-grid"><span>Stok <b>${N.format(x.amount)} / ${N.format(x.cap)}</b></span><span>Liste değeri <b>${x.research?'Satılmaz':x.sell+'🪙'}</b></span><span>Üreten <b>${x.producers.join(', ')||'—'}</b></span><span>Kullanan <b>${[...x.consumers,...x.fuelFor].join(', ')||'—'}</b></span></div>`;showModal('iteminfo-modal');}

  function renderGalaxy(state,E){
    const now=Date.now(),raid=Math.max(0,(state.galaxy.nextRaidAt-now)/1000);el('raid-timer').textContent=N.formatTime(raid);const sc=E.scanCost(state);el('scan-cost').textContent=state.researched.scanner?`Maliyet: ${N.format(sc.coins)}🪙 + ${sc.processor} ${D.items.processor.icon}`:'Yıldız Tarayıcı araştırması gerekli';el('scan-system').disabled=!E.canScan(state);
    const targets=state.galaxy.targets.filter(t=>t.discovered);el('target-list').innerHTML=targets.length?targets.map(t=>`<article class="target-card ${t.defeated?'defeated':''}"><div><b>${t.defeated?'✅':'☠️'} ${t.name}</b><small>${t.type} · ${t.distance} LY · Güç ${N.format(t.strength)}${t.defeated&&!t.colonized&&t.recoveryAt?` · Toparlanma ${N.formatTime(Math.max(0,(t.recoveryAt-now)/1000))}`:''}</small></div>${t.colonized?'<span class="badge">Koloni</span>':t.defeated?`<button data-colonize="${t.id}" class="btn-setting" ${E.canColonize(state,t.id)?'':'disabled'}>Kolonileştir</button>`:`<button data-attack="${t.id}" class="btn-setting" ${state.researched.fleetCommand?'':'disabled'}>Saldır</button>`}</article>`).join(''):'<div class="report-empty">Henüz sistem keşfedilmedi.</div>';
    el('shipyard-list').innerHTML=D.ships.map(d=>{const locked=d.tech&&!state.researched[d.tech];return `<div class="ship-row ${locked?'locked':''}"><span class="ship-icon">${d.icon}</span><div><b>${d.name}</b><small>Hangar: ${state.galaxy.ships[d.id]||0} · Saldırı ${d.attack} · Gövde ${d.hull}<br>${fmtCost(d.cost)}</small></div><input id="ship-count-${d.id}" type="number" min="1" max="99" value="1"><button data-buildship="${d.id}" ${locked||!E.canBuildShip(state,d.id,1)?'disabled':''}>Üret</button></div>`;}).join('');
    el('ship-queue').innerHTML=state.galaxy.shipQueue.length?state.galaxy.shipQueue.map(q=>`<div class="queue-row">${E.shipDef(q.shipId).icon} ${q.count} ${E.shipDef(q.shipId).name}<b>${N.formatTime(Math.max(0,(q.finishAt-now)/1000))}</b></div>`).join(''):'<small>Üretim kuyruğu boş.</small>';
    const ds=E.defenseStats(state);el('defense-power').textContent=N.format(ds.attack+ds.hull*.35)+' güç';el('defense-list').innerHTML=D.defenses.map(d=>{const locked=d.tech&&!state.researched[d.tech];return `<div class="ship-row ${locked?'locked':''}"><span class="ship-icon">${d.icon}</span><div><b>${d.name}</b><small>Kurulu: ${state.galaxy.defenses[d.id]||0} · ${fmtCost(d.cost)}</small></div><input id="def-count-${d.id}" type="number" min="1" max="99" value="1"><button data-builddef="${d.id}" ${locked||!E.canBuildDefense(state,d.id,1)?'disabled':''}>Kur</button></div>`;}).join('');
    el('mission-list').innerHTML=state.galaxy.missions.length?state.galaxy.missions.map(m=>{const t=E.targetById(state,m.targetId),end=m.status==='outbound'?m.arrivalAt:m.returnAt;return `<div class="mission-row"><span>${m.status==='outbound'?'⚔️':'↩️'} ${t?.name||m.targetId}</span><b>${m.status==='outbound'?'Varış':'Dönüş'} ${N.formatTime(Math.max(0,(end-now)/1000))}</b></div>`;}).join(''):'<div class="report-empty">Aktif görev yok.</div>';
    el('galaxy-reports').innerHTML=state.galaxy.reports.length?state.galaxy.reports.map(r=>`<article class="galaxy-report ${r.type}"><div><b>${escapeHtml(r.title)}</b><small>${new Date(r.time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</small></div><p>${escapeHtml(r.body)}</p></article>`).join(''):'<div class="report-empty">Henüz rapor yok.</div>';
  }

  function renderFleetModal(state,E,target){el('fleet-title').textContent=`⚔️ ${target.name} — Güç ${N.format(target.strength)}`;el('fleet-body').innerHTML=`<p class="panel-hint">Gidiş-dönüş yakıtı sefer başında ayrılır. Sonuç varışta hesaplanır.</p><div class="fleet-select">${D.ships.map(d=>`<label><span>${d.icon} ${d.name} <small>mevcut ${state.galaxy.ships[d.id]||0}</small></span><input data-fleetship="${d.id}" type="number" min="0" max="${state.galaxy.ships[d.id]||0}" value="0"></label>`).join('')}</div><div id="fleet-preview" class="fleet-preview">Gemi seçilmedi.</div>`;el('fleet-modal').dataset.target=target.id;showModal('fleet-modal');}
  function fleetSelection(){const out={};document.querySelectorAll('[data-fleetship]').forEach(i=>out[i.dataset.fleetship]=Math.max(0,Math.floor(Number(i.value)||0)));return out;}

  function renderAchievements(state){el('ach-grid').innerHTML=D.achievements.map(a=>`<div class="ach-item ${state.achievements[a.id]?'done':''}"><span>${state.achievements[a.id]?'🏆':'🔒'}</span><span>${a.desc}</span></div>`).join('');}
  function setToolbarMode(mode){document.querySelectorAll('.fx-tool[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));const hints={select:'Yapıya tıkla: seç · sürükle: taşı · boşluk sürükle: kaydır',place:'Yerleştirmek için açık yüzeye tıkla',conveyor:'Kaynak yapı → hedef yapı',power:'Santral → makine',delete:'Yapı veya bağlantıya tıkla: sil'};el('fx-hint').textContent=hints[mode]||'';}
  function switchTab(tab){document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));el(`panel-${tab}`).classList.add('active');el(`tab-${tab}`).classList.add('active');}
  function pulse(){}function spawnFloat(text,x,y){const n=document.createElement('div');n.className='float-text';n.textContent=text;n.style.left=x+'px';n.style.top=y+'px';el('float-layer').appendChild(n);setTimeout(()=>n.remove(),900);}
  const showModal=id=>el(id).classList.remove('hidden'),hideModal=id=>el(id).classList.add('hidden');

  global.Axyon=global.Axyon||{};global.Axyon.UI={el,buildMachineCards,buildPlantCards,buildInventory,buildResearch,render,renderMarket,renderGalaxy,renderFleetModal,fleetSelection,selectedItems,pulse,spawnFloat,showModal,hideModal,renderAchievements,switchTab,showItemInfo,renderReport,buildPalette,showInspector,setToolbarMode};
})(window);
