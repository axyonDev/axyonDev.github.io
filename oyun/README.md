# Axyon Idle Factory — v2.1

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

## ✅ Test durumu
- Çekirdek: 45+ birim testi (arazi, depo, güç brownout, araştırma, prestige, bütünlük)
- Zincir denetleyici: tech ağacında döngüsel/erişilemez kilit YOK (otomatik doğrulama)
- Yeni özellikler: 13 birim + 13 DOM testi (oto-sat eşiği, rapor, bilgi ekranı)
- Regresyon: tam-zincir (madenden elektroniğe), deadlock, yakıt tampon, save v6
- Denge: 5/15/30/60 dk simülasyonlarıyla doğrulandı
- Çözülen kritik hatalar: başlangıç güç deadlock'u, kömür yakıt kilitlenmesi, zincir açmazı

## 📌 Sonraki (v2.1+)
- break_infinity.js'i numbers.js'e tak (çok uzun oynanış)
- Ödüllü reklam noktaları (offline cap genişletme, üretim boost)
- İkinci bölge/gezegen (config veri modeli hazır: her bölge farklı arazi + güç verimi)
- Ses/müzik
