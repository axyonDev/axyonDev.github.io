(function(){
  'use strict';
  const D=window.Axyon.Data,N=window.Axyon.Numbers,$=id=>document.getElementById(id),roman=n=>['0','I','II','III','IV','V'][n]||n;
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtItems=o=>Object.entries(o||{}).map(([k,v])=>`${D.items[k]?.icon||'❓'} ${N.format(v)} ${D.items[k]?.name||k}`).join(' · ')||'Yok';
  const techName=id=>D.research.find(x=>x.id===id)?.name||id||'Başlangıçta açık';
  const reqText=r=>{const a=[];if(r?.machineTotal)a.push(`${r.machineTotal} toplam makine`);if(r?.sectors)a.push(`${r.sectors} açık bölge`);if(r?.ships)a.push(`${r.ships} gemi`);if(r?.battlesWon)a.push(`${r.battlesWon} zafer`);return a.join(' · ')||'Ek altyapı şartı yok';};
  const sumRepeatSeconds=levels=>D.repeatableResearch.reduce((total,r)=>total+Array.from({length:levels},(_,i)=>r.durationSec*Math.pow(1.22,i)).reduce((a,b)=>a+b,0),0);
  const visibleDefs=()=>D.defenses.filter(d=>!d.hidden);

  function techUnlocks(id){
    const out=[];
    D.machines.filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));
    D.powerPlants.filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));
    D.ships.filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));
    (D.satellites||[]).filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));
    visibleDefs().filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));
    (D.repairFacilities||[]).filter(x=>x.tech===id).forEach(x=>out.push(`${x.icon} ${x.name}`));
    Object.values(D.u3?.infrastructureAssets||{}).filter(x=>x.tech===id).forEach(x=>out.push(`🏗️ ${x.name}`));
    (D.u3?.defenseComplexes||[]).filter(x=>x.technology===id).forEach(x=>out.push(`${x.placement==='orbital'?'🛡️':'🏰'} ${x.name}`));
    Object.entries(D.u3?.upgradeTech||{}).filter(([,tech])=>tech===id).forEach(([kind])=>out.push(kind==='infrastructure'?'🌍 Gezegen Altyapı Kapasitesi':kind==='orbital'?'🛰️ Yörünge Kütle ve Slot Kapasitesi':'🎛️ Filo ve Savunma Komuta Kapasitesi'));
    return [...new Set(out)];
  }

  function summary(){
    const links=D.machines.reduce((n,m)=>n+Object.keys(m.recipe.in).length+Object.keys(m.recipe.out).length,0);
    const mainSeconds=D.research.reduce((n,t)=>n+t.durationSec,0),repeat20=sumRepeatSeconds(20);
    const stats=[
      ['Teknoloji',D.research.length],['Makine',D.machines.length],['Ürün',Object.keys(D.items).length],['Santral',D.powerPlants.length],
      ['Gemi + Uydu',D.ships.length+(D.satellites||[]).length],['Savunma',visibleDefs().length],['Savunma kompleksi',(D.u3?.defenseComplexes||[]).length],
      ['Altyapı tesisi',Object.keys(D.u3?.infrastructureAssets||{}).length],['Tarif bağlantısı',links],['Ana araştırma',N.formatTime(mainSeconds)],['Sonsuz 20 seviye',N.formatTime(repeat20)]
    ];
    $('codex-summary').innerHTML=stats.map(([a,b])=>`<div class="codex-stat"><span>${a}</span><b>${b}</b></div>`).join('');
  }

  function technology(){
    const eras=D.eraOrder.map(era=>`<article class="codex-era searchable" data-search="${era} ${D.eraLabels[era]}"><header>${D.eraLabels[era]}</header><div class="codex-era-list">${D.research.filter(t=>t.era===era).map(t=>{
      const unlocks=techUnlocks(t.id);
      return `<div class="codex-card searchable" data-search="${esc([t.name,t.desc,...t.prereq.map(techName),fmtItems(t.cost),reqText(t.requirements),...unlocks].join(' '))}"><h3>${t.icon} ${t.name}</h3><p>${t.desc}</p><div class="codex-tags"><span class="codex-tag">⏱ ${N.formatTime(t.durationSec)}</span><span class="codex-tag">${Number(t.coins||0)>0?'🪙 '+N.format(t.coins):'🧱 Kaynak tabanlı'}</span><span class="codex-tag">🏢 ${D.machines.find(x=>x.id===t.lab)?.name||t.lab} Mk ${t.labLevel}</span></div><div class="codex-cost">${fmtItems(t.cost)}</div><div class="codex-line"><b>Önkoşul:</b> ${t.prereq.map(techName).join(' → ')||'Yok'}</div><div class="codex-line"><b>Altyapı:</b> ${reqText(t.requirements)}</div><div class="codex-line"><b>Açtıkları:</b> ${unlocks.join(' · ')||'Doğrudan yeni öğe açmaz; zincirde ilerleme sağlar.'}</div></div>`;
    }).join('')}</div></article>`).join('');
    const repeat=`<article class="codex-era codex-repeat-era searchable" data-search="sonsuz omega tekrar araştırma"><header>♾️ Sınırsız Omega Araştırmaları</header><div class="codex-era-list">${D.repeatableResearch.map(r=>{const ten=Array.from({length:10},(_,i)=>r.durationSec*Math.pow(1.22,i)).reduce((a,b)=>a+b,0);return `<div class="codex-card searchable" data-search="${esc([r.name,r.desc,fmtItems(r.base)].join(' '))}"><h3>${r.icon} ${r.name}</h3><p>${r.desc}</p><div class="codex-tags"><span class="codex-tag">İlk süre ${N.formatTime(r.durationSec)}</span><span class="codex-tag">Süre ×1.22/seviye</span><span class="codex-tag">Maliyet ×${r.growth}/seviye</span></div><div class="codex-cost">İlk maliyet: ${fmtItems(r.base)}</div><div class="codex-line"><b>İlk 10 seviye temel süre:</b> ${N.formatTime(ten)}</div></div>`;}).join('')}</div></article>`;
    $('codex-tech').innerHTML=eras+repeat;
  }

  function machines(){
    $('codex-machines').innerHTML=D.machines.map(m=>{const input=fmtItems(m.recipe.in),output=fmtItems(m.recipe.out);return `<article class="codex-card searchable" data-search="${esc([m.name,input,output,techName(m.tech)].join(' '))}"><h3>${m.icon} ${m.name}</h3><div class="recipe-flow"><div class="recipe-box"><b>Girdi</b><br>${input==='Yok'?'Kaynak yatağı':input}</div><span class="recipe-arrow">→</span><div class="recipe-box"><b>Çıktı</b><br>${output}</div></div><div class="codex-tags"><span class="codex-tag">⚡ ${m.power} kW</span><span class="codex-tag">📐 ${m.footprint} hücre</span><span class="codex-tag">⏱ ${m.baseRate}/sn</span></div><div class="codex-line"><b>Açan teknoloji:</b> ${techName(m.tech)}</div><div class="codex-line"><b>İlk kurulum:</b> ${fmtItems(m.materialCost||{})}${Object.keys(m.materialCost||{}).length?'':` · Eski fiyat ${N.format(m.buildCost)}🪙`}</div><table class="mk-table"><tr><th>Sınıf</th><th>Üretim</th><th>Güç</th></tr>${D.levelMultipliers.map((x,i)=>`<tr><td>Mk ${roman(i+1)}</td><td>×${x}</td><td>×${x}</td></tr>`).join('')}</table></article>`;}).join('');
  }

  function items(){
    $('codex-items').innerHTML=Object.entries(D.items).map(([id,it])=>{
      const prod=D.machines.filter(m=>m.recipe.out[id]).map(m=>m.name),source=it.externalSource?[it.externalSource]:[],cons=D.machines.filter(m=>m.recipe.in[id]).map(m=>m.name),fuel=D.powerPlants.filter(p=>p.fuel?.item===id).map(p=>p.name);
      const techUse=D.research.filter(t=>t.cost?.[id]).map(t=>`${t.name} ×${N.format(t.cost[id])}`),repeatUse=D.repeatableResearch.filter(t=>t.base?.[id]).map(t=>`${t.name} (başlangıç ×${N.format(t.base[id])})`);
      const consumers=[...cons,...fuel,...techUse,...repeatUse];
      return `<article class="codex-card searchable" data-search="${esc([it.name,it.desc,...prod,...cons,...fuel,...techUse,...repeatUse].join(' '))}"><h3>${it.icon} ${it.name}</h3><p>${it.desc}</p><div class="codex-tags"><span class="codex-tag">Katman ${it.tier}</span><span class="codex-tag">Depo ${N.format(it.cap)}</span><span class="codex-tag">${it.research?'Araştırma verisi · Satılmaz':`${it.sell}🪙 liste fiyatı`}</span></div><div class="codex-line"><b>Üreten/Kazanılan:</b> ${[...prod,...source].join(', ')||'Yok'}</div><div class="codex-line"><b>Kullanan:</b> ${consumers.join(', ')||'Yok'}</div></article>`;
    }).join('');
  }

  function power(){
    $('codex-power').innerHTML=D.powerPlants.map(p=>`<article class="codex-card searchable" data-search="${esc([p.name,techName(p.tech),p.fuel?D.items[p.fuel.item].name:'yakıtsız'].join(' '))}"><h3>${p.icon} ${p.name}</h3><div class="codex-tags"><span class="codex-tag">⚡ ${p.output} kW</span><span class="codex-tag">📐 ${p.footprint} hücre</span><span class="codex-tag">${p.fuel?`${D.items[p.fuel.item].icon} ${p.fuel.rate}/sn`:'Yakıtsız'}</span></div><div class="codex-line"><b>Açan teknoloji:</b> ${techName(p.tech)}</div><div class="codex-line"><b>Kurulum:</b> ${fmtItems(p.materialCost||{})}${Object.keys(p.materialCost||{}).length?'':` · Eski fiyat ${N.format(p.buildCost)}🪙`}</div><table class="mk-table"><tr><th>Sınıf</th><th>Güç çarpanı</th></tr>${D.plantMultipliers.map((x,i)=>`<tr><td>Mk ${roman(i+1)}</td><td>×${x}</td></tr>`).join('')}</table></article>`).join('');
  }

  function space(){
    const ships=D.ships.map(d=>`<article class="codex-card searchable" data-search="${esc([d.name,techName(d.tech),fmtItems(d.cost),'gemi filo kargo yakıt'].join(' '))}"><h3>${d.icon} ${d.name}</h3><div class="codex-tags"><span class="codex-tag">⚔ ${d.attack}</span><span class="codex-tag">🛡 ${d.hull}</span><span class="codex-tag">📦 ${d.cargo}</span><span class="codex-tag">🚀 ${d.speed}</span><span class="codex-tag">⛽ ${d.fuel}/LY</span><span class="codex-tag">⏱ ${N.formatTime(d.buildSec)}</span></div><div class="codex-cost">${fmtItems(d.cost)}</div><div class="codex-line"><b>Teknoloji:</b> ${techName(d.tech)}</div></article>`);
    const satellites=(D.satellites||[]).map(d=>`<article class="codex-card searchable" data-search="${esc([d.name,techName(d.tech),fmtItems(d.cost),'uydu yörünge slot kütle komuta'].join(' '))}"><h3>${d.icon} ${d.name}</h3><div class="codex-tags"><span class="codex-tag">Yörünge kütlesi ${d.orbitalMassLoad??'—'}</span><span class="codex-tag">Komuta ${d.commandLoad??'—'}</span><span class="codex-tag">Azami ${d.maxCount??'Ağ sınırı'}</span></div><div class="codex-cost">${fmtItems(d.cost)}</div><div class="codex-line"><b>Teknoloji:</b> ${techName(d.tech)}</div></article>`);
    const defs=visibleDefs().map(d=>`<article class="codex-card searchable" data-search="${esc([d.name,techName(d.tech),fmtItems(d.cost),'savunma cohort enerji mühimmat bakım'].join(' '))}"><h3>${d.icon} ${d.name}</h3><div class="codex-tags"><span class="codex-tag">⚔ ${d.attack}</span><span class="codex-tag">🛡 ${d.hull}</span><span class="codex-tag">${d.defenseClass||'taktik'} sınıf</span><span class="codex-tag">${d.placement||'yüzey'}</span></div><div class="codex-cost">${fmtItems(d.cost)}</div><div class="codex-line"><b>Teknoloji:</b> ${techName(d.tech)}</div><div class="codex-line"><b>Operasyon:</b> Güç ${d.powerDemand||0}, ısı ${d.heatOutputPerUnit||0}, bakım ${d.maintenancePerUnit||0}${d.ammoItem?`, mühimmat ${D.items[d.ammoItem]?.name||d.ammoItem} ×${d.ammoPerRound}`:', mühimmatsız'}.</div></article>`);
    const facilities=(D.repairFacilities||[]).map(d=>`<article class="codex-card searchable" data-search="${esc([d.name,techName(d.tech),d.zone,'tamir bakım hurda'].join(' '))}"><h3>${d.icon} ${d.name}</h3><p>${d.zone==='planet'?'Gezegen yüzeyi ve savunma birimlerini':d.zone==='orbital'?'Uzay gemileri ile yörünge tesislerini':'Pazar, tarama ve haberleşme uydularını'} onarır.</p><div class="codex-tags"><span class="codex-tag">Bölge: ${d.zone}</span><span class="codex-tag">Mk I–${roman(d.maxLevel)}</span><span class="codex-tag">Temel ${d.baseSecPerPoint} sn/hasar</span></div><div class="codex-line"><b>Açan teknoloji:</b> ${techName(d.tech)}</div></article>`);
    const automation=`<article class="codex-card searchable" data-search="otomasyon seviye yapay zeka modüler nanofabrikasyon"><h3>🧠 Beş Aşamalı Otomasyon</h3><p>Her makine sınıfı bağımsız olarak Otomasyon I–V seviyesine yükseltilir. İleri seviyeler üretimi hızlandırır ve güç tüketimini düşürür.</p><div class="codex-tags"><span class="codex-tag">Azami V</span><span class="codex-tag">+%${Math.round(D.automation.rateBonusPerLevel*100)} üretim/seviye</span><span class="codex-tag">-%${Math.round(D.automation.powerSavingPerLevel*100)} güç/seviye</span></div></article>`;
    $('codex-space').innerHTML=[...ships,...satellites,...defs,...facilities,automation].join('');
  }

  function infrastructure(){
    const U=D.u3||{};
    const axes=`<article class="codex-card searchable" data-search="gezegen alan altyapı yörünge komuta enerji ısı bakım kapasite"><h3>📊 Çok Katmanlı Kapasite Modeli</h3><p>Boş arazi tek başına yeterli değildir. Yüzey m², gezegen altyapısı, yörünge kütlesi, orbital slot, komuta, enerji, ısı ve bakım ayrı sınırlar olarak hesaplanır.</p><div class="codex-tags"><span class="codex-tag">Yüzey m²</span><span class="codex-tag">Altyapı yükü</span><span class="codex-tag">Orbital kütle/slot</span><span class="codex-tag">Komuta</span><span class="codex-tag">Enerji/ısı/bakım</span></div></article>`;
    const assets=Object.entries(U.infrastructureAssets||{}).map(([id,d])=>`<article class="codex-card searchable" data-search="${esc([d.name,techName(d.tech),id,'kapasite altyapı'].join(' '))}"><h3>🏗️ ${d.name}</h3><div class="codex-tags"><span class="codex-tag">Teknoloji: ${techName(d.tech)}</span>${d.surfaceAreaM2?`<span class="codex-tag">Yüzey ${N.format(d.surfaceAreaM2)} m²</span>`:''}${d.orbitalMassLoad?`<span class="codex-tag">Orbital yük ${d.orbitalMassLoad}</span>`:''}${d.powerDemand?`<span class="codex-tag">Güç ${d.powerDemand}</span>`:''}</div><div class="codex-line"><b>Sağladığı:</b> ${d.heatDissipation?`+${N.format(d.heatDissipation)} ısı kapasitesi · `:''}${d.maintenanceCapacity?`+${N.format(d.maintenanceCapacity)} bakım · `:''}${d.orbitalMassCapacity?`+${N.format(d.orbitalMassCapacity)} orbital kütle · `:''}${d.orbitalSlotCapacity?`+${d.orbitalSlotCapacity} slot · `:''}${d.commandCapacity?`+${N.format(d.commandCapacity)} komuta`:''}</div></article>`);
    const complexes=(U.defenseComplexes||[]).map(d=>`<article class="codex-card searchable" data-search="${esc([d.name,techName(d.technology),d.placement,'savunma kompleks cohort milyon'].join(' '))}"><h3>${d.placement==='orbital'?'🛡️':'🏰'} ${d.name}</h3><p>${d.placement==='orbital'?'Yörüngedeki savunma cohort ve stratejik platformlarını':'Gezegen üzerindeki mikro, hafif, orta, ağır ve stratejik savunmaları'} Mk I–V kapasite tablolarıyla barındırır.</p><div class="codex-tags"><span class="codex-tag">${d.placement}</span><span class="codex-tag">Teknoloji: ${techName(d.technology)}</span><span class="codex-tag">Azami Mk V</span></div><table class="mk-table"><tr><th>Mk</th><th>Mikro</th><th>Hafif</th><th>Orta</th><th>Ağır</th><th>Stratejik</th></tr>${[0,1,2,3,4].map(i=>`<tr><td>${roman(i+1)}</td><td>${N.format(d.capacityByMk.micro[i])}</td><td>${N.format(d.capacityByMk.light[i])}</td><td>${N.format(d.capacityByMk.medium[i])}</td><td>${N.format(d.capacityByMk.heavy[i])}</td><td>${N.format(d.capacityByMk.strategic[i])}</td></tr>`).join('')}</table></article>`);
    const planets=Object.entries(U.planetOverrides||{}).map(([id,d])=>`<article class="codex-card searchable" data-search="${esc([id,'gezegen yüzey altyapı yörünge ısı bakım'].join(' '))}"><h3>🪐 ${id}</h3><div class="codex-tags"><span class="codex-tag">Yüzey ×${d.surfaceAreaMultiplier}</span><span class="codex-tag">Altyapı ×${d.infrastructureMultiplier}</span><span class="codex-tag">Yörünge ×${d.orbitalMassMultiplier}</span><span class="codex-tag">Isı ×${d.heatDissipationMultiplier}</span><span class="codex-tag">Bakım ×${d.maintenanceMultiplier}</span></div></article>`);
    $('codex-infrastructure').innerHTML=[axes,...assets,...complexes,...planets].join('');
  }

  function validate(){
    const problems=[],itemIds=new Set(Object.keys(D.items)),techIds=new Set(D.research.map(x=>x.id));
    D.machines.forEach(m=>{[...Object.keys(m.recipe.in),...Object.keys(m.recipe.out)].forEach(id=>{if(!itemIds.has(id))problems.push(`${m.name}: bulunmayan ürün referansı ${id}`)});if(m.tech&&!techIds.has(m.tech))problems.push(`${m.name}: bulunmayan teknoloji ${m.tech}`);if(!m.name||!m.icon)problems.push(`${m.id}: eksik makine kimliği`)});
    D.powerPlants.forEach(x=>{if(x.fuel&&!itemIds.has(x.fuel.item))problems.push(`${x.name}: bulunmayan yakıt ${x.fuel.item}`);if(x.tech&&!techIds.has(x.tech))problems.push(`${x.name}: bulunmayan teknoloji ${x.tech}`)});
    D.research.forEach(t=>{t.prereq.forEach(id=>{if(!techIds.has(id))problems.push(`${t.name}: bulunmayan önkoşul ${id}`)});Object.keys(t.cost).forEach(id=>{if(!itemIds.has(id))problems.push(`${t.name}: bulunmayan maliyet ürünü ${id}`)});if(!D.machines.some(m=>m.id===t.lab))problems.push(`${t.name}: bulunmayan laboratuvar ${t.lab}`);if(!t.desc)problems.push(`${t.name}: açıklama eksik`)});
    Object.entries(D.items).forEach(([id,it])=>{const produced=D.machines.some(m=>m.recipe.out[id]);if(!produced&&!it.research&&!it.externalSource)problems.push(`${it.name}: hiçbir makine veya oyun sistemi tarafından üretilmiyor`);if(!it.desc)problems.push(`${it.name}: açıklama eksik`)});
    Object.values(D.u3?.infrastructureAssets||{}).forEach(x=>{if(x.tech&&!techIds.has(x.tech))problems.push(`${x.name}: bulunmayan teknoloji ${x.tech}`)});
    (D.u3?.defenseComplexes||[]).forEach(x=>{if(x.technology&&!techIds.has(x.technology))problems.push(`${x.name}: bulunmayan teknoloji ${x.technology}`);for(const k of ['micro','light','medium','heavy','strategic'])if(!Array.isArray(x.capacityByMk?.[k])||x.capacityByMk[k].length!==5)problems.push(`${x.name}: ${k} Mk kapasitesi eksik`)});
    const reachable=new Set();let changed=true;while(changed){changed=false;D.research.forEach(t=>{if(!reachable.has(t.id)&&t.prereq.every(x=>reachable.has(x))){reachable.add(t.id);changed=true;}})}D.research.filter(t=>!reachable.has(t.id)).forEach(t=>problems.push(`${t.name}: teknoloji ağında ulaşılamıyor`));
    $('codex-validation').innerHTML=problems.length?`<div class="validation-error"><b>⚠ ${problems.length} veri sorunu bulundu</b><div class="validation-list">${problems.map(x=>`<div class="validation-item">${esc(x)}</div>`).join('')}</div></div>`:`<div class="validation-ok"><b>✅ Veri ağı doğrulandı</b><p>${D.research.length} teknoloji, ${D.machines.length} makine, ${Object.keys(D.items).length} ürün, ${visibleDefs().length} savunma ve ${(D.u3?.defenseComplexes||[]).length} kompleks referansında kırık bağlantı bulunmadı.</p></div>`;
    return problems;
  }

  function filter(){const q=$('codex-search').value.trim().toLocaleLowerCase('tr-TR'),cat=$('codex-category').value,problemsOnly=$('codex-problems-only').checked;document.querySelectorAll('.codex-section[data-category]').forEach(s=>s.classList.toggle('codex-hidden',cat!=='all'&&s.dataset.category!==cat));document.querySelectorAll('.searchable').forEach(x=>{const hit=!q||(x.dataset.search||'').toLocaleLowerCase('tr-TR').includes(q);x.classList.toggle('codex-hidden',!hit||problemsOnly);});if(problemsOnly){document.querySelectorAll('.codex-section[data-category]').forEach(s=>s.classList.add('codex-hidden'));$('validation').classList.remove('codex-hidden');}}

  summary();technology();machines();items();power();space();infrastructure();validate();
  $('codex-search').addEventListener('input',filter);$('codex-category').addEventListener('change',filter);$('codex-problems-only').addEventListener('change',filter);$('print-codex').addEventListener('click',()=>print());$('theme-codex').addEventListener('click',()=>{const d=document.documentElement;d.dataset.theme=d.dataset.theme==='dark'?'light':'dark';});
})();
