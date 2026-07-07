# Axyon Idle Factory v4.4 U2 — Decimal Economy & First Orbit Integration Report

**Sürüm:** 4.4.0-u2  
**Save şeması:** v16  
**Taban:** v4.4 U1 Foundation + Warfront Command oynanışı  
**Durum:** U2 entegrasyonu ve regresyon kapıları geçti

## 1. Net sonuç

U2, v4.4 tasarımındaki ilk yörünge ekonomisini gerçek oynanabilir tabana bağladı. Kredi, stok, üretim, akış, araştırma maliyetleri, inşa maliyetleri ve pazar hesapları artık `Axyon.EconomyNumber` üzerinden Decimal-native çalışmaktadır.

Yeni oyuncu sıfır krediyle başlar. Gezegen kaynaklarını kullanarak ilk sanayiyi kurar, sektör tarar, petrol veya sentetik yakıt rotasını tamamlar, Prototip Pazar Uydusu Mk 0’ı fırlatır ve üç kuruluş sözleşmesiyle kredi ekonomisini açar.

## 2. U2’de etkinleştirilen sistemler

### Decimal-native ekonomi

- Kredi ve toplam kazanç
- Envanter ve üretim toplamları
- Anlık üretim akışları
- Makine ve santral malzeme maliyetleri
- Araştırma maliyetleri
- Pazar satışları ve gelirleri
- Büyük sayı kayıt/yeniden yükleme işlemleri

Büyük ekonomi değerleri v16 kayıtta string olarak saklanır. Oyun modülleri doğrudan Decimal çağırmaz; merkezi EconomyNumber adaptörünü kullanır.

### Sıfır kredili başlangıç

- Başlangıç kredisi: 0
- Kredi göstergesi ilk yörünge ticareti açılana kadar “Kilitli”
- Bir açık başlangıç sektörü
- Garantili birer demir, bakır ve kömür kaynağı
- Tek seferlik yedi başlangıç makinesi
- 120 güçlük geçici iniş reaktörü
- Yeni bina ve santraller kredi değil gerçek malzeme tüketir

### Keşif ve yakıt rotaları

- Süreli sektör taraması
- İlk genişlemede su ve taş garantisi
- Normal rotada ham petrol garantisi
- Petrolsüz rotada ek kömür ve sentetik yakıt zinciri
- Petrolsüz rota ham petrole bağımlı değildir
- RP-1 / Roket Gazyağı
- Sıvı Oksijen
- Basınçlı Azot
- İleri aşamada Xenon yükseltmesine hazır veri modeli

### İlk yörünge ve kredi ekonomisi

- Prototip Pazar Uydusu Mk 0
- Kredi maliyeti olmadan kaynakla üretim
- Tek prototip sınırı
- Uydu üretim/fırlatma kuyruğu
- Üç kuruluş sözleşmesi
- Sözleşme başına 4.500 kredi
- Toplam garanti: 13.500 kredi
- Pazar Ağı Mk I maliyeti: 12.000 kredi
- Pazar açılışı sonrası garanti bakiye: 1.500 kredi
- Yerel satış tamamen kapalı
- Normal ticaret uydu kotası ve sefer süresiyle çalışır

## 3. Korunan eski sistemler

U2 dönüşümü sırasında aşağıdaki Warfront sistemleri korunup Decimal-safe köprüden geçirildi:

- Mk I–V bina ve santral yükseltmeleri
- Otomasyon
- Filo üretimi
- Yıldız haritası ve görevler
- Uzay savaşları ve raporlar
- Enkaz
- Hasarlı gemi ve savunmalar
- Tamir kuyrukları
- Gezegen/yörünge/uydu bütünlüğü
- Baskınlar
- Profil izolasyonu
- Tam sıfırlama
- Dışa/içe aktarma

## 4. Kayıt ve migrasyon güvenliği

Doğrulananlar:

