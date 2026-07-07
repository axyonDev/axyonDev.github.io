# Axyon Idle Factory: First Orbit & Dominion — v4.4 U2 Economy

Bu paket, v4.4’ün ilk yörünge ekonomisini gerçek oynanabilir tabana bağlayan ikinci uygulama katmanıdır. U1’de kurulan Save v16 ve canonical veri temeli korunur; kredi, stok, üretim ve maliyet akışları artık `EconomyNumber` üzerinden Decimal-native çalışır.

## U2’de etkin olanlar

- Save v16 ve kayıpsız v15 → v16 migrasyon
- `break_eternity.js@2.1.3` arkasında merkezi `Axyon.EconomyNumber`
- Decimal-native kredi, stok, üretim, akış, maliyet ve pazar işlemleri
- Yeni oyunda **0 kredi**
- Tek sektörlük başlangıç ve birer demir, bakır, kömür kaynağı
- 120 güçlük geçici iniş reaktörü ve tek seferlik başlangıç makineleri
- Para yerine gerçek malzeme tüketen makine ve santral inşası
- Süreli sektör taraması
- İlk genişlemede su ve taş garantisi
- Petrol rotası ve petrolsüz sentetik yakıt rotası
- RP-1, Sıvı Oksijen, Basınçlı Azot ve Mk 0 uydu zinciri
- Prototip Pazar Uydusu Mk 0
- Toplam 13.500 kredi veren üç kuruluş sözleşmesi
- 12.000 kredi maliyetli Pazar Ağı Mk I ve garantili 1.500 kredi bakiyesi
- Yerel satışın kapalı kalması; bütün ticaretin uydu kotası ve sefer süresiyle yapılması
- Çevrimdışı üretim ve cezalandırıcı baskının sessiz çözülmemesi
- Warfront savaş, enkaz, filo ve tamir sistemlerinin korunması
- U2 verisini kullanan ansiklopedi ve offline cache

## İlk yörünge akışı

```text
Demir + Bakır + Kömür
→ Temel üretim ve elektronik
→ Sektör Tarama Modülü
→ Su / taş / petrol keşfi veya sentetik yakıt rotası
→ RP-1 + Sıvı Oksijen + Basınçlı Azot
→ Prototip Pazar Uydusu Mk 0
→ 3 kuruluş sözleşmesi
→ 13.500 kredi
→ Pazar Ağı Mk I
→ 1.500 kredi başlangıç bakiyesi
```

## Kayıt güvenliği

- v15 ham kayıt migrasyon öncesi yedeklenir.
- Güvensiz büyük integer literal JavaScript Number’a çevrilmeden okunur.
- v16 kayıt geçici anahtarda doğrulanır.
- Commit hatasında eski kayıt otomatik geri yüklenir.
- Bozuk kayıt aktif kaydın üzerine yazılmaz.
- Büyük ekonomi alanları string olarak saklanır ve runtime’da Decimal nesnesine dönüştürülür.

## Bilinçli sınırlar

U2 henüz v4.4’ün tamamı değildir. Şunlar sonraki uygulama katmanlarına aittir:

- P2 tasarımındaki m² / altyapı / ısı / bakım kapasitesinin tam canlı oynanışı
- Milyonluk cohort savunmaların gerçek UI ve savaş entegrasyonu
- Genişletilmiş OGame araştırma/filo ağacının tamamı
- Gerçek PvP sunucu otoritesi

## Test

Windows: `run-tests.bat`

Linux/macOS: `./run-tests.sh`

Geçen ana kontroller:

- Core üretim, araştırma, pazar, filo ve tamir regresyonları
- Sıfır kredili ilk yörünge akışı
- Petrol ve petrolsüz keşif rotaları
- Mk 0 uydu ve üç kuruluş sözleşmesi
- Pazar Mk I sonrası 1.500 kredi garantisi
- Yerel satışın kapalı kalması
- Decimal v16 round-trip ve unsafe integer migrasyonu
- Bozuk kayıt rollback ve profil izolasyonu
- 3.000 deterministik ekonomi/savaş/tamir çevrimi
- Canonical veri, DAG, tarif ve DOM kontratları
- Masaüstü ve mobil gerçek Chromium render smoke testi

## Source of truth

- Tasarım: `Axyon_v4.4_Final_Design_Freeze_Report.md`
- Canonical veri: `data/canonical/game-data.v4.4.final.json`
- Save şeması: `data/canonical/save-state-v16.schema.json`
- Oynanabilir U2 tabanı: bu paket

## Sıradaki uygulama katmanı

**U3 — Planet Capacity & Cohort Defense Runtime**

Gezegen yüzey alanı, altyapı yükü, yörünge kapasitesi, enerji/ısı/bakım sınırları ve cohort savunmalar gerçek oynanışa bağlanacaktır.
