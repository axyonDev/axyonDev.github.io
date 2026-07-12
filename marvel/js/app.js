(() => {
  'use strict';

  const catalog = window.AXYON_CATALOG;
  const meta = window.AXYON_META || {};
  const { TrailerPlayer, TrailerDiagnostics } = window.AXYON_TRAILERS;
  const player = new TrailerPlayer();

  const els = {
    app: document.querySelector('#app'),
    list: document.querySelector('#timelineList'),
    panel: document.querySelector('#leafPanel'),
    search: document.querySelector('#searchInput'),
    modeButtons: [...document.querySelectorAll('[data-mode]')],
    mediaButtons: [...document.querySelectorAll('[data-media]')],
    sort: document.querySelector('#sortSelect'),
    highlight: document.querySelector('#highlightRoute'),
    resultTitle: document.querySelector('#resultTitle'),
    resultText: document.querySelector('#resultText'),
    visibleCount: document.querySelector('#visibleCount'),
    totalCount: document.querySelector('#totalCount'),
    routeCount: document.querySelector('#routeCount'),
    trailerCount: document.querySelector('#trailerCount'),
    scopeText: document.querySelector('#scopeText'),
    sourceLinks: document.querySelector('#sourceLinks'),
    diagnostics: document.querySelector('#diagnosticsPanel'),
    diagnosticsRows: document.querySelector('[data-test-rows]'),
    diagnosticsSummary: document.querySelector('[data-test-summary]'),
    diagnosticsRun: document.querySelector('#runDiagnostics'),
    diagnosticsStop: document.querySelector('#stopDiagnostics')
  };

  const state = {
    mode: 'all',
    media: 'all',
    sort: 'story',
    search: '',
    highlightRoute: true,
    pinnedId: null,
    activeId: null,
    videoTimer: null,
    closeTimer: null
  };

  const descriptions = {
    all: ['Tüm Marvel ekran kataloğu', 'Hiçbir dal saklanmaz. Önerilen ana rota parlak görünür; alternatif ve isteğe bağlı yapımlar aynı ağaçta kalır.'],
    route: ['Önerilen başlangıç rotası', 'MCU omurgası, No Way Home öncesi Spider-Man dalları, Deadpool & Wolverine öncesi mutant filmleri ve 2026 varış noktaları tek sırada gösterilir.'],
    mcu: ['Resmî MCU kronolojisi', 'Marvel’ın Disney+ Complete MCU Timeline sırası korunur. Yaklaşan yapımlar, resmî konumları açıklanmadığı için numarasız bir gelecek dalında tutulur.'],
    upcoming: ['Yaklaşan yapımlar', '2026 ve sonrası için duyurulan, bu katalogda doğrulanmış temel yapımlar. Kesin hikâye sırası açıklanmayanlara tahmini numara verilmez.']
  };

  init();

  function init() {
    els.totalCount.textContent = catalog.validation.total;
    els.routeCount.textContent = catalog.validation.route;
    els.trailerCount.textContent = catalog.validation.verifiedTrailers;
    els.scopeText.textContent = `${meta.scope?.included || ''} Hariç: ${meta.scope?.excluded || ''}`;
    renderSources();
    bindEvents();
    applyHash();
    render();
    setupRevealObserver();
    setupDiagnostics();
  }

  function bindEvents() {
    els.search.addEventListener('input', (event) => {
      state.search = catalog.normalize(event.target.value);
      render();
    });

    els.modeButtons.forEach((button) => button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      els.modeButtons.forEach((item) => item.classList.toggle('active', item === button));
      render();
    }));

    els.mediaButtons.forEach((button) => button.addEventListener('click', () => {
      state.media = button.dataset.media;
      els.mediaButtons.forEach((item) => item.classList.toggle('active', item === button));
      render();
    }));

    els.sort.addEventListener('change', (event) => {
      state.sort = event.target.value;
      render();
    });

    els.highlight.addEventListener('change', (event) => {
      state.highlightRoute = event.target.checked;
      render();
    });

    els.list.addEventListener('mouseover', onNodeEnter);
    els.list.addEventListener('mouseout', onNodeLeave);
    els.list.addEventListener('focusin', onNodeEnter);
    els.list.addEventListener('click', onNodeClick);
    els.panel.addEventListener('mouseenter', cancelCloseTimer);
    els.panel.addEventListener('mouseleave', () => {
      if (!state.pinnedId) schedulePanelClose();
    });
    els.panel.addEventListener('click', onPanelClick);

    document.addEventListener('click', (event) => {
      if (!state.pinnedId) return;
      if (els.panel.contains(event.target) || event.target.closest('[data-item-id]')) return;
      unpinAndClose();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') unpinAndClose();
    });

    window.addEventListener('hashchange', applyHash);
  }

  function applyHash() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!id || !catalog.byId.has(id)) return;
    state.activeId = id;
    state.pinnedId = id;
    renderPanel(catalog.byId.get(id), true);
    requestAnimationFrame(() => document.querySelector(`[data-item-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  function getFilteredItems() {
    let items = catalog.items.slice();
    if (state.mode === 'route') items = catalog.route.slice();
    if (state.mode === 'mcu') items = items.filter((item) => item.catalogPart === 'mcu');
    if (state.mode === 'upcoming') items = items.filter((item) => item.status === 'upcoming');

    if (state.media !== 'all') {
      items = items.filter((item) => catalog.mediaFamily(item.mediaType) === state.media);
    }

    if (state.search) {
      items = items.filter((item) => {
        const haystack = catalog.normalize([
          item.title, item.branch, item.primaryUniverse, item.storyTime?.label,
          item.desc, item.why, item.mediaType
        ].join(' '));
        return haystack.includes(state.search);
      });
    }

    return sortItems(items);
  }

  function sortItems(items) {
    const fallback = (value, max = 999999) => Number.isFinite(value) ? value : max;
    return items.sort((a, b) => {
      if (state.sort === 'release') {
        return fallback(a.releaseYear) - fallback(b.releaseYear) || a.title.localeCompare(b.title, 'tr');
      }
      if (state.sort === 'official') {
        return fallback(a.officialMcuOrder) - fallback(b.officialMcuOrder) || fallback(a.releaseYear) - fallback(b.releaseYear);
      }
      if (state.sort === 'route') {
        return fallback(a.routeOrder) - fallback(b.routeOrder) || fallback(a.releaseYear) - fallback(b.releaseYear);
      }
      const ay = a.storyTime?.startYear;
      const by = b.storyTime?.startYear;
      return fallback(ay) - fallback(by) || fallback(a.releaseYear) - fallback(b.releaseYear) || a.title.localeCompare(b.title, 'tr');
    });
  }

  function groupItems(items) {
    if (state.mode === 'route') {
      const groups = [
        ['Kökler ve ilk ekip', 1, 15],
        ['Dünya büyüyor', 16, 30],
        ['Bölünme ve Infinity Saga', 31, 44],
        ['Multiverse açılıyor', 45, 59],
        ['Eski evrenler ana hikâyeye bağlanıyor', 60, 72],
        ['2026 varış noktası', 73, 999]
      ];
      return groups.map(([label, min, max], index) => ({
        key: `route-${index}`,
        label,
        note: 'Önerilen rota numarası editoryaldir; resmî MCU sırası kart içinde ayrıca gösterilir.',
        color: ['#ef2948','#ff9f43','#ffd35a','#45e8ff','#9b8cff','#d66cff'][index],
        items: items.filter((item) => item.routeOrder >= min && item.routeOrder <= max)
      })).filter((group) => group.items.length);
    }

    if (state.mode === 'mcu') {
      const official = items.filter((item) => item.officialMcuOrder != null);
      const main = official.filter((item) => item.primaryUniverse === 'Earth-616');
      const parallel = official.filter((item) => item.primaryUniverse !== 'Earth-616');
      const upcoming = items.filter((item) => item.officialMcuOrder == null);
      const groups = [];
      for (let start = 1; start <= 80; start += 15) {
        const end = Math.min(80, start + 14);
        const chunk = main.filter((item) => item.officialMcuOrder >= start && item.officialMcuOrder <= end);
        if (chunk.length) groups.push({ key: `mcu-${start}`, label: `MCU ana çizgi · resmî sıra #${start}–#${end}`, note: 'Earth-616 yapımları Marvel’ın resmî Disney+ MCU numarasıyla gösterilir.', color: '#ef2948', items: chunk });
      }
      if (parallel.length) groups.push({ key: 'mcu-parallel', label: 'Resmî listede bulunan paralel evren dalları', note: 'Resmî MCU numarası kartta korunur; düğüm ana zaman çizgisine düz bir yıl gibi gömülmez.', color: '#d66cff', items: parallel });
      if (upcoming.length) groups.push({ key: 'mcu-upcoming', label: 'Yaklaşan MCU yapımları — resmî sıra bekleniyor', note: 'Vizyon tarihleri biliniyor; kesin hikâye konumları açıklanmadı.', color: '#9b8cff', items: upcoming });
      return groups;
    }

    const groups = [];
    const mcuMain = items.filter((item) => item.catalogPart === 'mcu' && item.primaryUniverse === 'Earth-616');
    const mcuParallel = items.filter((item) => item.catalogPart === 'mcu' && item.primaryUniverse !== 'Earth-616');
    if (mcuMain.length) groups.push({
      key: 'mcu-main',
      label: 'MCU ana zaman çizgisi — Earth-616',
      note: 'Ana MCU omurgası ve kesin konumu henüz açıklanmayan Earth-616 yapımları.',
      color: catalog.colors.mcu,
      items: mcuMain
    });
    if (mcuParallel.length) groups.push({
      key: 'mcu-parallel',
      label: 'MCU paralel evren ve zaman dışı dalları',
      note: 'Earth-828, Earth-10005, TVA ve çoklu evren düğümleri ayrı şeritte tutulur.',
      color: '#d66cff',
      items: mcuParallel
    });
    for (const part of ['television', 'xmen', 'spider', 'legacy', 'animation']) {
      const branchItems = items.filter((item) => item.catalogPart === part);
      if (branchItems.length) groups.push({ key: part, label: catalog.partLabels[part], note: catalog.partNotes[part], color: catalog.colors[part], items: branchItems });
    }
    return groups;
  }

  function render() {
    const items = getFilteredItems();
    const groups = groupItems(items);
    const [title, text] = descriptions[state.mode] || descriptions.all;
    els.resultTitle.textContent = title;
    els.resultText.textContent = text;
    els.visibleCount.textContent = items.length;

    if (!items.length) {
      els.list.innerHTML = '<div class="empty-state"><strong>Sonuç bulunamadı.</strong><span>Arama veya filtreyi değiştir.</span></div>';
      return;
    }

    els.list.innerHTML = groups.map((group) => `
      <section class="timeline-branch reveal" style="--branch-color:${group.color}" data-group="${escapeHtml(group.key)}">
        <header class="branch-head">
          <span class="branch-dot" aria-hidden="true"></span>
          <div>
            <small>${group.items.length} yapım</small>
            <h3>${escapeHtml(group.label)}</h3>
            <p>${escapeHtml(group.note)}</p>
          </div>
        </header>
        <div class="branch-nodes">
          ${group.items.map((item, index) => renderNode(item, index)).join('')}
        </div>
      </section>
    `).join('');

    if (state.activeId) markActive(state.activeId);
    setupRevealObserver();
  }

  function renderNode(item, index) {
    const isParallel = item.primaryUniverse !== 'Earth-616';
    const dim = state.highlightRoute && state.mode === 'all' && !item.recommended;
    const isMcuParallel = state.mode === 'mcu' && item.primaryUniverse !== 'Earth-616';
    const mainNumber = state.mode === 'route'
      ? String(item.routeOrder || '—').padStart(2, '0')
      : state.mode === 'mcu'
        ? (isMcuParallel ? '↗' : (item.officialMcuOrder ? String(item.officialMcuOrder).padStart(2, '0') : '∞'))
        : item.releaseYear || '—';
    const numberLabel = state.mode === 'route' ? 'rota' : state.mode === 'mcu' ? (isMcuParallel ? 'dal' : 'MCU') : 'yayın';
    const badges = [
      `<span class="badge">${escapeHtml(item.mediaType)}</span>`,
      item.recommended ? '<span class="badge route">Önerilen</span>' : '',
      isParallel ? `<span class="badge universe">${escapeHtml(item.primaryUniverse)}</span>` : '',
      item.disputed ? '<span class="badge disputed">Tartışmalı</span>' : '',
      item.status === 'upcoming' ? '<span class="badge upcoming">Yakında</span>' : '',
      item.trailer?.idVerified ? '<span class="badge video">▶ Fragman</span>' : '<span class="badge no-video">Fragman ara</span>'
    ].filter(Boolean).join('');

    return `
      <article class="node reveal-node ${dim ? 'route-dim' : ''} ${isParallel ? 'parallel' : ''} ${item.recommended ? 'recommended' : ''}"
        style="--delay:${Math.min(index * 25, 250)}ms" data-item-id="${escapeHtml(item.id)}" tabindex="0" role="button"
        aria-label="${escapeHtml(item.title)} bilgi kartını aç">
        <div class="node-num"><b>${escapeHtml(mainNumber)}</b><small>${numberLabel}</small></div>
        <div class="node-main">
          <b>${escapeHtml(item.title)}</b>
          <small>${escapeHtml(item.storyTime?.label || 'Tarih belirtilmedi')} · ${escapeHtml(item.branch)}</small>
        </div>
        <div class="node-badges">${badges}</div>
      </article>`;
  }

  function onNodeEnter(event) {
    const node = event.target.closest('[data-item-id]');
    if (!node || !els.list.contains(node)) return;
    if (event.type === 'mouseover' && event.relatedTarget && node.contains(event.relatedTarget)) return;
    cancelCloseTimer();
    const item = catalog.byId.get(node.dataset.itemId);
    if (!item) return;
    state.activeId = item.id;
    renderPanel(item, Boolean(state.pinnedId));
    markActive(item.id);
    if (!state.pinnedId || state.pinnedId === item.id) scheduleVideo(item);
  }

  function onNodeLeave(event) {
    const node = event.target.closest('[data-item-id]');
    if (!node || (event.relatedTarget && node.contains(event.relatedTarget))) return;
    if (state.pinnedId) return;
    if (event.relatedTarget && els.panel.contains(event.relatedTarget)) return;
    schedulePanelClose();
  }

  function onNodeClick(event) {
    const node = event.target.closest('[data-item-id]');
    if (!node) return;
    const item = catalog.byId.get(node.dataset.itemId);
    if (!item) return;
    state.pinnedId = item.id;
    state.activeId = item.id;
    safeReplaceUrl(`#${encodeURIComponent(item.id)}`);
    renderPanel(item, true);
    markActive(item.id);
    scheduleVideo(item, 0);
  }

  function onPanelClick(event) {
    if (event.target.closest('[data-close-panel]')) {
      unpinAndClose();
      return;
    }
    const related = event.target.closest('[data-related-id]');
    if (related) {
      const item = catalog.byId.get(related.dataset.relatedId);
      if (!item) return;
      state.pinnedId = item.id;
      state.activeId = item.id;
      renderPanel(item, true);
      scheduleVideo(item, 0);
      document.querySelector(`[data-item-id="${CSS.escape(item.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function scheduleVideo(item, delay = 480) {
    window.clearTimeout(state.videoTimer);
    state.videoTimer = window.setTimeout(() => {
      const stage = els.panel.querySelector('[data-video-stage]');
      if (!stage || state.activeId !== item.id) return;
      player.start(stage, item);
    }, delay);
  }

  function schedulePanelClose() {
    cancelCloseTimer();
    state.closeTimer = window.setTimeout(() => {
      if (state.pinnedId) return;
      player.destroy();
      state.activeId = null;
      els.panel.classList.remove('open');
      renderEmptyPanel();
      markActive(null);
    }, 260);
  }

  function cancelCloseTimer() {
    window.clearTimeout(state.closeTimer);
  }

  function safeReplaceUrl(url) {
    try {
      history.replaceState(null, '', url);
    } catch (_) {
      /* file:// and embedded previews may block History API writes. */
    }
  }

  function unpinAndClose() {
    state.pinnedId = null;
    state.activeId = null;
    player.destroy();
    safeReplaceUrl(location.pathname + location.search);
    els.panel.classList.remove('open');
    renderEmptyPanel();
    markActive(null);
  }

  function renderEmptyPanel() {
    els.panel.innerHTML = `
      <div class="leaf-empty">
        <div class="mini-dna" aria-hidden="true"></div>
        <span>Bir yapıma dokun</span>
        <p>Masaüstünde üzerine gel; mobilde karta dokun. Bilgi paneli alttan açılır.</p>
      </div>`;
  }

  function renderPanel(item, pinned = false) {
    player.destroy();
    window.clearTimeout(state.videoTimer);
    const poster = item.trailer?.youtubeId
      ? `https://i.ytimg.com/vi/${encodeURIComponent(item.trailer.youtubeId)}/hqdefault.jpg`
      : makePoster(item);
    const youtubeHref = item.trailer?.youtubeId
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(item.trailer.youtubeId)}`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(item.trailer?.trailerQuery || `${item.title} official trailer`)}`;
    const required = (item.requiredBefore || []).map((id) => catalog.byId.get(id)).filter(Boolean);
    const source = item.sources?.[0];
    const universeNote = item.primaryUniverse !== 'Earth-616'
      ? `<div class="notice universe-note"><strong>Paralel evren — ${escapeHtml(item.primaryUniverse)}</strong><span>Bu yapım Earth-616 ana çizgisinde geçmiyor veya birden fazla evrene yayılıyor.</span></div>`
      : '';
    const dispute = item.disputed
      ? `<div class="notice dispute-note"><strong>Kronoloji notu</strong><span>${escapeHtml(item.disputeNote || 'Kesin yerleşim tartışmalıdır.')}</span></div>`
      : '';

    els.panel.innerHTML = `
      <div class="leaf-content">
        <button class="panel-close" type="button" data-close-panel aria-label="Bilgi kartını kapat">×</button>
        <div class="video-wrap" data-video-stage>
          <div class="yt-mount" data-video-mount></div>
          <img class="yt-poster" src="${poster}" alt="${escapeHtml(item.title)} fragman önizlemesi" referrerpolicy="strict-origin-when-cross-origin">
          <div class="video-shield" aria-hidden="true"></div>
          <div class="play-hint"><i>▶</i><span data-video-status>${item.trailer?.idVerified ? 'Kart açıldığında sessiz fragman hazırlanır.' : 'Doğrulanmış gömülü fragman yok.'}</span></div>
        </div>
        <div class="leaf-copy">
          <div class="leaf-kicker"><span>${escapeHtml(item.branch)}</span><span>${escapeHtml(item.mediaType)}</span></div>
          <h2>${escapeHtml(item.title)}</h2>
          <div class="leaf-tags">
            ${item.routeOrder ? `<span>Önerilen rota #${item.routeOrder}</span>` : ''}
            ${item.officialMcuOrder ? `<span>Resmî MCU #${item.officialMcuOrder}</span>` : ''}
            <span>${item.releaseYear || 'Tarih bekleniyor'} yayını</span>
            <span>${item.skippable ? 'İsteğe bağlı' : 'Ana rota'}</span>
          </div>
          ${universeNote}
          ${dispute}
          <p class="summary">${escapeHtml(item.desc)}</p>
          <div class="info-grid">
            <div class="info-card"><strong>Hikâye zamanı</strong><p>${escapeHtml(item.storyTime?.label || 'Belirtilmedi')}</p></div>
            <div class="info-card"><strong>Evren</strong><p>${escapeHtml((item.universes || [item.primaryUniverse]).join(' · '))}</p></div>
            <div class="info-card"><strong>Yayın</strong><p>${item.releaseDate ? formatDate(item.releaseDate) : escapeHtml(String(item.releaseYear || 'Bekleniyor'))}</p></div>
            <div class="info-card"><strong>Durum</strong><p>${item.status === 'upcoming' ? 'Yaklaşan yapım' : 'Yayımlandı'}</p></div>
          </div>
          <section class="why-card"><strong>Neden burada?</strong><p>${escapeHtml(item.why)}</p></section>
          ${required.length ? `<section class="related"><strong>Önce izlenmesi önerilenler</strong><div>${required.map((entry) => `<button type="button" data-related-id="${escapeHtml(entry.id)}">${escapeHtml(entry.title)}</button>`).join('')}</div></section>` : ''}
          <a class="trailer-link" href="${youtubeHref}" target="_blank" rel="noopener noreferrer">${item.trailer?.idVerified ? 'YouTube’da sesli izle ↗' : 'YouTube’da resmî fragmanı ara ↗'}</a>
          ${source ? `<a class="source-link" href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Kaynak sayfası ↗</a>` : ''}
          <p class="pin-note">${pinned ? 'Kart sabit. ×, Esc veya panel dışına tıklayarak kapat.' : 'Tıklayarak kartı sabitle.'}</p>
        </div>
      </div>`;
    els.panel.classList.add('open');
  }

  function markActive(id) {
    document.querySelectorAll('[data-item-id].active').forEach((node) => node.classList.remove('active'));
    if (id) document.querySelector(`[data-item-id="${CSS.escape(id)}"]`)?.classList.add('active');
  }

  function renderSources() {
    els.sourceLinks.innerHTML = (meta.sources || []).map((source) => `
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}${source.published ? ` · ${source.published}` : ''}</a>`).join('');
  }

  function setupRevealObserver() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal,.reveal-node').forEach((el) => el.classList.add('revealed'));
      return;
    }
    if (window.__revealObserver) window.__revealObserver.disconnect();
    window.__revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          window.__revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '120px 0px', threshold: 0.04 });
    document.querySelectorAll('.reveal,.reveal-node').forEach((el) => window.__revealObserver.observe(el));
  }

  function setupDiagnostics() {
    const params = new URLSearchParams(location.search);
    const enabled = params.get('selftest') === '1';
    if (!enabled) return;
    els.diagnostics.hidden = false;
    const diagnostics = new TrailerDiagnostics(catalog);
    els.diagnosticsRun.addEventListener('click', () => diagnostics.run(els.diagnostics));
    els.diagnosticsStop.addEventListener('click', () => diagnostics.cancel());
    requestAnimationFrame(() => diagnostics.run(els.diagnostics));
  }

  function makePoster(item) {
    const initials = item.title.split(/\s+/).slice(0, 3).map((word) => word[0] || '').join('').toUpperCase();
    const color = catalog.colors[item.catalogPart] || '#ef2948';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"><defs><radialGradient id="g"><stop stop-color="${color}" stop-opacity=".55"/><stop offset="1" stop-color="#070910"/></radialGradient></defs><rect width="960" height="540" fill="url(#g)"/><path d="M80 430 C280 80 680 80 880 430" fill="none" stroke="white" stroke-opacity=".12" stroke-width="18"/><text x="480" y="285" fill="white" font-size="132" font-family="Arial,sans-serif" font-weight="900" text-anchor="middle">${escapeHtml(initials)}</text><text x="480" y="360" fill="white" fill-opacity=".72" font-size="30" font-family="Arial,sans-serif" text-anchor="middle">FRAGMAN ARAMASI</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
    } catch { return value; }
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }
})();
