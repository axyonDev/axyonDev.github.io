# v4.5.5 U4.3.2 — Power Discipline & Deterministic Input

- Kaynak çıkarıcıları tek seçimle doğrudan yatağa kurulur; seri yerleştirme modu kaldırıldı.
- Web ESC ve mobil/web geri hareketi aktif fabrika seçimini/araç modunu tek adımda iptal eder.
- Landing reactor ve bağlantısız global enerji kaldırıldı.
- Santral–makine güç hatlarından gerçek bağlı bileşen hesabı eklendi.
- Jeneratör, yalnız bağlı yük kadar ve yakıtı varsa enerji üretir; kopuk santral yakıt tüketmez.
- Bağlantısız/yakıtsız maden ve fırın üretimi kesin olarak sıfırlandı.
- Başlangıç için 1 ücretsiz Kömür Jeneratörü hakkı + 12 sonlu kömür kargosu eklendi.
- Power-line `{from,to}` kayıtları save/reload normalizasyonunda korunur.
- Yeni Node ve Chromium kabul testleri eklendi.

# AXYON: Orbital Ascendancy — Changelog

## 4.5.4-u4.3.1 — Groundfront Identity & True Reset

- Otomatik yedi başlangıç binası kaldırıldı; yeni oyun ve reset boş haritayla başlar.
- Yedi kuruluş makinesi, oyuncunun manuel yerleştireceği ücretsiz haklara dönüştürüldü.
- `profile.reset` idempotent domain komutu eklendi; bağlı client ve authoritative server birlikte sıfırlanır.
- Stale server revision durumunda reset komutu claim edilmeden güncel revision ile aynı kimlik üzerinden güvenli retry yapılır.
- Kısa alt-tab ve sıradan offline ilerleme modal/toast üretmez; “Komutan geri döndü” mesajı kaldırıldı.
- Canlı akış “Stratejik Haber Akışı” olarak değiştirildi ve yalnız gerçek tehdit/istihbarat/savaş olayları öne çıkarılır.
- İlk orbital varlığa kadar uzay baskını zamanlayıcısı, yıldız taraması ve galaktik hedefler kapatıldı.
- Uzay öncesi Yeryüzü Cephesi; güvenlik gücü, gerçek stok yağması, altyapı hasarı ve savunma ganimetiyle eklendi.
- U2’nin kapalı eski `tickGalaxyLegacy` referansından sızan erken uzay baskını ana tick/offline katmanında engellendi.
- Groundfront runtime authority server yükleme zincirine ve Service Worker cache’ine eklendi.
- Yeni Node ve Chromium testleri boş reset, authority reset, stale-CAS retry, 9 saniyelik sessiz dönüş ve First-Orbit tehdit kapısını doğrular.

## 4.5.3-u4.3 — Persistent Transaction Store & Client Network Adapter

- Node 22 SQLite/WAL tabanlı kalıcı authority repository eklendi.
- Actor snapshot, command ledger, source-sequence ledger, receipt ve event-outbox gerçek ACID transaction'a taşındı.
- Revision CAS ve unique claim kontrolleri iki bağımsız repository/process bağlantısında da uygulanır.
- Process restart sonrasında state, duplicate receipt ve event-outbox durumu korunur.
- Commit sonrası ACK kaybı + restart + retry senaryosu çift uygulama üretmeden duplicate receipt döndürür.
- Event publisher crash öncesinde event pending kalır; published işareti restart sonrasında korunur.
- 128 eşzamanlı aynı HTTP komutu ve iki worker CAS yarışı kabul testlerine eklendi.
- Gerçek HTTP client adapter, offline outbox gönderimi, ACK, timeout, auto-sync ve snapshot reconciliation eklendi.
- Profil oluşmadan erken sync dönüşünde Promise kilidinin takılı kalmasına yol açan `inFlight` yarışı düzeltildi.
- Ayarlar ekranına authority URL bağlan/ayır kontrolleri ve bağlantı durumu eklendi.
- PostgreSQL production schema/partition/outbox sözleşmesi pakete eklendi; gerçek cluster testi sonraki kapıdır.
- Chromium testi gerçek browser → HTTP → SQLite akışını, server kapanması ve aynı DB ile restart sonrası outbox teslimini doğrular.
- Profil oluşmadan çalışan erken auto-sync artık hata yerine `waiting_actor` durumunda bekler ve Promise kilidi bırakır.
- v16 `flow.*` alanları signed Decimal olarak doğrulanır; negatif tüketim akışı autosave’i durdurmadan kayıpsız saklanır.
- `queueServerCommand` geriye uyumlu biçimde zorunlu outbox kuyruğu oluşturur; normal `runCommand` yalnız bağlantı yapılandırıldığında sunucuya kuyruklar.
- Kabul zinciri 22 Node/regresyon paketi ve 5 Chromium kapısına çıkarıldı.

