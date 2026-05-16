/*
  Ahmet Güneş için Özel Dağıtıcı Script v4 - TURBO MOD
  Özellikler: 
  - SEMBOL MANTIĞI İLE IŞIK HIZINDA DAĞITIM
  - MM Cinsinden Aralıklar
  - Seçimli Rastgele Boyutlandırma
  - Taşma Payı (Bleed)
*/

(function() {
    if (app.documents.length === 0) {
        alert("Dostum, açık bir belge yok!");
        return;
    }

    var doc = app.activeDocument;
    if (doc.selection.length === 0) {
        alert("Lütfen çoğaltılacak objeyi seç.");
        return;
    }

    var sourceObj = doc.selection[0];
    var mm2pt = 2.83464567; // MM to Point

    // --- ARAYÜZ ---
    var win = new Window("dialog", "Ahmet'in Turbo Dağıtıcısı v4");
    win.orientation = "column";
    win.alignChildren = "fill";

    // Aralıklar
    var pnlSpace = win.add("panel", undefined, "Mesafe (mm)");
    pnlSpace.alignChildren = "left";
    var grpX = pnlSpace.add("group");
    grpX.add("statictext", undefined, "Yatay:");
    var inpSpaceX = grpX.add("edittext", undefined, "10"); inpSpaceX.characters = 5;
    var grpY = pnlSpace.add("group");
    grpY.add("statictext", undefined, "Dikey:");
    var inpSpaceY = grpY.add("edittext", undefined, "10"); inpSpaceY.characters = 5;
    var chkStagger = pnlSpace.add("checkbox", undefined, "Satırları Kaydır (Tuğla)");

    // Taşma
    var pnlBleed = win.add("panel", undefined, "Taşma (Bleed)");
    pnlBleed.alignChildren = "left";
    var chkDoBleed = pnlBleed.add("checkbox", undefined, "Taşma Payı Ekle");
    var inpBleedAmt = pnlBleed.add("edittext", undefined, "3"); inpBleedAmt.characters = 5; inpBleedAmt.enabled = false;
    chkDoBleed.onClick = function() { inpBleedAmt.enabled = chkDoBleed.value; }

    // Açı
    var pnlRot = win.add("panel", undefined, "Açı");
    pnlRot.alignChildren = "left";
    var grpRot = pnlRot.add("group");
    grpRot.add("statictext", undefined, "Sabit:");
    var inpBaseRot = grpRot.add("edittext", undefined, "0"); inpBaseRot.characters = 4;
    var chkRandRot = pnlRot.add("checkbox", undefined, "Rastgele (0-360°)");

    // Boyut
    var pnlScale = win.add("panel", undefined, "Boyutlandırma");
    pnlScale.alignChildren = "left";
    var chkDoScale = pnlScale.add("checkbox", undefined, "Aktif Et");
    var grpScl = pnlScale.add("group");
    grpScl.add("statictext", undefined, "Min %:");
    var inpScaleMin = grpScl.add("edittext", undefined, "80"); inpScaleMin.characters = 4; inpScaleMin.enabled = false;
    grpScl.add("statictext", undefined, "Max %:");
    var inpScaleMax = grpScl.add("edittext", undefined, "120"); inpScaleMax.characters = 4; inpScaleMax.enabled = false;
    chkDoScale.onClick = function() { inpScaleMin.enabled = chkDoScale.value; inpScaleMax.enabled = chkDoScale.value; }

    // PERFORMANS AYARI
    var pnlPerf = win.add("panel", undefined, "Çıktı Ayarı");
    pnlPerf.alignChildren = "left";
    var chkExpand = pnlPerf.add("checkbox", undefined, "İşlem Bitince Objeye Çevir (Expand)");
    chkExpand.value = true;
    pnlPerf.add("statictext", undefined, "(İpucu: İşaretlemezsen 'Sembol' kalır, çok daha hızlı çalışır.)");

    // Butonlar
    var grpBtns = win.add("group");
    grpBtns.alignment = "center";
    var btnOk = grpBtns.add("button", undefined, "Çat Diye Yap");
    var btnCancel = grpBtns.add("button", undefined, "İptal");

    btnOk.onClick = function() {
        win.close(1);
        // UI güncellemesini engellemek için küçük bir hile (her zaman çalışmayabilir ama denemeye değer)
        processTurbo();
    }
    btnCancel.onClick = function() { win.close(0); }

    win.show();

    function processTurbo() {
        var spX = parseFloat(inpSpaceX.text) * mm2pt; 
        var spY = parseFloat(inpSpaceY.text) * mm2pt;
        var bleedPt = chkDoBleed.value ? parseFloat(inpBleedAmt.text) * mm2pt : 0;
        
        // --- 1. ADIM: GEÇİCİ SEMBOL OLUŞTURMA ---
        // Orijinal objeyi bozmamak için kopyasını alıp sembol yapalım
        var tempSource = sourceObj.duplicate();
        var tempSymbolName = "Gecici_Desen_Sembol_" + Math.floor(Math.random() * 1000);
        var tempSymbol = doc.symbols.add(tempSource);
        tempSymbol.name = tempSymbolName;
        tempSource.remove(); // Kopyayı silebiliriz, sembol artık kütüphanede

        // Artboard Sınırları
        var abIdx = doc.artboards.getActiveArtboardIndex();
        var abRect = doc.artboards[abIdx].artboardRect;
        var startY = abRect[1] + bleedPt;
        var endY = abRect[3] - bleedPt;
        var startXBase = abRect[0] - bleedPt;
        var endX = abRect[2] + bleedPt;

        var resultGroup = doc.groupItems.add();
        resultGroup.name = "Turbo_Desen_Grubu";

        var rowCount = 0;
        var counter = 0;

        // --- 2. ADIM: IŞIK HIZINDA DÖNGÜ ---
        for (var y = startY; y > endY; y -= spY) {
            var currentStartX = startXBase;
            if (chkStagger.value && (rowCount % 2 !== 0)) {
                currentStartX += spX / 2;
            }

            for (var x = currentStartX; x < endX; x += spX) {
                // Burada "duplicate" yerine "symbolItems.add" kullanıyoruz. ÇOK HIZLI.
                var newItem = resultGroup.symbolItems.add(tempSymbol);
                newItem.position = [x, y];

                // Açı
                var finalRot = parseFloat(inpBaseRot.text);
                if (chkRandRot.value) finalRot += Math.random() * 360;
                if (finalRot !== 0) newItem.rotate(finalRot);

                // Boyut
                if (chkDoScale.value) {
                    var sMin = parseFloat(inpScaleMin.text);
                    var sMax = parseFloat(inpScaleMax.text);
                    var scaleFactor = sMin + Math.random() * (sMax - sMin);
                    newItem.resize(scaleFactor, scaleFactor);
                }
                counter++;
            }
            rowCount++;
        }

        // --- 3. ADIM: TEMİZLİK VE EXPAND ---
        if (chkExpand.value) {
            // Kullanıcı normal obje istiyor, sembol bağlarını koparalım.
            // Bu kısım çok obje varsa biraz sürebilir ama oluşturmaktan hızlıdır.
            var items = resultGroup.symbolItems;
            for (var i = items.length - 1; i >= 0; i--) {
                items[i].breakLink();
            }
            // Geçici sembolü kütüphaneden silelim
            tempSymbol.remove();
        }

        alert("Operasyon Tamam Dostum!\nToplam " + counter + " adet obje " + (chkExpand.value ? "oluşturuldu ve patlatıldı." : "sembol olarak dizildi."));
    }
})();