(() => {
  'use strict';

  const isHttp = /^https?:$/.test(location.protocol);
  const query = new URLSearchParams(location.search);
  const mockMode = query.get('mockvideo') === '1' || window.__AXYON_MOCK_VIDEO__ === true;
  let apiPromise = null;

  function loadYouTubeApi() {
    if (mockMode) return Promise.resolve('mock');
    if (!isHttp) return Promise.reject(new Error('FILE_PROTOCOL'));
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;

    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const timeout = window.setTimeout(() => reject(new Error('YOUTUBE_API_TIMEOUT')), 12000);
      window.onYouTubeIframeAPIReady = () => {
        window.clearTimeout(timeout);
        if (typeof previous === 'function') previous();
        resolve(window.YT);
      };

      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('YOUTUBE_API_LOAD_FAILED'));
      };
      document.head.appendChild(script);
    });
    return apiPromise;
  }

  class TrailerPlayer {
    constructor() {
      this.player = null;
      this.token = 0;
      this.activeItem = null;
    }

    destroy() {
      this.token += 1;
      this.activeItem = null;
      if (this.player && typeof this.player.destroy === 'function') {
        try { this.player.destroy(); } catch (error) { console.warn('[Trailer] destroy:', error); }
      }
      this.player = null;
    }

    async start(stage, item, callbacks = {}) {
      this.destroy();
      const token = this.token;
      this.activeItem = item;
      const status = stage.querySelector('[data-video-status]');
      const mount = stage.querySelector('[data-video-mount]');
      stage.classList.remove('video-live', 'video-error', 'video-blocked');
      if (mount) mount.replaceChildren();

      const setStatus = (text, kind = '') => {
        if (!status) return;
        status.textContent = text;
        status.dataset.kind = kind;
      };

      if (!item.trailer?.youtubeId || !item.trailer?.idVerified) {
        setStatus('Doğrulanmış gömülü fragman yok — YouTube aramasını açabilirsin.', 'notice');
        callbacks.onUnavailable?.('NO_VERIFIED_ID');
        return;
      }

      if (mockMode) {
        setStatus('Fragman hazırlanıyor…', 'loading');
        window.setTimeout(() => {
          if (this.token !== token) return;
          stage.classList.add('video-live');
          setStatus('Fragman oynuyor (arayüz test modu).', 'playing');
          callbacks.onPlaying?.();
        }, 90);
        return;
      }

      if (!isHttp) {
        setStatus('Fragman için sayfayı http:// veya https:// üzerinden aç.', 'warning');
        callbacks.onUnavailable?.('FILE_PROTOCOL');
        return;
      }

      setStatus('Fragman hazırlanıyor…', 'loading');

      try {
        await loadYouTubeApi();
        if (this.token !== token || !mount?.isConnected) return;

        const mountId = `yt-${item.id}-${Date.now()}`;
        const mountNode = document.createElement('div');
        mountNode.id = mountId;
        mount.appendChild(mountNode);

        this.player = new window.YT.Player(mountId, {
          videoId: item.trailer.youtubeId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: location.origin,
            widget_referrer: location.href
          },
          events: {
            onReady: (event) => {
              if (this.token !== token) return;
              try {
                event.target.mute();
                event.target.playVideo();
              } catch (error) {
                setStatus('Otomatik oynatma başlatılamadı — oynat düğmesine dokun.', 'warning');
                callbacks.onBlocked?.('PLAY_CALL_FAILED');
              }
            },
            onStateChange: (event) => {
              if (this.token !== token) return;
              if (event.data === window.YT.PlayerState.PLAYING) {
                stage.classList.add('video-live');
                setStatus('Fragman sessiz oynuyor.', 'playing');
                callbacks.onPlaying?.();
              }
              if (event.data === window.YT.PlayerState.ENDED) {
                setStatus('Fragman sona erdi.', 'notice');
                callbacks.onEnded?.();
              }
            },
            onError: (event) => {
              if (this.token !== token) return;
              const code = Number(event.data);
              stage.classList.remove('video-live');
              stage.classList.add('video-error');
              setStatus('Bu fragman gömmeye kapalı — YouTube’da izle ↗', 'error');
              console.warn(`[Trailer] ${item.title} (${item.trailer.youtubeId}) YouTube hata kodu: ${code}`);
              callbacks.onError?.(code);
            },
            onAutoplayBlocked: () => {
              if (this.token !== token) return;
              stage.classList.add('video-blocked');
              setStatus('Tarayıcı otomatik oynatmayı engelledi — videoya dokun.', 'warning');
              callbacks.onBlocked?.('AUTOPLAY_BLOCKED');
            }
          }
        });
      } catch (error) {
        if (this.token !== token) return;
        const reason = error?.message || 'UNKNOWN';
        stage.classList.add('video-error');
        setStatus(reason === 'FILE_PROTOCOL'
          ? 'Fragman için sayfayı http:// veya https:// üzerinden aç.'
          : 'YouTube oynatıcısı yüklenemedi — YouTube’da izle ↗', 'error');
        console.warn(`[Trailer] API yükleme sorunu: ${reason}`);
        callbacks.onError?.(reason);
      }
    }
  }

  class TrailerDiagnostics {
    constructor(catalog) {
      this.catalog = catalog;
      this.player = new TrailerPlayer();
      this.cancelled = false;
    }

    cancel() {
      this.cancelled = true;
      this.player.destroy();
    }

    async run(panel) {
      this.cancelled = false;
      const rows = panel.querySelector('[data-test-rows]');
      const summary = panel.querySelector('[data-test-summary]');
      const stage = panel.querySelector('[data-test-stage]');
      const candidates = this.catalog.items.filter((item) => item.trailer?.idVerified && item.trailer?.youtubeId);
      const counts = { playing: 0, error: 0, timeout: 0, blocked: 0, null: this.catalog.validation.trailerNull };
      rows.replaceChildren();

      for (let index = 0; index < candidates.length; index += 1) {
        if (this.cancelled) break;
        const item = candidates[index];
        const row = document.createElement('tr');
        row.innerHTML = `<td>${index + 1}</td><td>${escapeHtml(item.title)}</td><td><code>${item.trailer.youtubeId}</code></td><td data-result>Test ediliyor…</td>`;
        rows.appendChild(row);
        row.scrollIntoView({ block: 'nearest' });
        const resultCell = row.querySelector('[data-result]');

        const result = await new Promise((resolve) => {
          let settled = false;
          const finish = (kind, value = '') => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            resolve({ kind, value });
          };
          const timer = window.setTimeout(() => finish('timeout'), 9000);
          this.player.start(stage, item, {
            onPlaying: () => finish('playing'),
            onError: (code) => finish('error', code),
            onBlocked: (reason) => finish('blocked', reason),
            onUnavailable: (reason) => finish('error', reason)
          });
        });

        counts[result.kind] += 1;
        resultCell.textContent = result.kind === 'playing' ? 'PLAYING' : `${result.kind.toUpperCase()}${result.value !== '' ? ` (${result.value})` : ''}`;
        resultCell.dataset.kind = result.kind;
        this.player.destroy();
        summary.textContent = `PLAYING ${counts.playing} · Hata ${counts.error} · Zaman aşımı ${counts.timeout} · Engellendi ${counts.blocked} · ID null ${counts.null}`;
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }

      summary.textContent += this.cancelled ? ' · Test durduruldu.' : ' · Test tamamlandı.';
      return counts;
    }
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  window.AXYON_TRAILERS = { TrailerPlayer, TrailerDiagnostics, loadYouTubeApi, isHttp, mockMode };
})();
