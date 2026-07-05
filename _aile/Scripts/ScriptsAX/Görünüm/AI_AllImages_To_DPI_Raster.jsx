#target illustrator

/*
    AI_AllImages_To_DPI_Raster.jsx
    Amaç:
    - Aktif Illustrator belgesindeki tüm görsel öğeleri belirlenen DPI’da rasterize eder.
    - Clipping mask, grup, layer yapısını mümkün olduğunca bozmaz.
    - Sadece PlacedItem ve RasterItem hedeflenir.
    - Grup/clipping mask objelerinin kendisi rasterize edilmez.
    - Kilitli/gizli öğeler atlanır.

    Kullanım:
    File > Scripts > Other Script... ile çalıştır.
    Önce dosyanın yedeğini alman önerilir.
*/

(function () {
    if (app.documents.length === 0) {
        alert("Açık Illustrator belgesi yok.");
        return;
    }

    var doc = app.activeDocument;
    var oldInteraction = app.userInteractionLevel;

    var dpiText = prompt(
        "Resimleri kaç DPI/PPI rasterize edelim?\n\nÖneri: Baskı için 300, büyük ebat için 150-200.",
        "300"
    );

    if (dpiText === null) {
        return;
    }

    dpiText = String(dpiText).replace(",", ".");
    var dpi = parseFloat(dpiText);

    if (isNaN(dpi)) {
        alert("Geçerli bir DPI değeri girilmedi.");
        return;
    }

    if (dpi < 72) {
        dpi = 72;
    }

    if (dpi > 2400) {
        dpi = 2400;
    }

    var options = new RasterizeOptions();
    options.resolution = dpi;
    options.transparency = true;
    options.clippingMask = false;
    options.padding = 0;
    options.convertSpotColors = false;
    options.convertTextToOutlines = false;
    options.includeLayers = false;

    try {
        options.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
    } catch (e1) {}

    try {
        options.colorModel = RasterizationColorModel.DEFAULTCOLORMODEL;
    } catch (e2) {}

    var targets = [];
    var skipped = [];
    var failed = [];

    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

    try {
        collectImageItems(doc, targets);

        if (targets.length === 0) {
            alert("Belgede rasterize edilecek PlacedItem/RasterItem bulunamadı.");
            app.userInteractionLevel = oldInteraction;
            return;
        }

        var converted = 0;

        for (var i = 0; i < targets.length; i++) {
            var item = targets[i];

            if (!isValidItem(item)) {
                skipped.push("Geçersiz veya erişilemeyen öğe");
                continue;
            }

            if (!isProcessable(item)) {
                skipped.push(getSafeName(item) + " / kilitli, gizli veya düzenlenemez");
                continue;
            }

            try {
                var oldName = getSafeName(item);
                var bounds = getRasterBounds(item);

                if (!bounds) {
                    skipped.push(oldName + " / sınırlar okunamadı");
                    continue;
                }

                var newRaster = doc.rasterize(item, bounds, options);

                try {
                    if (oldName !== "") {
                        newRaster.name = oldName;
                    } else {
                        newRaster.name = "Rasterized_" + dpi + "dpi";
                    }
                } catch (e3) {}

                converted++;
            } catch (err) {
                failed.push(getSafeName(item) + " / " + err);
            }
        }

        app.userInteractionLevel = oldInteraction;
        app.redraw();

        var msg = "";
        msg += "İşlem tamamlandı.\n\n";
        msg += "DPI: " + dpi + "\n";
        msg += "Bulunan görsel: " + targets.length + "\n";
        msg += "Rasterize edilen: " + converted + "\n";
        msg += "Atlanan: " + skipped.length + "\n";
        msg += "Hata: " + failed.length + "\n\n";

        if (failed.length > 0) {
            msg += "Hatalar:\n";
            for (var f = 0; f < failed.length && f < 10; f++) {
                msg += "- " + failed[f] + "\n";
            }
            if (failed.length > 10) {
                msg += "... +" + (failed.length - 10) + " hata daha\n";
            }
        }

        alert(msg);

    } catch (mainErr) {
        app.userInteractionLevel = oldInteraction;
        alert("Script durdu:\n" + mainErr);
    }


    function collectImageItems(documentRef, arr) {
        /*
            doc.pageItems koleksiyonu belgedeki alt grup içindeki öğeleri de kapsar.
            Burada sadece gerçek görsel türleri alınır.
        */
        for (var i = 0; i < documentRef.pageItems.length; i++) {
            var it = documentRef.pageItems[i];

            if (isImageItem(it)) {
                arr.push(it);
            }
        }
    }


    function isImageItem(it) {
        if (!it) {
            return false;
        }

        try {
            return it.typename === "PlacedItem" || it.typename === "RasterItem";
        } catch (e) {
            return false;
        }
    }


    function isValidItem(it) {
        try {
            var t = it.typename;
            var p = it.parent;
            return !!t && !!p;
        } catch (e) {
            return false;
        }
    }


    function isProcessable(it) {
        /*
            Kilitli/gizli item, grup veya layer içindeyse işlem yapılmaz.
            Böylece belge yapısı bozulma riski azaltılır.
        */
        try {
            if (it.locked || it.hidden) {
                return false;
            }
        } catch (e1) {}

        try {
            if (it.editable === false) {
                return false;
            }
        } catch (e2) {}

        try {
            if (it.clipping === true) {
                return false;
            }
        } catch (e3) {}

        var p = null;

        try {
            p = it.parent;
        } catch (e4) {
            return false;
        }

        while (p && p.typename !== "Document") {
            try {
                if (p.typename === "Layer") {
                    if (p.locked || p.visible === false) {
                        return false;
                    }
                } else {
                    if (p.locked || p.hidden) {
                        return false;
                    }
                }
            } catch (e5) {}

            try {
                p = p.parent;
            } catch (e6) {
                break;
            }
        }

        return true;
    }


    function getRasterBounds(it) {
        /*
            visibleBounds görünür etki alanını korur.
            Okunamazsa geometricBounds denenir.
        */
        try {
            var vb = it.visibleBounds;
            if (isGoodBounds(vb)) {
                return vb;
            }
        } catch (e1) {}

        try {
            var gb = it.geometricBounds;
            if (isGoodBounds(gb)) {
                return gb;
            }
        } catch (e2) {}

        return null;
    }


    function isGoodBounds(b) {
        if (!b || b.length !== 4) {
            return false;
        }

        var left = b[0];
        var top = b[1];
        var right = b[2];
        var bottom = b[3];

        if (isNaN(left) || isNaN(top) || isNaN(right) || isNaN(bottom)) {
            return false;
        }

        if (Math.abs(right - left) < 0.01 || Math.abs(top - bottom) < 0.01) {
            return false;
        }

        return true;
    }


    function getSafeName(it) {
        try {
            if (it.name && String(it.name) !== "") {
                return String(it.name);
            }
        } catch (e) {}

        try {
            return "[" + it.typename + "]";
        } catch (e2) {}

        return "[Adsız]";
    }

})();
