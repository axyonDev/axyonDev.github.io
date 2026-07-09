/** Axyon.Quests — sıralı görevler ve başarımlar. */
(function (global) {
  const D=global.Axyon.Data,N=global.Axyon.Numbers,E=global.Axyon.Economy;
  const currentQuest=s=>s.questIndex>=D.quests.length?null:D.quests[s.questIndex];
  function questProgress(s){
    const q=currentQuest(s);if(!q)return null;let cur=0;
    switch(q.type){
      case 'itemProduced':cur=s.stats.produced[q.item]||0;break;
      case 'buildCount':cur=s.stats.machinesBuilt||0;break;
      case 'research':cur=Object.keys(s.researched||{}).length;break;
      case 'powerBuilt':cur=s.stats.plantsBuilt||0;break;
      case 'landExpand':cur=s.sectorsOpened||0;break;
      case 'marketDispatch':cur=s.stats.marketDispatches||0;break;
      case 'buildingLevel':cur=Math.max(1,...Object.values(s.machineLevels||{}),...Object.values(s.plantLevels||{}));break;
      case 'scan':cur=s.stats.systemsScanned||0;break;
      case 'battleWin':cur=s.stats.battlesWon||0;break;
      case 'coins':cur=s.coins||0;break;
    }
    return {quest:q,current:cur,target:q.target,done:N.gte?N.gte(cur,q.target):Number(cur)>=q.target};
  }
  function tryComplete(s){
    const p=questProgress(s);if(!p||!p.done)return null;const r=p.quest.reward||{},parts=[];
    if(r.coins){E.addCoins(s,r.coins);parts.push(`+${N.format(r.coins)} 🪙`);}
    Object.keys(D.items).forEach(k=>{if(r[k]){s.inventory[k]=N.add(s.inventory[k]||0,r[k]);parts.push(`+${r[k]} ${D.items[k].icon}`);}});
    s.questIndex++;return {desc:p.quest.desc,rewardText:parts.join('  ')};
  }
  function checkAchievements(s){const out=[];D.achievements.forEach(a=>{if(!s.achievements[a.id]&&a.check(s)){s.achievements[a.id]=true;out.push(a);}});return out;}
  global.Axyon.Quests={currentQuest,questProgress,tryComplete,checkAchievements};
})(typeof window!=='undefined'?window:globalThis);
