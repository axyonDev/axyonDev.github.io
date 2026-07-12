# P1 — Spatial Bridge (Gölge Modu) — Entegrasyon Raporu

**Taban:** `4.5.6-u4.3.3` Factory Intelligence · Save `v16`
**Eklenen:** `src/core/spatial-bridge.js` + `tests/p1-spatial-bridge.js` + feature-flag kaydı
**Durum:** Gölge köprüsü PASS (23/23). Canlı ekonomi DEĞİŞMEDİ (SHA sabit).

## Karar gerekçesi (neden tam geçiş değil, gölge?)

Canlı `economy.js`'i bir turda söküp yerine spatial motoru koymak S1 (stabil temel),
S9 (veri koruması) ve S15 (gerçek test) kurallarını ihlal ederdi. Kaydedilen karar da
"flag arkasında olgunlaşana kadar aggregate canlı kalır" diyor. Bu yüzden köprünün ilk
tuğlası **gölge (shadow) modu**: spatial motor gerçek grid'i aynen kurup **gerçek
per-entity telemetri** üretir, ama canlı üretim matematiğine dokunmaz.

## Garantiler (test edildi)

- **Flag KAPALI → tam no-op.** `shadowTick` null döner, state hiç değişmez. (varsayılan)
- **Flag AÇIK → canlıya sıfır dokunuş.** 30 tik sonra `inventory`, `machines`, `grid`
  byte-byte aynı. Yalnız `state._spatial` (telemetri) yazılır.
- **Mirror WeakMap'te** → save'e sızmaz, kalıcılaşmaz.
- **Doğru eşleme:** entity→miner/furnace/plant, konveyör→bant+2 inserter, powerLine→güç.
- **Gölgede gerçek fizik:** bağlıyken akış var; güç hattı yoksa üretim 0.
- **Topoloji değişince** imza değişir → köprü otomatik yeniden kurar.

## Kabul sonuçları

| Kapı | Sonuç |
|---|---|
| Flag gating (no-op / temizleme) | PASS (1a-c, 7a-c) |
| Canlı ekonomiye sıfır mutasyon | PASS (2a-d) |
| Grid → spatial eşlemesi | PASS (3a-f) |
| Gölgede akış + güç kapısı | PASS (4a-c, 5a-b) |
| Topoloji yeniden kurulum | PASS (6a-b) |
| **TOPLAM** | **23/23 PASS** |

Regresyon: economy.js / güç runtime / P0 modülü SHA sabit. Tam süre yeşil (P0 20/20, P1 23/23).

## Bağlama (in-game, tek satır)

```js
const defs = SpatialBridge.defsFromEconomy(Economy, Data);
// ana tick sonunda:
SpatialBridge.shadowTick(state, defs, dt);
// durum çekmecesi (U4.3.3) artık gölge telemetriyi de gösterebilir:
const t = SpatialBridge.report(state); // {machines:[{powered,eff,inBuf,outBuf}], belts:[{fill,saturated}]}
```

## Sıradaki adımlar (gölge → tam geçiş)

1. **Canvas görselleştirme:** bant `fill/saturated` ve inserter durumunu `factory-canvas.js`'e
   çiz (akan ikon zaten ayrık → düşük risk). Oyuncu gölgeyi GÖRÜR ama ekonomi hâlâ aggregate.
2. **Paralel doğrulama:** gölge üretim oranı ile canlı aggregate oranı yan yana loglanır;
   sapma kabul eşiği içinde mi? (playtest verisi).
3. **Tam geçiş (ekonomi devri):** yalnız gölge/aggregate paritesi kanıtlanınca `runMachine`
   çağrısı spatial `step`'e devredilir; ambar = tek envanter olur.
4. **v16 → v17 migrator:** `spatial-sim.loadLegacyIntoWarehouse` çekirdeği save-service'e bağlanır.
5. **active-set scheduler + mobil LOD** kabul testleri.

Adım 3'e (geri dönüşü zor) yalnız 1-2 kanıtlandıktan sonra geçilir.
