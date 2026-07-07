/** Axyon.HelpSystem — masaüstü hover, mobil uzun basma ve canvas öğe bilgisi. */
(function(global){
  const D=global.Axyon.Data,N=global.Axyon.Numbers;
  let getState=()=>null,getEconomy=()=>null,hoverTimer=null,longTimer=null,current=null,longStart=null,suppressTarget=null,suppressClickUntil=0;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtCost=o=>Object.entries(o||{}).map(([k,v])=>`${D.items[k]?.icon||''} ${N.format(v)} ${D.items[k]?.name||k}`).join(' · ')||'Yok';
  const roman=n=>['0','I','II','III','IV','V'][n]||n;
  const uiHelp={
    encyclopedia:{title:'Teknoloji ve Makine Ansiklopedisi',icon:'📚',desc:'Bütün teknoloji, makine, santral, ürün, gemi ve gereksinim ağacını canlı oyun verisinden gösterir.'},
    profiles:{title:'Komutan Profilleri',icon:'👤',desc:'Bu cihazda birbirinden tamamen ayrı yerel oyun hesapları oluşturur, değiştirir veya siler. Sunucu hesabı değildir.'},
    achievements:{title:'Başarımlar',icon:'🏆',desc:'İmparatorluk boyunca tamamladığın kalıcı hedefleri gösterir.'},
    settings:{title:'Ayarlar',icon:'⚙️',desc:'Tema, kayıt dışa/içe aktarma ve tam ilerleme sıfırlama işlemleri.'},
    factory:{title:'Fabrika',icon:'🏭',desc:'Makineleri, santralleri, konveyörleri ve enerji hatlarını 300×300 gezegen yüzeyinde kur.'},
    report:{title:'Üretim Raporu',icon:'📊',desc:'Üretim hatlarını, otomasyon durumunu, darboğazları ve enerji tüketimini gör.'},
    power:{title:'Güç Şebekesi',icon:'⚡',desc:'Santralleri kur ve yükselt. Güç yetersizliği otomatik üretimi orantılı biçimde yavaşlatır.'},
    research:{title:'Teknoloji',icon:'🔬',desc:'Araştırmalar süre, laboratuvar seviyesi, kredi, malzeme ve altyapı şartı ister. Harcananlar araştırma başlarken ayrılır.'},
    storage:{title:'Depo ve Pazar',icon:'📦',desc:'Stokları yönet, yerel satış yap veya Pazar Uydusuyla süreli ve kotalı toplu sevkiyat oluştur.'},
    galaxy:{title:'Galaktik Cephe',icon:'🌌',desc:'Sistem tara, gemi ve savunma üret, rakip dünyalarla savaş ve koloniler kur.'},
    coins:{title:'Kredi',icon:'🪙',desc:'İnşa, araştırma, bölge açma, tarama ve ticari geliştirmelerde kullanılan ana para birimi.'},
    productionMultiplier:{title:'Üretim Çarpanı',icon:'⚙️',desc:'Bina seviyeleri, koloniler ve sonsuz araştırmaların toplam üretim etkisi.'},
    threat:{title:'Gezegen Tehdidi',icon:'☠️',desc:'Açılan bölgeler ve savaş faaliyetleri tehdidi artırır. Daha güçlü uzaylı baskınları doğurur.'},
    fleet:{title:'Filo Mevcudu',icon:'🚀',desc:'Hangarda bulunan toplam gemi sayısıdır. Görevdeki gemiler bu sayıya dönene kadar kullanılamaz.'},
    score:{title:'İmparatorluk Puanı',icon:'🏅',desc:'Ekonomi, araştırma, binalar, filo, bölgeler ve zaferlerden hesaplanan genel ilerleme puanı.'},
    quest:{title:'Aktif Görev',icon:'✅',desc:'Yeni sistemleri öğrenirken ek kredi veya araştırma verisi kazandıran kısa hedef.'},
    marketAuto:{title:'Pazar Uydusu AUTO',icon:'🛰️',desc:'Açık olduğunda seçili ürünlerin koruma oranını aşan kısmı, uydu kotası ve sefer süresine göre satılır.'},
    keepRatio:{title:'Elde Tutma Oranı',icon:'📦',desc:'Depoda korunacak yüzdeyi belirler. Yalnızca bu oranın üstündeki stok uydu satışına gider.'},
    localSell:{title:'Yerel Satış',icon:'🪙',desc:'Stokun seçilen bölümünü hemen satar; liste fiyatının %85’ini kazandırır.'},
    storageUpgrade:{title:'Depoyu Geliştir',icon:'⤢',desc:'Bu ürünün azami stok kapasitesini kalıcı olarak artırır.'},
    marketCapacity:{title:'Uydu Sevkiyat Kotası',icon:'📦',desc:'Pazar Uydusunun tek seferde satabileceği toplam ürün adedi.'},
    marketCooldown:{title:'Uydu Sefer Süresi',icon:'⏱️',desc:'İki otomatik sevkiyat arasındaki bekleme süresi. Uydu seviyesiyle kısalır.'},
    marketLast:{title:'Son Uydu Geliri',icon:'🪙',desc:'Tamamlanan son Pazar Uydusu seferinden elde edilen kredi.'},
    marketNext:{title:'Sonraki Sevkiyat',icon:'🛰️',desc:'Bir sonraki otomatik satış seferine kalan süre.'},
    openSector:{title:'Yeni Bölge Aç',icon:'🧭',desc:'Komşu bir 20×20 sektörü kullanıma açar. Maliyet açılan bölge sayısıyla büyür.'},
    factoryCanvas:{title:'Gezegen Yüzeyi',icon:'🗺️',desc:'Boş alanı sürükleyerek kamerayı taşı. Yapıya dokunarak seç; masaüstünde bekle veya mobilde basılı tutarak ayrıntısını aç.'},
    selectTool:{title:'Seç ve Taşı',icon:'✋',desc:'Yapıları seçer ve sürükleyerek taşır. Boş alanı sürüklemek kamerayı kaydırır.'},
    conveyorTool:{title:'Konveyör Bağlantısı',icon:'🔗',desc:'Önce kaynak makineyi, sonra hedef makineyi seçerek üretim hattı ilişkisi kurar.'},
    powerTool:{title:'Enerji Hattı',icon:'⚡',desc:'Santralden makineye enerji bağlantısı çeker. Bağlantısız otomatik makineler çalışmaz.'},
    deleteTool:{title:'Silme Aracı',icon:'🗑️',desc:'Yapı veya bağlantıyı kaldırır. Yapı maliyetinin tamamı geri verilmez.'},
    buildTool:{title:'İnşa Paleti',icon:'🏗️',desc:'Açılmış teknolojiye göre kurulabilir makine ve santralleri listeler.'},
    zoomIn:{title:'Yakınlaştır',icon:'＋',desc:'Gezegen yüzeyine yaklaşır.'},zoomOut:{title:'Uzaklaştır',icon:'−',desc:'Gezegen yüzeyinden uzaklaşır.'},recenter:{title:'Merkezle',icon:'⊙',desc:'Kamerayı başlangıç üretim bölgesine geri getirir.'},
    scan:{title:'Sistem Tara',icon:'🔭',desc:'Kredi ve işlemci harcayarak yeni yıldız sistemi veya rakip dünya keşfeder.'},
    marketAll:{title:'Tüm Ürünleri Aç/Kapat',icon:'🛰️',desc:'Satılabilir bütün ürünlerin uydu satış iznini tek hareketle değiştirir.'},
    marketUpgrade:{title:'Pazar Uydusunu Geliştir',icon:'⬆️',desc:'Sevkiyat kotasını büyütür ve sefer süresini kısaltır.'},
    researchActive:{title:'Araştırma Kuyruğu',icon:'🔬',desc:'Etkin araştırmanın ilerlemesini ve sırada bekleyen teknolojileri gösterir. İptalde harcananların %70’i iade edilir.'},
    raidTimer:{title:'Uzaylı Baskını',icon:'👾',desc:'Bir sonraki saldırıya kalan hazırlık süresi. Savunma birimleri ve mühimmat baskın gücünü karşılar.'},
    shipQueue:{title:'Tersane Kuyruğu',icon:'🏗️',desc:'Üretime alınan gemiler süre sonunda hangara eklenir.'},
    missions:{title:'Aktif Filo Görevleri',icon:'🛰️',desc:'Gidiş, savaş ve dönüş aşamasındaki filoları gösterir.'},
    battleReports:{title:'Savaş Raporları',icon:'📡',desc:'Filo sonuçları, kayıplar, ganimetler ve baskın sonuçlarının kayıtları.'},
    liveTicker:{title:'Canlı Cephe Akışı',icon:'📡',desc:'Üstte en fazla 5 satırda uydu sevkiyatı, giden/dönen filo, tersane üretimi, baskın ve son rapor sürelerini gösterir.'},
    marketSatellites:{title:'Pazar Uydu Sayısı',icon:'🛰️',desc:'Her Pazar Uydusu filo/yörünge kapasitesi tüketir. Her Mk seviyesi 3 uydu hakkı açar; toplam sınır 9’dur.'}
  };
  function machineHtml(d,s,E){const lv=E.machineLevel(s,d.id),ins=Object.entries(d.recipe.in||{}),outs=Object.entries(d.recipe.out||{});return `<p>${esc(d.name)}, otomasyon zincirinin ${d.tier+1}. üretim aşamasındadır.</p><div class="help-grid"><span>Üretir<b>${outs.map(([k,v])=>`${D.items[k].icon} ${v} ${D.items[k].name}`).join(', ')}</b></span><span>Tüketir<b>${ins.length?ins.map(([k,v])=>`${D.items[k].icon} ${v} ${D.items[k].name}`).join(', '):'Uygun kaynak yatağı'}</b></span><span>Güç<b>${N.format(E.machinePowerDemand(s,d.id))} kW</b></span><span>Mevcut sınıf<b>Mk ${roman(lv)} · ${s.machines[d.id].count} adet</b></span><span>Kurulum<b>${N.format(E.buildCost(s,d.id))}🪙</b></span><span>Otomasyon<b>${N.format(d.managerCost)}🪙</b></span></div><p class="help-note">Açan teknoloji: <b>${D.research.find(x=>x.id===d.tech)?.name||'Başlangıçta açık'}</b></p>`;}
  function plantHtml(d,s,E){return `<p>${esc(d.name)} enerji şebekesine güç sağlar.</p><div class="help-grid"><span>Üretim<b>${N.format(E.plantOutput(s,d.id))} kW</b></span><span>Yakıt<b>${d.fuel?`${D.items[d.fuel.item].icon} ${d.fuel.rate}/sn ${D.items[d.fuel.item].name}`:'Yakıt gerektirmez'}</b></span><span>Sınıf<b>Mk ${roman(E.plantLevel(s,d.id))}</b></span><span>Kurulum<b>${N.format(E.plantBuildCost(s,d.id))}🪙</b></span></div>`;}
  function itemHtml(id,s,E){const x=E.itemInfo(s,id);return `<p>${esc(x.desc)}</p><div class="help-grid"><span>Stok<b>${N.format(x.amount)} / ${N.format(x.cap)}</b></span><span>Akış<b>${x.flow>=0?'+':''}${N.format(x.flow)}/sn</b></span><span>Liste değeri<b>${x.research?'Satılmaz':`${x.sell}🪙`}</b></span><span>Katman<b>${x.tier}</b></span></div><p><b>Üreten/Kazanılan:</b> ${esc([...x.producers,...(D.items[id].externalSource?[D.items[id].externalSource]:[])].join(', ')||'Yok')}</p><p><b>Kullanan:</b> ${esc([...x.consumers,...x.fuelFor].join(', ')||'Yok')}</p>`;}
  function researchHtml(t,s,E){const miss=E.researchMissing(s,t.id),lab=D.machines.find(x=>x.id===t.lab);return `<p>${esc(t.desc)}</p><div class="help-grid"><span>Çağ<b>${D.eraLabels[t.era]}</b></span><span>Temel süre<b>${N.formatTime(t.durationSec)}</b></span><span>Laboratuvar<b>${lab?.name||'—'} Mk ${t.labLevel}</b></span><span>Kredi<b>${N.format(t.coins)}🪙</b></span></div><p><b>Malzemeler:</b> ${fmtCost(t.cost)}</p><p><b>Önkoşullar:</b> ${(t.prereq||[]).map(id=>D.research.find(x=>x.id===id)?.name).join(', ')||'Yok'}</p>${miss.length?`<p class="help-warning"><b>Eksikler:</b> ${esc(miss.join(' · '))}</p>`:'<p class="help-ok">Başlatılabilir.</p>'}`;}
  function shipHtml(d,s){return `<p>${d.name}, filo seferlerinde kullanılan savaş aracıdır.</p><div class="help-grid"><span>Saldırı<b>${N.format(d.attack)}</b></span><span>Gövde<b>${N.format(d.hull)}</b></span><span>Hız<b>${d.speed}</b></span><span>Yakıt/LY<b>${d.fuel}</b></span><span>Hangar<b>${s.galaxy.ships[d.id]||0}</b></span><span>Üretim süresi<b>${N.formatTime(d.buildSec)}</b></span></div><p><b>Maliyet:</b> ${fmtCost(d.cost)}</p>`;}
  function defenseHtml(d,s){return `<p>${d.name}, yaklaşan uzaylı saldırılarında gezegen savunmasına katılır.</p><div class="help-grid"><span>Saldırı<b>${N.format(d.attack)}</b></span><span>Dayanıklılık<b>${N.format(d.hull)}</b></span><span>Kurulu<b>${s.galaxy.defenses[d.id]||0}</b></span></div><p><b>Maliyet:</b> ${fmtCost(d.cost)}</p>`;}
  function targetHtml(id,s){const t=(s.galaxy.targets||[]).find(x=>x.id===id)||D.galaxyTargets.find(x=>x.id===id);if(!t)return null;return `<p>${esc(t.type)} sınıfı galaktik hedef. Filo gönderildiğinde sonuç saldırı, gövde, teknoloji bonusları ve hedef gücüyle hesaplanır.</p><div class="help-grid"><span>Mesafe<b>${t.distance} LY</b></span><span>Güç<b>${N.format(t.strength)}</b></span><span>Tehdit<b>Seviye ${t.threat}</b></span><span>Durum<b>${t.colonized?'Koloni':t.defeated?'Yenildi':'Düşman'}</b></span></div><p><b>Olası ganimet:</b> ${fmtCost(t.loot)}</p>`;}
  function nodeHtml(id){const n=D.resourceNodes[id],item=D.items[id];if(!n||!item)return null;const miners=D.machines.filter(m=>m.recipe&&m.recipe.out&&m.recipe.out[id]).map(m=>m.name);return `<p>${esc(n.name)}, yalnızca açık sektörlerde kullanılabilen doğal kaynak alanıdır.</p><div class="help-grid"><span>Kaynak<b>${item.icon} ${item.name}</b></span><span>Nadirlik<b>${n.rarity}</b></span><span>Çıkaran yapı<b>${esc(miners.join(', ')||'Yok')}</b></span><span>Satış değeri<b>${item.sell?item.sell+'🪙':'Satılmaz'}</b></span></div>`;}
  function resolve(key){const [type,id]=String(key||'').split(':'),s=getState(),E=getEconomy();if(!s||!E)return null;
    if(type==='ui'){const h=uiHelp[id];return h&&{title:h.title,icon:h.icon,html:`<p>${h.desc}</p>`};}
    if(type==='item'&&D.items[id])return {title:D.items[id].name,icon:D.items[id].icon,html:itemHtml(id,s,E)};
    if(type==='machine'){const d=D.machines.find(x=>x.id===id);return d&&{title:d.name,icon:d.icon,html:machineHtml(d,s,E)};}
    if(type==='plant'){const d=D.powerPlants.find(x=>x.id===id);return d&&{title:d.name,icon:d.icon,html:plantHtml(d,s,E)};}
    if(type==='research'){const d=D.research.find(x=>x.id===id);return d&&{title:d.name,icon:d.icon,html:researchHtml(d,s,E)};}
    if(type==='repeat'){const d=D.repeatableResearch.find(x=>x.id===id);if(!d)return null;const cost=E.repeatCost(s,id),miss=E.repeatMissing(s,id);return {title:d.name,icon:d.icon,html:`<p>${esc(d.desc)}</p><div class="help-grid"><span>Seviye<b>${s.repeatResearch[id]||0}</b></span><span>Süre<b>${N.formatTime(E.repeatDuration(s,id))}</b></span><span>Maliyet büyümesi<b>×${d.growth}</b></span><span>Laboratuvar<b>Omega İstasyonu</b></span></div><p><b>Maliyet:</b> ${fmtCost(cost)}</p>${miss.length?`<p class="help-warning"><b>Eksikler:</b> ${esc(miss.join(' · '))}</p>`:'<p class="help-ok">Başlatılabilir.</p>'}`};}
    if(type==='ship'){const d=D.ships.find(x=>x.id===id);return d&&{title:d.name,icon:d.icon,html:shipHtml(d,s)};}
    if(type==='defense'){const d=D.defenses.find(x=>x.id===id);return d&&{title:d.name,icon:d.icon,html:defenseHtml(d,s)};}
    if(type==='target'){const t=(s.galaxy.targets||[]).find(x=>x.id===id)||D.galaxyTargets.find(x=>x.id===id),html=targetHtml(id,s);return t&&html&&{title:t.name,icon:t.colonized?'🪐':'☠️',html};}
    if(type==='node'){const n=D.resourceNodes[id],html=nodeHtml(id);return n&&html&&{title:n.name,icon:n.icon,html};}
    return null;
  }
  function ensure(){if($('help-popover'))return;document.body.insertAdjacentHTML('beforeend','<aside id="help-popover" class="help-popover hidden" role="tooltip"><div class="help-pop-head"><b id="help-pop-title"></b><span>ⓘ</span></div><div id="help-pop-body"></div><small>Mobilde basılı tut · masaüstünde Alt+tıkla</small></aside><div id="help-modal" class="modal hidden"><div class="modal-card help-modal-card"><div class="modal-head"><h2 id="help-modal-title"></h2><button class="x" data-help-close>✕</button></div><div id="help-modal-body" class="help-modal-body"></div></div></div>');}
  function fill(info,modal){ensure();$(modal?'help-modal-title':'help-pop-title').textContent=`${info.icon||'ⓘ'} ${info.title}`;$(modal?'help-modal-body':'help-pop-body').innerHTML=info.html;}
  function position(pop,target){const r=target.getBoundingClientRect(),pad=12,w=Math.min(390,innerWidth-24);pop.style.width=w+'px';let left=Math.min(innerWidth-w-pad,Math.max(pad,r.left+r.width/2-w/2)),top=r.bottom+10;if(top+pop.offsetHeight>innerHeight-pad)top=Math.max(pad,r.top-pop.offsetHeight-10);pop.style.left=left+'px';pop.style.top=top+'px';}
  function positionAt(pop,x,y){const pad=12,w=Math.min(390,innerWidth-24);pop.style.width=w+'px';let left=Math.min(innerWidth-w-pad,Math.max(pad,x+12)),top=Math.min(innerHeight-pop.offsetHeight-pad,Math.max(pad,y+12));pop.style.left=left+'px';pop.style.top=top+'px';}
  function show(target){const info=resolve(target.dataset.help);if(!info)return;current={target,info};fill(info,false);const pop=$('help-popover');pop.classList.remove('hidden');requestAnimationFrame(()=>position(pop,target));}
  function showKeyAt(key,x,y){const info=resolve(key);if(!info)return false;current={key,info};fill(info,false);const pop=$('help-popover');pop.classList.remove('hidden');requestAnimationFrame(()=>positionAt(pop,x,y));return true;}
  function hide(){clearTimeout(hoverTimer);const p=$('help-popover');if(p)p.classList.add('hidden');current=null;}
  function openKey(key){const info=resolve(key);if(!info)return false;fill(info,true);$('help-modal').classList.remove('hidden');hide();return true;}
  function openModal(target){return openKey(target.dataset.help);}
  function init(stateGetter,economyGetter){getState=stateGetter;getEconomy=economyGetter;ensure();
    document.addEventListener('pointerover',e=>{if(e.target.tagName==='CANVAS')return;const t=e.target.closest('[data-help]');if(!t||e.pointerType==='touch')return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>show(t),450);});
    document.addEventListener('pointerout',e=>{if(e.target.tagName==='CANVAS')return;const t=e.target.closest('[data-help]');if(!t)return;const next=e.relatedTarget&&e.relatedTarget.closest?.('[data-help]');if(next===t)return;hide();});
    document.addEventListener('pointerdown',e=>{if(e.target.tagName==='CANVAS')return;const t=e.target.closest('[data-help]');if(!t||e.pointerType==='mouse')return;clearTimeout(longTimer);longStart={x:e.clientX,y:e.clientY,target:t};longTimer=setTimeout(()=>{suppressTarget=t;suppressClickUntil=Date.now()+900;openModal(t);},650);},{passive:true});
    document.addEventListener('pointermove',e=>{if(longStart&&Math.hypot(e.clientX-longStart.x,e.clientY-longStart.y)>10){clearTimeout(longTimer);longStart=null;}},{passive:true});
    document.addEventListener('pointerup',()=>{clearTimeout(longTimer);longStart=null;},{passive:true});document.addEventListener('pointercancel',()=>{clearTimeout(longTimer);longStart=null;},{passive:true});
    document.addEventListener('click',e=>{if(Date.now()<suppressClickUntil&&suppressTarget&&(e.target===suppressTarget||suppressTarget.contains(e.target))){e.preventDefault();e.stopImmediatePropagation();suppressTarget=null;return;}if(e.target.closest('[data-help-close]'))$('help-modal').classList.add('hidden');const t=e.target.closest('[data-help]');if(t&&e.altKey){e.preventDefault();openModal(t);}},true);window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
  }
  global.Axyon=global.Axyon||{};global.Axyon.HelpSystem={init,resolve,openModal,openKey,showKeyAt,hide};
})(window);
