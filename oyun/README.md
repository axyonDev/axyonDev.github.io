# AXYON: Orbital Ascendancy
## v4.5.5 U4.3.2 — Power Discipline & Deterministic Input

Fabrika artık bağlantısız veya yakıtsız çalışmaz. Kaynak yatakları tek seçimle doğrudan kurulur; ESC ve mobil geri hareketi aktif seçimi kesin biçimde iptal eder. Bu hotfix, gerçek uzaysal Factorio motoruna geçmeden önce mevcut üretim çekirdeğinin fiziksel kurallarını dürüst hale getirir.

## U4.3.2 öne çıkanlar

- Kaynak yatağında çıkarıcı seçildiğinde yapı aynı hücreye anında kurulur; seri placement modu açılmaz.
- Web `Escape`, mobil/web ilk geri hareketi seçili yapı, inspector veya aktif fabrika aracını kapatır.
- Ücretsiz landing reactor kaldırıldı; başlangıç gücü artık “ilahi” veya global değildir.
- Bir ücretsiz Kömür Jeneratörü kuruluş hakkı ve 12 birim sonlu iniş kömürü verilir.
- Makine yalnız gerçek santral hattına bağlıysa ve jeneratörün yakıtı varsa üretir.
- Kopuk santral yakıt yakmaz; kopuk/yakıtsız makine üretmez.
- Güç ağları santral–makine bağlı bileşenleri olarak ayrı hesaplanır.
- Güç durumu canvas ve inspector üzerinde “hat yok / yakıt-güç yok / çalışıyor” şeklinde görünür.

Teknik ayrıntılar: `docs/U4_3_2_POWER_DISCIPLINE.md`  
Yön belgesi: `docs/AXYON_FACTORIO_OGAME_BIRLESIK_YOL_HARITASI.md`

Fabrika kurma, gezegen savunması, istihbarat ve sunucu-otoriteli galaktik savaş yönünde ilerleyen kalıcı strateji oyunu. Sıradan çevrimdışı süre bir “idle ödülü” olarak sunulmaz; oyuncuya yalnız gerçek tehditler, savaşlar ve karar değeri taşıyan olaylar bildirilir.

## U4.3.1 öne çıkanlar

- **Tüm İlerlemeyi Sıfırla** artık haritayı gerçekten boş bırakır; otomatik 7 bina geri kurulmaz.
- Yedi başlangıç makinesi ücretsiz manuel kuruluş hakkına dönüştürüldü; yerlerini oyuncu seçer.
- Bağlı authority varsa reset, idempotent `profile.reset` komutuyla server snapshot’ını da sıfırlar.
- Server revision daha ilerideyse reset komut kimliği tüketilmeden güncel CAS revision ile güvenle tekrar gönderilir.
- Kısa alt-tab ve sıradan çevrimdışı üretim tamamen sessizdir; “Komutan geri döndü” modalı kaldırıldı.
- Haberler yalnız saldırı, casusluk, savaş ve kritik sonuçlardan oluşan **Stratejik Haber Akışı**na taşındı.
- İlk orbital varlık kurulana kadar galaktik tehdit, yıldız taraması ve uzay baskını kapalıdır.
- Uzay öncesinde gerçek stok kaybı/altyapı hasarı veya ganimet üreten **Yeryüzü Cephesi** saldırıları çalışır.
- Client ve server aynı Groundfront runtime’ını kullanır; reconciliation eski starter fabrikayı geri getiremez.

Teknik ayrıntılar: `docs/U4_3_1_GROUNDFRONT_IDENTITY.md`

## U4.3 öne çıkanlar

