/** Axyon.SaveService — sürümlü localStorage, v8→v12 güvenli migrasyon. */
(function(global){
  const KEY='axyon_idle_factory_v2';
  function normalize(s){return global.Axyon.Economy.normalizeState(s);}
  function save(state){try{state.version=global.Axyon.Economy.SAVE_VERSION;state.lastSeen=Date.now();localStorage.setItem(KEY,JSON.stringify(state));return true;}catch(e){console.error('[Save]',e);return false;}}
  function load(){try{const raw=localStorage.getItem(KEY);return raw?normalize(JSON.parse(raw)):null;}catch(e){console.error('[Save]',e);return null;}}
  const reset=()=>localStorage.removeItem(KEY);
  const exportString=s=>btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  function importString(str){try{return {ok:true,state:normalize(JSON.parse(decodeURIComponent(escape(atob(str.trim())))))};}catch(e){return {ok:false,error:'Geçersiz veya bozuk kayıt kodu.'};}}
  global.Axyon=global.Axyon||{};global.Axyon.SaveService={save,load,reset,exportString,importString};
})(typeof window!=='undefined'?window:globalThis);
