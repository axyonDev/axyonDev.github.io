#target illustrator

function tumResimleriEmbedle() {
    // 1. Belge açık mı kontrol et
    if (app.documents.length === 0) {
        alert("Açık bir belge bulamadım dostum.");
        return;
    }

    var doc = app.activeDocument;
    var items = doc.placedItems; // Sadece linkli (embedlenmemiş) görselleri alır
    var sayac = 0;

    // 2. Eğer hiç linkli görsel yoksa haber ver
    if (items.length === 0) {
        alert("Belgede embedlenmemiş (linkli) görsel yok, her şey yolunda.");
        return;
    }

    // 3. Tersten döngü ile hepsini embedle
    // (Tersten gitmek koleksiyon yapısı değiştiği için daha güvenlidir)
    for (var i = items.length - 1; i >= 0; i--) {
        try {
            items[i].embed();
            sayac++;
        } catch (e) {
            // Görsel yolu bozuksa veya başka bir sorun varsa atlar
        }
    }

    // 4. Rapor ver
    alert("İşlem Tamam!\nToplam " + sayac + " adet görsel başarıyla embedlendi.");
}

// Fonksiyonu çalıştır
tumResimleriEmbedle();