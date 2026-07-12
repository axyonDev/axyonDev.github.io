(() => {
  'use strict';

  const parts = window.AXYON_CATALOG_PARTS || {};
  const items = [];
  const seen = new Set();

  Object.entries(parts).forEach(([part, records]) => {
    (records || []).forEach((record) => {
      if (!record || !record.id || seen.has(record.id)) return;
      seen.add(record.id);
      items.push({ ...record, catalogPart: part });
    });
  });

  const route = items
    .filter((item) => item.recommended && Number.isFinite(item.routeKey))
    .sort((a, b) => a.routeKey - b.routeKey || a.releaseYear - b.releaseYear || a.title.localeCompare(b.title, 'tr'));

  route.forEach((item, index) => {
    item.routeOrder = index + 1;
  });

  const byId = new Map(items.map((item) => [item.id, item]));

  const mediaFamily = (type = '') => {
    const value = type.toLocaleLowerCase('tr-TR');
    if (value.includes('animasyon')) return 'animation';
    if (value.includes('dizi')) return 'series';
    if (value.includes('özel') || value.includes('kısa')) return 'special';
    return 'film';
  };

  const partLabels = {
    mcu: 'MCU ve 2026 ana rota',
    television: 'Marvel Television dalları',
    xmen: 'X-Men ve mutant evrenleri',
    spider: 'Spider-Man ve Sony evrenleri',
    legacy: 'Legacy sinema',
    animation: 'Bağımsız Marvel animasyonları'
  };

  const partNotes = {
    mcu: 'Marvel’ın resmî Disney+ MCU sırası, yaklaşan 2026 yapımları ve çoklu evren bağlantıları.',
    television: 'Agent Carter, Agents of S.H.I.E.L.D., Runaways, Cloak & Dagger ve diğer televizyon süreklilikleri.',
    xmen: 'Fox filmleri, Deadpool, Legion, The Gifted ve X-Men animasyon süreklilikleri.',
    spider: 'Raimi, Webb, Sony karakterleri, Spider-Verse ve alternatif animasyon yorumları.',
    legacy: 'MCU öncesi veya bağımsız canlı aksiyon Marvel filmleri.',
    animation: 'MCU ve Spider/X-Men ana dalları dışında kalan önemli animasyon serileri.'
  };

  const colors = {
    mcu: '#ef2948',
    television: '#ff9f43',
    xmen: '#ffd35a',
    spider: '#45e8ff',
    legacy: '#9b8cff',
    animation: '#d66cff'
  };

  const universeFamily = (item) => {
    if (item.catalogPart === 'mcu') {
      if (item.primaryUniverse === 'Earth-616') return 'MCU — Earth-616';
      if (item.primaryUniverse === 'TVA') return 'MCU — TVA ve zaman dışı alanlar';
      return 'MCU — Paralel evren / Multiverse';
    }
    return partLabels[item.catalogPart] || item.branch || 'Diğer Marvel dalları';
  };

  const normalize = (value = '') => value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9çğıöşü]+/g, ' ')
    .trim();

  const resolveTitles = (ids = []) => ids.map((id) => byId.get(id)?.title || id);

  const validation = {
    total: items.length,
    route: route.length,
    verifiedTrailers: items.filter((item) => item.trailer?.idVerified && item.trailer?.youtubeId).length,
    trailerNull: items.filter((item) => !item.trailer?.youtubeId).length,
    disputed: items.filter((item) => item.disputed).length,
    upcoming: items.filter((item) => item.status === 'upcoming').length,
    parallel: items.filter((item) => item.primaryUniverse !== 'Earth-616').length
  };

  window.AXYON_CATALOG = {
    items,
    route,
    byId,
    mediaFamily,
    partLabels,
    partNotes,
    colors,
    universeFamily,
    normalize,
    resolveTitles,
    validation
  };
})();
