# U4.3.3 — Factory Intelligence & Defense-Gated Groundfront

## Amaç

Bu patch mevcut aggregate üretim motorunu yeni P0 uzaysal çekirdek devreye alınana kadar daha okunur ve daha adil hale getirir. Üç kullanıcı kararı uygulanmıştır:

1. İnşa paletindeki gereksinimler yalnız emoji/simge değil, **simge + ürün adı + adet** olarak gösterilir.
2. Yerel baskınlar erken kuruluşu cezalandırmaz; ilk gerçek savunma teknolojisi **Gezegen Savunması (`defenseGrid`)** tamamlanana kadar yerel tehdit zamanlayıcısı kapalıdır.
3. Fabrika ekranında açılıp kapanabilen anlık durum çekmecesi; yerleşik her makine/santral için üretim, çevrim, enerji ve duruş sebebini gösterir.

## Tehdit kapısı

- Fabrika veya santral kurmak tek başına yerel tehdidi başlatmaz.
- `defenseGrid` araştırılmadan `nextRaidAt = 0` kalır ve HUD tehdit değeri `0` gösterir.
- Araştırma tamamlandığında Yeryüzü Cephesi etkinleşir, gerçek zamanlayıcı kurulur ve tek bir istihbarat raporu oluşturulur.
- First Orbit uzay tehdidi bağımsızdır; orbital varlık operasyonel olursa Galaktik Cephe normal biçimde açılır.

## Anlık fabrika raporu

Çekmece harita üzerinde `📈 Durum` düğmesiyle açılır ve şunları sunar:

- aktif/toplam makine,
- toplam güç arzı,
- gerçek teslim edilen / talep edilen kW,
- bağlantısız makine sayısı,
- her makine için koordinat, ürün/sn, çevrim süresi, gerçek/azami kW ve durum,
- her santral için gerçek/azami kW, yakıt stoku ve tüketim/sn.

Durumlar: `Çalışıyor`, `Girdi veya depo bekliyor`, `Hat yok`, `Güç/yakıt yok`, `Yük hattı yok`, `Yakıt yok`, `Hazır`.

## P0 uzaysal çekirdek sınırı

`src/core/spatial-sim.js` ve 20 assertion'lık P0 testi pakette korunur. Çekirdek gerçek bant, inserter, buffer, backpressure, tükenme ve graf-güç davranışını kanıtlamıştır; ancak ana UI/tick/save akışına henüz bağlanmamıştır. U4.3.3 raporu mevcut canlı aggregate motoru gösterir. P1 köprüsü bu raporu uzaysal entity buffer ve belt durumlarıyla besleyecektir.
