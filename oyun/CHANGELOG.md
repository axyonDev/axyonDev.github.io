# AXYON: Orbital Ascendancy — Changelog

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
