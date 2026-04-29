#!/usr/bin/env node
/**
 * PyLab SEO Generator
 * ────────────────────────────────────────────
 * Çalıştırma: node generate-seo.js
 *
 * Üretilen dosyalar:
 *   sitemap.xml   — Google Search Console'a gönder
 *   robots.txt    — Arama motoru crawl kuralları
 *   seo/          — Her ders için statik HTML sayfaları (opsiyonel)
 *
 * Gereksinim: Node.js 16+ (npm paketi yok)
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

/* ── AYARLAR ── */
const BASE_URL    = 'https://axyon.dev/pylab';   // Kendi domain'inle değiştir
const OUTPUT_DIR  = path.join(__dirname);
const SEO_DIR     = path.join(__dirname, 'seo');
const GENERATE_LESSON_PAGES = false; // true yapınca her ders için HTML üretir

/* ── MODÜL DOSYALARINI OKU ── */
function loadModules() {
  // course.js'ten modül listesini dinamik oku — hardcoded m0-m9 yerine
  let moduleIds = ['m0','m1','m2','m3','m4','m5','m6','m7','m8','m9']; // fallback
  const courseFile = path.join(__dirname, 'course.js');
  if (fs.existsSync(courseFile)) {
    try {
      const courseSandbox = {};
      courseSandbox.window = courseSandbox;
      vm.createContext(courseSandbox);
      vm.runInContext(fs.readFileSync(courseFile, 'utf8'), courseSandbox);
      const course = courseSandbox.AXYON_COURSE;
      if (course?.modules) {
        const ids = course.modules.filter(m => !m.comingSoon && m.id).map(m => m.id);
        if (ids.length) { moduleIds = ids; console.log(`📦 course.js: ${ids.join(', ')}`); }
      }
    } catch(e) { console.warn('⚠️  course.js okunamadı:', e.message); }
  }

  const modules = [];
  for (const id of moduleIds) {
    const file = path.join(__dirname, 'modules', `${id}.js`);
    if (!fs.existsSync(file)) { console.warn(`⚠️  Bulunamadı: ${file}`); continue; }
    try {
      const sandbox = {};
      sandbox.window = sandbox; // window.AXYON_MX = {...} için şart
      vm.createContext(sandbox);
      vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
      const varName = `AXYON_${id.toUpperCase()}`;
      const data = sandbox[varName];
      if (!data) { console.warn(`⚠️  ${varName} tanımlı değil`); continue; }
      modules.push(data);
      console.log(`✓  ${data.label || id} — ${(data.lessons || []).length} ders`);
    } catch (e) { console.warn(`⚠️  ${id} yüklenemedi: ${e.message}`); }
  }
  return modules;
}

/* ── SİTEMAP ── */
function generateSitemap(modules) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];

  // Ana sayfa
  urls.push(`  <url>\n    <loc>${BASE_URL}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n    <lastmod>${today}</lastmod>\n  </url>`);

  // Müfredat sayfası
  urls.push(`  <url>\n    <loc>${BASE_URL}/mufredat.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n    <lastmod>${today}</lastmod>\n  </url>`);

  // Her ders için URL
  for (const mod of modules) {
    for (const lesson of (mod.lessons || [])) {
      urls.push(
        `  <url>\n    <loc>${BASE_URL}/#${lesson.id}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n    <lastmod>${today}</lastmod>\n  </url>`
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), xml, 'utf8');
  console.log(`\n📄 sitemap.xml — ${urls.length} URL`);
}

/* ── ROBOTS.TXT ── */
function generateRobots() {
  const content = `User-agent: *
Allow: /
Disallow: /modules/

Sitemap: ${BASE_URL}/sitemap.xml
`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'robots.txt'), content, 'utf8');
  console.log('📄 robots.txt');
}

/* ── OPSİYONEL: Her ders için statik HTML ── */
function generateLessonPages(modules) {
  if (!GENERATE_LESSON_PAGES) return;
  if (!fs.existsSync(SEO_DIR)) fs.mkdirSync(SEO_DIR, { recursive: true });

  let count = 0;
  for (const mod of modules) {
    for (const lesson of (mod.lessons || [])) {
      const title    = lesson.title || lesson.id;
      const desc     = lesson.desc  || `PyLab ${mod.label} — ${title}`;
      const filename = `${lesson.id}.html`;

      const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — PyLab Python</title>
<meta name="description" content="${desc.replace(/"/g,'&quot;')}">
<meta property="og:title" content="${title} — PyLab">
<meta property="og:description" content="${desc.replace(/"/g,'&quot;')}">
<meta property="og:url" content="${BASE_URL}/#${lesson.id}">
<link rel="canonical" href="${BASE_URL}/#${lesson.id}">
<meta http-equiv="refresh" content="0;url=${BASE_URL}/#${lesson.id}">
</head>
<body>
<p>Yönlendiriliyor: <a href="${BASE_URL}/#${lesson.id}">${title}</a></p>
<script>window.location.replace('${BASE_URL}/#${lesson.id}');</script>
</body>
</html>`;

      fs.writeFileSync(path.join(SEO_DIR, filename), html, 'utf8');
      count++;
    }
  }
  console.log(`📄 seo/ — ${count} ders sayfası`);
}

/* ── ÖZET RAPOR ── */
function printSummary(modules) {
  const totalLessons = modules.reduce((s, m) => s + (m.lessons || []).length, 0);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`PyLab SEO Generator — Özet`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Modül : ${modules.length}`);
  console.log(`Ders  : ${totalLessons}`);
  console.log(`Base  : ${BASE_URL}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

/* ── ÇALIŞTIR ── */
const modules = loadModules();
generateSitemap(modules);
generateRobots();
generateLessonPages(modules);
printSummary(modules);

console.log('✅  SEO dosyaları hazır.');
console.log('   → sitemap.xml dosyasını Google Search Console\'a yükle.');
console.log('   → robots.txt dosyasını web sunucusuna yükle.');
