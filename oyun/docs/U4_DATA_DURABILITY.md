# U4 Data Vault — Veri Dayanıklılığı Sözleşmesi

## Amaç

U4, oyun durum şemasını değiştirmeden (`save schema v16`) istemci kayıt katmanını tek kopyalı localStorage yapısından çift katmanlı ve onarılabilir bir yapıya taşır.

## Katmanlar

### IndexedDB — ana dayanıklı kasa

- Veritabanı: `axyon_orbital_ascendancy`
- Sürüm: `1`
- `records`: aktif kritik kayıtlar
- `backups`: değiştirilen önceki geçerli nesiller
- Her anahtar için en fazla 5 yedek

### localStorage — uyumluluk aynası

- Mevcut profil/save anahtarları korunur.
- Senkron oyun açılışı ve eski sürüm uyumluluğu sağlar.
- IndexedDB kullanılamıyorsa kontrollü fallback olur.
- `axyon_storage_mirror_meta_v1`, yerel revizyon/checksum/tombstone bilgisini tutar.

## Kayıt zarfı

Her kasa kaydı şunları taşır:

- `key`
- `value`
- `revision`
- `updatedAt`
- `checksum`
- `source`
- gerektiğinde `deleted: true`

Checksum, kazara bozulmayı tespit eden FNV-1a tabanlı bütünlük işaretidir. Kriptografik imza veya anti-cheat değildir.

## Açılış uzlaştırması

1. IndexedDB açılır.
2. IndexedDB ve localStorage kritik anahtarları listelenir.
3. Checksum ve v16 yapısal doğrulaması yapılır.
4. Yüksek geçerli revizyon kazanır.
5. Tek sağlam kopya diğer katmanı onarır.
6. İki güncel kopya da geçersizse en yeni geçerli yedek geri yüklenir.
7. Hiç geçerli nesil yoksa yapısal hata korunur; veri sessizce ezilmez.

## Yazma akışı

1. Runtime durumundan doğrulanmış v16 payload üretilir.
2. localStorage temp anahtarına yazılır ve tekrar doğrulanır.
3. localStorage aktif aynası atomik benzeri commit ile değiştirilir.
4. Yerel revizyon/checksum metadata güncellenir.
5. IndexedDB yazması sıralı kuyruğa alınır.
6. IndexedDB işlemi mevcut revizyonu yeniden okuyarak stale/eşzamanlı revizyonu monoton yükseltir.
7. Önceki farklı geçerli nesil yedeklenir.
8. Dayanıklı commit sonrası `axyon:save-success` yayınlanır.

## Hata davranışı

- localStorage yazma hatası: kayıt hemen başarısız olur ve görünür uyarı açılır.
- IndexedDB yazma hatası: en yeni localStorage aynası korunur; uyarı açılır.
- Kullanıcı **Tekrar Dene** ile dayanıklı yazmayı yeniden başlatabilir.
- Otomatik kayıt 30 saniyelik kontrollü beklemeden sonra tekrar deneyebilir.
- `migration`, `load` ve `legacy` yapısal kilitleri sıradan retry ile gevşetilmez.

## Silme güvenliği

Profil veya tüm veri silme işlemi yalnız fiziksel `delete` çağrısına güvenmez. Daha yüksek revizyonlu `deleted: true` tombstone yazılır.

Böylece:

- localStorage silinmiş,
- IndexedDB silme kuyruğu henüz tamamlanmamış,
- uygulama aniden kapanmış

olsa bile sonraki açılışta eski IndexedDB kaydı geri gelmez; yeni tombstone kazanır.

## Ölçek ve sunucu sınırı

Bu katman tek cihazdaki kayıt dayanıklılığı içindir. Gelecekteki ortak evrende:

- istemci kaydı otorite değildir,
- server state ile birleştirme kuralları ayrıca tanımlanacaktır,
- ekonomi işlemleri idempotent işlem kimliği taşıyacaktır,
- sunucu zamanı ve mülkiyet doğrulaması zorunlu olacaktır.

## Kabul testleri

`tests/u4-indexeddb-durability.js`:

- U3.1 yerel kayıt aktarımı
- dual-write ve sıralama
- yerel kopya onarımı
- iki kopya bozulmasında rollback
- yedek retention
- stale revizyon yükseltme
- IndexedDB hata/retry
- tombstone ile silinen verinin dirilmemesi

`tests/u4-browser-smoke.py`:

- async U4 bootstrap
- Chromium içinde dayanıklı save/flush
- görünür IndexedDB hata köprüsü
- kullanıcı retry ve dayanıklı kurtarma
- localStorage fallback
- mobil yatay taşma kontrolü

## Kalan kabul kapısı

Kısıtlı çalışma ortamı `http/https` ve `file:` navigasyonunu engellediği için native IndexedDB adaptörü gerçek origin üzerinde çalıştırılamadı. Buna karşılık native `open`, upgrade, object store, backup index, transaction, yeniden açılış/hydration ve tombstone yolu standart uyumlu IndexedDB test motorunda geçti. Nihai cihaz kabulü gerçek tarayıcı origin’i ve gerçek Android cihaz üzerinde yapılacaktır.
