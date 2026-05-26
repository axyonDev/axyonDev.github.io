# AXYON.DEV Final Reorg Patch

## Yapılanlar

- Tüm sayfalara ortak favicon, apple-touch-icon, canonical, Open Graph ve Twitter Card meta tagleri eklendi.
- Root `assets/` klasörü oluşturuldu; marka favicon ve ana OG görseli eklendi.
- Ana sayfadaki ürün linkleri açık HTML hedeflerine sabitlendi: `zikirmatik/index.html`, `kasa-defteri/index.html`.
- Ürün sayfalarındaki privacy linkleri ilgili ürünün kendi privacy klasörüne bağlandı.
- Dil menüsü tüm sayfalarda sağda sabitlendi; Arapça RTL modunda yer değiştirmemesi sağlandı.
- Mobilde tema paleti ile “Ana Sayfa” / geri dönüş linkinin üst üste binmemesi için üst boşluklar düzeltildi.
- Ana sayfadaki ürün kartı renkleri temalarla uyumlu olacak şekilde yeniden düzenlendi.
- Kasa Defteri statik metnindeki “Türkçe ve İngilizce” kalıntısı “Türkçe, İngilizce ve Arapça” olarak düzeltildi.
- `about.html` içindeki paper tema CSS selector hatası düzeltildi.
- Kullanılmayan ve ağır `images.js` base64 dosyaları kaldırıldı; görseller gerçek dosya yollarıyla çalışmaya devam ediyor.
- `robots.txt` ve `sitemap.xml` temizlendi/güncellendi.

## Kontrol Notu

- Kırık local link/görsel kontrolü yapılmıştır.
- Inline JavaScript syntax kontrolü yapılmıştır.
- `images.js` referansı kalmadığı kontrol edilmiştir.
