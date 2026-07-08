# AXYON: Orbital Ascendancy — Factorio × OGame Birleşik Teknik Denetim ve Yol Haritası

**Sürüm tabanı:** `4.5.4-u4.3.1` · Save şeması `v16`
**Uygulama kaydı:** `4.5.5-u4.3.2` ile kaynakta anında kurulum, deterministik ESC/geri iptali ve santral+yakıt+hat zorunluluğu tamamlandı. Sıradaki ana iş P0 `spatial-sim.js` dikey dilimidir.
**Kapsam:** "Factorio'nun tüm mekanikleri + OGame'in tüm mekanikleri, Axyon farkıyla" hedefine göre kod tabanının tam (Level‑3) denetimi ve baştan yön kararı.
**Yöntem:** Kaynak kod (`economy.js`, u2/u3 runtime'ları, `factory-canvas.js`, canonical veri seti) satır satır okundu ve canlı Node testleriyle doğrulandı. Bu belge dört kaynağı **tek source of truth** altında birleştirir:
1. v4.3.0 Bağımsız Denetim (deadlock + canvas perf bulguları)
2. Factorio × OGame Hibrit Denetimi (uzaysal simülasyon boşluğu)
3. U4.3.1 Groundfront Teslim Raporu (boş reset, sessiz dönüş, First‑Orbit kapısı)
4. Bu oturumun taze kod doğrulaması

> **Kural:** Hiçbir madde varsayımla yazılmadı. Her iddia ya doğrudan kod referansıyla ya da canlı testle kanıtlandı.

---

## 0. TEK CÜMLELİK KRİTİK GERÇEK

Yol haritasını belirleyen tek mimari gerçek şudur; geri kalan her şey buna bağlıdır:

> **Bugünkü "fabrika" görsel olarak bir grid/yerleşim sunuyor, ama üretim matematiği tamamen bir _idle/aggregate_ modelidir. Factorio'nun asıl vaadi olan _uzaysal simülasyon_ — nesnelerin bantlarda fiziksel akması, komşuluk/bağlantı zorunluluğu, tıkanma/geri‑basınç — kodda YOKTUR.**

Kanıt (bu oturumda doğrulandı):

- `runMachine()` bir makinenin girdi/çıktısını **tek global sözlükten** okuyup yazıyor: `s.inventory[k]`. Makinenin haritada nerede durduğu, neye bağlı olduğu üretime **hiç etki etmiyor**.
- `computePower()` tek bir **global arz/talep oranı** hesaplayıp her makineye uyguluyor; `powerLines` hiç okunmuyor.
- `addConveyor(s,from,to)` fonksiyonunun **tamamı** iki ID'yi bir listeye eklemek: hız yok, kapasite yok, yön yok, tıkanma yok.
- 50 makinenin **hiçbirinde** birden fazla tarif yok (`multi=0`).
- `blueprint`, `circuitNetwork`, `logicGate`, gerçek `fluid/pipe` simülasyonu, kaynak `richness/depletion`: **hiçbiri yok**.

**Sonuç:** Bugün "10 madeni bir yere, 3 fırını başka yere koysanız da, hiç bağlamasanız da" üretim sonucu birebir aynıdır. Grid/canvas katmanı gerçek ve iyi yapılmış (viewport culling, pan/zoom, pinch), ama **üretim motoru bu grid'i görmüyor.**

Bu bir eleştiri değil, konum tespitidir. "Factorio'yu aynen istiyorum" dediğiniz an, tek ve en büyük karar budur: **üretim motorunu aggregate'ten gerçek uzaysal simülasyona taşımak.**

---

## 1. YÖNETİCİ ÖZETİ (birleşik durum)

| Katman | Gerçek durum | Kaynak |
|---|---|---|
| **OGame tarafı** (filo, savaş, casusluk, enkaz, savunma) | ✅ **Olgun ve gerçek.** Çoğu indie oyunun ulaşamadığı derinlik. | Hibrit denetim + kod |
| **Sunucu otoritesi** (idempotent komut, CAS, SQLite kalıcı store, reconciliation) | ✅ **Çok iyi.** OGame'in "sunucu her şeyi belirler" ilkesine mimari olarak zaten hazır. | U4.1–U4.3 |
| **Fabrika UX/görsel** (canvas, grid, yerleşim, akan ikon, pan/zoom) | ✅ **Gerçek ve iyi.** İskelet sağlam. | v2.2 + kod |
| **Fabrika _simülasyonu_** (Factorio'nun ruhu) | ❌ **Aggregate idle modeli.** Uzaysal fizik yok. | Bu oturum |
| **Galaksi haritası** (keşfedilebilir koordinat evreni) | ❌ **Düz hedef listesi.** Koordinat sistemi yok. | Kod |
| **Çoklu gezegen / koloni** | ❌ **İçi boş sayaç.** Ayrı ekonomi yok, sadece `+%4` çarpan. | Kod |
| **Gerçek PvP / ittifak** | ❌ Yok (bilinen, dürüstçe disclosed). | U4.4 planı |

**Bir cümlelik kimlik teşhisi:** Proje şu an *"OGame'in üstüne Industry‑Idle tarzı bir fabrika teması giydirilmiş"* durumda — *"Factorio'nun üstüne OGame"* değil. "Aynen Factorio" hedefi için yapılacak asıl iş OGame'i derinleştirmek değil (zaten iyi), **Factorio tarafını gerçek uzaysal simülasyona çevirmektir.**

---

## 2. FACTORIO — TAM MEKANİK ENVANTERİ

Her satır: **Factorio'daki hali → Axyon'daki durum → yapılacak.** İstediğiniz gibi *hiçbir mekanik atlanmadı*.

| # | Factorio mekaniği | Axyon durumu | Karar |
|---|---|---|---|
| F1 | **Kaynak çıkarma** (maden matkabı, cevher yatağı) | ⚠️ Var ama sonsuz | `remaining/richness` ekle → tükenme |
| F2 | **Yatak zenginliği / tükenmesi** | ❌ Yok | F1 ile |
| F3 | **Tarifler** (assembler, tarif seçimi) | ⚠️ Tek makine = tek tarif | Çok tarifli assembler |
| F4 | **El üretimi / karakter envanteri** | ⚠️ `manualClick` var, envanter soyut | Uzaysal geçişte gözden geçir |
| F5 | **Bantlar** (belt) | ❌ **Kozmetik çizgi** | **P0 çekirdek: gerçek transport line** |
| F6 | **Splitter / birleştirici / öncelik / filtre** | ❌ Yok | P1 |
| F7 | **Alt geçit bantı** (underground belt) | ❌ Yok | P2 |
| F8 | **Inserter'lar** (kavrayıcı, filtreli, stack) | ❌ Yok (kavram bile yok) | **P0 çekirdek: makine↔bant transferi** |
| F9 | **Enerji şebekesi** (direk, tel erişimi, kopuk şebeke çalışmaz) | ❌ Global havuz, bağlantı kozmetik | **P0 çekirdek: graf‑bağlantı gücü** |
| F10 | **Akümülatör / güneş / buhar / nükleer** güç dengesi | ⚠️ Santral var, denge global | P1 (şebeke gerçekleşince) |
| F11 | **Sıvılar** (boru, pompa, tank, throughput) | ❌ Yok (rafineri var ama katı‑item tarifi) | P2 |
| F12 | **Modüller** (hız/verimlilik/üretkenlik) + **Beacon** | ❌ Yok (tek boyutlu "seviye" var) | P2 |
| F13 | **Araştırma ağacı** (bilim paketleri) | ✅ **Gerçek DAG**, 52 tech, çoklu önkoşul | Koru; "paket taşıma" P3 |
| F14 | **Bilim paketini laboratuvara taşıma** (lojistik) | ❌ Yok (araştırma soyut harcıyor) | P3 (uzaysal olunca) |
| F15 | **Blueprint / kopyala‑yapıştır / kitap** | ❌ Yok | P2 |
| F16 | **Yıkım/yükseltme planlayıcı** (deconstruction/upgrade planner) | ❌ Yok | P2 |
| F17 | **Devre ağı** (tel, combinator, koşul, sensör) | ❌ Yok (`autoSellKeep` hariç) | P3 (basit koşul motoru) |
| F18 | **Trenler** (ray, istasyon, sinyal, zamanlama) | ❌ Yok (tek grid → mimari gereği gereksiz) | Çoklu gezegen sonrası opsiyonel |
| F19 | **Robotlar** (inşa/lojistik bot, roboport, talep) | ❌ Yok (tamir kuyruğu var, bot değil) | P3 |
| F20 | **Kirlilik → düşman baskısı** | ⚠️ Farklı model: "Yeryüzü Cephesi" tehdidi fabrika büyüklüğüne bağlı | Kavramsal karşılık var; kirlilik yayılımı P3 |
| F21 | **Düşman yuvaları / evrim / genişleme** | ⚠️ NPC yerel tehdit var, yuva/evrim yok | Genişletilebilir |
| F22 | **Askeri** (taret, duvar, kapı, zırh, silah) | ⚠️ OGame savunması var, Factorio kara savunması farklı | Yeryüzü Cephesi savunmasıyla köprüle |
| F23 | **Depolama** (sandık, lojistik sandık, sınır) | ✅ `storageCap` var (aggregate ama işlevsel) | Uzaysal olunca sandık‑tabanlı |
| F24 | **Arazi/harita** (biyom, su, uçurum, radar keşfi) | ⚠️ Sektör keşfi var, biyom yok | Tema kararı |
| F25 | **Space Age**: uzay platformu, çoklu gezegen, kalite kademesi, bozulma (spoilage) | ❌ Yok | AXYON teması buna çok uygun — uzun vade |
| F26 | **Araçlar** (araba, tank, spidertron) | ❌ Yok | Kapsam dışı (kimlik gereği) |
| F27 | **Milestone / başarım / ilerleme** | ✅ Var (milestoneMult, achievements) | Koru |

**Özet:** Araştırma ağacı (F13) ve depolama (F23) Factorio ruhuna en yakın hazır sistemler. **En kritik dört eksik ve P0 çekirdeği: F5 (bant), F8 (inserter), F9 (güç şebekesi), F1‑F2 (tükenme).** Bu dördü olmadan "Factorio hissi" oluşmaz; bu dördü olunca oyun anında Factorio'ya dönüşmeye başlar.

---

## 3. OGAME — TAM MEKANİK ENVANTERİ

| # | OGame mekaniği | Axyon durumu | Karar |
|---|---|---|---|
| O1 | **Kaynaklar** (metal/kristal/döteryum + enerji bağımlılığı) | ✅ Kaynak zinciri gerçek | Koru |
| O2 | **Binalar** (maden, depo, robotik, tersane, lab, nanit) | ✅ Karşılık var | Koru |
| O3 | **Enerji** (güneş, füzyon, uydu, enerji tech) | ✅ Var (global model) | F9 ile gerçekleşir |
| O4 | **Araştırma ağacı** (tahrik, silah, kalkan, zırh, casusluk, astrofizik, graviton…) | ✅ 52 tech DAG | Koru; astrofizik/graviton karşılığı ekle |
| O5 | **Filo / gemi tipleri** (10 gemi, gerçek stat + yakıt) | ✅ **İyi modellenmiş** | Koru |
| O6 | **Rapid‑fire matrisi** (gemi‑tipi vs gemi‑tipi ekstra vuruş) | ❌ Yok (agregat hull havuzu) | P2 taktik savaş |
| O7 | **Savaş** (turlu, kalkan/zırh, olasılıksal, enkaz üretimi) | ✅ **6 turlu, gerçek** (en "OGame" sistem) | Koru; O6 ile derinleştir |
| O8 | **Savunma yapıları** (roket→plazma→kalkan kubbesi, ABM) | ✅ 8 tip, Mk I‑V | Koru |
| O9 | **Casusluk** (sonda, rapor seviyesi, karşı‑casusluk) | ✅ `intelLevel` 0‑3 | Koru |
| O10 | **Filo görevleri** (saldırı/taşıma/deploy/kolonize/enkaz/casus/ACS/keşif) | ⚠️ Çoğu var; ACS/keşif/expedition eksik | Genişlet |
| O11 | **Galaksi koordinat evreni** (galaksi:sistem:pozisyon, gezilebilir) | ❌ **Düz hedef listesi** | P2: 2D koordinat sistemi |
| O12 | **Kolonizasyon / çoklu gezegen** (her gezegen ayrı ekonomi, alan/sıcaklık) | ❌ **İçi boş sayaç** (`+%4`) | **P3: gerçek ikinci ekonomi** |
| O13 | **Aylar** (enkazdan ay, sıçrama kapısı, phalanx, ay yıkımı) | ❌ Yok | Uzun vade |
| O14 | **Keşif seferleri** (expedition, karanlık madde) | ❌ Yok | Endless Frontier ile köprülenebilir |
| O15 | **Uçuş süresi / yakıt / hız** (döteryum tüketimi) | ✅ Var (mesafe/kargo/tur başına) | Koru |
| O16 | **İttifak / diplomasi / ACS** | ❌ Yok (disclosed) | U4.4+ |
| O17 | **Subaylar / komutanlar** (ücretli boost) | ❌ Yok | Gelir modeli kararı (RevenueCat) |
| O18 | **Karanlık madde / tüccar / takas** | ⚠️ Pazar Uydusu var (farklı model) | Koru |
| O19 | **Sıralama / puan / highscore** | ⚠️ `topScore` var, karşılaştırmalı leaderboard yok | Sunucu ile P4 |
| O20 | **Sunucu zamanı / kalıcı evren otoritesi** | ✅ **Altyapı hazır** | En büyük avantaj |
| O21 | **Alan limiti** (gezegen alanı, terraformer) | ⚠️ Arazi genişletme var | O12 ile birleşir |

**Özet:** OGame'in **çekirdek döngüsü zaten çalışıyor** (filo‑savaş‑casus‑enkaz‑savunma‑sunucu otoritesi). İki büyük eksik: **O11 (gezilebilir galaksi)** ve **O12 (gerçek çoklu gezegen)**. Bunlar oyuna "sonsuz OGame" hissini verecek son iki parça.

---

## 4. INDUSTRY IDLE NOTU (kimlik dürüstlüğü)

Orijinal isteğiniz *"Factorio – OGame – Industry Idle karışımı"* idi. Bugünkü aggregate model aslında **Industry Idle ayağının kendisidir** — soyut lojistik, oran‑tabanlı throughput, pazar. Yani mevcut motor bir ihanet değil, üçayaklının bir bacağı.

Yeni vurgunuz ("Factorio'yu **aynen** istiyorum: kuralları, mantığı, mekanizması, heyecanı") ise dengeyi kaydırıyor: **Industry‑Idle soyutlamasından → gerçek Factorio uzaysallığına.** Bu belgenin geri kalanı bu kaymayı en güvenli şekilde nasıl yapacağınızı tanımlar. Industry Idle bacağı (pazar, prestige, sonsuz araştırma) korunur; sadece **lojistik soyutlaması gerçek fizikle değiştirilir.**

---

## 5. AXYON KİMLİĞİ — Bu Neden Bir Klon Değil

Klon tuzağına düşmeden iki oyunu birleştiren tek şey **cephe geçişi** mekaniğidir. Bu Axyon'un özgün imzasıdır:

- **Evre I — Yeryüzü Cephesi:** Gezegende **Factorio** oynarsınız (üret, yerleştir, otomatikleştir, yerel tehdide karşı savun). Uzay kapalı.
- **Geçiş anı — First Orbit:** İlk yörünge varlığı operasyonel olunca `spaceDetected=true` olur, **Galaktik Cephe açılır.** Bu bir menü değil, gerçek bir oyun dönüm noktasıdır.
- **Evre II — Galaktik Cephe:** Aynı ekonomi artık **OGame** motorunu besler (filo, casus, savaş, koloni, sunucu evreni).

Yani: **Factorio = ekonomi motoru; OGame = son‑oyun/PvP katmanı; geçiş = oynanışın kalbi.** Buna eklenen iki teknik fark, çoğu indie klonun asla ulaşamadığı yerler: (a) idle‑spam'siz kalıcı strateji (Stratejik Haber Akışı), (b) **başından beri sunucu‑otoriteli ortak evren.**

---

## 6. KRİTİK KARAR (geri dönüşü zor — net söylüyorum)

**İki yol var. İkisi de meşru. Sizin yeni vurgunuza göre net önerim aşağıda.**

**Yol 1 — Gerçek Factorio (per‑entity uzaysal simülasyon).**
Her makine kendi girdi/çıktı buffer'ına sahip; bantlar gerçek throughput/yön/tıkanma taşır; inserter'lar transfer yapar; güç graf‑bağlantısıyla çalışır. `economy.js`'in üretim çekirdeğinin yeniden yazımı demek. En yüksek sadakat, en büyük iş.

**Yol 2 — Factorio hissi, aggregate çekirdek.**
Mevcut modeli koru, üstüne gerçek kısıtlar giydir (bağlı değilse çalışmaz, tükenme, tarif seçimi). Orta iş, düşük risk, ama "aynen Factorio" değil.

> ### 🏛️ BAŞKAN KARARI
> **Yol 1'i seçiyoruz — ama tek seferde değil, "dikey dilim" olarak kademeli.**
> Gerekçe: "Factorio'yu aynen istiyorum" isteği Yol 2'nin uzlaşmasını dışlıyor. Ancak `economy.js`'i bir gecede yeniden yazmak S1 (stabil temel önce) ve S9 (veri/migrasyon koruması) kurallarını ihlal eder. Bu yüzden **yeni uzaysal motoru ayrı bir modül olarak, mevcut çalışan sistemin _yanına_ kuracağız** ve tek bir küçük harita bölgesinde çalışan gerçek bant→inserter→makine→güç zincirini kanıtlayınca (dikey dilim), kademe kademe tüm haritaya genişleteceğiz.
>
> Bu, "büyük yeniden yazım" riskini "kanıtlanmış küçük çekirdeğin genişlemesi" riskine indirger.

---

## 7. HEDEF MİMARİ — Uzaysal Simülasyon Çekirdeği (buildable spec)

Bu, ChatGPT'ye veya ekibe doğrudan verilebilecek somut spesifikasyondur.

### 7.1 Temel ayrım: iki katmanlı envanter

Bugün tek `s.inventory` var. Yeni modelde:

- **Per‑entity buffer** (`entity.inBuf`, `entity.outBuf`): makinenin fiziksel önündeki/arkasındaki kısıtlı tampon. Üretim yalnızca `inBuf` doluysa çalışır, `outBuf` doluysa **tıkanır** (backpressure).
- **Depo/Warehouse** (eski `s.inventory`): sadece market, araştırma ve gemi kargosunun çektiği **merkezi ambar**. Fabrika artık buraya doğrudan yazmaz; ambara **taşınması** gerekir (Factorio'daki sandığa inserter ile koyma gibi).

### 7.2 Bant = transport line (per‑item nesne DEĞİL)

Performans için Factorio'nun kendi yaklaşımı: her bant **segmenti** bir kuyruktur; item'lar segment üzerinde **pozisyon** tutar, ayrı entity değildir.

```
BeltSegment {
  cells: [ {itemId|null, offset} ... ]   // sıkıştırılmış slot dizisi
  speed: items/sec
  direction: N|E|S|W
  saturated: bool                          // geri-basınç sinyali
}
```

Görsel akan‑ikon animasyonu **simülasyondan ayrık** kalır (bugünkü akan ikon zaten böyle çalışıyor — bu bir avantaj). Ekranda 200 item aksa da sim 200 nesne tutmaz.

### 7.3 Inserter = transfer kuralı

```
Inserter { from: entityId, to: entityId|beltId, rate: items/sec, filter?: itemId }
```
`from.outBuf` → `to.inBuf`/belt. Adjacency zorunlu. Bu, bugünkü `addConveyor`'ın **gerçek** halidir.

### 7.4 Güç = graf‑bağlantı (union‑find)

```
powerNetworks = connectedComponents(poles + machines via powerLines)
her network: supply = Σ plants, demand = Σ machines
machine.powered = machine ∈ network && network.supply >= machine.share
brownout: supply < demand → o network'teki makineler oranlı yavaşlar
```
Kopuk şebekedeki makine **çalışmaz.** `computePower`'ın global oranı network‑başına orana dönüşür.

### 7.5 Kaynak tükenmesi

```
OreNode { itemId, remaining, richness }
drill her tick: extracted = min(rate, remaining); remaining -= extracted
remaining==0 → drill boşta; oyuncu yeni yatak aramak zorunda (Factorio baskısı)
```

### 7.6 Simülasyon döngüsü — "active set" scheduler (perf'in kalbi)

Factorio'nun ölçeklenme sırrı: **her entity her tick sim edilmez.** Buffer'ı stabil (dolu/boş ve komşusu değişmemiş) entity "uyur", komşu değişince "uyanır".

```
activeSet = değişen/dengesiz entity'ler
her tick: sadece activeSet sim edilir
mobil için LOD: ekran-dışı chunk'lar coarse throughput yaklaşımıyla (chunk-akış) ilerler,
ekran-içi chunk'lar tam sim + tam animasyon
```
Bu, "gerçek Factorio ekranda, performans mobilde" dengesini kuran mühendislik uzlaşmasıdır.

### 7.7 İstemci/Sunucu ayrımı (mevcut U4 mimarisini korur)

- **Fabrika uzaysal sim = İSTEMCİ, deterministik, local‑first** (S8). Sunucuya bant fiziği gitmez.
- **Galaktik cephe (kaynak/savaş/mülkiyet/saldırı) = SUNUCU otoriteli** (mevcut idempotent+CAS altyapısı). 
- Temiz sınır: **Factorio katmanı client‑deterministik; OGame katmanı server‑authoritative.** Bu ayrım zaten U4'te destekleniyor — sıfırdan kurmuyorsunuz.

### 7.8 Migrasyon (v16 → v17)

- Yeni oyun zaten **boş** başlıyor (U4.3.1) → uzaysal motor temiz başlangıçta doğal çalışır.
- Eski v16 kayıtları: `s.inventory` → merkezi **ambar**a taşınır; yerleşik makinelere default buffer atanır; kozmetik conveyor/powerLine'lar gerçek segment/network'e dönüştürülür. **Hiçbir kayıt kırılmaz** (S9).
- Migrator testi: eski kayıt yüklenir → 0 crash → üretim yeni motorda devam eder.

---

## 8. GÖRSEL / ASSET PIPELINE (sizin alanınız — "Factorio heyecanı" katmanı)

"Factorio heyecanı" %50 mekanik, %50 **görsel geri bildirimdir.** Grafik tarafı sizin uzmanlığınız; pipeline kararları:

- **Format:** SVG/canvas hibrit yerine tek **texture atlas** (WebGL veya canvas2d sprite sheet). Makine/bant/inserter için 64px kare grid, Mk kademesi = renk/parça overlay.
- **Bant animasyonu:** item sprite'ları shader/CSS transform ile segment boyunca kaydır; sim hızından bağımsız, `saturated` durumunda animasyon durur (görsel tıkanma = anlık okunur geri bildirim).
- **Makine durumu:** çalışıyor (animasyonlu) / güçsüz (soluk) / tıkalı (kırmızı kenar) / girdi‑yok (sarı) — 4 durum, tek bakışta okunur.
- **Işıklandırma:** gece/gündüz + makine ışıması (Factorio'nun atmosferi buradan gelir). Kalite kademesi (Yüksek/Orta/Düşük/Kapalı) S12 gereği.
- **Tema mimarisi:** renkler tek merkezden (S11). Yeryüzü Cephesi (sıcak/toprak paleti) → Galaktik Cephe (soğuk/uzay paleti) geçişi kimliği pekiştirir.
- **Kanıt:** Bir "işleyen fabrika" GIF'i / kısa klip — asıl heyecan testi budur. Statik ekran görüntüsü Factorio hissini ölçmez.

---

## 9. YOL HARİTASI (bağımlılık sırası — takvim değil, icra sırası)

| Aşama | İş | Bağımlılık | Risk | Bitiş kriteri |
|---|---|---|---|---|
| **P0** | **Uzaysal çekirdek — dikey dilim.** Tek bölgede: per‑entity buffer + gerçek bant (transport line) + inserter + graf‑güç + tükenme. Eski motorun yanında ayrı modül. | — | Yüksek (çekirdek karar) | Tek bölgede bant→inserter→makine zinciri gerçekten akıyor; bağlı değilse üretmiyor; tıkanma görünüyor; eski save yükleniyor (0 crash) |
| **P1** | Splitter/öncelik/filtre; çok‑tarifli assembler; şebeke gerçekleşince güç dengesi | P0 | Orta | Oyuncu tarif seçebiliyor; bant bölünüyor; kopuk şebeke duruyor |
| **P2** | Blueprint (kopyala‑yapıştır) · Modül+Beacon · Sıvı/boru · **Galaksi koordinat sistemi (O11)** · gemi‑tipi taktik savaş (O6) | P1 | Orta | Blueprint çalışıyor; galaksi 2D gezilebilir; savaş gemi‑tipi bazlı |
| **P3** | Basit devre/koşul motoru · **gerçek çoklu gezegen (O12)** · robot/lojistik ağı · kirlilik yayılımı | P2 | Yüksek | Koloni ayrı grid+ekonomi; gemiyle kaynak taşınıyor |
| **P4** | Sunucu: gerçek PvP, ittifak, leaderboard, expedition, ay · yük testi (1000+ komut) | U4.4 backend | Yüksek | PostgreSQL authority + gerçek oyuncu savaşı canlı |

> **U4.4 (PostgreSQL/auth/savaş genişlemesi) ile P0 PARALEL yürüyebilir** — biri istemci fabrika motoru, diğeri sunucu evreni; farklı dosyalar, çakışmaz.

---

## 10. İLK TEK İŞ (şimdi başlanacak)

**Dosya:** yeni `src/core/spatial-sim.js` (mevcut `economy.js`'e dokunmadan, yanına)
**İşlem:** P0 dikey diliminin *çekirdek veri modeli + tick döngüsü* — tek bir 8×8 test bölgesinde: 1 madenci (tükenen yatak) → bant → inserter → 1 fırın → outBuf → ambar. Güç: fırın bir santrale bağlı değilse çalışmaz.
**Bitiş kriteri (Node testiyle kanıtlanır):**
1. Bant kesilirse fırın **durur** (bugün durmuyor — fark budur).
2. `outBuf` dolunca fırın **tıkanır** (backpressure).
3. Yatak tükenince madenci **boşta** kalır.
4. Fırın güç şebekesine bağlı değilse üretim **0**.
5. Eski v16 kayıt yüklenince **0 crash.**

Bu beş test yeşil olduğunda "Factorio çekirdeği" kanıtlanmış olur ve genişletme güvenlidir. Yeşil olmadan P1'e geçilmez (S1).

---

## 11. RİSKLER VE GERİ DÖNÜŞ

- **En büyük risk:** Uzaysal motor performansı mobilde düşerse. → Azaltma: 7.6'daki active‑set + LOD; ekran‑dışı chunk aggregate. Geri dönüş: modül ayrı olduğu için flag ile eski aggregate motora anında dönülebilir (`feature-flags.js`).
- **Save kırılması riski:** → v16→v17 migrator + fixture testleri (mevcut test altyapısı buna hazır).
- **Kapsam patlaması:** İki oyunun *her* mekaniğini aynı anda kovalamak projeyi kilitler. → P0'ı dar tut; O6/O11/O12 gibi OGame derinleştirmeleri P2‑P3'e ertele (OGame zaten çalışıyor, acelesi yok).
- **Kimlik kayması:** Tam PvP scheduler henüz production'da değil (bilinen). → U4.4 ile paralel, ama P0'ı bloklamaz.

---

## 12. KAPANIŞ

Proje **iki olgun yarının ortasında**: OGame tarafı gerçek ve sunucu‑otoriteli; fabrika tarafı güçlü bir görsel iskelet ama henüz aggregate. "Axyon farkıyla Factorio + OGame" hedefine giden tek gerçekçi yol, fabrika motorunu **kademeli** olarak gerçek uzaysal simülasyona taşımaktır — hepsini bir gecede yeniden yazmadan, `spatial-sim.js` dikey dilimiyle başlayıp kanıtlandıkça genişleterek.

**Karar verildi, ilk iş belli. P0 dikey dilimi başlıyor.**
