# AXYON v4.5.7 U4.3.4 — Readable Palette, Density & Visual Polish
## Teslim Raporu (Claude tarafı: UX/görsel + oynanış önerileri paketi)

**Taban:** `4.5.6-u4.3.3` Factory Intelligence · Save `v16`
**Durum:** Tüm kod + gerçek Chromium kapıları geçti. Canlı ekonomi/motor DEĞİŞMEDİ.

## Ne teslim edildi

### 1. Paletteki okunamayan kartlar düzeltildi (bildirilen hata)
Gönderilen ekran görüntüsündeki sorun: dar kartlarda makine adı ile gereksinim rozetleri
görsel olarak çakışıyordu. Çözüm — kart tamamen yeniden tasarlandı:
- İsim kendi satırında, sabit yükseklik yok → uzun ad sarsa bile **çakışma yapısal olarak imkânsız**.
- Simge yuvarlak kutucukta; gereksinimler net rozetlerde (simge + ad + ×adet); alan/enerji alt satırda.
- Üst aksan çizgisi, yumuşak gölge, hover/active mikro-etkileşim, klavye odak halkası.

### 2. Ayarlara "Yapı menüsü yoğunluğu": Geniş / Kompakt
- **Geniş** (varsayılan): tam ürün adı + adet, ferah kartlar (360px).
- **Kompakt**: dar ekran için simge + ×adet, sıkışık ama okunur (266px).
- `state.settings.density` olarak kalıcı; tema deseninin birebir aynısıyla bağlandı
  (`applyDensity` → `data-density` attribute → `S.save`). economy.js'te sanitize edilir.
- Mobilde (≤640px) her iki yoğunluk da tam genişliğe oturur → **390px yatay taşma yok**.

### 3. "Neden durdu?" görsel durum dili (öneri #7)
Makine satırında renk + nokta ile tek bakışta teşhis: yeşil=çalışıyor, sarı=girdi/depo
bekliyor, kırmızı(nabız animasyonu)=tıkalı, mavi=manuel. Nabız yalnız kritik durumda.

### 4. Görsel/efekt polish (disiplinli)
Palet aksan çizgisi, rozet/buton mikro-etkileşimleri, `prefers-reduced-motion` zemini,
`:focus-visible` erişilebilirlik halkaları. Bir imza (palet + durum dili), gerisi sakin.

### 5. Oynanış önerileri → uygulanabilir spec paketi
`reports/AXYON_OYNANIS_ONERILERI_SPEC.md`: 8 öneri, her biri somut kural + kabul kriteri +
faz + risk olarak. İki madde (Ö6 palet, Ö7 durum dili) bu sürümde uygulandı; kalanı fazlara bağlandı.

## Kabul sonuçları

| Kapı | Sonuç |
|---|---|
| Node/regresyon + P0 + P1 | PASS (26 üst paket + P0 20/20 + P1 23/23) |
| Gerçek Chromium smoke (index.html) | PASS · 390px taşma **yok** · console hatası **0** |
| Yeni: density paleti (`u4-3-4-density-palette.py`) | PASS · çakışma yok, geniş=360>kompakt=266, ad görünürlüğü doğru |
| Görsel doğrulama (4 senaryo: geniş/kompakt × masaüstü/mobil) | çakışma 0, taşma 0 |

## Değişmezlik (regresyon güvencesi)

`economy.js`, `u2-first-orbit-runtime.js`, `spatial-sim.js`, `spatial-bridge.js` SHA olarak
**değişmedi**. Değişenler yalnız sunum katmanı: `css/style.css`, `index.html`, `src/main.js`
(density bağlama) ve `economy.js`'e tek satır density-sanitize (mantık değişmedi, yalnız
ayar temizliği). Canlı üretim/savaş/save davranışı birebir korunur.

## Bilinen sınırlar / sıradaki
1. Durum dili şu an makine RAPOR satırında; canvas üstüne taşınması P1 görselleştirmesiyle.
2. Density yalnız yapı paletini etkiler; ileride HUD/rapor yoğunluğuna genişletilebilir.
3. Önerilerin çoğu (Ö1 birleşik ekonomi, Ö3 First Orbit anı, Ö8 PvP) faz işidir; spec hazır.
