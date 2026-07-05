#target illustrator
#targetengine "AxyonStickerToolsPanel_v104"

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║     AXYON — ILLUSTRATOR STICKER ARAÇLARI / TEK PANEL       ║
 * ║     Palette işlemlerinin tamamı BridgeTalk içinde çalışır   ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Sürüm: 1.0.4
 *
 * Araçlar:
 *   1. Seçili obje sayma + yerinde çoğaltma
 *   2. Toplu akıllı clipping mask
 *   3. Clipping mask rasterleştirme / PNG
 *   4. Sticker şekil maskeleme v4
 */

(function () {
    var ENGINE_GLOBAL_KEY = "__AXYON_STICKER_TOOLS_PANEL_V104__";
    var MM_TO_PT = 2.834645669291339;
    var PALETTE_TITLE = "Axyon — Illustrator Sticker Araçları v1.0.4";

    try {
        if ($.global[ENGINE_GLOBAL_KEY]) {
            $.global[ENGINE_GLOBAL_KEY].show();
            $.global[ENGINE_GLOBAL_KEY].active = true;
            return;
        }
    } catch (ignoreExistingWindowError) {}

    /* ════════════════════════════════════════════════════════
       BRIDGETALK YARDIMCILARI
    ════════════════════════════════════════════════════════ */

    function jsLiteral(value) {
        if (typeof value === "number") {
            return isFinite(value) ? String(value) : "null";
        }

        if (typeof value === "boolean") {
            return value ? "true" : "false";
        }

        if (value === null || value === undefined) {
            return "null";
        }

        return '"' + String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n") + '"';
    }

    function makeBody(worker, args) {
        var parts = [];
        var i;

        for (i = 0; i < args.length; i++) {
            parts.push(jsLiteral(args[i]));
        }

        return "(" + worker.toString() + ")(" + parts.join(",") + ");";
    }

    function sendWorker(worker, args, onResult, busyText) {
        var bt = new BridgeTalk();
        bt.target = "illustrator";

        setStatus(busyText || "İşleniyor...");
        win.update();

        bt.body = makeBody(worker, args);

        bt.onResult = function (res) {
            var body = String(res.body || "");

            if (onResult) {
                onResult(body);
            }
        };

        bt.onError = function (err) {
            var message = "BridgeTalk hatası: " + String(err.body || err);
            setStatus(message);
            alert(message);
        };

        bt.send();
    }

    function splitResult(body) {
        return String(body).split("|");
    }

    function resultError(parts) {
        return parts.length > 1
            ? parts.slice(1).join("|")
            : "Bilinmeyen hata";
    }

    function parseNumber(text) {
        return Number(
            String(text)
                .replace(",", ".")
                .replace(/^\s+|\s+$/g, "")
        );
    }

    function setStatus(message) {
        txStatus.text = message;
    }

    /* ════════════════════════════════════════════════════════
       BRIDGETALK WORKER — SEÇİM SAY
    ════════════════════════════════════════════════════════ */

    function workerCountSelection() {
        try {
            if (app.documents.length === 0) {
                return "ERR|Açık belge yok.";
            }

            var doc = app.activeDocument;
            var count = doc.selection ? doc.selection.length : 0;

            return "OK|" + count;
        } catch (error) {
            return "ERR|" + String(error);
        }
    }

    /* ════════════════════════════════════════════════════════
       BRIDGETALK WORKER — YERİNDE ÇOĞALT
    ════════════════════════════════════════════════════════ */

    function workerDuplicate(copyCount) {
        try {
            if (app.documents.length === 0) {
                return "ERR|Açık belge yok.";
            }

            var doc = app.activeDocument;
            var sel = doc.selection;

            if (!sel || sel.length === 0) {
                return "ERR|Lütfen önce obje seçin.";
            }

            copyCount = Number(copyCount);

            if (
                isNaN(copyCount) ||
                copyCount < 1 ||
                copyCount !== Math.floor(copyCount)
            ) {
                return "ERR|Kopya sayısı 1 veya daha büyük tam sayı olmalıdır.";
            }

            /* Seçimi snapshotla; duplicate sırasında canlı seçim değişebilir. */
            var snap = [];
            var allItems = [];
            var i;
            var j;

            for (i = 0; i < sel.length; i++) {
                snap.push(sel[i]);
                allItems.push(sel[i]);
            }

            var beforeCount = snap.length;
            var createdCount = 0;

            for (i = 0; i < copyCount; i++) {
                for (j = 0; j < snap.length; j++) {
                    var duplicateItem = snap[j].duplicate();
                    allItems.push(duplicateItem);
                    createdCount++;
                }
            }

            /* İşlem sonrasında orijinaller ve tüm kopyalar seçili bırakılır. */
            doc.selection = null;

            for (i = 0; i < allItems.length; i++) {
                try {
                    allItems[i].selected = true;
                } catch (ignoreSelectionError) {}
            }

            app.redraw();

            var afterCount = doc.selection ? doc.selection.length : allItems.length;

            return (
                "OK|" +
                beforeCount + "|" +
                copyCount + "|" +
                createdCount + "|" +
                afterCount
            );
        } catch (error) {
            return "ERR|" + String(error);
        }
    }

    /* ════════════════════════════════════════════════════════
       BRIDGETALK WORKER — TOPLU AKILLI MASKE
    ════════════════════════════════════════════════════════ */

    function workerSmartMask() {
        function cleanError(error) {
            return String(error)
                .replace(/\|/g, "/")
                .replace(/[\r\n]+/g, " ");
        }

        function uniqueList(values) {
            var result = [];
            var seen = {};
            var i;

            for (i = 0; i < values.length; i++) {
                if (!seen[values[i]]) {
                    seen[values[i]] = true;
                    result.push(values[i]);
                }
            }

            return result;
        }

        function boundsCenter(bounds) {
            return [
                (bounds[0] + bounds[2]) / 2,
                (bounds[1] + bounds[3]) / 2
            ];
        }

        function boundsArea(bounds) {
            var width = Math.max(0, bounds[2] - bounds[0]);
            var height = Math.max(0, bounds[1] - bounds[3]);
            return width * height;
        }

        function overlapArea(boundsA, boundsB) {
            var left = Math.max(boundsA[0], boundsB[0]);
            var right = Math.min(boundsA[2], boundsB[2]);
            var top = Math.min(boundsA[1], boundsB[1]);
            var bottom = Math.max(boundsA[3], boundsB[3]);

            var width = Math.max(0, right - left);
            var height = Math.max(0, top - bottom);

            return width * height;
        }

        function squaredDistance(pointA, pointB) {
            var dx = pointA[0] - pointB[0];
            var dy = pointA[1] - pointB[1];

            return (dx * dx) + (dy * dy);
        }

        function sortTopToBottomLeftToRight(a, b) {
            var boundsA = a.geometricBounds;
            var boundsB = b.geometricBounds;

            if (Math.abs(boundsA[1] - boundsB[1]) > 0.01) {
                return boundsB[1] - boundsA[1];
            }

            return boundsA[0] - boundsB[0];
        }

        function findBestImageIndex(maskItem, imageItems) {
            var maskBounds = maskItem.geometricBounds;
            var maskArea = boundsArea(maskBounds);
            var maskCenter = boundsCenter(maskBounds);

            var bestIndex = -1;
            var bestOverlapRatio = -1;
            var bestDistance = Number.MAX_VALUE;
            var i;

            for (i = 0; i < imageItems.length; i++) {
                var imageBounds = imageItems[i].geometricBounds;
                var overlap = overlapArea(maskBounds, imageBounds);
                var overlapRatio = maskArea > 0 ? overlap / maskArea : 0;
                var imageCenter = boundsCenter(imageBounds);
                var distance = squaredDistance(maskCenter, imageCenter);

                if (
                    overlapRatio > bestOverlapRatio + 0.000001 ||
                    (
                        Math.abs(overlapRatio - bestOverlapRatio) <= 0.000001 &&
                        distance < bestDistance
                    )
                ) {
                    bestIndex = i;
                    bestOverlapRatio = overlapRatio;
                    bestDistance = distance;
                }
            }

            return bestIndex;
        }

        try {
            if (app.documents.length === 0) {
                return "ERR|Açık belge yok.";
            }

            var doc = app.activeDocument;
            var selection = doc.selection;

            if (!selection || selection.length === 0) {
                return "ERR|Maske objelerini ve görselleri birlikte seçin.";
            }

            var selectedItems = [];
            var masks = [];
            var images = [];
            var unsupported = [];
            var pairs = [];
            var createdGroups = [];
            var i;

            for (i = 0; i < selection.length; i++) {
                selectedItems.push(selection[i]);
            }

            for (i = 0; i < selectedItems.length; i++) {
                var item = selectedItems[i];

                if (
                    item.typename === "PlacedItem" ||
                    item.typename === "RasterItem"
                ) {
                    images.push(item);
                } else if (
                    item.typename === "PathItem" ||
                    item.typename === "CompoundPathItem"
                ) {
                    masks.push(item);
                } else {
                    unsupported.push(item.typename);
                }
            }

            if (unsupported.length > 0) {
                return (
                    "ERR|Desteklenmeyen obje türü: " +
                    uniqueList(unsupported).join(", ") +
                    ". Maskeler Path veya Compound Path olmalıdır."
                );
            }

            if (masks.length === 0 || images.length === 0) {
                return (
                    "ERR|Yeterli maske veya görsel yok. Maske: " +
                    masks.length +
                    ", görsel: " +
                    images.length
                );
            }

            if (masks.length !== images.length) {
                return (
                    "ERR|Maske ve görsel sayıları eşit değil. Maske: " +
                    masks.length +
                    ", görsel: " +
                    images.length
                );
            }

            masks.sort(sortTopToBottomLeftToRight);

            var availableImages = images.slice(0);

            for (i = 0; i < masks.length; i++) {
                var bestIndex = findBestImageIndex(masks[i], availableImages);

                if (bestIndex < 0) {
                    return "ERR|Bir maske için uygun görsel bulunamadı.";
                }

                pairs.push({
                    mask: masks[i],
                    image: availableImages[bestIndex]
                });

                availableImages.splice(bestIndex, 1);
            }

            var completed = 0;

            for (i = 0; i < pairs.length; i++) {
                var mask = pairs[i].mask;
                var image = pairs[i].image;

                try {
                    doc.selection = null;

                    mask.move(image, ElementPlacement.PLACEBEFORE);

                    image.selected = true;
                    mask.selected = true;

                    app.executeMenuCommand("makeMask");

                    if (doc.selection && doc.selection.length > 0) {
                        createdGroups.push(doc.selection[0]);
                    }

                    completed++;
                } catch (pairError) {
                    return (
                        "ERR|Maskeleme " +
                        (i + 1) +
                        ". çiftte durdu. Tamamlanan: " +
                        completed +
                        ". Hata: " +
                        cleanError(pairError)
                    );
                }
            }

            doc.selection = null;

            for (i = 0; i < createdGroups.length; i++) {
                try {
                    createdGroups[i].selected = true;
                } catch (ignoreSelectionError) {}
            }

            app.redraw();

            return (
                "OK|" +
                masks.length + "|" +
                images.length + "|" +
                completed
            );
        } catch (error) {
            return "ERR|" + cleanError(error);
        }
    }

    /* ════════════════════════════════════════════════════════
       BRIDGETALK WORKER — RASTERLEŞTİR
    ════════════════════════════════════════════════════════ */

    function workerRasterize(
        scope,
        mode,
        dpi,
        transparent,
        exportPNG,
        outputFolderPath
    ) {
        function cleanText(value) {
            return String(value)
                .replace(/\|/g, "/")
                .replace(/[\r\n]+/g, " ");
        }

        function addUniqueItem(list, item) {
            if (!containsItem(list, item)) {
                list.push(item);
            }
        }

        function containsItem(list, item) {
            var i;

            for (i = 0; i < list.length; i++) {
                if (list[i] === item) {
                    return true;
                }
            }

            return false;
        }

        function copyBounds(bounds) {
            return [
                Number(bounds[0]),
                Number(bounds[1]),
                Number(bounds[2]),
                Number(bounds[3])
            ];
        }

        function isValidBounds(bounds) {
            return (
                bounds &&
                bounds.length === 4 &&
                isFinite(bounds[0]) &&
                isFinite(bounds[1]) &&
                isFinite(bounds[2]) &&
                isFinite(bounds[3]) &&
                bounds[2] > bounds[0] &&
                bounds[1] > bounds[3]
            );
        }

        function safeRemove(item) {
            if (!item) {
                return;
            }

            try {
                item.remove();
            } catch (ignoreRemoveError) {}
        }

        function padNumber(value, length) {
            var text = String(value);

            while (text.length < length) {
                text = "0" + text;
            }

            return text;
        }

        function sanitizeFileName(value) {
            /*
              BridgeTalk body içinde regex literal kullanmıyoruz.
              Bazı Illustrator / ExtendScript sürümleri
              /[\\\/:*?"<>|]/ ifadesini yanlış parse edebiliyor.
            */
            var sourceText = String(value);
            var cleaned = "";
            var i;

            for (i = 0; i < sourceText.length; i++) {
                var character = sourceText.charAt(i);
                var code = sourceText.charCodeAt(i);

                if (
                    code === 92  || /* backslash */
                    code === 47  || /* slash */
                    code === 58  || /* colon */
                    code === 42  || /* asterisk */
                    code === 63  || /* question mark */
                    code === 34  || /* double quote */
                    code === 60  || /* less than */
                    code === 62  || /* greater than */
                    code === 124    /* vertical bar */
                ) {
                    cleaned += "_";
                } else {
                    cleaned += character;
                }
            }

            while (
                cleaned.length > 0 &&
                (
                    cleaned.charAt(0) === " " ||
                    cleaned.charAt(0) === "\t"
                )
            ) {
                cleaned = cleaned.substring(1);
            }

            while (
                cleaned.length > 0 &&
                (
                    cleaned.charAt(cleaned.length - 1) === " " ||
                    cleaned.charAt(cleaned.length - 1) === "\t" ||
                    cleaned.charAt(cleaned.length - 1) === "."
                )
            ) {
                cleaned = cleaned.substring(0, cleaned.length - 1);
            }

            return cleaned;
        }

        function compoundPathIsClipping(compoundPath) {
            var i;

            try {
                for (i = 0; i < compoundPath.pathItems.length; i++) {
                    if (compoundPath.pathItems[i].clipping) {
                        return true;
                    }
                }
            } catch (ignoreCompoundError) {}

            return false;
        }

        function findDirectClippingItem(groupItem) {
            var i;

            for (i = 0; i < groupItem.pageItems.length; i++) {
                var item = groupItem.pageItems[i];

                try {
                    if (item.parent !== groupItem) {
                        continue;
                    }

                    if (
                        item.typename === "PathItem" &&
                        item.clipping
                    ) {
                        return item;
                    }

                    if (
                        item.typename === "CompoundPathItem" &&
                        compoundPathIsClipping(item)
                    ) {
                        return item;
                    }
                } catch (ignoreItemError) {}
            }

            return null;
        }

        function findNearestClippedAncestor(item) {
            var current = item;

            while (current) {
                try {
                    if (
                        current.typename === "GroupItem" &&
                        current.clipped
                    ) {
                        return current;
                    }

                    current = current.parent;

                    if (
                        !current ||
                        current.typename === "Document" ||
                        current.typename === "Application"
                    ) {
                        break;
                    }
                } catch (error) {
                    break;
                }
            }

            return null;
        }

        function collectAllClippingGroups(doc) {
            var list = [];
            var i;

            for (i = 0; i < doc.groupItems.length; i++) {
                var group = doc.groupItems[i];

                try {
                    if (group.clipped) {
                        addUniqueItem(list, group);
                    }
                } catch (ignoreGroupError) {}
            }

            return list;
        }

        function collectFromSelectedItem(item, list) {
            if (!item) {
                return;
            }

            var clippedAncestor = findNearestClippedAncestor(item);

            if (clippedAncestor) {
                addUniqueItem(list, clippedAncestor);
                return;
            }

            try {
                if (item.typename === "GroupItem") {
                    if (item.clipped) {
                        addUniqueItem(list, item);
                        return;
                    }

                    var i;

                    for (i = 0; i < item.groupItems.length; i++) {
                        collectFromSelectedItem(item.groupItems[i], list);
                    }
                }
            } catch (ignoreSelectedItemError) {}
        }

        function collectSelectedClippingGroups(selection) {
            var list = [];
            var i;

            if (!selection) {
                return list;
            }

            for (i = 0; i < selection.length; i++) {
                collectFromSelectedItem(selection[i], list);
            }

            return list;
        }

        function hasTargetAncestor(item, targets) {
            var current;

            try {
                current = item.parent;
            } catch (error) {
                return false;
            }

            while (current) {
                if (containsItem(targets, current)) {
                    return true;
                }

                try {
                    current = current.parent;

                    if (
                        !current ||
                        current.typename === "Document" ||
                        current.typename === "Application"
                    ) {
                        break;
                    }
                } catch (parentError) {
                    break;
                }
            }

            return false;
        }

        function filterOutNestedTargets(items) {
            var filtered = [];
            var i;

            for (i = 0; i < items.length; i++) {
                if (!hasTargetAncestor(items[i], items)) {
                    addUniqueItem(filtered, items[i]);
                }
            }

            return filtered;
        }

        function isEditableItem(item) {
            var current = item;

            while (current) {
                try {
                    if (current.typename === "Layer") {
                        if (current.locked || !current.visible) {
                            return false;
                        }
                    } else if (
                        current.typename !== "Document" &&
                        current.typename !== "Application"
                    ) {
                        if (current.locked || current.hidden) {
                            return false;
                        }
                    }

                    current = current.parent;

                    if (
                        !current ||
                        current.typename === "Document" ||
                        current.typename === "Application"
                    ) {
                        break;
                    }
                } catch (error) {
                    break;
                }
            }

            try {
                return item.editable;
            } catch (ignoreEditableError) {
                return true;
            }
        }

        function getDirectContentItems(groupItem, clippingItem) {
            var content = [];
            var i;

            for (i = 0; i < groupItem.pageItems.length; i++) {
                var item = groupItem.pageItems[i];

                try {
                    if (
                        item.parent === groupItem &&
                        item !== clippingItem
                    ) {
                        content.push(item);
                    }
                } catch (ignoreContentError) {}
            }

            return content;
        }

        function createRasterOptions(settings, includeLayers) {
            var options = new RasterizeOptions();

            options.resolution = settings.dpi;
            options.transparency = settings.transparent;
            options.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
            options.clippingMask = false;
            options.convertSpotColors = true;
            options.convertTextToOutlines = false;
            options.includeLayers = includeLayers;
            options.padding = 0;

            return options;
        }

        function rasterizeContentKeepMask(
            doc,
            clippingGroup,
            clippingItem,
            bounds,
            settings
        ) {
            var originalContent = getDirectContentItems(
                clippingGroup,
                clippingItem
            );

            if (originalContent.length === 0) {
                throw new Error(
                    "Maskenin içinde rasterleştirilecek içerik yok."
                );
            }

            var temporaryGroup = doc.groupItems.add();
            var i;

            for (i = originalContent.length - 1; i >= 0; i--) {
                originalContent[i].duplicate(
                    temporaryGroup,
                    ElementPlacement.PLACEATBEGINNING
                );
            }

            var rasterOptions = createRasterOptions(settings, false);
            var rasterItem;

            try {
                rasterItem = doc.rasterize(
                    temporaryGroup,
                    bounds,
                    rasterOptions
                );
            } catch (rasterError) {
                safeRemove(temporaryGroup);
                throw rasterError;
            }

            if (!rasterItem) {
                throw new Error("İçerik rasteri oluşturulamadı.");
            }

            rasterItem.move(
                clippingItem,
                ElementPlacement.PLACEAFTER
            );

            for (i = 0; i < originalContent.length; i++) {
                safeRemove(originalContent[i]);
            }

            try {
                clippingGroup.clipped = true;
            } catch (ignoreClippedStateError) {}

            return clippingGroup;
        }

        function rasterizeWholeClippingGroup(
            doc,
            clippingGroup,
            bounds,
            settings
        ) {
            var duplicateGroup = clippingGroup.duplicate();
            var rasterOptions = createRasterOptions(settings, true);
            var rasterItem;

            try {
                rasterItem = doc.rasterize(
                    duplicateGroup,
                    bounds,
                    rasterOptions
                );
            } catch (rasterError) {
                safeRemove(duplicateGroup);
                throw rasterError;
            }

            if (!rasterItem) {
                throw new Error("Clipping grubu rasterleştirilemedi.");
            }

            try {
                rasterItem.move(
                    clippingGroup,
                    ElementPlacement.PLACEAFTER
                );
            } catch (ignoreMoveError) {}

            safeRemove(clippingGroup);

            return rasterItem;
        }

        function getUniquePNGFile(folder, baseName) {
            var candidate = new File(
                folder.fsName + "/" + baseName + ".png"
            );

            if (!candidate.exists) {
                return candidate;
            }

            var counter = 2;

            while (true) {
                candidate = new File(
                    folder.fsName +
                    "/" +
                    baseName +
                    "_" +
                    padNumber(counter, 2) +
                    ".png"
                );

                if (!candidate.exists) {
                    return candidate;
                }

                counter++;
            }
        }

        function exportItemAsPNG(
            sourceItem,
            sourceBounds,
            folder,
            baseName,
            settings,
            fallbackIndex
        ) {
            var width = sourceBounds[2] - sourceBounds[0];
            var height = sourceBounds[1] - sourceBounds[3];

            if (width <= 0 || height <= 0) {
                throw new Error("PNG için geçersiz ölçü.");
            }

            var tempDocument;

            try {
                tempDocument = app.documents.add(
                    DocumentColorSpace.RGB,
                    width,
                    height
                );
            } catch (addDocumentError) {
                tempDocument = app.documents.add(
                    DocumentColorSpace.RGB
                );
            }

            try {
                var copiedItem = sourceItem.duplicate(
                    tempDocument.activeLayer,
                    ElementPlacement.PLACEATBEGINNING
                );

                var copiedBounds = copyBounds(
                    copiedItem.geometricBounds
                );

                copiedItem.translate(
                    -copiedBounds[0],
                    -copiedBounds[3]
                );

                var captureBounds = [0, height, width, 0];

                try {
                    tempDocument.artboards[0].artboardRect = captureBounds;
                } catch (ignoreArtboardError) {}

                var captureOptions = new ImageCaptureOptions();
                captureOptions.resolution = settings.dpi;
                captureOptions.antiAliasing = true;
                captureOptions.transparency = settings.transparent;
                captureOptions.matte = !settings.transparent;

                if (!settings.transparent) {
                    var white = new RGBColor();
                    white.red = 255;
                    white.green = 255;
                    white.blue = 255;
                    captureOptions.matteColor = white;
                }

                var safeBaseName = sanitizeFileName(baseName);

                if (!safeBaseName) {
                    safeBaseName =
                        "Clipping_" +
                        padNumber(fallbackIndex, 3);
                }

                var destination = getUniquePNGFile(
                    folder,
                    safeBaseName
                );

                tempDocument.imageCapture(
                    destination,
                    captureBounds,
                    captureOptions
                );
            } finally {
                try {
                    tempDocument.close(
                        SaveOptions.DONOTSAVECHANGES
                    );
                } catch (ignoreCloseError) {}
            }
        }

        function getUsefulName(item, fallbackIndex) {
            var name = "";

            try {
                name = String(item.name || "");
            } catch (ignoreNameError) {}

            name = sanitizeFileName(name);

            if (!name) {
                name =
                    "Clipping_" +
                    padNumber(fallbackIndex, 3);
            }

            return name;
        }

        try {
            if (app.documents.length === 0) {
                return "ERR|Açık belge yok.";
            }

            dpi = Number(dpi);

            if (
                isNaN(dpi) ||
                dpi < 72 ||
                dpi > 2400
            ) {
                return "ERR|DPI değeri 72 ile 2400 arasında olmalıdır.";
            }

            var settings = {
                scope: scope,
                mode: mode,
                dpi: dpi,
                transparent: Boolean(transparent),
                exportPNG: Boolean(exportPNG)
            };

            var doc = app.activeDocument;

            var targets =
                settings.scope === "selected"
                    ? collectSelectedClippingGroups(doc.selection)
                    : collectAllClippingGroups(doc);

            targets = filterOutNestedTargets(targets);

            if (targets.length === 0) {
                return (
                    settings.scope === "selected"
                        ? "ERR|Seçimde clipping mask grubu bulunamadı."
                        : "ERR|Belgede clipping mask grubu bulunamadı."
                );
            }

            var outputFolder = null;

            if (settings.exportPNG) {
                outputFolder = new Folder(outputFolderPath);

                if (!outputFolder.exists) {
                    return "ERR|PNG klasörü bulunamadı.";
                }
            }

            var editableTargets = [];
            var skippedLocked = 0;
            var i;

            for (i = 0; i < targets.length; i++) {
                if (isEditableItem(targets[i])) {
                    editableTargets.push(targets[i]);
                } else {
                    skippedLocked++;
                }
            }

            if (editableTargets.length === 0) {
                return "ERR|Tüm clipping grupları kilitli veya gizli.";
            }

            var completed = 0;
            var failed = 0;
            var exported = 0;
            var exportFailed = 0;
            var results = [];
            var errors = [];

            doc.selection = null;

            for (i = 0; i < editableTargets.length; i++) {
                var group = editableTargets[i];

                try {
                    var clipItem = findDirectClippingItem(group);

                    if (!clipItem) {
                        failed++;
                        errors.push(
                            (i + 1) +
                            ". obje: Clipping path bulunamadı."
                        );
                        continue;
                    }

                    var clipBounds =
                        settings.mode === "content"
                            ? copyBounds(clipItem.geometricBounds)
                            : copyBounds(clipItem.visibleBounds);

                    if (!isValidBounds(clipBounds)) {
                        failed++;
                        errors.push(
                            (i + 1) +
                            ". obje: Geçersiz ölçü."
                        );
                        continue;
                    }

                    var sourceName = getUsefulName(group, i + 1);
                    var resultItem;

                    if (settings.mode === "content") {
                        resultItem = rasterizeContentKeepMask(
                            doc,
                            group,
                            clipItem,
                            clipBounds,
                            settings
                        );
                    } else {
                        resultItem = rasterizeWholeClippingGroup(
                            doc,
                            group,
                            clipBounds,
                            settings
                        );
                    }

                    if (!resultItem) {
                        throw new Error(
                            "Raster sonucu oluşturulamadı."
                        );
                    }

                    try {
                        resultItem.name = sourceName + "_Raster";
                    } catch (ignoreNameError) {}

                    results.push(resultItem);
                    completed++;

                    if (settings.exportPNG) {
                        try {
                            exportItemAsPNG(
                                resultItem,
                                clipBounds,
                                outputFolder,
                                sourceName,
                                settings,
                                i + 1
                            );
                            exported++;
                        } catch (exportError) {
                            exportFailed++;
                            errors.push(
                                (i + 1) +
                                ". obje PNG: " +
                                cleanText(exportError)
                            );
                        }
                    }
                } catch (itemError) {
                    failed++;
                    errors.push(
                        (i + 1) +
                        ". obje: " +
                        cleanText(itemError)
                    );
                }
            }

            doc.selection = null;

            for (i = 0; i < results.length; i++) {
                try {
                    results[i].selected = true;
                } catch (ignoreSelectionError) {}
            }

            app.redraw();

            return (
                "OK|" +
                completed + "|" +
                failed + "|" +
                exported + "|" +
                exportFailed + "|" +
                skippedLocked + "|" +
                cleanText(errors.slice(0, 5).join(" ~ "))
            );
        } catch (error) {
            return "ERR|" + cleanText(error);
        }
    }

    /* ════════════════════════════════════════════════════════
       BRIDGETALK WORKER — STICKER ŞEKİL MASKELEME v4
    ════════════════════════════════════════════════════════ */

    function workerStickerMask(
        scope,
        shape,
        widthMM,
        heightMM,
        radiusMM,
        fitMode,
        keepOriginal
    ) {
        var MM_TO_PT_LOCAL = 2.834645669291339;

        function cleanText(value) {
            return String(value)
                .replace(/\|/g, "/")
                .replace(/[\r\n]+/g, " ");
        }

        function mmToPoints(value) {
            return Number(value) * MM_TO_PT_LOCAL;
        }

        function addUniqueItem(list, item) {
            if (!containsItem(list, item)) {
                list.push(item);
            }
        }

        function containsItem(list, item) {
            var i;

            for (i = 0; i < list.length; i++) {
                if (list[i] === item) {
                    return true;
                }
            }

            return false;
        }

        function copyBounds(bounds) {
            return [
                Number(bounds[0]),
                Number(bounds[1]),
                Number(bounds[2]),
                Number(bounds[3])
            ];
        }

        function boundsCenter(bounds) {
            return [
                (bounds[0] + bounds[2]) / 2,
                (bounds[1] + bounds[3]) / 2
            ];
        }

        function isValidBounds(bounds) {
            return (
                bounds &&
                bounds.length === 4 &&
                isFinite(bounds[0]) &&
                isFinite(bounds[1]) &&
                isFinite(bounds[2]) &&
                isFinite(bounds[3]) &&
                bounds[2] > bounds[0] &&
                bounds[1] > bounds[3]
            );
        }

        function safeRemove(item) {
            if (!item) {
                return;
            }

            try {
                item.remove();
            } catch (ignoreRemoveError) {}
        }

        function padNumber(value, length) {
            var text = String(value);

            while (text.length < length) {
                text = "0" + text;
            }

            return text;
        }

        function formatNumber(value) {
            var rounded = Math.round(Number(value) * 100) / 100;
            return String(rounded).replace(".", "_");
        }

        function compoundPathIsClipping(compoundPath) {
            var i;

            try {
                for (i = 0; i < compoundPath.pathItems.length; i++) {
                    if (compoundPath.pathItems[i].clipping) {
                        return true;
                    }
                }
            } catch (ignoreCompoundError) {}

            return false;
        }

        function findDirectClippingItem(groupItem) {
            var i;

            for (i = 0; i < groupItem.pageItems.length; i++) {
                var item = groupItem.pageItems[i];

                try {
                    if (item.parent !== groupItem) {
                        continue;
                    }

                    if (
                        item.typename === "PathItem" &&
                        item.clipping
                    ) {
                        return item;
                    }

                    if (
                        item.typename === "CompoundPathItem" &&
                        compoundPathIsClipping(item)
                    ) {
                        return item;
                    }
                } catch (ignoreItemError) {}
            }

            return null;
        }

        /*
          Şablondaki gerçek görünür alan kuralı:
          clipped GroupItem için taşan içerik değil clipping path ölçüsü alınır.
        */
        function getTrueVisualBounds(item) {
            if (item.typename === "GroupItem") {
                if (item.clipped) {
                    var clippingItem = findDirectClippingItem(item);

                    if (clippingItem) {
                        return clippingItem.geometricBounds;
                    }

                    return item.visibleBounds;
                }

                var combined = null;
                var i;

                for (i = 0; i < item.pageItems.length; i++) {
                    var childBounds = getTrueVisualBounds(
                        item.pageItems[i]
                    );

                    if (childBounds) {
                        if (!combined) {
                            combined = [
                                childBounds[0],
                                childBounds[1],
                                childBounds[2],
                                childBounds[3]
                            ];
                        } else {
                            combined[0] = Math.min(
                                combined[0],
                                childBounds[0]
                            );
                            combined[1] = Math.max(
                                combined[1],
                                childBounds[1]
                            );
                            combined[2] = Math.max(
                                combined[2],
                                childBounds[2]
                            );
                            combined[3] = Math.min(
                                combined[3],
                                childBounds[3]
                            );
                        }
                    }
                }

                return combined || item.visibleBounds;
            }

            return item.visibleBounds;
        }

        function findNearestClippedAncestor(item) {
            var current = item;

            while (current) {
                try {
                    if (
                        current.typename === "GroupItem" &&
                        current.clipped
                    ) {
                        return current;
                    }

                    if (
                        current.typename === "Layer" ||
                        current.typename === "Document" ||
                        current.typename === "Application"
                    ) {
                        break;
                    }

                    current = current.parent;
                } catch (error) {
                    break;
                }
            }

            return null;
        }

        function isSelectableArtItem(item) {
            if (!item) {
                return false;
            }

            try {
                if (
                    item.typename === "PathItem" &&
                    item.guides
                ) {
                    return false;
                }

                return (
                    item.typename !== "Layer" &&
                    item.typename !== "Document" &&
                    item.typename !== "Application"
                );
            } catch (error) {
                return false;
            }
        }

        function collectSelectedTargets(selection) {
            var result = [];
            var i;

            if (!selection) {
                return result;
            }

            for (i = 0; i < selection.length; i++) {
                var item = selection[i];
                var clippedAncestor = findNearestClippedAncestor(item);

                if (clippedAncestor) {
                    addUniqueItem(result, clippedAncestor);
                } else if (isSelectableArtItem(item)) {
                    addUniqueItem(result, item);
                }
            }

            return result;
        }

        function collectAllRasterAndClippingTargets(doc) {
            var result = [];
            var i;

            for (i = 0; i < doc.pageItems.length; i++) {
                var item = doc.pageItems[i];

                try {
                    if (item.parent.typename !== "Layer") {
                        continue;
                    }

                    if (
                        item.typename === "RasterItem" ||
                        item.typename === "PlacedItem" ||
                        (
                            item.typename === "GroupItem" &&
                            item.clipped
                        )
                    ) {
                        addUniqueItem(result, item);
                    }
                } catch (ignoreItemError) {}
            }

            return result;
        }

        function hasAncestorInList(item, items) {
            var current;

            try {
                current = item.parent;
            } catch (error) {
                return false;
            }

            while (current) {
                if (containsItem(items, current)) {
                    return true;
                }

                try {
                    if (
                        current.typename === "Layer" ||
                        current.typename === "Document" ||
                        current.typename === "Application"
                    ) {
                        break;
                    }

                    current = current.parent;
                } catch (parentError) {
                    break;
                }
            }

            return false;
        }

        function filterNestedTargets(items) {
            var result = [];
            var i;

            for (i = 0; i < items.length; i++) {
                if (!hasAncestorInList(items[i], items)) {
                    addUniqueItem(result, items[i]);
                }
            }

            return result;
        }

        function isEditableItem(item) {
            var current = item;

            while (current) {
                try {
                    if (current.typename === "Layer") {
                        if (current.locked || !current.visible) {
                            return false;
                        }
                        break;
                    }

                    if (current.locked || current.hidden) {
                        return false;
                    }

                    current = current.parent;
                } catch (error) {
                    break;
                }
            }

            try {
                return item.editable;
            } catch (ignoreEditableError) {
                return true;
            }
        }

        function fitItemToMask(
            item,
            targetCenter,
            targetWidth,
            targetHeight,
            targetFitMode,
            targetShape,
            targetRadius
        ) {
            var sourceBounds = copyBounds(
                getTrueVisualBounds(item)
            );

            if (!isValidBounds(sourceBounds)) {
                throw new Error(
                    "Görselin mevcut ölçüsü okunamadı."
                );
            }

            var sourceWidth =
                sourceBounds[2] - sourceBounds[0];

            var sourceHeight =
                sourceBounds[1] - sourceBounds[3];

            if (
                sourceWidth <= 0 ||
                sourceHeight <= 0
            ) {
                throw new Error(
                    "Görselin genişliği veya yüksekliği sıfır."
                );
            }

            var scaleX = 100;
            var scaleY = 100;

            if (targetFitMode === "cover") {
                var coverScale = Math.max(
                    targetWidth / sourceWidth,
                    targetHeight / sourceHeight
                ) * 100;

                scaleX = coverScale;
                scaleY = coverScale;
            } else if (targetFitMode === "contain") {
                var containRatio = getShapeContainRatio(
                    sourceWidth,
                    sourceHeight,
                    targetWidth,
                    targetHeight,
                    targetShape,
                    targetRadius
                );

                scaleX = containRatio * 100;
                scaleY = containRatio * 100;
            } else if (targetFitMode === "stretch") {
                scaleX =
                    (targetWidth / sourceWidth) * 100;

                scaleY =
                    (targetHeight / sourceHeight) * 100;
            }

            if (targetFitMode !== "center") {
                item.resize(
                    scaleX,
                    scaleY,
                    true,
                    true,
                    true,
                    true,
                    Math.min(scaleX, scaleY),
                    Transformation.CENTER
                );
            }

            var resizedBounds = copyBounds(
                getTrueVisualBounds(item)
            );

            if (!isValidBounds(resizedBounds)) {
                throw new Error(
                    "Ölçekleme sonrası ölçü okunamadı."
                );
            }

            var resizedCenter = boundsCenter(resizedBounds);

            item.translate(
                targetCenter[0] - resizedCenter[0],
                targetCenter[1] - resizedCenter[1]
            );
        }

        function getShapeContainRatio(
            sourceWidth,
            sourceHeight,
            targetWidth,
            targetHeight,
            targetShape,
            targetRadius
        ) {
            /*
              v4:
              Her obje için gerçek şekil sınırıyla kesişme kalmayana kadar
              ayrı maksimum güvenli ölçek hesaplanır.
              Toplam 1 mm güvenlik payı bırakılır.
            */
            var safetyPT = mmToPoints(1);

            var safeWidth = Math.max(
                0.01,
                targetWidth - safetyPT
            );

            var safeHeight = Math.max(
                0.01,
                targetHeight - safetyPT
            );

            if (
                targetShape === "square" ||
                targetShape === "rectangle"
            ) {
                return Math.min(
                    safeWidth / sourceWidth,
                    safeHeight / sourceHeight
                );
            }

            if (targetShape === "circle") {
                var ellipseTerm =
                    Math.pow(
                        sourceWidth / safeWidth,
                        2
                    ) +
                    Math.pow(
                        sourceHeight / safeHeight,
                        2
                    );

                if (ellipseTerm <= 0) {
                    return 1;
                }

                return 1 / Math.sqrt(ellipseTerm);
            }

            if (targetShape === "roundedRectangle") {
                var safeRadius = Math.max(
                    0,
                    targetRadius - (safetyPT / 2)
                );

                return getRoundedRectangleSafeRatio(
                    sourceWidth,
                    sourceHeight,
                    safeWidth,
                    safeHeight,
                    safeRadius
                );
            }

            return Math.min(
                safeWidth / sourceWidth,
                safeHeight / sourceHeight
            );
        }

        function getRoundedRectangleSafeRatio(
            sourceWidth,
            sourceHeight,
            targetWidth,
            targetHeight,
            radius
        ) {
            var maxBoxRatio = Math.min(
                targetWidth / sourceWidth,
                targetHeight / sourceHeight
            );

            if (radius <= 0) {
                return maxBoxRatio;
            }

            var halfWidth = targetWidth / 2;
            var halfHeight = targetHeight / 2;
            var safeRadius = Math.min(
                radius,
                halfWidth,
                halfHeight
            );

            var low = 0;
            var high = maxBoxRatio;
            var iteration;

            for (iteration = 0; iteration < 50; iteration++) {
                var middle = (low + high) / 2;

                var cornerX =
                    (sourceWidth * middle) / 2;

                var cornerY =
                    (sourceHeight * middle) / 2;

                if (
                    pointInsideRoundedRectangle(
                        cornerX,
                        cornerY,
                        halfWidth,
                        halfHeight,
                        safeRadius
                    )
                ) {
                    low = middle;
                } else {
                    high = middle;
                }
            }

            return low;
        }

        function pointInsideRoundedRectangle(
            x,
            y,
            halfWidth,
            halfHeight,
            radius
        ) {
            if (x > halfWidth || y > halfHeight) {
                return false;
            }

            var innerX = halfWidth - radius;
            var innerY = halfHeight - radius;

            if (x <= innerX || y <= innerY) {
                return true;
            }

            var dx = x - innerX;
            var dy = y - innerY;

            return (
                (dx * dx) +
                (dy * dy)
            ) <= (radius * radius);
        }

        function createMaskShape(
            doc,
            targetShape,
            center,
            targetWidth,
            targetHeight,
            targetRadius
        ) {
            var left = center[0] - (targetWidth / 2);
            var top = center[1] + (targetHeight / 2);
            var path;

            if (targetShape === "circle") {
                path = doc.pathItems.ellipse(
                    top,
                    left,
                    targetWidth,
                    targetWidth,
                    false,
                    true
                );
            } else if (targetShape === "square") {
                path = doc.pathItems.rectangle(
                    top,
                    left,
                    targetWidth,
                    targetWidth,
                    false
                );
            } else if (targetShape === "roundedRectangle") {
                path = doc.pathItems.roundedRectangle(
                    top,
                    left,
                    targetWidth,
                    targetHeight,
                    targetRadius,
                    targetRadius,
                    false
                );
            } else {
                path = doc.pathItems.rectangle(
                    top,
                    left,
                    targetWidth,
                    targetHeight,
                    false
                );
            }

            path.stroked = false;
            path.filled = true;

            try {
                var white = new RGBColor();
                white.red = 255;
                white.green = 255;
                white.blue = 255;
                path.fillColor = white;
            } catch (ignoreColorError) {}

            return path;
        }

        function findCreatedClippingGroup(selection, mask) {
            var i;

            if (selection && selection.length > 0) {
                for (i = 0; i < selection.length; i++) {
                    try {
                        if (
                            selection[i].typename === "GroupItem" &&
                            selection[i].clipped
                        ) {
                            return selection[i];
                        }
                    } catch (ignoreSelectionError) {}
                }
            }

            try {
                var current = mask.parent;

                while (current) {
                    if (
                        current.typename === "GroupItem" &&
                        current.clipped
                    ) {
                        return current;
                    }

                    if (
                        current.typename === "Layer" ||
                        current.typename === "Document" ||
                        current.typename === "Application"
                    ) {
                        break;
                    }

                    current = current.parent;
                }
            } catch (ignoreParentError) {}

            return null;
        }

        function getItemName(item, fallbackIndex) {
            var name = "";

            try {
                name = String(item.name || "");
            } catch (ignoreNameError) {}

            name = name.replace(/^\s+|\s+$/g, "");

            if (!name) {
                name =
                    "Sticker_" +
                    padNumber(fallbackIndex, 3);
            }

            return name;
        }

        function getShapeShortName(targetShape) {
            if (targetShape === "circle") {
                return "Daire";
            }

            if (targetShape === "square") {
                return "Kare";
            }

            if (targetShape === "roundedRectangle") {
                return "YuvarlakDikdortgen";
            }

            return "Dikdortgen";
        }

        try {
            if (app.documents.length === 0) {
                return "ERR|Açık belge yok.";
            }

            widthMM = Number(widthMM);
            heightMM = Number(heightMM);
            radiusMM = Number(radiusMM);

            if (
                isNaN(widthMM) ||
                isNaN(heightMM) ||
                widthMM <= 0 ||
                heightMM <= 0
            ) {
                return "ERR|Sticker ölçüleri 0'dan büyük olmalıdır.";
            }

            if (
                widthMM > 2000 ||
                heightMM > 2000
            ) {
                return "ERR|Sticker ölçüsü 2000 mm'den büyük olamaz.";
            }

            var targetShape = shape;

            if (
                targetShape === "roundedRectangle" &&
                (
                    isNaN(radiusMM) ||
                    radiusMM < 0 ||
                    radiusMM >
                    Math.min(widthMM, heightMM) / 2
                )
            ) {
                return "ERR|Köşe yarıçapı geçersiz.";
            }

            var targetWidth = mmToPoints(widthMM);
            var targetHeight = mmToPoints(heightMM);
            var targetRadius = mmToPoints(radiusMM);

            var doc = app.activeDocument;

            var targets =
                scope === "selected"
                    ? collectSelectedTargets(doc.selection)
                    : collectAllRasterAndClippingTargets(doc);

            targets = filterNestedTargets(targets);

            var editableTargets = [];
            var skipped = 0;
            var i;

            for (i = 0; i < targets.length; i++) {
                if (isEditableItem(targets[i])) {
                    editableTargets.push(targets[i]);
                } else {
                    skipped++;
                }
            }

            if (editableTargets.length === 0) {
                return (
                    scope === "selected"
                        ? "ERR|Seçimde işlenebilir obje bulunamadı."
                        : "ERR|Belgede işlenebilir obje bulunamadı."
                );
            }

            var completed = 0;
            var failed = 0;
            var results = [];
            var errors = [];

            doc.selection = null;

            for (i = 0; i < editableTargets.length; i++) {
                var original = editableTargets[i];
                var workingCopy = null;
                var mask = null;

                try {
                    var originalBounds = copyBounds(
                        getTrueVisualBounds(original)
                    );

                    if (!isValidBounds(originalBounds)) {
                        throw new Error(
                            "Objenin ölçüsü okunamadı."
                        );
                    }

                    var originalCenter = boundsCenter(originalBounds);
                    var originalName = getItemName(original, i + 1);

                    workingCopy = original.duplicate();

                    fitItemToMask(
                        workingCopy,
                        originalCenter,
                        targetWidth,
                        targetHeight,
                        fitMode,
                        targetShape,
                        targetRadius
                    );

                    mask = createMaskShape(
                        doc,
                        targetShape,
                        originalCenter,
                        targetWidth,
                        targetHeight,
                        targetRadius
                    );

                    mask.move(
                        workingCopy,
                        ElementPlacement.PLACEBEFORE
                    );

                    doc.selection = null;
                    workingCopy.selected = true;
                    mask.selected = true;

                    app.executeMenuCommand("makeMask");

                    var resultGroup = findCreatedClippingGroup(
                        doc.selection,
                        mask
                    );

                    if (!resultGroup) {
                        throw new Error(
                            "Clipping mask grubu oluşturulamadı."
                        );
                    }

                    try {
                        resultGroup.name =
                            originalName +
                            "_" +
                            getShapeShortName(targetShape) +
                            "_" +
                            formatNumber(widthMM) +
                            "x" +
                            formatNumber(heightMM) +
                            "mm";
                    } catch (ignoreNameError) {}

                    if (!keepOriginal) {
                        safeRemove(original);
                    }

                    results.push(resultGroup);
                    completed++;

                    workingCopy = null;
                    mask = null;
                } catch (itemError) {
                    failed++;
                    safeRemove(mask);
                    safeRemove(workingCopy);

                    errors.push(
                        (i + 1) +
                        ". obje: " +
                        cleanText(itemError)
                    );
                }
            }

            doc.selection = null;

            for (i = 0; i < results.length; i++) {
                try {
                    results[i].selected = true;
                } catch (ignoreSelectionError) {}
            }

            app.redraw();

            return (
                "OK|" +
                completed + "|" +
                failed + "|" +
                skipped + "|" +
                cleanText(errors.slice(0, 5).join(" ~ "))
            );
        } catch (error) {
            return "ERR|" + cleanText(error);
        }
    }

    /* ════════════════════════════════════════════════════════
       BRIDGETALK WORKER — UNDO
    ════════════════════════════════════════════════════════ */

    function workerUndo() {
        try {
            if (app.documents.length === 0) {
                return "ERR|Açık belge yok.";
            }

            app.undo();
            return "OK|Son Illustrator işlemi geri alındı.";
        } catch (error) {
            return "ERR|" + String(error);
        }
    }

    /* ════════════════════════════════════════════════════════
       UI — PALETTE
    ════════════════════════════════════════════════════════ */

    var win = new Window(
        "palette",
        PALETTE_TITLE,
        undefined,
        {
            closeButton: true,
            resizeable: true
        }
    );

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 8;
    win.margins = [14, 14, 14, 14];

    /*
      Tam panel ve mini favori çubuğu ayrı kapsayıcılardadır.
      Küçültme sırasında yalnız görünüm değişir; çalışan araç kodları değişmez.
    */
    var mainContent = win.add("group");
    mainContent.orientation = "column";
    mainContent.alignChildren = ["fill", "top"];
    mainContent.spacing = 8;
    mainContent.margins = 0;

    var header = mainContent.add("group");
    header.orientation = "column";
    header.alignChildren = ["fill", "top"];

    var txTitle = header.add(
        "statictext",
        undefined,
        "Axyon Illustrator Sticker İşlem Paneli"
    );

    try {
        txTitle.graphics.font = ScriptUI.newFont(
            txTitle.graphics.font.name,
            "BOLD",
            13
        );
    } catch (ignoreFontError) {}

    header.add(
        "statictext",
        undefined,
        "Tuvalde seçimini yap; panel açık kalır. Tüm işlemler BridgeTalk ile Illustrator içinde yürütülür."
    );

    var tabs = mainContent.add("tabbedpanel");
    tabs.alignChildren = ["fill", "fill"];
    tabs.preferredSize = [610, 500];

    /* ────────────────────────────────────────────────────────
       TAB 1 — ÇOĞALT + SAY
    ──────────────────────────────────────────────────────── */

    var tabDuplicate = tabs.add(
        "tab",
        undefined,
        "1. Say / Çoğalt"
    );

    tabDuplicate.orientation = "column";
    tabDuplicate.alignChildren = ["fill", "top"];
    tabDuplicate.margins = [14, 18, 14, 14];
    tabDuplicate.spacing = 8;

    tabDuplicate.add(
        "statictext",
        undefined,
        "Seçili ana objeleri sayar ve verdiğin miktar kadar tam aynı konumda çoğaltır.",
        { multiline: true }
    );

    var pCount = tabDuplicate.add(
        "panel",
        undefined,
        "Seçim kontrolü"
    );

    pCount.orientation = "column";
    pCount.alignChildren = ["fill", "top"];
    pCount.margins = [12, 18, 12, 10];

    var txBefore = pCount.add(
        "statictext",
        undefined,
        "Çoğaltmadan önce seçili ana obje: —"
    );

    var txExpected = pCount.add(
        "statictext",
        undefined,
        "İşlem sonrası beklenen seçili obje: —"
    );

    var txAfter = pCount.add(
        "statictext",
        undefined,
        "Son işlem sonrası gerçek seçili obje: —"
    );

    var btnCount = pCount.add(
        "button",
        undefined,
        "Seçili Objeleri Say / Yenile"
    );

    var pDuplicateInput = tabDuplicate.add(
        "panel",
        undefined,
        "Çoğaltma"
    );

    pDuplicateInput.orientation = "row";
    pDuplicateInput.alignChildren = ["left", "center"];
    pDuplicateInput.margins = [12, 18, 12, 10];

    pDuplicateInput.add(
        "statictext",
        undefined,
        "Her ana obje için eklenecek kopya:"
    );

    var inCopyCount = pDuplicateInput.add(
        "edittext",
        undefined,
        "10"
    );

    inCopyCount.preferredSize = [80, 24];

    var btnDuplicate = tabDuplicate.add(
        "button",
        undefined,
        "Sayıyı Teyit Et ve Çoğalt"
    );

    btnDuplicate.preferredSize.height = 34;

    var lastCountedSelection = -1;

    function updateExpectedCount() {
        var copyCount = parseInt(inCopyCount.text, 10);

        if (
            lastCountedSelection < 0 ||
            isNaN(copyCount) ||
            copyCount < 1
        ) {
            txExpected.text =
                "İşlem sonrası beklenen seçili obje: —";
            return;
        }

        txExpected.text =
            "İşlem sonrası beklenen seçili obje: " +
            (
                lastCountedSelection *
                (copyCount + 1)
            );
    }

    function refreshSelectedCount(callback) {
        sendWorker(
            workerCountSelection,
            [],
            function (body) {
                var parts = splitResult(body);

                if (parts[0] !== "OK") {
                    lastCountedSelection = -1;
                    txBefore.text =
                        "Çoğaltmadan önce seçili ana obje: —";
                    updateExpectedCount();
                    setStatus(resultError(parts));
                    alert(resultError(parts));
                    return;
                }

                lastCountedSelection =
                    parseInt(parts[1], 10) || 0;

                txBefore.text =
                    "Çoğaltmadan önce seçili ana obje: " +
                    lastCountedSelection;

                updateExpectedCount();

                setStatus(
                    lastCountedSelection > 0
                        ? lastCountedSelection +
                          " adet ana obje seçili."
                        : "Hiçbir obje seçili değil."
                );

                if (callback) {
                    callback(lastCountedSelection);
                }
            },
            "Seçili objeler sayılıyor..."
        );
    }

    btnCount.onClick = function () {
        refreshSelectedCount();
    };

    inCopyCount.onChanging = function () {
        updateExpectedCount();
    };

    btnDuplicate.onClick = function () {
        var copyCount = parseInt(inCopyCount.text, 10);

        if (
            isNaN(copyCount) ||
            copyCount < 1 ||
            copyCount !== Number(inCopyCount.text)
        ) {
            setStatus(
                "Kopya sayısı 1 veya daha büyük tam sayı olmalıdır."
            );
            return;
        }

        /* Çoğaltmadan hemen önce seçim tekrar sayılır. */
        refreshSelectedCount(function (beforeCount) {
            if (beforeCount < 1) {
                alert("Çoğaltılacak obje seçili değil.");
                return;
            }

            var expected =
                beforeCount * (copyCount + 1);

            var approved = confirm(
                "ÇOĞALTMA TEYİDİ\n\n" +
                "Seçili ana obje: " +
                beforeCount + "\n" +
                "Her obje için eklenecek kopya: " +
                copyCount + "\n" +
                "Oluşturulacak yeni obje: " +
                (beforeCount * copyCount) + "\n" +
                "İşlem sonrası beklenen toplam: " +
                expected + "\n\n" +
                "Devam edilsin mi?"
            );

            if (!approved) {
                setStatus("Çoğaltma iptal edildi.");
                return;
            }

            sendWorker(
                workerDuplicate,
                [copyCount],
                function (body) {
                    var parts = splitResult(body);

                    if (parts[0] !== "OK") {
                        setStatus(resultError(parts));
                        alert(resultError(parts));
                        return;
                    }

                    var actualBefore =
                        parseInt(parts[1], 10) || 0;
                    var actualCopies =
                        parseInt(parts[2], 10) || 0;
                    var created =
                        parseInt(parts[3], 10) || 0;
                    var actualAfter =
                        parseInt(parts[4], 10) || 0;

                    lastCountedSelection = actualAfter;

                    txBefore.text =
                        "Çoğaltmadan önce seçili ana obje: " +
                        actualBefore;

                    txExpected.text =
                        "İşlem sonrası beklenen seçili obje: " +
                        (
                            actualBefore *
                            (actualCopies + 1)
                        );

                    txAfter.text =
                        "Son işlem sonrası gerçek seçili obje: " +
                        actualAfter;

                    setStatus(
                        "Çoğaltma tamamlandı: " +
                        created +
                        " yeni obje, toplam " +
                        actualAfter +
                        " seçili."
                    );

                    alert(
                        "ÇOĞALTMA TAMAMLANDI\n\n" +
                        "İşlem öncesi ana obje: " +
                        actualBefore + "\n" +
                        "Eklenen yeni obje: " +
                        created + "\n" +
                        "Beklenen toplam: " +
                        (
                            actualBefore *
                            (actualCopies + 1)
                        ) + "\n" +
                        "Gerçek seçili toplam: " +
                        actualAfter
                    );
                },
                "Objeler çoğaltılıyor..."
            );
        });
    };

    /* ────────────────────────────────────────────────────────
       TAB 2 — AKILLI MASKE
    ──────────────────────────────────────────────────────── */

    var tabSmartMask = tabs.add(
        "tab",
        undefined,
        "2. Akıllı Maske"
    );

    tabSmartMask.orientation = "column";
    tabSmartMask.alignChildren = ["fill", "top"];
    tabSmartMask.margins = [14, 18, 14, 14];
    tabSmartMask.spacing = 8;

    tabSmartMask.add(
        "statictext",
        undefined,
        "Üstteki Path / Compound Path maskelerini ve altlarındaki Raster / Placed görselleri birlikte seç. Maske ve görsel sayıları eşit olmalıdır.",
        { multiline: true }
    );

    var pMaskLogic = tabSmartMask.add(
        "panel",
        undefined,
        "Eşleştirme"
    );

    pMaskLogic.orientation = "column";
    pMaskLogic.alignChildren = ["fill", "top"];
    pMaskLogic.margins = [12, 18, 12, 10];

    pMaskLogic.add(
        "statictext",
        undefined,
        "Her maske, konum olarak en fazla örtüştüğü kullanılmamış görselle eşleştirilir. İşlem sonunda oluşturulan clipping grupları seçili kalır.",
        { multiline: true }
    );

    var btnSmartMask = tabSmartMask.add(
        "button",
        undefined,
        "Seçimi Toplu Akıllı Maskele"
    );

    btnSmartMask.preferredSize.height = 34;

    btnSmartMask.onClick = function () {
        if (
            !confirm(
                "Seçili Path / Compound Path maskeleri ile Raster / Placed görseller eşleştirilip clipping mask yapılacak.\n\nDevam edilsin mi?"
            )
        ) {
            return;
        }

        sendWorker(
            workerSmartMask,
            [],
            function (body) {
                var parts = splitResult(body);

                if (parts[0] !== "OK") {
                    setStatus(resultError(parts));
                    alert(resultError(parts));
                    return;
                }

                var maskCount = parts[1];
                var imageCount = parts[2];
                var completed = parts[3];

                setStatus(
                    completed +
                    " akıllı clipping mask oluşturuldu."
                );

                alert(
                    "AKILLI MASKE TAMAMLANDI\n\n" +
                    "Maske: " +
                    maskCount + "\n" +
                    "Görsel: " +
                    imageCount + "\n" +
                    "Oluşturulan clipping mask: " +
                    completed
                );
            },
            "Maskeler ve görseller eşleştiriliyor..."
        );
    };

    /* ────────────────────────────────────────────────────────
       TAB 3 — RASTERLEŞTİR
    ──────────────────────────────────────────────────────── */

    var tabRaster = tabs.add(
        "tab",
        undefined,
        "3. Rasterleştir"
    );

    tabRaster.orientation = "column";
    tabRaster.alignChildren = ["fill", "top"];
    tabRaster.margins = [14, 18, 14, 14];
    tabRaster.spacing = 8;

    var pRasterScope = tabRaster.add(
        "panel",
        undefined,
        "Hangi clipping mask objeleri?"
    );

    pRasterScope.orientation = "column";
    pRasterScope.alignChildren = ["left", "center"];
    pRasterScope.margins = [12, 18, 12, 10];

    var rbRasterSelected = pRasterScope.add(
        "radiobutton",
        undefined,
        "Yalnız seçili clipping mask objeleri"
    );

    var rbRasterAll = pRasterScope.add(
        "radiobutton",
        undefined,
        "Belgedeki tüm clipping mask objeleri"
    );

    rbRasterSelected.value = true;

    var pRasterMode = tabRaster.add(
        "panel",
        undefined,
        "Ne rasterleşsin?"
    );

    pRasterMode.orientation = "column";
    pRasterMode.alignChildren = ["left", "center"];
    pRasterMode.margins = [12, 18, 12, 10];

    var rbRasterContent = pRasterMode.add(
        "radiobutton",
        undefined,
        "Sadece içerik rasterleşsin; vektör maske kalsın"
    );

    var rbRasterWhole = pRasterMode.add(
        "radiobutton",
        undefined,
        "Clipping mask grubunun tamamı tek resim olsun"
    );

    rbRasterContent.value = true;

    var pRasterOptions = tabRaster.add(
        "panel",
        undefined,
        "Kalite ve çıktı"
    );

    pRasterOptions.orientation = "column";
    pRasterOptions.alignChildren = ["fill", "top"];
    pRasterOptions.margins = [12, 18, 12, 10];

    var grpDpi = pRasterOptions.add("group");
    grpDpi.add("statictext", undefined, "DPI:");

    var inDpi = grpDpi.add(
        "edittext",
        undefined,
        "300"
    );

    inDpi.preferredSize = [80, 24];

    var chkTransparent = pRasterOptions.add(
        "checkbox",
        undefined,
        "Şeffaf arka plan"
    );

    chkTransparent.value = true;

    var chkExportPNG = pRasterOptions.add(
        "checkbox",
        undefined,
        "Her sonucu ayrıca ayrı PNG olarak kaydet"
    );

    chkExportPNG.value = false;

    var btnRaster = tabRaster.add(
        "button",
        undefined,
        "Rasterleştirmeyi Başlat"
    );

    btnRaster.preferredSize.height = 34;

    btnRaster.onClick = function () {
        var dpi = parseNumber(inDpi.text);

        if (
            isNaN(dpi) ||
            dpi < 72 ||
            dpi > 2400
        ) {
            setStatus(
                "DPI değeri 72 ile 2400 arasında olmalıdır."
            );
            return;
        }

        var folderPath = "";

        if (chkExportPNG.value) {
            var outputFolder = Folder.selectDialog(
                "PNG dosyalarının kaydedileceği klasörü seç."
            );

            if (!outputFolder) {
                setStatus("PNG klasörü seçilmedi.");
                return;
            }

            folderPath = outputFolder.fsName;
        }

        var scope =
            rbRasterSelected.value
                ? "selected"
                : "all";

        var mode =
            rbRasterContent.value
                ? "content"
                : "whole";

        if (
            !confirm(
                "RASTERLEŞTİRME TEYİDİ\n\n" +
                "Kapsam: " +
                (
                    scope === "selected"
                        ? "Seçili clipping mask objeleri"
                        : "Belgedeki tüm clipping mask objeleri"
                ) + "\n" +
                "İşlem: " +
                (
                    mode === "content"
                        ? "İçerik rasterleşecek, maske kalacak"
                        : "Grubun tamamı tek resim olacak"
                ) + "\n" +
                "DPI: " +
                dpi + "\n" +
                "Şeffaf: " +
                (
                    chkTransparent.value
                        ? "Evet"
                        : "Hayır"
                ) + "\n" +
                "Ayrı PNG: " +
                (
                    chkExportPNG.value
                        ? "Evet"
                        : "Hayır"
                ) + "\n\nDevam edilsin mi?"
            )
        ) {
            return;
        }

        sendWorker(
            workerRasterize,
            [
                scope,
                mode,
                dpi,
                chkTransparent.value,
                chkExportPNG.value,
                folderPath
            ],
            function (body) {
                var parts = splitResult(body);

                if (parts[0] !== "OK") {
                    setStatus(resultError(parts));
                    alert(resultError(parts));
                    return;
                }

                var completed = parts[1];
                var failed = parts[2];
                var exported = parts[3];
                var exportFailed = parts[4];
                var skipped = parts[5];
                var errors = parts[6] || "";

                setStatus(
                    completed +
                    " clipping mask rasterleştirildi."
                );

                var message =
                    "RASTERLEŞTİRME TAMAMLANDI\n\n" +
                    "Başarılı: " +
                    completed + "\n" +
                    "Başarısız: " +
                    failed + "\n" +
                    "Kilitli/gizli atlandı: " +
                    skipped;

                if (chkExportPNG.value) {
                    message +=
                        "\nPNG kaydedildi: " +
                        exported +
                        "\nPNG hatası: " +
                        exportFailed;
                }

                if (errors) {
                    message +=
                        "\n\nİlk hatalar:\n" +
                        errors;
                }

                alert(message);
            },
            "Clipping mask objeleri rasterleştiriliyor..."
        );
    };

    /* ────────────────────────────────────────────────────────
       TAB 4 — STICKER ŞEKLİ
    ──────────────────────────────────────────────────────── */

    var tabSticker = tabs.add(
        "tab",
        undefined,
        "4. Sticker Şekli"
    );

    tabSticker.orientation = "column";
    tabSticker.alignChildren = ["fill", "top"];
    tabSticker.margins = [14, 18, 14, 14];
    tabSticker.spacing = 7;

    var pStickerScope = tabSticker.add(
        "panel",
        undefined,
        "Hangi objeler?"
    );

    pStickerScope.orientation = "column";
    pStickerScope.alignChildren = ["left", "center"];
    pStickerScope.margins = [12, 18, 12, 10];

    var rbStickerSelected = pStickerScope.add(
        "radiobutton",
        undefined,
        "Yalnız seçili objeler"
    );

    var rbStickerAll = pStickerScope.add(
        "radiobutton",
        undefined,
        "Belgedeki tüm bağımsız raster ve clipping objeleri"
    );

    rbStickerSelected.value = true;

    var pStickerShape = tabSticker.add(
        "panel",
        undefined,
        "Sticker şekli ve ölçüsü"
    );

    pStickerShape.orientation = "column";
    pStickerShape.alignChildren = ["fill", "top"];
    pStickerShape.margins = [12, 18, 12, 10];

    var grpShape = pStickerShape.add("group");
    grpShape.add("statictext", undefined, "Şekil:");

    var ddShape = grpShape.add(
        "dropdownlist",
        undefined,
        [
            "Daire",
            "Kare",
            "Dikdörtgen",
            "Yuvarlatılmış Dikdörtgen"
        ]
    );

    ddShape.selection = 0;
    ddShape.preferredSize.width = 250;

    function addMeasureRow(parent, labelText, defaultValue) {
        var group = parent.add("group");
        group.alignChildren = ["left", "center"];

        var label = group.add(
            "statictext",
            undefined,
            labelText
        );

        label.preferredSize.width = 115;

        var input = group.add(
            "edittext",
            undefined,
            String(defaultValue)
        );

        input.preferredSize = [80, 24];

        group.add("statictext", undefined, "mm");

        return {
            group: group,
            label: label,
            input: input
        };
    }

    var rowWidth = addMeasureRow(
        pStickerShape,
        "Çap:",
        35
    );

    var rowHeight = addMeasureRow(
        pStickerShape,
        "Yükseklik:",
        35
    );

    var rowRadius = addMeasureRow(
        pStickerShape,
        "Köşe yarıçapı:",
        3
    );

    var pStickerFit = tabSticker.add(
        "panel",
        undefined,
        "Görsel maskeye nasıl yerleşsin?"
    );

    pStickerFit.orientation = "column";
    pStickerFit.alignChildren = ["fill", "top"];
    pStickerFit.margins = [12, 18, 12, 10];

    var ddFit = pStickerFit.add(
        "dropdownlist",
        undefined,
        [
            "Kapla — maskeyi doldur, taşanı kırp",
            "Sığdır — şekille kesişme kalmayana kadar güvenli ölçekle",
            "Esnet — maskeyi doldur, oran bozulabilir",
            "Ölçeği koru — yalnız merkeze hizala"
        ]
    );

    ddFit.selection = 1;

    var chkKeepOriginal = tabSticker.add(
        "checkbox",
        undefined,
        "Orijinal objeyi koru; kopyasını maskele"
    );

    chkKeepOriginal.value = false;

    var btnSticker = tabSticker.add(
        "button",
        undefined,
        "Sticker Maskelerini Oluştur"
    );

    btnSticker.preferredSize.height = 34;

    function updateShapeControls() {
        var index = ddShape.selection.index;

        if (index === 0) {
            rowWidth.label.text = "Çap:";
            rowHeight.input.text = rowWidth.input.text;
            rowHeight.input.enabled = false;
            rowHeight.label.enabled = false;
            rowRadius.input.enabled = false;
            rowRadius.label.enabled = false;
        } else if (index === 1) {
            rowWidth.label.text = "Kenar:";
            rowHeight.input.text = rowWidth.input.text;
            rowHeight.input.enabled = false;
            rowHeight.label.enabled = false;
            rowRadius.input.enabled = false;
            rowRadius.label.enabled = false;
        } else if (index === 2) {
            rowWidth.label.text = "Genişlik:";
            rowHeight.input.enabled = true;
            rowHeight.label.enabled = true;
            rowRadius.input.enabled = false;
            rowRadius.label.enabled = false;
        } else {
            rowWidth.label.text = "Genişlik:";
            rowHeight.input.enabled = true;
            rowHeight.label.enabled = true;
            rowRadius.input.enabled = true;
            rowRadius.label.enabled = true;
        }
    }

    ddShape.onChange = updateShapeControls;

    rowWidth.input.onChanging = function () {
        var index = ddShape.selection.index;

        if (index === 0 || index === 1) {
            rowHeight.input.text = rowWidth.input.text;
        }
    };

    updateShapeControls();

    btnSticker.onClick = function () {
        var shapeIndex = ddShape.selection.index;

        var shapeNames = [
            "circle",
            "square",
            "rectangle",
            "roundedRectangle"
        ];

        var widthMM = parseNumber(rowWidth.input.text);
        var heightMM = parseNumber(rowHeight.input.text);

        if (shapeIndex === 0 || shapeIndex === 1) {
            heightMM = widthMM;
        }

        var radiusMM =
            shapeIndex === 3
                ? parseNumber(rowRadius.input.text)
                : 0;

        if (
            isNaN(widthMM) ||
            isNaN(heightMM) ||
            widthMM <= 0 ||
            heightMM <= 0
        ) {
            setStatus(
                "Sticker genişlik ve yüksekliği 0'dan büyük olmalıdır."
            );
            return;
        }

        if (
            shapeIndex === 3 &&
            (
                isNaN(radiusMM) ||
                radiusMM < 0 ||
                radiusMM >
                Math.min(widthMM, heightMM) / 2
            )
        ) {
            setStatus("Köşe yarıçapı geçersiz.");
            return;
        }

        var scope =
            rbStickerSelected.value
                ? "selected"
                : "all";

        var fitModes = [
            "cover",
            "contain",
            "stretch",
            "center"
        ];

        if (
            !confirm(
                "STICKER MASKE TEYİDİ\n\n" +
                "Kapsam: " +
                (
                    scope === "selected"
                        ? "Seçili objeler"
                        : "Belgedeki tüm uygun objeler"
                ) + "\n" +
                "Şekil: " +
                ddShape.selection.text + "\n" +
                "Ölçü: " +
                widthMM +
                " × " +
                heightMM +
                " mm\n" +
                "Yerleşim: " +
                ddFit.selection.text + "\n" +
                "Orijinali koru: " +
                (
                    chkKeepOriginal.value
                        ? "Evet"
                        : "Hayır"
                ) + "\n\nDevam edilsin mi?"
            )
        ) {
            return;
        }

        sendWorker(
            workerStickerMask,
            [
                scope,
                shapeNames[shapeIndex],
                widthMM,
                heightMM,
                radiusMM,
                fitModes[ddFit.selection.index],
                chkKeepOriginal.value
            ],
            function (body) {
                var parts = splitResult(body);

                if (parts[0] !== "OK") {
                    setStatus(resultError(parts));
                    alert(resultError(parts));
                    return;
                }

                var completed = parts[1];
                var failed = parts[2];
                var skipped = parts[3];
                var errors = parts[4] || "";

                setStatus(
                    completed +
                    " sticker maskesi oluşturuldu."
                );

                var message =
                    "STICKER MASKE TAMAMLANDI\n\n" +
                    "Başarılı: " +
                    completed + "\n" +
                    "Başarısız: " +
                    failed + "\n" +
                    "Kilitli/gizli atlandı: " +
                    skipped;

                if (errors) {
                    message +=
                        "\n\nİlk hatalar:\n" +
                        errors;
                }

                alert(message);
            },
            "Sticker maskeleri oluşturuluyor..."
        );
    };

    /* ════════════════════════════════════════════════════════
       DURUM + ORTAK BUTONLAR
    ════════════════════════════════════════════════════════ */

    var pStatus = mainContent.add("panel", undefined, "Durum");
    pStatus.margins = [8, 8, 8, 6];

    var txStatus = pStatus.add(
        "statictext",
        undefined,
        "Hazır. Tuvalde seçim yapıp ilgili sekmedeki butona basın.",
        { multiline: false }
    );

    txStatus.preferredSize.width = 560;
    txStatus.justify = "center";

    var grpBottom = mainContent.add("group");
    grpBottom.alignment = "center";
    grpBottom.spacing = 8;

    var btnMinimize = grpBottom.add(
        "button",
        undefined,
        "Küçült"
    );

    btnMinimize.preferredSize = [100, 30];
    btnMinimize.helpTip =
        "Paneli dar bir favoriler çubuğuna dönüştürür.";

    var btnUndo = grpBottom.add(
        "button",
        undefined,
        "Geri Al"
    );

    btnUndo.preferredSize = [100, 30];

    var btnClose = grpBottom.add(
        "button",
        undefined,
        "Kapat"
    );

    btnClose.preferredSize = [90, 30];

    /* ════════════════════════════════════════════════════════
       MİNİ FAVORİLER ÇUBUĞU
       Gerçek Adobe dock paneli değildir; dar, taşınabilir palette modudur.
    ════════════════════════════════════════════════════════ */

    var miniBar = win.add("group");
    miniBar.orientation = "column";
    miniBar.alignChildren = ["fill", "top"];
    miniBar.spacing = 6;
    miniBar.margins = [6, 6, 6, 6];
    miniBar.visible = false;
    miniBar.maximumSize = [0, 0];

    var txMiniTitle = miniBar.add(
        "statictext",
        undefined,
        "AXYON"
    );
    txMiniTitle.justify = "center";

    try {
        txMiniTitle.graphics.font = ScriptUI.newFont(
            txMiniTitle.graphics.font.name,
            "BOLD",
            11
        );
    } catch (ignoreMiniFontError) {}

    var btnMiniDuplicate = miniBar.add(
        "button",
        undefined,
        "1  Say / Çoğalt"
    );
    btnMiniDuplicate.preferredSize = [132, 28];
    btnMiniDuplicate.helpTip =
        "Paneli açar ve Say / Çoğalt sekmesine gider.";

    var btnMiniMask = miniBar.add(
        "button",
        undefined,
        "2  Akıllı Maske"
    );
    btnMiniMask.preferredSize = [132, 28];
    btnMiniMask.helpTip =
        "Paneli açar ve Akıllı Maske sekmesine gider.";

    var btnMiniRaster = miniBar.add(
        "button",
        undefined,
        "3  Rasterleştir"
    );
    btnMiniRaster.preferredSize = [132, 28];
    btnMiniRaster.helpTip =
        "Paneli açar ve Rasterleştir sekmesine gider.";

    var btnMiniSticker = miniBar.add(
        "button",
        undefined,
        "4  Sticker Şekli"
    );
    btnMiniSticker.preferredSize = [132, 28];
    btnMiniSticker.helpTip =
        "Paneli açar ve Sticker Şekli sekmesine gider.";

    var btnRestore = miniBar.add(
        "button",
        undefined,
        "Genişlet"
    );
    btnRestore.preferredSize = [132, 28];

    var btnMiniClose = miniBar.add(
        "button",
        undefined,
        "Kapat"
    );
    btnMiniClose.preferredSize = [132, 26];

    var compactMode = false;
    var normalWindowSize = [650, 650];

    function readWindowSize() {
        try {
            return [
                Math.max(650, Number(win.size.width)),
                Math.max(650, Number(win.size.height))
            ];
        } catch (ignoreReadSizeError) {
            return [650, 650];
        }
    }

    function setControlCollapsed(control, collapsed) {
        if (collapsed) {
            control.visible = false;
            control.maximumSize = [0, 0];
        } else {
            control.maximumSize = [10000, 10000];
            control.visible = true;
        }
    }

    function setCompactMode(enableCompact) {
        compactMode = enableCompact;

        if (enableCompact) {
            normalWindowSize = readWindowSize();

            setControlCollapsed(mainContent, true);
            setControlCollapsed(miniBar, false);

            win.minimumSize = [150, 245];
            win.layout.layout(true);
            win.size = [158, 250];

            try {
                win.text = "Axyon";
            } catch (ignoreMiniTitleError) {}
        } else {
            setControlCollapsed(miniBar, true);
            setControlCollapsed(mainContent, false);

            win.minimumSize = [620, 610];
            win.layout.layout(true);
            win.size = normalWindowSize;

            try {
                win.text = PALETTE_TITLE;
            } catch (ignoreFullTitleError) {}
        }

        win.layout.layout(true);
        win.update();
    }

    function restoreToTab(tabIndex) {
        tabs.selection = tabIndex;
        setCompactMode(false);
    }

    btnMinimize.onClick = function () {
        setCompactMode(true);
    };

    btnRestore.onClick = function () {
        setCompactMode(false);
    };

    btnMiniDuplicate.onClick = function () {
        restoreToTab(0);
    };

    btnMiniMask.onClick = function () {
        restoreToTab(1);
    };

    btnMiniRaster.onClick = function () {
        restoreToTab(2);
    };

    btnMiniSticker.onClick = function () {
        restoreToTab(3);
    };

    btnMiniClose.onClick = function () {
        win.close();
    };

    btnUndo.onClick = function () {
        sendWorker(
            workerUndo,
            [],
            function (body) {
                var parts = splitResult(body);

                if (parts[0] !== "OK") {
                    setStatus(resultError(parts));
                    alert(resultError(parts));
                    return;
                }

                setStatus(parts.slice(1).join("|"));
            },
            "Geri alınıyor..."
        );
    };

    btnClose.onClick = function () {
        win.close();
    };

    win.onResizing = win.onResize = function () {
        if (!compactMode) {
            this.layout.resize();
        }
    };

    win.onClose = function () {
        try {
            $.global[ENGINE_GLOBAL_KEY] = null;
        } catch (ignoreGlobalClearError) {}

        return true;
    };

    tabs.selection = 0;

    win.minimumSize = [620, 610];
    win.layout.layout(true);
    normalWindowSize = readWindowSize();

    $.global[ENGINE_GLOBAL_KEY] = win;

    win.center();
    win.show();
})();
