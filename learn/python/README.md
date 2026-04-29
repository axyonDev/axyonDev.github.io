# Axyon Learn Engine

Modüler, tak-çalıştır öğrenme platformu.  
Motor tamamen ayrı — içerik JS dosyalarında (window global değişkenler).

---

## Dosya Yapısı

```
axyon-learn/
├── index.html          ← Motor (dokunma)
├── course.js           ← Kurs başlığı + modül listesi (window.AXYON_COURSE)
├── modules/
│   ├── m0.js           ← Başlangıç modülü (window.AXYON_M0)
│   ├── m1.js           ← Temel Yapılar   (window.AXYON_M1)
│   ├── m2.js           ← Karakter Dizileri (window.AXYON_M2)
│   └── ...             ← Yeni modüller buraya
├── ogretmen.html       ← Öğretmen ilerleme paneli
├── mufredat.html       ← Müfredat genel bakış
└── README.md
```

> ⚠️ Modüller JSON **değil**, JS dosyalarıdır.  
> Her modül `window.AXYON_MX = { ... }` şeklinde global bir değişken tanımlar.

---

## GitHub Pages ile Yayınlama

```bash
# 1. Repo oluştur (örn: axyon-learn)
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/KULLANICI/axyon-learn.git
git push -u origin main

# 2. GitHub → Settings → Pages → Source: main / root
# Birkaç dakika sonra:
# https://KULLANICI.github.io/axyon-learn/
```

---

## Yeni Modül Ekleme

### 1. Modül JS dosyası oluştur

`modules/m3.js`:
```js
window.AXYON_M3 = {
  "id": "m3",
  "label": "Koleksiyonlar",
  "icon": "🗂️",
  "color": "#f78c6c",
  "lessons": [
    {
      "id": "listeler",
      "icon": "📋",
      "locked": true,
      "title": "Listeler",
      "desc": "Liste oluşturma, erişim, metodlar",
      "lesson": "<div class=\"lesson-text\"><p>Ders içeriği buraya...</p></div>",
      "quiz": [ ... ],
      "drag": [ ... ],
      "fills": [ ... ],
      "code": {
        "task": "3 elemanlı bir liste oluştur ve her elemanı yazdır.",
        "starter": "# Listeyi oluştur\n",
        "hint": "liste = [1, 2, 3] şeklinde oluşturabilirsin.",
        "checkFn": "function(code){ const hasList = /\\[.+\\]/.test(code); const hasPrint = (code.match(/print/g)||[]).length >= 1; const pts = (hasList?5:0)+(hasPrint?5:0); return {pts, max:10, ok:pts>=6, msg:pts>=8?'Harika!':pts>=6?'Güzel iş.':'Liste ve print() kullan.'}; }"
      }
    }
  ]
};
```

### 2. course.js'e ekle

```js
{ id:"m3", file:"modules/m3.js", varName:"AXYON_M3" }
```

### 3. index.html ve ogretmen.html'e script tag ekle

```html
<script src="modules/m3.js"></script>
```

**Bitti.** Sidebar otomatik güncellenir.

---

## Farklı Kurs Oluşturma (örn: Tarih)

### 1. Kopyala

```bash
cp -r axyon-learn axyon-tarih
```

### 2. `course.js` güncelle

```js
window.AXYON_COURSE = {
  meta: {
    storageKey: "axyon-tarih-v1",
    themeKey: "axyon-tarih-theme",
    title: "TarihLab",
    brand: "axyon.dev",
    icon: "🏛️",
    tagline: "Derinlemesine Tarih Öğren",
    description: "Tarihi anla, ezberle değil.",
    themeColor: "#7eb8f7",
    codeRunner: "none"
  },
  modules: [
    { id:"m0", file:"modules/m0.js", varName:"AXYON_M0" }
  ]
};
```

### 3. Modülleri yaz

`modules/m0.js` içinde tarih dersleri.  
`codeRunner: "none"` → Kodla sekmesi otomatik gizlenir.

---

## Yerel Test

```bash
# Python
python -m http.server 8000

# Node (npx)
npx serve .

# Tarayıcıda:
# http://localhost:8000
```

> **Not:** Modüller artık statik `<script>` tag'leriyle yükleniyor (fetch yok).  
> Çoğu modern tarayıcıda doğrudan `index.html` açılabilir.  
> Yine de yerel sunucu önerilir — CDN, localStorage ve bazı tarayıcı güvenlik politikaları `file://` altında beklenmedik davranabilir.  
> En garantisi: `python -m http.server 8000`

---

## Firebase Cloud Sync Kurulumu (Opsiyonel)

İlerlemenin cihazlar arası senkronize olmasını istiyorsan:

```
1. console.firebase.google.com → Yeni proje oluştur
2. Authentication → Sign-in method → Anonymous → Etkinleştir
3. Firestore Database → Oluştur → Test modu seç
4. Proje Ayarları → Uygulamalarım → Web uygulaması ekle → Config bilgilerini kopyala
5. index.html içindeki FIREBASE_CONFIG değişkenini doldur:
```

```js
var FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "proje-id.firebaseapp.com",
  projectId:         "proje-id",
  storageBucket:     "proje-id.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

> Config doldurulmadan sistem localStorage ile çalışmaya devam eder.  
> Ücretsiz Firebase Spark planı PyLab için fazlasıyla yeterli.

**Güvenlik kuralları (production'a çıkmadan önce):**

```
// Firestore rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## `checkFn` Yazımı

Her dersin `code` bölümünde `checkFn` bir JavaScript fonksiyon string'i:

```json
"checkFn": "function(code){ 
  const hasPrint = (code.match(/print/g)||[]).length >= 3;
  const hasFStr  = code.includes('f\"') || code.includes(\"f'\");
  const pts = (hasPrint?5:0) + (hasFStr?5:0);
  return { pts, max:10, ok: pts>=6, msg: pts>=8 ? 'Mükemmel!' : pts>=6 ? 'İyi!' : 'Tekrar dene.' };
}"
```

| Alan | Açıklama |
|------|----------|
| `pts` | Kazanılan puan |
| `max` | Maksimum puan |
| `ok`  | Geçti mi? (true/false) |
| `msg` | Kullanıcıya gösterilecek mesaj |

---

## jsDelivr CDN (opsiyonel, daha hızlı)

GitHub Pages zaten hızlı ama jsDelivr cache'lerse daha da hızlanır:

```
https://cdn.jsdelivr.net/gh/KULLANICI/axyon-learn@main/course.json
https://cdn.jsdelivr.net/gh/KULLANICI/axyon-learn@main/modules/m0.json
```

`index.html`'deki BASE URL'yi bu şekilde sabitleyebilirsin (opsiyonel).
