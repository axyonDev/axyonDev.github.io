# Axyon Idle Factory — v3.0 (Keşif & Kaynak Nodları)

Özgün üretim zinciri idle fabrika oyunu. Kestros Kolonisi'nde hammadeden elektroniğe
uzanan bir sanayi kur, otomatikleştir, dört darboğazı yönet: **güç, arazi, depo, girdi**.

Tamamen orijinal içerik. Vanilla JS, framework yok, sunucu gerektirmez.

## ▶ Nasıl oynanır
1. ZIP'i **çıkart** (extract).
2. `index.html`'e çift tıkla.

> Tüm klasör bir arada kalmalı. PWA (ana ekrana ekle / offline) için sunucudan servis et:
> `python3 -m http.server 8000` → `http://localhost:8000`

## 🎮 Dört darboğaz katmanı (oyunun kalbi)
1. **Girdi** — makine reçetesinin girdisi yoksa yavaşlar/durur. Girdi stoğu artıyorsa ▲yeşil, azalıyorsa ▼kırmızı gösterilir.
2. **Güç (⚡)** — otomatik makineler kW çeker. Arz < talep ise TÜM üretim kısılır (brownout). Yakıtlı santraller depodan yakıt tüketir; yakıtsız güneş sabit üretir. Koloninin küçük bir taban gücü vardır (ilk makineleri başlatır).
3. **Arazi (🗺️ m²)** — her makine ve santral yer kaplar. Arazi bitince inşa edemezsin; krediyle genişletirsin.
4. **Depo (📦)** — her parçanın kapasitesi sınırlı; dolunca üreten makine durur. ⤢ ile depoyu büyüt.

## 🔗 Üretim zinciri (28 makine, 5 tier)
```
Madenler → Cevher → Fırınlar → Levha/Silikon ─┬→ Dişli/Tel → Devre → İşlemci → Elektronik
Petrol → Rafineri → Plastik/Kükürt ───────────┘           → Motor/Batarya → Drone/Makine
Laboratuvarlar → Alfa/Beta/Gama Veri → Araştırma ağacı
```

## 🔬 Sistemler
- **İnşa & Manager**: makineyi çoğalt (count), manager al → otomatik + offline üretim. Manuel çalıştırma güç gerektirmez.
- **Araştırma ağacı** (12 tech): laboratuvarlar veri çekirdeği üretir; çekirdekleri harcayıp yeni makine/santral/teknoloji aç.
- **Güç santralleri** (4 tier): Kömür → Güneş → Hidro → Nükleer.
- **Milestone**: makine sayısı 10/25/50/100'de o hattın üretimi çarpanla artar.
- **Prestige (🌟 Nexus)**: eşiğe ulaşınca her şeyi sıfırla, kalıcı +%5/Nexus üretim çarpanı kazan.
- **Görevler** (10) + **Başarımlar** (10) + **offline kazanç** + **oto-sat** (artanı otomatik sat, yakıt tampon korunur).
- Açık/koyu tema, save export/import (base64), PWA.

## 🗂 Yapı
```
data/config.js          → DENGE: parçalar, makineler, santraller, araştırma, arazi, prestige
src/core/economy.js     → güç + arazi + depo + akış + araştırma entegre çekirdek
src/core/quests.js      → görev/başarım
src/services/save-service.js → localStorage + export/import (şema v6)
src/ui/ui.js            → sekmeli arayüz (Fabrika/Rapor/Güç/Araştırma/Depo), akış ▲▼, verim/depo çubukları
src/main.js             → loop + olaylar
```

## 🆕 v2.1 değişiklikleri
1. **Oto-sat eşiği** — her parça için "elde tut" miktarı belirlenebilir. Oto-sat açınca artık hepsi satılıp fabrikalar durmaz; senin belirlediğin kadar tutar, üstünü satar (güç yakıtı ayrıca korunur).
2. **Rapor sekmesi (📊)** — çalışan tüm hatların anlık durumu: üretim hızı, verim çubuğu, sorun göstergesi. Bir satıra tıkla → ilgili fabrikaya git.
3. **Zincir açmazı düzeltildi** — Dişli Presi başta açık; ilk araştırma artık döngüsel kilide takılmıyor. Tüm tech ağacı otomatik denetleyiciyle döngüsel/erişilemez kilide karşı doğrulanıyor.
4. **Materyal bilgi ekranı** — envanterde parçaya tıkla (mobilde basılı tut): açıklama, üreten, tüketen, değer, akış durumu.
5. **Excel milestone hiyerarşisine sadakat** — aşama yapısı referans hiyerarşiyle hizalı; isimler tamamen özgün.

