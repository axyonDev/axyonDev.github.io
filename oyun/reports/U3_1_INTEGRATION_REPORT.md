# AXYON: Orbital Ascendancy v4.5.0 U4
## Save Recovery & Accessibility Hotfix — Entegrasyon ve Kabul Raporu

**Sürüm:** `4.5.0-u4`  
**Save şeması:** `v16`  
**Taban:** `4.4.0-u3 Planetary Bastions`  
**Durum:** Kabul edildi — U4 öncesi hotfix kapısı geçti

---

## 1. Yönetici özeti

U3 bağımsız incelemesinde bulunan geçici kayıt hatası sonrası oturum boyu autosave kilidi kapatılmıştır. Oyun içeriği, ekonomi dengesi, save şeması ve Planetary Bastions runtime değiştirilmemiştir.

U4 ile:

- Geçici `save` hataları 30 saniyelik kontrollü cooldown sonrasında otomatik olarak yeniden denenir.
- Kullanıcı kırmızı uyarı panelindeki **Tekrar Dene** düğmesiyle sayfa yenilemeden anında yeniden yazma deneyebilir.
- Başarılı kurtarmada `blockingError` temizlenir, kayıt doğrulanır ve uyarı kapanır.
- `migration`, `load` ve `legacy` türü yapısal hatalar retry veya genel temizleme ile gevşetilemez.
- Fabrika zoom ve üst ikon butonları gerçek hesaplanan ölçüde en az `44×44 px` yapılmıştır.
- Canlı Cephe açılır alanı `aria-expanded` ve `aria-controls` ile DOM durumuna bağlanmıştır.
- Milyonlarca kayıtlı kullanıcı / binlerce eşzamanlı oyuncu hedefi proje içine kalıcı ölçek mimarisi belgesi olarak eklenmiştir.

---

## 2. Kayıt kurtarma davranışı

### Geçici hata

1. İlk yazma hatası `blockingError.type = "save"` oluşturur.
2. Kalıcı kırmızı uyarı görünür.
3. Cooldown dolmadan normal autosave depolamayı tekrar tekrar zorlamaz.
4. Kullanıcı **Tekrar Dene** ile cooldown beklemeden güvenli deneme yapabilir.
5. Otomatik kayıt 30 saniye sonra sıradan `save()` yolu üzerinden tekrar dener.
6. Başarıda hata ve retry zamanı temizlenir, `axyon:save-success` yayımlanır.
7. Hata sürerse yeni 30 saniyelik retry penceresi oluşturulur.

### Yapısal hata

Aşağıdaki hata türleri güvenlik nedeniyle retry ile açılamaz:

- `migration`
- `load`
- `legacy`

Böylece bozuk veya dönüştürülemeyen kayıt üzerine otomatik yazma yapılmaz.

---

## 3. Erişilebilirlik ve mobil düzeltmeler

- `.icon-btn`: `44×44 px`
- `.fx-zoom`: `44×44 px`
- `#save-warning`: `aria-live="assertive"`
- `#ticker-toggle`: `aria-expanded="false"` başlangıcı
- `#ticker-toggle`: `aria-controls="ticker-list"`
- Aç/kapat işleminde `aria-expanded` gerçek collapsed durumuyla senkronize edilir.
- 390 px mobil görünümde yatay taşma oluşmamıştır.

---

## 4. Test sonuçları

### Node/regresyon

Toplam **11 test paketi** geçti:

- Core ekonomi, üretim, araştırma ve galaksi
- Profil izolasyonu ve tam sıfırlama
- v16 migrasyon, rollback ve exact integer koruması
- First Orbit ve sıfır kredili başlangıç
- Warfront, savaş, enkaz ve bakım
- 3.000 deterministik stabilite çevrimi
- Canonical veri ve araştırma DAG doğrulaması
- DOM/PWA/offline cache sözleşmeleri
- Arka plan ilerlemesi, görünür kayıt hatası ve marka
- U4 manuel/otomatik save recovery ve erişilebilirlik
- Çok eksenli kapasite ve 1.000.000 birim cohort

Son cohort ölçümü:

```text
1.000.000 birim cohort
Yaklaşık hesap süresi: 0.30 ms
Tekil nesne/dizi üretimi: yok
```

### Gerçek Chromium

```text
Pinch zoom:               1.00 → 1.92 PASS
10 dakika background:     PASS
İkinci ödeme:             yok
Save warning:             görünür PASS
Sayfa yenilemeden retry:  PASS
blockingError sonrası:    null
Ticker aria-expanded:     false → true PASS
Icon touch target:        44×44 px
Zoom touch target:        44×44 px
Viewport adayı:           228 / 90000 hücre
Ortalama draw:            ~0.98 ms
Mobil 390 px overflow:    yok
Beklenmeyen page error:   0
Beklenmeyen console error:0
Codex kırık bağlantı:     0
```

---

## 5. Ölçek hedefi

Proje hedefi artık paket içinde `docs/SCALABILITY_GUARDRAILS.md` ile kayıtlıdır:

- Milyonlarca kayıtlı kullanıcı
- Binlerce eşzamanlı aktif oyuncu
- Sunucu otoriteli ekonomi, zaman, pazar, savaş ve mülkiyet
- İdempotent işlem kimlikleri
- Sürekli oyuncu başı tick yerine lazy production
- Sektör/shard ile yatay ölçeklenebilir evren
- Event-driven servis sınırları
- Cohort/aggregate büyük sayı modeli
- Anti-cheat ve istemci verisine güvensizlik

Mevcut U4 paket local-first prototiptir; çok oyunculu backend hazır olduğu iddia edilmemektedir.

---

## 6. Bilinen sınırlar

1. IndexedDB ana kayıt/fallback henüz yoktur; U4 kapsamındadır.
2. Gerçek çok oyunculu backend ve sunucu otoritesi henüz yoktur.
3. Gerçek düşük seviye Android/iOS cihaz testi yapılmamıştır.
4. Local save gelecekteki ortak evrende otorite kabul edilmeyecektir.
5. Gerçek PvP, pazar ve inaktif oyuncu işgali sunucu doğrulaması olmadan açılmayacaktır.

---

## 7. Başkan kararı

**U4 kabul edildi.** Claude bağımsız incelemesindeki geçici kayıt hatası, 44 px ve `aria-expanded` açıkları kapatılmıştır.

Sıradaki ana geliştirme:

> **U4 — Data Durability & Server-Ready Domain Foundation**

Öncelik:

1. IndexedDB storage adapter + localStorage compatibility
2. Kayıpsız v16 geçiş ve rollback
3. Ekonomi/savaş kurallarının UI ve storage katmanından ayrılması
4. İşlem kimliği ve event kayıt sözleşmesi
5. Gerçek cihaz/PWA dayanıklılık testleri

---

## 8. Durum kaydı

**Source of truth:** `AXYON_Orbital_Ascendancy_v4.4.1_U4_Save_Recovery_Hotfix.zip`  
**Sürüm:** `4.5.0-u4`  
**Save şeması:** `v16`  
**Son karar:** U4 hotfix kabul edildi.  
**Sıradaki iş:** U4 P0 — IndexedDB storage adapter.  
**Kritik risk:** Ortak evrene geçmeden önce istemci kayıtlarının sunucu otoritesinden kesin ayrılması.  
**Bitiş kriteri:** Eski kayıt kaybolmadan IndexedDB geçişi, rollback ve gerçek cihaz testleri.
