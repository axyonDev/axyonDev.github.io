/** Axyon Frontier Foundry v4 — uygulama giriş ve olay akışı. */
(function(){
  const E=window.Axyon.Economy,Q=window.Axyon.Quests,S=window.Axyon.SaveService,UI=window.Axyon.UI,T=window.Axyon.Toast,N=window.Axyon.Numbers,D=window.Axyon.Data,FC=window.Axyon.FactoryCanvas;
  let state=S.load()||E.createInitialState(),selectedEntityId=null;

  applyTheme(state.settings.theme||'dark');
  UI.buildInventory(state,E);UI.buildResearch(state,E);UI.buildPlantCards(state,E);UI.buildPalette(state,E);

  FC.init(UI.el('factory-canvas'),state,E,{
    onModeChange:UI.setToolbarMode,
    onSelect:e=>{selectedEntityId=e.id;UI.showInspector(state,E,e);},
    onChange:()=>{S.save(state);refreshAll();},
    onPlaced:id=>{T.show(`🏗️ ${E.mDef(id)?.name||E.pDef(id)?.name} kuruldu`,'success');UI.buildPalette(state,E);postAction();},
    onPlaceFail:(id,type)=>{const d=type==='plant'?E.pDef(id):E.mDef(id);T.show(E.isExtractor(id)&&!E.hasFreeNodeFor(state,id)?`⛏️ Uygun ${d.name} yatağı bulunamadı`:'Kurulum için kredi, açık alan veya uygun hücre yetersiz','error');},
    onSectorClick:(sx,sy)=>tryOpenSector(sx,sy),
    onPowerFail:()=>T.show('⚡ Hat santralden makineye çekilmeli','info'),
  });
  FC.refreshTheme();UI.setToolbarMode('select');
  requestAnimationFrame(function paint(){FC.draw();requestAnimationFrame(paint);});

  const offline=E.applyOfflineProgress(state);if(offline.usableSeconds>8){UI.el('offline-text').textContent=`${N.formatTime(offline.usableSeconds)} çevrimdışı ilerleme işlendi. Pazar seferleri, tersane ve filo görevleri de güncellendi.${offline.wasCapped?' Çevrimdışı süre 8 saatle sınırlandı.':''}${offline.raidDeferred?' Vadesi gelen uzaylı baskını, savunma hazırlığı yapabilmen için dönüşünden sonraya ertelendi.':''}`;UI.showModal('offline-modal');}
  refreshAll();postAction();

  function refreshAll(){UI.render(state,E);UI.buildPalette(state,E);if(selectedEntityId&&state.grid.entities[selectedEntityId])UI.showInspector(state,E,state.grid.entities[selectedEntityId]);else if(selectedEntityId){selectedEntityId=null;UI.showInspector(state,E,null);}}
  function postAction(force=true){let changed=false,c=Q.tryComplete(state);while(c){changed=true;T.show(`✅ Görev: ${c.desc}<br><span class="toast-reward">${c.rewardText}</span>`,'success');c=Q.tryComplete(state);}const achievements=Q.checkAchievements(state);achievements.forEach(a=>T.show(`🏆 ${a.desc}`,'achievement'));if(achievements.length)changed=true;if(force||changed)refreshAll();}
  function tryOpenSector(sx,sy){if(E.openSector(state,sx,sy)){T.show(`🧭 Yeni bölge açıldı: ${sx},${sy}`,'success');S.save(state);postAction();}else T.show('Bölge komşu değil veya kredi yetersiz','error');}

  // Sekmeler
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{UI.switchTab(b.dataset.tab);if(b.dataset.tab==='galaxy')UI.renderGalaxy(state,E);if(b.dataset.tab==='report')UI.renderReport(state,E);if(b.dataset.tab==='factory')setTimeout(()=>FC.resize(),20);}));

  // Canvas araçları
  document.querySelectorAll('.fx-tool[data-mode]').forEach(b=>b.addEventListener('click',()=>FC.setMode(b.dataset.mode)));
  UI.el('fx-zoomin').addEventListener('click',()=>FC.zoomBy(1.2));UI.el('fx-zoomout').addEventListener('click',()=>FC.zoomBy(1/1.2));UI.el('fx-recenter').addEventListener('click',()=>FC.recenter());
  UI.el('fx-build-toggle').addEventListener('click',()=>UI.el('fx-palette').classList.toggle('hidden'));UI.el('fx-palette-close').addEventListener('click',()=>UI.el('fx-palette').classList.add('hidden'));
  document.querySelectorAll('[data-ptab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-ptab]').forEach(x=>x.classList.toggle('active',x===b));UI.el('fx-palette-machines').classList.toggle('hidden',b.dataset.ptab!=='machines');UI.el('fx-palette-plants').classList.toggle('hidden',b.dataset.ptab!=='plants');}));
  UI.el('fx-palette').addEventListener('click',ev=>{const b=ev.target.closest('[data-place]');if(!b)return;FC.setMode('place',b.dataset.place,b.dataset.ptype);UI.el('fx-palette').classList.add('hidden');});
  UI.el('fx-inspector').addEventListener('click',ev=>{
    if(ev.target.id==='fxi-close'){selectedEntityId=null;UI.showInspector(state,E,null);return;}
    const b=ev.target.closest('[data-fxi]'),ent=state.grid.entities[UI.el('fx-inspector').dataset.entity];if(!b||!ent)return;
    if(b.dataset.fxi==='run'){const g=E.manualClick(state,ent.defId);T.show(g>0?`▶ +${N.format(g)} üretildi`:'Girdi veya depo yetersiz',g>0?'success':'info');}
    if(b.dataset.fxi==='manager'){if(E.buyManager(state,ent.defId))T.show('⚙️ Hat otomasyona bağlandı','success');else T.show('Kredi yetersiz','error');}
    if(b.dataset.fxi==='upgrade'){if(E.doUpgradeClass(state,ent.defId,ent.type))T.show(`⬆ ${ent.type==='plant'?E.pDef(ent.defId).name:E.mDef(ent.defId).name} yükseltildi`,'success');else T.show('Teknoloji, malzeme veya kredi yetersiz','error');}
    if(b.dataset.fxi==='info'&&ent.type==='machine'){const out=Object.keys(E.mDef(ent.defId).recipe.out)[0];UI.showItemInfo(state,E,out);}
    S.save(state);postAction();
  });

  UI.el('land-expand-btn').addEventListener('click',()=>{const x=E.openableSectors(state)[0];if(x)tryOpenSector(x.sx,x.sy);});

  // Güç paneli
  UI.el('plants-container').addEventListener('click',ev=>{const build=ev.target.closest('[data-buildplant]'),up=ev.target.closest('[data-upgradeplant]');if(build){const id=build.dataset.buildplant;T.show('Santrali gezegen yüzeyindeki İnşa paletinden yerleştir','info');FC.setMode('place',id,'plant');UI.switchTab('factory');}if(up){if(E.doUpgradeClass(state,up.dataset.upgradeplant,'plant'))T.show('⚡ Santral sınıfı yükseltildi','success');else T.show('Teknoloji veya kaynak yetersiz','error');S.save(state);postAction();}});

  // Depo
  UI.el('inventory-list').addEventListener('click',ev=>{
    const info=ev.target.closest('[data-info]'),auto=ev.target.closest('[data-auto]'),stor=ev.target.closest('[data-stor]'),keep=ev.target.closest('[data-keep]'),sell=ev.target.closest('[data-sellfrac]');
    if(info)UI.showItemInfo(state,E,info.dataset.info);
    else if(auto)E.toggleAutoSell(state,auto.dataset.auto);
    else if(stor){if(E.upgradeStorage(state,stor.dataset.stor))T.show('📦 Depo kapasitesi büyüdü','success');else T.show('Kredi yetersiz','error');}
    else if(keep)E.setAutoSellKeep(state,keep.dataset.keep,Number(keep.dataset.pct));
    else if(sell){const g=E.sellFraction(state,sell.dataset.sellfrac,Number(sell.dataset.frac));T.show(g?`💰 Yerel satış +${N.format(g)}🪙`:'Satılabilir stok yok',g?'success':'info');}
    else return;S.save(state);refreshAll();
  });
  UI.el('inventory-list').addEventListener('change',()=>UI.render(state,E));
  UI.el('bulk-selall').addEventListener('change',ev=>{Object.keys(D.items).forEach(id=>{const c=UI.el(`check-${id}`);if(c&&!c.disabled)c.checked=ev.target.checked;});UI.render(state,E);});
  document.querySelectorAll('[data-bulksell]').forEach(b=>b.addEventListener('click',()=>{const ids=UI.selectedItems();if(!ids.length){T.show('Önce ürün seç','info');return;}let g=0;ids.forEach(id=>g+=E.sellFraction(state,id,Number(b.dataset.bulksell)));T.show(g?`💰 Toplu yerel satış +${N.format(g)}🪙`:'Satılabilir stok yok',g?'success':'info');S.save(state);postAction();}));
  UI.el('market-master').addEventListener('click',()=>{if(!state.researched.marketSatellite){T.show('Önce Pazar Uydusu araştırılmalı','info');return;}state.market.enabled=!state.market.enabled;if(state.market.enabled&&!state.market.nextDispatchAt)state.market.nextDispatchAt=Date.now()+E.marketCooldownSec(state)*1000;S.save(state);refreshAll();});
  document.querySelectorAll('[data-globalkeep]').forEach(b=>b.addEventListener('click',()=>{E.setGlobalMarketKeep(state,Number(b.dataset.globalkeep));T.show(`🛰️ Tüm ürünlerde elde tutma %${b.dataset.globalkeep}`,'success');S.save(state);refreshAll();}));
  UI.el('market-all-on').addEventListener('click',()=>{const sellables=Object.keys(D.items).filter(k=>!D.items[k].research&&D.items[k].sell>0),allOn=sellables.every(k=>state.autoSell[k]);E.setAllAutoSell(state,!allOn);T.show(allOn?'Tüm ürünlerin uydu satışı kapatıldı':'Tüm ürünlerin uydu satışı açıldı','success');S.save(state);refreshAll();});
  UI.el('market-upgrade').addEventListener('click',()=>{if(E.upgradeMarket(state))T.show('🛰️ Pazar Uydusu geliştirildi','success');else T.show('Araştırma, kredi veya malzeme yetersiz','error');S.save(state);postAction();});

  // Araştırma
  UI.el('research-list').addEventListener('click',ev=>{const b=ev.target.closest('[data-research]');if(!b)return;if(E.doResearch(state,b.dataset.research)){T.show(`🔬 ${D.research.find(x=>x.id===b.dataset.research).name} tamamlandı`,'success');UI.buildPalette(state,E);}else T.show('Araştırma verisi veya önkoşul yetersiz','error');S.save(state);postAction();});
  UI.el('repeat-research-list').addEventListener('click',ev=>{const b=ev.target.closest('[data-repeat]');if(!b)return;if(E.doRepeatResearch(state,b.dataset.repeat))T.show('♾️ Sınırsız araştırma seviyesi yükseldi','success');else T.show('Omega Veri yetersiz','error');S.save(state);postAction();});

  // Galaksi
  UI.el('scan-system').addEventListener('click',()=>{const t=E.scanNextTarget(state);if(t)T.show(`🔭 ${t.name} keşfedildi`,'success');else T.show('Tarayıcı kilitli, beklemede veya kaynak yetersiz','error');S.save(state);postAction();});
  UI.el('shipyard-list').addEventListener('click',ev=>{const b=ev.target.closest('[data-buildship]');if(!b)return;const id=b.dataset.buildship,count=Math.max(1,Number(UI.el(`ship-count-${id}`).value)||1);if(E.queueShip(state,id,count))T.show(`🚀 ${count} gemi üretim kuyruğuna alındı`,'success');else T.show('Gemi teknolojisi veya malzemeler yetersiz','error');S.save(state);postAction();});
  UI.el('defense-list').addEventListener('click',ev=>{const b=ev.target.closest('[data-builddef]');if(!b)return;const id=b.dataset.builddef,count=Math.max(1,Number(UI.el(`def-count-${id}`).value)||1);if(E.buildDefense(state,id,count))T.show(`🛡️ ${count} savunma birimi kuruldu`,'success');else T.show('Savunma teknolojisi veya malzemeler yetersiz','error');S.save(state);postAction();});
  UI.el('target-list').addEventListener('click',ev=>{const attack=ev.target.closest('[data-attack]'),col=ev.target.closest('[data-colonize]');if(attack)UI.renderFleetModal(state,E,E.targetById(state,attack.dataset.attack));if(col){if(E.colonizeTarget(state,col.dataset.colonize))T.show('🪐 Yeni koloni kuruldu · üretim +%4','success');else T.show('Koloni teknolojisi veya kaynaklar yetersiz','error');S.save(state);postAction();}});
  UI.el('fleet-body').addEventListener('input',()=>{const target=E.targetById(state,UI.el('fleet-modal').dataset.target),sel=UI.fleetSelection(),fs=E.fleetStats(sel,state),fuel=fs.fuel*(target?.distance||0),sec=target?E.travelSeconds(state,target,sel):0;UI.el('fleet-preview').textContent=fs.total?`Filo gücü ${N.format(fs.attack*E.weaponMult(state))} · Gövde ${N.format(fs.hull*E.shieldMult(state))} · Yakıt ${N.format(fuel)} · Varış ${N.formatTime(sec)}`:'Gemi seçilmedi.';});
  UI.el('fleet-send').addEventListener('click',()=>{const target=UI.el('fleet-modal').dataset.target,sel=UI.fleetSelection();if(E.sendFleet(state,target,sel)){T.show('⚔️ Saldırı filosu yola çıktı','success');UI.hideModal('fleet-modal');}else T.show('Gemi, yıldız yakıtı veya filo komutası yetersiz','error');S.save(state);postAction();});

  // Modallar / ayarlar
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>UI.hideModal(b.dataset.close)));
  UI.el('btn-achievements').addEventListener('click',()=>{UI.renderAchievements(state);UI.showModal('ach-modal');});UI.el('btn-settings').addEventListener('click',()=>{UI.el('export-code').value='';UI.showModal('settings-modal');});
  UI.el('theme-toggle').addEventListener('click',()=>{state.settings.theme=state.settings.theme==='dark'?'light':'dark';applyTheme(state.settings.theme);S.save(state);});
  UI.el('do-export').addEventListener('click',()=>{UI.el('export-code').value=S.exportString(state);UI.el('export-code').select();T.show('📋 Kayıt kodu hazır','info');});
  UI.el('do-import').addEventListener('click',()=>{const r=S.importString(UI.el('import-code').value);if(!r.ok){T.show('❌ '+r.error,'error');return;}if(!confirm('Mevcut kayıt değiştirilecek. Devam?'))return;state=r.state;S.save(state);FC.setState(state);applyTheme(state.settings.theme);UI.buildInventory(state,E);UI.buildResearch(state,E);UI.buildPalette(state,E);selectedEntityId=null;UI.hideModal('settings-modal');refreshAll();T.show('✅ Kayıt yüklendi','success');});
  UI.el('do-reset').addEventListener('click',()=>{if(confirm('Tüm fabrika, teknoloji ve filo ilerlemesi silinecek. Emin misin?')){S.reset();location.reload();}});
  function applyTheme(t){document.documentElement.setAttribute('data-theme',t);const b=UI.el('theme-toggle');if(b)b.textContent=t==='dark'?'☀️ Açık tema':'🌙 Koyu tema';FC?.refreshTheme?.();}

  let last=performance.now(),check=0;
  setInterval(()=>{const now=performance.now(),dt=Math.min(1,(now-last)/1000);last=now;E.tick(state,dt);UI.render(state,E);check+=dt;if(check>=.75){check=0;postAction(false);}},D.economyConfig.tickIntervalMs);
  setInterval(()=>S.save(state),D.economyConfig.autosaveIntervalMs);window.addEventListener('beforeunload',()=>S.save(state));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')S.save(state);});
  window.__axyon={get state(){return state;},E,S,Q,UI};
})();
