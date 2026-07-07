# AXYON: Orbital Ascendancy v4.4 U3 — Planetary Bastions
## Entegrasyon, Stabilite ve Kabul Raporu

**Sürüm:** 4.4.0-u3  
**Save şeması:** v16  
**Taban:** v4.4 U2 Decimal Economy & First Orbit  
**Durum:** Release adayı — U3 kabul kapıları geçti

---

# 1. Yönetici özeti

U3 ile oyunun adı **AXYON: Orbital Ascendancy** olarak değiştirilmiş; U2’de çalışan Decimal ekonomi ve First Orbit döngüsü korunarak gezegen/yörünge kapasitesi ile milyon ölçekli cohort savunma sistemleri oynanabilir runtime’a bağlanmıştır.

Bağımsız U2 incelemesinde bulunan arka plan ilerleme kaybı, mobil pinch-to-zoom eksikliği, sessiz kayıt yazma hatası ve mobil safe-area/temel erişilebilirlik açıkları U3 içinde ele alınmıştır.

Ana sonuçlar:

- 10 dakikalık arka plan süresi sayfa yenilenmeden işlendi.
- Aynı süre ikinci kez ödenmedi.
- İki parmak pinch zoom gerçek Chromium içinde kamerayı **1.00 → 1.92** değiştirdi.
- Kasıtlı `QuotaExceededError` kullanıcıya görünür kayıt uyarısı üretti.
- 300×300 haritada viewport culling yalnız **228 / 90000** hücrelik alanı çizim adayına aldı.
- Masaüstü ve 390 px mobil görünümde yatay taşma oluşmadı.
- Ansiklopedi U3 kapasite, altyapı ve savunma kompleksleriyle genişletildi; veri doğrulaması sıfır kırık bağlantıyla geçti.

---

# 2. Marka geçişi

Yeni ürün kimliği:

```text
displayName: AXYON: Orbital Ascendancy
subtitle: Planetary Bastions
shortName: AXYON OA
version: 4.4.0-u3
```

Güncellenen alanlar:

- Oyun başlığı ve üst marka alanı
- PWA manifesti
- Service Worker cache adı
- Onboarding ve ayarlar
- Ansiklopedi
- README ve changelog
- Export metadata ve rapor başlıkları

Eski profil/save anahtarları korunmuştur; isim değişikliği oyuncu ilerlemesini sıfırlamaz.

---

# 3. U3.0 stabilite düzeltmeleri

## 3.1 Arka plan ilerlemesi

Yeni davranış:

1. Uygulama gizlenirken son durum kaydedilir.
2. Canlı tick arka planda ekonomik zamanı sahte biçimde ilerletmez.
3. Uygulama görünür olduğunda `applyOfflineProgress()` bir kez çalışır.
4. Üretim, araştırma, pazar, tersane, tamir ve filo görevleri güncellenir.
5. `lastSeen` yenilenir; aynı süre yeniden yüklemede veya ikinci visibility olayında ödenmez.

Gerçek Chromium testi:

```text
Arka plan: 10dk 0sn
İlk dönüş: offline penceresi gösterildi
İkinci görünürlük olayı: tekrar ödeme yok
```

## 3.2 Pinch-to-zoom

- Aktif pointer’lar `Map<pointerId, position>` ile tutulur.
- İki pointer arasındaki mesafe zoom’a uygulanır.
- Orta nokta dünya koordinatında sabitlenir.
- Pinch sırasında bina taşıma, yerleştirme ve uzun basma yardım çağrısı iptal edilir.
- Zoom sınırı: `0.08–2.8`.

Gerçek Chromium sonucu:

```text
Önceki zoom: 1
Sonraki zoom: 1.92
Sonuç: PASS
```

## 3.3 Görünür kayıt hatası

SaveService artık `axyon:save-error` ve `axyon:save-success` olayları üretir.

Kayıt başarısız olduğunda:

- Üstte kalıcı uyarı görünür.
- Kullanıcı dışa aktarma yoluna yönlendirilir.
- Sahte “kaydedildi” geri bildirimi verilmez.
- Ana kayıt bozuk geçici veriyle ezilmez.

IndexedDB fallback bu sürümde eklenmemiştir; U4 veri dayanıklılığı kapsamındadır.

## 3.4 Mobil ve erişilebilirlik

- `viewport-fit=cover`
- `env(safe-area-inset-*)`
- En az 44 px dokunma hedefleri
- Modal kapatma `aria-label`
- Sekmelerde `aria-selected`
- Açılır alanlarda `aria-expanded`
- Klavye focus görünümü
- `prefers-reduced-motion`
- Canvas üzerinde `touch-action:none`

