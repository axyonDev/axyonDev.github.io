# AXYON — Oynanış Önerileri: Uygulanabilir Tasarım Spec'i

Bu belge, oynanabilirlik önerilerini **uygulanabilir mekaniklere** çevirir: her biri somut
kural + kabul kriteri + faz (P-seviyesi) + risk. "Fikir" değil, sipariş edilebilir iş.
İki madde (paletin okunabilirliği ve durum dili) bu sürümde (U4.3.4) **zaten uygulandı**.

Önem sırası korunmuştur. En yüksek kaldıraç: **Ö1 (birleşik ekonomi)** ve **Ö3 (First Orbit anı)**.

---

## Ö1 — Tek oyun: fabrika çıktısı = savaşın yakıtı  ⭐ EN KRİTİK
**Sorun:** Factorio yarısı ile OGame yarısı cıvatayla tutturulmuş iki ayrı oyun olma riski.
**Kural:** Filo/savunma **coin ile değil**, fabrikada üretilen fiziksel çıktıyla kurulur.
- Gemi gövdesi ← `steelPlate` + `alloy`; mühimmat ← `ammunition`; itki ← `fuelCell` (döteryum karşılığı).
- Coin yalnız ikincil kolaylık (hızlandırma/ticaret) olur; **güç üretimi coin'le satın alınamaz.**
- Tez: *daha iyi fabrika kuran, savaşı kazanır.*
**Kabul:** Bir gemi kuyruğa alındığında envanterden gerçek üretim malzemesi düşer; malzeme
yoksa üretilemez. Coin'le gemi alınamaz.
**Faz:** P1–P2 (ekonomi birleşimi). **Risk:** Orta — denge; ama kimliğin temeli, ertelenemez.

## Ö2 — İlk 5 dakika: başarısız olunamaz onboarding
**Sorun:** Boş harita + 12 sonlu kömür zekice ama deadlock/kafa karışıklığı riski.
**Kural:** İlk kurulum rehberli ve kurtarılabilir olsun.
- Hayalet (ghost) yerleştirme + ok işaretli "buraya koy → şuraya bağla" adım rehberi.
- 12 kömür biterse: tek seferlik "acil kömür sevkiyatı" güvenlik ağı (deadlock imkânsız).
- İlk fırın ilk levhayı üretince küçük kutlama beat'i (ses + parıltı).
**Kabul:** Yeni oyuncu hiçbir dış bilgi olmadan ilk üretim zincirini kurabiliyor; hiçbir
girdi kombinasyonu kalıcı deadlock üretmiyor (test: 12 kömür senaryosu kurtarılıyor).
**Faz:** P1. **Risk:** Düşük.

## Ö3 — First Orbit'i oyunun en unutulmaz anına çevir  ⭐
**Sorun:** İki cephe geçişi özgün imza ama şu an sadece bir flag.
**Kural:** İlk orbital varlık operasyonel olduğunda tek seferlik sinematik beat:
- gökyüzü açılır, galaksi haritası ilk kez belirir,
- palet/tema **sıcak-toprak → soğuk-uzay** paletine geçer (token seviyesinde, S11),
- "İlk yörünge izi tespit edildi" tam ekran istihbarat kartı + ses.
**Kabul:** Geçiş bir kez oynanır, atlanabilir, tekrar tetiklenmez; oyuncu ekran görüntüsü
alıp paylaşabileceği bir kare görür.
**Faz:** P2. **Risk:** Düşük (görsel/olay); yüksek getiri (kimlik anı).

## Ö4 — Uzaysal yerleşim = puzzle: üç baskı
**Sorun:** "Yer önemli" ancak kısıt varsa eğlencelidir.
**Kural:** Üç baskı birlikte tasarlanır:
- (a) **Yatak tükenmesi** → genişlemeye zorlar (P0 çekirdeğinde hazır: `remaining`).
- (b) **Gezegen başına sınırlı inşa alanı** (OGame "fields", O21) → yerleşim optimizasyonu.
- (c) **Throughput tavanı** → bant/lojistik dar boğazı gerçek problem (P0 backpressure).
**Kabul:** Oyuncu en az bir kez "yer/alan/throughput yüzünden yeniden düzenleme" yapmak
zorunda kalıyor.
**Faz:** P0→P1 (motor hazır, denge ayarı). **Risk:** Orta (denge).

