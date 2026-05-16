/* AHMET PANEL - BALYOZ MODU V12 (DİREKT RASTERIZE) */
#target illustrator

(function() {
    var doc = app.activeDocument;
    var uName = "AhmetBalyozAyar.txt"; // Ayarları tutacak dosya
    var ayarDosyasi = new File(Folder.userData + "/" + uName);

    // --- AYAR OKUMA ---
    function ayarlariOku() {
        if (ayarDosyasi.exists) {
            ayarDosyasi.open("r");
            var veri = ayarDosyasi.read();
            ayarDosyasi.close();
            var sayi = parseFloat(veri);
            return isNaN(sayi) ? 3 : sayi;
        }
        return 3;
    }

    // --- AYAR KAYDETME ---
    function ayarlariKaydet(deger) {
        ayarDosyasi.open("w");
        ayarDosyasi.write(deger);
        ayarDosyasi.close();
    }

    // --- GÜVENLİ KOMUT ÇALIŞTIRICI ---
    function run(cmd) {
        try { app.executeMenuCommand(cmd); } catch(e) {}
    }

    if (doc.selection.length == 0) {
        alert("Dostum bir şey seç de balyozu vuralım.");
        return;
    }

    // --- ARAYÜZ ---
    var sonDeger = ayarlariOku();
    
    var win = new Window("dialog", "Balyoz Ofset (V12)");
    win.alignChildren = "center";
    
    var g1 = win.add("group");
    g1.add("statictext", undefined, "Taşırma (mm):");
    var inp = g1.add("edittext", undefined, sonDeger.toString());
    inp.characters = 5;
    inp.active = true;

    var btnGroup = win.add("group");
    btnGroup.add("button", undefined, "Yapıştır", {name: "ok"});
    btnGroup.add("button", undefined, "İptal", {name: "cancel"});

    if (win.show() == 1) {
        var mmVal = parseFloat(inp.text);
        if (isNaN(mmVal)) mmVal = 0;
        
        ayarlariKaydet(mmVal); // Rakamı hatırla

        // Ofset Stroke Hesabı
        var strokeVal = (mmVal * 2.834645) * 2; 

        // 1. KOPYALA VE YAPIŞTIR
        run('copy');
        run('pasteBack');
        
        // --- 2. DİREKT RASTERIZE (HİÇ KURCALAMADAN RESME ÇEVİR) ---
        // Burada ungroup falan yapmıyoruz. Olduğu gibi resim yapıyoruz.
        // Böylece "Can't ungroup" hatası imkansız hale geliyor.
        
        var sel = doc.selection[0];
        
        try {
            var rasterOpts = new RasterizeOptions();
            rasterOpts.resolution = 300; // Kaliteli olsun
            rasterOpts.transparency = true;
            rasterOpts.padding = 72; // Kenarlardan bol bol pay bırak (kesilmesin)
            rasterOpts.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
            
            // İşte sihirli değnek burası:
            var rasterItem = doc.rasterize(sel, sel.visibleBounds, rasterOpts);
            
            // --- 3. IMAGE TRACE (SİLÜET ÇIKARMA) ---
            doc.selection = null;
            rasterItem.selected = true;
            
            var tracePlugin = rasterItem.trace();
            var tOpts = tracePlugin.tracing.tracingOptions;
            
            // Sadece Siyah Leke Modu
            tOpts.tracingMode = TracingModeType.TRACINGMODEBLACKANDWHITE;
            tOpts.ignoreWhite = true; // Beyazları uçur
            tOpts.threshold = 128;
            tOpts.fills = true;
            tOpts.strokes = false;
            tOpts.pathFitting = 2; // Sıkı takip etsin
            tOpts.cornerAngle = 40;
            
            // Trace işlemini bitir (Expand)
            run('expandStyle'); 
            
            // --- 4. TEMİZLİK ---
            // Artık elimizde basit bir trace sonucu var. Bunu ungroup yapmak sorun çıkarmaz.
            // Ama garanti olsun diye ungroup YERİNE "Merge" (Birleştir) kullanacağız.
            
            run('Live Pathfinder Add'); // Ne varsa tek parça yap
            run('expandStyle');
            
            // --- 5. ŞİŞİRME (STROKE TAKTİĞİ) ---
            // Temiz vektöre stroke veriyoruz.
            
            var cyanColor = new CMYKColor();
            cyanColor.cyan = 100; cyanColor.magenta = 0; cyanColor.yellow = 0; cyanColor.black = 0;

            var finalSel = doc.selection;
            
            for(var i=0; i<finalSel.length; i++) {
                var item = finalSel[i];
                try {
                    item.filled = true;
                    item.fillColor = cyanColor;
                    item.stroked = true;
                    item.strokeWidth = strokeVal;
                    item.strokeJoin = StrokeJoin.ROUNDENDJOIN; // Yuvarlak
                    item.strokeCap = StrokeCap.ROUNDENDCAP;
                    item.strokeColor = cyanColor;
                } catch(e) {}
            }
            
            // --- 6. BIÇAK İZİNE ÇEVİR (OUTLINE STROKE) ---
            run('Outline Stroke');
            
            // Son kez kaynat
            run('Live Pathfinder Add');
            run('expandStyle');
            
            // Tek parça bileşik yol yap (Dağılmasın)
            try { app.executeMenuCommand('compoundPath'); } catch(e) {}
            
            // Rengi düzelt (Trace bazen siyah bırakır)
            if (doc.selection.length > 0) {
                doc.selection[0].fillColor = cyanColor;
                doc.selection[0].strokeColor = new NoColor();
            }

            // Seçimi bırak
            doc.selection = null;

        } catch(e) {
            alert("Balyoz bile işlemedi be dostum: " + e);
        }
    }
})();