---

# 4. Gezegen ve yörünge kapasitesi

U3 runtime aşağıdaki eksenleri ayrı ayrı hesaplar:

| Eksen | Anlamı |
|---|---|
| Yüzey Alanı | Açık sektörler ve gezegen türüne bağlı m² sınırı |
| Gezegen Altyapısı | Lojistik, yol, soğutma ve işletim yükü |
| Yörünge Kütlesi | Uydular, filolar, halkalar ve orbital tesisler |
| Yörünge Slotu | Fiziksel orbital konum sınırı |
| Komuta | Filo, uydu ve savunma kontrol yükü |
| Enerji | Canlı güç arzı/talebi |
| Isı | Makineler ve savunmaların termal yükü |
| Bakım | Tesis ve savunmaların bakım ihtiyacı |

Kapasite aşıldığında veri silinmez. Üretim verimi kontrollü olarak düşer ve yeni kurulum engellenir.

## Eski kayıt uyumluluğu

Eski kayıt limit üstündeyse:

- Hiçbir bina otomatik silinmez.
- `Miras Aşımı` durumu işaretlenir.
- Mevcut yapılar korunur.
- Yeni kurulum, oyuncu kapasiteyi artırana veya yapı sökene kadar engellenir.
- Bina silindikten sonra kapasite kilidi güvenli biçimde yeniden hesaplanır.

---

# 5. Altyapı tesisleri

| Tesis | Ana rol | Açan teknoloji |
|---|---|---|
| Gezegen Soğutma Merkezi | Isı kapasitesi | Gezegen Lojistiği |
| Bakım ve Yedek Parça Deposu | Bakım kapasitesi | Bakım Mühendisliği |
| Gezegen Komuta Dizisi | Komuta kapasitesi | Filo Komutası |
| Yörünge Kontrol Düğümü | Orbital kütle, slot ve komuta | Yörünge Komutası |

Kapasite kazandıran bir yapı, mevcut aşımı çözebiliyorsa aşım durumunda da kurulabilir. Böylece oyuncu kapasite ölüm sarmalına girmez.

---

# 6. Savunma kompleksleri ve cohort sistemi

## Kompleksler

- Yüzey Savunma Kompleksi — Mk I–V
- Yörünge Savunma Halkası — Mk I–V

Her kompleks şu sınıflar için ayrı kapasite sağlar:

- Mikro
- Hafif
- Orta
- Ağır
- Stratejik

## Canlı savunmalar

- Acil Durum Manuel Barikatı
- Balistik Taret
- Lazer Nokta Savunması
- Füze Podu
- Önleme Dronu
- Ağır Plazma Bataryası
- Gezegen Kalkan Çekirdeği
- Yörünge Topu

Milyonluk savunmalar ayrı JavaScript nesneleri değildir. Tek bir integer cohort adedi ve operasyonel oranla hesaplanır.

Test sonucu:

```text
Cohort adedi: 1.000.000
Hesap süresi: Node testinde yaklaşık 0.26 ms
Dizi/tekil nesne üretimi: yok
```

## Operasyonel hazırlık

Savunma etkinliği aşağıdakilerin en düşük oranına bağlıdır:

- Enerji
- Isı kapasitesi
- Bakım kapasitesi
- Gerekliyse mühimmat

Acil Barikat:

- Enerji istemez.
- Mühimmat istemez.
- Saldırı gücü üretmez.
- Yalnız sızıntı hasarını sınırlar.
- Normal savunmanın en fazla %5’i kadar kurulabilir; normal savunma yoksa başlangıç kurtarma sınırı 100’dür.

---

# 7. Canvas performansı ve etkileşim

300×300 harita için:

- Grid çizgileri yalnız görünür bounds içinde çizilir.
- Sektör, node ve entity çizimleri viewport ile filtrelenir.
- Konveyör ve güç çizgileri bounding-box görünürlüğüyle elenir.
- Kamera hareketi oyun mantığını veya üretimi değiştirmez.
- Bina taşıma hayalet görünümü korunur.
- Sağ tık yerleştirme engeli korunur.
- Silme sonrası hover/seçim referansları temizlenir.

Gerçek Chromium smoke ölçümü:

| Ölçüm | Sonuç |
|---|---:|
| Test entity sayısı | 1.000 |
| Çizim tekrarı | 120 |
| Toplam süre | 102.7 ms |
| Ortalama çağrı | 0.856 ms |
| Görünür hücre adayı | 228 |
| Toplam harita hücresi | 90000 |