## 4.5.2-u4.2 — Authoritative Server Prototype & CAS Reconciliation

- UI bağımsız canonical ekonomi/domain çekirdeğini yükleyen Node server runtime eklendi.
- Actor başına keyed mutex, command ledger, source-sequence ledger, yetkili snapshot ve event-outbox repository eklendi.
- Aynı `(actorId, commandId)` eşzamanlı tekrarlarında tek uygulama ve kalıcı receipt replay davranışı sağlandı.
- Aynı komut kimliği farklı payload ile `command_id_conflict`; aynı source/sequence farklı kimlikle `source_sequence_conflict` üretir.
- Farklı komutların aynı expected revision yarışında CAS ile yalnız birinin commit olması sağlandı.
- Yetkili state + receipt + domain event-outbox tek senkron transaction kritik bölümünde commit edilir.
- Commit öncesi failpoint rollback testi state/ledger/event değişmezliğini doğrular.
- Node HTTP API, actor header doğrulaması, gövde sınırı, health, snapshot ve rate limit eklendi.
- Client server snapshot reconciliation; actor/schema/revision doğrulaması, yerel ayar koruması, outbox temizliği ve needsReconcile kapatması eklendi.
- Fabrika yerleşim/taşıma/silme, hat işlemleri, sektör açma, manuel üretim, otomasyon, yapı sınıfı, depo, araştırma iptali ve item pazar ayarları command çekirdeğine taşındı.
- Authoritative receipt ve snapshot JSON Schema dosyaları ile U4.2 mimari belgesi eklendi.
- Yeni testler gerçek HTTP duplicate yarışı, CAS, rollback, actor izolasyonu, event-outbox, rate limit, reconciliation ve command coverage senaryolarını kapsar.

## 4.5.1-u4.1 — Command Authority & Server-Ready Domain Foundation

- UI/storage bağımsız idempotent domain command zarfı ve handler registry eklendi.
- Komutlar actor, source, monoton sequence, command ID, canonical payload fingerprint, issuedAt ve expected revision taşır.
- Aynı komut tekrar/eşzamanlı/reload replay durumunda handler çalıştırılmadan önceki makbuz döner.
- Aynı sıra/kimlikle farklı payload çakışması, stale revision, actor mismatch, eski replay ve zaman anomalileri güvenli biçimde reddedilir.
- Kaynak başına son 128 makbuz tutulur; high-water işareti retention dışındaki eski komutların yeniden uygulanmasını engeller.
- Pazar, kuruluş sözleşmesi, araştırma, sistem tarama, tersane, savunma, casusluk, kolonileştirme, filo, bakım ve U3 altyapı işlemleri komut çekirdeğine bağlandı.
- Gelecek sunucu adaptörü için 256 öğelik kontrollü offline outbox, batch, fingerprint doğrulamalı ACK ve duplicate ACK sözleşmesi eklendi.
- Outbox dolduğunda değerli komut uygulanmadan `outbox_full` döner; local-only UI outbox modunu kullanmaz.
- Sunucu reddi sonrası `needsReconcile` işareti ve server revision/time metadata eklendi.
- Sunucu saat örnekleme, monoton yetkili zaman ve çift ödeme yapmayan lazy elapsed resolver eklendi.
- Domain command ve server ACK JSON Schema sözleşmeleri ile U4.1 mimari belgesi eklendi.
- Yeni testler gerçek gemi komutunda dedup/replay/conflict/stale/concurrency, outbox/ACK/backpressure ve server-time idempotency senaryolarını kapsar.
- Gerçek Chromium U4.1 testi command bridge, v16 makbuz kalıcılığı, ayarlar durumu ve 390 px mobil taşmayı doğrular.

