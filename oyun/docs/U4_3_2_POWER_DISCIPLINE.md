# U4.3.2 — Power Discipline & Deterministic Input

**Sürüm:** `4.5.5-u4.3.2`  
**Save şeması:** `v16`  
**Kapsam:** U4.3.1 oynanış düzeltmesi; uzaysal simülasyon P0 öncesi kesin enerji ve giriş davranışı.

## Kararlar

1. Kaynak yatağındaki çıkarıcı seçimi yapıyı aynı hücreye anında kurar. Kaynak yapıları seri yerleştirme moduna girmez.
2. Web’de `Escape`, mobil/web geri hareketinde ilk geri işlemi aktif fabrika seçimini veya aracını iptal eder.
3. Landing reactor kaldırılmıştır. Üretim için aynı güç bileşeninde gerçek bir santral, fiziksel güç hattı ve gerekiyorsa yakıt zorunludur.
4. Bağlantısız santral yakıt tüketmez; bağlantısız veya yakıtsız makine üretmez.
5. Başlangıç deadlock’u oluşturmamak için oyuncuya bir ücretsiz Kömür Jeneratörü kuruluş hakkı ve yalnız 12 birim sonlu iniş kömürü verilir. Bu enerji değil, ilk gerçek jeneratörü çalıştıracak başlangıç kargosudur.

## Güç hesabı

`grid.powerLines` üzerinden santral–makine bağlı bileşenleri çıkarılır. Her bileşenin arzı, talebi ve yakıtı bağımsız hesaplanır. Kopuk makinelerin etkin güç oranı `0` olur. Yakıt tüketimi yalnız bağlı gerçek yük oranında gerçekleşir.

Bu katman, birleşik Factorio × OGame yol haritasındaki gerçek uzaysal simülasyonun yerine geçmez. P0 `spatial-sim.js` çalışmasına geçmeden önce mevcut aggregate motorun fiziksel bağlantı kurallarını dürüst hale getirir.

## Kabul kapıları

- Kaynak çıkarıcı doğrudan yatağa kurulur; placement mode `select` kalır.
- ESC seçimi ve yerleştirme aracını kapatır.
- Tek geri hareketi aktif fabrika aracını kapatır.
- Jeneratör yoksa üretim `0`.
- Hat yoksa üretim `0`.
- Yakıt yoksa üretim `0`.
- Bağlı ve yakıtlı bileşen üretir, kömür tüketir.
- Güç hatları save/reload sonrasında korunur.
