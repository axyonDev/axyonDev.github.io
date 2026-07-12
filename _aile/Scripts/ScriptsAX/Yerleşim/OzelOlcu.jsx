#target illustrator
try {
    if(app.documents.length == 0) throw 'Dosya yok!';
    var doc = app.documents[0];
    var sel = doc.selection;
    if(sel.length == 0) throw 'Objeleri seç.';

    var win = new Window('dialog', 'Özel Ölçü (mm - Maske Duyarlı)');
    win.orientation='column'; win.alignChildren='fill';

    var pnl = win.add('panel', undefined, 'Hedef GEOMETRİK Ölçüler');
    pnl.alignChildren='left';

    var grpW = pnl.add('group');
    grpW.add('statictext', undefined, 'Genişlik (W):');
    var inpW = grpW.add('edittext', undefined, '');
    inpW.characters=6;

    var grpH = pnl.add('group');
    grpH.add('statictext', undefined, 'Yükseklik (H):');
    var inpH = grpH.add('edittext', undefined, '');
    inpH.characters=6;

    var chkProp = win.add('checkbox', undefined, 'Orantıyı Koru');
    chkProp.value = false;

    var grpBtn = win.add('group');
    grpBtn.alignment='center';
    grpBtn.add('button', undefined, 'Uygula', {name:'ok'});
    grpBtn.add('button', undefined, 'İptal', {name:'cancel'});

    if(win.show() == 1) {
        var mm2pt = 2.834645;
        var valW = parseFloat(inpW.text);
        var valH = parseFloat(inpH.text);
        var doProp = chkProp.value;

        var getB = function(obj) {
            if(obj.typename == 'GroupItem' && obj.clipped) {
                for(var j=0; j < obj.pageItems.length; j++) {
                    if(obj.pageItems[j].clipping) return obj.pageItems[j].geometricBounds;
                }
            }
            return obj.geometricBounds;
        };

        for(var i=0; i < sel.length; i++){
            var item = sel[i];
            var b = getB(item);
            var oldW = Math.abs(b[2]-b[0]);
            var oldH = Math.abs(b[1]-b[3]);
            var scaleX = 100;
            var scaleY = 100;

            if(!isNaN(valW) && isNaN(valH)) {
                var targetW = valW * mm2pt;
                scaleX = (targetW / oldW) * 100;
                if(doProp) scaleY = scaleX;
            } else if(isNaN(valW) && !isNaN(valH)) {
                var targetH = valH * mm2pt;
                scaleY = (targetH / oldH) * 100;
                if(doProp) scaleX = scaleY;
            } else if(!isNaN(valW) && !isNaN(valH)) {
                var targetW = valW * mm2pt;
                var targetH = valH * mm2pt;
                scaleX = (targetW / oldW) * 100;
                if(doProp) { scaleY = scaleX; } else { scaleY = (targetH / oldH) * 100; }
            }
            item.resize(scaleX, scaleY, true, true, true, true, 100, Transformation.CENTER);
        }
        app.redraw();
    }
} catch(e) {
    if(e.toString().indexOf('cancel') == -1) alert('Hata: ' + e);
}