Bu ölçüm kontrollü headless Chromium ortamına aittir; gerçek düşük seviye cihaz performans garantisi değildir.

---

# 8. Teknoloji ekranı ve ansiklopedi

Her araştırma kartı artık açacağı öğeleri açıklamasıyla listeler:

- Makineler
- Santraller
- Gemiler
- Uydular
- Savunmalar
- Altyapı tesisleri
- Savunma kompleksleri
- Gezegen/yörünge/komuta kapasite seviyeleri

Ansiklopediye yeni **Altyapı ve Kapasite** bölümü eklendi:

- Çok katmanlı kapasite modeli
- Dört altyapı tesisi
- İki savunma kompleksi ve Mk tabloları
- Gezegen türü çarpanları
- Araştırmaların açtığı tüm öğeler
- Araştırma verilerinin teknoloji tüketicileri
- Savaş ve enkaz kaynaklı ürünlerin gerçek kaynak açıklamaları

Doğrulama sonucu:

```text
52 teknoloji
50 makine
52 ürün
8 savunma
2 savunma kompleksi
Kırık bağlantı: 0
```

---

# 9. Test matrisi

## Node/regresyon

- Core üretim, araştırma, pazar ve filo
- Profil izolasyonu ve tam sıfırlama
- v16 Decimal kayıt ve unsafe integer migrasyonu
- First Orbit, sentetik yakıt, Mk 0 ve kuruluş sözleşmeleri
- Warfront savaş, enkaz, tamir ve baskınları
- 3.000 deterministik stabilite çevrimi
- Canonical veri ve teknoloji DAG
- DOM/PWA asset sözleşmeleri
- Arka plan ilerleme ve çift ödeme koruması
- Kayıt hata olayı
- Kapasite, miras aşımı ve savunma cohort’ları
- 1.000.000 birim cohort hesabı

## Gerçek Chromium harness

- Masaüstü 1440 px yatay taşma: yok
- 8 ana sekme tek satır: PASS
- Mobil 390 px yatay taşma: yok
- Pinch-to-zoom: PASS
- 10 dakika arka plan: PASS
- İkinci offline ödeme: yok
- Kayıt hatası uyarısı: PASS
- 1.000 entity viewport culling: PASS
- Ansiklopedi U3 render: PASS
- Beklenmeyen console/page hatası: 0

Doğrudan localhost/file navigasyonu çalışma ortamı politikasınca engellendiği için gerçek Chromium; proje HTML, CSS ve JS dosyalarını in-memory test harness üzerinden çalıştırmıştır. DOM, Canvas 2D, PointerEvent ve gerçek Chromium JavaScript motoru kullanılmıştır.

---

# 10. Bilinen sınırlar

1. Gerçek PvP ve inaktif oyuncu işgali için sunucu otoritesi hâlâ yoktur.
2. IndexedDB fallback U4’e bırakılmıştır; U3 yalnız kayıt hatasını görünür ve güvenli hale getirir.
3. Düşük seviye gerçek Android/iOS cihaz testi bu çalışma ortamında yapılmamıştır.
4. Milyon ölçekli savunma tek tek haritada gösterilmez; kompleks içinde cohort/stack olarak temsil edilir.
5. Eski save namespace uyumluluk amacıyla korunmuştur.

---

# 11. Başkan kararı

**U3 kabul edildi.** Marka geçişi, mobil stabilite köprüsü, gezegen/yörünge kapasitesi ve cohort savunma runtime’ı aynı pakette çalışmaktadır.

Sıradaki ana geliştirme:

> **U4 — Research Expansion, Planetary Logistics & Data Durability**

Önerilen U4 öncelikleri:

- IndexedDB ana kayıt/fallback
- Geniş gezegen ve uzay araştırma ağacının kalan canlı entegrasyonu
- Koloni lojistiği ve bölgesel modifier runtime
- Daha gelişmiş kalkan kapsaması ve savunma yerleşim katmanı
- Gerçek cihaz performans ve PWA dayanıklılık testleri

---

# 12. Durum kaydı

**Source of truth:** `AXYON_Orbital_Ascendancy_v4.4.0_U3_Planetary_Bastions.zip`  
**Sürüm:** `4.4.0-u3`  
**Save şeması:** `v16`  
**Son karar:** Oyun adı ve U3 Planetary Bastions sistemleri canlı pakete alındı.  
**Kritik sınır:** Gerçek PvP sunucusu ve IndexedDB henüz yok.  
**Bitiş kriteri:** Node, Chromium, mobil taşma, offline resume, pinch, kapasite ve cohort testleri geçti.
