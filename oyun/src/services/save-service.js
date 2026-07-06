/**
 * Axyon.SaveService — localStorage + export/import (base64). Versiyonlu şema.
 */
(function (global) {
  const KEY = 'axyon_idle_factory_v2';
  const CURRENT_VERSION = 7;
  function save(state) {
    try { state.lastSeen = Date.now(); localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { console.error('[Save]', e); return false; }
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (p.version !== CURRENT_VERSION) { console.warn('[Save] uyumsuz versiyon', p.version); return null; }
      return p;
    } catch (e) { console.error('[Save]', e); return null; }
  }
  const reset = () => localStorage.removeItem(KEY);
  const exportString = (s) => btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  function importString(str) {
    try {
      const p = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
      if (p.version !== CURRENT_VERSION) return { ok: false, error: 'Uyumsuz kayıt versiyonu.' };
      return { ok: true, state: p };
    } catch (e) { return { ok: false, error: 'Geçersiz kayıt kodu.' }; }
  }
  global.Axyon = global.Axyon || {};
  global.Axyon.SaveService = { save, load, reset, exportString, importString };
})(typeof window !== 'undefined' ? window : globalThis);
