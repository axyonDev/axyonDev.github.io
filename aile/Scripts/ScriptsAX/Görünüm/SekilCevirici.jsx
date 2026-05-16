#target illustrator

function main() {
    if (app.documents.length === 0) {
        alert("Açık döküman yok!");
        return;
    }

    var doc = app.activeDocument;
    var sel = doc.selection;

    if (sel.length === 0) {
        alert("Dostum hiçbir şey seçili değil.");
        return;
    }

    // Arayüz
    var win = new Window("dialog", "Şekil ve Maske Dönüştürücü");
    win.orientation = "column";
    win.spacing = 10;
    win.margins = 20;

    win.add("statictext", undefined, "Seçili maskeyi/objeyi neye çevirelim?");

    var btnGroup = win.add("group");
    btnGroup.orientation = "column";

    // Kare Yap
    var btnToRect = btnGroup.add("button", undefined, "Kare / Dikdörtgen Yap");
    btnToRect.size = [200, 30];
    btnToRect.onClick = function() {
        processSelection("rect");
        win.close();
    };

    // Daire Yap
    var btnToEllipse = btnGroup.add("button", undefined, "Daire / Elips Yap");
    btnToEllipse.size = [200, 30];
    btnToEllipse.onClick = function() {
        processSelection("ellipse");
        win.close();
    };

    var btnClose = win.add("button", undefined, "İptal");
    btnClose.onClick = function() {
        win.close();
    };

    win.center();
    win.show();
}

function processSelection(targetShape) {
    var doc = app.activeDocument;
    var sel = doc.selection;

    for (var i = sel.length - 1; i >= 0; i--) {
        try {
            convertItem(doc, sel[i], targetShape);
        } catch(e) {
            alert("Hata: " + e.message);
        }
    }
}

function convertItem(doc, item, shapeType) {
    var bounds;
    var isClippingGroup = (item.typename === "GroupItem" && item.clipped);
    var oldMaskItem = null;

    // 1. ADIM: Gerçek ebatları nereden alacağız?
    if (isClippingGroup) {
        // Eğer bu bir maskeli grupsa, grubun ebadını değil, 
        // içindeki MASKENİN (Clipping Path) ebadını bulmalıyız.
        for (var i = 0; i < item.pathItems.length; i++) {
            if (item.pathItems[i].clipping) {
                oldMaskItem = item.pathItems[i];
                bounds = oldMaskItem.geometricBounds; // Sadece maske çerçevesinin sınırları
                break;
            }
        }
        // Eğer garip bir şekilde maske path'i bulunamazsa grubun kendisini al (fallback)
        if (!bounds) bounds = item.geometricBounds;
    } else {
        // Normal, maskesiz bir objeyse direkt kendisini al
        bounds = item.geometricBounds;
    }

    var top = bounds[1];
    var left = bounds[0];
    var width = bounds[2] - left;
    var height = top - bounds[3];

    // 2. ADIM: Yeni şekli oluştur
    var newItem;
    if (shapeType === "rect") {
        newItem = doc.pathItems.rectangle(top, left, width, Math.abs(height));
    } else {
        newItem = doc.pathItems.ellipse(top, left, width, Math.abs(height));
    }

    // 3. ADIM: Yerleştirme ve Değişim
    if (isClippingGroup && oldMaskItem) {
        // --- MASKE DEĞİŞİM SENARYOSU ---
        
        // Yeni şekli grubun içine, en başa (en üste) taşı
        newItem.move(item, ElementPlacement.PLACEATBEGINNING);
        
        // Yeni şekli "Clipping Path" (Maske) olarak işaretle
        newItem.clipping = true;
        
        // Eski maskeyi sil (Böylece içerik serbest kalmaz, yeni maskeye geçer)
        oldMaskItem.remove();
        
        // Gruplarda seçimi korumak için grubu tekrar seçili yapabiliriz ama gerek yok
    } else {
        // --- NORMAL OBJE SENARYOSU ---
        
        // Renk ve stilleri kopyala (Maskelerde buna gerek yok çünkü maske şeffaftır)
        if (item.filled) { newItem.filled = true; newItem.fillColor = item.fillColor; }
        if (item.stroked) { newItem.stroked = true; newItem.strokeColor = item.strokeColor; newItem.strokeWidth = item.strokeWidth; }
        newItem.opacity = item.opacity;

        // Eskinin yerine koy ve eskiyi sil
        newItem.move(item, ElementPlacement.PLACEBEFORE);
        item.remove();
    }
    
    newItem.selected = true;
}

main();