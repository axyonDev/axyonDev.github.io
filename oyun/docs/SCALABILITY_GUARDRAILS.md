# AXYON: Orbital Ascendancy — Scalability Guardrails

**Kalıcı ürün hedefi:** Milyonlarca kayıtlı kullanıcıya ve aynı anda binlerce aktif oyuncuya ölçeklenebilen ortak evren.

## Bugünkü durum

v4.5.1-u4.1 hâlâ tarayıcıda/local-first çalışan oynanabilir prototiptir. Bu paket çok oyunculu backend içermez ve mevcut local save hiçbir zaman gelecekteki ortak evrende otorite kabul edilmeyecektir.

## Değişmez mimari kararlar

1. **Sunucu otoritesi:** Kredi, kaynak, üretim, pazar, filo, savaş, mülkiyet ve ödül sonuçlarının nihai doğruluk kaynağı sunucudur.
2. **UI'dan bağımsız domain çekirdeği:** Ekonomi ve savaş kuralları DOM, canvas, localStorage veya belirli bir backend teknolojisine bağlanmaz.
3. **Sürekli oyuncu tick'i yok:** İnaktif fabrikalar son doğrulanmış zaman + geçen süre + üretim planı üzerinden lazy hesaplanır. Yalnız canlı savaş/etkinlikler zamanlanmış iş kullanır.
4. **İdempotent işlemler:** Satış, satın alma, görev ödülü, savaş sonucu ve transferler benzersiz işlem kimliğiyle en fazla bir kez uygulanır.
5. **Sektör/shard bölünebilirliği:** Evren yıldız bölgesi, sektör ve sistem kümelerine ayrılabilir; yeni kapasite yatay eklenebilir.
6. **Event-driven sınırlar:** Pazar, savaş, filo, bildirim ve analitik akışları kuyruk/event üzerinden ayrıştırılabilir.
7. **Cohort/aggregate model:** Milyonluk dron, savunma veya üretim birimleri tekil nesne/satır olarak tutulmaz; doğrulanabilir aggregate/cohort olarak saklanır.
8. **Anti-cheat:** İstemci zamanı, kaynak miktarı veya savaş sonucu güvenilir kabul edilmez. Sunucu doğrulama, oran limiti ve replay koruması zorunludur.
9. **Bölgesel hata izolasyonu:** Bir sektör, pazar veya savaş servisi arızası bütün oyunu durdurmamalıdır.
10. **Gözlemlenebilirlik:** İşlem izi, audit log, metrik, hata takibi ve geri alınabilir dağıtım olmadan canlı ekonomi açılmaz.

## Veri sahipliği sınırı

- **Client/local:** UI tercihleri, geçici cache, son görüntü, offline komut kuyruğu ve doğrulanmamış tahminler.
- **Server:** Hesap, karakter, envanter, ekonomi, zaman, mülkiyet, pazar emirleri, savaş sonuçları, filo görevleri ve dünya durumu.

## Geçiş kapıları

### U4/U4.1 — mevcut durum

Tamamlanan:
- IndexedDB ana kayıt kasası ve localStorage uyumluluk aynası.
- Checksum, monoton revizyon, sınırlı yedek, rollback ve tombstone silme güvenliği.
- U3.1 kayıtlarının kayıpsız aktarımı ve fallback davranışı.
- UI/storage bağımsız domain command envelope ve handler registry.
- Duplicate, replay, payload conflict ve stale revision koruması.
- Kontrollü offline outbox, batch ve fingerprint doğrulamalı server ACK sözleşmesi.
- Sunucu zamanı örnekleme ve lazy elapsed resolver arayüzü.

Sıradaki işler:
- Gerçek API Gateway + yetkili profil/state servisi.
- Sunucuda `(actor_id, command_id)` unique constraint ve state+receipt+event-outbox tek transaction.
- Ayrı sekme/cihaz farklı komutları için server CAS/reconciliation.
- Canvas ve kalan düşük seviye ekonomi eylemlerinin command katmanına taşınması.
- Gerçek origin ve gerçek cihaz IndexedDB kabul testi.

### Sunucu prototipi
- Yetkili hesap/profil/save.
- Sunucu zamanı ve lazy production resolver.
- İdempotent ekonomi işlemleri.
- Sektör kimliği ve oyuncu yerleşimi.

### Çok oyunculu kabul
- Yatay ölçek testi.
- Aynı işlemin tekrar gönderilmesi testi.
- Sektör arızası izolasyonu.
- Pazar ve savaş tutarlılık testi.
- Hileli istemci/veri manipülasyonu testleri.

## Her yeni sistem için zorunlu soru

> Bu işlem 10 oyuncuda değil, 10.000 eşzamanlı oyuncuda; tekrar gönderim, ağ kopması ve kötü niyetli istemci altında nasıl davranır?
