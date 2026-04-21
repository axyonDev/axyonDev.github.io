# Axyon Learn Engine

Modüler, tak-çalıştır öğrenme platformu.  
Motor tamamen ayrı — içerik JSON dosyalarında.

---

## Dosya Yapısı

```
axyon-learn/
├── index.html          ← Motor (dokunma)
├── course.json         ← Kurs başlığı + modül listesi
├── modules/
│   ├── m0.json         ← Başlangıç modülü
│   ├── m1.json         ← Temel Yapılar
│   ├── m2.json         ← Karakter Dizileri
│   └── ...             ← Yeni modüller buraya
└── README.md
```

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

### 1. Modül JSON dosyası oluştur

`modules/m3.json`:
```json
{
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
      "quiz": [
        {
          "q": "Liste nasıl oluşturulur?",
          "opts": ["list()", "[]", "Her ikisi de", "{}"],
          "ans": 2,
          "exp": "list() ve [] her ikisi de liste oluşturur."
        }
      ],
      "drag": [
        {
          "code": "<span class=\"hl\">___</span>([1,2,3])",
          "ans": "len",
          "opts": ["len", "list", "range", "type", "sum"],
          "exp": "len() listenin eleman sayısını döndürür"
        }
      ],
      "fills": [
        {
          "code": "liste = <input class=\"blank\" data-ans=\"[]\" placeholder=\"?\" style=\"width:30px\">",
          "hint": "Boş liste oluşturmak için"
        }
      ],
      "code": {
        "task": "3 elemanlı bir liste oluştur ve her elemanı yazdır.",
        "starter": "# Listeyi oluştur\n",
        "hint": "liste = [1, 2, 3] şeklinde oluşturabilirsin.",
        "checkFn": "function(code){ const hasList = /\\[.+\\]/.test(code); const hasPrint = (code.match(/print/g)||[]).length >= 1; const pts = (hasList?5:0)+(hasPrint?5:0); return {pts, max:10, ok:pts>=6, msg:pts>=8?'Harika!':pts>=6?'Güzel iş.':'Liste ve print() kullan.'}; }"
      }
    }
  ]
}
```

### 2. course.json'a ekle

```json
"modules": [
  { "id": "m0", "file": "modules/m0.json" },
  { "id": "m1", "file": "modules/m1.json" },
  { "id": "m2", "file": "modules/m2.json" },
  { "id": "m3", "file": "modules/m3.json" }
]
```

**Bitti.** Sidebar otomatik güncellenir.

---

## Farklı Kurs Oluşturma (örn: Tarih)

### 1. Kopyala

```bash
cp -r axyon-learn axyon-tarih
```

### 2. `course.json` güncelle

```json
{
  "meta": {
    "storageKey": "axyon-tarih-v1",
    "themeKey": "axyon-tarih-theme",
    "title": "TarihLab",
    "brand": "axyon.dev",
    "icon": "🏛️",
    "tagline": "Derinlemesine Tarih Öğren",
    "description": "Tarihi anla, ezberle değil.",
    "themeColor": "#7eb8f7",
    "codeRunner": "none"
  },
  "modules": [
    { "id": "m0", "file": "modules/m0.json" }
  ]
}
```

### 3. Modülleri yaz

`modules/m0.json` içinde tarih dersleri.  
`codeRunner: "none"` → Kodla sekmesi otomatik gizlenir.

---

## Yerel Test (fetch için sunucu şart)

```bash
# Python
python -m http.server 8000

# Node (npx)
npx serve .

# Tarayıcıda:
# http://localhost:8000
```

> ⚠️ `index.html`'i doğrudan çift tıklayarak açmak çalışmaz.  
> fetch() CORS kısıtlaması nedeniyle `file://` protokolünde engellenir.  
> Sunucu üzerinden açman gerekir.

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
