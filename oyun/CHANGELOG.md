# Changelog

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
