#target illustrator

function centerContentsOnArtboards() {
    if (app.documents.length === 0) {
        alert("Açık bir belge yok dostum.");
        return;
    }

    var doc = app.activeDocument;
    var abCount = doc.artboards.length;

    for (var i = 0; i < abCount; i++) {
        // 1. O anki Artboard'u aktif yap
        doc.artboards.setActiveArtboardIndex(i);
        var ab = doc.artboards[i];
        
        // 2. Seçimi temizle ve o artboard üzerindeki her şeyi seç
        doc.selection = null;
        doc.selectObjectsOnActiveArtboard();
        
        var sel = doc.selection;

        if (sel.length > 0) {
            // 3. Eğer birden fazla parça varsa, hizalamak için geçici olarak grupla
            // PDF sayfaları genelde "Clip Group" gelir ama garanti olsun.
            var workItem;
            if (sel.length > 1) {
                app.executeMenuCommand('group');
                workItem = doc.selection[0];
            } else {
                workItem = sel[0];
            }

            // 4. Matematiksel Merkez Hesaplama
            // Artboard Koordinatları: [Sol, Üst, Sağ, Alt]
            var abRect = ab.artboardRect;
            var abWidth = abRect[2] - abRect[0];
            var abHeight = abRect[1] - abRect[3]; // Illustrator'de Y ekseni aşağı doğru negatiftir
            var abCenterX = abRect[0] + (abWidth / 2);
            var abCenterY = abRect[1] - (abHeight / 2); // Üstten alta inildikçe değer azalır

            // Nesne Koordinatları (VisibleBounds kullanıyoruz ki maskeleri değil görüneni baz alsın)
            var itemBounds = workItem.visibleBounds;
            var itemWidth = itemBounds[2] - itemBounds[0];
            var itemHeight = itemBounds[1] - itemBounds[3];
            var itemCenterX = itemBounds[0] + (itemWidth / 2);
            var itemCenterY = itemBounds[1] - (itemHeight / 2);

            // 5. Aradaki fark kadar taşı
            var deltaX = abCenterX - itemCenterX;
            var deltaY = abCenterY - itemCenterY;

            workItem.translate(deltaX, deltaY);
            
            // İstersen işlem bitince grubu bozabilirsin ama PDF bütünlüğü için bozmamak daha iyi.
            // app.executeMenuCommand('ungroup'); 
        }
    }
    doc.selection = null; // En son seçimi bırak
}

centerContentsOnArtboards();