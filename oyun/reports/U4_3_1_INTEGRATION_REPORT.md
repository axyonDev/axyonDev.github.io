# AXYON: Orbital Ascendancy v4.5.4 U4.3.1
## Groundfront Identity & True Reset — Entegrasyon ve Kabul Raporu

**Sürüm:** `4.5.4-u4.3.1`  
**Save şeması:** `v16`  
**Taban:** v4.5.3 U4.3 Persistent Authority  
**Durum:** Kabul adayı — gameplay identity hotfix kapıları geçti

---

## 1. Yönetici özeti

Bu teslim, oyuncu tarafından bildirilen üç temel sorunu doğrudan kapatır:

1. **Sıfırlama sonrası binaların kalması:** Veri silinse bile U2 başlangıç paketi yedi makineyi otomatik olarak yeniden yerleştiriyordu. Ayrıca authority bağlantısında eski server snapshot’ı yerel reseti geri alabilirdi.
2. **“Komutan geri döndü” spam’i:** 8 saniyeyi geçen her arka plan dönüşü jenerik idle modalı açıyordu.
3. **Erken galaktik tehdit:** Uzay baskını zamanlayıcısı ilk saniyeden çalışıyor, oyuncu daha uzaya çıkmadan galaktik cepheye maruz kalabiliyordu.

U4.3.1 ile yeni oyun ve reset **boş haritayla** başlar; yedi başlangıç makinesi oyuncunun istediği hücrelere yerleştireceği ücretsiz kuruluş haklarıdır. Kısa alt-tab ve sıradan çevrimdışı üretim sessizdir. İlk orbital varlığa kadar yalnız Yeryüzü Cephesi tehditleri çalışır; galaktik görünürlük ve uzay baskını First Orbit sonrasında açılır.

---

## 2. Gerçek sıfırlama

### 2.1 Kök neden

U2 `starterApplied` akışı reset sonrasında yedi başlangıç makinesini tekrar haritaya koyuyordu. Bu nedenle kayıt temiz olsa bile oyuncu haritada aktif yapılar görüyordu.

Authority bağlantısında ikinci risk vardı: yalnız local save sıfırlanırsa bir sonraki snapshot reconciliation eski server state’ini geri getirebilirdi.

### 2.2 Yeni davranış

- Harita sıfır entity ile başlar.
- Makine ve santral adetleri sıfırdır.
- Konveyör ve enerji hatları temizdir.
- Kuyruklar, raporlar, hasar ve tehdit zamanlayıcıları temizlenir.
- Yedi başlangıç makinesi otomatik kurulmaz.
- Her başlangıç makinesi için ücretsiz manuel yerleştirme hakkı verilir.
- Başlangıç makinesi sökülürse ücretsiz hak geri kazanılır.
- Canvas reset sonrasında yeniden ortalanır.

### 2.3 Yetkili server reseti

Yeni `profile.reset` komutu:

- idempotent command ID taşır,
- local state’i anında temizler,
- bağlı server için outbox’a yazılır,
- server state’ini aynı domain kurallarıyla sıfırlar,
- server revision ilerideyse reset kimliğini tüketmeden güncel CAS revision ile yeniden denenir,
- ilk commit’in ACK’i kaybolursa duplicate receipt üzerinden ikinci yan etkiyi önler.

Gerçek Chromium testinde server revizyonu kasıtlı olarak client’tan bir adım ileri taşındı. Reset komutu ilk denemede `stale_revision` aldı, güncel revision ile aynı kimlik üzerinden tekrar gönderildi ve hem client hem server haritası sıfır entity ile kaldı.

---

## 3. Idle mesajlarının kaldırılması

Teknik zaman ilerlemesi korunmuştur; oyun kapalıyken üretim, araştırma, tersane ve görev zamanları hesaplanabilir. Ancak bu artık “idle ödülü” olarak sunulmaz.

Kaldırılan davranış:

```text
Komutan geri döndü 👋
9sn arka plan/çevrimdışı ilerleme işlendi.
```

Yeni bildirim politikası:

- kısa alt-tab sessiz,
- sıradan üretim ilerlemesi sessiz,
- boşta geçen süre için modal yok,
- yalnız saldırı, istihbarat, savaş ve kritik sonuçlar öne çıkarılır,
- akışın adı **Stratejik Haber Akışı**dır.

Gerçek Chromium testinde 9 saniyelik arka plan dönüşü tetiklendi; offline modal bulunmadı ve jenerik dönüş toast’u oluşmadı.

---

## 4. Yeryüzü Cephesi → Galaktik Cephe

### 4.1 Evre I — Yeryüzü Cephesi

İlk orbital varlığa kadar:

- uzay baskını zamanlayıcısı çalışmaz,
- yıldız taraması kapalıdır,
- galaktik hedefler oyuncuyu bulamaz,
- tehditler yerel sabotaj ve yağma gruplarından gelir.

Yerel tehditler dekoratif değildir. Sonuçlar:

