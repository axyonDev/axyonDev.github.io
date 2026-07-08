# AXYON: Orbital Ascendancy v4.5.3 U4.3
## Persistent Transaction Store & Client Network Adapter — Entegrasyon ve Kabul Raporu

**Sürüm:** `4.5.3-u4.3`  
**Save şeması:** `v16`  
**Taban:** `v4.5.2-u4.2 Authoritative Server Prototype`  
**Durum:** Release adayı — U4.3 kabul kapıları geçti

---

## 1. Yönetici özeti

U4.3, U4.2'de bellek içinde çalışan yetkili sunucu prototipini süreç yeniden başlatıldığında da state, command receipt ve event-outbox bilgisini koruyan gerçek bir transaction deposuna bağlar. Oyun istemcisi ilk kez gerçek HTTP authority adapter üzerinden offline outbox, ACK ve snapshot reconciliation akışını kullanır.

SQLite/WAL kabul ve tek-node referans deposudur. Milyonlarca kullanıcı ve binlerce eşzamanlı oyuncu hedefi için production yönü PostgreSQL, shard router ve ayrı servis sınırlarıdır; SQLite production yatay ölçek deposu olarak sunulmamaktadır.

Ana sonuçlar:

- Yetkili actor state, command ledger, source-sequence ledger, receipt ve event-outbox ACID transaction içinde kalıcıdır.
- Process restart sonrasında aynı komut tekrar gönderildiğinde handler yeniden çalışmaz; saklı duplicate receipt döner.
- Commit tamamlanıp ACK kaybolduğunda restart + retry çift uygulama üretmez.
- 128 eşzamanlı aynı HTTP komutu yalnız bir commit üretir.
- İki bağımsız Node worker/SQLite bağlantısının aynı revision yarışında yalnız biri commit olur; diğeri `stale_revision` alır.
- Oyun istemcisi gerçek HTTP sunucusuna bağlanır; sunucu kapalıyken komut outbox'ta kalır ve aynı DB ile restart sonrası gönderilir.
- Server reddi/stale revision durumunda authoritative snapshot uygulanır; local tema korunur ve eski outbox temizlenir.
- Negatif üretim/tüketim akışları `v16 flow.*` alanlarında signed Decimal olarak kayıpsız saklanır.
- Eski `queueServerCommand` köprüsü geriye uyumlu tutulmuştur.

---

## 2. Kalıcı authority repository

`server/sqlite-authority-repository.js`, Node 22 `node:sqlite` ile aşağıdaki güvenlik ayarlarını kullanır:

- WAL journal
- `synchronous=FULL`
- Busy timeout
- Foreign key kontrolü
- Tek transaction içinde CAS + ledger + receipt + event-outbox

Kalıcı tablolar:

| Tablo | Rol |
|---|---|
| `actors` | Yetkili oyuncu snapshot ve server revision |
| `command_ledger` | `(actor_id, command_id)` unique receipt |
| `sequence_ledger` | `(actor_id, source_id, sequence)` replay koruması |
| `event_outbox` | Transaction ile birlikte oluşan domain olayları |
| `authority_meta` | Repository sürümü ve metadata |

### Transaction garantisi

```text
BEGIN IMMEDIATE
→ command/sequence conflict kontrolü
→ actor revision CAS
→ yetkili domain handler
→ state update
→ command receipt
→ sequence claim
→ event-outbox
→ COMMIT
```

`before_commit` failpoint'inde hiçbir kalıcı tablo değişmez. `after_commit` hata/ACK kaybında commit korunur ve retry saklı receipt üzerinden duplicate döner.

---

## 3. Süreç yeniden başlatma ve event-outbox

Gerçek child process testinde:

1. Sunucu SQLite DB ile başlatıldı.
2. Komut commit edildi.
3. Sunucu süreci tamamen kapatıldı.
4. Aynı DB ile yeni process başlatıldı.
5. Actor snapshot, revision ve receipt bulundu.
6. Aynı komut tekrar gönderildiğinde ikinci uygulama yapılmadı.

Event publisher mesajı işaretlemeden çökerse event `pending` kalır. `published` işareti uygulandıktan sonra süreç yeniden başlatılsa da korunur.

---

## 4. Gerçek HTTP client adapter

`src/core/server-network.js` aşağıdakileri sağlar:

- Ayarlanabilir HTTP/HTTPS authority URL
- Gerçek `fetch` ve timeout
- Tek eşzamanlı sync kilidi
- 5 saniyelik kontrollü auto-sync
- Offline outbox batch gönderimi
- Actor/fingerprint doğrulamalı ACK
- Sunucu kapalıyken pending komut koruması
- Server rejection sonrası snapshot çekme
- Authoritative snapshot reconciliation
- Local UI ayarlarını koruma
- Server revision ile local command revision eşitleme

Profil oluşmadan çalışan erken auto-sync artık hata üretmez; `waiting_actor` durumunda bekler. Promise `inFlight` kilidi her dönüş yolunda güvenli biçimde bırakılır.

### Bağlantı modları

- Authority URL yok: yerel çevrimdışı mod
- URL var, sunucu açık: optimistic command + outbox + ACK
- URL var, sunucu kapalı: optimistic command pending kalır
- Sunucu yeniden açılır: pending komut otomatik veya manuel sync ile gönderilir
- Server stale/reject: authoritative snapshot uygulanır

