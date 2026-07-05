/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║      AXYON DOT PUZZLE NODES — ILLUSTRATOR EXTENDSCRIPT      ║
 * ║      Şablona sadık tek sürüm / Palette + BridgeTalk         ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Amaç:
 *   Seçili Pen Tool/path çizimlerinde nokta ve numara üretir.
 *
 * Modlar:
 *   1) Gerçek node'lar:
 *      Illustrator anchor noktalarını aynen işaretler.
 *
 *   2) Path boyunca eşit dağıt:
 *      Gerçek node sayısını kaynak alır, çarpana göre hedef nokta sayısı üretir
 *      ve noktaları tüm path uzunluğu boyunca eşit mesafeyle dağıtır.
 *
 * Kural:
 *   Bu dosya ana sürümdür. Ayrı hızlı/panelsiz sürüm tutulmaz.
 */

#target illustrator
#targetengine "Axyon_DotPuzzleNodes_v017"

(function () {

    /* ════════════════════════════════════════════════════════
       SABİTLER
    ════════════════════════════════════════════════════════ */
    var MM_TO_PT = 2.834645669291339;
    var PALETTE_TITLE = "Axyon Dot Puzzle Nodes";

    /* ════════════════════════════════════════════════════════
       UI — PALETTE (MODELESS)
       Palette açıkken kullanıcı tuvalde seçim yapabilir.
    ════════════════════════════════════════════════════════ */
    var win = new Window("palette", PALETTE_TITLE, undefined, { closeButton: true });
    win.orientation   = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing       = 8;
    win.margins       = [14, 14, 14, 14];

    function addInputRow(parent, label, defaultVal) {
        var g = parent.add("group");
        g.alignment     = ["fill", "center"];
        g.alignChildren = ["left", "center"];

        var st = g.add("statictext", undefined, label);
        st.preferredSize.width = 150;

        var et = g.add("edittext", undefined, String(defaultVal));
        et.preferredSize = [72, 22];

        return et;
    }

    var pInputs = win.add("panel", undefined, "Parametreler");
    pInputs.orientation   = "column";
    pInputs.alignChildren = ["fill", "center"];
    pInputs.margins       = [12, 18, 12, 10];
    pInputs.spacing       = 6;

    var inDiameterMM  = addInputRow(pInputs, "Daire çapı mm :", 2);
    var inLabelGapMM  = addInputRow(pInputs, "Numara uzaklığı :", 3);
    var inFontSizePt  = addInputRow(pInputs, "Font pt :", 7);
    var inStartNumber = addInputRow(pInputs, "Başlangıç no :", 1);

    var pDensify = win.add("panel", undefined, "Nokta Üretimi");
    pDensify.orientation   = "column";
    pDensify.alignChildren = ["left", "center"];
    pDensify.margins       = [12, 18, 12, 10];
    pDensify.spacing       = 6;

    var chkUniformPath = pDensify.add("checkbox", undefined, "Path boyunca eşit dağıt");
    chkUniformPath.value = false;

    var densifyRow = pDensify.add("group");
    densifyRow.alignment = ["fill", "center"];
    densifyRow.alignChildren = ["left", "center"];

    var densifyLabel = densifyRow.add("statictext", undefined, "Nokta çarpanı :");
    densifyLabel.preferredSize.width = 150;

    var inDensifyFactor = densifyRow.add("edittext", undefined, "2");
    inDensifyFactor.preferredSize = [72, 22];

    var densifyHint = pDensify.add("statictext", undefined, "Kapalı: gerçek node'lar | Açık: tüm path'e eşit aralık", { multiline: false });
    densifyHint.preferredSize.width = 320;

    var pOpts = win.add("panel", undefined, "Seçenekler");
    pOpts.orientation   = "column";
    pOpts.alignChildren = ["left", "center"];
    pOpts.margins       = [12, 18, 12, 10];
    pOpts.spacing       = 5;

    var chkAvoidOverlap = pOpts.add("checkbox", undefined, "Numara çakışmasını azalt");
    chkAvoidOverlap.value = true;

    var chkClearOld = pOpts.add("checkbox", undefined, "Eski DOT_PUZZLE_MARKERS layer'ını temizle");
    chkClearOld.value = false;

    var pStatus = win.add("panel");
    pStatus.margins = [8, 8, 8, 6];

    var txStatus = pStatus.add("statictext", undefined,
        "Path seçip Uygula'ya basın", { multiline: false });
    txStatus.preferredSize.width = 330;
    txStatus.justify = "center";

    var grpBtn = win.add("group");
    grpBtn.alignment = "center";
    grpBtn.spacing   = 6;

    var btnApply = grpBtn.add("button", undefined, "Uygula");
    btnApply.preferredSize = [100, 30];

    var btnUndo = grpBtn.add("button", undefined, "Geri Al");
    btnUndo.preferredSize = [90, 30];

    var btnClose = grpBtn.add("button", undefined, "Kapat");
    btnClose.preferredSize = [70, 30];

    function parseNumber(value) {
        return parseFloat(String(value).replace(",", "."));
    }

    /* ════════════════════════════════════════════════════════
       UYGULA BUTONU
    ════════════════════════════════════════════════════════ */
    btnApply.onClick = function () {
        var diameterMM    = parseNumber(inDiameterMM.text);
        var labelGapMM    = parseNumber(inLabelGapMM.text);
        var fontSizePt    = parseNumber(inFontSizePt.text);
        var startNumber   = parseInt(inStartNumber.text, 10);
        var densifyFactor = parseInt(inDensifyFactor.text, 10);

        if (isNaN(diameterMM) || diameterMM <= 0) {
            txStatus.text = "Geçersiz daire çapı.";
            return;
        }

        if (isNaN(labelGapMM) || labelGapMM < 0) {
            txStatus.text = "Geçersiz numara uzaklığı.";
            return;
        }

        if (isNaN(fontSizePt) || fontSizePt <= 0) {
            txStatus.text = "Geçersiz font boyutu.";
            return;
        }

        if (isNaN(startNumber)) {
            txStatus.text = "Geçersiz başlangıç numarası.";
            return;
        }

        if (isNaN(densifyFactor) || densifyFactor < 1) {
            txStatus.text = "Nokta çarpanı en az 1 olmalı.";
            return;
        }

        if (densifyFactor > 8) {
            txStatus.text = "Nokta çarpanı 8'den büyük olmasın.";
            return;
        }

        txStatus.text = "İşleniyor...";
        win.update();

        /* ── BridgeTalk
         * Palette context'inde Illustrator işlemleri doğrudan yapılmaz.
         * Tüm belge/path/layer işlemleri BridgeTalk body'sinde çalışır.
         */
        var bt = new BridgeTalk();
        bt.target = "illustrator";

        bt.body =
            "(" + runDotPuzzleInIllustrator.toString() + ")(" +
                diameterMM + "," +
                labelGapMM + "," +
                fontSizePt + "," +
                startNumber + "," +
                (chkClearOld.value ? "true" : "false") + "," +
                (chkAvoidOverlap.value ? "true" : "false") + "," +
                (chkUniformPath.value ? "true" : "false") + "," +
                densifyFactor +
            ");";

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

        bt.onResult = function (res) {
            txStatus.text = res.body;
        };

        bt.onError = function (err) {
            txStatus.text = "Geri al hatası: " + err.body;
        };

        bt.send();
    };

    btnClose.onClick = function () {
        win.close();
    };

    win.center();
    win.show();

    /* ════════════════════════════════════════════════════════
       ILLUSTRATOR İŞ MANTIĞI — BridgeTalk içinde çalışır
    ════════════════════════════════════════════════════════ */
    function runDotPuzzleInIllustrator(
        diameterMM,
        labelGapMM,
        fontSizePt,
        startNumber,
        clearOldMarkers,
        avoidLabelOverlap,
        uniformPathEnabled,
        densifyFactor
    ) {
        if (app.documents.length === 0) {
            return "ERR:Açık belge yok.";
        }

        var doc = app.activeDocument;
        var sel = doc.selection;

        if (!sel || sel.length === 0) {
            return "ERR:Lütfen önce path/çizgi seçin.";
        }

        var MM_TO_PT = 2.834645669291339;

        var CFG = {
            diameterMM: diameterMM,
            labelGapMM: labelGapMM,
            fontSizePt: fontSizePt,
            startNumber: startNumber,
            clearOldMarkers: clearOldMarkers,
            avoidLabelOverlap: avoidLabelOverlap,
            uniformPathEnabled: uniformPathEnabled,
            densifyFactor: densifyFactor,

            layerName: "DOT_PUZZLE_MARKERS",

            dotRed: 255,
            dotGreen: 30,
            dotBlue: 30,

            labelRed: 255,
            labelGreen: 30,
            labelBlue: 30,

            strokeWidthPt: 0
        };

        var diameter = CFG.diameterMM * MM_TO_PT;
        var radius   = diameter / 2;
        var labelGap = CFG.labelGapMM * MM_TO_PT;

        function rgb(r, g, b) {
            var c = new RGBColor();
            c.red = r;
            c.green = g;
            c.blue = b;
            return c;
        }

        var dotColor   = rgb(CFG.dotRed, CFG.dotGreen, CFG.dotBlue);
        var labelColor = rgb(CFG.labelRed, CFG.labelGreen, CFG.labelBlue);

        /* ── getTrueVisualBounds
         * Şablon standardı olarak tutulur.
         * Bu script anchor/node kullandığı için ana işte şart değildir,
         * fakat clip mask / group işlemleri gerektiren sonraki patchler için hazırdır.
         */
        function getTrueVisualBounds(item) {
            if (item.typename === "GroupItem") {
                if (item.clipped) {
                    for (var j = 0; j < item.pageItems.length; j++) {
                        if (item.pageItems[j].clipping) {
                            return item.pageItems[j].geometricBounds;
                        }
                    }
                    return item.visibleBounds;
                } else {
                    var combined = null;

                    for (var k = 0; k < item.pageItems.length; k++) {
                        var cb = getTrueVisualBounds(item.pageItems[k]);

                        if (cb) {
                            if (!combined) {
                                combined = [cb[0], cb[1], cb[2], cb[3]];
                            } else {
                                combined[0] = Math.min(combined[0], cb[0]);
                                combined[1] = Math.max(combined[1], cb[1]);
                                combined[2] = Math.max(combined[2], cb[2]);
                                combined[3] = Math.min(combined[3], cb[3]);
                            }
                        }
                    }

                    return combined || item.visibleBounds;
                }
            }

            return item.visibleBounds;
        }

        function getOrCreateLayer(name) {
            try {
                return doc.layers.getByName(name);
            } catch (e) {
                var layer = doc.layers.add();
                layer.name = name;
                return layer;
            }
        }

        function clearLayer(layer) {
            layer.locked = false;
            layer.visible = true;

            while (layer.pageItems.length > 0) {
                layer.pageItems[0].remove();
            }
        }

        function isFiniteNumber(v) {
            return typeof v === "number" && isFinite(v);
        }

        function distance(a, b) {
            var dx = a.x - b.x;
            var dy = a.y - b.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function lerp(a, b, t) {
            return {
                x: a.x + (b.x - a.x) * t,
                y: a.y + (b.y - a.y) * t
            };
        }

        function bezierPoint(p0, c1, c2, p3, t) {
            var mt = 1 - t;
            var mt2 = mt * mt;
            var t2 = t * t;

            return {
                x:
                    (mt2 * mt * p0.x) +
                    (3 * mt2 * t * c1.x) +
                    (3 * mt * t2 * c2.x) +
                    (t2 * t * p3.x),
                y:
                    (mt2 * mt * p0.y) +
                    (3 * mt2 * t * c1.y) +
                    (3 * mt * t2 * c2.y) +
                    (t2 * t * p3.y)
            };
        }

        function makePointFromPathPoint(pp) {
            var a = pp.anchor;
            var l = pp.leftDirection;
            var r = pp.rightDirection;

            var ax = Number(a[0]);
            var ay = Number(a[1]);

            if (!isFiniteNumber(ax) || !isFiniteNumber(ay)) {
                return null;
            }

            var lx = Number(l[0]);
            var ly = Number(l[1]);
            var rx = Number(r[0]);
            var ry = Number(r[1]);

            if (!isFiniteNumber(lx) || !isFiniteNumber(ly)) {
                lx = ax;
                ly = ay;
            }

            if (!isFiniteNumber(rx) || !isFiniteNumber(ry)) {
                rx = ax;
                ry = ay;
            }

            return {
                anchor: { x: ax, y: ay },
                left:   { x: lx, y: ly },
                right:  { x: rx, y: ry }
            };
        }

        /* ── Seçimi snapshotle
         * Duplicate/group/marker üretimi sırasında doc.selection veya canlı referanslar bozulabilir.
         * O yüzden önce seçimi ve path verilerini kopyalıyoruz.
         */
        var snap = [];

        for (var si = 0; si < sel.length; si++) {
            snap.push(sel[si]);
        }

        var pathSnaps = [];
        var skippedItems = 0;

        function snapshotPath(pathItem) {
            try {
                if (!pathItem) {
                    skippedItems++;
                    return;
                }

                if (pathItem.guides || pathItem.clipping) {
                    skippedItems++;
                    return;
                }

                var len = pathItem.pathPoints.length;

                if (len <= 0) {
                    skippedItems++;
                    return;
                }

                var pts = [];

                for (var i = 0; i < len; i++) {
                    var p = makePointFromPathPoint(pathItem.pathPoints[i]);

                    if (p) {
                        pts.push(p);
                    }
                }

                if (pts.length > 0) {
                    pathSnaps.push({
                        closed: pathItem.closed,
                        points: pts
                    });
                } else {
                    skippedItems++;
                }
            } catch (e) {
                skippedItems++;
            }
        }

        function collectPaths(item) {
            if (!item) {
                skippedItems++;
                return;
            }

            try {
                if (item.typename === "PathItem") {
                    snapshotPath(item);
                    return;
                }

                if (item.typename === "CompoundPathItem") {
                    for (var i = 0; i < item.pathItems.length; i++) {
                        snapshotPath(item.pathItems[i]);
                    }
                    return;
                }

                if (item.typename === "GroupItem") {
                    for (var j = 0; j < item.pageItems.length; j++) {
                        collectPaths(item.pageItems[j]);
                    }
                    return;
                }

                skippedItems++;
            } catch (e) {
                skippedItems++;
            }
        }

        for (var s = 0; s < snap.length; s++) {
            collectPaths(snap[s]);
        }

        if (pathSnaps.length === 0) {
            return "ERR:Seçimde uygun path/node bulunamadı.";
        }

        function buildPathSamples(path) {
            var pts = path.points;
            var len = pts.length;

            if (len <= 0) {
                return null;
            }

            if (len === 1) {
                return {
                    total: 0,
                    samples: [
                        {
                            len: 0,
                            p: {
                                x: pts[0].anchor.x,
                                y: pts[0].anchor.y
                            }
                        }
                    ]
                };
            }

            var segCount = path.closed ? len : len - 1;

            if (segCount <= 0) {
                return null;
            }

            var samples = [];
            var total = 0;

            samples.push({
                len: 0,
                p: {
                    x: pts[0].anchor.x,
                    y: pts[0].anchor.y
                }
            });

            for (var i = 0; i < segCount; i++) {
                var nextIndex = (i < len - 1) ? i + 1 : 0;

                var current = pts[i];
                var next = pts[nextIndex];

                var p0 = current.anchor;
                var c1 = current.right;
                var c2 = next.left;
                var p3 = next.anchor;

                var prev = bezierPoint(p0, c1, c2, p3, 0);

                // 32 örnek çoğu Illustrator çizgi bulmaca işinde yeterlidir.
                // Uzun veya kıvrımlı segmentlerde hata düşük kalsın diye 48 kullanıyoruz.
                var sampleCount = 48;

                for (var tStep = 1; tStep <= sampleCount; tStep++) {
                    var t = tStep / sampleCount;
                    var bp = bezierPoint(p0, c1, c2, p3, t);

                    total += distance(prev, bp);

                    samples.push({
                        len: total,
                        p: bp
                    });

                    prev = bp;
                }
            }

            return {
                total: total,
                samples: samples
            };
        }

        function pointAtDistance(samples, total, targetDistance) {
            if (samples.length === 0) {
                return { x: 0, y: 0 };
            }

            if (targetDistance <= 0) {
                return {
                    x: samples[0].p.x,
                    y: samples[0].p.y
                };
            }

            if (targetDistance >= total) {
                var last = samples[samples.length - 1].p;
                return {
                    x: last.x,
                    y: last.y
                };
            }

            for (var i = 1; i < samples.length; i++) {
                if (samples[i].len >= targetDistance) {
                    var before = samples[i - 1];
                    var after = samples[i];
                    var span = after.len - before.len;
                    var ratio = span <= 0 ? 0 : (targetDistance - before.len) / span;

                    return lerp(before.p, after.p, ratio);
                }
            }

            var fallback = samples[samples.length - 1].p;

            return {
                x: fallback.x,
                y: fallback.y
            };
        }

        function addRealNodeMarkers(path, markers) {
            var pts = path.points;

            for (var i = 0; i < pts.length; i++) {
                markers.push({
                    x: pts[i].anchor.x,
                    y: pts[i].anchor.y,
                    source: "real"
                });
            }
        }

        function addUniformMarkers(path, markers) {
            var pts = path.points;
            var len = pts.length;

            if (len <= 0) {
                return;
            }

            if (len === 1) {
                markers.push({
                    x: pts[0].anchor.x,
                    y: pts[0].anchor.y,
                    source: "uniform"
                });
                return;
            }

            var samplesInfo = buildPathSamples(path);

            if (!samplesInfo || samplesInfo.samples.length === 0) {
                addRealNodeMarkers(path, markers);
                return;
            }

            if (samplesInfo.total <= 0.001) {
                addRealNodeMarkers(path, markers);
                return;
            }

            var targetCount;

            if (path.closed) {
                targetCount = len * CFG.densifyFactor;
            } else {
                targetCount = ((len - 1) * CFG.densifyFactor) + 1;
            }

            targetCount = Math.max(1, targetCount);

            if (path.closed) {
                for (var i = 0; i < targetCount; i++) {
                    var dClosed = samplesInfo.total * i / targetCount;
                    var pClosed = pointAtDistance(samplesInfo.samples, samplesInfo.total, dClosed);

                    markers.push({
                        x: pClosed.x,
                        y: pClosed.y,
                        source: "uniform"
                    });
                }
            } else {
                if (targetCount === 1) {
                    var pOnly = pointAtDistance(samplesInfo.samples, samplesInfo.total, 0);

                    markers.push({
                        x: pOnly.x,
                        y: pOnly.y,
                        source: "uniform"
                    });
                } else {
                    for (var j = 0; j < targetCount; j++) {
                        var dOpen = samplesInfo.total * j / (targetCount - 1);
                        var pOpen = pointAtDistance(samplesInfo.samples, samplesInfo.total, dOpen);

                        markers.push({
                            x: pOpen.x,
                            y: pOpen.y,
                            source: "uniform"
                        });
                    }
                }
            }
        }

        function buildMarkerPoints(paths) {
            var markers = [];
            var realNodeCount = 0;

            for (var p = 0; p < paths.length; p++) {
                realNodeCount += paths[p].points.length;

                if (CFG.uniformPathEnabled) {
                    addUniformMarkers(paths[p], markers);
                } else {
                    addRealNodeMarkers(paths[p], markers);
                }
            }

            return {
                markers: markers,
                realNodeCount: realNodeCount
            };
        }

        var markerBuild = buildMarkerPoints(pathSnaps);
        var markers = markerBuild.markers;

        if (markers.length === 0) {
            return "ERR:İşaretlenecek nokta üretilemedi.";
        }

        var minX = markers[0].x;
        var maxX = markers[0].x;
        var minY = markers[0].y;
        var maxY = markers[0].y;

        for (var b = 1; b < markers.length; b++) {
            if (markers[b].x < minX) minX = markers[b].x;
            if (markers[b].x > maxX) maxX = markers[b].x;
            if (markers[b].y < minY) minY = markers[b].y;
            if (markers[b].y > maxY) maxY = markers[b].y;
        }

        var center = {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2
        };

        var markerLayer = getOrCreateLayer(CFG.layerName);
        markerLayer.locked = false;
        markerLayer.visible = true;

        try {
            markerLayer.zOrder(ZOrderMethod.BRINGTOFRONT);
        } catch (e) {}

        if (CFG.clearOldMarkers) {
            clearLayer(markerLayer);
        }

        var oldLayer = doc.activeLayer;
        doc.activeLayer = markerLayer;

        var group = markerLayer.groupItems.add();
        group.name = "Dot Puzzle Markers " + new Date().getTime();

        function normalizeBounds(rawBounds) {
            return {
                left:   Math.min(rawBounds[0], rawBounds[2]),
                top:    Math.max(rawBounds[1], rawBounds[3]),
                right:  Math.max(rawBounds[0], rawBounds[2]),
                bottom: Math.min(rawBounds[1], rawBounds[3])
            };
        }

        function boxFromCenter(x, y, width, height) {
            return {
                left: x - width / 2,
                right: x + width / 2,
                top: y + height / 2,
                bottom: y - height / 2
            };
        }

        function inflateBox(box, amount) {
            return {
                left: box.left - amount,
                right: box.right + amount,
                top: box.top + amount,
                bottom: box.bottom - amount
            };
        }

        function boxesOverlap(a, b) {
            return !(a.right < b.left || a.left > b.right || a.bottom > b.top || a.top < b.bottom);
        }

        function collisionCount(box, boxes) {
            var count = 0;

            for (var i = 0; i < boxes.length; i++) {
                if (boxesOverlap(box, boxes[i])) {
                    count++;
                }
            }

            return count;
        }

        function addCircle(x, y, dotBoxes) {
            var circle = doc.pathItems.ellipse(
                y + radius,
                x - radius,
                diameter,
                diameter
            );

            circle.name = "node_circle";
            circle.filled = true;
            circle.fillColor = dotColor;
            circle.stroked = CFG.strokeWidthPt > 0;

            if (circle.stroked) {
                circle.strokeColor = dotColor;
                circle.strokeWidth = CFG.strokeWidthPt;
            }

            circle.move(group, ElementPlacement.PLACEATEND);

            // Numara yerleşiminde noktaların üstüne binmeyi azaltmak için gerçek dot kutusunu blok olarak tut.
            dotBoxes.push(inflateBox(
                boxFromCenter(x, y, diameter, diameter),
                0.4 * MM_TO_PT
            ));
        }

        function getTextBounds(tf) {
            try {
                return normalizeBounds(tf.visibleBounds);
            } catch (e1) {
                try {
                    return normalizeBounds(tf.geometricBounds);
                } catch (e2) {
                    return null;
                }
            }
        }

        function centerTextFrame(tf, targetX, targetY) {
            // İlk konum kaba yerleşimdir.
            tf.position = [targetX, targetY];

            var b1 = getTextBounds(tf);

            if (!b1) {
                return null;
            }

            var cx = (b1.left + b1.right) / 2;
            var cy = (b1.top + b1.bottom) / 2;

            var dx = targetX - cx;
            var dy = targetY - cy;

            tf.position = [
                tf.position[0] + dx,
                tf.position[1] + dy
            ];

            return getTextBounds(tf);
        }

        function makeLabelCandidates(anchor) {
            var result = [];

            var dx = anchor.x - center.x;
            var dy = anchor.y - center.y;

            var baseAngle;

            if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
                baseAngle = 0;
            } else {
                baseAngle = Math.atan2(dy, dx);
            }

            var angleStepsDeg = [
                0,
                15, -15,
                30, -30,
                45, -45,
                65, -65,
                90, -90,
                120, -120,
                150, -150,
                180
            ];

            var distanceSteps = [
                radius + labelGap,
                radius + labelGap + (2.0 * MM_TO_PT),
                radius + labelGap + (4.0 * MM_TO_PT),
                radius + labelGap + (7.0 * MM_TO_PT),
                radius + labelGap + (11.0 * MM_TO_PT),
                radius + labelGap + (16.0 * MM_TO_PT),
                radius + labelGap + (23.0 * MM_TO_PT),
                radius + labelGap + (32.0 * MM_TO_PT)
            ];

            for (var d = 0; d < distanceSteps.length; d++) {
                for (var a = 0; a < angleStepsDeg.length; a++) {
                    var ang = baseAngle + angleStepsDeg[a] * Math.PI / 180;

                    result.push({
                        x: anchor.x + Math.cos(ang) * distanceSteps[d],
                        y: anchor.y + Math.sin(ang) * distanceSteps[d]
                    });
                }
            }

            return result;
        }

        function addLabel(x, y, text, blockedBoxes, labelBoxes, stats) {
            var tf = doc.textFrames.add();
            tf.name = "node_number";
            tf.contents = text;

            tf.textRange.characterAttributes.size = CFG.fontSizePt;
            tf.textRange.characterAttributes.fillColor = labelColor;

            var candidates = makeLabelCandidates({ x: x, y: y });
            var boxesToCheck = [];

            for (var bi = 0; bi < blockedBoxes.length; bi++) {
                boxesToCheck.push(blockedBoxes[bi]);
            }

            for (var li = 0; li < labelBoxes.length; li++) {
                boxesToCheck.push(labelBoxes[li]);
            }

            var best = null;
            var bestCollision = 999999;

            if (!CFG.avoidLabelOverlap) {
                var first = candidates[0];
                var firstBox = centerTextFrame(tf, first.x, first.y);

                if (firstBox) {
                    labelBoxes.push(inflateBox(firstBox, 0.15 * MM_TO_PT));
                }

                tf.move(group, ElementPlacement.PLACEATEND);
                return;
            }

            for (var c = 0; c < candidates.length; c++) {
                var candidate = candidates[c];
                var currentBox = centerTextFrame(tf, candidate.x, candidate.y);

                if (!currentBox) {
                    continue;
                }

                var inflated = inflateBox(currentBox, 0.15 * MM_TO_PT);
                var collisions = collisionCount(inflated, boxesToCheck);

                if (collisions === 0) {
                    labelBoxes.push(inflated);
                    tf.move(group, ElementPlacement.PLACEATEND);
                    return;
                }

                if (collisions < bestCollision) {
                    bestCollision = collisions;
                    best = {
                        x: candidate.x,
                        y: candidate.y,
                        box: inflated
                    };
                }
            }

            // Hiç temiz yer bulunamazsa en az çakışan yere koy.
            if (best) {
                centerTextFrame(tf, best.x, best.y);
                labelBoxes.push(best.box);
                stats.unresolvedLabels++;
            } else {
                // Çok nadir fallback.
                centerTextFrame(tf, x + radius + labelGap, y + radius + labelGap);
                var fallbackBox = getTextBounds(tf);
                if (fallbackBox) {
                    labelBoxes.push(inflateBox(fallbackBox, 0.15 * MM_TO_PT));
                }
                stats.unresolvedLabels++;
            }

            tf.move(group, ElementPlacement.PLACEATEND);
        }

        var dotBoxes = [];
        var labelBoxes = [];
        var stats = {
            unresolvedLabels: 0
        };

        try {
            // Önce tüm noktaları çiziyoruz.
            // Böylece numaralar yerleşirken bütün nokta kutularını bilir.
            for (var n = 0; n < markers.length; n++) {
                addCircle(markers[n].x, markers[n].y, dotBoxes);
            }

            var number = CFG.startNumber;

            for (var t = 0; t < markers.length; t++) {
                addLabel(
                    markers[t].x,
                    markers[t].y,
                    String(number),
                    dotBoxes,
                    labelBoxes,
                    stats
                );

                number++;
            }
        } catch (e) {
            doc.activeLayer = oldLayer;
            return "ERR:Marker oluştururken hata: " + e;
        }

        doc.activeLayer = oldLayer;

        var msg = markers.length + " nokta işaretlendi.";
        msg += " Kaynak node: " + markerBuild.realNodeCount + ".";

        if (CFG.uniformPathEnabled) {
            msg += " Mod: path boyunca eşit dağıtım.";
            msg += " Çarpan: " + CFG.densifyFactor + "x.";
        } else {
            msg += " Mod: gerçek node.";
        }

        if (stats.unresolvedLabels > 0) {
            msg += " Uyarı: " + stats.unresolvedLabels + " numara en az çakışan yere kondu.";
        }

        if (skippedItems > 0) {
            msg += " Atlanan obje: " + skippedItems + ".";
        }

        return msg;
    }

})();

/*
 * Hızlı notlar:
 * - Ana sürüm budur.
 * - Şablon yapısı korunur: #target + #targetengine + Palette + BridgeTalk.
 * - Gerçek node modu: anchor noktalarını aynen işaretler.
 * - Path boyunca eşit dağıt modu: hedef sayıyı çarpana göre üretir, tüm path uzunluğuna eşit yayar.
 * - Çarpan 2: açık path'te yaklaşık 2x, kapalı path'te tam 2x.
 * - Numara çakışması artık gerçek text visibleBounds ile azaltılır.
 * - Yer bulunamazsa numara en az çakışan aday konuma konur ve sonuç mesajında uyarı verilir.
 * - Eski marker'ları temizlemek sadece checkbox işaretlenirse yapılır.
 * - Çıktılar DOT_PUZZLE_MARKERS layer'ına grup halinde eklenir.
 */