- SQLite/WAL tabanlı gerçek kalıcı authority repository eklendi.
- Actor state, command ledger, source-sequence ledger, receipt ve event-outbox ACID transaction ile saklanır.
- Process restart sonrasında state, revision, receipt ve pending/published event durumları korunur.
- Commit tamamlanıp ACK kaybolduğunda restart sonrası retry duplicate receipt döner; çift harcama oluşmaz.
- 128 gerçek eşzamanlı aynı HTTP komutunda yalnız bir commit gerçekleşir.
- İki bağımsız Node worker/SQLite bağlantısının aynı revision yarışında CAS yalnız birini kabul eder.
- Oyun istemcisine gerçek HTTP authority adapter eklendi.
- Sunucu kapalıyken optimistic işlem outbox'ta kalır; server yeniden başladığında otomatik gönderilir.
- Server reddinde yetkili snapshot uygulanır, local tema korunur ve stale outbox temizlenir.
- Ayarlar ekranından authority URL yapılandırılabilir ve yerel moda dönülebilir.
- PostgreSQL production tablo/unique/outbox sözleşmesi `server/postgres/` altında eklendi.
- Negatif üretim/tüketim akışları v16 save içinde signed Decimal olarak kayıpsız doğrulanır ve geri yüklenir.
- Eski `queueServerCommand` köprüsü, sunucu URL yapılandırılmamış olsa bile kontrollü outbox testi/entegrasyonu için geriye uyumlu tutulur.

Teknik ayrıntılar: `docs/U4_3_PERSISTENT_AUTHORITY.md`

## Kalıcı sunucuyu çalıştırma

```bash
node server/start.js
```

Varsayılan adres `http://localhost:8787`, varsayılan DB `server-data/authority.sqlite` dosyasıdır. Ortam değişkenleri:

```text
PORT=8787
AXYON_AUTH_DB=/kalici/yol/authority.sqlite
AXYON_ALLOWED_ORIGINS=http://localhost:8080,https://oyun.example.com
```

SQLite U4.3 kabul/reference deposudur; milyon kullanıcı production hedefi PostgreSQL + shard router'dır.

## U4.2 öne çıkanlar

- Gerçek Node HTTP yetkili sunucu prototipi eklendi (`server/`).
- Actor başına mutex, command/sequence ledger, CAS revision ve event-outbox sözleşmesi kuruldu.
- Snapshot reconciliation ve tüm değerli UI işlemlerinin command katmanı korunur.

Teknik ayrıntılar: `docs/U4_2_AUTHORITATIVE_SERVER.md`

## U4.1 öne çıkanlar

- UI ve kayıt teknolojisinden bağımsız `DomainCommand` çekirdeği eklendi.
- Değerli işlemler `commandId`, oyuncu, kaynak sekme, sıra, payload fingerprint ve beklenen revizyon taşır.
- Aynı gerçek ekonomi komutu tekrar/eşzamanlı/reload replay durumunda yalnız bir kez uygulanır.
- Aynı kimlikle farklı payload `command_id_conflict`, eski state komutu `stale_revision` ile reddedilir.
- Kaynak başına sınırlı makbuz + high-water işareti eski replay'in retention sonrasında bile yeniden uygulanmasını engeller.
- Gemi/uydu üretimi, pazar, araştırma, filo, savunma, kolonileştirme, bakım ve Planetary Bastions işlemleri komut katmanına bağlandı.
- Sunucu bağlantısı için 256 komutluk kontrollü offline outbox, batch ve idempotent ACK sözleşmesi eklendi.
- Local-only oynanış outbox kullanmaz; bağlantısız prototip 256 işlemden sonra kilitlenmez.
- Sunucu reddi `needsReconcile` üretir; istemci tahmini otorite kabul edilmez.
- Sunucu zamanı offset/RTT örnekleme ve sürekli tick gerektirmeyen lazy elapsed resolver eklendi.
- Makine okunabilir command/ACK JSON şemaları eklendi.

Teknik ayrıntılar: `docs/U4_1_COMMAND_AUTHORITY.md`

## U4 veri kasası korunuyor

### U4 öne çıkanlar

- **IndexedDB ana kayıt kasası** eklendi.
- `localStorage`, hızlı açılış uyumluluk aynası ve IndexedDB kullanılamadığında kontrollü fallback olarak korunur.
- U3.1 profilleri ve kayıtları ilk U4 açılışında kullanıcı verisi silinmeden kasaya taşınır.
- Her kayıt checksum, monoton revizyon ve güncelleme zamanı taşır.
- Açılışta localStorage ile IndexedDB karşılaştırılır; sağlam ve yeni olan kopya diğerini onarır.
- İki güncel kopya da bozuksa son geçerli IndexedDB yedeğine otomatik rollback yapılır.
- Her kritik kayıt için en fazla 5 eski nesil tutulur.
- Hızlı veya eşzamanlı eski revizyonlu yazılar, kasa işlemi içinde daha yüksek revizyona yükseltilir.
- Profil/sıfırlama silmeleri revizyonlu **tombstone** ile tutulur; uygulama aniden kapanırsa silinen kayıt geri dirilmez.
- IndexedDB yazma hatasında en yeni ilerleme localStorage aynasında kalır, görünür uyarı oluşur ve **Tekrar Dene** ile dayanıklı kayıt tamamlanır.
- IndexedDB açılamazsa oyun localStorage fallback ile çalışmaya devam eder ve bu durum Ayarlar ekranında gösterilir.
- U3.1 kayıt kurtarma, arka plan ilerlemesi, pinch zoom, Planetary Bastions ve cohort sistemleri korunmuştur.