## Ö5 — Asenkron gerilim: geri dönme kancası
**Sorun:** İdle spam kaldırıldı (doğru), ama geri gelme sebebi kalmalı.
**Kural:** Stratejik Haber Akışı **beklenti** taşısın: "3s sonra filo dönüyor", "araştırma
17dk", "baskın penceresi açık". Kapatırken bir şey *çözülmeyi bekliyor* olmalı.
**Kabul:** Her oturum sonunda en az bir "zamanlı sonuç" (filo/araştırma/baskın) beklemede.
**Faz:** P2–P3. **Risk:** Düşük.

## Ö6 — Mobil yerleştirme UX'i (kısmen U4.3.4'te başladı)
**Sorun:** Parmakla bant çizmek acı; okunamaz paletler.
**Kural + durum:**
- ✅ **Palet okunabilirliği + kompakt/geniş yoğunluk** — bu sürümde uygulandı.
- ⏳ **Blueprint / kopyala-yapıştır (F15)** mobilde masaüstünden daha kritik: bir kez kur,
  her yere yapıştır. Dokunmatik: tek-dokunuş hat çizme, snap-to-grid, sürükle-bağla jesti.
**Kabul:** Blueprint ile 5+ makineli bir blok tek işlemde kopyalanıp yapıştırılabiliyor.
**Faz:** F15 = P2. **Risk:** Orta.

## Ö7 — "Neden durdu?" görsel teşhis (U4.3.4'te uygulandı)
**Kural + durum:** ✅ Bu sürümde durum dili eklendi: yeşil=çalışıyor, sarı=girdi/depo
bekliyor, kırmızı(nabız)=tıkalı, mavi=manuel, soluk=güçsüz. Makine satırında nokta + renk.
**Sıradaki:** Aynı dili canvas'ta makine üstüne taşımak (kırmızı kenar/sarı uyarı rozetleri)
— P1 canvas görselleştirmesiyle birlikte.
**Faz:** P1. **Risk:** Düşük.

## Ö8 — Sosyal son-oyun = OGame'in asıl retention'ı
**Sorun:** Gerçek PvP/ittifak olmadan "OGame temalı solo idle" kalır.
**Kural:** Sunucu otoritesi hazır (avantaj). Hafif asenkron PvP bile evreni canlandırır:
oyuncu üssüne baskın, leaderboard, ittifak, intikam penceresi.
**Kabul:** Bir oyuncu başka bir oyuncunun üssüne asenkron baskın yapıp sonucu yetkili
sunucudan alabiliyor.
**Faz:** P4 (PostgreSQL authority + auth). **Risk:** Yüksek — ama milyon-kullanıcı hedefinin
gerçek yakıtı budur.

---

## İki çapraz-kesen karar (netleştirilmeli)
1. **Retention modeli:** Galaksi mi son-oyun, yoksa Industry-Idle tarzı prestige/reset meta'sı
   mı? (Şu an prestige pasif.) Bu, uzun vadeli döngüyü belirler — Ö5 ve Ö8 buna bağlı.
2. **Para modeli (RevenueCat):** PvP gelecekse **pay-to-win YAPMA** — kozmetik/hız-konforu sat,
   güç satma. Yoksa Ö8'in rekabetçi evreni çöker.

## Öneri: uygulama sırası
`Ö2 (onboarding) → Ö4 (baskılar, motor hazır) → Ö1 (birleşik ekonomi) → Ö7 canvas →
Ö3 (First Orbit anı) → Ö6 blueprint → Ö5 (asenkron gerilim) → Ö8 (sosyal PvP)`
