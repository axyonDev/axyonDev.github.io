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
