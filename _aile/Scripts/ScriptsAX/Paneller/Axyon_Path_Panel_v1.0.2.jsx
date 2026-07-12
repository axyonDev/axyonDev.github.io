/* ============================================================================
   AXYON PATH PANEL v1.0.2
   Adobe Illustrator için sabit, yüzer Object > Path komut paneli.

   İçerik:
   - Join
   - Average...
   - Outline Stroke
   - Offset Path...
   - Reverse Path Direction
   - Simplify...
   - Smooth... (Axyon eşdeğer yumuşatma)
   - Add Anchor Points
   - Remove Anchor Points
   - Divide Objects Below
   - Split Into Grid...
   - Clean Up...

   Not:
   - Panel ScriptUI palette olarak açık kalır.
   - Illustrator belge işlemleri BridgeTalk üzerinden çalıştırılır.
   - Pencere konumu kullanıcı verisi klasöründe saklanır.
   - Hızlı/üst üste tıklamalara karşı işlem kilidi ve BridgeTalk koruması vardır.
   ============================================================================ */

#target illustrator
#targetengine "AxyonPathPanelEngineV102"

(function () {
    var VERSION = "1.0.2";
    var STATE_FILE_NAME = "Axyon_Path_Panel_State.txt";
    var GLOBAL_KEY = "__AXYON_PATH_PANEL_V102__";

    // Aynı panel zaten açıksa ikinci kopya üretme.
    try {
        if ($.global[GLOBAL_KEY] && $.global[GLOBAL_KEY].visible) {
            try { $.global[GLOBAL_KEY].active = true; } catch (e0) {}
            try { $.global[GLOBAL_KEY].show(); } catch (e1) {}
            return;
        }
    } catch (e2) {}

    var state = loadState();

    // Komutlar art arda tıklanınca aynı anda birden fazla BridgeTalk isteği
    // gönderilmesini engelleyen işlem kilidi. Ayrıca BridgeTalk nesneleri
    // callback tamamlanana kadar bellekte tutulur; böylece yerel değişkenin
    // erken temizlenmesi nedeniyle panelin tepkisiz kalması önlenir.
    var isBusy = false;
    var currentTaskId = 0;
    var activeBridgeTalks = [];
    var actionButtons = [];
    var win = new Window("palette", "Axyon PATH  v" + VERSION, undefined, {
        closeButton: true,
        resizeable: true
    });

    $.global[GLOBAL_KEY] = win;

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 7;
    win.margins = [10, 10, 10, 10];
    win.minimumSize = [330, 370];

    var title = win.add("statictext", undefined, "OBJECT  >  PATH");
    title.alignment = ["center", "top"];

    var grid = win.add("group");
    grid.orientation = "row";
    grid.alignChildren = ["fill", "top"];
    grid.spacing = 7;

    var left = grid.add("group");
    left.orientation = "column";
    left.alignChildren = ["fill", "top"];
    left.spacing = 5;

    var right = grid.add("group");
    right.orientation = "column";
    right.alignChildren = ["fill", "top"];
    right.spacing = 5;

    var statusPanel = win.add("panel", undefined, "Durum");
    statusPanel.orientation = "column";
    statusPanel.alignChildren = ["fill", "center"];
    statusPanel.margins = [8, 14, 8, 7];

    var statusText = statusPanel.add("statictext", undefined,
        "Hazır. Illustrator'da nesneyi seçip komuta bas.",
        { multiline: true }
    );
    statusText.preferredSize = [300, 38];

    var btnResetBusy = statusPanel.add("button", undefined, "Takılan İşlemi Serbest Bırak");
    btnResetBusy.helpTip = "Yalnızca bir komut tamamlandığı hâlde panel kilitli kaldıysa kullan.";
    btnResetBusy.visible = false;

    var footer = win.add("group");
    footer.orientation = "row";
    footer.alignment = ["fill", "top"];
    footer.alignChildren = ["fill", "center"];
    footer.spacing = 6;

    var btnSelection = footer.add("button", undefined, "Seçimi Kontrol Et");
    var btnUndo = footer.add("button", undefined, "Geri Al");
    var btnClose = footer.add("button", undefined, "Kapat");

    // ------------------------------------------------------------------------
    // PATH BUTONLARI
    // ------------------------------------------------------------------------

    addCommandButton(left, "Join", "Seçili açık yolları uç noktalarından birleştirir.",
        ["join"], true);

    addCommandButton(left, "Average...", "Seçili anchor noktalarını yatay, dikey veya iki yönde ortalar.",
        ["average"], true);

    addCommandButton(left, "Outline Stroke", "Stroke görünümünü dolgu şekline çevirir.",
        ["OffsetPath v22"], true);

    addCommandButton(left, "Offset Path...", "Seçili yol için içe veya dışa ofset yol oluşturur.",
        ["OffsetPath v23"], true);

    addCustomButton(left, "Reverse Path Direction", "Seçili yolların başlangıç-bitiş yönünü ters çevirir.",
        sendReversePath);

    addCommandButton(left, "Simplify...", "Anchor sayısını azaltıp yolu sadeleştirme penceresini açar.",
        ["simplify menu item"], true);

    addCustomButton(right, "Smooth...", "Seçili yollar için Axyon yumuşatma ayarını açar.",
        sendSmoothPath);

    addCommandButton(right, "Add Anchor Points", "Her yol segmentinin ortasına anchor noktası ekler.",
        ["Add Anchor Points2"], true);

    addCommandButton(right, "Remove Anchor Points", "Seçili veya gereksiz anchor noktalarını kaldırır.",
        ["Remove Anchor Points menu"], true);

    addCommandButton(right, "Divide Objects Below", "Üstteki seçili nesneyi kullanarak altındaki nesneleri böler.",
        ["Knife Tool2"], true);

    addCommandButton(right, "Split Into Grid...", "Seçili nesneyi satır ve sütunlara bölme penceresini açar.",
        ["Rows and Columns....", "Rows and Columns…", "Rows and Columns..."], true);

    addCommandButton(right, "Clean Up...", "Boş metin yolları, tekil noktalar ve boyanmamış nesneleri temizler.",
        ["cleanup menu item"], false);

    registerActionButton(btnSelection);
    registerActionButton(btnUndo);

    btnResetBusy.onClick = function () {
        // Eski callback daha sonra gelirse mevcut durumu değiştirmesin.
        currentTaskId++;
        isBusy = false;
        activeBridgeTalks = [];
        setActionButtonsEnabled(true);
        btnResetBusy.visible = false;
        setStatus("İşlem kilidi sıfırlandı. Yeni komut verebilirsin.");
    };

    btnSelection.onClick = function () {
        savePosition();
        sendSelectionCheck();
    };

    btnUndo.onClick = function () {
        savePosition();
        sendNativeCommand("Geri Al", ["undo"], false);
    };

    btnClose.onClick = function () {
        try { win.close(); } catch (e) {}
    };

    win.onResizing = win.onResize = function () {
        try { this.layout.resize(); } catch (e) {}
    };

    win.onClose = function () {
        savePosition();
        try { $.global[GLOBAL_KEY] = null; } catch (e) {}
        return true;
    };

    if (state && state.x !== null && state.y !== null && isVisiblePosition(state.x, state.y)) {
        try { win.location = [state.x, state.y]; } catch (e3) { win.center(); }
    } else {
        win.center();
    }

    win.show();

    // ========================================================================
    // UI YARDIMCILARI
    // ========================================================================

    function addCommandButton(parent, label, helpTip, commands, needSelection) {
        var btn = parent.add("button", undefined, label);
        btn.preferredSize = [154, 28];
        btn.helpTip = helpTip;
        registerActionButton(btn);
        btn.onClick = function () {
            savePosition();
            sendNativeCommand(label, commands, needSelection);
        };
        return btn;
    }

    function addCustomButton(parent, label, helpTip, handler) {
        var btn = parent.add("button", undefined, label);
        btn.preferredSize = [154, 28];
        btn.helpTip = helpTip;
        registerActionButton(btn);
        btn.onClick = function () {
            savePosition();
            handler(label);
        };
        return btn;
    }

    function setStatus(message) {
        try {
            statusText.text = message;
            win.update();
        } catch (e) {}
    }

    function registerActionButton(button) {
        actionButtons.push(button);
    }

    function setActionButtonsEnabled(enabled) {
        for (var i = 0; i < actionButtons.length; i++) {
            try { actionButtons[i].enabled = enabled; } catch (e) {}
        }
        try { win.update(); } catch (eUpdate) {}
    }

    function beginOperation(label) {
        if (isBusy) {
            setStatus("Önce çalışan işlem bitsin: " + label + " gönderilmedi.");
            return 0;
        }

        isBusy = true;
        currentTaskId++;
        setActionButtonsEnabled(false);
        btnResetBusy.visible = false;

        // Normal işlemlerde kullanıcıya gereksiz kurtarma düğmesi gösterme.
        // İşlem 12 saniyeden uzun sürerse manuel kilit açma seçeneği belirir.
        try {
            var scheduledTaskId = currentTaskId;
            $.global.__AXYON_PATH_PANEL_SHOW_RESET_V102__ = function (taskId) {
                if (isBusy && taskId === currentTaskId) {
                    btnResetBusy.visible = true;
                    try { win.layout.layout(true); } catch (eInnerLayout) {}
                    try { win.update(); } catch (eInnerUpdate) {}
                }
            };
            app.scheduleTask(
                "$.global.__AXYON_PATH_PANEL_SHOW_RESET_V102__(" + scheduledTaskId + ");",
                12000,
                false
            );
        } catch (eSchedule) {}

        try { win.layout.layout(true); } catch (eLayout) {}
        return currentTaskId;
    }

    function finishOperation(taskId) {
        if (taskId !== currentTaskId) return;
        isBusy = false;
        setActionButtonsEnabled(true);
        btnResetBusy.visible = false;
        try { win.layout.layout(true); } catch (eLayout) {}
    }

    function keepBridgeTalk(bt) {
        activeBridgeTalks.push(bt);
    }

    function releaseBridgeTalk(bt) {
        for (var i = activeBridgeTalks.length - 1; i >= 0; i--) {
            if (activeBridgeTalks[i] === bt) {
                activeBridgeTalks.splice(i, 1);
                break;
            }
        }
    }

    // ========================================================================
    // BRIDGETALK GÖNDERİCİLERİ
    // ========================================================================

    function dispatchBridgeTalk(label, statusMessage, body, timeoutMessage) {
        if (typeof BridgeTalk === "undefined") {
            setStatus("Hata: BridgeTalk bulunamadı.");
            alert("BridgeTalk bulunamadı. Scripti Illustrator içinden çalıştır.");
            return;
        }

        var taskId = beginOperation(label);
        if (!taskId) return;

        setStatus(statusMessage);

        var bt = new BridgeTalk();
        bt.target = "illustrator";
        bt.timeout = 300;
        bt.body = body;
        keepBridgeTalk(bt);

        bt.onResult = function (res) {
            releaseBridgeTalk(bt);
            if (taskId !== currentTaskId) return;
            handleWorkerResult(res.body);
            finishOperation(taskId);
        };

        bt.onError = function (err) {
            releaseBridgeTalk(bt);
            if (taskId !== currentTaskId) return;
            setStatus("BridgeTalk hatası: " + safeText(err.body || err));
            finishOperation(taskId);
        };

        bt.onTimeout = function () {
            releaseBridgeTalk(bt);
            if (taskId !== currentTaskId) return;
            setStatus(timeoutMessage || (label + " zaman aşımına uğradı."));
            finishOperation(taskId);
        };

        try {
            var sent = bt.send();
            if (sent === false) {
                releaseBridgeTalk(bt);
                setStatus(label + " Illustrator'a gönderilemedi.");
                finishOperation(taskId);
            }
        } catch (eSend) {
            releaseBridgeTalk(bt);
            setStatus(label + " gönderme hatası: " + safeText(eSend));
            finishOperation(taskId);
        }
    }

    function sendNativeCommand(label, commands, needSelection) {
        dispatchBridgeTalk(
            label,
            label + " çalıştırılıyor...",
            "(" + nativeCommandWorker.toString() + ")(" +
                quote(label) + "," + arrayLiteral(commands) + "," +
                (needSelection ? "true" : "false") + ");",
            label + " zaman aşımına uğradı."
        );
    }

    function sendSelectionCheck() {
        dispatchBridgeTalk(
            "Seçim Kontrolü",
            "Seçim kontrol ediliyor...",
            "(" + selectionCheckWorker.toString() + ")();",
            "Seçim kontrolü zaman aşımına uğradı."
        );
    }

    function sendReversePath(label) {
        dispatchBridgeTalk(
            label,
            label + " çalıştırılıyor...",
            "(" + reversePathWorker.toString() + ")();",
            label + " zaman aşımına uğradı."
        );
    }

    function sendSmoothPath(label) {
        dispatchBridgeTalk(
            label,
            label + " ayarı açılıyor...",
            "(" + smoothPathWorker.toString() + ")();",
            "Smooth penceresi zaman aşımına uğradı."
        );
    }

    function handleWorkerResult(raw) {
        var text = safeText(raw);
        if (text.indexOf("ERR:") === 0) {
            setStatus(text.substring(4));
            alert(text.substring(4));
        } else if (text.indexOf("CANCEL:") === 0) {
            setStatus(text.substring(7));
        } else if (text.indexOf("OK:") === 0) {
            setStatus(text.substring(3));
        } else {
            setStatus(text || "İşlem tamamlandı.");
        }
    }

    // ========================================================================
    // ILLUSTRATOR WORKER FONKSİYONLARI
    // ========================================================================

    function nativeCommandWorker(label, commands, needSelection) {
        try {
            // Illustrator ExtendScript DOM içinde app.bringToFront() yoktur.
            // BridgeTalk zaten bu worker'ı Illustrator içinde çalıştırır.

            if (app.documents.length < 1) {
                return "ERR:Açık Illustrator belgesi yok.";
            }

            var doc = app.activeDocument;
            if (needSelection && (!doc.selection || doc.selection.length < 1)) {
                return "ERR:Önce Illustrator içinde uygun nesne veya anchor noktası seç.";
            }

            var lastError = "";
            for (var i = 0; i < commands.length; i++) {
                try {
                    app.executeMenuCommand(commands[i]);
                    try { app.redraw(); } catch (eRedraw) {}
                    return "OK:" + label + " komutu çalıştırıldı.";
                } catch (eCmd) {
                    lastError = eCmd.toString();
                }
            }

            return "ERR:" + label + " komutu bu Illustrator sürümünde çalıştırılamadı." +
                (lastError ? "\n\n" + lastError : "");
        } catch (e) {
            return "ERR:" + label + " hatası:\n" + e.toString();
        }
    }

    function selectionCheckWorker() {
        try {
            // BridgeTalk worker zaten Illustrator bağlamında çalışır.
            if (app.documents.length < 1) return "ERR:Açık Illustrator belgesi yok.";
            var doc = app.activeDocument;
            var count = (doc.selection && doc.selection.length) ? doc.selection.length : 0;
            if (count < 1) return "OK:Seçili nesne yok.";
            return "OK:" + count + " öğe seçili.";
        } catch (e) {
            return "ERR:Seçim okunamadı:\n" + e.toString();
        }
    }

    function reversePathWorker() {
        try {
            // BridgeTalk worker zaten Illustrator bağlamında çalışır.
            if (app.documents.length < 1) return "ERR:Açık Illustrator belgesi yok.";

            var doc = app.activeDocument;
            if (!doc.selection || doc.selection.length < 1) {
                return "ERR:Önce yönü ters çevrilecek bir veya daha fazla yol seç.";
            }

            var done = 0;
            var skipped = 0;

            function reverseOne(path) {
                if (!path || path.typename !== "PathItem") return false;
                if (path.locked || path.hidden || path.guides) return false;

                var n = path.pathPoints.length;
                if (n < 2) return false;

                var closedState = path.closed;
                var data = [];
                var anchors = [];
                var i;

                for (i = 0; i < n; i++) {
                    var pp = path.pathPoints[i];
                    data.push({
                        anchor: [pp.anchor[0], pp.anchor[1]],
                        left: [pp.leftDirection[0], pp.leftDirection[1]],
                        right: [pp.rightDirection[0], pp.rightDirection[1]],
                        pointType: pp.pointType,
                        selected: pp.selected
                    });
                }

                for (i = n - 1; i >= 0; i--) {
                    anchors.push([data[i].anchor[0], data[i].anchor[1]]);
                }

                path.setEntirePath(anchors);
                path.closed = closedState;

                for (i = 0; i < n; i++) {
                    var source = data[n - 1 - i];
                    var target = path.pathPoints[i];
                    target.leftDirection = [source.right[0], source.right[1]];
                    target.rightDirection = [source.left[0], source.left[1]];
                    target.pointType = source.pointType;
                    try { target.selected = source.selected; } catch (eSel) {}
                }

                return true;
            }

            function walk(item) {
                if (!item) return;

                if (item.typename === "PathItem") {
                    if (reverseOne(item)) done++; else skipped++;
                    return;
                }

                if (item.typename === "CompoundPathItem") {
                    for (var c = 0; c < item.pathItems.length; c++) {
                        if (reverseOne(item.pathItems[c])) done++; else skipped++;
                    }
                    return;
                }

                if (item.typename === "GroupItem") {
                    for (var g = 0; g < item.pageItems.length; g++) walk(item.pageItems[g]);
                    return;
                }

                skipped++;
            }

            for (var s = 0; s < doc.selection.length; s++) walk(doc.selection[s]);

            if (done < 1) return "ERR:Seçimde ters çevrilebilen bir PathItem bulunamadı.";
            try { app.redraw(); } catch (eDraw) {}

            return "OK:" + done + " yolun yönü ters çevrildi." +
                (skipped > 0 ? " " + skipped + " öğe atlandı." : "");
        } catch (e) {
            return "ERR:Reverse Path Direction hatası:\n" + e.toString();
        }
    }

    function smoothPathWorker() {
        try {
            // BridgeTalk worker zaten Illustrator bağlamında çalışır.
            if (app.documents.length < 1) return "ERR:Açık Illustrator belgesi yok.";

            var doc = app.activeDocument;
            if (!doc.selection || doc.selection.length < 1) {
                return "ERR:Önce yumuşatılacak bir veya daha fazla yol seç.";
            }

            var dlg = new Window("dialog", "Axyon Smooth Path");
            dlg.orientation = "column";
            dlg.alignChildren = ["fill", "top"];
            dlg.margins = [14, 14, 14, 14];
            dlg.spacing = 9;

            var info = dlg.add("statictext", undefined,
                "Yumuşatma gücünü seç. İşlem tek Undo ile geri alınabilir.",
                { multiline: true }
            );
            info.preferredSize = [340, 35];

            var valueGroup = dlg.add("group");
            valueGroup.orientation = "row";
            valueGroup.alignChildren = ["fill", "center"];

            var slider = valueGroup.add("slider", undefined, 35, 1, 100);
            slider.preferredSize = [250, 22];
            var input = valueGroup.add("edittext", undefined, "35");
            input.characters = 4;

            var optionPanel = dlg.add("panel", undefined, "Seçenek");
            optionPanel.orientation = "column";
            optionPanel.alignChildren = ["left", "center"];
            optionPanel.margins = [10, 16, 10, 8];

            var chkMoveAnchors = optionPanel.add("checkbox", undefined,
                "Anchor noktalarını hafifçe düzenle");
            chkMoveAnchors.value = true;

            var buttons = dlg.add("group");
            buttons.alignment = "right";
            var cancelBtn = buttons.add("button", undefined, "İptal", { name: "cancel" });
            var okBtn = buttons.add("button", undefined, "Uygula", { name: "ok" });

            slider.onChanging = function () {
                input.text = String(Math.round(slider.value));
            };
            input.onChange = function () {
                var v = parseInt(input.text, 10);
                if (isNaN(v)) v = 35;
                if (v < 1) v = 1;
                if (v > 100) v = 100;
                input.text = String(v);
                slider.value = v;
            };

            if (dlg.show() !== 1) return "CANCEL:Smooth işlemi iptal edildi.";

            var strength = parseInt(input.text, 10);
            if (isNaN(strength)) strength = 35;
            if (strength < 1) strength = 1;
            if (strength > 100) strength = 100;

            var moveAnchors = chkMoveAnchors.value;
            var alpha = (strength / 100) * 0.32;
            var handleFactor = 0.16 + (strength / 100) * 0.16;
            var iterations = 1 + Math.floor(strength / 34);
            var done = 0;
            var skipped = 0;

            function distance(a, b) {
                var dx = a[0] - b[0];
                var dy = a[1] - b[1];
                return Math.sqrt(dx * dx + dy * dy);
            }

            function smoothOne(path) {
                if (!path || path.typename !== "PathItem") return false;
                if (path.locked || path.hidden || path.guides) return false;

                var n = path.pathPoints.length;
                if (n < 3) return false;

                var closed = path.closed;
                var points = [];
                var original = [];
                var i;

                for (i = 0; i < n; i++) {
                    var p = path.pathPoints[i];
                    points.push([p.anchor[0], p.anchor[1]]);
                    original.push({
                        anchor: [p.anchor[0], p.anchor[1]],
                        left: [p.leftDirection[0], p.leftDirection[1]],
                        right: [p.rightDirection[0], p.rightDirection[1]],
                        pointType: p.pointType,
                        selected: p.selected
                    });
                }

                if (moveAnchors) {
                    for (var pass = 0; pass < iterations; pass++) {
                        var nextPoints = [];
                        for (i = 0; i < n; i++) {
                            if (!closed && (i === 0 || i === n - 1)) {
                                nextPoints.push([points[i][0], points[i][1]]);
                                continue;
                            }

                            var prevIndex = (i - 1 + n) % n;
                            var nextIndex = (i + 1) % n;
                            var avgX = (points[prevIndex][0] + points[nextIndex][0]) / 2;
                            var avgY = (points[prevIndex][1] + points[nextIndex][1]) / 2;

                            nextPoints.push([
                                points[i][0] * (1 - alpha) + avgX * alpha,
                                points[i][1] * (1 - alpha) + avgY * alpha
                            ]);
                        }
                        points = nextPoints;
                    }
                }

                path.setEntirePath(points);
                path.closed = closed;

                for (i = 0; i < n; i++) {
                    var target = path.pathPoints[i];
                    var anchor = points[i];

                    if (!closed && (i === 0 || i === n - 1)) {
                        target.leftDirection = original[i].left;
                        target.rightDirection = original[i].right;
                        target.pointType = original[i].pointType;
                        try { target.selected = original[i].selected; } catch (eEndSel) {}
                        continue;
                    }

                    var pi = (i - 1 + n) % n;
                    var ni = (i + 1) % n;
                    var prev = points[pi];
                    var next = points[ni];
                    var tx = next[0] - prev[0];
                    var ty = next[1] - prev[1];
                    var len = Math.sqrt(tx * tx + ty * ty);

                    if (len < 0.0001) {
                        target.leftDirection = [anchor[0], anchor[1]];
                        target.rightDirection = [anchor[0], anchor[1]];
                    } else {
                        var ux = tx / len;
                        var uy = ty / len;
                        var leftLen = distance(anchor, prev) * handleFactor;
                        var rightLen = distance(anchor, next) * handleFactor;

                        target.leftDirection = [
                            anchor[0] - ux * leftLen,
                            anchor[1] - uy * leftLen
                        ];
                        target.rightDirection = [
                            anchor[0] + ux * rightLen,
                            anchor[1] + uy * rightLen
                        ];
                    }

                    target.pointType = PointType.SMOOTH;
                    try { target.selected = original[i].selected; } catch (eSel) {}
                }

                return true;
            }

            function walk(item) {
                if (!item) return;

                if (item.typename === "PathItem") {
                    if (smoothOne(item)) done++; else skipped++;
                    return;
                }

                if (item.typename === "CompoundPathItem") {
                    for (var c = 0; c < item.pathItems.length; c++) {
                        if (smoothOne(item.pathItems[c])) done++; else skipped++;
                    }
                    return;
                }

                if (item.typename === "GroupItem") {
                    for (var g = 0; g < item.pageItems.length; g++) walk(item.pageItems[g]);
                    return;
                }

                skipped++;
            }

            for (var s = 0; s < doc.selection.length; s++) walk(doc.selection[s]);

            if (done < 1) return "ERR:Seçimde yumuşatılabilen bir PathItem bulunamadı.";
            try { app.redraw(); } catch (eDraw) {}

            return "OK:" + done + " yol yumuşatıldı (%" + strength + ")." +
                (skipped > 0 ? " " + skipped + " öğe atlandı." : "");
        } catch (e) {
            return "ERR:Smooth hatası:\n" + e.toString();
        }
    }

    // ========================================================================
    // DURUM / KONUM
    // ========================================================================

    function getStateFile() {
        return new File(Folder.userData + "/" + STATE_FILE_NAME);
    }

    function loadState() {
        try {
            var file = getStateFile();
            if (!file.exists) return null;
            file.encoding = "UTF-8";
            if (!file.open("r")) return null;
            var raw = file.read();
            file.close();

            var parts = String(raw).split(",");
            if (parts.length < 2) return null;
            var x = parseInt(parts[0], 10);
            var y = parseInt(parts[1], 10);
            if (isNaN(x) || isNaN(y)) return null;
            return { x: x, y: y };
        } catch (e) {
            return null;
        }
    }

    function savePosition() {
        try {
            if (!win) return;
            var loc = win.location;
            if (!loc || loc.length < 2) return;

            var file = getStateFile();
            file.encoding = "UTF-8";
            if (!file.open("w")) return;
            file.write(String(Math.round(loc[0])) + "," + String(Math.round(loc[1])));
            file.close();
        } catch (e) {}
    }

    function isVisiblePosition(x, y) {
        try {
            if (typeof $.screens === "undefined" || !$.screens || $.screens.length < 1) {
                return x > -10000 && x < 10000 && y > -10000 && y < 10000;
            }

            for (var i = 0; i < $.screens.length; i++) {
                var s = $.screens[i];
                if (x >= s.left - 30 && x <= s.right - 30 &&
                    y >= s.top - 30 && y <= s.bottom - 30) {
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    // ========================================================================
    // STRING YARDIMCILARI
    // ========================================================================

    function safeText(value) {
        try { return String(value === undefined || value === null ? "" : value); }
        catch (e) { return ""; }
    }

    function quote(value) {
        var text = safeText(value);
        text = text.replace(/\\/g, "\\\\");
        text = text.replace(/\"/g, "\\\"");
        text = text.replace(/\r/g, "\\r");
        text = text.replace(/\n/g, "\\n");
        return "\"" + text + "\"";
    }

    function arrayLiteral(values) {
        var parts = [];
        for (var i = 0; i < values.length; i++) parts.push(quote(values[i]));
        return "[" + parts.join(",") + "]";
    }
})();
