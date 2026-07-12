/**
 * MONTAJ ARACI v1.6
 * getTrueVisualBounds: SecimiSayfalandir.jsx'ten alınan
 * çalışan clip detection mantığı (.clipping property)
 */

#target illustrator
#targetengine "MontajAraci"

(function () {

    var MM = 2.834645669291339;

    var win = new Window("palette", "Montaj Araci v1.6", undefined, { closeButton: true });
    win.orientation   = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing       = 8;
    win.margins       = [14, 14, 14, 14];

    var pGrid = win.add("panel", undefined, "Grid Boyutu");
    pGrid.orientation   = "column";
    pGrid.alignChildren = ["fill", "center"];
    pGrid.margins       = [12, 18, 12, 10];
    pGrid.spacing       = 6;

    function addRow(parent, label, defVal) {
        var g  = parent.add("group");
        g.alignment     = ["fill", "center"];
        g.alignChildren = ["left", "center"];
        var st = g.add("statictext", undefined, label);
        st.preferredSize.width = 100;
        var et = g.add("edittext", undefined, String(defVal));
        et.preferredSize = [68, 22];
        return et;
    }

    var inRows = addRow(pGrid, "Satir sayisi :",  2);
    var inCols = addRow(pGrid, "Sutun sayisi :", 3);

    var pGap = win.add("panel", undefined, "Aralar (mm)");
    pGap.orientation   = "column";
    pGap.alignChildren = ["fill", "center"];
    pGap.margins       = [12, 18, 12, 10];
    pGap.spacing       = 6;

    var inHGap = addRow(pGap, "Yatay ara :", 0);
    var inVGap = addRow(pGap, "Dikey ara :",  0);

    var pOpt = win.add("panel", undefined, "Secenekler");
    pOpt.orientation   = "column";
    pOpt.alignChildren = ["left", "center"];
    pOpt.margins       = [12, 18, 12, 10];
    pOpt.spacing       = 5;

    var chkGroup = pOpt.add("checkbox", undefined, "Kopyalari grupla");
    chkGroup.value = true;

    var pStatus = win.add("panel");
    pStatus.margins = [8, 8, 8, 6];
    var txStatus = pStatus.add("statictext", undefined,
        "Obje secip Uygula'ya basin", { multiline: false });
    txStatus.preferredSize.width = 224;
    txStatus.justify = "center";

    var grpBtn  = win.add("group");
    grpBtn.alignment = "center";
    grpBtn.spacing   = 6;

    var btnApply = grpBtn.add("button", undefined, "Uygula");
    btnApply.preferredSize = [108, 30];
    var btnUndo  = grpBtn.add("button", undefined, "Geri Al");
    btnUndo.preferredSize  = [90, 30];
    var btnClose = grpBtn.add("button", undefined, "Kapat");
    btnClose.preferredSize = [70, 30];

    btnApply.onClick = function () {
        var rows = parseInt(inRows.text, 10);
        var cols = parseInt(inCols.text, 10);
        var hGap = parseFloat(inHGap.text) * MM;
        var vGap = parseFloat(inVGap.text) * MM;

        if (isNaN(rows) || rows < 1) { txStatus.text = "Gecersiz satir!";  return; }
        if (isNaN(cols) || cols < 1) { txStatus.text = "Gecersiz sutun!"; return; }
        if (isNaN(hGap)) hGap = 0;
        if (isNaN(vGap)) vGap = 0;

        var doGroup = chkGroup.value;

        txStatus.text = "Isleniyor...";
        win.update();

        var bt = new BridgeTalk();
        bt.target = "illustrator";

        bt.body = "(function() {" +
            "if (app.documents.length === 0) return 'ERR:Acik belge yok!';" +
            "var doc = app.activeDocument;" +
            "var sel = doc.selection;" +
            "if (!sel || sel.length === 0) return 'ERR:Lutfen once bir obje secin!';" +

            "var ROWS=" + rows + ";" +
            "var COLS=" + cols + ";" +
            "var HG="   + hGap + ";" +
            "var VG="   + vGap + ";" +
            "var DG="   + doGroup + ";" +

            /* ── getTrueVisualBounds ──────────────────────────────
             * SecimiSayfalandir.jsx'ten alınan çalışan mantık.
             * Anahtar: subItem.clipping (clippingPath değil!)
             * 
             * Grup + maskeli → mask path'in geometricBounds
             * Grup + maskesiz → child'ları recursive tara, birleştir  
             * Diğer (resim, path, text) → visibleBounds
             * ────────────────────────────────────────────────────── */
            "function getTrueVisualBounds(item) {" +
            "  if (item.typename === 'GroupItem') {" +
            "    if (item.clipped) {" +
            "      for (var j = 0; j < item.pageItems.length; j++) {" +
            "        if (item.pageItems[j].clipping) {" +       // ← .clipping (doğru property)
            "          return item.pageItems[j].geometricBounds;" +
            "        }" +
            "      }" +
            "      return item.visibleBounds;" +                // fallback
            "    } else {" +
            "      var combined = null;" +
            "      for (var k = 0; k < item.pageItems.length; k++) {" +
            "        var cb = getTrueVisualBounds(item.pageItems[k]);" +
            "        if (cb) {" +
            "          if (!combined) { combined = [cb[0],cb[1],cb[2],cb[3]]; }" +
            "          else {" +
            "            combined[0] = Math.min(combined[0], cb[0]);" +
            "            combined[1] = Math.max(combined[1], cb[1]);" +
            "            combined[2] = Math.max(combined[2], cb[2]);" +
            "            combined[3] = Math.min(combined[3], cb[3]);" +
            "          }" +
            "        }" +
            "      }" +
            "      return combined || item.visibleBounds;" +
            "    }" +
            "  } else {" +
            "    return item.visibleBounds;" +
            "  }" +
            "}" +

            "function bToObj(b) {" +
            "  return {left:b[0], top:b[1], w:Math.abs(b[2]-b[0]), h:Math.abs(b[1]-b[3])};" +
            "}" +

            "function grid(orig) {" +
            "  var b  = bToObj(getTrueVisualBounds(orig));" +
            "  var sx = b.w + HG;" +
            "  var sy = b.h + VG;" +
            "  var all = [orig];" +
            "  for (var r = 0; r < ROWS; r++) {" +
            "    for (var c = 0; c < COLS; c++) {" +
            "      if (r===0 && c===0) continue;" +
            "      var cp = orig.duplicate(orig, ElementPlacement.PLACEBEFORE);" +
            "      var cb = bToObj(getTrueVisualBounds(cp));" +
            "      cp.translate((b.left + c*sx) - cb.left, (b.top - r*sy) - cb.top);" +
            "      all.push(cp);" +
            "    }" +
            "  }" +
            "  if (DG && all.length > 1) {" +
            "    doc.selection = all;" +
            "    app.executeMenuCommand('group');" +
            "  }" +
            "}" +

            "var snap=[];" +
            "for (var i=0; i<sel.length; i++) snap.push(sel[i]);" +
            "for (var s=0; s<snap.length; s++) grid(snap[s]);" +
            "return snap.length+' obje, '+ROWS+'x'+COLS+' grid tamam!';" +
            "})();";

        bt.onResult = function (res) {
            var msg = res.body;
            txStatus.text = (msg && msg.indexOf("ERR:") === 0) ? msg.substring(4) : msg;
        };
        bt.onError = function (err) {
            txStatus.text = "Hata: " + err.body;
        };
        bt.send();
    };

    btnUndo.onClick = function () {
        var bt = new BridgeTalk();
        bt.target = "illustrator";
        bt.body   = "app.undo(); 'Geri alindi.';";
        bt.onResult = function (res) { txStatus.text = res.body; };
        bt.send();
    };

    btnClose.onClick = function () { win.close(); };

    win.center();
    win.show();

})();
