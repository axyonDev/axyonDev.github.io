# AXYON: Orbital Ascendancy v4.5.6 U4.3.3 — Factory Intelligence & Defense-Gated Groundfront
## Entegrasyon, Stabilite ve Teslim Raporu

**Sürüm:** `4.5.6-u4.3.3`  
**Save şeması:** `v16`  
**Taban:** `v4.5.5-u4.3.2 Power Discipline` + P0 `spatial-sim.js` kanıt çekirdeği  
**Durum:** Kabul adayı — tüm kod ve tarayıcı kapıları geçti

---

## 1. Yönetici özeti

Bu sürüm, kullanıcı tarafından istenen üç oynanış/okunabilirlik kararını uygular:

1. İnşa paletinde gereksinimler yalnız simge değil, **simge + ürün adı + adet** olarak gösterilir.
2. Erken oyunda yerel tehdit yoktur. Yeryüzü Cephesi, ilk gerçek savunma teknolojisi **Gezegen Savunması (`defenseGrid`)** tamamlanınca açılır.
3. Fabrika haritasında açılıp kapanabilen **anlık üretim ve güç durum çekmecesi** bulunur.

Claude tarafından teslim edilen P0 uzaysal simülasyon çekirdeği de pakete alınmış ve bağımsız 20/20 assertion ile yeniden doğrulanmıştır. Bu çekirdek gerçek bant, inserter, buffer, backpressure, tükenme ve graf-güç davranışını kanıtlar; ancak ana oyun tick/UI/save akışına henüz bağlanmamıştır.

---

## 2. İnşa paleti gereksinimleri

Eski görünüm yalnız emoji/simge ağırlıklıydı ve her ürün okunabilir değildi.

Yeni kartlar şunları ayrı ve açık gösterir:

- ürün simgesi,
- ürünün tam adı,
- gereken adet,
- ücretsiz kuruluş hakkı,
- alan ve enerji metadata bilgisi.

Gerçek Chromium örneği:

```text
⬜ Demir Levha ×12
⚙️ Dişli ×4
Alan 5 m² · Enerji 0 kW
```

---

## 3. Savunma araştırmasına bağlı Yeryüzü Cephesi

Yerel tehdit kapısı canonical araştırma ağacındaki `defenseGrid` teknolojisidir.

### Araştırma öncesi

- `nextRaidAt = 0`
- HUD tehdit değeri `0`
- Yerel saldırı çözülmez
- Galaksi ekranında `Gezegen Savunması gerekli` açıklaması görünür
- Fabrika kurmak tek başına tehdit başlatmaz

### Araştırma sonrası

- Yerel tehdit zamanlayıcısı kurulur
- Tek seferlik `Yeryüzü savunma ağı etkin` istihbarat raporu oluşturulur
- Gerçek baskın/hasar/ganimet sistemi normal şekilde çalışır

First Orbit ve Galaktik Cephe kapısı bağımsız kalır; uzay tehdidi yine ilk orbital varlık sonrasında açılır.

---

## 4. Anlık fabrika üretim ve güç çekmecesi

Harita araç çubuğundaki `📈 Durum` düğmesi açılır bir rapor paneli gösterir.

### Genel özet

- aktif / toplam makine,
- toplam güç arzı,
- gerçek teslim edilen / talep edilen kW,
- bağlantısız makine sayısı,
- son güncelleme zamanı.

### Makine satırı

Her yerleşik makine için:

- ad ve entity kimliği,
- harita koordinatı,
- gerçek ürün/sn,
- çevrim süresi,
- gerçek / azami enerji çekişi,
- çalışma veya duruş sebebi.

Durum örnekleri:

- `Çalışıyor`
- `Girdi veya depo bekliyor`
- `Hat yok`
- `Güç/yakıt yok`

### Santral satırı

- gerçek / azami güç üretimi,
- yakıt stoku,
- yakıt tüketimi/sn,
- `Yük hattı yok`, `Yakıt yok` veya `Hazır` durumu.

Panel `aria-expanded` / `aria-controls` ile erişilebilir ve ESC/mobil geri iptal zincirine dahildir.

---

## 5. P0 uzaysal çekirdek durumu

`src/core/spatial-sim.js` pakette korunur.

Bağımsız doğrulanan davranışlar:

- bant kesilince fırın durur,
- çıkış buffer'ı dolunca backpressure oluşur,
- yatak tükenince madenci durur,
- graf bağlantısı/yakıt yoksa üretim sıfırdır,
- v16 aggregate envanteri güvenli biçimde ambara aktarılır.

**Sınır:** Canlı oyun hâlâ aggregate üretim motorunu kullanmaktadır. U4.3.3 durum çekmecesi bugünkü canlı motoru raporlar. Sonraki aşama, P0 çekirdeğini feature flag arkasında canvas, ana tick ve save/migrasyon akışına bağlamaktır.

---

## 6. Kabul sonuçları

| Kabul kapısı | Sonuç |
|---|---:|
| Node/regresyon paketleri | **27/27 PASS** |
| P0 spatial assertion | **20/20 PASS** |
| Stabilite | **3.000 çevrim PASS** |
| Chromium senaryoları | **8/8 PASS** |
| Palet simge + metin gereksinimleri | PASS |
| Savunma araştırması öncesi tehdit | `0` / kilitli |
| `defenseGrid` sonrası zamanlayıcı | PASS |
| Canlı üretim/güç çekmecesi | PASS |
| Panel ARIA sözleşmesi | PASS |
| 390 px yatay taşma | Yok |
| Beklenmeyen browser/page hatası | `0` |

Yeni Chromium testinde doğrulanan örnek:

```text
Demir Madeni: 1/sn · çevrim 1sn · enerji 8/8 kW · Çalışıyor
Kömür Jeneratörü: 60/60 kW · kömür 11.79 · tüketim 0.5/sn · Hazır
```

---

## 7. Bilinen sınırlar

1. Canlı durum paneli şu an aggregate motor verisini raporlar; spatial buffer/belt dolulukları P0 entegrasyonundan sonra eklenecektir.
2. `defenseGrid` kapısının araştırma maliyeti ve oyunun tehdit açılma temposu uzun süreli gerçek oynanışla dengelenmelidir.
3. Gerçek Android donanım geri tuşu ve dar ekran rapor paneli release cihazında ayrıca kabul edilmelidir.

---

## 8. Başkan kararı

**U4.3.3 kabul edildi ve donduruldu.**

Sıradaki tek ana iş:

> **P0 → P1 Spatial Integration Bridge**

- `spatialSim` feature flag ile ana tick entegrasyonu,
- canvas bant slotu/doygunluk/inserter durumu,
- v16 → v17 migrator,
- canlı durum çekmecesini entity buffer ve belt durumlarıyla besleme,
- active-set scheduler ve mobil LOD kabul testleri.

---

## 9. Durum kaydı

```text
Source of truth:
AXYON_Orbital_Ascendancy_v4.5.6_U4.3.3_Factory_Intelligence.zip

Sürüm:
4.5.6-u4.3.3

Save şeması:
v16

Son karar:
Okunabilir palet maliyetleri, defenseGrid tehdit kapısı ve canlı fabrika raporu kabul edildi.

Sıradaki iş:
P0 → P1 spatial-sim canlı entegrasyon köprüsü

Kritik risk:
Mobil uzaysal simülasyon performansı ve v16 → v17 migrasyonu
```
