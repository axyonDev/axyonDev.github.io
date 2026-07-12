#target illustrator

try {
    if (app.documents.length == 0) throw 'Açık dosya yok!';
    var doc = app.documents[0];

    // Aktif artboard indexini al
    var currentIndex = doc.artboards.getActiveArtboardIndex();
    var totalArtboards = doc.artboards.length;

    // Kullanıcıya sor
    var currentHumanIndex = currentIndex + 1;
    var input = prompt(
        "Şu an " + currentHumanIndex + ". sıradaki artboard seçili.\n" +
        "Kaçıncı sıraya taşımak istiyorsun? (1 - " + totalArtboards + " arası)", 
        ""
    );

    if (input == null) throw 'İşlem iptal edildi.';
    
    var targetIndex = parseInt(input) - 1;

    if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= totalArtboards) {
        throw 'Geçersiz numara.';
    }

    if (targetIndex === currentIndex) {
        throw 'Zaten o sırada.';
    }

    // --- VERİLERİ GÜVENLİ KOPYALA ---
    var abData = [];
    for (var i = 0; i < totalArtboards; i++) {
        var ab = doc.artboards[i];
        var r = ab.artboardRect;
        
        // HATA ÇÖZÜMÜ BURADA:
        // Rect verisini doğrudan almak yerine, sayıları tek tek alıp temiz bir dizi yapıyoruz.
        // Bu sayede eski artboard silinse bile bu sayılar elimizde kalır.
        var cleanRect = [
            parseFloat(r[0]), // Sol
            parseFloat(r[1]), // Üst
            parseFloat(r[2]), // Sağ
            parseFloat(r[3])  // Alt
        ];

        abData.push({
            rect: cleanRect,
            name: ab.name,
            rulerOrigin: ab.rulerOrigin,
            rulerPAR: ab.rulerPAR,
            showCenter: ab.showCenter,
            showCrossHairs: ab.showCrossHairs,
            showSafeAreas: ab.showSafeAreas
        });
    }

    // --- SIRALAMAYI DEĞİŞTİR ---
    var movedItem = abData.splice(currentIndex, 1)[0];
    abData.splice(targetIndex, 0, movedItem);

    // --- YENİDEN OLUŞTURMA ---
    
    // 1. Geçici bir artboard ekle (Silme işlemi sırasında en az 1 tane kalması şart)
    // Bunu belgenin en uzak köşesine atıyoruz ki görünmesin
    var dummy = doc.artboards.add([0, 0, 100, -100]); 

    // 2. Orijinal artboardların hepsini sil (Dummy hariç)
    // Sondan başa doğru silmek index kaymasını önler
    for (var j = totalArtboards - 1; j >= 0; j--) {
        doc.artboards[j].remove();
    }

    // 3. Yeni sıraya göre artboardları oluştur
    for (var k = 0; k < abData.length; k++) {
        var data = abData[k];
        var newAb = doc.artboards.add(data.rect); // Temiz rect dizisi kullanılıyor
        newAb.name = data.name;
        newAb.rulerOrigin = data.rulerOrigin;
        newAb.rulerPAR = data.rulerPAR;
        newAb.showCenter = data.showCenter;
        newAb.showCrossHairs = data.showCrossHairs;
        newAb.showSafeAreas = data.showSafeAreas;
    }

    // 4. Geçici (Dummy) artboard'u sil
    // Dummy en başta oluşturulduğu için silme işleminden sonra indexi 0 olmuştur.
    // Ancak yeni eklenenler sonraya eklendiği için dummy en başta (index 0) kalır.
    doc.artboards[0].remove();

    // Yeni sıradaki artboardı seçili yap
    doc.artboards.setActiveArtboardIndex(targetIndex);

} catch (e) {
    if(e.toString().indexOf('iptal') == -1) {
        alert('Hata Detayı: ' + e);
    }
}