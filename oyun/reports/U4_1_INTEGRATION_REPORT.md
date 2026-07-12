# AXYON: Orbital Ascendancy v4.5.1 U4.1 — Command Authority
## Entegrasyon, İdempotency ve Kabul Raporu

**Sürüm:** 4.5.1-u4.1  
**Save şeması:** v16  
**Taban:** v4.5.0 U4 Data Vault  
**Durum:** Release adayı — U4.1 kabul kapıları geçti

---

## 1. Yönetici özeti

U4.1, değerli oyuncu işlemlerini doğrudan UI çağrılarından çıkarıp UI ve kayıt teknolojisinden bağımsız bir domain command katmanına bağlar. Aynı komut ağ tekrarında, eşzamanlı çağrıda veya kayıt yüklenmesinden sonra tekrar oynatıldığında handler ikinci kez çalışmaz; saklı makbuz döndürülür.

Bu sürüm gerçek multiplayer backend içermez. Yerel makbuzlar anti-cheat veya küresel exactly-once garantisi değildir. Ortak evrende nihai garanti, sunucuda `(actor_id, command_id)` unique constraint ile state, receipt ve event-outbox kaydının aynı veritabanı transaction'ında commit edilmesiyle sağlanacaktır.

Ana sonuçlar:

- Gerçek gemi üretim komutu duplicate ve eşzamanlı retry altında yalnız bir kez uygulandı.
- Aynı kimlikle farklı payload `command_id_conflict` ile reddedildi.
- Eski expected revision `stale_revision` ile reddedildi.
- Retention dışına çıkan eski sequence high-water ile yeniden uygulanmadı.
- Makbuzlar v16 save içinde kaldı; reload replay ikinci uygulama üretmedi.
- 256 öğelik server outbox sınırı dolduğunda 257. değerli işlem state'i değiştirmeden reddedildi.
- Server ACK fingerprint ve actor ile doğrulandı; tekrar ACK idempotent işlendi.
- Sunucu zamanı RTT orta noktasıyla örneklendi; monoton lazy elapsed aynı zaman dilimini iki kez ödemedi.
- 390 px mobil görünümde yatay taşma ve beklenmeyen browser hatası oluşmadı.

---

## 2. Domain command zarfı

Her komut aşağıdaki kimlik ve doğrulama alanlarını taşır:

| Alan | Rol |
|---|---|
| `commandId` | Tekrar gönderimlerde değişmeyen işlem kimliği |
| `actorId` | Oyuncu/profil sahipliği |
| `sourceId` | Sekme, cihaz veya istemci oturumu |
| `sequence` | Kaynak içindeki monoton sıra |
| `type` | Domain işlem türü |
| `payload` | İşlem girdileri |
| `fingerprint` | Canonical payload + komut kimliği özeti |
| `expectedRevision` | Komutun beklediği otorite revizyonu |
| `issuedAt` | Komut üretim zamanı |
| `schemaVersion` | Sözleşme sürümü |

Makine okunabilir sözleşme: `data/contracts/domain-command-v1.schema.json`.

### Yerel yürütme kuralları

1. Aynı kaynak, sıra ve fingerprint tekrar gelirse önceki makbuz döner.
2. Aynı kaynak/sıra farklı içerikle gelirse kimlik çakışması oluşur.
3. Güncel olmayan revizyon state'i değiştirmez.
4. Actor uyuşmazlığı komut kimliğini zehirlemeden reddedilir.
5. Kaynak başına son 128 ayrıntılı makbuz tutulur.
6. Daha eski sequence'ler ayrıntılı makbuz silinse bile high-water altında replay'e kapalıdır.

---

## 3. Canlı komutlara taşınan sistemler

- Pazar aç/kapat, elde tutma ve ağ geliştirme
- Kuruluş sözleşmeleri
- Araştırma ve tekrarlı araştırma
- Sistem tarama
- Gemi ve uydu tersane kuyrukları
- Savunma cohort üretimi
- Casusluk, kolonileştirme ve filo gönderme
- Bakım tesisi, onarım ve tesis yükseltmeleri
- Gezegen/yörünge kapasitesi, altyapı varlıkları ve savunma kompleksleri

Canvas yerleşimi ve bazı düşük riskli yerel ayarlar henüz command katmanına taşınmamıştır.

---

## 4. Offline outbox ve sunucu ACK sözleşmesi

Sunucu modu için kabul edilmiş komutlar sınırlı outbox'a alınabilir:

- Bekleyen üst sınır: 256
- Tek batch üst sınırı: 100
- Limit doluysa komut state'e uygulanmadan `outbox_full` döner.
- ACK, command ID yanında fingerprint ve actor ile doğrulanır.
- Aynı ACK ikinci kez gelirse `duplicate_ack` döner.
- Sunucu reddi `needsReconcile` açar; client tahmini otorite kabul edilmez.
- ACK geçmişi sınırlıdır ve server revision/time metadata tutulur.

