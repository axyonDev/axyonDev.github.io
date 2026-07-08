# P0 — Gerçek Uzaysal Factorio Çekirdeği (Dikey Dilim) — Entegrasyon Raporu

**Taban:** `4.5.5-u4.3.2` (Power Discipline) · Save şeması `v16`
**Eklenen:** `src/core/spatial-sim.js` (yeni, bağımsız modül) + `tests/p0-spatial-sim.js`
**Durum:** Kanıt dikey dilimi PASS — çalışan çekirdek. Henüz UI'ya/ana tick'e BAĞLANMADI (kasıtlı; S1 stabil temel).

## Ne yapıldı

Birleşik yol haritasının §7 spesifikasyonuna göre, aggregate üretim modelinin YANINA
gerçek uzaysal simülasyon çekirdeği kuruldu. `economy.js` ve güç runtime'ı SHA olarak
DEĞİŞMEDİ — çalışan sistem korundu. Yeni modül tamamen bağımsız ve deterministik.

Modelde konum ve bağlantı üretimi belirler:
- **Per-entity buffer:** madenci outBuf, fırın inBuf/outBuf (kısıtlı kapasite).
- **Bant = transport line:** item'lar slot dizisinde pozisyon tutar (ayrı entity değil);
  çıkışa doğru tik başına 1 slot ilerler; çıkış boşalmazsa arkada birikir (doygunluk).
- **Inserter = transfer kuralı:** kaynak.outBuf ↔ bant ↔ hedef.inBuf; hedef doluysa taşımaz.
- **Güç = graf-bağlantı:** BFS ile bileşen; yakıtlı santralle aynı bileşende değilse powered=false.
- **Tükenme:** her yatağın remaining'i azalır; 0'da madenci boşta kalır.
- **Merkezi ambar:** market/araştırma/gemi buradan çeker (eski `s.inventory`'nin yeni rolü).

## Kabul sonuçları

| Bitiş kriteri | Assertion | Sonuç |
|---|---|---|
| Tam zincir akıyor | 0 | PASS |
| **Bant kesilince fırın durur** | 1a,1b,1c | PASS |
| **Çıkış dolunca tıkanır (backpressure)** | 2a,2b,2c,2d | PASS |
| **Yatak tükenince madenci durur** | 3a,3b,3c | PASS |
| **Güç yoksa üretim 0** | 4a,4b,4c,4d,4e | PASS |
| **Eski v16 kayıt 0 crash yüklenir** | 5a,5b,5c,5d | PASS |
| **TOPLAM** | **20/20** | **PASS** |

Regresyon: mevcut 25 test paketi bozulmadan PASS (26. sıraya P0 eklendi).

## Aggregate modelden kanıtlanan fark

Eski `runMachine` tek global `s.inventory`'ye yazıyordu; makinenin yeri/bağlantısı üretimi
etkilemiyordu. Yeni çekirdekte **bant silindiğinde fırının girdisi tükenir ve üretim durur** —
bu, "Factorio ruhu"nun (uzaysal bağımlılık) kodda ilk kez gerçek olduğu andır.

## Sıradaki adım (P0 → P1 köprüsü)

1. **UI/canvas bağlama:** `factory-canvas.js` bant/inserter çizimini bu modelin `slots`/
   `saturated` durumuna bağla (akan ikon zaten ayrık → düşük risk).
2. **Ana tick entegrasyonu:** feature-flag `spatialSim` ile; kapalıyken eski aggregate,
   açıkken yeni motor (geri dönüş garantisi).
3. **Genişletme:** tek 8x8 bölgeden tüm haritaya; active-set scheduler + ekran-dışı LOD
   (mobil performans için §7.6).
4. **v16 → v17 migrator:** `loadLegacyIntoWarehouse` çekirdeğini tam save-service'e bağla.

Bu dört adım tamamlanmadan aggregate motor canlı kalır; yeni motor flag arkasında olgunlaşır.