---

## 5. PostgreSQL production sözleşmesi

`server/postgres/001_authority_schema.sql`, production geçişi için tablo ve unique constraint sözleşmesini içerir:

- Actor hash partition
- `(actor_id, command_id)` unique ledger
- `(actor_id, source_id, sequence)` unique sequence claim
- Event-outbox
- Transaction ve `FOR UPDATE`/CAS yönlendirmesi
- Publisher için `FOR UPDATE SKIP LOCKED`

Bu sürümde gerçek PostgreSQL cluster testi yapılmamıştır. SQLite kabul/reference adapter'ıdır; production hedefi değildir.

---

## 6. Save v16 signed-flow düzeltmesi

Eski v16 doğrulayıcı tüm ekonomi map'lerini unsigned kabul ettiği için üretimden daha yüksek tüketim oluştuğunda negatif `flow.*` değeri autosave doğrulamasını durdurabiliyordu.

U4.3 ile:

- `EconomyNumber.isValidSignedStorage()` eklendi.
- `flow.*` signed Decimal olarak doğrulanır.
- Negatif ve pozitif akış değerleri save/reload sırasında kayıpsız round-trip yapar.
- Legacy signed flow literal'i migrasyonda sıfıra çevrilmez.
- Inventory, kredi ve diğer unsigned ekonomi alanları negatif değeri reddetmeye devam eder.

---

## 7. Eşzamanlılık ve yük kabul sonuçları

| Senaryo | Sonuç |
|---|---:|
| Aynı komut, 128 eşzamanlı HTTP istek | 1 commit, 127 duplicate |
| İki farklı komut, aynı expected revision | 1 commit, 1 stale |
| İki worker / bağımsız SQLite bağlantısı | 1 commit, kayıp güncelleme yok |
| Commit sonrası ACK kaybı + restart + retry | Duplicate receipt, ikinci uygulama yok |
| Commit öncesi zorlanmış hata | State/ledger/sequence/event değişmedi |
| Event publisher crash | Pending event korundu |
| Server restart | State, receipt, revision ve event durumu korundu |
| Offline browser command | Outbox'ta kaldı |
| Aynı DB ile server restart | Pending komut ACK aldı |

---

## 8. Kabul matrisi

### Node ve regresyon

- **22/22** Node/regresyon paketi PASS
- **3.000** deterministik stabilite çevrimi PASS
- U1, U2, U3, U3.1, U4, U4.1 ve U4.2 regresyonları PASS
- Tüm non-test JavaScript dosyalarında syntax kontrolü PASS

### Chromium

- U3 background/pinch/save/accessibility: PASS
- U4 IndexedDB/fallback: PASS
- U4.1 command/outbox/ACK: PASS
- U4.2 command coverage/snapshot CAS: PASS
- U4.3 gerçek browser → HTTP → SQLite → process restart: PASS
- 390 px mobil yatay taşma: yok
- Beklenmeyen page/console hatası: 0

Node `node:sqlite` çalışma sırasında `ExperimentalWarning` üretir. Bu test hatası değildir; Node 22 API durumudur ve production PostgreSQL hedefinin yerine geçmez.

---

## 9. Bilinen sınırlar

1. SQLite/WAL repository tek-node kabul/reference deposudur; yatay production ölçeği değildir.
2. JWT/OAuth ve gerçek hesap servisi yoktur; prototip actor header kullanılır.
3. PostgreSQL adapter, connection pool, shard router ve multi-region failover henüz çalışır runtime değildir.
4. Stale offline komutlarda semantic merge/rebase yoktur; server snapshot otoritedir.
5. Global pazar, savaş ve leaderboard servisleri ayrıştırılmamıştır.
6. Gerçek Android cihaz ve production HTTPS origin kabul testi sonraki cihaz kapısıdır.

---

## 10. Başkan kararı

**U4.3 kabul edildi.** Kalıcı transaction deposu, process restart dayanıklılığı, gerçek HTTP client adapter, offline outbox ve snapshot reconciliation aynı pakette çalışmaktadır.

Sıradaki ana geliştirme:

> **U4.4 — PostgreSQL Authority, Authentication & Shard Readiness**

Öncelikler:

- PostgreSQL repository adapter ve gerçek DB integration testleri
- JWT/OAuth tabanlı hesap/actor doğrulaması
- Connection pool, transaction retry ve deadlock politikası
- Shard/sector router sözleşmesi
- Event-outbox publisher worker
- 1.000+ eşzamanlı komut yük ve soak testleri
- Server-authoritative pazar/savaş servis sınırları

---

## 11. Durum kaydı

**Source of truth:** `AXYON_Orbital_Ascendancy_v4.5.3_U4.3_Persistent_Authority.zip`  
**Sürüm:** `4.5.3-u4.3`  
**Save şeması:** `v16`  
**Son karar:** U4.3 kalıcı authority ve network adapter kabul edildi.  
**Kritik sınır:** SQLite production shard deposu değildir; auth ve PostgreSQL runtime henüz yoktur.  
**Bitiş kriteri:** Restart, duplicate, CAS, rollback, event-outbox, browser-network, offline retry, snapshot ve eski regresyon testleri geçti.
