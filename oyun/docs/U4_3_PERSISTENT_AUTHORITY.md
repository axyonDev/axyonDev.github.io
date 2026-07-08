# U4.3 — Persistent Transaction Store & Client Network Adapter

## Amaç

U4.3, U4.2 yetkili servis prototipini süreç kapanınca kaybolmayan ACID transaction deposuna ve oyunun gerçek HTTP bağlantı katmanına bağlar. Bu sürüm production çok-bölge backend değildir; ancak süreç yeniden başlatma, commit/ACK kaybı, iki bağımsız repository yarışı, offline outbox ve snapshot uzlaştırması gerçek dosya tabanlı transaction deposu üzerinde çalışır.

## Çalışan kalıcı depo

`server/sqlite-authority-repository.js`, Node 22 `node:sqlite` ile WAL ve `synchronous=FULL` kullanır. Aşağıdaki kayıtlar aynı transaction içinde tutulur:

- Yetkili actor snapshot ve monoton server revision
- `(actor_id, command_id)` unique command ledger
- `(actor_id, source_id, sequence)` unique sequence ledger
- Command receipt
- Domain event-outbox

Commit, actor revision üzerinde CAS uygular. İki ayrı Node worker/SQLite bağlantısı aynı revision ile yarıştığında yalnız biri state'i ilerletir; diğeri `stale_revision` alır. Aynı command ID tekrarında saklı receipt döner.

## Crash/restart garantisi

- `before_commit` arızasında hiçbir tablo değişmez.
- Commit tamamlanıp ACK kaybolursa istemci aynı komutu tekrar gönderebilir; restart sonrasında receipt bulunur ve komut ikinci kez uygulanmaz.
- Event publisher mesajı okuyup işaretlemeden çökerse event `pending` kalır.
- `published` işareti de süreç yeniden başlatma sonrasında korunur.

## Gerçek istemci bağlantısı

`src/core/server-network.js`:

- yapılandırılabilir HTTP/HTTPS authority URL,
- gerçek offline outbox gönderimi,
- fingerprint doğrulamalı ACK,
- ağ kesintisinde komutun outbox'ta kalması,
- server reddinde `needsReconcile`,
- yetkili snapshot çekme ve uygulama,
- 5 saniyelik kontrollü auto-sync,
- tek eşzamanlı sync kilidi ve timeout

sağlar. Sunucu yapılandırılmamışsa oyun mevcut yerel modda çalışır. Bağlantı etkinse değerli komutlar optimistic olarak uygulanır, outbox'a alınır ve sunucu ACK/snapshot'ı ile kesinleştirilir.

## PostgreSQL üretim hedefi

SQLite, U4.3 kabul ve tek-node referans deposudur; milyon kullanıcı production veritabanı değildir. `server/postgres/001_authority_schema.sql` production tablo/unique/outbox sözleşmesini tanımlar. Production geçişinde:

- actor hash partition,
- connection pool,
- `SELECT ... FOR UPDATE` veya CAS,
- tek DB transaction,
- event publisher için `FOR UPDATE SKIP LOCKED`,
- shard routing ve read replica stratejisi

zorunludur.

## Kabul kapıları

- Tam process restart sonrası state/receipt/event korunması
- 128 eşzamanlı aynı komutta tek commit
- İki bağımsız Node worker bağlantısında CAS yarışı
- Commit sonrası ACK kaybı ve restart replay
- Event publisher crash/retry
- Gerçek Chromium → HTTP → SQLite ACK
- Sunucu kapalıyken outbox koruması
- Aynı DB ile server restart sonrası outbox teslimi
- Stale komutta snapshot reconciliation
- Negatif `flow.*` değerlerinin v16 signed Decimal save/reload doğrulaması
- U3, U4, U4.1 ve U4.2 Chromium regresyonlarının korunması

Toplam kabul zinciri: **22 Node/regresyon paketi + 5 Chromium kapısı**.

## Açık sınırlar

- JWT/OAuth ve gerçek hesap servisi yoktur.
- SQLite tek-node referans deposudur; production yatay ölçek deposu değildir.
- Global pazar, savaş, leaderboard ve shard router ayrıştırılmamıştır.
- Offline komutların semantik yeniden tabanlama/merge sistemi yoktur; stale komutta server snapshot otoritedir.
- PostgreSQL şeması paketlenmiştir fakat bu ortamda gerçek PostgreSQL cluster testi yapılmamıştır.