## 4.5.0-u4 — Data Vault & Durability Foundation

- IndexedDB tabanlı dayanıklı ana kayıt kasası eklendi; localStorage uyumluluk aynası/fallback olarak korundu.
- U3.1 profil, aktif profil ve v16 save anahtarları ilk U4 açılışında kayıpsız olarak kasaya aktarılır.
- Kritik kayıtlar checksum, monoton revizyon, güncelleme zamanı ve kaynak bilgisi taşır.
- Açılış uzlaştırması sağlam/yeni kopyayı seçerek diğer katmanı otomatik onarır.
- İki aktif kopya bozuksa en yeni geçerli IndexedDB yedeğine otomatik rollback yapılır.
- Her kritik anahtar için yedek retention sınırı 5 nesildir.
- Stale veya eşzamanlı aynı revizyonlu farklı yazılar, IndexedDB transaction içinde daha yüksek revizyona yükseltilir.
- Profil ve tüm veri silmeleri revizyonlu tombstone kullanır; yarım kalan silme işleminde eski kayıt geri dirilmez.
- IndexedDB asenkron hataları görünür save uyarısına bağlandı; localStorage aynası en yeni ilerlemeyi korur ve retry ile kasa tamamlanır.
- IndexedDB açılamazsa oyun localStorage fallback ile başlar ve backend durumu Ayarlar ekranında görünür.
- Service Worker, manifest, sürüm kimliği ve test zinciri U4 veri kasasıyla güncellendi.
- Yeni U4 testleri: legacy import, dual-write, mirror repair, rollback, retention, stale revision, retry, tombstone ve Chromium fallback.
- Oyun durumu şeması v16, U3 Planetary Bastions ve U3.1 save recovery davranışları korunmuştur.

## 4.4.1-u3.1 — Save Recovery & Accessibility Hotfix

- Geçici `save` yazma hataları artık oturum boyunca kalıcı kilit oluşturmaz.
- İlk hata görünür uyarı üretir; otomatik kayıt 30 saniyelik kontrollü beklemeden sonra tekrar dener.
- Uyarı paneline **Tekrar Dene** ve **Kaydı Dışa Aktar** eylemleri eklendi.
- Başarılı kurtarma `axyon:save-success` ile uyarıyı kapatır ve kullanıcıya güvenli kayıt bildirimi verir.
- `migration`, `load` ve `legacy` türü yapısal hatalar retry ile temizlenemez.
- Import akışı geçici save kilidini kontrollü biçimde temizleyip yeni kaydı zorunlu yazma denemesine sokar.
- Fabrika zoom butonları 44×44 px, üst ikon butonları 44×44 px yapıldı.
- Canlı Cephe açılır alanına `aria-expanded` ve `aria-controls` eklendi; durum DOM ile senkron tutulur.
- Geçici hata kurtarma, cooldown, kalıcı hata koruması, dokunma hedefi ve ARIA regresyon testleri eklendi.
- Oyun içeriği, ekonomi dengesi, save şeması v16 ve U3 Planetary Bastions runtime değişmedi.

## 4.4.0-u3 — Planetary Bastions

