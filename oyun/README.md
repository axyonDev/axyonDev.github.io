# Axyon Idle Factory: Frontier v4.0.0

Kalıcı fabrika otomasyonu ile OGame tarzı filo/gezegen mücadelesini aynı ekonomi içinde birleştiren tarayıcı/PWA oyunu.

## Ana döngü

Keşfet → kaynak çıkar → otomatik üretim hatları kur → bina sınıflarını Mk I–V yükselt → Pazar Uydusu ile sevkiyat yap → gemi ve savunma üret → sistem tara → rakip dünyalara saldır → koloni kur → sınırsız Omega araştırmalarıyla büyü.

## v4.0.0 kapsamı

- Nexus/prestige ve ilerleme sıfırlaması tamamen kaldırıldı.
- Gezegen yüzeyi 300×300 hücre, 20×20 sektör ve toplam 225 bölge oldu.
- Görünür fabrika alanı, pan/zoom ve minimap ile büyük harita kullanılabilir durumda.
- Maden, fabrika, laboratuvar ve santral sınıfları Mk I–V yükseltilebilir.
- Alfa, Beta, Gama yanında Delta ve Omega Veri eklendi.
- Ana teknoloji ağı ve beş sınırsız Omega araştırması eklendi.
- Pazar Uydusu: ana AUTO aç/kapa, tüm ürünlere ortak elde tutma yüzdesi, ürün bazlı istisna, sefer süresi ve kota, Mk I–V yükseltme.
- Manuel satış anlık fakat %85 fiyatlı; uydu satışı süreli ve tam fiyatlı.
- Yeni ileri kaynak zinciri: Titanyum, Axyon Kristali, Enerji Kristali, Zırh, Mühimmat ve Yıldız Yakıtı.
- Tersane, beş gemi sınıfı, üretim kuyruğu, yakıtlı sefer, gidiş/dönüş süresi ve savaş raporları.
- Altı keşfedilebilir rakip dünya/sistem; korsan, yerli sürü, rakip şirket, uzaylı kovanı, rakip imparatorluk ve kadim filo. Kolonileştirilmeyen rakipler zamanla daha güçlü biçimde yeniden örgütlenir.
- Ele geçirilen dünyalar Koloni Protokolü ile kolonileştirilebilir; her koloni kalıcı üretim bonusu verir.
- Gezegen savunmaları, mühimmat etkisi, önceden bildirilen uzaylı baskınları ve kaybedildiğinde bina silmeyen kontrollü yağma sistemi. Çevrimdışıyken vadesi gelen baskın oyuncu dönene kadar ertelenir.
- Eski v8 kayıtları v12 şemasına taşınır. Envanter ve teknoloji korunur; eski 48×48 binaları görünmez üretim oluşturmaması için kaldırılır ve yatırımların %65'i kredi olarak iade edilir. Yeni 300×300 harita güvenli biçimde kurulur.

## Önemli sınır

Bu paket yerel ve tek oyunculu olduğu için gerçek oyuncuya karşı güvenli PvP içermez. Mevcut mücadele PvE rakip imparatorluklar ve uzaylı saldırılarıyladır. Gerçek PvP için hesap, sunucu otoritesi, hileye dayanıklı ekonomi, zamanlayıcı ve savaş doğrulaması gerekir; istemci tarafındaki localStorage bunun için güvenli değildir.

## Çalıştırma

`index.html` doğrudan açılabilir. PWA/service worker testi için klasörde yerel HTTP sunucusu kullanın:

```bash
python -m http.server 8080
```

Ardından `http://localhost:8080` adresini açın.

## Kaynak yapısı

- `data/config.js`: ürünler, makineler, teknoloji, gemiler, savunmalar, galaksi hedefleri ve denge.
- `src/core/economy.js`: üretim, güç, pazar, yükseltme, harita, filo, savaş, baskın ve offline ilerleme.
- `src/canvas/factory-canvas.js`: 300×300 gezegen yüzeyi, kamera, yerleşim, bağlantılar ve minimap.
- `src/ui/ui.js`: tüm görünüm üretimi.
- `src/main.js`: kullanıcı olayları, oyun döngüsü ve modüller arası koordinasyon.
- `src/services/save-service.js`: localStorage, dışa/içe aktarma ve migrasyon.

## Doğrulama

Paket hazırlanırken tüm JavaScript dosyaları `node --check` ile kontrol edildi. Çekirdek smoke testleri; harita başlatma, üretim otomasyonu, pazar kotası, Mk I–V yükseltmeler, tüm araştırma yolunun erişilebilirliği, sistem tarama, filo savaşı/dönüşü, düşmanların yeniden güçlenmesi, kolonileştirme, baskın güvenliği, çevrimdışı baskın erteleme, v8→v12 migrasyonu ve görev ilerlemesi üzerinde çalıştırıldı. Ayrıca gerçek tarayıcıda arayüz açılışı, 300×300 harita, sekmeler, galaksi taraması ve filo penceresi hatasız doğrulandı.
