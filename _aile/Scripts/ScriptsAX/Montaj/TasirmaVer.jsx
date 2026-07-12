#target illustrator
try {
    if (app.documents.length == 0) throw 'Dosya yok!';
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (sel.length == 0) throw 'Obje seç.';

    var inputVal = prompt("Kaç mm taşırma verilsin?", "3");
    if (inputVal == null) throw 'İşlem iptal edildi.';

    var mmVal = parseFloat(inputVal.replace(',', '.'));
    if (isNaN(mmVal)) throw 'Geçersiz bir sayı girdin.';

    var bleedPt = mmVal * 2.834645;

    // Tolerans: sadece floating-point yuvarlama hatalarını karşılar
    // 0.01pt ≈ 0.004mm — pratikte sıfır, yanlış eşleşme riski yok
    var TOLERANCE = 0.01;

    // ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────────────────

    // geometricBounds → stroke/kenar çizgisi DAHİL DEĞİL, sadece path geometrisi
    // (stroke dahil olsaydı visibleBounds kullanırdık — burada istemiyoruz)
    function getBounds(item) {
        if (item.typename == 'GroupItem' && item.clipped) {
            for (var j = 0; j < item.pageItems.length; j++) {
                if (item.pageItems[j].clipping) {
                    return item.pageItems[j].geometricBounds; // [L, T, R, B]
                }
            }
        }
        return item.geometricBounds; // [L, T, R, B]
    }

    // İki sayının tolerans dahilinde eşit olup olmadığını kontrol eder
    function nearEqual(a, b) {
        return Math.abs(a - b) <= TOLERANCE;
    }

    // İki aralığın [a1,a2] ve [b1,b2] örtüşüp örtüşmediğini kontrol eder
    // (sadece iç içe geçme, uç-uca dokunma sayılmaz)
    function rangesOverlap(a1, a2, b1, b2) {
        return (a1 < b2 - TOLERANCE) && (a2 > b1 + TOLERANCE);
    }

    // ─── SINIR BİLGİLERİNİ TOPLA ─────────────────────────────────────────────

    // Her seçili obje için bounds'u önceden al
    var allBounds = [];
    for (var i = 0; i < sel.length; i++) {
        allBounds.push(getBounds(sel[i]));
        // geometricBounds: [sol, üst, sağ, alt]  (Illustrator koordinatı: Y yukarı pozitif)
    }

    // ─── TAŞIRMA UYGULA ───────────────────────────────────────────────────────

    for (var i = 0; i < sel.length; i++) {
        var item   = sel[i];
        var bounds = allBounds[i]; // [L, T, R, B]
        var iL = bounds[0];
        var iT = bounds[1];
        var iR = bounds[2];
        var iB = bounds[3];

        // Varsayılan: dört kenar da taşırma alır
        var expandL = bleedPt;
        var expandT = bleedPt;
        var expandR = bleedPt;
        var expandB = bleedPt;

        // Diğer tüm objelerle karşılaştır
        for (var j = 0; j < sel.length; j++) {
            if (i == j) continue;

            var jBounds = allBounds[j];
            var jL = jBounds[0];
            var jT = jBounds[1];
            var jR = jBounds[2];
            var jB = jBounds[3];

            // ── SAĞ KENARI kontrol et: i'nin sağ kenarı j'nin sol kenarına değiyor mu?
            if (nearEqual(iR, jL) && rangesOverlap(iB, iT, jB, jT)) {
                expandR = 0; // iç kenar → taşırma yok
            }

            // ── SOL KENARI kontrol et: i'nin sol kenarı j'nin sağ kenarına değiyor mu?
            if (nearEqual(iL, jR) && rangesOverlap(iB, iT, jB, jT)) {
                expandL = 0;
            }

            // ── ÜST KENARI kontrol et: i'nin üst kenarı j'nin alt kenarına değiyor mu?
            if (nearEqual(iT, jB) && rangesOverlap(iL, iR, jL, jR)) {
                expandT = 0;
            }

            // ── ALT KENARI kontrol et: i'nin alt kenarı j'nin üst kenarına değiyor mu?
            if (nearEqual(iB, jT) && rangesOverlap(iL, iR, jL, jR)) {
                expandB = 0;
            }
        }

        // ─── HESAPLANAN TAŞIRMALARI UYGULA ────────────────────────────────────

        // Illustrator position = [sol üst X, sol üst Y]
        // genişlik/yükseklik değişince pozisyonu da kaydırmak gerekir
        var newL = iL - expandL;
        var newT = iT + expandT;   // Y ekseni: yukarı = +
        var newR = iR + expandR;
        var newB = iB - expandB;   // Y ekseni: aşağı = -

        var newW = newR - newL;
        var newH = newT - newB;    // height pozitif

        if (item.typename == 'GroupItem' && item.clipped) {
            // Clipping Mask: sadece maske yolunu büyüt
            for (var j = 0; j < item.pageItems.length; j++) {
                var sub = item.pageItems[j];
                if (sub.clipping) {
                    sub.width    = newW;
                    sub.height   = newH;
                    sub.position = [newL, newT];
                    break;
                }
            }
        } else {
            item.width    = newW;
            item.height   = newH;
            item.position = [newL, newT];
        }
    }

} catch (e) {
    if (e.toString().indexOf('İptal') == -1) {
        alert('Hata: ' + e);
    }
}