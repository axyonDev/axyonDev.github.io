#target illustrator

try {
    if (app.documents.length == 0) {
        alert("Açık bir çalışma sayfası yok!");
    } else {
        var doc = app.activeDocument;
        doc.selection = null; // Önce mevcut seçimleri bırakalım
        
        var textFrames = doc.textFrames;
        var sayac = 0;

        // Tüm yazıların üzerinden geç
        for (var i = 0; i < textFrames.length; i++) {
            var tf = textFrames[i];
            // Yazı kilitli değilse, görünürse ve katmanı kilitli değilse seç
            if (!tf.locked && !tf.hidden && !tf.layer.locked && !tf.layer.hidden) {
                tf.selected = true;
                sayac++;
            }
        }

        // Sonuç Raporu
        if (sayac === 0) {
            if (textFrames.length > 0) {
                // Yazı var ama seçilemedi (Muhtemelen kilitli)
                alert("⚠️ Dökümanda yazı var ama hepsi KİLİTLİ veya GİZLİ olduğu için seçilemedi.");
            } else {
                // Hiç yazı yok
                alert("⚠️ Bu sayfada hiç yazı (Text Frame) bulunamadı.");
            }
        } 
        // İstersen başarılı olunca da yazsın diye şu satırı açabilirsin:
        // else { alert(sayac + " adet yazı seçildi."); }
        
        app.redraw();
    }
} catch (e) {
    alert('Bir hata oluştu: ' + e);
}