Teknik ayrıntılar: `docs/U4_DATA_DURABILITY.md`

## Ölçek hedefi

Proje, milyonlarca kayıtlı kullanıcıya ve binlerce eşzamanlı oyuncuya uygun sunucu-otoriteli ortak evrene geçebilecek şekilde geliştirilecektir.

U4.3 gerçek kalıcı tek-node authority ve HTTP istemci bağlantısı taşır; SQLite **milyon kullanıcı production deposu değildir**. Ortak evrende kredi, envanter, zaman, pazar, savaş ve mülkiyet yalnız PostgreSQL/shard tabanlı yetkili servis tarafından kesinleştirilecektir. Ayrıntılar: `docs/SCALABILITY_GUARDRAILS.md`.

## Çalıştırma

En sağlıklı kullanım için klasörde yerel bir web sunucusu açın:

```bash
python -m http.server 8080
```

Ardından tarayıcıda `http://localhost:8080` adresini açın.

Doğrudan `index.html` de açılabilir; ancak Service Worker ve IndexedDB davranışları tarayıcının `file:`/opaque-origin güvenlik politikasına göre kısıtlanabilir.

## Test

Node/regresyon zinciri (**22 paket**):

```bash
./run-tests.sh
```

Windows:

```bat
run-tests.bat
```

Chromium kabul testleri:

```bash
python tests/u3-browser-smoke.py
python tests/u4-browser-smoke.py
python tests/u4-1-browser-smoke.py
python tests/u4-2-browser-smoke.py
python tests/u4-3-browser-smoke.py
```

`u4-browser-smoke.py`, kısıtlı test ortamında gerçek Chromium üzerinde dayanıklı backend sözleşmesini deterministik backend ile; IndexedDB reddedildiğinde fallback yolunu ayrıca sınar. Native IndexedDB `open/objectStore/index/transaction` adaptörü ayrıca standart uyumlu IndexedDB test motorunda geçmiştir. Son cihaz kapısı gerçek `http/https` origin ve gerçek Android cihazdır.

## Önemli sınırlar

- U4.3 SQLite/WAL repository process restart dayanıklılığı sağlar; SQLite production yatay ölçek deposu değildir.
- İstemci gerçek HTTP authority adapter'a bağlanır; JWT/OAuth yerine prototip actor header kullanılır.
- PostgreSQL cluster testi, shard router, global pazar/savaş servisleri ve çok-bölge failover henüz yoktur.
- U4 kasası offline/cache verisini korur; ortak evrende ekonomi otoritesi değildir.
- Native IndexedDB adaptör testi geçti; gerçek-origin/gerçek-cihaz kabul testi sıradaki cihaz kapısıdır.
- Milyonluk savunmalar tek tek render edilmez; kompleks içinde cohort/stack olarak tutulur.
- Oyun durum şeması v16 olarak korunur; U4 yalnız saklama katmanını değiştirir.

## Raporlar

- `reports/U4_3_INTEGRATION_REPORT.md`
- `reports/U4_3_NODE_TESTS.txt`
- `reports/U4_3_BROWSER_SMOKE.json`
- `reports/U4_3_PERSISTENT_NETWORK_MOBILE.png`
- `reports/U4_1_INTEGRATION_REPORT.md`
- `reports/U4_1_FULL_ACCEPTANCE.txt`
- `reports/U4_1_NODE_TESTS.txt`
- `reports/U4_1_BROWSER_SMOKE.json`
- `reports/U4_1_COMMAND_AUTHORITY_MOBILE.png`
- `reports/U4_INTEGRATION_REPORT.md`
- `reports/U4_BROWSER_SMOKE.json`
