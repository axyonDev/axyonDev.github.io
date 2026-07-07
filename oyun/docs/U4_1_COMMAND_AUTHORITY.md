# U4.1 Command Authority — İdempotent Domain Komut Sözleşmesi

## Amaç

U4.1, değerli oyuncu işlemlerini doğrudan DOM olaylarından ekonomi fonksiyonlarına çağrı olmaktan çıkarıp taşınabilir bir komut zarfına bağlar. Bu sürüm hâlâ local-first prototiptir; sunucu backend içermez. Kurulan sözleşme, ileride aynı komutların API Gateway ve yetkili oyun sunucusuna gönderilebilmesini sağlar.

## Komut zarfı

Her komut aşağıdaki alanları taşır:

- `commandId`: tekrar gönderimlerde değişmeyen işlem kimliği
- `actorId`: komutu gönderen oyuncu/profil
- `sourceId`: tarayıcı sekmesi veya istemci oturumu
- `sequence`: kaynak içindeki monoton sıra
- `type`: domain işlem türü
- `payload`: yalnız işlem girdileri
- `issuedAt`: istemci üretim zamanı
- `expectedRevision`: komutun beklediği otorite revizyonu
- `schemaVersion`: sözleşme sürümü

Makine okunabilir sözleşme: `data/contracts/domain-command-v1.schema.json`.

## Yerel idempotency kuralları

1. Aynı `sourceId + sequence + fingerprint` tekrar gelirse handler yeniden çalışmaz; önceki makbuz döner.
2. Aynı sıra farklı payload veya kimlikle gelirse `command_id_conflict` oluşur.
3. Makbuzu retention dışına çıkmış eski sıra, high-water işareti sayesinde yeniden uygulanmaz; `replay_below_high_water` döner.
4. `expectedRevision` güncel değilse komut `stale_revision` ile reddedilir.
5. Actor eşleşmiyorsa komut kayda dahi alınmaz; meşru komut kimliği zehirlenmez.
6. Payload canonical sırayla SHA-256 fingerprint alır; alan sırası fingerprint'i değiştirmez.
7. Kaynak başına son 128 ayrıntılı makbuz tutulur; daha eski sıralar high-water ile replay'e kapalı kalır.

## Taşınan gerçek işlemler

U4.1 komut çekirdeğine bağlanan ana kullanıcı işlemleri:

- Pazar aç/kapat, elde tutma ve ağ geliştirme
- Kuruluş sözleşmeleri
- Ana ve tekrarlı araştırma başlatma
- Sistem tarama
- Gemi ve uydu üretim kuyruğu
- Savunma cohort üretimi
- Casusluk, kolonileştirme ve filo gönderme
- Bakım tesisi ve tamirat kuyruğu
- Gezegen/yörünge kapasitesi, altyapı varlığı ve savunma kompleksi işlemleri

Canvas yerleşimi ve bazı düşük riskli yerel ayarlar sonraki domain ayrıştırma adımlarında aynı sözleşmeye taşınacaktır.

## Offline outbox ve sunucu ACK

`queueForServer:true` ile çalıştırılan kabul edilmiş komutlar, oyuncu durumunda sınırlı bir outbox'a eklenir.

- Üst sınır: 256 bekleyen komut
- Limit dolduğunda yeni server-owned işlem uygulanmaz; `outbox_full` döner.
- Böylece sunucuya hiç gönderilemeyecek bir değerli işlem istemcide sessizce uygulanmaz.
- `outboxBatch()` en fazla 100 komutluk gönderim grubu üretir.
- ACK fingerprint ve actor ile doğrulanır.
- Aynı ACK tekrar gelirse idempotent biçimde `duplicate_ack` döner.
- Sunucu reddi `needsReconcile` işaretini açar; client tahmini otorite kabul edilmez ve server snapshot reconciliation gerekir.

Makine okunabilir ACK sözleşmesi: `data/contracts/server-command-ack-v1.schema.json`.

Mevcut tek oyunculu UI `queueForServer:false` ile çalışır; bağlantısız prototip outbox limitine takılmaz. Sunucu prototipi başladığında network adapter yalnız server-owned komutları outbox modunda yürütecektir.

## Sunucu tarafı zorunlu işlem modeli

Gerçek ortak evrende local makbuz yeterli değildir. Sunucu şu işlemleri tek veritabanı transaction'ında yapmalıdır:

1. `(actor_id, command_id)` unique constraint ile komutu claim et.
2. Actor, shard, ownership, rate limit, payload ve expected revision doğrula.
3. Yetkili state'i kilitle veya compare-and-swap uygula.
4. Domain handler'ı uygula.
5. Yeni state revision, command receipt ve event-outbox kaydını aynı transaction'da commit et.
6. Aynı komut tekrar gelirse handler çalıştırmadan saklı sonucu döndür.

Bu transaction olmadan “exactly once” iddiası yapılamaz. Mesaj kuyrukları at-least-once çalışabilir; idempotency sonucu tekilleştirir.

## Sunucu zamanı ve lazy production

`Axyon.ServerClock`:

- sunucu zamanı örneklerinden RTT orta nokta offset'i hesaplar,
- eski server revision/time örneklerini reddeder,
- istemci saati geri alınsa bile monoton zaman üretir,
- üretim sayaçlarını sürekli oyuncu tick'i olmadan `son yetkili zaman → şimdiki yetkili zaman` aralığında çözer,
- aynı `serverNow` ikinci kez işlendiğinde sıfır süre döndürerek çift üretimi engeller,
- offline cap uygulandığında cap dışı süreyi ikinci kez ödemez.

Bu katman henüz mevcut tek oyunculu ekonomi tick'inin yerine geçmez; sunucu prototipinin domain arayüzüdür.

## Açık sınırlar

- Ayrı sekmelerde üretilen farklı komutların state merge'i henüz sunucu CAS ile çözülmez; U4 last-write-wins riski sürer.
- İstemci command receipt'i anti-cheat değildir.
- Local source/makbuz retention üretim sunucusundaki kalıcı command ledger'ın yerini tutmaz.
- Sunucu reddi sonrası otomatik snapshot merge henüz yoktur.

## Kabul testleri

- `tests/u4-1-idempotent-commands.js`
- `tests/u4-1-server-time.js`
- `tests/u4-1-browser-smoke.py`

Testler gerçek gemi üretimi üzerinden duplicate, reload replay, payload conflict, stale revision, eşzamanlı tekrar, bounded receipt, outbox backpressure, ACK tekrarları ve lazy-time çift ödeme korumasını doğrular.
