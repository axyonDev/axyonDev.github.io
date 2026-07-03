const CACHE = 'axyon-factory-v2-1';
const ASSETS = ['./','./index.html','./css/style.css','./manifest.json',
  './src/core/numbers.js','./data/config.js','./src/core/economy.js','./src/core/quests.js',
  './src/services/save-service.js','./src/ui/toast.js','./src/ui/ui.js','./src/main.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
