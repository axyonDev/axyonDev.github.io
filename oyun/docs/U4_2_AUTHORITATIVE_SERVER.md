# U4.2 — Authoritative Server Prototype & CAS Reconciliation

## Amaç

U4.2, U4.1 istemci komut sözleşmesini gerçek bir yetkili sunucu prototipine bağlar. Prototip yalnız bir demo endpoint değildir: aynı actor için eşzamanlı komutları sıraya alır, komut kimliğini ve kaynak sırasını tekilleştirir, yetkili state revizyonunu compare-and-swap kuralıyla doğrular ve state + receipt + domain event-outbox kaydını tek kritik bölümde commit eder.

Bu sürüm üretim altyapısı değildir. Bellek içi repository; transaction, command ledger ve HTTP sözleşmesini bağımsız test edebilmek için kullanılır. Üretimde aynı repository arayüzü PostgreSQL/CockroachDB benzeri transaction destekli kalıcı depoya taşınacaktır.

## Bileşenler

- `server/runtime-factory.js`: UI ve tarayıcı olmadan canonical ekonomi/domain çekirdeğini yükler.
- `server/authoritative-repository.js`: actor başına mutex, yetkili snapshot, command ledger, source-sequence ledger ve event-outbox.
- `server/authority-service.js`: kimlik, fingerprint, unique claim, CAS revizyonu ve domain handler yürütme.
- `server/http-server.js`: gerçek Node HTTP API, actor başlığı doğrulaması, gövde sınırı ve rate limit.
- `src/core/server-reconciliation.js`: server snapshot'ını client state'e güvenli uygular; yerel ayarları korur, stale snapshot'ı reddeder ve eski outbox'ı temizler.

## Yetkili işlem sırası

1. Actor kimliği route/header/command arasında eşleştirilir.
2. `(actorId, commandId)` ledger kaydı aranır.
3. Aynı kimlik ve fingerprint varsa saklı receipt döner; handler çalışmaz.
4. Aynı kimlik farklı fingerprint taşıyorsa `command_id_conflict` döner.
5. `(actorId, sourceId, sequence)` daha önce başka komutça alınmışsa `source_sequence_conflict` döner.
6. Actor'ın yetkili snapshot'ı kopyalanır.
7. `expectedRevision`, server revision ile CAS karşılaştırılır.
8. Domain handler yalnız server kopyasında çalışır; client state kabul edilmez.
9. Başarılı sonuçta revision bir artar.
10. State, receipt ve event-outbox tek senkron kritik bölümde commit edilir.
11. Aynı actor kilidi bırakılır; farklı actor işlemleri paralel yürüyebilir.

## HTTP sözleşmesi

- `GET /health`
- `POST /v1/actors/{actorId}/commands`
- `GET /v1/actors/{actorId}/snapshot`

Kimlik prototipte `x-axyon-actor` başlığıyla taşınır. Bu yalnız test kimliğidir; üretimde imzalı access token ve gateway doğrulaması gereklidir.

## CAS ve yarış davranışı

- Aynı komut iki eşzamanlı istekle gelirse: biri uygular, diğeri duplicate receipt alır.
- Farklı iki komut aynı `expectedRevision` ile yarışırsa: yalnız ilk commit olur, diğeri `stale_revision` alır.
- Aynı command ID farklı payload ile gelirse: ikinci istek state'e dokunmadan conflict alır.
- Aynı source/sequence farklı command ID ile gelirse: sequence conflict alır.
- Commit öncesi zorlanmış hata state, ledger ve event üretmez; aynı komut güvenle tekrar denenebilir.

## Event-outbox

Başarılı her server-owned komut için bir domain event oluşturulur. Event, state/receipt commit'iyle aynı kritik bölümde yazılır ve `pending` durumunda kalır. Mesaj yayıncısı event'i dış kuyruğa gönderip `published` işaretleyebilir. Böylece mesajlaşma at-least-once olsa bile command receipt ve event ID tekrarları tüketici tarafında tekilleştirilebilir.

## Client reconciliation

Server reddi veya cihaz/sekme çatışmasında client snapshot ister. Reconciliation:

- actor ve schema doğrular,
- daha eski server revision'ı reddeder,
- server state'i normalize eder,
- cihaz temasını/ayarlarını korur,
- eski yerel outbox'ı temizler,
- `needsReconcile` bayrağını kapatır,
- local command revision ile server revision'ı hizalar,
- server revision/time bilgisini günceller.

## U4.2'de command katmanına alınan kalan işlemler

- Fabrika bina yerleştirme, taşıma, silme
- Konveyör ve enerji hattı ekleme/silme
- Sektör açma
- Manuel üretim
- Otomasyon çekirdeği yükseltme
- Makine/santral sınıf yükseltme
- Depo yükseltme
- Araştırma iptali ve iade
- Ürün bazlı oto-satış ve elde tutma oranı

Böylece client UI'daki kredi, malzeme, üretim veya refund etkili ana kullanıcı eylemleri merkezi command yolundan geçer.

## Açık sınırlar

- Repository bellek içidir; süreç kapanınca server verisi kaybolur.
- JWT/OAuth, gerçek hesap servisi ve shard router yoktur.
- Üretim DB unique constraint ve transaction izolasyonu henüz gerçek veritabanında denenmemiştir.
- NPC zamanlayıcıları, pazar eşleştirme, global savaş ve leaderboard servisleri henüz ayrıştırılmamıştır.
- Çok bölge aktif-aktif consensus ve disaster recovery U5+ kapsamıdır.

## Üretim geçiş kapısı

Gerçek backend kabulünden önce aynı testler kalıcı transaction veritabanında çalışmalıdır:

- 100+ eşzamanlı aynı command ID
- farklı payload command collision
- aynı revision üzerinde farklı komut yarışı
- transaction rollback/failover
- event publisher crash/retry
- actor başına ve shard başına rate limit
- snapshot/reconciliation ve command replay
