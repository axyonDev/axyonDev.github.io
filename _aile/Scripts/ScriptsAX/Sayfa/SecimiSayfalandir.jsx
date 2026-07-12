#target illustrator

try {
    if (app.documents.length == 0) throw 'Dosya yok!';
    var doc = app.documents[0];

    if (doc.selection.length > 0) {
        var sel = doc.selection;
        var items = [];

        // --- 1. ADIM: GELİŞMİŞ SINIR HESAPLAMA ---
        for (var i = 0; i < sel.length; i++) {
            var item = sel[i];
            
            // Yeni recursive fonksiyon ile sınırları hesapla
            var b = getTrueVisualBounds(item);

            // Eğer null döndüyse (hatalı bir durumsa) normal bounds kullan
            if (!b) b = item.visibleBounds;

            var w = Math.abs(b[2] - b[0]);
            var h = Math.abs(b[1] - b[3]);

            if (w < 0.1 || h < 0.1) continue;

            items.push({
                obj: item,
                bounds: b, // Hesaplanan temiz sınırları kullanıyoruz
                top: b[1],
                bottom: b[3],
                left: b[0]
            });
        }
        // ------------------------------------------

        // --- 2. ADIM: SIRALAMA (Eski mantık korundu) ---
        items.sort(function(a, b) {
            return b.top - a.top;
        });

        var rows = [];
        if (items.length > 0) {
            var currentRow = [items[0]];
            var rowMaxTop = items[0].top;
            var rowMinBottom = items[0].bottom;

            for (var i = 1; i < items.length; i++) {
                var item = items[i];
                var isOverlapping = (item.top > rowMinBottom) && (item.bottom < rowMaxTop);

                if (isOverlapping) {
                    currentRow.push(item);
                    if (item.top > rowMaxTop) rowMaxTop = item.top;
                    if (item.bottom < rowMinBottom) rowMinBottom = item.bottom;
                } else {
                    rows.push(currentRow);
                    currentRow = [item];
                    rowMaxTop = item.top;
                    rowMinBottom = item.bottom;
                }
            }
            rows.push(currentRow);
        }

        var finalSortedItems = [];
        for (var r = 0; r < rows.length; r++) {
            rows[r].sort(function(a, b) {
                return a.left - b.left;
            });
            finalSortedItems = finalSortedItems.concat(rows[r]);
        }
        
        // --- 3. ADIM: ARTBOARD OLUŞTURMA ---
        var count = 0;
        for (var i = 0; i < finalSortedItems.length; i++) {
            try {
                var rect = finalSortedItems[i].bounds;
                // [Sol, Üst, Sağ, Alt]
                var cleanRect = [
                    parseFloat(rect[0]), 
                    parseFloat(rect[1]), 
                    parseFloat(rect[2]), 
                    parseFloat(rect[3])
                ];
                doc.artboards.add(cleanRect);
                count++;
            } catch (err) {}
        }
        app.redraw();
        
    } else {
        throw 'Seçili obje yok.';
    }
} catch (e) {
    alert('Hata: ' + e);
}

// --- KRİTİK FONKSİYON: İÇ İÇE TARAMA ---
function getTrueVisualBounds(item) {
    // 1. Durum: Öğe bir Grup ise
    if (item.typename === 'GroupItem') {
        // Eğer bu grup MASKELENMİŞSE (Clipped), içindeki maskeyi bul
        if (item.clipped) {
            for (var j = 0; j < item.pageItems.length; j++) {
                var subItem = item.pageItems[j];
                // Maske yolu (clipping path) bu arkadaştır
                if (subItem.clipping) {
                    return subItem.geometricBounds;
                }
            }
            // Maske var dendi ama path bulunamadıysa (nadir), normal dön
            return item.visibleBounds; 
        } 
        // Grup maskeli DEĞİLSE, içindeki elemanları tek tek tarayıp birleştirmemiz lazım.
        // Çünkü içindeki elemanlardan biri maskeli olabilir!
        else {
            var combinedBounds = null;
            for (var k = 0; k < item.pageItems.length; k++) {
                var childBounds = getTrueVisualBounds(item.pageItems[k]);
                if (childBounds) {
                    if (combinedBounds === null) {
                        combinedBounds = childBounds;
                    } else {
                        // Sınırları birleştir (Sol, Üst, Sağ, Alt)
                        // Illustrator'da Üst koordinatı daha büyüktür (+Y yukarı)
                        combinedBounds[0] = Math.min(combinedBounds[0], childBounds[0]); // Sol (En küçük X)
                        combinedBounds[1] = Math.max(combinedBounds[1], childBounds[1]); // Üst (En büyük Y)
                        combinedBounds[2] = Math.max(combinedBounds[2], childBounds[2]); // Sağ (En büyük X)
                        combinedBounds[3] = Math.min(combinedBounds[3], childBounds[3]); // Alt (En küçük Y)
                    }
                }
            }
            return combinedBounds || item.visibleBounds;
        }
    } 
    // 2. Durum: Öğe Grup değilse (Resim, Text, Path vs.)
    else {
        return item.visibleBounds;
    }
}