# AXYON: Orbital Ascendancy v4.5.0 U4
## Data Vault & Durability Foundation — Entegrasyon ve Kabul Raporu

**Sürüm:** `4.5.0-u4`  
**Save şeması:** `v16` — değişmedi  
**Taban:** `4.4.1-u3.1 Save Recovery & Accessibility Hotfix`  
**Durum:** U4 istemci veri dayanıklılığı kabul kapıları geçti

## 1. Yönetici özeti

U4, çalışan oyun döngüsünü ve U3 Planetary Bastions içeriğini değiştirmeden kayıt sistemini tek kopyalı localStorage modelinden çift katmanlı, revizyonlu ve onarılabilir veri kasasına taşır.

- IndexedDB ana dayanıklı kasadır.
- localStorage senkron uyumluluk aynası ve fallback olarak korunur.
- U3.1 profilleri ilk açılışta kayıpsız içe alınır.
- Checksum ve yapısal v16 doğrulaması yapılır.
- Tek sağlam kopya diğer katmanı onarır.
- İki güncel kopya bozulursa son geçerli yedeğe rollback yapılır.
- Eski nesiller anahtar başına en fazla 5 adet tutulur.
- Eşzamanlı/stale revizyonlar transaction içinde monoton yükseltilir.
- Silmeler tombstone ile korunur; yarım kalan silme işleminde veri geri dirilmez.

## 2. Veri mimarisi

| Katman | Rol |
|---|---|
| IndexedDB `axyon_orbital_ascendancy` | Ana dayanıklı kayıt kasası |
| `records` store | Güncel profil, aktif profil ve save kayıtları |
| `backups` store | Değiştirilen önceki geçerli nesiller |
| localStorage | Hızlı uyumluluk aynası ve fallback |
| `axyon_storage_mirror_meta_v1` | Yerel revizyon, checksum ve tombstone metadata |

Oyun durum şeması `v16` olarak korunmuştur. U4 saklama katmanıdır; ekonomi veya oynanış migrasyonu değildir.

## 3. Açılış uzlaştırması

1. Veri kasası açılır.
2. IndexedDB ve localStorage kritik anahtarları toplanır.
3. Checksum ve save yapısı doğrulanır.
4. Geçerli yüksek revizyon seçilir.
5. Sağlam kopya diğer katmanı onarır.
6. İki güncel kopya da geçersizse en yeni geçerli backup geri yüklenir.
7. Geçerli nesil yoksa yapısal kilit korunur; sessiz overwrite yapılmaz.

## 4. Yazma ve silme güvenliği

- Save önce v16 payload üretip localStorage temp alanında doğrulanır.
- Yerel ayna ve metadata senkron güncellenir.
- IndexedDB yazıları sıralı kuyruğa alınır.
- Transaction mevcut revizyonu tekrar okuyarak stale revizyonu yükseltir.
- Önceki farklı geçerli nesil backup store'a taşınır.
- IndexedDB hatasında localStorage son ilerlemeyi korur ve görünür uyarı açılır.
- Retry veya 30 saniyelik kontrollü autosave denemesi dayanıklı commit'i tamamlar.
- Profil ve tüm veri silmeleri `deleted:true` tombstone kullanır.

## 5. Test sonuçları

### Node/regresyon

- 12 test dosyası: **PASS**
- 3.000 deterministik stabilite çevrimi: **PASS**
- U1/U2/U3/U3.1 regresyonları: **PASS**
- 1.000.000 birim cohort hesabı: **PASS**

Yeni U4 veri testi şunları gerçek çalışma akışıyla doğruladı:

- U3.1 local-only kaydın kasaya aktarılması
- dual-write ve son yazanın kazanması
- bozuk localStorage aynasının IndexedDB'den onarılması
- iki kopya bozukken backup rollback
- 5 nesillik retention
- aynı revizyonlu farklı yazının monoton revizyona yükseltilmesi
- IndexedDB hata + local mirror koruması + retry
- tombstone ile silinen kaydın dirilmemesi

### Chromium

- Async U4 bootstrap: **PASS**
- Dayanıklı save/flush sözleşmesi: **PASS**
- Enjekte edilmiş kasa hatasının görünür olması: **PASS**
- Kullanıcı retry sonrası uyarının kapanması ve durable kayıt: **PASS**
- IndexedDB reddedildiğinde localStorage fallback: **PASS**
- 390 px mobil yatay taşma: **yok**
- U3 tam smoke: pinch `1.00 → 1.92`, offline resume, viewport culling ve erişilebilirlik: **PASS**

### Native IndexedDB adaptörü

Standart uyumlu IndexedDB test motorunda gerçek adapter yolu çalıştırıldı:

- `open` ve schema upgrade
- `records` object store
- `backups` index
- readwrite transaction
- yeniden açılışta local mirror hydration
- tombstone yazımı

Sonuç: **PASS**

## 6. Bilinen sınırlar

1. Gerçek `http/https` origin ve gerçek Android cihazda native IndexedDB kabul testi henüz yapılmadı.
2. U4 kasası istemci dayanıklılığıdır; ortak evrende ekonomi/savaş otoritesi değildir.
3. Gerçek oyunculu backend, sunucu zamanı ve idempotent ekonomi endpoint'leri henüz yoktur.
4. Birden fazla sekmede son geçerli yazı kazanır; gelecekte server revision/command acknowledgement ile genişletilecektir.

## 7. Ölçek kararı

Milyon kullanıcı ve binlerce eşzamanlı oyuncu hedefi korunmuştur.

- Client kayıtları cache/offline yardımcı katmandır.
- Kredi, kaynak, üretim, pazar, filo, savaş ve mülkiyetin nihai sahibi sunucu olacaktır.
- Milyonluk savunma ve üretim birimleri aggregate/cohort olarak kalacaktır.
- Sürekli oyuncu tick'i yerine lazy time resolution kullanılacaktır.
- Değerli komutlar idempotent işlem kimliği taşıyacaktır.

## 8. Başkan kararı

**U4 Data Vault istemci dayanıklılığı katmanı kabul edildi.**

Sıradaki geliştirme:

> **U4.1 — Server-Ready Domain & Idempotent Command Foundation**

Öncelikler:

1. UI ve storage'dan bağımsız domain command sözleşmesi
2. UUID/işlem kimliği ve tekrar gönderim koruması
3. Offline komut kuyruğu zarfı
4. Sunucu zamanı/lazy production resolver arayüzü
5. Gerçek cihaz ve gerçek-origin IndexedDB testi

## 9. Durum kaydı

- **Source of truth:** paketleme sonunda oluşturulan `AXYON_Orbital_Ascendancy_v4.5.0_U4_Data_Vault.zip`
- **Sürüm:** `4.5.0-u4`
- **Save şeması:** `v16`
- **Son karar:** U4 veri kasası kabul edildi
- **Sıradaki iş:** U4.1 idempotent domain command foundation
- **Kritik risk:** Sunucu otoritesi henüz yok
- **Bitiş kriteri:** Aynı ekonomi komutu tekrar gönderildiğinde yalnız bir kez uygulanması ve UI/storage bağımsız test edilmesi
