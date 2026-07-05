/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         TOPLU MASKELEME — Palette Versiyonu v3              ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * DÜZELTME v3:
 *   _used flag'i Illustrator DOM objesine yazılıyordu.
 *   Undo sonrası obje geri gelir ama flag kalırdı → sonsuz hata.
 *   Şimdi ayrı bir usedTargets[] boolean dizisiyle takip ediliyor.
 */

#target illustrator
#targetengine "maskele_engine_v3"

(function () {

    var PALETTE_TITLE = "Toplu Maskeleme";

    var win = new Window("palette", PALETTE_TITLE, undefined, { closeButton: true });
    win.orientation   = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing       = 8;
    win.margins       = [14, 14, 14, 14];

    /* ── Bilgi paneli ── */
    var pInfo = win.add("panel", undefined, "Kullanım");
    pInfo.orientation   = "column";
    pInfo.alignChildren = ["fill", "center"];
    pInfo.margins       = [12, 18, 12, 10];
    pInfo.spacing       = 4;
    pInfo.add("statictext", undefined, "1. Kare(ler) + Resim(ler) seç");
    pInfo.add("statictext", undefined, "2. Maskeli gruplar da hedef olabilir");
    pInfo.add("statictext", undefined, "3. Uygula'ya bas");

    /* ── Durum çubuğu ── */
    var pStatus = win.add("panel");
    pStatus.margins = [8, 8, 8, 6];
    var txStatus = pStatus.add("statictext", undefined,
        "Seçim yapıp Uygula'ya basın", { multiline: true });
    txStatus.preferredSize = [224, 36];
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

    /* ════════════════════════════════════════════════════════
       UYGULA
    ════════════════════════════════════════════════════════ */
    btnApply.onClick = function () {
        txStatus.text = "İşleniyor...";
        win.update();

        var bt = new BridgeTalk();
        bt.target = "illustrator";

        bt.body = "(function() {" +

            "  if (app.documents.length === 0) return 'ERR:Açık belge yok!';" +
            "  var doc = app.activeDocument;" +
            "  var sel = doc.selection;" +
            "  if (!sel || sel.length < 2) return 'ERR:En az bir kare ve bir hedef seçili olmalı.';" +

            "  var paths   = [];" +
            "  var targets = [];" +

            "  for (var i = 0; i < sel.length; i++) {" +
            "    var tn = sel[i].typename;" +
            "    if (tn === 'PathItem' || tn === 'CompoundPathItem') {" +
            "      paths.push(sel[i]);" +
            "    } else if (tn === 'RasterItem' || tn === 'PlacedItem' || tn === 'GroupItem') {" +
            "      targets.push(sel[i]);" +
            "    }" +
            "  }" +

            "  if (paths.length === 0)   return 'ERR:Seçimde maskeleyen kare (vektör) bulunamadı!';" +
            "  if (targets.length === 0) return 'ERR:Seçimde hedef resim veya grup bulunamadı!';" +

            /* ── DÜZELTME: Illustrator objesine flag yazmak yerine
             *   ayrı bir boolean dizi tut. Undo/tekrar çalıştırmadan
             *   etkilenmez çünkü her BridgeTalk çağrısında sıfırdan oluşur.
             * ──────────────────────────────────────────────── */
            "  var usedTargets = [];" +
            "  for (var u = 0; u < targets.length; u++) usedTargets.push(false);" +

            "  var maskedCount  = 0;" +
            "  var skippedCount = 0;" +

            "  for (var p = 0; p < paths.length; p++) {" +
            "    var currentPath = paths[p];" +
            "    var pBounds  = currentPath.geometricBounds;" +
            "    var pCenterX = (pBounds[0] + pBounds[2]) / 2;" +
            "    var pCenterY = (pBounds[1] + pBounds[3]) / 2;" +

            "    for (var r = 0; r < targets.length; r++) {" +

            "      if (usedTargets[r]) continue;" +

            "      var currentTarget = targets[r];" +
            "      var rBounds = currentTarget.geometricBounds;" +

            "      var insideX = pCenterX >= rBounds[0] && pCenterX <= rBounds[2];" +
            "      var insideY = pCenterY <= rBounds[1] && pCenterY >= rBounds[3];" +

            "      if (insideX && insideY) {" +
            "        try {" +
            "          currentPath.move(currentTarget, ElementPlacement.PLACEBEFORE);" +
            "          var maskGroup = doc.groupItems.add();" +
            "          maskGroup.move(currentTarget, ElementPlacement.PLACEBEFORE);" +
            "          currentPath.move(maskGroup, ElementPlacement.PLACEATEND);" +
            "          currentTarget.move(maskGroup, ElementPlacement.PLACEATEND);" +
            "          maskGroup.clipped = true;" +

            "          usedTargets[r] = true;" +
            "          maskedCount++;" +
            "          break;" +

            "        } catch (e) {" +
            "          skippedCount++;" +
            "        }" +
            "      }" +
            "    }" +
            "  }" +

            "  if (maskedCount === 0) {" +
            "    return 'ERR:Eşleşme bulunamadı. Karenin merkezi hedef üzerinde olmalı.';" +
            "  }" +

            "  var msg = maskedCount + ' obje maskelendi.';" +
            "  if (skippedCount > 0) msg += ' (' + skippedCount + ' hata atlandı)';" +
            "  return msg;" +

            "})();";

        bt.onResult = function (res) {
            var msg = res.body || "";
            txStatus.text = (msg.indexOf("ERR:") === 0)
                ? "⚠ " + msg.substring(4)
                : "✔ " + msg;
        };
        bt.onError = function (err) {
            txStatus.text = "BridgeTalk hatası: " + err.body;
        };
        bt.send();
    };

    /* ── Geri Al ── */
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
