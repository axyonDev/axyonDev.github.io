# AXYON: Orbital Ascendancy
## v4.5.0 U4 — Data Vault & Durability Foundation

Üretim, otomasyon, ilk yörünge ekonomisi, gezegen/yörünge kapasitesi ve milyon ölçekli cohort savunmalarını birleştiren idle/makro-strateji prototipi.

## U4 öne çıkanlar

- **IndexedDB ana kayıt kasası** eklendi.
- `localStorage`, hızlı açılış uyumluluk aynası ve IndexedDB kullanılamadığında kontrollü fallback olarak korunur.
- U3.1 profilleri ve kayıtları ilk U4 açılışında kullanıcı verisi silinmeden kasaya taşınır.
- Her kayıt checksum, monoton revizyon ve güncelleme zamanı taşır.
- Açılışta localStorage ile IndexedDB karşılaştırılır; sağlam ve yeni olan kopya diğerini onarır.
- İki güncel kopya da bozuksa son geçerli IndexedDB yedeğine otomatik rollback yapılır.
- Her kritik kayıt için en fazla 5 eski nesil tutulur.
- Hızlı veya eşzamanlı eski revizyonlu yazılar, kasa işlemi içinde daha yüksek revizyona yükseltilir.
- Profil/sıfırlama silmeleri revizyonlu **tombstone** ile tutulur; uygulama aniden kapanırsa silinen kayıt geri dirilmez.
- IndexedDB yazma hatasında en yeni ilerleme localStorage aynasında kalır, görünür uyarı oluşur ve **Tekrar Dene** ile dayanıklı kayıt tamamlanır.
- IndexedDB açılamazsa oyun localStorage fallback ile çalışmaya devam eder ve bu durum Ayarlar ekranında gösterilir.
- U3.1 kayıt kurtarma, arka plan ilerlemesi, pinch zoom, Planetary Bastions ve cohort sistemleri korunmuştur.

Teknik ayrıntılar: `docs/U4_DATA_DURABILITY.md`

## Ölçek hedefi

Proje, milyonlarca kayıtlı kullanıcıya ve binlerce eşzamanlı oyuncuya uygun sunucu-otoriteli ortak evrene geçebilecek şekilde geliştirilecektir.

U4 veri kasası **istemci dayanıklılığıdır**; ortak evrende kredi, envanter, zaman, pazar, savaş ve mülkiyet otoritesi olmayacaktır. Ayrıntılar: `docs/SCALABILITY_GUARDRAILS.md`.

## Çalıştırma

En sağlıklı kullanım için klasörde yerel bir web sunucusu açın:

```bash
python -m http.server 8080
```

Ardından tarayıcıda `http://localhost:8080` adresini açın.

Doğrudan `index.html` de açılabilir; ancak Service Worker ve IndexedDB davranışları tarayıcının `file:`/opaque-origin güvenlik politikasına göre kısıtlanabilir.

## Test

Node/regresyon zinciri:

```bash
./run-tests.sh
```

Windows:

```bat
run-tests.bat
```

Chromium kabul testleri:

```bash
python tests/u3-browser-smoke.py
python tests/u4-browser-smoke.py
```

`u4-browser-smoke.py`, kısıtlı test ortamında gerçek Chromium üzerinde dayanıklı backend sözleşmesini deterministik backend ile; IndexedDB reddedildiğinde fallback yolunu ayrıca sınar. Native IndexedDB `open/objectStore/index/transaction` adaptörü ayrıca standart uyumlu IndexedDB test motorunda geçmiştir. Son cihaz kapısı gerçek `http/https` origin ve gerçek Android cihazdır.

## Önemli sınırlar

- Gerçek oyunculu ortak evren ve PvP için sunucu otoritesi henüz yoktur.
- U4 kasası yerel veriyi korur; kötü niyetli istemciye karşı güvenlik sağlamaz.
- Native IndexedDB adaptör testi geçti; gerçek-origin/gerçek-cihaz kabul testi sıradaki cihaz kapısıdır.
- Milyonluk savunmalar tek tek render edilmez; kompleks içinde cohort/stack olarak tutulur.
- Oyun durum şeması v16 olarak korunur; U4 yalnız saklama katmanını değiştirir.

## Raporlar

- `reports/U4_INTEGRATION_REPORT.md`
- `reports/U4_NODE_TESTS.txt`
- `reports/U4_BROWSER_SMOKE.json`
- `reports/U4_DATA_VAULT_DESKTOP.png`
- `reports/U4_DATA_VAULT_FALLBACK_MOBILE.png`
