/*
  Toplu Maskeleme Scripti
  Ahmet için hazırlanmıştır.
  Mantık: Seçili kareleri, altlarında kalan resimlere otomatik maskeler.
*/

(function() {
    if (app.documents.length === 0) {
        alert("Açık bir belge yok dostum.");
        return;
    }

    var doc = app.activeDocument;
    var sel = doc.selection;

    if (sel.length < 2) {
        alert("Lütfen en az bir resim ve bir kare seç.");
        return;
    }

    var paths = [];
    var rasters = [];

    // Seçilenleri ayıkla (Kareler ve Resimler)
    for (var i = 0; i < sel.length; i++) {
        if (sel[i].typename === "PathItem" || sel[i].typename === "CompoundPathItem") {
            paths.push(sel[i]);
        } else if (sel[i].typename === "RasterItem" || sel[i].typename === "PlacedItem") {
            rasters.push(sel[i]);
        }
    }

    if (paths.length === 0 || rasters.length === 0) {
        alert("Seçimde hem kare (vektör) hem de resim olmalı.");
        return;
    }

    var maskedCount = 0;

    // Her kare için altına denk gelen resmi bul
    for (var p = 0; p < paths.length; p++) {
        var currentPath = paths[p];
        var pBounds = currentPath.geometricBounds; // [Sol, Üst, Sağ, Alt]
        
        // Karenin merkezini bul
        var pCenterX = (pBounds[0] + pBounds[2]) / 2;
        var pCenterY = (pBounds[1] + pBounds[3]) / 2;

        for (var r = 0; r < rasters.length; r++) {
            var currentRaster = rasters[r];
            
            // Eğer resim zaten maskelenmişse atla (hatayı önlemek için)
            if (currentRaster.parent.typename === "GroupItem" && currentRaster.parent.clipped) {
                continue;
            }

            var rBounds = currentRaster.geometricBounds;

            // Karenin merkezi, Resmin sınırları içinde mi?
            // (Y koordinatları Illustrator'de terstir, dikkat)
            if (pCenterX >= rBounds[0] && pCenterX <= rBounds[2] && 
                pCenterY <= rBounds[1] && pCenterY >= rBounds[3]) {
                
                try {
                    // Maskeleme işlemi
                    // 1. Kareyi resmin hemen üzerine taşı (Z-order)
                    currentPath.move(currentRaster, ElementPlacement.PLACEBEFORE);
                    
                    // 2. İkisini grupla
                    var maskGroup = doc.groupItems.add();
                    maskGroup.move(currentRaster, ElementPlacement.PLACEBEFORE);
                    currentPath.move(maskGroup, ElementPlacement.PLACEATEND);
                    currentRaster.move(maskGroup, ElementPlacement.PLACEATEND);
                    
                    // 3. Maskeyi uygula
                    maskGroup.clipped = true;
                    
                    maskedCount++;
                    break; // Bu kare için resim bulundu, döngüden çık
                } catch (e) {
                    // Hata olursa devam et
                }
            }
        }
    }

    alert(maskedCount + " adet resim başarıyla maskelendi!");

})();