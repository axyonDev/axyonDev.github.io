// ============================================================
// SCRIPT v3: Sadece SEÇİLİ yuvarlak objelere clipping mask uygula
// KULLANIM:
//   1. Büyük bayrak görselini ve tüm yuvarlaklarını seç
//   2. File > Scripts > Other Script ile çalıştır
// ============================================================

#target illustrator

(function () {

    var doc = app.activeDocument;
    var layer = doc.activeLayer;

    // --- 1. Seçili objelerden kaynak görseli ve yuvarlakları ayır ---
    var sel = doc.selection;

    if (!sel || sel.length < 2) {
        alert("Lutfen buyuk gorseli ve yuvarlaklari secip tekrar calistirin!");
        return;
    }

    var sourceImage = null;
    var circles = [];

    for (var i = 0; i < sel.length; i++) {
        var item = sel[i];
        if (item.typename === "PlacedItem" || item.typename === "RasterItem") {
            // En büyük alan = kaynak görsel
            if (sourceImage === null ||
                (item.width * item.height) > (sourceImage.width * sourceImage.height)) {
                sourceImage = item;
            }
        } else if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
            circles.push(item);
        }
    }

    if (sourceImage === null) {
        alert("Secili objeler arasinda kaynak gorsel bulunamadi!\nBayrak sheet'ini de sectiginizden emin olun.");
        return;
    }

    if (circles.length === 0) {
        alert("Secili objeler arasinda yuvarlak (PathItem) bulunamadi!");
        return;
    }

    // --- 2. Her yuvarlak için: görsel kopyası + mask ---
    for (var k = 0; k < circles.length; k++) {
        var circle = circles[k];

        // Görsel kopyası (orijinal pozisyonunu korur → doğru bayrak hizası)
        var imgCopy = sourceImage.duplicate(layer, ElementPlacement.PLACEATEND);

        // Mask için yuvarlak kopyası
        var maskShape = circle.duplicate(layer, ElementPlacement.PLACEATEND);

        // İkisini seç ve grupla
        doc.selection = null;
        maskShape.selected = true;
        imgCopy.selected = true;

        app.executeMenuCommand("group");

        var grp = doc.selection[0];

        // Grup içinde PathItem en üste alınmalı (clipping mask için)
        var gpItems = grp.pageItems;
        for (var m = 0; m < gpItems.length; m++) {
            if (gpItems[m].typename === "PathItem" || gpItems[m].typename === "CompoundPathItem") {
                gpItems[m].zOrder(ZOrderMethod.BRINGTOFRONT);
                break;
            }
        }

        // Clipping mask uygula
        grp.clipped = true;

        // Orijinal yuvarlağı gizle
        circle.hidden = true;
    }

    // Kaynak görseli de gizle (artık kopyalar kullanılıyor)
    sourceImage.hidden = true;

    doc.selection = null;

    alert("Tamamlandi!\n" + circles.length + " yuvarlaga bayrak maskesi uygulandi.");

})();