- v15 → v16 kayıpsız migrasyon
- Unsafe integer ham metninin korunması
- Migrasyon öncesi değişmez yedek
- Geçici kayıt ve test yüklemesi
- Commit hatasında rollback
- Bozuk/truncated kayıtta aktif veriyi koruma
- Sıfırlama sonrası geçerli v16 kayıt oluşturma
- Profil bazlı kayıt ayrımı
- Büyük sayı round-trip

## 5. Test sonuçları

### Node/regresyon paketi

- Core üretim, araştırma, pazar, filo ve görevler: PASS
- Profil izolasyonu ve gerçek sıfırlama: PASS
- U1 kayıt/migrasyon temel regresyonu: PASS
- U2 First Orbit akışı: PASS
- Warfront savaş, enkaz ve tamir regresyonu: PASS
- 3.000 deterministik ekonomi/savaş/tamir çevrimi: PASS
- Canonical veri ve tarif bütünlüğü: PASS
- DOM, asset, offline-cache ve script sırası: PASS

### Gerçek Chromium smoke testi

Masaüstü 1440×1000 ve mobil 390×844 görünümünde:

- İlk komutan onboarding’i açıldı
- Profil başarıyla oluşturuldu
- Başlangıç kredi alanı “Kilitli” gösterildi
- First Orbit durum kartı çizildi
- Üç kuruluş sözleşmesi çizildi
- Teknoloji ve depo ekranları açıldı
- Yatay sayfa taşması oluşmadı
- JavaScript page error: 0
- Console error: 0

Çalışma ortamı localhost navigasyonunu engellediği için Chromium testi yerel dosyaları kontrollü route üzerinden sunan, gerçek render motoru kullanan test origin’i ve bellek içi localStorage shim’i ile yürütüldü.

## 6. Otomatik kabul değerleri

| Kriter | Sonuç |
|---|---:|
| Yeni oyun kredisi | 0 |
| İlk açık sektör | 1 |
| Demir/bakır/kömür garantisi | PASS |
| İlk su/taş keşfi | PASS |
| Petrol rotası | PASS |
| Petrolsüz sentetik rota | PASS |
| Mk 0 uydu Xenon olmadan çalışır | PASS |
| Kuruluş sözleşmeleri toplamı | 13.500 |
| Pazar Mk I maliyeti | 12.000 |
| Pazar sonrası bakiye | 1.500 |
| Yerel satış | Kapalı |
| Decimal v16 round-trip | PASS |
| Eski savaş/tamir regresyonları | PASS |

## 7. Bilinçli sınırlar

U2, dondurulmuş v4.4 tasarımının tamamı değildir. Şu sistemler henüz canlı oynanışa geçirilmemiştir:

- Gezegen m² ve altyapı yükü sisteminin tam runtime/UI entegrasyonu
- Enerji, ısı ve bakım çoklu kapasite sistemi
- Milyonluk cohort savunmaların gerçek oynanışı
- Genişletilmiş gezegen/yörünge/savaş araştırma ağacının tamamı
- Gerçek PvP ve sunucu otoritesi

Bu sistemlerin veri ve simülasyon kapıları P2/P3 tasarım paketlerinde geçmiştir; oynanabilir entegrasyon sonraki uygulama katmanlarında yapılacaktır.

## 8. Son karar

U2 kabul edilmiştir. Save v16, Decimal ekonomi ve ilk yörünge kredi açılışı oynanabilir pakete güvenle bağlanmıştır.

**Sıradaki iş:** U3 — Planet Capacity & Cohort Defense Runtime  
**Kritik risk:** P2 kapasite modelini canlı oyuna bağlarken mevcut fabrika yerleşimlerini ve eski kayıtları zorla geçersiz kılmamak.  
**Bitiş kriteri:** Gezegen alanı, altyapı, yörünge, enerji, ısı ve bakım limitleri mevcut kayıtları koruyarak çalışmalı; cohort savunma hesabı tekil milyonlarca nesne oluşturmamalıdır.
