# AXYON: Orbital Ascendancy v4.5.2 U4.2
## Authoritative Server Prototype & CAS Reconciliation — Entegrasyon ve Kabul Raporu

**Sürüm:** `4.5.2-u4.2`  
**Save şeması:** `v16`  
**Taban:** U4.1 Command Authority  
**Durum:** U4.2 kabul kapıları geçti

## Yönetici özeti

U4.2, U4.1'de kurulan idempotent istemci komut sözleşmesini gerçek bir Node HTTP yetkili sunucu prototipine bağlar. Server kendi canonical state kopyasını kullanır; istemcinin kredi, envanter veya üretim sonucu otorite kabul edilmez.

Aynı actor için eşzamanlı istekler actor-keyed mutex ile sıraya alınır. `(actorId, commandId)` command ledger, `(actorId, sourceId, sequence)` sequence claim ve `expectedRevision` CAS kontrolü birlikte çalışır. Başarılı komutta yetkili state, receipt ve domain event-outbox tek senkron kritik bölümde commit edilir.

## Tamamlanan ana sistemler

- UI'sız canonical ekonomi/domain server runtime
- Actor başına transaction kuyruğu
- Command ID unique ledger ve fingerprint conflict
- Source/sequence unique claim
- Server revision CAS
- State + receipt + event-outbox birlikte commit
- Commit öncesi rollback/failpoint güvenliği
- Gerçek Node HTTP command/snapshot/health endpointleri
- Actor header kontrolü, 64 KiB body sınırı ve rate limit
- Server snapshot client reconciliation
- Client command revision ile server revision hizalama
- Fabrika ve kalan değerli kullanıcı işlemlerinin command katmanına taşınması
- Receipt ve snapshot JSON Schema sözleşmeleri

## Bağımsız yarış sonuçları

### Aynı komut, iki eşzamanlı istek

- Uygulanan: 1
- Duplicate receipt: 1
- Üretilen gemi kuyruğu: 1
- Server revision: 1
- Event-outbox kaydı: 1

### Farklı komutlar, aynı expected revision

- Commit olan: 1
- `stale_revision`: 1
- Kayıp güncelleme: yok
- Reddedilen komuttan event üretimi: yok

### Zorlanmış commit hatası

`before_commit` failpoint sonucunda:

- Actor state değişmedi
- Server revision değişmedi
- Command ledger değişmedi
- Sequence ledger değişmedi
- Event-outbox değişmedi
- Aynı komut sonraki denemede başarıyla uygulandı

## Command kapsamı

U4.2 ile kalan değer etkili yollar da merkezi command katmanına alındı:

- Bina yerleştirme, taşıma ve silme
- Konveyör ve enerji hattı ekleme/silme
- Sektör açma
- Manuel üretim
- Otomasyon çekirdeği yükseltme
- Makine ve santral sınıf yükseltme
- Depo yükseltme
- Araştırma iptali ve %70 iade
- Ürün bazlı otomatik satış
- Ürün bazlı elde tutma oranı

`main.js` içinde bu işlemler için doğrudan Economy mutasyon çağrısı kalmadığı regresyon testiyle doğrulandı.

## Reconciliation davranışı

- Yanlış actor snapshot'ı reddedilir.
- Eski server revision snapshot'ı reddedilir.
- Server state normalize edilerek uygulanır.
- Cihaza ait tema/ayarlar korunur.
- Eski local outbox temizlenir.
- `needsReconcile` kapanır.
- Local command revision, server revision'a eşitlenir.

## Test matrisi

- Node/regresyon dosyası: **17/17 PASS**
- Stabilite: **3.000 deterministik çevrim PASS**
- U1–U4.1 regresyonları: **PASS**
- U4.2 gerçek HTTP duplicate yarışı: **PASS**
- Unique command ve source-sequence conflict: **PASS**
- CAS yarış testi: **PASS**
- Transaction rollback: **PASS**
- Actor izolasyonu ve farklı actor paralelliği: **PASS**
- Event-outbox publish idempotency: **PASS**
- HTTP actor auth / invalid JSON / rate limit: **PASS**
- Chromium U4.2 command + reconciliation: **PASS**
- Mobil 390 px yatay taşma: **yok**
- Beklenmeyen browser hatası: **0**

Toplu `run-acceptance.sh`, çalışma ortamının süre sınırında U4 Chromium çıktısından sonra sonlanmıştır. U4.1 ve U4.2 Chromium testleri ayrıca ayrı çalıştırılarak PASS alınmıştır; bu durum ürün hatası olarak değerlendirilmemiştir.

## Mimari sınırlar

1. Server repository bellek içidir; süreç kapanınca server state kaybolur.
2. İstemci henüz HTTP server'a canlı bağlanmıyor; client ve server kabul kapıları ayrıdır.
3. `x-axyon-actor` yalnız prototip kimliğidir; JWT/OAuth değildir.
4. Gerçek PostgreSQL/CockroachDB unique constraint ve transaction izolasyonu henüz sınanmadı.
5. Shard router, global pazar, savaş servisi, leaderboard ve çok-bölge failover yoktur.
6. U4.2 ölçek mimarisini doğrular fakat milyon kullanıcı yük testi değildir.

## Başkan kararı

**U4.2 kabul edildi.** Sunucu prototipi, idempotency ve CAS ilkelerini gerçek eşzamanlı HTTP isteklerinde doğrulamıştır. Üretim backend iddiası yapılmaz.

## Sıradaki aşama

### U4.3 — Persistent Transaction Store & Client Network Adapter

- Kalıcı transaction repository arayüzü
- PostgreSQL uyumlu unique command/sequence tabloları
- State + receipt + event-outbox tek DB transaction
- Client HTTP adapter, retry ve ACK/snapshot akışı
- Çevrimdışı outbox gönderimi ve reconciliation
- 100+ eşzamanlı komut ve crash/restart testleri
