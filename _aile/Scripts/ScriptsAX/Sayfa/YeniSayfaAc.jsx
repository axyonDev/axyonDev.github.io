#target illustrator

try {
    if (app.documents.length > 0) {
        var win = new Window('dialog', 'Yeni Sayfa Aç');
        win.orientation = 'column';
        win.alignChildren = ['fill', 'top'];
        win.spacing = 10;
        win.margins = 16;

        // --- PRESET LISTESI ---
        win.add('statictext', undefined, 'Ebat Seç veya Manuel Gir:');
        
        var sizeList = [
            "70 x 100 cm", "64 x 90 cm", "57 x 82 cm", "50 x 70 cm", 
            "45 x 64 cm", "41 x 57 cm", "35 x 50 cm", "32 x 45 cm", 
            "28.5 x 41 cm", "21 x 29.7 cm (A4)", "29.7 x 42 cm (A3)"
        ];
        
        var sizes = [
            [100, 70], [90, 64], [82, 57], [70, 50], 
            [64, 45], [57, 41], [50, 35], [45, 32], 
            [41, 28.5], [21, 29.7], [29.7, 42]
        ];

        var drop = win.add('dropdownlist', undefined, sizeList);
        drop.selection = 0;

        // --- MANUEL GİRİŞ GRUBU ---
        var grpInput = win.add('group');
        grpInput.orientation = 'row';
        grpInput.alignChildren = ['fill', 'center'];

        // Genişlik
        grpInput.add('statictext', undefined, 'En (cm):');
        var inpW = grpInput.add('edittext', undefined, sizes[0][0]);
        inpW.characters = 6;

        // Yükseklik
        grpInput.add('statictext', undefined, 'Boy (cm):');
        var inpH = grpInput.add('edittext', undefined, sizes[0][1]);
        inpH.characters = 6;

        // --- FONKSİYONLAR ---
        // Listeden seçince inputları güncelle
        drop.onChange = function() {
            if (drop.selection != null) {
                var s = sizes[drop.selection.index];
                inpW.text = s[0];
                inpH.text = s[1];
            }
        }

        // --- BUTONLAR ---
        var grpBtn = win.add('group');
        grpBtn.alignment = 'center';
        
        var btnCancel = grpBtn.add('button', undefined, 'İptal', {name: 'cancel'});
        var btnOk = grpBtn.add('button', undefined, 'Oluştur', {name: 'ok'});

        if (win.show() == 1) {
            // Değerleri al ve virgülü noktaya çevir
            var wVal = parseFloat(inpW.text.replace(',', '.'));
            var hVal = parseFloat(inpH.text.replace(',', '.'));

            if (isNaN(wVal) || isNaN(hVal)) {
                alert("Lütfen geçerli bir sayı giriniz!");
            } else {
                var doc = app.activeDocument;
                
                // CM -> Point Dönüşümü
                var wPt = wVal * 28.34645;
                var hPt = hVal * 28.34645;

                // Yeni Artboard Ekle (0,0 koordinatına ekler)
                // Rect Formülü: [Sol, Üst, Sağ, Alt]
                doc.artboards.add([0, 0, wPt, -hPt]);
            }
        }
    } else {
        alert("Lütfen önce bir döküman açınız.");
    }
} catch(e) { 
    alert("Hata: " + e); 
}