const CACHE = 'axyon-factory-frontier-v4-0-0';
const ASSETS = ['./','./index.html','./css/style.css','./manifest.json','./assets/icon-192.png','./assets/icon-512.png',
  './src/core/numbers.js','./data/config.js','./src/core/economy.js','./src/core/quests.js',
  './src/services/save-service.js','./src/ui/toast.js','./src/canvas/factory-canvas.js','./src/ui/ui.js','./src/main.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)));});
