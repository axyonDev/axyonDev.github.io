/*
  Toplu Maskeleme Scripti v9 (Anti-Crash) - Ahmet Güneş
  Mantık: zOrderPosition kullanmadan, Seçim Listesi sırasına göre (En Üstten Alta) işlem yapar.
  Internal Error hatasını çözer.
  Pembe kutular (En Üsttekiler) otomatik maske olur.
*/

(function() {
    // --- GÜVENLİK KONTROLÜ ---
    if (app.documents.length === 0) {
        alert("Belge açık değil abi.");
        return;
    }

    var doc = app.activeDocument;
    var sel = doc.selection;

    if (sel.length < 2) {
        alert("Maskelenecekleri seçip öyle çalıştır abi.");
        return;
    }

    // --- 1. ADIM: Listeyi Hazırla (Hatasız Yöntem) ---
    // Illustrator'de selection[0] GENELLİKLE en üstteki objedir.
    // Biz yine de listeyi olduğu gibi alıp, yukarıdan aşağı tarama mantığı güdeceğiz.
    
    var items = [];
    
    try {
        for (var i = 0; i < sel.length; i++) {
            // Hata veren zOrderPosition komutu kaldırıldı.
            // Sadece temel verileri alıyoruz.
            items.push({
                obj: sel[i],
                bounds: sel[i].geometricBounds, // [Sol, Üst, Sağ, Alt]
                isUsed: false // Bu obje işlendi mi?
            });
        }
    } catch(e) {
        alert("Veri okurken hata oluştu: " + e.message);
        return;
    }

    var maskedCount = 0;

    // --- 2. ADIM: "Yukarıdan Aşağıya" Sahiplenme Döngüsü ---
    // Listeyi baştan sona (En üstten en alta) tarıyoruz.
    // İlk gördüğümüz "Boşta" obje, potansiyel MASKEDİR (Senin pembe kutu).
    
    for (var i = 0; i < items.length; i++) {
        var potentialMask = items[i];

        // Eğer bu obje daha önce bir maskenin içine girdiyse, pas geç.
        if (potentialMask.isUsed) continue;

        // Bu bir Maske Adayı. Şimdi bunun ALTINDA kalan (listede daha ilerideki) ve
        // sınırlarının İÇİNE düşen gariplerini toplayalım.
        
        var contentList = [];
        var mBounds = potentialMask.bounds; // [L, T, R, B]

        for (var j = i + 1; j < items.length; j++) {
            var candidate = items[j];

            if (candidate.isUsed) continue;

            // ÇAKIŞMA KONTROLÜ (Merkez Noktası Yöntemi)
            // Eğer alttaki objenin merkezi, üstteki objenin (maskenin) sınırları içindeyse;
            // O obje maskenindir.
            
            var cBounds = candidate.bounds;
            var cCenterX = (cBounds[0] + cBounds[2]) / 2;
            var cCenterY = (cBounds[1] + cBounds[3]) / 2;

            // Maskenin sınırlarını 1 tık daraltarak kontrol edelim ki yan yana duran kutular birbirini yutmasın.
            // (Padding logic)
            var pad = 1; 
            if (cCenterX >= mBounds[0] + pad && cCenterX <= mBounds[2] - pad && 
                cCenterY <= mBounds[1] - pad && cCenterY >= mBounds[3] + pad) {
                
                contentList.push(candidate);
            }
        }

        // --- 3. ADIM: Maskeleme Operasyonu ---
        // Eğer bu kutunun altına denk gelen bir şeyler bulduysak, paketleyelim.
        if (contentList.length > 0) {
            try {
                // Yeni grup oluştur
                var clipGroup = doc.groupItems.add();
                
                // Grubu maskenin olduğu yere taşı
                clipGroup.move(potentialMask.obj, ElementPlacement.PLACEBEFORE);

                // 1. Maskeyi (En Üsttekini) grubun içine at
                potentialMask.obj.move(clipGroup, ElementPlacement.PLACEATBEGINNING);

                // 2. Bulduğumuz içerikleri gruba at
                for (var k = 0; k < contentList.length; k++) {
                    var contentItem = contentList[k];
                    contentItem.obj.move(clipGroup, ElementPlacement.PLACEATEND);
                    contentItem.isUsed = true; // Artık bu obje kullanıldı, başkası alamaz.
                }

                // 3. Maskeyi vur
                clipGroup.clipped = true;
                
                // Maskenin kendisini de "kullanıldı" işaretle
                potentialMask.isUsed = true;
                maskedCount++;

            } catch (err) {
                // Hata olursa (kilitli layer vs) sessizce devam et
            }
        }
    }

    if (maskedCount > 0) {
        alert(maskedCount + " adet grup başarıyla maskelendi abi! En üsttekiler kazandı.");
    } else {
        alert("Eşleşme bulunamadı. Pembe kutuların resimlerin ÜSTÜNDE olduğundan emin ol.");
    }

})();