## 🗺️ v2.2 — Grafik Fabrika (canvas mekânsal arayüz)
Fabrika artık **gezegen yüzeyinde** kuruluyor. Panel yerine tuval:
- **Sürükle-bırak yerleşim** — yapı paletinden seç, yüzeye tıkla. Yeşil = uygun, kırmızı = dolu/yetersiz.
- **Konveyör çek** — kaynak makineye tıkla, hedefe tıkla. Bant üzerinde üretilen item ikonu **akar** (kaynak çalışıyorsa).
- **Elektrik hattı** — santralden makineye güç dağıt (kesikli sarı hat).
- **Pan & zoom** — boş alanı sürükle kaydır, tekerlek/butonla yakınlaş. Mobilde dokunma.
- **Seç/taşı** — yapıya tıkla: alttan bilgi paneli (çalıştır, manager, bilgi). Sürükle: taşı.
- **Sil** — yapıyı kaldır (yarı iade), bağlı hatlar otomatik temizlenir.
- Durum renkli kenarlar: yeşil = tam hız, sarı = kısıtlı, kırmızı = durdu, ✋ = manuel.

> Bu **Yol A**: bağlantılar ve akış görseldir; item ekonomisi hâlâ oranlı-throughput (hızlı, mobil dostu, PWA korunur). İleride bant üzerinde tek tek item fiziğine (**Yol B**) evrilebilir.

Grid boyutu araziye bağlı (her hücre ~4m²) — arazi genişledikçe yüzey büyür. Beşinci darboğaz: **yerleşim/mesafe**.

## 🧭 v3.0 — Keşif, Kaynak Nodları & Gelişmiş Satış
Büyük güncelleme: harita artık **sabit ve büyük** (48×48), bölgelere ayrılmış. "m² genişlet" kalktı; yerine **keşif**:
- **Bölge aç/keşfet** — kapalı (sisli) bir bölgeye tıkla veya HUD'dan aç (artan kredi maliyeti). Bölge açılınca içindeki **kaynak yatakları** ortaya çıkar.
- **Kaynak nodları** — demir/bakır/kömür/taş/su/petrol/uranyum yatakları haritada gizli. Başlangıç bölgesinde temel 4 kaynak garantili; uzak bölgelerde nadir kaynaklar (petrol, uranyum).
- **Katı kural (Factorio gibi):** madenler/çıkarıcılar SADECE eşleşen kaynak nodunun üzerine kurulur. Daha çok üretim = daha çok keşif. İşleyiciler (fırın, montaj, lab) ve santraller boş zemine kurulur.

### Diğer yenilikler
- **Bağlantı silme** — Sil modunda konveyör/elektrik hattına tıkla → o hat silinir (yapı silmeden).
- **Makine üstü istatistik** — yakınlaştırınca her yapının üzerinde güç (kW) ve üretim/sn rozeti.
- **Gelişmiş oto-sat** — her ürün için OTO + **%0/25/50/75/100 elde tut** oranı. Hızlı sat (½ / Tümü). ☑ ile ürün seç, **toplu sat** (%25/50/75/Tümü) ve toplu OTO.
- **Skor / En yüksek skor** — bileşik skor (kazanç + prestige + araştırma + keşif + üretim). HUD'da 🏅 gösterilir; ileride online lider tablosu için hazır.

## ✅ Test durumu
- Çekirdek: 45+ birim testi (arazi, depo, güç brownout, araştırma, prestige, bütünlük)
- Zincir denetleyici: tech ağacında döngüsel/erişilemez kilit YOK (otomatik doğrulama)
- Grafik katman: 14 mekânsal (yerleştir/taşı/sil/konveyör/hat) + 10 DOM (canvas/palet/inspector) testi
- Regresyon: tam-zincir, deadlock, yakıt tampon, prestige grid sıfırlama, save v7
- Denge: 5/15/30/60 dk simülasyonlarıyla doğrulandı
- Çözülen kritik hatalar: başlangıç güç deadlock'u, kömür yakıt kilitlenmesi, zincir açmazı

## 📌 Sonraki (v2.1+)
- break_infinity.js'i numbers.js'e tak (çok uzun oynanış)
- Ödüllü reklam noktaları (offline cap genişletme, üretim boost)
- İkinci bölge/gezegen (config veri modeli hazır: her bölge farklı arazi + güç verimi)
- Ses/müzik