- stokların belirli bölümünün çalınması,
- gezegen altyapısı bütünlük hasarı,
- tehdit seviyesinin yükselmesi,
- başarılı savunmada hurda ve mekanik parça ganimeti,
- güvenlik gücü ile saldırı gücünün gerçek karşılaştırması.

İlk fabrika yapısı kurulduktan sonra yerel tehdit takvimi başlar. Tamamen boş başlangıçta saldırı zamanlayıcısı yoktur.

### 4.2 Evre II — Galaktik Cephe

Prototip Pazar Uydusu veya ilk orbital varlık operasyonel olduğunda:

- `spaceDetected=true` olur,
- Galaktik Cephe açılır,
- uzay baskını zamanlayıcısı o anda başlar,
- yıldız taraması ve galaktik hedefler erişilebilir hale gelir,
- “İlk yörünge izi tespit edildi” stratejik istihbarat raporu oluşur.

U2’nin eski, kapalı `Base.tickGalaxyLegacy` referansından sızan uzaylı baskını; ana tick ve offline simülasyon seviyesinde ayrıca izole edilmiştir.

---

## 5. OGame–Factory ürün yönü

Bu sürüm, oyunu tam PvP OGame klonuna dönüştürdüğünü iddia etmez. Kimlik kararı şudur:

- **Factory:** oyuncu üretim sistemini fiziksel olarak kurar, yerleşimi ve lojistiği yönetir.
- **OGame:** tehdit, istihbarat, filo, zaman ve savaş sonuçları gerçek stratejik sonuçlar doğurur.
- **Persistent strategy:** zaman ilerler fakat oyuncuya değersiz idle bildirimleri gösterilmez.
- **Server authority:** ortak evrende kaynak, savaş, mülkiyet ve saldırı sonuçları client tarafından kesinleştirilemez.

Sonraki savaş teslimleri gerçek oyuncu keşfi, casusluk, saldırı penceresi, filo önleme, yağma, enkaz, ittifak ve sektör çatışmalarını authority server üzerinde genişletecektir.

---

## 6. Kabul sonuçları

### Node ve regresyon

- **24/24 test paketi PASS**
- U1–U4.3 regresyonları PASS
- 3.000 deterministik stabilite çevrimi PASS
- SQLite restart, CAS, ACK kaybı ve network adapter PASS
- Empty-map reset PASS
- Manual starter rights PASS
- Ground threat outcome PASS
- First-Orbit space gate PASS
- Authoritative stale-reset retry PASS

### Gerçek Chromium

- **6/6 Chromium kapısı PASS**
- Client reset entity: `0`
- Server reset entity: `0`
- Stale server revision sonrası reset: PASS
- 9 saniyelik dönüşte offline modal: yok
- Jenerik offline toast: yok
- Yeryüzü Cephesi başlığı: aktif
- Uzay öncesi tarama: disabled
- Uzaylı/yörünge raporu: `0`
- 390 px yatay taşma: yok
- Beklenmeyen page/console hatası: `0`

---

## 7. Bilinen sınırlar

1. Yeryüzü tehditleri bu sürümde NPC/yerel olay çözümleyicisidir; gerçek oyuncu PvP’si değildir.
2. SQLite hâlâ tek-node kabul/reference deposudur; production ölçeği PostgreSQL ve shard router gerektirir.
3. İlk yerel saldırı dengesi ve süreleri gerçek oyuncu playtest’iyle ayarlanmalıdır.
4. Ortak evrende saldırı, casusluk ve filo hareketleri için gerçek authentication ve server-time scheduler sonraki aşamadadır.

---

## 8. Başkan kararı

**U4.3.1 kabul edildi ve donduruldu.**

Sıradaki ana aşama:

> **U4.4 — PostgreSQL Authority, Authentication & Strategic War Expansion**

Öncelikler:

- PostgreSQL authority adapter ve transaction retry,
- JWT/OAuth actor doğrulaması,
- shard/sector router,
- event-outbox publisher,
- gerçek saldırı/istihbarat zamanlayıcısı,
- 1.000+ eşzamanlı komut ve savaş görevi yük testi.

---

## 9. Durum kaydı

**Source of truth:** `AXYON_Orbital_Ascendancy_v4.5.4_U4.3.1_Groundfront_True_Reset.zip`  
**Sürüm:** `4.5.4-u4.3.1`  
**Save şeması:** `v16`  
**Son karar:** Boş reset, sessiz dönüş ve First-Orbit tehdit kapısı canlı pakete alındı.  
**Sıradaki iş:** U4.4 PostgreSQL authority + gerçek stratejik savaş genişlemesi.  
**Kritik risk:** Tam PvP/saldırı scheduler’ı henüz production backend üzerinde değildir.  
**Bitiş kriteri:** Client/server reset aynı boş state’i üretir; uzay öncesi galaktik tehdit yoktur; yalnız gerçek stratejik olaylar bildirim üretir.
