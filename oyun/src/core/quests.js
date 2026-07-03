/**
 * Axyon.Quests — sıralı görevler + başarımlar.
 */
(function (global) {
  const D = global.Axyon.Data, N = global.Axyon.Numbers, E = global.Axyon.Economy;

  const currentQuest = (s) => (s.questIndex >= D.quests.length ? null : D.quests[s.questIndex]);

  function questProgress(s) {
    const q = currentQuest(s);
    if (!q) return null;
    let cur = 0;
    switch (q.type) {
      case 'itemProduced': cur = s.stats.produced[q.item] || 0; break;
      case 'buildCount': cur = s.stats.machinesBuilt; break;
      case 'research': cur = Object.keys(s.researched).length; break;
      case 'powerBuilt': cur = s.stats.plantsBuilt; break;
      case 'landExpand': cur = s.landExpansions; break;
      case 'prestige': cur = s.prestigeCount; break;
      case 'coins': cur = s.coins; break;
    }
    return { quest: q, current: cur, target: q.target, done: cur >= q.target };
  }
  function tryComplete(s) {
    const p = questProgress(s);
    if (!p || !p.done) return null;
    const r = p.quest.reward, parts = [];
    if (r.coins) { E.addCoins(s, r.coins); parts.push(`+${N.format(r.coins)} 🪙`); }
    ['alphaCore','betaCore','gammaCore'].forEach((c) => {
      if (r[c]) { s.inventory[c] = (s.inventory[c] || 0) + r[c]; parts.push(`+${r[c]} ${D.items[c].icon}`); }
    });
    s.questIndex += 1;
    return { desc: p.quest.desc, rewardText: parts.join('  ') };
  }
  function checkAchievements(s) {
    const newly = [];
    D.achievements.forEach((a) => { if (!s.achievements[a.id] && a.check(s)) { s.achievements[a.id] = true; newly.push(a); } });
    return newly;
  }
  global.Axyon.Quests = { currentQuest, questProgress, tryComplete, checkAchievements };
})(typeof window !== 'undefined' ? window : globalThis);
