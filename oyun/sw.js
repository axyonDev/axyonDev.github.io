const CACHE = 'axyon-orbital-ascendancy-v4-4-u3';
const ASSETS = ['./','./index.html','./encyclopedia.html','./CHANGELOG.md','./css/style.css','./css/encyclopedia.css','./manifest.json','./assets/icon-192.png','./assets/icon-512.png',
  './data/feature-flags.js','./vendor/break_eternity/break_eternity.min.js','./src/core/economy-number.js','./src/core/lossless-json.js','./src/services/save-migrator-v16.js',
  './data/canonical/game-data.v4.4.final.js','./data/canonical/game-data.v4.4.final.json','./data/canonical/save-state-v16.schema.json','./src/core/canonical-data-loader.js',
  './src/core/numbers.js','./data/config.js','./data/u2-first-orbit-data.js','./data/u3-planetary-bastions-data.js','./src/core/economy.js','./src/core/u2-first-orbit-runtime.js','./src/core/u3-planetary-bastions-runtime.js','./src/core/quests.js','./src/services/save-service.js','./src/ui/toast.js','./src/ui/help-system.js','./src/ui/encyclopedia.js','./src/canvas/factory-canvas.js','./src/ui/ui.js','./src/ui/combat-ui.js','./src/main.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)));});
