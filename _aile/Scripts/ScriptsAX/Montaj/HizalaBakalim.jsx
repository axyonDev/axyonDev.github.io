/**
 * HizalaBakalim.jsx — v2.0
 * Objeleri görünür sınırlarına göre yan yana dizer.
 * Şablon kuralları uygulandı:
 *   - #target + #targetengine (palette hayatta kalır)
 *   - BridgeTalk (palette'te activeDocument güvenli)
 *   - getTrueVisualBounds / .clipping (clip mask doğru okunur)
 *   - snap[] (işlem sırasında seçim kaybolmaz)
 */

#target illustrator
#targetengine "HizalaBakalim"

(function () {

    var MM = 2.834645669291339;

    var win = new Window("palette", "Hizala Bakalım v2.0", undefined, { closeButton: true });
    win.orientation   = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing       = 8;
    win.margins       = [14, 14, 14, 14];

    /* ── Yön paneli ── */
    var pDir = win.add("panel", undefined, "Hizalama Yönü");
    pDir.orientation   = "row";
    pDir.alignChildren = ["left", "center"];
    pDir.margins       = [12, 18, 12, 10];
    pDir.spacing       = 10;

    var radH = pDir.add("radiobutton", undefined, "Yatay (→)");
    var radV = pDir.add("radiobutton", undefined, "Dikey (↓)");
    radH.value = true;

    /* ── Boşluk ── */
    var pGap = win.add("panel", undefined, "Aralarındaki Boşluk (mm)");
    pGap.orientation   = "row";
    pGap.alignChildren = ["left", "center"];
    pGap.margins       = [12, 18, 12, 10];

    pGap.add("statictext", undefined, "Boşluk :");
    var inGap = pGap.add("edittext", undefined, "0");
    inGap.preferredSize = [68, 22];

    /* ── Durum ── */
    var pStatus = win.add("panel");
    pStatus.margins = [8, 8, 8, 6];
    var txStatus = pStatus.add("statictext", undefined,
        "En az 2 obje seçip Uygula'ya basın", { multiline: false });
    txStatus.preferredSize.width = 224;
    txStatus.justify = "center";

    /* ── Butonlar ── */
    var grpBtn = win.add("group");
    grpBtn.alignment = "center";
    grpBtn.spacing   = 6;

    var btnApply = grpBtn.add("button", undefined, "Uygula");
    btnApply.preferredSize = [100, 30];
    var btnUndo  = grpBtn.add("button", undefined, "Geri Al");
    btnUndo.preferredSize  = [90, 30];
    var btnClose = grpBtn.add("button", undefined, "Kapat");
    btnClose.preferredSize = [70, 30];

    /* ════════════════════════════════════════════════════════ */

    btnApply.onClick = function () {

        var gap      = parseFloat(inGap.text) * MM;
        var isHoriz  = radH.value;

        if (isNaN(gap)) { txStatus.text = "Geçersiz boşluk değeri!"; return; }

        txStatus.text = "İşleniyor...";
        win.update();

        var bt = new BridgeTalk();
        bt.target = "illustrator";

        bt.body = "(function() {" +
            "  if (app.documents.length === 0) return 'ERR:Açık belge yok!';" +
            "  var doc = app.activeDocument;" +
            "  var sel = doc.selection;" +
            "  if (!sel || sel.length < 2) return 'ERR:En az 2 obje seçin!';" +

            "  var GAP     = " + gap     + ";" +   // pt cinsinden
            "  var IS_HORIZ = " + isHoriz + ";" +

            /* ── getTrueVisualBounds ── */
            "  function getTrueVisualBounds(item) {" +
            "    if (item.typename === 'GroupItem') {" +
            "      if (item.clipped) {" +
            "        for (var j = 0; j < item.pageItems.length; j++) {" +
            "          if (item.pageItems[j].clipping) {" +
            "            return item.pageItems[j].geometricBounds;" +
            "          }" +
            "        }" +
            "        return item.visibleBounds;" +
            "      } else {" +
            "        var combined = null;" +
            "        for (var k = 0; k < item.pageItems.length; k++) {" +
            "          var cb = getTrueVisualBounds(item.pageItems[k]);" +
            "          if (cb) {" +
            "            if (!combined) { combined = [cb[0],cb[1],cb[2],cb[3]]; }" +
            "            else {" +
            "              combined[0] = Math.min(combined[0], cb[0]);" +
            "              combined[1] = Math.max(combined[1], cb[1]);" +
            "              combined[2] = Math.max(combined[2], cb[2]);" +
            "              combined[3] = Math.min(combined[3], cb[3]);" +
            "            }" +
            "          }" +
            "        }" +
            "        return combined || item.visibleBounds;" +
            "      }" +
            "    }" +
            "    return item.visibleBounds;" +
            "  }" +

            /* ── Seçimi snapshotle ── */
            "  var snap = [];" +
            "  for (var i = 0; i < sel.length; i++) snap.push(sel[i]);" +

            /* ── Sırala ── */
            "  snap.sort(function(a, b) {" +
            "    var ba = getTrueVisualBounds(a);" +
            "    var bb = getTrueVisualBounds(b);" +
            "    return IS_HORIZ" +
            "      ? ba[0] - bb[0]" +    // yatay: sola göre (left = b[0])
            "      : bb[1] - ba[1];" +   // dikey: üste göre (top = b[1], büyük Y = yukarı)
            "  });" +

            /* ── Hizala ── */
            "  for (var i = 1; i < snap.length; i++) {" +
            "    var prev = getTrueVisualBounds(snap[i-1]);" +
            "    var curr = getTrueVisualBounds(snap[i]);" +
            "    var dx = 0, dy = 0;" +
            "    if (IS_HORIZ) {" +
            "      var prevRight  = prev[2];" +   // öncekinin sağ kenarı
            "      var currLeft   = curr[0];" +   // şimdikinin sol kenarı
            "      dx = (prevRight + GAP) - currLeft;" +
            "    } else {" +
            "      var prevBottom = prev[3];" +   // öncekinin alt kenarı (küçük Y)
            "      var currTop    = curr[1];" +   // şimdikinin üst kenarı (büyük Y)
            "      dy = (prevBottom - GAP) - currTop;" +   // Y ters → çıkar
            "    }" +
            "    snap[i].translate(dx, dy);" +
            "  }" +

            "  return snap.length + ' obje hizalandı.';" +
            "})();";

        bt.onResult = function (res) {
            var msg = res.body;
            txStatus.text = (msg && msg.indexOf("ERR:") === 0) ? msg.substring(4) : "✔ " + msg;
        };
        bt.onError = function (err) {
            txStatus.text = "Hata: " + err.body;
        };
        bt.send();
    };

    btnUndo.onClick = function () {
        var bt = new BridgeTalk();
        bt.target = "illustrator";
        bt.body   = "app.undo(); 'Geri alındı.';";
        bt.onResult = function (res) { txStatus.text = res.body; };
        bt.send();
    };

    btnClose.onClick = function () { win.close(); };

    win.center();
    win.show();

})();
