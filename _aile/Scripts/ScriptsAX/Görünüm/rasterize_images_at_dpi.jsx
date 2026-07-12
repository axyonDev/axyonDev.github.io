/**
 * Rasterize Images at Target DPI
 * ─────────────────────────────────────────────────────────────────
 * Belgedeki tüm PlacedItem ve RasterItem nesnelerini seçilen DPI'da
 * rasterize eder. Clipping mask ve grup yapısına dokunmaz; sadece
 * içindeki resim öğesini değiştirir.
 *
 * Kullanım: File > Scripts > Other Script… ile çalıştırın.
 * ─────────────────────────────────────────────────────────────────
 */

#target illustrator

(function () {

    // ── 0. Temel kontroller ──────────────────────────────────────
    if (!app.documents.length) {
        alert("Açık bir belge yok.", "Hata");
        return;
    }

    var doc = app.activeDocument;

    // ── 1. DPI girişi ────────────────────────────────────────────
    var dpiInput = prompt(
        "Hedef DPI değerini girin:\n(Örnek: 72 / 150 / 300)",
        "150"
    );
    if (dpiInput === null) return; // İptal

    var targetDPI = parseFloat(dpiInput);
    if (isNaN(targetDPI) || targetDPI <= 0 || targetDPI > 2400) {
        alert("Geçersiz DPI değeri. 1–2400 arası bir sayı girin.", "Hata");
        return;
    }

    // ── 2. Tüm resim öğelerini topla ─────────────────────────────
    var imageItems = [];
    collectImages(doc, imageItems);

    if (imageItems.length === 0) {
        alert("Belgede işlenecek resim bulunamadı.", "Bilgi");
        return;
    }

    // ── 3. Rasterize ayarları ────────────────────────────────────
    var opts = new RasterizeOptions();
    opts.resolution          = targetDPI;
    opts.colorModel          = RasterizeColorModel.DEFAULTCOLORMODEL;
    opts.antiAliasingMethod  = AntiAliasingMethod.ARTOPTIMIZED;
    opts.transparency        = true;
    opts.clippingMask        = false;   // Maske ekleme, varolan korunsun
    opts.includeLayers       = false;
    opts.convertSpotColors   = false;
    opts.backgroundBlack     = false;

    // ── 4. İşlemi uygula ─────────────────────────────────────────
    var successCount = 0;
    var errorCount   = 0;
    var errorLog     = [];

    // Sondan başa döngü: rasterize sonrası index kaymasını önler
    for (var i = imageItems.length - 1; i >= 0; i--) {
        var item = imageItems[i];

        try {
            var bounds = item.visibleBounds; // [left, top, right, bottom]
            doc.rasterize(item, bounds, opts);
            successCount++;
        } catch (e) {
            errorCount++;
            errorLog.push("Öğe " + i + ": " + e.message);
        }
    }

    // ── 5. Sonuç raporu ──────────────────────────────────────────
    var msg = successCount + " resim " + targetDPI + " DPI'a dönüştürüldü.";
    if (errorCount > 0) {
        msg += "\n" + errorCount + " öğe atlandı:\n" + errorLog.join("\n");
    }
    alert(msg, "Tamamlandı");

})();


// ── Yardımcı: Tüm hiyerarşiyi tara, sadece resim öğelerini topla ──
function collectImages(container, result) {

    var items;

    // Document, Layer veya GroupItem fark etmez — pageItems üzerinden git
    try {
        items = container.pageItems;
    } catch (e) {
        return;
    }

    for (var i = 0; i < items.length; i++) {
        var item = items[i];

        switch (item.typename) {

            case "PlacedItem":   // Bağlı (linked) görsel
            case "RasterItem":   // Gömülü (embedded) görsel
                result.push(item);
                break;

            case "GroupItem":
                // Clipped (clipping mask grubu) olsa da olmasa da
                // içindeki resimlere in — grubun kendisini rasterize etme
                collectImages(item, result);
                break;

            case "Layer":
                collectImages(item, result);
                break;

            // PathItem, TextFrame, SymbolItem vb. → atla
            default:
                break;
        }
    }
}
