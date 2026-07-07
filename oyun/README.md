# Axyon Idle Factory: First Orbit & Dominion — v4.4 U1 Foundation

Bu paket, **Warfront Command v4.3 oynanışını koruyan** ilk gerçek v4.4 entegrasyon patch'idir. İlk Yörünge ekonomisi ve yeni üretim zincirleri henüz oynanışa açılmamıştır. U1'in görevi kayıt ve veri temelini güvenli biçimde hazırlamaktır.

## U1'de etkin olanlar

- Save şeması v16
- v15 → v16 kayıpsız ve transactional migrasyon
- Migrasyon öncesi değişmez SHA-256 yedeği
- Bozuk/truncated kayıtta rollback ve otomatik kayıt kilidi
- `break_eternity.js@2.1.3` + merkezi `Axyon.EconomyNumber` adaptörü
- Frozen `game-data.v4.4.final.json` canonical veri yükleyicisi
- Profil oluşturma, değiştirme, silme, dışa/içe aktarma ve tam sıfırlama için v16 depolama
- Service worker/offline asset listesinde yeni altyapı dosyaları

## Bilinçli olarak henüz etkin olmayanlar

- Sıfır kredili First Orbit başlangıcı
- Yeni v4.4 makine/teknoloji tariflerinin gerçek oynanışı
- Decimal tabanlı tüm ekonomi tick'i
- Gezegen/yörünge cohort savunma oynanışı
- Gerçek PvP sunucu otoritesi

Feature flag'ler `data/feature-flags.js` içindedir:

```text
V44_SAVE_V16_ENABLED=true
V44_CANONICAL_DATA_ENABLED=true
V44_ZERO_CREDIT_GAMEPLAY_ENABLED=false
V44_DECIMAL_RUNTIME_ENABLED=false
```

## Kayıt güvenliği

Aktif v15 kayıt ilk açılışta:

1. Ham metin olarak okunur; unsafe integer literal JavaScript Number'a çevrilmez.
2. SHA-256 isimli `.backup.v15.*` anahtarına yedeklenir.
3. Geçici v16 anahtarına dönüştürülür.
4. v16 doğrulaması yapılır.
5. Başarılıysa aktif kayıt değiştirilir.
6. Hata varsa orijinal kayıt geri yüklenir ve otomatik kayıt durdurulur.

U1 runtime mevcut oyun çekirdeğiyle uyumluluk için normal JavaScript Number kullanır. Elle değiştirilmiş aşırı büyük v15 değerleri v16 depoda eksiksiz korunur; runtime görünümü güvenli üst sınıra sıkıştırılır ve değer değiştirilmediği sürece exact shadow yeniden kayıtta korunur. Tam Decimal gameplay U2 işidir.

## Test

Windows: `run-tests.bat`

Linux/macOS: `./run-tests.sh`

Test kapsamı:

- Core üretim, pazar, araştırma, filo, tamir
- 12.000 çevrim stabilite fuzz testi
- Profil izolasyonu ve tam reset
- v16 kayıt round-trip
- Unsafe integer exact migration
- Corrupt kayıt rollback/autosave block
- Frozen canonical veri sayıları ve ID bütünlüğü
- DOM/service-worker asset kontratları
- Chromium inline browser smoke testi

## Source of truth

- Tasarım: `Axyon_v4.4_Final_Design_Freeze_Report.md`
- Canonical veri: `data/canonical/game-data.v4.4.final.json`
- Save şeması: `data/canonical/save-state-v16.schema.json`
- U1 oynanabilir taban: bu paket

## Sıradaki iş

**U2 — Decimal Runtime & First Orbit Economy Bridge**

Ekonomi çekirdeğindeki kredi, stok, üretim, pazar ve maliyet işlemleri `EconomyNumber` üzerinden çalıştırılacak; ardından sıfır kredili başlangıç ve Mk 0 uydu zinciri açılacaktır.
