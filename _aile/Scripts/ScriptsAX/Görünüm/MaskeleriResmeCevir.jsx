/*
  Seçili Her Şeyi Resme Çevirme Scripti (V8 - Universal)
  Ahmet için hazırlandı.
  Mantık: Maske, resim, grup ayırt etmez. Seçili her nesneyi tek tek resme çevirir.
  Teknik: PARM hatasını önlemek için Temp Document (Balyoz) yöntemi kullanılır.
*/

(function() {
    var doc = app.activeDocument;
    var sel = doc.selection;

    // 1. Seçim Kontrolü (Artık tip kontrolü yapmıyoruz, ne varsa kabul)
    if (sel.length < 1) {
        alert("Hiçbir şey seçili değil dostum.");
        return;
    }

    // --- ARAYÜZ ---
    var w = new Window("dialog", "Hepsini Resme Çevir");
    w.alignChildren = "fill";
    
    var g1 = w.add("group");
    g1.add("statictext", undefined, "DPI:");
    var dpiInput = g1.add("edittext", undefined, "300");
    dpiInput.characters = 5;

    var transChk = w.add("checkbox", undefined, "Şeffaf Arkaplan");
    transChk.value = true;
    
    // Bilgi mesajını güncelledik
    w.add("statictext", undefined, sel.length + " adet obje seçili.\nHepsi tek tek işlenecek.");

    var gBtn = w.add("group");
    gBtn.alignment = "right";
    var btnOk = gBtn.add("button", undefined, "Başlat", {name:"ok"});
    var btnCancel = gBtn.add("button", undefined, "İptal", {name:"cancel"});

    btnOk.onClick = function() {
        w.close(1);
        
        var dpi = parseFloat(dpiInput.text) || 300;
        var opts = new RasterizeOptions();
        opts.resolution = dpi;
        opts.transparency = transChk.value;
        opts.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
        opts.colorModel = doc.documentColorSpace;

        // --- İŞLEM BAŞLIYOR ---
        // Geçici temiz belge açıyoruz (PARM ilacı)
        var tempDoc = app.documents.add(doc.documentColorSpace, 1000, 1000);
        
        var success = 0;
        var fails = 0;

        try {
            // Seçili her öğe için döngü
            // DİKKAT: Seçim dizisi canlı olabilir, o yüzden kopyasını almıyoruz ama
            // işlem yaparken dikkatli ilerliyoruz.
            for (var i = 0; i < sel.length; i++) {
                var item = sel[i];
                
                // Kilitli veya gizliyse atla
                if (item.locked || item.hidden) {
                    continue;
                }

                try {
                    // Orijinal koordinatları al
                    var origLeft = item.left;
                    var origTop = item.top;
                    var origZOrder = item.zOrderPosition; // Sıralama için

                    // 1. Öğeyi geçici belgeye kopyala
                    var tempItem = item.duplicate(tempDoc, ElementPlacement.PLACEATBEGINNING);
                    
                    // 2. Orada rasterize et (Hatasız işlem)
                    // visibleBounds kullanarak boyutunu otomatik algılasın
                    var finalRaster = tempDoc.rasterize(tempItem, tempItem.visibleBounds, opts);

                    // 3. Oluşan resmi orijinal belgeye, eskisinini hemen üzerine (PLACEBEFORE) getir
                    var resultItem = finalRaster.duplicate(item, ElementPlacement.PLACEBEFORE);
                    
                    // 4. Konumu sabitle (Piksel kaymasını önle)
                    resultItem.left = origLeft;
                    resultItem.top = origTop;

                    // 5. Orijinal vektör/maske/resmi sil
                    item.remove();

                    // 6. Çöpü temizle
                    finalRaster.remove();

                    success++;
                } catch(e) {
                    fails++;
                    // Hata olursa (örneğin çok karmaşık linked file) pas geç
                }
            }
        } catch(mainErr) {
            alert("Beklenmedik bir hata: " + mainErr);
        } finally {
            // Geçici belgeyi kaydetmeden kapat
            tempDoc.close(SaveOptions.DONOTSAVECHANGES);
        }

        alert("Operasyon Bitti.\n✅ Dönüştürülen: " + success + "\n❌ Atlanan: " + fails);
    };

    btnCancel.onClick = function() { w.close(0); };
    w.show();
})();