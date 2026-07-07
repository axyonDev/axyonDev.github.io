/** Axyon v4.4 U2 First Orbit — uygulama giriş ve olay akışı. */
(function(){
  const E=window.Axyon.Economy,Q=window.Axyon.Quests,S=window.Axyon.SaveService,UI=window.Axyon.UI,T=window.Axyon.Toast,N=window.Axyon.Numbers,D=window.Axyon.Data,FC=window.Axyon.FactoryCanvas,H=window.Axyon.HelpSystem,CUI=window.Axyon.CombatUI;
  const bootProfile=S.bootstrap();
  let state=S.load()||E.createInitialState(),selectedEntityId=null,firstRun=!bootProfile;
  const activeName=()=>S.currentProfile()?.name||'Komutan';

  applyTheme(state.settings.theme||'dark');
  const saveDiagnostics=S.diagnostics?.();
  if(saveDiagnostics?.blockingError)setTimeout(()=>{console.error('[Axyon Save Recovery]',saveDiagnostics.blockingError);alert('Kayıt güvenlik nedeniyle açılmadı. Orijinal kayıt ve migrasyon yedeği korunuyor. Aktif profil sıfırlanana veya kayıt içe aktarılana kadar otomatik kayıt durduruldu.');},0);
  UI.buildInventory(state,E);UI.buildResearch(state,E);UI.buildPlantCards(state,E);UI.buildPalette(state,E);UI.el('active-profile-name').textContent=activeName();

  FC.init(UI.el('factory-canvas'),state,E,{
    onModeChange:UI.setToolbarMode,
    onSelect:e=>{selectedEntityId=e.id;UI.showInspector(state,E,e);},
    onChange:()=>{S.save(state);refreshAll();},
    onPlaced:id=>{T.show(`🏗️ ${E.mDef(id)?.name||E.pDef(id)?.name} kuruldu`,'success');UI.buildPalette(state,E);postAction();},
    onPlaceFail:(id,type)=>{const d=type==='plant'?E.pDef(id):E.mDef(id);T.show(E.isExtractor(id)&&!E.hasFreeNodeFor(state,id)?`⛏️ Uygun ${d.name} yatağı bulunamadı`:'Kurulum için malzeme, kapasite, açık alan veya uygun hücre yetersiz','error');},
    onSectorClick:(sx,sy)=>tryOpenSector(sx,sy),
    onNodeClick:(node,gx,gy)=>{selectedEntityId=null;UI.showNodeBuilder(state,E,node.type,gx,gy);},
    onPowerFail:()=>T.show('⚡ Hat santralden makineye çekilmeli','info'),
    onHelp:(key,x,y,detail)=>detail?H?.openKey(key):H?.showKeyAt(key,x,y),
    onHelpHide:()=>H?.hide(),
  });
  FC.refreshTheme();UI.setToolbarMode('select');H?.init(()=>state,()=>E);UI.el('factory-canvas')?.addEventListener('contextmenu',ev=>ev.preventDefault());document.addEventListener('contextmenu',ev=>{if(ev.target.closest('.factory-shell,.fx-canvas-wrap'))ev.preventDefault();});
  requestAnimationFrame(function paint(){FC.draw();requestAnimationFrame(paint);});

  const offline=firstRun?{usableSeconds:0}:E.applyOfflineProgress(state);if(offline.usableSeconds>8){UI.el('offline-text').textContent=`${N.formatTime(offline.usableSeconds)} çevrimdışı ilerleme işlendi. Pazar seferleri, tersane ve filo görevleri de güncellendi.${offline.wasCapped?' Çevrimdışı süre 8 saatle sınırlandı.':''}${offline.raidDeferred?' Vadesi gelen uzaylı baskını, savunma hazırlığı yapabilmen için dönüşünden sonraya ertelendi.':''}`;UI.showModal('offline-modal');}
  refreshAll();postAction();if(firstRun)UI.showModal('commander-onboarding');

  function refreshAll(){UI.el('active-profile-name').textContent=activeName();UI.render(state,E);UI.buildPalette(state,E);if(selectedEntityId&&state.grid.entities[selectedEntityId])UI.showInspector(state,E,state.grid.entities[selectedEntityId]);else if(selectedEntityId){selectedEntityId=null;UI.showInspector(state,E,null);}}
  function postAction(force=true){let changed=false,c=Q.tryComplete(state);while(c){changed=true;T.show(`✅ Görev: ${c.desc}<br><span class="toast-reward">${c.rewardText}</span>`,'success');c=Q.tryComplete(state);}const achievements=Q.checkAchievements(state);achievements.forEach(a=>T.show(`🏆 ${a.desc}`,'achievement'));if(achievements.length)changed=true;if(force||changed)refreshAll();}
  function tryOpenSector(sx,sy){if(E.openSector(state,sx,sy)){T.show(`🧭 Sektör taraması başladı: ${sx},${sy}`,'success');S.save(state);postAction();}else T.show('Komşu sektör, tarama modülü veya malzemeler yetersiz','error');}

  // Sekmeler
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{UI.switchTab(b.dataset.tab);if(b.dataset.tab==='galaxy')UI.renderGalaxy(state,E);if(b.dataset.tab==='combat')CUI?.render(state,E);if(b.dataset.tab==='report')UI.renderReport(state,E);if(b.dataset.tab==='factory')setTimeout(()=>FC.resize(),20);}));

  // Canvas araçları
  document.querySelectorAll('.fx-tool[data-mode]').forEach(b=>b.addEventListener('click',()=>FC.setMode(b.dataset.mode)));
  UI.el('fx-zoomin').addEventListener('click',()=>FC.zoomBy(1.2));UI.el('fx-zoomout').addEventListener('click',()=>FC.zoomBy(1/1.2));UI.el('fx-recenter').addEventListener('click',()=>FC.recenter());
  UI.el('fx-build-toggle').addEventListener('click',()=>UI.el('fx-palette').classList.toggle('hidden'));UI.el('fx-palette-close').addEventListener('click',()=>UI.el('fx-palette').classList.add('hidden'));
  document.querySelectorAll('[data-ptab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-ptab]').forEach(x=>x.classList.toggle('active',x===b));UI.el('fx-palette-machines').classList.toggle('hidden',b.dataset.ptab!=='machines');UI.el('fx-palette-plants').classList.toggle('hidden',b.dataset.ptab!=='plants');}));
  UI.el('fx-palette').addEventListener('click',ev=>{const b=ev.target.closest('[data-place]');if(!b)return;FC.setMode('place',b.dataset.place,b.dataset.ptype);UI.el('fx-palette').classList.add('hidden');});
  UI.el('fx-inspector').addEventListener('click',ev=>{
    if(ev.target.id==='fxi-close'){selectedEntityId=null;UI.showInspector(state,E,null);return;}
    const nodeBuild=ev.target.closest('[data-build-node]');if(nodeBuild){FC.setMode('place',nodeBuild.dataset.buildNode,'machine');T.show('⛏️ Aynı kaynak yatağına dokunarak çıkarıcıyı yerleştir','info');UI.showInspector(state,E,null);return;}
    const b=ev.target.closest('[data-fxi]'),ent=state.grid.entities[UI.el('fx-inspector').dataset.entity];if(!b||!ent)return;
    if(b.dataset.fxi==='run'){const g=E.manualClick(state,ent.defId),ok=N.gt?N.gt(g,0):Number(g)>0;T.show(ok?`▶ +${N.format(g)} üretildi`:'Girdi veya depo yetersiz',ok?'success':'info');}
    if(b.dataset.fxi==='automation'){if(E.upgradeAutomation(state,ent.defId)){const lv=E.automationLevel(state,ent.defId);T.show(`🧠 Otomasyon çekirdeği Seviye ${lv} oldu`,'success');}else T.show('Teknoloji, kredi veya otomasyon malzemeleri yetersiz','error');}
    if(b.dataset.fxi==='upgrade'){if(E.doUpgradeClass(state,ent.defId,ent.type))T.show(`⬆ ${ent.type==='plant'?E.pDef(ent.defId).name:E.mDef(ent.defId).name} yükseltildi`,'success');else T.show('Teknoloji, malzeme veya kredi yetersiz','error');}
    if(b.dataset.fxi==='info'&&ent.type==='machine'){const out=Object.keys(E.mDef(ent.defId).recipe.out)[0];UI.showItemInfo(state,E,out);}
    S.save(state);postAction();
  });

  UI.el('land-expand-btn').addEventListener('click',()=>{const x=E.openableSectors(state)[0];if(x)tryOpenSector(x.sx,x.sy);});

  // Güç paneli
  UI.el('plants-container').addEventListener('click',ev=>{const build=ev.target.closest('[data-buildplant]'),up=ev.target.closest('[data-upgradeplant]');if(build){const id=build.dataset.buildplant;T.show('Santrali gezegen yüzeyindeki İnşa paletinden yerleştir','info');FC.setMode('place',id,'plant');UI.switchTab('factory');}if(up){if(E.doUpgradeClass(state,up.dataset.upgradeplant,'plant'))T.show('⚡ Santral sınıfı yükseltildi','success');else T.show('Teknoloji veya kaynak yetersiz','error');S.save(state);postAction();}});

  // Depo
  UI.el('inventory-list').addEventListener('click',ev=>{
    const info=ev.target.closest('[data-info]'),auto=ev.target.closest('[data-auto]'),stor=ev.target.closest('[data-stor]'),keep=ev.target.closest('[data-keep]');
    if(info)UI.showItemInfo(state,E,info.dataset.info);
    else if(auto)E.toggleAutoSell(state,auto.dataset.auto);
    else if(stor){if(E.upgradeStorage(state,stor.dataset.stor))T.show('📦 Depo kapasitesi büyüdü','success');else T.show('Kredi yetersiz','error');}
    else if(keep)E.setAutoSellKeep(state,keep.dataset.keep,Number(keep.dataset.pct));
    else return;S.save(state);refreshAll();
  });
  UI.el('inventory-list').addEventListener('change',()=>UI.render(state,E));
  UI.el('bulk-selall').addEventListener('change',ev=>{Object.keys(D.items).forEach(id=>{const c=UI.el(`check-${id}`);if(c&&!c.disabled)c.checked=ev.target.checked;});UI.render(state,E);});
  document.querySelectorAll('[data-bulksell]').forEach(b=>b.addEventListener('click',()=>T.show('Yerel satış kapalı; Pazar Uydusu kullanılıyor.','info')));
  UI.el('market-master').addEventListener('click',()=>{if(!state.researched.marketNetworkMk1){T.show('Önce Pazar Ağı Mk I araştırılmalı','info');return;}state.market.enabled=!state.market.enabled;if(state.market.enabled&&!state.market.nextDispatchAt)state.market.nextDispatchAt=Date.now()+E.marketCooldownSec(state)*1000;S.save(state);refreshAll();});
  document.querySelectorAll('[data-globalkeep]').forEach(b=>b.addEventListener('click',()=>{E.setGlobalMarketKeep(state,Number(b.dataset.globalkeep));T.show(`🛰️ Tüm ürünlerde elde tutma %${b.dataset.globalkeep}`,'success');S.save(state);refreshAll();}));
  UI.el('market-all-on').addEventListener('click',()=>{const sellables=Object.keys(D.items).filter(k=>!D.items[k].research&&D.items[k].sell>0),allOn=sellables.every(k=>state.autoSell[k]);E.setAllAutoSell(state,!allOn);T.show(allOn?'Tüm ürünlerin uydu satışı kapatıldı':'Tüm ürünlerin uydu satışı açıldı','success');S.save(state);refreshAll();});
  UI.el('market-upgrade').addEventListener('click',()=>{const action=UI.el('market-upgrade').dataset.action;let ok=false;if(action==='prototype')ok=E.queueSatellite(state,'prototypeMarketSatellite',1);else if(action==='satellite')ok=E.queueSatellite(state,'marketSatellite',1);else if(action==='upgrade')ok=E.upgradeMarket(state);if(ok)T.show(action==='prototype'?'🚀 Prototip Pazar Uydusu fırlatma kuyruğuna alındı':action==='satellite'?'🛰️ Yeni Pazar Uydusu üretime alındı':'📈 Pazar ağı geliştirildi','success');else T.show('Araştırma, kapasite, kredi veya malzeme yetersiz','error');S.save(state);postAction();});
  UI.el('founding-contracts')?.addEventListener('click',ev=>{const b=ev.target.closest('[data-contract]');if(!b)return;if(E.startFoundingContract(state,b.dataset.contract))T.show('📦 Kuruluş sevkiyatı yola çıktı','success');else T.show('Önceki sözleşme, Mk 0 uydu veya ürünler eksik','error');S.save(state);postAction();});
  UI.el('ticker-toggle')?.addEventListener('click',()=>UI.el('live-ticker')?.classList.toggle('collapsed'));

  // Araştırma — maliyet başta ayrılır, laboratuvar süresi sonunda tamamlanır.
  UI.el('research-list').addEventListener('click',ev=>{const b=ev.target.closest('[data-research]');if(!b)return;const t=D.research.find(x=>x.id===b.dataset.research),queued=!!state.researchProgress.active;if(E.doResearch(state,b.dataset.research)){T.show(`🔬 ${t.name} ${queued?'araştırma kuyruğuna alındı':'başlatıldı'}`,'success');}else T.show(E.researchMissing(state,b.dataset.research).slice(0,3).join(' · ')||'Araştırma şartları yetersiz','error');S.save(state);postAction();});
  UI.el('repeat-research-list').addEventListener('click',ev=>{const b=ev.target.closest('[data-repeat]');if(!b)return;const t=D.repeatableResearch.find(x=>x.id===b.dataset.repeat),queued=!!state.researchProgress.active;if(E.doRepeatResearch(state,b.dataset.repeat))T.show(`♾️ ${t.name} ${queued?'kuyruğa alındı':'başlatıldı'}`,'success');else T.show(E.repeatMissing(state,b.dataset.repeat).slice(0,3).join(' · ')||'Araştırma şartları yetersiz','error');S.save(state);postAction();});
  UI.el('research-active').addEventListener('click',ev=>{if(ev.target.id!=='cancel-research')return;if(!confirm('Aktif araştırma iptal edilsin mi? Harcananların %70’i iade edilir.'))return;if(E.cancelResearch(state)){T.show('Araştırma iptal edildi · %70 iade yapıldı','info');S.save(state);refreshAll();}});

  // Galaksi
  UI.el('scan-system').addEventListener('click',()=>{const t=E.scanNextTarget(state);if(t)T.show(`🔭 ${t.name} keşfedildi`,'success');else T.show('Tarayıcı kilitli, beklemede veya kaynak yetersiz','error');S.save(state);postAction();});
  UI.el('shipyard-list').addEventListener('click',ev=>{const sat=ev.target.closest('[data-buildsat]'),b=ev.target.closest('[data-buildship]');if(sat){const id=sat.dataset.buildsat,count=Math.max(1,Number(UI.el(`sat-count-${id}`)?.value)||1);if(E.queueSatellite(state,id,count))T.show(`🛰️ ${count} uydu üretim kuyruğuna alındı`,'success');else T.show('Uydu teknolojisi, yörünge limiti veya malzemeler yetersiz','error');S.save(state);postAction();return;}if(!b)return;const id=b.dataset.buildship,count=Math.max(1,Number(UI.el(`ship-count-${id}`).value)||1);if(E.queueShip(state,id,count))T.show(`🚀 ${count} gemi üretim kuyruğuna alındı`,'success');else T.show('Gemi teknolojisi veya malzemeler yetersiz','error');S.save(state);postAction();});
  UI.el('defense-list').addEventListener('click',ev=>{const b=ev.target.closest('[data-builddef]');if(!b)return;const id=b.dataset.builddef,count=Math.max(1,Number(UI.el(`def-count-${id}`).value)||1);if(E.buildDefense(state,id,count))T.show(`🛡️ ${count} savunma birimi kuruldu`,'success');else T.show('Savunma teknolojisi veya malzemeler yetersiz','error');S.save(state);postAction();});
  UI.el('target-list').addEventListener('click',ev=>{const spy=ev.target.closest('[data-spy]'),attack=ev.target.closest('[data-attack]'),col=ev.target.closest('[data-colonize]');if(spy){if(E.spyTarget(state,spy.dataset.spy))T.show('📡 Casusluk raporu hazır','success');else T.show('Casus sondası, yıldız yakıtı veya tarayıcı yetersiz','error');S.save(state);postAction();return;}if(attack)UI.renderFleetModal(state,E,E.targetById(state,attack.dataset.attack));if(col){if(E.colonizeTarget(state,col.dataset.colonize))T.show('🪐 Yeni koloni kuruldu · üretim +%4','success');else T.show('Koloni teknolojisi veya kaynaklar yetersiz','error');S.save(state);postAction();}});
  UI.el('fleet-body').addEventListener('input',()=>{const target=E.targetById(state,UI.el('fleet-modal').dataset.target),sel=UI.fleetSelection(),fs=E.fleetStats(sel,state),fuel=fs.fuel*(target?.distance||0),sec=target?E.travelSeconds(state,target,sel):0;UI.el('fleet-preview').textContent=fs.total?`Filo gücü ${N.format(fs.attack*E.weaponMult(state))} · Gövde ${N.format(fs.hull*E.shieldMult(state))} · Yakıt ${N.format(fuel)} · Varış ${N.formatTime(sec)}`:'Gemi seçilmedi.';});
  UI.el('fleet-send').addEventListener('click',()=>{const target=UI.el('fleet-modal').dataset.target,sel=UI.fleetSelection();if(E.sendFleet(state,target,sel)){T.show('⚔️ Saldırı filosu yola çıktı','success');UI.hideModal('fleet-modal');}else T.show('Gemi, yıldız yakıtı veya filo komutası yetersiz','error');S.save(state);postAction();});

  // Savaş raporları ve bakım merkezi
  document.addEventListener('click',ev=>{
    const go=ev.target.closest('[data-go-combat]');if(go){UI.switchTab('combat');CUI?.render(state,E);return;}
    const f=ev.target.closest('[data-report-filter]');if(f){CUI?.setFilter(f.dataset.reportFilter);CUI?.renderReports(state,E);return;}
    const ro=ev.target.closest('[data-report-open]');if(ro){CUI?.renderReportDetail(state,E,ro.dataset.reportOpen);return;}
    const fu=ev.target.closest('[data-facility-upgrade]');if(fu){if(E.upgradeFacility(state,fu.dataset.facilityUpgrade))T.show('🛠️ Bakım tesisi geliştirildi','success');else T.show('Teknoloji, kredi veya malzeme yetersiz','error');S.save(state);CUI?.render(state,E);refreshAll();return;}
    const rz=ev.target.closest('[data-repair-zone]'),rs=ev.target.closest('[data-repair-ship]'),rd=ev.target.closest('[data-repair-defense]');
    if(rz||rs||rd){const kind=rz?'zone':rs?'ship':'defense',node=rz||rs||rd,id=rz?.dataset.repairZone||rs?.dataset.repairShip||rd?.dataset.repairDefense,amount=Number(node.dataset.amount)||1;if(E.queueRepair(state,kind,id,amount))T.show('🧰 Tamirat kuyruğa alındı','success');else T.show('Bakım tesisi veya tamir malzemeleri yetersiz','error');S.save(state);CUI?.render(state,E);refreshAll();}
  });

  // Modallar / ayarlar
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>UI.hideModal(b.dataset.close)));
  function rebuildForState(){firstRun=!S.currentProfile();FC.setState(state);applyTheme(state.settings.theme||'dark');UI.buildInventory(state,E);UI.buildResearch(state,E);UI.buildPlantCards(state,E);UI.buildPalette(state,E);selectedEntityId=null;UI.showInspector(state,E,null);refreshAll();}
  function renderProfiles(){const active=S.currentProfileId(),list=S.listProfiles();UI.el('profile-list').innerHTML=list.map(p=>`<article class="profile-row ${p.id===active?'active':''}"><div><b>👤 ${p.name}</b><small>${p.empireName||''} · Son oyun ${new Date(p.lastPlayedAt||p.createdAt).toLocaleString('tr-TR')}</small></div><div>${p.id===active?'<span class="badge">Aktif</span>':`<button class="btn-setting compact" data-profile-switch="${p.id}">Geç</button>`}<button class="btn-danger compact" data-profile-delete="${p.id}" data-profile-name="${p.name.replace(/"/g,'&quot;')}">Sil</button></div></article>`).join('');UI.el('active-profile-name').textContent=activeName();}
  function switchProfile(id){S.save(state);if(!S.selectProfile(id))return;state=S.load()||E.createInitialState();E.applyOfflineProgress(state);rebuildForState();renderProfiles();T.show(`👤 ${activeName()} profiline geçildi`,'success');}
  function completeFirstCommander(){const name=UI.el('first-commander-name').value,r=S.createProfile(name,null,{planetType:UI.el('first-planet-type')?.value||'temperate',startRegion:UI.el('first-start-region')?.value||'center'});if(!r.ok){UI.el('first-commander-error').textContent=r.error;return;}state=r.state;firstRun=false;UI.el('first-commander-error').textContent='';UI.hideModal('commander-onboarding');rebuildForState();S.save(state);T.show(`👤 Hoş geldin Komutan ${r.profile.name}`,'success');}
  UI.el('first-commander-create').addEventListener('click',completeFirstCommander);UI.el('first-commander-name').addEventListener('keydown',ev=>{if(ev.key==='Enter')completeFirstCommander();});
  UI.el('btn-profiles').addEventListener('click',()=>{renderProfiles();UI.showModal('profiles-modal');});
  UI.el('profile-list').addEventListener('click',ev=>{const sw=ev.target.closest('[data-profile-switch]'),del=ev.target.closest('[data-profile-delete]');if(sw)switchProfile(sw.dataset.profileSwitch);if(del){const expected=del.dataset.profileName,typed=prompt(`“${expected}” profilini kalıcı silmek için komutan adını yaz:`);if(typed!==expected){if(typed!==null)T.show('Profil adı eşleşmedi; silinmedi.','error');return;}const wasActive=del.dataset.profileDelete===S.currentProfileId();S.deleteProfile(del.dataset.profileDelete);S.bootstrap();if(wasActive){state=S.load()||E.createInitialState();rebuildForState();if(!S.currentProfile())UI.showModal('commander-onboarding');}renderProfiles();T.show('Profil kalıcı olarak silindi','info');}});
  UI.el('create-profile').addEventListener('click',()=>{S.save(state);const r=S.createProfile(UI.el('new-profile-name').value);if(!r.ok){T.show(r.error,'error');return;}state=r.state;UI.el('new-profile-name').value='';rebuildForState();renderProfiles();T.show(`👤 ${r.profile.name} profili oluşturuldu`,'success');});
  UI.el('btn-achievements').addEventListener('click',()=>{UI.renderAchievements(state);UI.showModal('ach-modal');});UI.el('btn-settings').addEventListener('click',()=>{UI.el('export-code').value='';UI.el('reset-confirm-text').value='';UI.el('do-reset').disabled=true;UI.showModal('settings-modal');});
  UI.el('theme-toggle').addEventListener('click',()=>{state.settings.theme=state.settings.theme==='dark'?'light':'dark';applyTheme(state.settings.theme);S.save(state);});
  UI.el('do-export').addEventListener('click',()=>{UI.el('export-code').value=S.exportString(state);UI.el('export-code').select();T.show('📋 Aktif profil kayıt kodu hazır','info');});
  UI.el('do-import').addEventListener('click',()=>{const r=S.importString(UI.el('import-code').value);if(!r.ok){T.show('❌ '+r.error,'error');return;}if(!confirm('Aktif profil kaydı değiştirilecek. Devam?'))return;state=r.state;S.save(state);rebuildForState();UI.hideModal('settings-modal');T.show('✅ Kayıt aktif profile yüklendi','success');});
  UI.el('reset-confirm-text').addEventListener('input',ev=>UI.el('do-reset').disabled=ev.target.value.trim().toLocaleUpperCase('tr-TR')!=='SIFIRLA');
  UI.el('do-reset').addEventListener('click',()=>{if(UI.el('reset-confirm-text').value.trim().toLocaleUpperCase('tr-TR')!=='SIFIRLA')return;if(!confirm('SON ONAY: Aktif profil yeni oyun durumuna döndürülecek. Bu işlem geri alınamaz.'))return;const theme=state.settings.theme;state=S.resetCurrent({theme});rebuildForState();UI.el('reset-confirm-text').value='';UI.el('do-reset').disabled=true;UI.hideModal('settings-modal');T.show('🧹 Aktif profil tamamen sıfırlandı','success');});
  function applyTheme(t){document.documentElement.setAttribute('data-theme',t);const b=UI.el('theme-toggle');if(b)b.textContent=t==='dark'?'☀️ Açık tema':'🌙 Koyu tema';FC?.refreshTheme?.();}

  let last=performance.now(),check=0;
  setInterval(()=>{const now=performance.now(),dt=Math.min(1,(now-last)/1000);last=now;if(firstRun)return;const before=Object.keys(state.researched).length+Object.values(state.repeatResearch).reduce((a,b)=>a+b,0);E.tick(state,dt);const after=Object.keys(state.researched).length+Object.values(state.repeatResearch).reduce((a,b)=>a+b,0);if(after>before){T.show('🔬 Araştırma tamamlandı; yeni teknoloji etkinleştirildi','success');UI.buildPalette(state,E);UI.buildResearch(state,E);S.save(state);}UI.render(state,E);check+=dt;if(check>=.75){check=0;postAction(false);}},D.economyConfig.tickIntervalMs);
  setInterval(()=>{if(!firstRun)S.save(state);},D.economyConfig.autosaveIntervalMs);window.addEventListener('beforeunload',()=>{if(!firstRun)S.save(state);});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&!firstRun)S.save(state);});
  window.__axyon={get state(){return state;},E,S,Q,UI};
})();
