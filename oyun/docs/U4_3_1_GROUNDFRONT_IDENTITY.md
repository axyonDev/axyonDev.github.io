# U4.3.1 — Groundfront Identity & True Reset

## Ürün kararı

AXYON: Orbital Ascendancy bir “geri dön ve idle ödülünü topla” oyunu olarak sunulmayacaktır. Üretim, araştırma, tersane ve görev zamanları oyuncu çevrimdışıyken ilerleyebilir; ancak bu teknik zaman çözümlemesi jenerik dönüş modalı veya değersiz bildirim üretmez.

Oyuncuya yalnız anlamlı stratejik olaylar gösterilir:

- yaklaşan veya gerçekleşen saldırı,
- casusluk ve karşı-istihbarat,
- gerçek savaş sonucu,
- filo/görev sonucu,
- kritik araştırma veya inşa tamamlanması,
- kaynak kaybı, hasar, yağma ve savunma başarısı.

## Gerçek sıfırlama sözleşmesi

“Tüm ilerlemeyi sıfırla” sonrasında:

- harita tamamen boştur,
- aktif makine, santral, hat, kuyruk, rapor ve tehdit kalmaz,
- otomatik yerleştirilmiş başlangıç fabrikası oluşturulmaz,
- yedi kuruluş makinesi ücretsiz **yerleştirme hakkı** olarak oyuncuya verilir,
- bağlı authority varsa `profile.reset` idempotent komutu server state’ini de sıfırlar,
- server daha yeni revision taşıyorsa aynı reset kimliği güncel CAS revision ile güvenle tekrar gönderilir,
- ACK kaybı veya tekrar deneme ikinci kez sıfırlama/yan etki üretmez.

## Tehdit evreleri

### Evre 1 — Yeryüzü Cephesi

İlk orbital varlık oluşana kadar galaksi oyuncuyu algılamaz. Tehditler yereldir:

- sabotaj timleri,
- silahlı yağmacılar,
- rakip sanayi grupları,
- depo baskınları,
- altyapı hasarı.

Yerel saldırılar gerçek sonuç üretir. Savunma yetersizse stok kaybı ve gezegen altyapısı hasarı oluşabilir; başarılı savunmada hurda ve parça ele geçirilebilir.

### Evre 2 — Galaktik Cephe

Prototip Pazar Uydusu/ilk orbital varlık operasyonel olduğunda oyuncu uzayda görünür hale gelir. Uzay baskını zamanlayıcısı **bu anda** başlar; daha önce çalışmaz. Tarama, yıldız hedefleri ve uzay tehdidi bu kapıdan sonra açılır.

## Bildirim politikası

- Kısa alt-tab ve sıradan çevrimdışı üretim sessizdir.
- “Komutan geri döndü” modalı yoktur.
- “9 saniye ilerleme işlendi” gibi teknik bilgi haber sayılmaz.
- Haber akışının adı **Stratejik Haber Akışı**dır.
- Bildirim ancak oyuncunun kararını etkileyen gerçek olay varsa gösterilir.

## Sonraki savaş yönü

Bu sürüm OGame–Factory kimliğinin zeminini kurar; tam ortak evren PvP’si değildir. Sonraki savaş katmanları sunucu otoriteli olacak:

- gerçek oyuncu keşfi ve görünürlük,
- casusluk raporları,
- saldırı penceresi ve filo önleme,
- gezegen/yörünge savunması,
- yağma, enkaz ve geri dönüş görevleri,
- ittifak ve sektör çatışmaları,
- saldırıların server-time ve transaction ile çözülmesi.
