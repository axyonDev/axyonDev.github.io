# AXYON: Orbital Ascendancy v4.5.5 U4.3.2
## Power Discipline & Deterministic Input — Entegrasyon ve Kabul Raporu

**Sürüm:** `4.5.5-u4.3.2`  
**Save şeması:** `v16`  
**Taban:** `v4.5.4-u4.3.1 Groundfront & True Reset`  
**Durum:** Kabul adayı

## 1. Yönetici özeti

U4.3.2, üç somut oynanış sorununu kapatır:

1. Kaynak yatağında çıkarıcı seçimi artık yapıyı doğrudan seçilen yatağa kurar; kaynak yapıları seri yerleştirme moduna girmez.
2. Web’de `Escape`, mobil/web geri hareketinde ilk geri işlemi aktif fabrika seçimini, inspector’ı veya araç modunu iptal eder.
3. Üretim artık ücretsiz/global enerji kullanmaz. Makinenin çalışması için gerçek bir santral, santral–makine enerji hattı ve gerekiyorsa yakıt zorunludur.

Başlangıç kilitlenmesini önlemek için oyuncuya enerji değil, **bir ücretsiz Kömür Jeneratörü kuruluş hakkı ve 12 birim sonlu kömür kargosu** verilir. Kömür jeneratörü bağlantısızken yakıt tüketmez. Hat kopuksa veya yakıt yoksa üretim kesin olarak sıfırdır.

## 2. Kaynak yatağında doğrudan kurulum

Eski akış:

```text
Kaynağa tıkla → çıkarıcı seç → placement mode → fareye yapışan hayalet yapı → tekrar hücreye tıkla
```

Yeni akış:

```text
Kaynağa tıkla → çıkarıcı seç → aynı yatağa anında kur → mode = select
```

- Kaynak hücresinin koordinatı inspector üzerinde korunur.
- `factory.place` idempotent command katmanından geçer.
- Başarılı kurulumdan sonra yapı seçili gösterilebilir; fakat yerleştirme aracı aktif kalmaz.
- Kaynak yapılarında seri placement kullanılmaz.

## 3. ESC ve mobil geri davranışı

Merkezi `cancelFactoryInteraction()` akışı şunları birlikte temizler:

- aktif placement/conveyor/power/delete aracı,
- seçili yapı,
- inspector,
- inşa paleti,
- sürükleme/pinch/link geçici durumu,
- yardım katmanı.

Web’de `Escape` bu akışı çalıştırır. Mobil/web geri davranışı için bir history guard kullanılır; ilk geri hareketi oyundan çıkmak yerine aktif fabrika etkileşimini kapatır.

## 4. Gerçek enerji disiplini

### 4.1 Kaldırılan davranış

- Ücretsiz landing reactor kapatıldı.
- Global enerji oranının bütün makineleri bağlantısız çalıştırması kaldırıldı.
- Santral kurulu olmasının tek başına üretim sağlaması kaldırıldı.

### 4.2 Yeni güç grafiği

`grid.powerLines` kayıtlarından santral–makine bağlı bileşenleri oluşturulur. Her bileşen için ayrı ayrı hesaplanır:

- bağlı makine talebi,
- bağlı santral kapasitesi,
- mevcut yakıt,
- yük oranı,
- teslim edilen enerji,
- makine başına etkin güç oranı.

Bağlantısız makinelerin güç oranı `0` olur. Santral bağlantısızsa yakıt yakmaz. Yakıt tüketimi yalnız gerçek bağlı yük oranında gerçekleşir.

### 4.3 Başlangıç enerjisi

Yeni oyun ve gerçek reset sonrasında:

- ücretsiz Kömür Jeneratörü hakkı: `1`,
- sonlu kömür kargosu: `12`,
- landing reactor gücü: `0`,
- otomatik/global ücretsiz güç: yok.

Oyuncu önce jeneratörü kurar, sonra `⚡ Hat` aracıyla makineleri bağlar. Kömür madeni bu ilk kargoyla çalıştırılıp devam yakıtı üretir.

