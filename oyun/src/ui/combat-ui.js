/** Axyon.CombatUI v4.3 — savaş raporları, enkaz ve bakım merkezi. */
(function(global){
  const D=global.Axyon.Data,N=global.Axyon.Numbers;
  const el=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtItems=obj=>Object.entries(obj||{}).filter(([,v])=>v>0).map(([k,v])=>k==='coins'?`🪙 ${N.format(v)} Kredi`:`${D.items[k]?.icon||''} ${N.format(v)} ${D.items[k]?.name||k}`).join(' · ')||'—';
  const fmtFleet=obj=>D.ships.filter(d=>(obj?.[d.id]||0)>0).map(d=>`${d.icon} ${obj[d.id]} ${d.name}`).join(' · ')||'—';
  const fmtDefense=obj=>D.defenses.filter(d=>(obj?.[d.id]||0)>0).map(d=>`${d.icon} ${obj[d.id]} ${d.name}`).join(' · ')||'—';
  const zoneMeta={planet:{name:'Gezegen Yüzeyi',icon:'🪐',desc:'Üretim ve savunma altyapısı'},orbital:{name:'Yörünge Tesisleri',icon:'🛰️',desc:'Tersane, filo ve kuru havuz'},satellite:{name:'Uydu Ağı',icon:'📡',desc:'Pazar uydusu ve iletişim'}};
  let filter='all',selectedId='';

  function renderIntegrity(state,E){
    const root=el('integrity-grid');if(!root)return;
    root.innerHTML=Object.entries(zoneMeta).map(([id,m])=>{const value=Math.round(state.maintenance.integrity[id]??100),damage=Math.max(0,100-value),c=E.repairJobCost(state,'zone',id,Math.max(1,Math.min(10,damage)));return `<article class="integrity-card ${value<45?'critical':value<75?'warn':''}"><div class="integrity-head"><span>${m.icon}</span><div><b>${m.name}</b><small>${m.desc}</small></div><strong>%${value}</strong></div><div class="integrity-bar"><i style="width:${value}%"></i></div><div class="integrity-actions"><small>${damage?`${damage} hasar puanı · sonraki 10 puan: ${fmtItems(c.items)}`:'Tam kapasite'}</small><button data-repair-zone="${id}" data-amount="${Math.max(1,Math.min(10,damage))}" ${damage<1||!E.canQueueRepair(state,'zone',id,Math.max(1,Math.min(10,damage)))?'disabled':''}>10 puan onar</button></div></article>`;}).join('');
  }

  function renderFacilities(state,E){
    const root=el('facility-list');if(!root)return;
    root.innerHTML=D.repairFacilities.map(d=>{const lv=E.facilityLevel(state,d.id),c=E.facilityUpgradeCost(state,d.id),locked=!state.researched[d.tech];return `<article class="facility-row ${locked?'locked':''}"><span class="facility-icon">${d.icon}</span><div><b>${d.name}</b><small>${zoneMeta[d.zone].name} · ${lv?`Seviye ${lv}`:'Kurulmadı'}${locked?` · ${D.research.find(t=>t.id===d.tech)?.name||d.tech} gerekli`:''}</small></div><button data-facility-upgrade="${d.id}" ${!E.canUpgradeFacility(state,d.id)?'disabled':''}>${lv>=d.maxLevel?'Maksimum':lv?`Sv. ${lv+1} · ${N.format(c?.coins||0)}🪙`:`Kur · ${N.format(c?.coins||0)}🪙`}</button></article>`;}).join('');
  }

  function renderDamaged(state,E){
    const shipRoot=el('damaged-ship-list'),defRoot=el('damaged-defense-list');
    if(shipRoot)shipRoot.innerHTML=D.ships.map(d=>{const n=state.maintenance.damagedShips[d.id]||0,c=E.repairJobCost(state,'ship',d.id,Math.max(1,Math.min(5,n)));return `<div class="damage-row ${n?'':'empty'}"><span>${d.icon}</span><div><b>${d.name}</b><small>Hasarlı: ${n}${n?` · ${fmtItems(c.items)} · ${N.formatTime(c.seconds)}`:''}</small></div><button data-repair-ship="${d.id}" data-amount="${Math.max(1,Math.min(5,n))}" ${n<1||!E.canQueueRepair(state,'ship',d.id,Math.max(1,Math.min(5,n)))?'disabled':''}>${Math.min(5,n)||1} tamir</button></div>`;}).join('');
    if(defRoot)defRoot.innerHTML=D.defenses.map(d=>{const n=state.maintenance.damagedDefenses[d.id]||0,c=E.repairJobCost(state,'defense',d.id,Math.max(1,Math.min(10,n)));return `<div class="damage-row ${n?'':'empty'}"><span>${d.icon}</span><div><b>${d.name}</b><small>Hasarlı: ${n}${n?` · ${fmtItems(c.items)} · ${N.formatTime(c.seconds)}`:''}</small></div><button data-repair-defense="${d.id}" data-amount="${Math.max(1,Math.min(10,n))}" ${n<1||!E.canQueueRepair(state,'defense',d.id,Math.max(1,Math.min(10,n)))?'disabled':''}>${Math.min(10,n)||1} tamir</button></div>`;}).join('');
  }

  function renderQueue(state){const root=el('repair-queue');if(!root)return;const now=Date.now();root.innerHTML=state.maintenance.repairQueue.length?state.maintenance.repairQueue.map(j=>{const name=j.kind==='zone'?zoneMeta[j.targetId]?.name:j.kind==='ship'?D.ships.find(d=>d.id===j.targetId)?.name:D.defenses.find(d=>d.id===j.targetId)?.name;return `<div class="queue-row"><span>🧰 ${esc(name)} ×${j.amount}</span><b>${N.formatTime(Math.max(0,(j.finishAt-now)/1000))}</b></div>`;}).join(''):'<div class="report-empty">Tamir kuyruğu boş.</div>';}
  function renderSalvage(state){const root=el('salvage-summary');if(!root)return;root.innerHTML=['scrapMetal','wreckCircuit','alienAlloy','repairKit','nanoGel','orbitalParts'].map(k=>`<div class="salvage-chip"><span>${D.items[k].icon}</span><div><b>${N.format(state.inventory[k]||0)}</b><small>${D.items[k].name}</small></div></div>`).join('');}

  function reportCategory(r){return r.details?.category||(/raid/.test(r.type)?'raid':/battle/.test(r.type)?'battle':'intel');}
  function filteredReports(state){return (state.galaxy.reports||[]).filter(r=>filter==='all'||reportCategory(r)===filter);}
  function renderReports(state,E){
    const root=el('combat-report-list');if(!root)return;const list=filteredReports(state);document.querySelectorAll('[data-report-filter]').forEach(b=>b.classList.toggle('active',b.dataset.reportFilter===filter));
    if(selectedId&&!list.some(r=>r.id===selectedId))selectedId=list[0]?.id||'';
    root.innerHTML=list.length?list.map(r=>`<button class="combat-report-row ${r.type} ${selectedId===r.id?'active':''}" data-report-open="${r.id}"><span class="report-mark">${reportCategory(r)==='battle'?'⚔️':reportCategory(r)==='raid'?'🚨':reportCategory(r)==='maintenance'?'🧰':'📡'}</span><div><b>${esc(r.title)}</b><small>${new Date(r.time).toLocaleString('tr-TR')} · ${esc(r.body)}</small></div><span>›</span></button>`).join(''):'<div class="report-empty">Bu filtrede rapor yok.</div>';
    if(!selectedId&&list[0])selectedId=list[0].id;renderReportDetail(state,E,selectedId);
  }

  function roundTable(d){return `<div class="round-table"><div class="round-head"><span>Tur</span><span>Filo ateşi</span><span>Düşman ateşi</span><span>Filo gövdesi</span><span>Düşman gövdesi</span></div>${(d.rounds||[]).map(r=>`<div><span>${r.round}</span><span>${N.format(r.playerDamage)}</span><span>${N.format(r.enemyDamage)}</span><span>${N.format(r.playerHull)}</span><span>${N.format(r.enemyHull)}</span></div>`).join('')}</div>`;}
  function renderReportDetail(state,E,id){
    const root=el('combat-report-detail');if(!root)return;const r=E.reportById(state,id);if(!r){root.innerHTML='<div class="report-empty">Detay için bir rapor seç.</div>';return;}selectedId=r.id;const d=r.details||{},cat=reportCategory(r);let body=`<div class="report-detail-head"><div><span>${cat.toUpperCase()}</span><h3>${esc(r.title)}</h3><small>${new Date(r.time).toLocaleString('tr-TR')}</small></div><b class="outcome ${d.outcome||''}">${d.outcome==='victory'?'ZAFER':d.outcome==='defeat'?'YENİLGİ':'RAPOR'}</b></div><p class="report-detail-summary">${esc(r.body)}</p>`;
    if(cat==='battle')body+=`<div class="detail-grid"><div><span>Hedef</span><b>${esc(d.target?.name||'—')}</b><small>${esc(d.target?.type||'')} · Güç ${N.format(d.target?.strength||0)}</small></div><div><span>Gönderilen filo</span><b>${fmtFleet(d.fleetBefore)}</b></div><div><span>Sağlam dönen</span><b>${fmtFleet(d.operational)}</b></div><div><span>Hasarlı</span><b>${fmtFleet(d.damaged)}</b></div><div><span>Kayıp</span><b>${fmtFleet(d.lost)}</b></div><div><span>Çarpanlar</span><b>Silah ×${Number(d.modifiers?.weapon||1).toFixed(2)} · Kalkan ×${Number(d.modifiers?.shield||1).toFixed(2)}</b><small>Yörünge bütünlüğü %${Math.round(d.modifiers?.orbitalIntegrity||100)}</small></div><div><span>Kargo</span><b>${N.format(d.cargo?.used||0)} / ${N.format(d.cargo?.capacity||0)}</b><small>Taşınamayan: ${fmtItems(Object.assign({},d.unrecovered?.loot||{},d.unrecovered?.salvage||{}))}</small></div></div>${roundTable(d)}<div class="loot-grid"><div><span>Ganimet</span><b>${fmtItems(d.loot)}</b></div><div><span>Kurtarılan enkaz</span><b>${fmtItems(d.salvage)}</b></div></div>`;
    else if(cat==='raid')body+=`<div class="detail-grid"><div><span>Düşman gücü</span><b>${N.format(d.enemyPower||0)}</b></div><div><span>Savunma gücü</span><b>${N.format(d.defensePower||0)}</b></div><div><span>Mühimmat</span><b>${N.format(d.ammoUsed||0)} / ${N.format(d.ammoNeed||0)}</b><small>Etkinlik %${Math.round((d.ammoRatio||0)*100)}</small></div><div><span>Hasarlı savunma</span><b>${fmtDefense(d.defenses?.damaged)}</b></div><div><span>Yok olan savunma</span><b>${fmtDefense(d.defenses?.destroyed)}</b></div><div><span>Depo kaybı</span><b>%${Math.round((d.inventoryLossPct||0)*100)}</b></div></div><div class="raid-phases">${(d.phases||[]).map(p=>`<div><span>${esc(p.name)}</span><b>−${Number(p.damage||0).toFixed(1)} hasar</b><small>Kalan bütünlük %${Math.round(p.integrity||0)}</small></div>`).join('')}</div><div class="loot-grid"><div><span>Kurtarılan enkaz</span><b>${fmtItems(d.salvage)}</b></div><div><span>Ödül</span><b>${N.format(d.reward||0)}🪙</b></div></div>`;
    else body+=`<div class="detail-grid"><div><span>Kategori</span><b>${esc(cat)}</b></div><div><span>Teknik veri</span><b>${esc(JSON.stringify(d).slice(0,300))}</b></div></div>`;
    root.innerHTML=body;document.querySelectorAll('[data-report-open]').forEach(b=>b.classList.toggle('active',b.dataset.reportOpen===selectedId));
  }

  function renderSimulator(state,E){const root=el('combat-simulator-explain');if(!root)return;root.innerHTML=`<h3>⚙️ Savaş Simülasyonu Nasıl Çalışır?</h3><p>Savaş en fazla <b>6 tur</b> sürer. Her turda iki tarafın saldırı gücü, kalan gövde oranı ve %88–112 arası taktik sapma birlikte hesaplanır. Filo kayıpları tek bir rastgele yüzdeyle değil, turun sonunda kalan toplam gövdeye göre gemi sınıflarına dağıtılır.</p><div class="formula-grid"><span><b>Filo ateşi</b>Temel saldırı × silah çarpanı × taktik sapma × filo kondisyonu</span><span><b>Düşman ateşi</b>Hedef gücü × taktik sapma × düşman kondisyonu</span><span><b>Hasarlı gemiler</b>Sağ kalanların bir bölümü doğrudan hangara değil kuru havuza gider</span><span><b>Enkaz</b>Kayıp gövde + düşman gücü × enkaz kurtarma teknolojisi; yalnızca sağ kalan filonun kargosu kadar taşınır</span></div><p class="sim-current">Mevcut çarpanlar: Silah ×${E.weaponMult(state).toFixed(2)} · Kalkan ×${E.shieldMult(state).toFixed(2)} · Yörünge bütünlüğü %${Math.round(state.maintenance.integrity.orbital)}</p>`;}

  function render(state,E){
    const wins=el('combat-wins'),salvage=el('combat-salvage-total'),repairs=el('combat-repairs-total');
    if(wins)wins.textContent=N.format((state.stats.battlesWon||0)+(state.stats.raidsWon||0));
    if(salvage)salvage.textContent=N.format(state.stats.salvageRecovered||0);
    if(repairs)repairs.textContent=N.format(state.stats.repairsCompleted||0);
    renderIntegrity(state,E);renderFacilities(state,E);renderDamaged(state,E);renderQueue(state);renderSalvage(state);renderReports(state,E);renderSimulator(state,E);
  }
  function setFilter(v){filter=v||'all';}
  global.Axyon=global.Axyon||{};global.Axyon.CombatUI={render,renderReports,renderReportDetail,setFilter,get filter(){return filter;},get selectedId(){return selectedId;}};
})(typeof window!=='undefined'?window:globalThis);
