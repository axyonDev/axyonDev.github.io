# AXYON: Orbital Ascendancy
## v4.4.1 U3.1 — Save Recovery & Accessibility Hotfix

Uzay sanayisi, otomasyon, ilk yörünge ekonomisi, gezegen/yörünge kapasitesi ve milyon ölçekli cohort savunmalarını birleştiren idle/makro-strateji prototipi.

## U3.1 öne çıkanlar

- Yeni oyun markası: **AXYON: Orbital Ascendancy**
- U2 Decimal-native ekonomi ve sıfır kredili First Orbit akışı korunur.
- Arka plandan dönüşte kaybolan idle süre düzeltilmiştir; aynı süre iki kez ödenmez.
- Mobil canvas için gerçek iki parmak pinch-to-zoom vardır.
- Geçici kayıt hataları oyun içinde görünür; 30 saniye sonra otomatik yeniden deneme ve anlık **Tekrar Dene** seçeneği vardır.
- Migrasyon/load güvenlik hataları kullanıcı retry işlemiyle gevşetilmez.
- Gezegen yüzey alanı, altyapı, enerji, ısı, bakım, yörünge kütlesi, orbital slot ve komuta limitleri canlıdır.
- Gezegen Soğutma, Bakım Deposu, Komuta Dizisi ve Yörünge Kontrol tesisleri vardır.
- Yüzey Savunma Kompleksi ve Yörünge Savunma Halkası Mk I–V çalışır.
- Savunmalar cohort/stack olarak milyon ölçeğine çıkabilir.
- Enerji, mühimmat, ısı ve bakım savunma hazırlığını gerçek zamanlı etkiler.
- Tier-0 Acil Barikat ölüm sarmalını engeller fakat saldırı gücü üretmez.
- Eski kayıtlar silinmez; kapasite aşımı varsa **Miras Aşımı** ile yalnız yeni inşa kısıtlanır.
- 300×300 haritada viewport culling yalnız görünen grid/sektör/entity alanını çizer.
- Teknoloji kartları açtıkları tüm altyapı, kompleks ve kapasite sistemlerini listeler.
- Ansiklopediye U3 Altyapı ve Kapasite bölümü eklenmiştir.
- Zoom ve üst ikon hedefleri en az 44×44 px; Canlı Cephe açılır alanı `aria-expanded` ile senkronizedir.

## Ölçek hedefi

Proje, milyonlarca kayıtlı kullanıcıya ve binlerce eşzamanlı oyuncuya uygun sunucu-otoriteli ortak evrene geçebilecek şekilde geliştirilecektir. Mevcut sürüm local-first prototiptir; ekonomi ve savaşta local kayıt gelecekte otorite olmayacaktır. Ayrıntılar: `docs/SCALABILITY_GUARDRAILS.md`.

## Çalıştırma

En sağlıklı kullanım için klasörde yerel bir web sunucusu açın:

```bash
python -m http.server 8080
```

Ardından tarayıcıda `http://localhost:8080` adresini açın.

Doğrudan `index.html` de açılabilir; ancak Service Worker/PWA önbelleği tarayıcı güvenlik politikası nedeniyle `file:` protokolünde çalışmayabilir.

## Test

```bash
./run-tests.sh
```

Windows:

```bat
run-tests.bat
```

Gerçek Chromium smoke harness’i, Python Playwright kurulu ortamlarda:

```bash
python tests/u3-browser-smoke.py
```

## Önemli sınırlar

- Gerçek oyunculu PvP için sunucu otoritesi henüz yoktur.
- IndexedDB fallback U4 kapsamındadır; U3 localStorage yazma hatasını görünür hale getirir.
- Milyonluk savunmalar tek tek render edilmez; kompleks içinde cohort/stack olarak tutulur.
- Save şeması v16 ve eski kayıt anahtarları uyumluluk için korunur.

## Raporlar

- `reports/U3_INTEGRATION_REPORT.html`
- `reports/U3_NODE_TESTS.txt`
- `reports/U3_BROWSER_SMOKE_FINAL.json`
- Masaüstü/mobil ve ansiklopedi ekran görüntüleri `reports/` klasöründedir.