## 5. Görsel ve UX geri bildirimi

Makine durumları canvas ve inspector üzerinde ayrılır:

- `⛔ hat yok`,
- `⚠ yakıt/güç yok`,
- çalışan güç oranı,
- etkili üretim oranı.

Manuel üretim düğmesi güçsüz makinede devre dışıdır. Güç paneli, santral kurmanın tek başına yeterli olmadığını ve başlangıç kargosunun amacını açıklar.

## 6. Kayıt uyumluluğu

Save şeması `v16` olarak korunmuştur.

- `{from,to}` biçimindeki enerji hatları normalizasyon ve reload sırasında korunur.
- Eski kayıt yükleme/migrasyonları kırılmaz.
- Landing reactor alanları uyumluluk için state içinde bulunabilir fakat runtime her açılışta bunları kapalı ve `0` güçte tutar.
- Ücretsiz jeneratör hakkı starter-right yapısında saklanır; starter jeneratör sökülürse hak geri döner.

## 7. Kabul sonuçları

### Node / regresyon

- 25/25 test paketi PASS
- 3.000 deterministik stabilite çevrimi PASS
- U1–U4.3.1 kayıt, SQLite, CAS, restart, reconciliation ve reset regresyonları PASS
- Yeni strict-power testi PASS

### Chromium

- 7/7 browser kabul kapısı PASS
- Kaynak çıkarıcı aynı yatağa doğrudan kuruldu
- Kurulum sonrası `FactoryCanvas.getMode() === 'select'`
- ESC seçimi kapattı
- ESC placement aracını kapattı
- Tek geri hareketi placement aracını kapattı
- Bağlantısız maden/fırın üretimi `0`
- Bağlantısız jeneratör kömür tüketimi `0`
- Bağlı ve yakıtlı ağ üretim yaptı
- Kömür gerçek miktarda azaldı
- 390 px mobil yatay taşma yok
- Beklenmeyen page/console hatası `0`

## 8. Bilinen sınırlar

1. Güç grafiği mevcut sürümde doğrudan santral–makine hatlarıdır; elektrik direkleri, switch, akümülatör ve dağıtım trafosu henüz yoktur.
2. Fabrika üretim girdileri/çıktıları hâlâ aggregate envantere gider; gerçek bant, inserter, buffer ve backpressure P0 uzaysal motor kapsamındadır.
3. Mobil geri davranışı Chromium history/popstate ile doğrulandı; gerçek Android donanım geri tuşu release cihazında ayrıca test edilmelidir.
4. `12` başlangıç kömürü denge değeridir; gerçek uzun süreli başlangıç oynanışında ayarlanabilir.

## 9. Başkan kararı

**U4.3.2 kabul edildi.**

Bu hotfix sonrasında sıradaki ana iş birleşik Factorio × OGame yol haritasındaki P0’dır:

> `src/core/spatial-sim.js` — 8×8 dikey dilimde tükenen maden → gerçek bant → inserter → fırın → ambar ve graf-bağlı güç.

U4.3.2 güç disiplini, bu uzaysal motorun yerine geçmez; P0’a geçmeden önce oyundaki mevcut “enerjisiz üretim” çelişkisini ortadan kaldırır.

## 10. Durum kaydı

**Source of truth adayı:** `AXYON_Orbital_Ascendancy_v4.5.5_U4.3.2_Power_Discipline.zip`  
**Sürüm:** `4.5.5-u4.3.2`  
**Save şeması:** `v16`  
**Son karar:** Kaynakta doğrudan kurulum, ESC/geri iptali ve gerçek enerji hattı zorunluluğu tamamlandı.  
**Sıradaki iş:** P0 `spatial-sim.js` dikey dilimi.  
**Kritik risk:** Mobil performans ve v16→v17 uzaysal save migrasyonu.  
**Bitiş kriteri:** Bant kesilince durma, backpressure, yatak tükenmesi, güçsüz üretim `0`, eski save `0 crash`.