- Oyun adı **AXYON: Orbital Ascendancy** olarak değiştirildi; manifest, başlık, onboarding, ansiklopedi ve cache kimliği güncellendi.
- Arka plan/sekme dönüşünde offline ilerleme kaybı düzeltildi; görünürlük, BFCache ve yeniden yükleme yollarında çift ödeme koruması eklendi.
- Mobil fabrika canvas’ına iki pointer mesafesini ve orta nokta ankrajını kullanan pinch-to-zoom eklendi.
- Kayıt yazma hataları `axyon:save-error` olayı, kalıcı uyarı ve doğrudan export yolu ile görünür hale getirildi.
- Safe-area, temel ARIA durumları, klavye focus görünümü, azaltılmış hareket ve 44 px dokunma hedefleri eklendi.
- 300×300 canvas için grid, sektör, kaynak, bina ve hat viewport culling’i eklendi.
- Gezegen m², altyapı, yörünge kütlesi/slotu, komuta, enerji, ısı ve bakım runtime sistemleri eklendi.
- Gezegen Soğutma Merkezi, Bakım Deposu, Gezegen Komuta Dizisi ve Yörünge Kontrol Düğümü eklendi.
- Yüzey Savunma Kompleksi ve Yörünge Savunma Halkası Mk I–V eklendi.
- Sekiz canonical savunma türü ve milyon ölçekli cohort/stack üretimi canlı oynanışa bağlandı.
- Enerji, mühimmat, ısı ve bakım oranları savunma operasyonel hazırlığına bağlandı.
- Enerji ve mühimmatsız çalışan, saldırı üretmeyen Tier-0 Acil Barikat failsafe’i eklendi.
- Eski taret/interceptor/kalkan kayıtları yeni cohort sınıflarına silinmeden taşındı.
- Eski fabrikalarda kapasite aşımı varsa yapı silmek yerine Miras Aşımı ve yeni inşa kilidi uygulanır.
- Kapasite kazandıran kurtarma tesisleri mevcut aşımı çözebilecekse aşım altında kurulabilir.
- Bina silme sonrasında kapasite/hover/selection yeniden hesaplaması güvenli hale getirildi.
- Teknoloji kartları U3 altyapı tesislerini, savunma komplekslerini ve kapasite seviyelerini açıklamayla listeler.
- Ansiklopediye Altyapı ve Kapasite bölümü, Mk savunma tabloları ve araştırma tüketicileri eklendi.
- Savaş kaynaklı Metal Hurda, Elektronik Hurda ve Uzaylı Alaşımının gerçek kaynak açıklamaları geri getirildi.
- Yeni U3 arka plan, kayıt, marka, kapasite, cohort, gerçek Chromium ve codex testleri eklendi.

# Changelog

## 4.4.0-u2 — Decimal Economy & First Orbit Bridge

- Kredi, stok, üretim, akış ve maliyet işlemleri EconomyNumber/Decimal-native runtime’a geçirildi.
- Yeni oyun 0 krediyle başlar; kredi göstergesi ilk yörünge ekonomisi açılana kadar kilitli görünür.
- Başlangıç tek sektörde garantili demir, bakır ve kömürle kurulur.
- Tek seferlik başlangıç makineleri ve 120 güçlük iniş reaktörü eklendi.
- Makine ve santral inşası kredi yerine gerçek üretim malzemeleri tüketir.
- Süreli sektör taraması, su/taş garantisi, petrol rotası ve petrolsüz sentetik yakıt rotası eklendi.
- RP-1, Sıvı Oksijen ve Basınçlı Azot kullanan Prototip Pazar Uydusu Mk 0 oynanışa açıldı.
- Üç kuruluş sözleşmesi toplam 13.500 kredi verir; Pazar Ağı Mk I sonrası en az 1.500 kredi kalır.
- Yerel satış kapalı tutuldu; normal satışlar yalnız Pazar Uydusu kotası ve sefer süresiyle çalışır.
- v16 kayıt sistemi Decimal runtime nesneleri ve exact unsafe-integer shadow verisiyle uyumlu hale getirildi.
- Eski filo, savaş, enkaz, baskın ve tamir işlemleri Decimal tiplerini koruyan güvenli köprüye alındı.
- Çevrimdışı cezalandırıcı baskın sessizce çözülmez; hazırlık penceresine ertelenir.
- U2 First Orbit durum kartları, kuruluş sözleşmeleri ve responsive CSS eklendi.
- Ansiklopedi U2 canonical köprüsüne, service worker U2 asset listesine bağlandı.
- Yeni U2 ilk yörünge, veri bütünlüğü, DOM, migrasyon ve stabilite testleri eklendi.

