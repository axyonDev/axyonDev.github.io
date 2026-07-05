/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         ADOBE ILLUSTRATOR EXTENDSCRIPT — BAŞLANGIÇ ŞABLONU  ║
 * ║         Tüm bilinen sorunlar ve çözümleri içerir            ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * KULLANIM:
 *   1. SCRIPT_ENGINE_ID → her script için benzersiz bir isim ver
 *   2. PALETTE_TITLE    → palette başlığını değiştir
 *   3. UI bloğuna kendi arayüz elemanlarını ekle
 *   4. BridgeTalk body string'ine iş mantığını yaz
 *   5. getTrueVisualBounds() her zaman hazır — silme
 *
 * ─────────────────────────────────────────────────────────────
 * KURAL 1: #target + #targetengine İKİSİ BİRLİKTE ZORUNLU
 *   • #targetengine olmadan palette anında kapanır
 *   • Engine ID unique olmalı (başka scriptlerle çakışmasın)
 * ─────────────────────────────────────────────────────────────
 */

#target illustrator
#targetengine "SCRIPT_ENGINE_ID"   // ← benzersiz bir isimle değiştir

(function () {

    /* ════════════════════════════════════════════════════════
       SABITLER
    ════════════════════════════════════════════════════════ */
    var MM_TO_PT = 2.834645669291339;   // mm → point dönüşümü
    var PALETTE_TITLE = "Script Adı";   // ← değiştir

    /* ════════════════════════════════════════════════════════
       UI — PALETTE (MODELESS)
       Palette açıkken kullanıcı tuvalde serbestçe çalışabilir
    ════════════════════════════════════════════════════════ */
    var win = new Window("palette", PALETTE_TITLE, undefined, { closeButton: true });
    win.orientation   = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing       = 8;
    win.margins       = [14, 14, 14, 14];

    /* ── Yardımcı: label + edittext satırı ── */
    function addInputRow(parent, label, defaultVal) {
        var g = parent.add("group");
        g.alignment     = ["fill", "center"];
        g.alignChildren = ["left", "center"];
        var st = g.add("statictext", undefined, label);
        st.preferredSize.width = 100;
        var et = g.add("edittext", undefined, String(defaultVal));
        et.preferredSize = [68, 22];
        return et;
    }

    /* ── Örnek panel — ihtiyaca göre düzenle ── */
    var pInputs = win.add("panel", undefined, "Parametreler");
    pInputs.orientation   = "column";
    pInputs.alignChildren = ["fill", "center"];
    pInputs.margins       = [12, 18, 12, 10];
    pInputs.spacing       = 6;

    var inParam1 = addInputRow(pInputs, "Parametre 1 :", 0);
    var inParam2 = addInputRow(pInputs, "Parametre 2 :", 0);

    /* ── Seçenek checkbox örneği ── */
    var pOpts = win.add("panel", undefined, "Seçenekler");
    pOpts.orientation   = "column";
    pOpts.alignChildren = ["left", "center"];
    pOpts.margins       = [12, 18, 12, 10];

    var chkOpt = pOpts.add("checkbox", undefined, "Bir seçenek");
    chkOpt.value = true;

    /* ── Durum çubuğu ── */
    var pStatus = win.add("panel");
    pStatus.margins = [8, 8, 8, 6];
    var txStatus = pStatus.add("statictext", undefined,
        "Obje seçip Uygula'ya basın", { multiline: false });
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

    /* ════════════════════════════════════════════════════════
       UYGULA BUTONU
    ════════════════════════════════════════════════════════ */
    btnApply.onClick = function () {

        /* Girdi okuma — ihtiyaca göre genişlet */
        var param1 = parseFloat(inParam1.text) * MM_TO_PT; // mm → pt
        var param2 = parseInt(inParam2.text, 10);
        var optVal = chkOpt.value;

        /* Basit doğrulama */
        if (isNaN(param1)) { txStatus.text = "Geçersiz parametre 1!"; return; }
        if (isNaN(param2)) { txStatus.text = "Geçersiz parametre 2!"; return; }

        txStatus.text = "İşleniyor...";
        win.update();

        /* ── BridgeTalk ──────────────────────────────────────
         *
         * KURAL 2: Palette context'inde app.activeDocument
         *          hata fırlatır. Tüm Illustrator işlemleri
         *          BridgeTalk body'sinde yapılmalı.
         *          Orada app.activeDocument güvenle çalışır.
         *
         * KURAL 3: Palette değişkenlerini body string'e
         *          doğrudan enjekte et (string concat ile).
         * ──────────────────────────────────────────────────── */
        var bt = new BridgeTalk();
        bt.target = "illustrator";

        bt.body = "(function() {" +

            /* ── Kontroller ── */
            "  if (app.documents.length === 0) return 'ERR:Açık belge yok!';" +
            "  var doc = app.activeDocument;" +   // BridgeTalk'ta activeDocument çalışır
            "  var sel = doc.selection;" +
            "  if (!sel || sel.length === 0) return 'ERR:Lütfen önce bir obje seçin!';" +

            /* ── Palette'ten gelen parametreler ── */
            "  var PARAM1 = " + param1 + ";" +    // number olarak gelir
            "  var PARAM2 = " + param2 + ";" +
            "  var OPT    = " + optVal + ";" +    // boolean: true/false

            /* ── getTrueVisualBounds ─────────────────────────
             *
             * KURAL 4: Clip mask olan objelerde geometricBounds
             *          clip dışına taşan objeleri de kapsar — YANLIŞ
             *
             * KURAL 5: Clip mask path'ini bulmak için:
             *          item.clipping === true  (DOĞRU property adı)
             *          item.clippingPath       (YOK — kullanma)
             *
             * KURAL 6: Koordinat sistemi — Y ekseni TERS
             *          bounds = [left, top, right, bottom]
             *          top > bottom  (üst = büyük Y değeri)
             *          Aşağı gitmek = Y'den çıkarmak
             * ──────────────────────────────────────────────── */
            "  function getTrueVisualBounds(item) {" +
            "    if (item.typename === 'GroupItem') {" +
            "      if (item.clipped) {" +
            "        for (var j = 0; j < item.pageItems.length; j++) {" +
            "          if (item.pageItems[j].clipping) {" +          // ← .clipping (doğru)
            "            return item.pageItems[j].geometricBounds;" + // clip path bounds = gerçek boyut
            "          }" +
            "        }" +
            "        return item.visibleBounds;" +                    // fallback
            "      } else {" +
            "        var combined = null;" +
            "        for (var k = 0; k < item.pageItems.length; k++) {" +
            "          var cb = getTrueVisualBounds(item.pageItems[k]);" +
            "          if (cb) {" +
            "            if (!combined) { combined = [cb[0],cb[1],cb[2],cb[3]]; }" +
            "            else {" +
            "              combined[0] = Math.min(combined[0], cb[0]);" + // Sol  (min X)
            "              combined[1] = Math.max(combined[1], cb[1]);" + // Üst  (max Y)
            "              combined[2] = Math.max(combined[2], cb[2]);" + // Sağ  (max X)
            "              combined[3] = Math.min(combined[3], cb[3]);" + // Alt  (min Y)
            "            }" +
            "          }" +
            "        }" +
            "        return combined || item.visibleBounds;" +
            "      }" +
            "    }" +
            "    return item.visibleBounds;" +   // path, image, text vs.
            "  }" +

            /* ── Seçimi snapshotle ───────────────────────────
             * Duplicate/group işlemleri sırasında doc.selection
             * değişir. Başta kopyala, sonra işle.
             * ──────────────────────────────────────────────── */
            "  var snap = [];" +
            "  for (var i = 0; i < sel.length; i++) snap.push(sel[i]);" +

            /* ════════════════════════════════════════════════
               İŞ MANTIĞI — buraya yaz
            ════════════════════════════════════════════════ */
            "  var count = 0;" +
            "  for (var s = 0; s < snap.length; s++) {" +
            "    var item  = snap[s];" +
            "    var b     = getTrueVisualBounds(item);" +
            "    var left  = b[0];" +
            "    var top   = b[1];" +   // büyük Y = yukarı
            "    var right = b[2];" +
            "    var bot   = b[3];" +   // küçük Y = aşağı
            "    var w     = Math.abs(right - left);" +
            "    var h     = Math.abs(top   - bot);" +
            "    // ... buraya devam et ..." +
            "    count++;" +
            "  }" +
            /* ════════════════════════════════════════════════ */

            /* ── Gruplama gerekiyorsa ────────────────────────
             * KURAL 7: Gruplama için önce selection'ı set et,
             *          sonra executeMenuCommand('group') çağır.
             *          Sonrasında doc.selection = yeni grup olur.
             * ──────────────────────────────────────────────── */
            // "  doc.selection = itemsArray;" +
            // "  app.executeMenuCommand('group');" +

            "  return count + ' obje işlendi.';" +
            "})();";

        bt.onResult = function (res) {
            var msg = res.body;
            txStatus.text = (msg && msg.indexOf("ERR:") === 0)
                ? msg.substring(4)
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

/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  HIZLI BAŞVURU — Bu dosyayı silme, şablon olarak sakla     ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║                                                              ║
 * ║  SORUN                   YANLIŞ           DOĞRU             ║
 * ║  ─────────────────────── ───────────────  ──────────────     ║
 * ║  Palette kapanıyor       #targetengine yok  İkisi birlikte  ║
 * ║  "Belge bulunamadı"      app.activeDocument  doc[0] + BT    ║
 * ║  Clip mask tespiti       .clippingPath     .clipping        ║
 * ║  Görünür alan            geometricBounds   getTrueVisual…   ║
 * ║  Y ekseni yönü           +dy aşağı         -dy aşağı        ║
 * ║  Gruplama                direkt group()    sel + menuCmd    ║
 * ║  Seçim kaybı             direkt loop       snap[] + loop    ║
 * ║                                                              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