Makine okunabilir sözleşme: `data/contracts/server-command-ack-v1.schema.json`.

Mevcut tek oyunculu UI `queueForServer:false` kullanır. Outbox yalnız gelecekte server-owned işlemlerde etkinleştirilecektir.

---

## 5. Sunucu zamanı ve lazy production arayüzü

`Axyon.ServerClock`:

- RTT orta noktasından server offset ve belirsizlik üretir.
- Eski server revision/time örneklerini reddeder.
- İstemci saati geriye alınsa bile monoton yetkili zaman sağlar.
- `son çözülen sunucu zamanı → güncel sunucu zamanı` aralığını gerektiğinde hesaplar.
- Aynı `serverNow` ikinci kez işlendiğinde sıfır elapsed döndürür.
- Offline cap dışındaki süreyi sonraki çağrıda tekrar ödemez.

Bu sürüm mevcut tek oyunculu canlı tick'i kaldırmaz; sunucu prototipinin domain sözleşmesini hazırlar.

---

## 6. Kabul sonuçları

### Node ve regresyon

- 14/14 test paketi PASS
- 3.000 deterministik stabilite çevrimi PASS
- U1, U2, U3, U3.1 ve U4 regresyonları PASS
- U4.1 idempotent command testi PASS
- U4.1 server-time/lazy elapsed testi PASS

### Gerçek Chromium

| Kontrol | Sonuç |
|---|---:|
| U3 arka plan, pinch, save recovery | PASS |
| U4 IndexedDB/fallback sözleşmesi | PASS |
| Gerçek gemi komutu ilk uygulama | 1 |
| Aynı komut ikinci uygulama | 0 — duplicate receipt |
| Payload kimlik çakışması | Reddedildi |
| Stale revision | Reddedildi |
| Server bridge queue + ACK | PASS |
| ACK sonrası bekleyen outbox | 0 |
| Yetkili server revision | 7 |
| v16 reload sonrası receipt | Korundu |
| 390 px yatay taşma | Yok |
| Beklenmeyen page/console hatası | 0 |

Kasıtlı save/vault failure testlerinde görünen hata satırları beklenen test enjeksiyonlarıdır ve `unexpectedConsoleErrors` listesine girmez.

---

## 7. Sunucu tarafı üretim şartı

Gerçek ortak evrende aşağıdaki adımlar tek transaction içinde yapılmadan exactly-once iddiası kurulmayacaktır:

1. `(actor_id, command_id)` unique constraint ile komutu claim et.
2. Actor, shard, sahiplik, rate limit, payload ve expected revision doğrula.
3. Yetkili state'i kilitle veya compare-and-swap uygula.
4. Domain handler'ı uygula.
5. Yeni state revision, command receipt ve event-outbox kaydını aynı transaction'da commit et.
6. Tekrar komutta handler çalıştırmadan saklı sonucu döndür.

---

## 8. Bilinen sınırlar

1. Gerçek API Gateway, hesap servisi ve yetkili oyun sunucusu henüz yoktur.
2. Ayrı sekme veya cihazların farklı komutları yerel state üzerinde hâlâ last-write-wins çatışmasına girebilir.
3. İstemci makbuzları değiştirilebilir; anti-cheat değildir.
4. Sunucu reddi sonrası otomatik snapshot/CAS reconciliation henüz yoktur.
5. Canvas yerleşimi ve kalan düşük riskli doğrudan eylemler tam command kapsamına alınmamıştır.
6. Gerçek Android cihaz ve gerçek HTTPS origin kabul testi henüz yapılmamıştır.

---

## 9. Başkan kararı

**U4.1 kabul edildi.** İdempotent domain command, offline outbox/ACK sözleşmesi ve server-time/lazy resolver temeli aynı pakette çalışmaktadır.

Sıradaki ana geliştirme:

> **U4.2 — Authoritative Server Prototype & CAS Reconciliation**

Öncelikler:

- Gerçek API/server iskeleti ve yetkili oyuncu state'i
- `(actor_id, command_id)` unique ledger
- State + receipt + event-outbox tek transaction
- Server revision compare-and-swap ve snapshot reconciliation
- Çoklu sekme/cihaz çatışma testleri
- Yük, replay, rate-limit ve kötü niyetli istemci testleri

---

## 10. Durum kaydı

**Source of truth:** `AXYON_Orbital_Ascendancy_v4.5.1_U4.1_Command_Authority.zip`  
**Sürüm:** `4.5.1-u4.1`  
**Save şeması:** `v16`  
**Son karar:** U4.1 command authority kabul edildi.  
**Kritik sınır:** Sunucu otoritesi henüz uygulanmadı.  
**Bitiş kriteri:** Duplicate/replay/conflict/stale/outbox/ACK/server-time testleri ve eski tüm regresyonlar geçti.