## 4.4.0-u1 — Save v16 & Canonical Data Foundation

- `break_eternity.js` ve merkezi EconomyNumber adaptörü eklendi.
- v15 kayıtlar için lossless parser, SHA-256 backup, temp commit ve rollback içeren v16 migrasyon kuruldu.
- v16 kayıtlar string economy alanlarıyla saklanıyor; mevcut v4.3 runtime numeric compatibility bridge üzerinden çalışıyor.
- Bozuk migrasyonda kayıt overwrite edilmiyor ve autosave kilitleniyor.
- Frozen v4.4 canonical JSON tarayıcıda read-only indeks olarak yükleniyor.
- Profil, reset ve export/import akışları v16 depoya bağlandı.
- Eski `.pre430` geliştirme yedeği release paketinden kaldırıldı.
- Service worker ve PWA manifest U1 dosyalarına güncellendi.
- Yeni U1 migration/browser smoke testleri eklendi.

# Axyon Idle Factory: Warfront Command — Changelog

## 4.3.0 — Capacity & OGame Layer

- Gezegen/yörünge kapasite sistemi eklendi: her bina, santral, savunma, bakım tesisi, filo ve uydu kapasite yükü tüketir.
- Kapasite altyapısı Mk seviyesine bağlandı; aşırı yük üretim, pazar, tersane ve filo temposunu düşürür.
- Pazar Uydusu artık yörünge/filo kapasitesi tüketir; her Mk seviyesi 3 uydu hakkı açar, toplam sınır 9’dur.
- Yerel satış kapatıldı; tüm satış akışı Pazar Uydusu üzerinden yürür.
- Üst canlı cephe akışı eklendi: en fazla 5 satırda pazar sevkiyatı, filo gidiş/dönüş, tersane, tamir ve baskın süreleri gösterilir.
- Sağ tıklama ve bağlam menüsü fabrika alanında engellendi; sağ tıkla yanlış yerleştirme engellendi.
- Bina silme sonrası seçili/hover referansları temizlenerek donma riski giderildi.
- Süre gösterimleri tam saniyeye yuvarlandı; kullanıcıya küsüratlı saniye gösterilmez.
- Araştırma kartlarında açılacak öğeler ve kısa açıklamaları gösterilir.
- Fabrika yer değiştirmede hayalet yerleşim önizlemesi eklendi.
- İlk başlangıç artık 1 sektörle başlar ve garantili olarak en az 1 demir, 1 bakır, 1 kömür kaynağı içerir.
- İlk girişte komutan adıyla birlikte başlangıç gezegeni ve başlangıç bölgesi seçilir.
- OGame katmanı genişledi: casus uyduları, enkaz toplayıcılar, koloni/istila gemileri, kalıcı enkaz sahası, casusluk raporu, enkaz toplama ve gezegen istilası görevleri eklendi.
- Teknoloji ve makineleşme zincirine kapasite altyapısı, casusluk, enkaz kurtarma, gezegen istilası ve yörünge megayapı aşamaları bağlandı.

## 4.2.0 — Warfront

- Savaş komuta merkezi, enkaz, tamirat, altyapı hasarı ve uzun dönem cephe sistemi kuruldu.
