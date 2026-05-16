/* ============================================================================
   AHMET PANEL LAUNCHER v11.5 - FAVORITE BAR EDITION

   Bu dosya, Adobe Illustrator içinde çalışan bir script başlatıcı paneldir.
   Panel, scriptleri klasör yapısından okur, kategorilere ayırır ve favorileri
   kalıcı olarak kaydeder. Her şey tek bir .jsx dosyasında çalışır.

   NASIL ÇALIŞIR?
   - Panel açılınca ScriptsAX ve ScriptsEX klasörleri taranır
   - Her alt klasör bir "kategori" olur, içindeki .jsx/.js dosyaları "script" olur
   - Kullanıcı bir script çalıştırınca otomatik favorilere eklenir
   - Favoriler, kategoriler ve arama geçmişi AhmetPanel_Data.json dosyasına kaydedilir
   - Panel kapatılıp açılsa da tüm veriler kalıcıdır

   FAVORİ BARI (YENİ - v11.5)
   - Panel arama satırındaki [★] butonu ile açılır/kapatılır
   - Yatay, 1-2 sıralı, ekran genişliğinin %80'i kadar geniş
   - Bağımsız pencere: panel mini modda bile bar çalışır
   - Veriler AhmetPanel_FavBar.json'a kaydedilir (panelden bağımsız)
   - Buton sağ tık: Çalıştır / Etiket Düzenle / Sola-Sağa Taşı / Bardan Çıkar
   - Sığmayan favoriler [...] butonuyla açılır
   - Ayarlar: buton boyutu (60/80/110px), sıra sayısı (1/2), genişlik sıfırlama

   KLAVYE KISAYOLLARI:
   - Escape         → Paneli küçük moda al (⚡ butonuna dönüşür)
   - F5             → Son çalıştırılan scripti tekrar çalıştır
   - Shift+Click    → Kategori popup'ında: favoriye ekle/çıkar (toggle)
   - Enter (arama)  → Arama terimini geçmişe kaydet

   FARE KISAYOLLARI (Kategori popup içinde):
   - Sol tık        → Scripti çalıştır (ve favoriye ekle)
   - Shift+Sol tık  → Favoriye ekle veya favoriden çıkar (toggle)
   - Sağ tık        → Context menü: Çalıştır / Favori / Bar

   VERSİYON GEÇMİŞİ:
   v11.5 - Bağımsız Favori Barı: yatay, dinamik genişlik, manuel sıralama,
           katmanlı etiket sistemi, sağ tık context menüsü, mini mod,
           context menüye "Bar'a Ekle/Çıkar" seçeneği eklendi
   v11.4 - Sağ tık context menüsü, mouse-over açıklama barı, F5/↺ son script,
           AX/EX kategori renk kodlaması, arama geçmişi 20'ye çıkarıldı
   v11.3 - Favori kapasitesi 50'ye çıkarıldı
   v11.2 - Favoriler kalıcı JSON dosyasına kaydediliyor
   v11.1 - JSON polyfill yeniden yazıldı
   v11.0 - Kod tamamen yeniden organize edildi, multi-monitor desteği
   ============================================================================
*/

// Bu dosyanın hangi Adobe uygulamasında çalışacağını belirtir.
// "illustrator" → Adobe Illustrator hedeflenir.
#target illustrator

// Scriptin çalışacağı "motor" (engine) ismi.
// ExtendScript birden fazla engine çalıştırabilir; bu isim sayesinde
// panel yeniden çalıştırıldığında aynı engine'e bağlanır ve önceki
// değişkenler (AppState vb.) bellekte yaşamaya devam eder.
// Farklı bir isim verseydin, her çalıştırmada temiz bir sayfa açılırdı.
#targetengine "AxyScriptPanelMasterV11External"

// ============================================================================
// YAPILANDIRMA SABİTLERİ (CONFIG)
// Tüm "sihirli sayılar" ve ayarlanabilir değerler burada toplanmıştır.
// Bir değeri değiştirmek istersen kodu karıştırmak yerine sadece buraya bakman yeter.
// ============================================================================

var CONFIG = {
    // Pencerenin ekranda olabileceği minimum ve maksimum koordinatlar.
    // Çok monitörlü sistemlerde sol monitör negatif X koordinatlarına sahip olabilir
    // (örneğin -1920). Bu yüzden sınırlar geniş tutuldu.
    MIN_WINDOW_Y: -10000,
    MIN_WINDOW_X: -10000,
    MAX_WINDOW_Y: 10000,
    MAX_WINDOW_X: 10000,
    
    // Dosya ve klasör isimleri.
    // LIBRARY_FOLDER: Script'lerin ortak kütüphaneleri (include dosyaları) buradadır.
    // ALIAS_FILE: Script isimlerini güzel göstermek için kullanılan JSON sözlüğü.
    //             Örnek: { "CerceveCiz": "Çerçeve Çiz" }
    LIBRARY_FOLDER: "libraries",
    ALIAS_FILE: "AhmetPanel_Aliases.json",
    
    // Arama geçmişi kaç terim saklasın?
    // Arama kutusuna yazılan ve Enter'a basılan terimler bu limite kadar saklanır.
    // En yeni terim listenin başına eklenir, en eski sondan düşer.
    SEARCH_HISTORY_LIMIT: 20,
    // Arama kutusunun piksel cinsinden genişliği ve gösterilen karakter sayısı.
    SEARCH_BOX_WIDTH: 100,
    SEARCH_BOX_CHARS: 12,
    
    // Kategori popup'larında bir sütuna kaç script sığar?
    // Örneğin 25 script varsa ve bu değer 20 ise, 2 sütun oluşturulur: 20 + 5.
    ITEMS_PER_COLUMN: 20,
    // Buton yükseklikleri piksel cinsinden.
    BUTTON_HEIGHT: 20,      // Normal script/kategori butonları
    MINI_BUTTON_SIZE: 24,   // Küçültülmüş (mini) mod butonu
    SMALL_BUTTON_SIZE: 20,  // Arama alanındaki küçük butonlar (×, H, _)
    
    // Favoriler ızgarası kaç sütun olsun?
    FAVORITES_COLUMNS: 2,
    // Panelde kaç favori görünsün? Bu sayıdan fazlası "Daha fazla" butonuyla açılır.
    FAVORITES_MAX_DISPLAY: 25,
    // Toplam kaç favori eklenebilir? Bu limite ulaşınca uyarı verilir.
    FAVORITES_TOTAL_LIMIT: 50,
    
    // Bu isimli klasörler script klasörü sayılmaz, tarama sırasında atlanır.
    // Kütüphane, kaynak kod, resim gibi klasörlerin script olarak görünmemesi için.
    IGNORED_FOLDERS: [
        "libraries", "lib", "assets", "images", "icons", 
        "modules", ".git", "bin", "src", 
        "Script-Barcode-EAN-13-for-Adobe-AI-master"
    ],
    
    VERSION: "11.5",
    
    // ---- FAVORİ BARI SABİTLERİ ----
    // Bar genişliği ekran genişliğinin bu oranı kadar olur (ilk açılışta)
    FAVBAR_WIDTH_RATIO:  0.80,
    // Buton genişlikleri (piksel) — ayarlar menüsünden değiştirilebilir
    FAVBAR_BTN_SMALL:    60,
    FAVBAR_BTN_MEDIUM:   80,
    FAVBAR_BTN_LARGE:   110,
    // Buton yüksekliği (tüm boyutlar için sabit)
    FAVBAR_BTN_HEIGHT:   22,
    // Favori bar veri dosyası — ana panel verisinden BAĞIMSIZ
    FAVBAR_FILE: "AhmetPanel_FavBar.json"
};

// ============================================================================
// GÜVENLİ JSON FONKSİYONLARI
//
// ExtendScript (Adobe'nin JavaScript motoru), standart JSON.stringify() fonksiyonunu
// bazen hatalı veya eksik uygular. Bu yüzden kendi stringify'ımızı yazdık.
//
// JSON nedir? Veriyi metin olarak saklamanın evrensel yoludur.
// Örnek: { "name": "Ahmet", "count": 5 }
// Bu metni dosyaya yazıp sonra geri okuyabiliriz.
// ============================================================================

/*
 * safeStringify: Bir JavaScript nesnesini/dizisini/değerini JSON metnine çevirir.
 *
 * Neden kendi fonksiyonumuzu yazdık?
 * ExtendScript'in JSON.stringify()'ı özellikle Türkçe karakterler, iç içe nesneler
 * ve özel karakterler içeren stringleri yanlış kodlayabiliyor.
 *
 * Nasıl çalışır?
 * serialize() adında recursive (kendini çağıran) bir iç fonksiyon kullanır.
 * - "recursive" demek: bir nesnenin içinde nesne varsa, onu da aynı fonksiyonla işler.
 * - depth parametresi sonsuz döngüyü önler: 50 seviyeden derin gidilmez.
 *
 * Her veri tipi için ayrı kural:
 * - null/undefined → "null" yazar
 * - boolean        → "true" veya "false" yazar
 * - number         → sayıyı yazar; sonsuz (Infinity/NaN) ise "null" yazar
 * - string         → çift tırnaklar arasına alır, özel karakterleri kaçırır (\n, \t vb.)
 * - dizi (Array)   → [eleman1, eleman2, ...] formatında yazar
 * - nesne (Object) → {"anahtar":"değer", ...} formatında yazar
 */
var safeStringify = function(obj) {
    function serialize(val, depth) {
        // 50 seviyeden derin gidilirse dur — sonsuz döngü koruması
        if (depth > 50) return '"[MaxDepth]"';
        if (val === null || val === undefined) return 'null';
        var t = typeof val;
        if (t === 'boolean') return val ? 'true' : 'false';
        if (t === 'number') return isFinite(val) ? String(val) : 'null';
        if (t === 'string') {
            // String'i JSON formatına uygun hale getir:
            // Her karaktere tek tek bakıp özel olanları "escape" ediyoruz.
            // Örneğin: çift tırnak (") → \" , yeni satır (\n) → \\n
            var result = '"';
            for (var i = 0; i < val.length; i++) {
                var c = val.charAt(i);
                var code = val.charCodeAt(i);
                if      (c === '"')  result += '\\"';   // JSON içinde " karakteri yasak
                else if (c === '\\') result += '\\\\';  // \ karakterini kaçır
                else if (c === '\n') result += '\\n';   // Yeni satır
                else if (c === '\r') result += '\\r';   // Satır başı (Windows)
                else if (c === '\t') result += '\\t';   // Tab karakteri
                else if (code < 32)  result += '\\u' + ('0000' + code.toString(16)).slice(-4); // Kontrol karakterleri
                else result += c;
            }
            return result + '"';
        }
        if (t === 'object') {
            // Dizi mi yoksa düz nesne mi? İkisi için farklı format gerekir.
            if (val.constructor === Array) {
                var parts = [];
                for (var i = 0; i < val.length; i++) parts.push(serialize(val[i], depth + 1));
                return '[' + parts.join(',') + ']';
            }
            // Düz nesne: her anahtar-değer çiftini "key":value formatına çevir
            var pairs = [];
            for (var key in val) {
                // hasOwnProperty: sadece nesnenin kendi özelliklerini al,
                // prototype zincirinden gelenleri alma
                if (val.hasOwnProperty(key)) {
                    var v = serialize(val[key], depth + 1);
                    if (v !== undefined) pairs.push('"' + key + '":' + v);
                }
            }
            return '{' + pairs.join(',') + '}';
        }
        return 'null';
    }
    return serialize(obj, 0);
};

/*
 * safeParse: JSON metnini tekrar JavaScript nesnesine çevirir.
 *
 * Neden eval() kullanıyoruz?
 * ExtendScript'te JSON.parse() de güvenilmez. eval('(' + text + ')') her zaman
 * çalışır çünkü JSON zaten geçerli bir JavaScript ifadesidir.
 * try/catch ile sarılı: bozuk JSON gelirse null döner, program çökmez.
 */
var safeParse = function(text) {
    if (!text || text === '') return null;
    try { return eval('(' + text + ')'); } catch(e) { return null; }
};

// ============================================================================
// GLOBAL UYGULAMA DURUMU (AppState)
//
// Programın "hafızası" burada. Tüm modüller (FavoritesManager, PopupManager vb.)
// bu nesneden okur ve buraya yazar. Tek bir merkezi yer olması sayesinde
// hangi verinin nerede tutulduğunu bulmak kolaylaşır.
//
// Bu tasarım desenine "Global State" veya "Single Source of Truth" denir.
// ============================================================================

var AppState = {
    launcherWindow:   null,
    activePopup:      null,
    activeMenuButton: null,
    lastPosition:     null,
    lastRun:          null,
    isMinimizing:     false, // closeAndMinimize sırasında true — onClose'un barı kapatmasını önler
    aliases:          {},
    searchHistory:    [],
    scriptDatabase:   [],
    categories:       [],
    favorites:        [],
    categoryTypes:    {}
};

// ============================================================================
// YARDIMCI FONKSİYONLAR (Utils)
// Birden fazla yerde kullanılan küçük, genel amaçlı fonksiyonlar.
// ============================================================================

var Utils = {
    /*
     * logError: Hata mesajını ExtendScript Toolkit konsoluna yazar.
     *
     * $.writeln() → Adobe'nin debug konsoluna (ESTK) satır yazar.
     * try/catch ile sarılı çünkü bazen konsol erişimi de hata verebilir
     * (örneğin ESTK kapalıysa). Hata mesajı sessizce görmezden gelinir,
     * program çökmez.
     *
     * Parametreler:
     *   message → ne işlem yapılıyordu? ("Failed to load aliases" gibi)
     *   error   → JavaScript'in hata nesnesi (e.toString() ile metne çevrilir)
     */
    logError: function(message, error) {
        try {
            $.writeln("[ERROR] " + message + ": " + (error ? error.toString() : "unknown"));
        } catch(e) {}
    },
    
    /*
     * isValidPosition: Verilen koordinatın geçerli bir pencere konumu olup olmadığını kontrol eder.
     *
     * Neden bu kontrole ihtiyaç var?
     * Kaydedilmiş konum bozuk olabilir (ilk çalıştırma, dosya silme vb.).
     * Bozuk koordinatla pencere oluşturulursa panel ekranın dışına kaçar.
     *
     * Geçerli sayılmak için:
     * - [x, y] şeklinde 2 elemanlı bir dizi olmalı
     * - İkisi de gerçek sayı olmalı (NaN veya Infinity değil)
     * - CONFIG'deki min/max sınırları içinde olmalı
     *
     * Döndürür: true (geçerli) veya false (geçersiz)
     */
    isValidPosition: function(pos) {
        if (!pos || !(pos instanceof Array) || pos.length !== 2) {
            return false;
        }
        var x = pos[0];
        var y = pos[1];
        return (typeof x === 'number' && !isNaN(x) && 
                typeof y === 'number' && !isNaN(y) &&
                x > CONFIG.MIN_WINDOW_X && x < CONFIG.MAX_WINDOW_X &&
                y > CONFIG.MIN_WINDOW_Y && y < CONFIG.MAX_WINDOW_Y);
    },
    
    /*
     * sanitizePosition: Koordinatı güvenli sınırlar içine sıkıştırır (clamp).
     *
     * isValidPosition() false döndürüp tamamen reddetmek yerine,
     * bu fonksiyon değeri düzeltmeye çalışır.
     *
     * Örnek: x = 99999 gelirse → CONFIG.MAX_WINDOW_X değerine (10000) indirilir.
     * Math.max(min, Math.min(değer, max)) → "clamp" denen klasik teknik.
     *
     * Geçersiz sayılar (NaN, dizi değil vb.) için null döner.
     * Döndürür: [x, y] dizisi veya null
     */
    sanitizePosition: function(pos) {
        if (!pos || !(pos instanceof Array) || pos.length !== 2) {
            return null;
        }
        var x = pos[0];
        var y = pos[1];
        if (typeof x !== 'number' || isNaN(x) || 
            typeof y !== 'number' || isNaN(y)) {
            return null;
        }
        x = Math.max(CONFIG.MIN_WINDOW_X, Math.min(x, CONFIG.MAX_WINDOW_X));
        y = Math.max(CONFIG.MIN_WINDOW_Y, Math.min(y, CONFIG.MAX_WINDOW_Y));
        return [x, y];
    }
};

// ============================================================================
// DOSYA YOLLARI (Paths)
//
// Panelin ihtiyaç duyduğu tüm klasör ve dosya yolları burada hesaplanır.
// Hepsi bu scriptin kendi konumuna göre belirlenir — yani scriptini nereye
// taşırsan taşı, yollar otomatik doğru hesaplanır.
//
// Neden IIFE (Immediately Invoked Function Expression)?
// (function() { ... })() → fonksiyon tanımlanır ve hemen çalıştırılır.
// İçindeki geçici değişkenler (scriptFile, baseDir) dışarıya sızmaz,
// sadece return edilen nesne dışarıya açılır. Bu temiz bir kapsülleme tekniğidir.
// ============================================================================

var Paths = (function() {
    // Bu scriptin disk üzerindeki tam yolu.
    // $.fileName → ExtendScript'in özel değişkeni, çalışan dosyanın yolu.
    // app.activeScript → ESTK'de çalıştırıldığında $.fileName boş gelebilir,
    // bu yüzden ikisi birlikte || ile kullanılır.
    var scriptFile = ($.fileName || app.activeScript);
    
    // .parent.fsName → dosyanın bulunduğu klasörün tam yolu.
    // Örnek: "C:/Users/Ahmet/Scripts/AhmetPanel"
    var baseDir = File(scriptFile).parent.fsName;
    
    return {
        base:      baseDir,                          // Ana klasör
        scriptsAX: baseDir + "/ScriptsAX",          // Ahmet'in kendi scriptleri
        scriptsEX: baseDir + "/ScriptsEX",          // Harici/ekstra scriptler
        aliasFile: baseDir + "/" + CONFIG.ALIAS_FILE, // İsim eşleştirme JSON dosyası
        
        // Kütüphane klasörünün tam yolu. Fonksiyon olarak tanımlandı çünkü
        // "this.scriptsEX" referansı, nesne oluşturulduktan sonra doğru çalışır.
        getLibraryPath: function() {
            return this.scriptsEX + "/" + CONFIG.LIBRARY_FOLDER;
        }
    };
})();

// ============================================================================
// TAKMAİSİM YÖNETİCİSİ (AliasManager)
//
// Script dosyalarının isimleri teknik olabilir ("RenkDegistirici_Hassas" gibi).
// AhmetPanel_Aliases.json dosyasında bu isimlerin daha açıklayıcı karşılıkları
// tanımlanabilir. Bu modül o JSON dosyasını okur.
// ============================================================================

var AliasManager = {
    /*
     * load: Aliases JSON dosyasını diskten okur ve nesne olarak döner.
     *
     * Dosya yoksa → boş nesne {} döner (sorun değil, alias olmadan çalışır)
     * Dosya bozuksa → boş nesne döner, hata loglanır
     *
     * Dosya okuma sırası:
     * 1. File nesnesi oluştur
     * 2. Var mı kontrol et
     * 3. UTF-8 encoding ile aç (Türkçe karakterler için önemli)
     * 4. İçeriği oku ve kapat
     * 5. JSON'u parse et
     */
    load: function() {
        var file = new File(Paths.aliasFile);
        if (!file.exists) {
            return {};
        }
        try {
            file.encoding = "UTF-8";
            file.open("r");
            var content = file.read();
            file.close();
            var data = safeParse(content);
            return data || {};
        } catch(e) {
            Utils.logError("Failed to load aliases", e);
            return {};
        }
    }
};

// ============================================================================
// FAVORİ YÖNETİCİSİ (FavoritesManager)
//
// Kullanıcının favori scriptlerini yönetir. Favoriler AppState.favorites
// dizisinde tutulur (script'lerin realName'leri), PersistenceManager aracılığıyla
// diske kaydedilir.
// ============================================================================

var FavoritesManager = {
    /*
     * save: Favori değişikliklerini diske yazar.
     * Doğrudan PersistenceManager.save()'i çağırır çünkü tüm veriler
     * (konum, geçmiş, favoriler, istatistikler) tek dosyaya birlikte kaydedilir.
     */
    save: function() {
        PersistenceManager.save();
    },
    
    /*
     * isFavorite: Verilen script'in favorilerde olup olmadığını kontrol eder.
     *
     * AppState.favorites dizisini baştan sona tarar.
     * scriptObj.realName ile karşılaştırır çünkü favoriler realName ile saklanır.
     * Bulursa true, bulamazsa false döner.
     */
    isFavorite: function(scriptObj) {
        for (var i = 0; i < AppState.favorites.length; i++) {
            if (AppState.favorites[i] === scriptObj.realName) {
                return true;
            }
        }
        return false;
    },
    
    /*
     * add: Bir script'i favorilere ekler.
     *
     * Önce zaten favoride mi kontrol eder (mükerrer eklemeyi önler).
     * Sonra toplam limit (FAVORITES_TOTAL_LIMIT) dolmuş mu kontrol eder.
     * Limit dolduysa kullanıcıya uyarı gösterir ve false döner.
     * Her şey yolundaysa realName'i diziye ekler ve kaydeder.
     *
     * Döndürür: true (eklendi) veya false (eklenemedi)
     */
    add: function(scriptObj) {
        if (!this.isFavorite(scriptObj)) {
            if (AppState.favorites.length >= CONFIG.FAVORITES_TOTAL_LIMIT) {
                alert("Favori limiti doldu! En fazla " + CONFIG.FAVORITES_TOTAL_LIMIT + " favori ekleyebilirsiniz.");
                return false;
            }
            AppState.favorites.push(scriptObj.realName);
            this.save();
            // Favoriye eklenen her script bara da otomatik eklenir
            FavBarManager.addToBar(scriptObj.realName);
            return true;
        }
        return false;
    },
    
    /*
     * remove: Bir script'i favorilerden çıkarır.
     *
     * Diziyi tarar, script'i bulunca splice() ile o indeksteki elemanı siler.
     * splice(i, 1) → i. indeksten başlayarak 1 eleman sil demek.
     * Sildikten sonra kaydeder.
     *
     * Döndürür: true (silindi) veya false (zaten favoride değildi)
     */
    remove: function(scriptObj) {
        for (var i = 0; i < AppState.favorites.length; i++) {
            if (AppState.favorites[i] === scriptObj.realName) {
                AppState.favorites.splice(i, 1);
                this.save();
                // Favoriden çıkarılan script bardan da otomatik çıkarılır
                FavBarManager.removeFromBar(scriptObj.realName);
                return true;
            }
        }
        return false;
    },
    
    /*
     * getFavoriteScripts: Favori script nesnelerini scriptDatabase'den toplayıp döner.
     *
     * AppState.favorites sadece isim listesidir (["GelismisKros", "MaskeYap"]).
     * Bu fonksiyon her isim için scriptDatabase'de tam nesneyi bulur.
     * Bulunanları kullanım sayısına (count) göre sıralar: en çok kullanılan üstte.
     *
     * Not: Favoride olan ama artık diskte olmayan script (silinen dosya) otomatik
     * atlanır çünkü scriptDatabase'de bulunamaz.
     *
     * Döndürür: Script nesneleri dizisi (count'a göre azalan sıralı)
     */
    getFavoriteScripts: function() {
        var result = [];
        for (var i = 0; i < AppState.favorites.length; i++) {
            for (var j = 0; j < AppState.scriptDatabase.length; j++) {
                if (AppState.scriptDatabase[j].realName === AppState.favorites[i]) {
                    result.push(AppState.scriptDatabase[j]);
                    break; // Bu isim için bulundu, iç döngüden çık
                }
            }
        }
        // sort() karşılaştırma fonksiyonu: b.count - a.count
        // Pozitif dönerse b önce gelir (b > a), negatif dönerse a önce gelir.
        // Bu nedenle en yüksek count en başa gelir (azalan sıra).
        result.sort(function(a, b) { return b.count - a.count; });
        return result;
    }
};

// ============================================================================
// VERİTABANI YÖNETİCİSİ (DatabaseManager)
//
// Disk üzerindeki script klasörlerini tarar ve her script için bir nesne üretir.
// Bu nesneler AppState.scriptDatabase dizisine yüklenir; tüm arama, kategori
// listeleme ve favori gösterimi bu veritabanı üzerinden çalışır.
// ============================================================================

var DatabaseManager = {
    /*
     * scanFolder: Belirtilen kök klasörü tarar ve script nesneleri listesi döner.
     *
     * Klasör yapısı şöyle varsayılır:
     *   rootPath/
     *     KategoriAdı/
     *       script1.jsx
     *       script2.js
     *
     * typePrefix → "AX" (Ahmet'in scriptleri) veya "EX" (harici scriptler).
     * Bu bilgi popup'larda ■ (AX) veya □ (EX) sembolüyle gösterilir.
     *
     * Her script için üretilen nesne:
     *   category, type, name, realName, file (tam yol), description, count
     */
    scanFolder: function(rootPath, typePrefix) {
        var entries = [];
        var rootFolder = new Folder(rootPath);
        
        // Klasör yoksa boş döner — ScriptsAX veya ScriptsEX olmayabilir
        if (!rootFolder.exists) {
            return entries;
        }
        
        // getFiles() ile sadece klasörleri filtrele
        var categoryFolders = rootFolder.getFiles(function(f) { 
            return f instanceof Folder; 
        });
        
        for (var i = 0; i < categoryFolders.length; i++) {
            var catFolder = categoryFolders[i];
            // decodeURI: Klasör adında Türkçe karakter veya boşluk varsa
            // URL encode edilmiş gelir (%20 gibi), bu bozukluğu düzeltir
            var catName = decodeURI(catFolder.name);
            
            if (this.isIgnoredFolder(catName)) {
                continue; // Kara listedeyse bu klasörü atla
            }
            
            // Regex /\.(jsx|js)$/i → adı .jsx veya .js ile biten tüm dosyalar
            var scripts = catFolder.getFiles(/\.(jsx|js)$/i);
            
            for (var j = 0; j < scripts.length; j++) {
                var scriptFile = scripts[j];
                // "MaskeYap.jsx" → "MaskeYap"
                var rawName = decodeURI(scriptFile.name).replace(/\.(jsx|js)$/i, "");
                var description = AppState.aliases[rawName] || rawName;
                
                entries.push({
                    category:    catName,
                    type:        typePrefix,
                    name:        rawName,
                    realName:    rawName,
                    file:        scriptFile.fsName,
                    description: description,
                    count:       0
                });
            }
        }
        
        return entries;
    },
    
    /*
     * isIgnoredFolder: Klasör adı kara listede (CONFIG.IGNORED_FOLDERS) mi kontrol eder.
     * Karşılaştırma büyük/küçük harf duyarsız yapılır (toLowerCase ile).
     */
    isIgnoredFolder: function(folderName) {
        var lowerName = folderName.toLowerCase();
        for (var i = 0; i < CONFIG.IGNORED_FOLDERS.length; i++) {
            if (lowerName === CONFIG.IGNORED_FOLDERS[i].toLowerCase()) {
                return true;
            }
        }
        return false;
    },
    
    /*
     * generate: ScriptsAX ve ScriptsEX klasörlerini tarayıp tam veritabanını üretir.
     * concat() → iki diziyi birleştirir.
     */
    generate: function() {
        var db = [];
        db = db.concat(this.scanFolder(Paths.scriptsAX, "AX"));
        db = db.concat(this.scanFolder(Paths.scriptsEX, "EX"));
        
        // Kategori → Tip eşleştirmesini oluştur (renk kodlama için)
        // Her kategorinin tipi, o kategorideki ilk script'in tipinden belirlenir.
        // AX klasöründen gelen kategoriler "AX", EX'ten gelenler "EX" olur.
        AppState.categoryTypes = {};
        for (var i = 0; i < db.length; i++) {
            var cat = db[i].category;
            if (!AppState.categoryTypes[cat]) {
                AppState.categoryTypes[cat] = db[i].type;
            }
        }
        
        return db;
    },
    
    /*
     * getCategories: Veritabanındaki eşsiz kategori isimlerini alfabetik sıralı döner.
     *
     * seen nesnesi "zaten gördüm" kaydı tutar — bir kategori ilk geldiğinde
     * diziye eklenir, sonraki tekrarı atlanır. Buna "hash set" tekniği denir.
     */
    getCategories: function(database) {
        var categories = [];
        var seen = {};
        for (var i = 0; i < database.length; i++) {
            var cat = database[i].category;
            if (!seen[cat]) {
                seen[cat] = true;
                categories.push(cat);
            }
        }
        return categories.sort();
    },
    
    /*
     * sortScripts: Script listesini sıralar.
     *
     * Öncelik: 1) AX scriptleri EX'in önünde, 2) aynı tipteyse alfabetik.
     * sort() karşılaştırma fonksiyonu: -1 → a önce, 1 → b önce.
     */
    sortScripts: function(scripts) {
        return scripts.sort(function(a, b) {
            if (a.type !== b.type) {
                return (a.type === "AX") ? -1 : 1;
            }
            return (a.name < b.name) ? -1 : 1;
        });
    }
};

// ============================================================================
// KALICILIK YÖNETİCİSİ (PersistenceManager)
//
// Tüm kullanıcı verilerini tek bir JSON dosyasına kaydeder ve geri yükler.
// Kaydedilen veriler:
//   - pos      → panelin son ekran konumu
//   - history  → arama geçmişi
//   - favorites → favori script isimleri
//   - stats    → her scriptin kaç kez çalıştırıldığı
//
// Dosya konumu: Folder.userData → Windows'ta "C:\Users\KullanıcıAdı\AppData\Roaming"
// Bu klasöre her zaman yazma izni vardır, masaüstü veya script klasörü değişse de çalışır.
// ============================================================================

var PersistenceManager = {
    /*
     * _getFile: Veri dosyasının File nesnesini döner.
     * Başındaki _ bu fonksiyonun "dahili kullanım" için olduğunu belirtir (kural değil, gelenek).
     */
    _getFile: function() {
        return new File(Folder.userData + "/AhmetPanel_Data.json");
    },
    
    /*
     * load: Kaydedilmiş veriyi diskten okuyup AppState'e yükler.
     *
     * Dosya yoksa (ilk çalıştırma) sessizce çıkar — AppState zaten boş değerlere sahip.
     * Her veri alanı için güvenli kontrol yapılır (instanceof Array gibi),
     * bozuk veya eksik veri olsa bile program çökmez.
     *
     * İstatistik yükleme mantığı:
     * stats dosyada sadece count > 0 olan scriptler saklanır (yer kazanmak için).
     * Yüklenirken scriptDatabase'deki her script için eşleştirme yapılır ve
     * count değerleri yerine yazılır.
     */
    load: function() {
        try {
            var f = this._getFile();
            if (!f.exists) return; // İlk çalıştırma, dosya henüz yok
            f.encoding = "UTF-8";
            f.open("r");
            var raw = f.read();
            f.close();
            if (!raw) return; // Dosya boş
            var data = safeParse(raw);
            if (!data) return; // Bozuk JSON
            
            // Her alan güvenli şekilde yüklenir
            if (data.pos)                         AppState.lastPosition   = Utils.sanitizePosition(data.pos);
            if (data.history instanceof Array)    AppState.searchHistory  = data.history;
            if (data.favorites instanceof Array)  AppState.favorites      = data.favorites;
            else                                  AppState.favorites      = [];
            
            // Kullanım istatistiklerini scriptDatabase'e geri yaz
            var statsData = data.stats || [];
            for (var i = 0; i < AppState.scriptDatabase.length; i++) {
                for (var j = 0; j < statsData.length; j++) {
                    if (AppState.scriptDatabase[i].realName === statsData[j].name) {
                        AppState.scriptDatabase[i].count = statsData[j].count || 0;
                        break;
                    }
                }
            }
        } catch(e) {
            Utils.logError("load failed", e);
        }
    },
    
    /*
     * save: Mevcut AppState'i diske yazar.
     *
     * Dikkat: stats'ta sadece count > 0 olan scriptler saklanır.
     * count = 0 olanlar (hiç çalıştırılmamış) dosyaya yazılmaz, yer kaplamaz.
     * Bir sonraki load'da bu scriptlerin count'u 0 olarak kalır (başlangıç değeri).
     *
     * Tüm veriler safeStringify ile JSON'a çevrilip tek bir dosyaya yazılır.
     * "w" modu → dosyayı baştan yaz (append değil, tamamen üzerine yaz).
     */
    save: function() {
        try {
            var statsList = [];
            for (var i = 0; i < AppState.scriptDatabase.length; i++) {
                if (AppState.scriptDatabase[i].count > 0) {
                    statsList.push({
                        name:  AppState.scriptDatabase[i].realName,
                        count: AppState.scriptDatabase[i].count
                    });
                }
            }
            var dataToSave = {
                version:   CONFIG.VERSION,
                stats:     statsList,
                pos:       AppState.lastPosition,
                history:   AppState.searchHistory,
                favorites: AppState.favorites
            };
            var f = this._getFile();
            f.encoding = "UTF-8";
            f.open("w");
            f.write(safeStringify(dataToSave));
            f.close();
        } catch(e) {
            Utils.logError("save failed", e);
        }
    }
};

// ============================================================================
// ARAMA GEÇMİŞİ YÖNETİCİSİ (SearchHistoryManager)
//
// Kullanıcının arama kutusuna yazıp Enter'a bastığı terimleri saklar.
// H butonuna tıklayınca bu liste popup olarak açılır ve tekrar aranabilir.
// ============================================================================

var SearchHistoryManager = {
    /*
     * add: Yeni bir terimi geçmişin başına ekler.
     *
     * Kural 1: 2 karakterden kısa terimler eklenmez (anlamsız aramalar).
     * Kural 2: Terim zaten geçmişteyse önce çıkarılır, sonra başa eklenir
     *          (böylece en son kullanılan her zaman en üstte olur).
     * Kural 3: Liste SEARCH_HISTORY_LIMIT'i aşarsa en eski terim (sondaki) silinir.
     *
     * unshift() → dizinin başına eleman ekler (push() sona ekler, unshift() başa).
     * pop()     → dizinin sonundaki elemanı siler ve döner.
     */
    add: function(term) {
        if (!term || term.length < 2) {
            return;
        }
        // Varsa önce listeden çıkar
        for (var i = 0; i < AppState.searchHistory.length; i++) {
            if (AppState.searchHistory[i] === term) {
                AppState.searchHistory.splice(i, 1);
                break;
            }
        }
        // Başa ekle
        AppState.searchHistory.unshift(term);
        // Limitin üzerindeyse sondan kırp
        if (AppState.searchHistory.length > CONFIG.SEARCH_HISTORY_LIMIT) {
            AppState.searchHistory.pop();
        }
        PersistenceManager.save();
    },
    
    /*
     * remove: Belirli bir terimi geçmişten siler.
     * Arama geçmişi popup'ındaki X butonları bunu çağırır.
     * Döndürür: true (silindi) veya false (bulunamadı)
     */
    remove: function(term) {
        for (var i = 0; i < AppState.searchHistory.length; i++) {
            if (AppState.searchHistory[i] === term) {
                AppState.searchHistory.splice(i, 1);
                PersistenceManager.save();
                return true;
            }
        }
        return false;
    },
    
    /*
     * clear: Tüm arama geçmişini siler.
     * "Tümünü Temizle" butonuna basılınca çağrılır.
     */
    clear: function() {
        AppState.searchHistory = [];
        PersistenceManager.save();
    }
};

// ============================================================================
// SCRIPT ÇALIŞTIRICI (ScriptExecutor)
//
// Seçilen script'i Adobe Illustrator'da güvenli şekilde çalıştırır.
// Neden BridgeTalk kullanıyoruz?
//   Panel kendi engine'inde çalışır (#targetengine). Direkt $.evalFile() ile
//   çalıştırılan scriptler bu engine'in bağlamında çalışır — bu istenmeyen
//   çakışmalara yol açabilir. BridgeTalk, scripti Illustrator'ın ana engine'ine
//   ayrı bir mesaj olarak gönderir, böylece temiz ve izole çalışır.
// ============================================================================

var ScriptExecutor = {
    /*
     * run: Script'i çalıştırır.
     *
     * Adımlar:
     * 1. Kullanım sayacını artır (count++)
     * 2. Panel konumunu kaydet (script çalıştıktan sonra panel yeniden açılacak)
     * 3. Dosyanın hâlâ diskte olduğunu kontrol et
     * 4. BridgeTalk mesajı hazırla ve gönder
     * 5. Pencereyi kapat, panel yeniden aç
     *
     * Güvenlik — dosya yolu escape:
     * Windows yollarında \ karakteri var, JavaScript string'inde \\ olmalı.
     * Türkçe dosya adlarında tek tırnak (') olabilir, bu da JS string'ini bozar.
     * replace() ile bu karakterler kaçırılır.
     *
     * Kütüphane yolu ($.includePath):
     * Bazı scriptler #include ile ortak kütüphane dosyalarına ihtiyaç duyar.
     * ScriptsEX/libraries klasörünü includePath'e ekleyip script çalıştıktan
     * sonra eski değere geri alırız (diğer scriptleri etkilememek için).
     *
     * Timeout: Script 30 saniyede cevap vermezse kullanıcı bilgilendirilir.
     * Script hâlâ çalışıyor olabilir — sadece uyarı verilir, kesilmez.
     */
    run: function(scriptObj, sourceWindow) {
        // Son çalıştırılan scripti kaydet (↺ tekrar çalıştır butonu için)
        AppState.lastRun = scriptObj;
        
        // Her çalıştırmada sayacı bir artır
        scriptObj.count++;
        
        // Panelin konumunu kaydet: script çalışınca panel kapanır ve yeniden açılır,
        // yeniden açılışta bu konum kullanılır
        if (sourceWindow && sourceWindow.location) {
            AppState.lastPosition = [sourceWindow.location.x, sourceWindow.location.y];
        }
        PersistenceManager.save();
        
        // Dosya hâlâ var mı? (Kullanıcı silmiş olabilir)
        var file = new File(scriptObj.file);
        if (!file.exists) {
            alert("Dosya bulunamadı:\n" + scriptObj.file);
            return;
        }
        
        // BridgeTalk: Illustrator'a mesaj gönder
        var bt = new BridgeTalk();
        bt.target = "illustrator";
        
        // \ → \\ ve ' → \' dönüşümleri: dosya yolunu JS string içine güvenli göm
        var scriptPath = file.fsName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        var libPath    = new Folder(Paths.getLibraryPath()).fsName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        
        // Illustrator'da çalışacak kod string olarak hazırlanır.
        // Bu kod ayrı bir engine'de çalışacağı için kendi değişkenleri var.
        var code = "var userLibPath = '" + libPath + "';" +
                   "var oldIncPath = $.includePath;" +
                   "if (userLibPath) $.includePath = userLibPath + ';' + oldIncPath;" +
                   "var scriptFile = new File('" + scriptPath + "');" +
                   "if (scriptFile.exists) {" +
                   "    try {" +
                   "        $.evalFile(scriptFile);" +         // Asıl script burda çalışır
                   "    } catch(e) {" +
                   "        alert('Script Hatası:\\n' + e.toString() + '\\n\\nSatır: ' + (e.line || 'Bilinmiyor'));" +
                   "    }" +
                   "} else {" +
                   "    alert('Dosya bulunamadı:\\n' + scriptFile.fsName);" +
                   "}" +
                   "$.includePath = oldIncPath;"; // includePath'i geri al
        
        bt.body = code;
        bt.onError = function(err) { alert("BridgeTalk Hatas\u0131:\n" + err.body); };
        bt.timeout = 10;
        bt.onTimeout = function() { alert("Script 10 saniyede yan\u0131t vermedi."); };
        bt.send();
        
        // Panel ve popup'ları kapat, ardından aynı konumda yeniden aç
        if (sourceWindow) {
            AppState.isMinimizing = true;
            sourceWindow.close();
            AppState.isMinimizing = false;
        }
        PopupManager.closeActive();
        WindowManager.openLauncher(AppState.lastPosition);
    },
    
    /*
     * runFromBar: Favori Barı'ndan script çalıştırır.
     * run()'dan farkı: panel/bar pencerelerine dokunmaz, bar kapanmaz.
     * Bar bağımsız çalışır — panel mini modda veya kapalı olsa bile.
     */
    runFromBar: function(scriptObj) {
        AppState.lastRun = scriptObj;
        scriptObj.count++;
        PersistenceManager.save();
        
        var file = new File(scriptObj.file);
        if (!file.exists) {
            alert("Dosya bulunamad\u0131:\n" + scriptObj.file);
            return;
        }
        
        var bt = new BridgeTalk();
        bt.target = "illustrator";
        var scriptPath = file.fsName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        var libPath    = new Folder(Paths.getLibraryPath()).fsName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        
        var code = "var userLibPath = '" + libPath + "';" +
                   "var oldIncPath = $.includePath;" +
                   "if (userLibPath) $.includePath = userLibPath + ';' + oldIncPath;" +
                   "var scriptFile = new File('" + scriptPath + "');" +
                   "if (scriptFile.exists) {" +
                   "    try { $.evalFile(scriptFile); } catch(e) {" +
                   "        alert('Script Hatas\u0131:\\n' + e.toString() + '\\nSat\u0131r: ' + (e.line || '?'));" +
                   "    }" +
                   "} else { alert('Dosya bulunamad\u0131:\\n' + scriptFile.fsName); }" +
                   "$.includePath = oldIncPath;";
        
        bt.body      = code;
        bt.onError   = function(err) { alert("BridgeTalk Hatas\u0131:\n" + err.body); };
        bt.timeout   = 10;
        bt.onTimeout = function() { alert("Script 10 saniyede yan\u0131t vermedi."); };
        bt.send();
        // Bar ve panel pencereleri olduğu gibi kalır
    }
};
// POPUP YÖNETİCİSİ (PopupManager)
//
// Kategori listesi ve arama geçmişi popup pencerelerini yönetir.
// Popup'lar ana panelin kenarına yapışık açılır ve sadece bir tanesi
// aynı anda açık kalabilir.
// ============================================================================

var PopupManager = {
    // Hangi kategorinin popup'ı açık? Toggle kontrolü için saklanır.
    // Aynı kategoriye tekrar tıklanınca popup kapanır (toggle davranışı).
    currentCategory: null,
    
    /*
     * calculatePopupPosition: Popup'ın nereye yerleştirileceğini hesaplar.
     *
     * Mantık: Popup ana panelin SAĞ kenarına yapışık açılmaya çalışır.
     * Eğer sağda yeterli ekran yoksa (popup ekrandan taşar) SOLA açılır.
     *
     * Çok monitör desteği:
     * $.screens dizisinden panelin hangi monitörde olduğu tespit edilir
     * ve o monitörün sağ sınırı (screenRight) referans alınır.
     * $.screens erişimi bazı sistemlerde hata verebilir — try/catch ile
     * korunur, hata olursa varsayılan 1920 kullanılır.
     *
     * gap = -5: Popup panel sınırından 5px içeri girer (estetik üst üste binme).
     *
     * Parametreler:
     *   triggerBounds      → tıklanan butonun ekran koordinatları
     *   popupEstimatedWidth → popup'ın tahmini genişliği (layout sonrası gerçek değer)
     *   mainWindowBounds   → ana panelin ekrandaki konumu ve boyutu
     */
    calculatePopupPosition: function(triggerBounds, popupEstimatedWidth, mainWindowBounds) {
        var screenRight = 1920; // Varsayılan: $.screens erişimi başarısız olursa kullanılır
        
        try {
            if (typeof $.screens !== 'undefined' && $.screens && $.screens.length > 0) {
                // Panelin merkez X koordinatından hangi monitörde olduğunu bul
                var panelCenterX = mainWindowBounds.left + (mainWindowBounds.width / 2);
                for (var i = 0; i < $.screens.length; i++) {
                    var screen = $.screens[i];
                    if (panelCenterX >= screen.left && panelCenterX <= screen.right) {
                        screenRight = screen.right;
                        break;
                    }
                }
            }
        } catch(e) {}
        
        var y   = mainWindowBounds.top; // Popup panelle aynı üst hizadan başlar
        var gap = -5;
        var x;
        var tryRight = mainWindowBounds.right + gap;
        
        if ((tryRight + popupEstimatedWidth) > screenRight) {
            // Sağda yer yok: panelin soluna aç
            x = mainWindowBounds.left - popupEstimatedWidth - gap;
        } else {
            // Sağda yer var: panelin sağına aç
            x = tryRight;
        }
        
        return [x, y];
    },
    
    /*
     * closeActive: Açık olan popup'ı kapatır ve ilgili state'i temizler.
     *
     * try/catch: Popup zaten kapanmışsa close() hata verebilir, görmezden gelinir.
     * currentCategory sıfırlanır (bir sonraki tıklamada toggle kontrolü için).
     * resetActiveButton ile mavi renge boyanan kategori butonu normale döner.
     */
    closeActive: function() {
        if (AppState.activePopup) {
            try {
                AppState.activePopup.close();
            } catch(e) {
                Utils.logError("Failed to close popup", e);
            }
            AppState.activePopup = null;
        }
        this.currentCategory = null;
        this.resetActiveButton();
    },
    
    /*
     * resetActiveButton: Kategori butonunun rengini temaya döndürür.
     *
     * Kategori butonuna tıklanınca mavi renk verilir (aktif gösterimi).
     * Popup kapanınca bu renk sıfırlanmalı.
     * BrushType.THEME_COLOR → uygulamanın mevcut temasındaki varsayılan renk.
     * window.update() → renk değişikliğini hemen ekrana yansıt.
     * try/catch: Buton artık geçerli değilse (panel kapandıysa) hata verebilir.
     */
    resetActiveButton: function() {
        if (AppState.activeMenuButton) {
            try {
                AppState.activeMenuButton.graphics.backgroundColor = 
                    AppState.activeMenuButton.graphics.newBrush(
                        AppState.activeMenuButton.graphics.BrushType.THEME_COLOR, 
                        "appDialogBackground"
                    );
                AppState.activeMenuButton.window.update();
            } catch(e) {
                Utils.logError("Failed to reset button color", e);
            }
            AppState.activeMenuButton = null;
        }
    },
    
    /*
     * openCategoryList: Bir kategorinin script listesini popup olarak açar.
     *
     * Toggle davranışı:
     *   Aynı kategoriye tekrar tıklanırsa popup kapanır (closeActive), fonksiyon döner.
     *   Farklı kategoriye tıklanırsa önce açık olanı kapat, sonra yenisini aç.
     *
     * Neden layout ÖNCE hesaplanmalı?
     *   popup.size.width, pencere gösterilmeden önce sıfır döner.
     *   layout.layout(true) → ScriptUI'a "içerikleri hesapla" der.
     *   Ardından popup.size.width gerçek değeri verir.
     *   Sonra konumlandırma yapılır, en son show() çağrılır.
     *   Bu sıralama titreme ve yanlış konum sorununu önler.
     *
     * Parametreler:
     *   category        → açılacak kategori adı
     *   triggerBounds   → tıklanan butonun konumu (popup yerleşimi için)
     *   mainWindowBounds → ana panelin konumu ve boyutu
     *   searchBox       → aktif arama kutusu referansı (script çalışınca metni geçmişe eklemek için)
     */
    openCategoryList: function(category, triggerBounds, mainWindowBounds, searchBox) {
        // Aynı kategori tekrar tıklandı → kapat (toggle)
        if (this.currentCategory === category && AppState.activePopup) {
            this.closeActive();
            return;
        }
        // Başka kategori açıksa önce onu kapat
        if (AppState.activePopup) {
            this.closeActive();
        }
        
        try {
            if (!mainWindowBounds) {
                Utils.logError("mainWindowBounds is null", null);
                alert("Panel bounds bulunamadı!");
                return;
            }
            
            var popup = new Window("palette", category, undefined, {
                resizeable: false, 
                closeButton: true
            });
            popup.margins = 2;
            AppState.activePopup  = popup;
            this.currentCategory  = category;
            
            // self = this: Closure içinde (addEventListener, onClose) "this" bağlamı
            // kayar — "this" artık PopupManager'ı değil, olayı tetikleyen nesneyi gösterir.
            // "self" ile dışarıdaki "this"i (PopupManager) kilitliyoruz.
            var self = this;
            popup.addEventListener("keydown", function(e) {
                if (e.keyName === "Escape") {
                    self.closeActive();
                }
            });
            popup.onClose = function() {
                self.currentCategory = null;
                self.resetActiveButton();
            };
            
            // Bu kategoriye ait scriptleri filtrele ve sırala
            var categoryScripts = [];
            for (var i = 0; i < AppState.scriptDatabase.length; i++) {
                if (AppState.scriptDatabase[i].category === category) {
                    categoryScripts.push(AppState.scriptDatabase[i]);
                }
            }
            categoryScripts = DatabaseManager.sortScripts(categoryScripts);
            
            if (categoryScripts.length === 0) {
                var emptyGroup = popup.add("group");
                emptyGroup.add("statictext", undefined, "(Kategori boş)");
            } else {
                this.buildScriptList(popup, categoryScripts, searchBox);
            }
            
            // ÖNEMLİ: Layout hesapla → gerçek boyutu öğren → konumlandır → göster
            popup.layout.layout(true);
            popup.layout.resize();
            var actualWidth = popup.size.width;
            var position    = this.calculatePopupPosition(triggerBounds, actualWidth, mainWindowBounds);
            popup.location  = position;
            popup.show();
        } catch(e) {
            Utils.logError("openCategoryList failed", e);
            alert("Popup açma hatası: " + e.toString());
        }
    },
    
    /*
     * buildScriptList: Popup içine çok sütunlu script listesi oluşturur.
     *
     * Sütun sayısı: Math.ceil(toplam script / sütun başına maksimum)
     * Örnek: 45 script, ITEMS_PER_COLUMN=20 ise → Math.ceil(45/20) = 3 sütun.
     *
     * Neden closure (IIFE) kullanıyoruz?
     * JavaScript'te for döngüsü içinde tanımlanan fonksiyonlar (onClick gibi)
     * döngü değişkenini (scriptItem) "kapatır" — ama değeri değil, referansı kapatır.
     * Döngü bittiğinde scriptItem son değerindedir, tüm butonlar aynı scripti çalıştırır!
     * (function(script) { ... })(scriptItem) ile her iterasyonda değer kopyalanır.
     * Bu "closure trap" JavaScript'in en yaygın tuzaklarından biridir.
     *
     * Görsel semboller:
     *   ★ → bu script favorilerde
     *   ■ → AX tipi script (Ahmet'in kendi scripti)
     *   □ → EX tipi script (harici script)
     */
    buildScriptList: function(popup, scripts, searchBox) {
        // self = this: Closure içinde (onClick) "this" bağlamı kayar.
        // Bu satır olmadan, onClick içinden self.closeActive() çağrısı
        // "ReferenceError: self is undefined" hatasına yol açar.
        var self = this;
        
        var columnCount    = Math.ceil(scripts.length / CONFIG.ITEMS_PER_COLUMN);
        var mainContainer  = popup.add("group");
        mainContainer.orientation   = "row";
        mainContainer.alignChildren = ["fill", "top"];
        mainContainer.spacing       = 2;
        
        // Her sütun için ayrı bir dikey group oluştur
        var columns = [];
        for (var col = 0; col < columnCount; col++) {
            var colGroup = mainContainer.add("group");
            colGroup.orientation   = "column";
            colGroup.alignChildren = ["fill", "top"];
            colGroup.spacing       = 0;
            columns.push(colGroup);
        }
        
        // Açıklama barı: mouse-over yapılan script'in açıklamasını gösterir.
        // Script listesinin ALTINDA sabit bir metin alanı.
        // Referans önce tanımlanır, buton event'lerinde kullanılır.
        var descBar = popup.add("statictext", undefined, "Bir scriptin \u00FCzerine gelin...");
        descBar.alignment           = ["fill", "bottom"];
        descBar.justify             = "left";
        descBar.preferredSize.width = 200;
        try {
            descBar.graphics.foregroundColor = descBar.graphics.newPen(
                descBar.graphics.PenType.SOLID_COLOR,
                [0.55, 0.75, 0.95], // Açık mavi — tema koyu olduğunda okunur
                1
            );
            descBar.graphics.font = ScriptUI.newFont("Segoe UI", "ITALIC", 9);
        } catch(e) {}
        
        for (var i = 0; i < scripts.length; i++) {
            var scriptItem   = scripts[i];
            // Math.floor(i / ITEMS_PER_COLUMN) → hangi sütuna düşeceğini hesaplar
            // Örnek: i=0..19 → sütun 0, i=20..39 → sütun 1
            var targetColumn = columns[Math.floor(i / CONFIG.ITEMS_PER_COLUMN)];
            
            var isFav  = FavoritesManager.isFavorite(scriptItem);
            var prefix = isFav ? "\u2605 " : ((scriptItem.type === "AX") ? "\u25A0 " : "\u25A1 ");
            var button = targetColumn.add("button", undefined, prefix + scriptItem.name);
            button.alignment = ["fill", "top"];
            button.justify   = "left";
            var tipFav       = "\n[Shift+Click] Favori ekle/\u00E7\u0131kar\n[Sa\u011F Click] Se\u00E7enek men\u00FCs\u00FC";
            button.helpTip   = scriptItem.description + tipFav;
            
            // Closure: scriptItem, searchBox ve descBar değerlerini bu iterasyon için kilitle
            (function(script, search, desc, popupRef) {
                
                // Mouse-over → açıklama barını güncelle
                try {
                    button.addEventListener("mouseover", function() {
                        try { desc.text = script.description; } catch(e) {}
                    });
                } catch(e) {}
                
                // Sağ tık (mousedown button=2) → context menü aç
                try {
                    button.addEventListener("mousedown", function(e) {
                        if (e.button === 2) {
                            self.showContextMenu(script, popupRef);
                        }
                    });
                } catch(e) {}
                
                button.onClick = function() {
                    try {
                        var keyboard = ScriptUI.environment.keyboardState;
                        if (keyboard.shiftKey) {
                            // Shift+Click: favori toggle (ekle veya çıkar)
                            if (FavoritesManager.isFavorite(script)) {
                                FavoritesManager.remove(script);
                            } else {
                                FavoritesManager.add(script);
                            }
                            self.closeActive();
                            var pos = AppState.launcherWindow.location;
                            AppState.launcherWindow.close();
                            WindowManager.openLauncher([pos.x, pos.y]);
                        } else {
                            // Normal tıklama: favoriye ekle ve çalıştır
                            FavoritesManager.add(script);
                            self.closeActive();
                            if (search && search.text) {
                                SearchHistoryManager.add(search.text);
                            }
                            ScriptExecutor.run(script, AppState.launcherWindow);
                        }
                    } catch(e) {
                        Utils.logError("Script button click failed", e);
                        alert("Script \u00E7al\u0131\u015Ft\u0131rma hatas\u0131: " + e.toString());
                    }
                };
            })(scriptItem, searchBox, descBar, popup);
        }
    },
    
    /*
     * showContextMenu: Sağ tık ile açılan mini context menü penceresi.
     *
     * İki seçenek sunar:
     *   ▶ Çalıştır          → scripti çalıştır (favoriye de ekler)
     *   ★ Favoriye Ekle     → sadece favoriye ekle (veya favoriden çıkar)
     *
     * Konum: Ana panelin sağ kenarına hizalanır.
     * borderless=false → kullanıcı başlığından sürükleyebilir.
     */
    showContextMenu: function(script, popup) {
        try {
            var isFav = FavoritesManager.isFavorite(script);

            var ctx = new Window("palette", "", undefined, {
                borderless:  false,
                closeButton: false
            });
            ctx.margins = 3;
            ctx.spacing = 0;

            var grp = ctx.add("group");
            grp.orientation   = "column";
            grp.alignChildren = ["fill", "top"];
            grp.spacing       = 1;

            var btnRun   = grp.add("button", undefined, "\u25B6  \u00C7al\u0131\u015Ft\u0131r");
            var favLabel = isFav ? "\u2606  Favoriden \u00C7\u0131kar" : "\u2605  Favoriye Ekle";
            var btnFav   = grp.add("button", undefined, favLabel);

            for (var bi = 0; bi < grp.children.length; bi++) {
                grp.children[bi].preferredSize.height = 22;
                grp.children[bi].alignment = ["fill", "top"];
            }

            ctx.layout.layout(true);

            try {
                if (popup && popup.location && popup.size) {
                    ctx.location = [popup.location.x + popup.size.width - 8, popup.location.y + 20];
                } else if (AppState.launcherWindow) {
                    var lw = AppState.launcherWindow;
                    ctx.location = [lw.location.x + lw.size.width - 8, lw.location.y + 30];
                }
            } catch(e) { ctx.center(); }

            (function(sc, ctxWin) {
                btnRun.onClick = function() {
                    ctxWin.close();
                    FavoritesManager.add(sc); // → bara da otomatik eklenir
                    PopupManager.closeActive();
                    ScriptExecutor.run(sc, AppState.launcherWindow);
                };

                btnFav.onClick = function() {
                    if (FavoritesManager.isFavorite(sc)) {
                        FavoritesManager.remove(sc); // → bardan da otomatik çıkar
                    } else {
                        FavoritesManager.add(sc);    // → bara da otomatik eklenir
                    }
                    ctxWin.close();
                    PopupManager.closeActive();
                    var pos = AppState.launcherWindow
                        ? [AppState.launcherWindow.location.x, AppState.launcherWindow.location.y]
                        : null;
                    if (AppState.launcherWindow) AppState.launcherWindow.close();
                    WindowManager.openLauncher(pos);
                };
            })(script, ctx);

            ctx.addEventListener("keydown", function(e) {
                if (e.keyName === "Escape") { ctx.close(); }
            });

            ctx.show();
        } catch(e) {
            Utils.logError("showContextMenu failed", e);
        }
    },
    
    /*
     * openSearchHistory: Arama geçmişini popup olarak açar.
     *
     * Her geçmiş terimi için iki buton oluşturulur:
     *   [Terim]  → tıklanınca arama kutusuna yazar ve aramayı günceller
     *   [X]      → bu terimi geçmişten siler ve popup'ı yeniler
     *
     * Neden popup yeniden açılıyor (X tıklanınca)?
     * ScriptUI'da bir widget silinince listenin kendini güncellemesi için
     * en güvenilir yol pencereyi kapatıp yeniden açmaktır.
     *
     * refreshCallback: Arama sonuçlarını güncelleyen fonksiyon referansı.
     * Geçmiş terime tıklanınca hem arama kutusu güncellenir hem de
     * sonuçlar hemen yenilenir.
     */
    openSearchHistory: function(triggerBounds, mainWindowBounds, searchBox, refreshCallback) {
        if (AppState.searchHistory.length === 0) {
            alert("Arama geçmişi boş.");
            return;
        }
        
        var popup = new Window("palette", "Arama Geçmişi", undefined, {
            resizeable: false,
            closeButton: true
        });
        popup.margins     = 4;
        AppState.activePopup = popup;
        
        var self = this; // Closure için (yukarıda açıklandı)
        popup.addEventListener("keydown", function(e) {
            if (e.keyName === "Escape") {
                self.closeActive();
            }
        });
        
        var listGroup = popup.add("group");
        listGroup.orientation   = "column";
        listGroup.alignChildren = ["fill", "top"];
        listGroup.spacing       = 2;
        
        for (var i = 0; i < AppState.searchHistory.length; i++) {
            var term      = AppState.searchHistory[i];
            var itemGroup = listGroup.add("group");
            itemGroup.orientation = "row";
            itemGroup.spacing     = 4;
            
            var btnUse    = itemGroup.add("button", undefined, term);
            btnUse.preferredSize.width = 150;
            btnUse.justify = "left";
            
            var btnDelete = itemGroup.add("button", [0,0,20,20], "X");
            btnDelete.helpTip = "Sil";
            
            // Closure: term değerini bu iterasyon için kilitle
            (function(searchTerm) {
                btnUse.onClick = function() {
                    searchBox.text = searchTerm;
                    refreshCallback(searchTerm); // Arama sonuçlarını güncelle
                    self.closeActive();
                    searchBox.active = true; // Odağı arama kutusuna taşı
                };
            })(term);
            
            // bounds ve mainBounds da capture edilir çünkü popup yeniden açılırken lazım
            (function(searchTerm, bounds, mainBounds) {
                btnDelete.onClick = function() {
                    if (SearchHistoryManager.remove(searchTerm)) {
                        popup.close();
                        AppState.activePopup = null;
                        // Popup'ı aynı konumda güncel liste ile yeniden aç
                        self.openSearchHistory(bounds, mainBounds, searchBox, refreshCallback);
                    }
                };
            })(term, triggerBounds, mainWindowBounds);
        }
        
        // En alta "Tümünü Temizle" butonu
        var btnClearAll = listGroup.add("button", undefined, "Tümünü Temizle");
        btnClearAll.alignment = ["fill", "top"];
        btnClearAll.onClick   = function() {
            if (confirm("Tüm arama geçmişi silinsin mi?")) {
                SearchHistoryManager.clear();
                self.closeActive();
            }
        };
        
        // Layout hesapla → boyutu öğren → konumlandır → göster (aynı sıralama prensibi)
        popup.layout.layout(true);
        popup.layout.resize();
        var actualWidth = popup.size.width;
        var position    = this.calculatePopupPosition(triggerBounds, actualWidth, mainWindowBounds);
        popup.location  = position;
        popup.show();
    }
};

// ============================================================================
// PENCERE YÖNETİCİSİ (WindowManager)
//
// Ana panelin tüm UI yapısını oluşturur ve yönetir.
// Panel her yeniden açıldığında (script çalıştıktan sonra vb.) sıfırdan inşa edilir.
// ============================================================================

var WindowManager = {
    /*
     * openLauncher: Ana paneli oluşturur ve gösterir.
     *
     * Neden panel her seferinde yeniden inşa ediliyor?
     * ScriptUI pencerelerini güncellemek (widget eklemek/çıkarmak) karmaşıktır.
     * En güvenilir yol: kapat, yeniden aç. Performans farkı kullanıcı tarafından
     * hissedilmeyecek kadar küçük.
     *
     * Adımlar:
     * 1. Varsa mini panel kapat (miniPalette global değişkeni — eski koddan kalma güvenlik)
     * 2. Varsa mevcut ana panel kapat (konumu kaydet)
     * 3. Yeni pencere oluştur
     * 4. Event handler'ları bağla (Escape, onClose, onMove)
     * 5. Arama alanını ve içerik alanını oluştur
     * 6. Layout hesapla (ÖNEMLİ: konumlandırmadan önce!)
     * 7. Konumlandır ve göster
     */
    openLauncher: function(startPosition) {
        // Eski mini panel varsa kapat (değişken adı belirsiz — güvenlik için try/catch)
        try {
            if (typeof miniPalette !== "undefined") {
                miniPalette.close();
            }
        } catch(e) {}
        
        // Mevcut panel açıksa konumunu kaydet ve kapat
        if (AppState.launcherWindow) {
            try {
                AppState.lastPosition = [
                    AppState.launcherWindow.location.x,
                    AppState.launcherWindow.location.y
                ];
                PersistenceManager.save();
                // Panel yeniden açılırken kapanıyor — bar etkilenmesin
                AppState.isMinimizing = true;
                AppState.launcherWindow.close();
                AppState.isMinimizing = false;
            } catch(e) {
                AppState.isMinimizing = false;
                Utils.logError("Failed to close existing launcher", e);
            }
        }
        
        // "palette" → Illustrator'ın ön planında kalan yüzen panel tipi
        // (dialog veya window'dan farklı olarak Illustrator çalışırken de görünür)
        var win = new Window("palette", "Ahmet Panel v" + CONFIG.VERSION, undefined, {
            resizeable:  false,
            closeButton: true
        });
        win.orientation   = "column";
        win.alignChildren = ["fill", "top"]; // Tüm child elemanlar yatayda dolsun
        win.spacing       = 2;
        win.margins       = 4;
        
        // Escape tuşu → paneli mini moda al (tamamen kapatma)
        // F5 tuşu → son çalıştırılan scripti tekrar çalıştır
        win.addEventListener("keydown", function(e) {
            if (e.keyName === "Escape") {
                WindowManager.closeAndMinimize(win);
            } else if (e.keyName === "F5") {
                if (AppState.lastRun) {
                    ScriptExecutor.run(AppState.lastRun, win);
                }
            }
        });
        // Panel kapatılınca açık popup da kapansın
        win.onClose = function() {
            PopupManager.closeActive();
            // Sadece gerçekten kapatılıyorsa (minimize değilse) barı kapat
            if (!AppState.isMinimizing) {
                FavBarManager.close();
            }
        };
        // Panel hareket ettirilince konumu güncelle (anlık kayıt — disk değil, bellek)
        win.onMove = function() {
            AppState.lastPosition = [win.location.x, win.location.y];
        };
        
        this.buildSearchArea(win);
        this.buildContentArea(win);
        
        // ÖNEMLİ: Layout panelin gerçek boyutunu hesaplar.
        // Bu çağrı olmadan win.size.width/height doğru değeri vermez,
        // konumlandırma yanlış yapılır (özellikle center() bozuk çalışır).
        win.layout.layout(true);
        win.layout.resize();
        
        this.positionWindow(win, startPosition);
        
        AppState.launcherWindow = win;
        win.show();
    },
    
    /*
     * positionWindow: Pencereyi doğru konuma yerleştirir.
     *
     * Öncelik sırası:
     * 1. startPosition verilmişse (yeniden açılış) → oraya yerleştir
     * 2. AppState.lastPosition varsa → oraya yerleştir
     * 3. İkisi de yoksa (ilk çalıştırma) → ekranın ortasına
     *
     * center() neden layout'tan SONRA çağrılmalı?
     * center() pencereyi ekran ortasına koymak için win.size'a bakır.
     * layout hesaplanmadan win.size sıfır veya yanlış değer döner,
     * pencere ortaya değil, ekranın sol üstüne yerleşir.
     */
    positionWindow: function(win, startPosition) {
        if (Utils.isValidPosition(startPosition)) {
            win.location = startPosition;
        } else if (Utils.isValidPosition(AppState.lastPosition)) {
            win.location = AppState.lastPosition;
        } else {
            win.center(); // İlk çalıştırma — layout hesaplandıktan sonra çağrılır
        }
    },
    
    /*
     * buildSearchArea: Panelin üst kısmındaki arama satırını oluşturur.
     *
     * İçerik: [ARA:] [arama kutusu] [×] [H] [_]
     *   × → arama kutusunu temizle
     *   H → arama geçmişini aç
     *   _ → paneli mini moda al
     *
     * win.searchBox referansı: İçerik alanı (buildContentArea) bu referansa ihtiyaç duyar.
     * İki farklı fonksiyon arasında paylaşmak için win nesnesine property olarak eklenir.
     *
     * onChanging: Her tuş vuruşunda çağrılır → arama sonuçları anlık güncellenir.
     * keydown/Enter: Terimi geçmişe kaydet ve sonuçları güncelle.
     *
     * safeBounds neden manuel hesaplanıyor?
     * ScriptUI'da win.windowBounds ve win.bounds güvenilmez değerler döndürebilir.
     * win.location ve win.size her zaman doğrudur — bunlardan bounds hesaplanır.
     */
    buildSearchArea: function(win) {
        var searchGroup = win.add("group");
        searchGroup.orientation   = "row";
        searchGroup.alignChildren = ["left", "center"];
        searchGroup.spacing       = 2;
        
        var label = searchGroup.add("statictext", undefined, "ARA:");
        label.graphics.font = ScriptUI.newFont("Segoe UI", "Bold", 9);
        
        var searchBox = searchGroup.add("edittext", undefined, "");
        searchBox.characters         = CONFIG.SEARCH_BOX_CHARS;
        searchBox.preferredSize.width = CONFIG.SEARCH_BOX_WIDTH;
        searchBox.helpTip            = "Script ara... (Enter: Kaydet)";
        
        // Diğer fonksiyonların bu referansa erişebilmesi için win'e bağla
        win.searchBox       = searchBox;
        win.contentContainer = null; // buildContentArea tarafından doldurulacak
        
        // × butonu: Arama kutusunu temizle, kategori görünümüne dön
        var btnClear = searchGroup.add("button", [0,0,CONFIG.SMALL_BUTTON_SIZE,CONFIG.SMALL_BUTTON_SIZE], "×");
        btnClear.helpTip = "Temizle";
        btnClear.onClick = function() {
            searchBox.text = "";
            WindowManager.refreshContent(win, "");
            searchBox.active = true;
        };
        
        // H butonu: Arama geçmişi popup'ını aç
        var btnHistory = searchGroup.add("button", [0,0,CONFIG.SMALL_BUTTON_SIZE,CONFIG.SMALL_BUTTON_SIZE], "H");
        btnHistory.helpTip = "Arama Geçmişi";
        btnHistory.onClick = function() {
            var bounds   = btnHistory.windowBounds;
            var winLoc   = win.location;
            var winSize  = win.size;
            // win.windowBounds yerine manuel hesaplama — daha güvenilir
            var safeBounds = {
                left:   winLoc.x,
                top:    winLoc.y,
                right:  winLoc.x + winSize.width,
                bottom: winLoc.y + winSize.height,
                width:  winSize.width,
                height: winSize.height
            };
            PopupManager.openSearchHistory(
                bounds,
                safeBounds,
                searchBox,
                function(term) { WindowManager.refreshContent(win, term); }
            );
        };
        
        // ↺ butonu: Son çalıştırılan scripti tekrar çalıştır (F5 kısayolu da çalışır)
        var btnRepeat = searchGroup.add("button", [0,0,CONFIG.SMALL_BUTTON_SIZE,CONFIG.SMALL_BUTTON_SIZE], "\u21BA");
        btnRepeat.helpTip = "Son Scripti Tekrar \u00C7al\u0131\u015Ft\u0131r [F5]";
        btnRepeat.onClick = function() {
            if (AppState.lastRun) {
                ScriptExecutor.run(AppState.lastRun, win);
            } else {
                alert("Hen\u00FCz bir script \u00E7al\u0131\u015Ft\u0131r\u0131lmad\u0131.");
            }
        };
        
        // _ butonu: Paneli küçük ⚡ butonuna dönüştür
        var btnMini = searchGroup.add("button", [0,0,CONFIG.SMALL_BUTTON_SIZE,CONFIG.SMALL_BUTTON_SIZE], "_");
        btnMini.helpTip = "K\u00FC\u00E7\u00FClt";
        btnMini.onClick = function() {
            WindowManager.closeAndMinimize(win);
        };
        
        // ★ butonu: Favori Barı'nı aç / kapat
        var btnBar = searchGroup.add("button", [0,0,CONFIG.SMALL_BUTTON_SIZE,CONFIG.SMALL_BUTTON_SIZE], "\u2605");
        btnBar.helpTip = "Favori Bar\u0131n\u0131 A\u00E7 / Kapat";
        // Bar açıksa butonu mavi göster
        if (FavBarState.visible) {
            try {
                btnBar.graphics.backgroundColor = btnBar.graphics.newBrush(
                    btnBar.graphics.BrushType.SOLID_COLOR, [0.2, 0.45, 0.75]
                );
            } catch(e) {}
        }
        btnBar.onClick = function() { FavBarManager.toggle(); };
        
        // Her tuş vuruşunda arama sonuçlarını güncelle (anlık arama)
        searchBox.addEventListener("keydown", function(e) {
            if (e.keyName === "Enter") {
                SearchHistoryManager.add(searchBox.text); // Geçmişe kaydet
                WindowManager.refreshContent(win, searchBox.text);
            }
        });
        searchBox.onChanging = function() {
            WindowManager.refreshContent(win, searchBox.text);
        };
    },
    
    /*
     * buildContentArea: Panelin alt kısmı için boş bir container oluşturur.
     *
     * Container başlangıçta boş; refreshContent() çağrısı ile doldurulur.
     * Container referansı win.contentContainer'a bağlanır ki refreshContent()
     * her çağrıldığında içeriği temizleyip yeniden oluşturabilsin.
     */
    buildContentArea: function(win) {
        var container = win.add("group");
        container.orientation   = "column";
        container.alignChildren = ["fill", "top"];
        container.spacing       = 2;
        win.contentContainer    = container;
        this.refreshContent(win, "");
    },
    
    /*
     * refreshContent: İçerik alanını tamamen temizler ve yeniden oluşturur.
     *
     * Neden tüm children silinip yeniden oluşturuluyor?
     * ScriptUI'da dinamik güncelleme (tek bir widget'ı değiştirme) karmaşık ve
     * güvenilmezdir. Tümünü silip yeniden çizmek daha sağlamdır.
     *
     * while döngüsü ile silme: for döngüsü kullanılmaz çünkü her silmede
     * dizinin indeksleri değişir (0'ı silince 1 yeni 0 olur, eski 1 atlanır).
     * while(length > 0) ile her seferinde ilk eleman silinir — güvenli.
     *
     * Boş arama terimi → kategori ve favori görünümü
     * Dolu arama terimi → arama sonuçları
     *
     * layout.layout(true) → layout'u yeniden hesapla
     * layout.resize()     → pencereyi içeriğe göre yeniden boyutlandır
     */
    refreshContent: function(win, searchTerm) {
        var container = win.contentContainer;
        
        // Tüm içeriği temizle
        while (container.children.length > 0) {
            container.remove(container.children[0]);
        }
        
        var term = searchTerm.toLowerCase();
        if (term === "") {
            this.showCategoriesAndFavorites(container, win.searchBox);
        } else {
            this.showSearchResults(container, term);
        }
        
        // Dinamik içerik değişikliği sonrası layout'u güncelle
        container.layout.layout(true);
        win.layout.layout(true);
        win.layout.resize();
    },
    
    /*
     * showCategoriesAndFavorites: Arama kutusu boşken gösterilen ana görünüm.
     *
     * Yapı:
     * 1. Favoriler (varsa): başlık + 2 sütunlu ızgara + "Daha fazla" butonu
     * 2. Kategoriler: başlık + 2 sütunlu ızgara
     *
     * Favori ızgarası layout'u (kategori ızgarasıyla birebir aynı):
     *   favGroup (row) → favCol_0 (column) + favCol_1 (column)
     *                       buton buton       buton buton
     *
     * Neden bu yapı? ScriptUI'da bir "row" group içindeki butonlar "fill" alignment
     * aldığında eşit genişlikte büyümez. Ama bir "column" group içindeki butonlar
     * "fill" alınca column'un tüm genişliğini doldurur. İki column yan yana koyunca
     * (row içinde) her sütun eşit genişlik alır — istenen görünüm elde edilir.
     *
     * "Daha fazla" butonu:
     * favScripts.length > FAVORITES_MAX_DISPLAY (25) ise gösterilir.
     * Tıklanınca buton kaldırılır ve kalan favoriler aynı yapıda eklenir.
     * Closure ile allScripts, startIdx ve cont değerleri kilitlenir.
     */
    showCategoriesAndFavorites: function(container, searchBox) {
        var favScripts = FavoritesManager.getFavoriteScripts();
        
        if (favScripts.length > 0) {
            var favHeader = container.add("statictext", undefined, "★ FAVORİLER  (Shift+Click = favoriden çıkar)");
            favHeader.graphics.font = ScriptUI.newFont("Segoe UI", "Bold", 9);
            
            var SHOW_INITIAL = CONFIG.FAVORITES_MAX_DISPLAY;
            var maxDisplay   = Math.min(SHOW_INITIAL, favScripts.length);
            
            // Dış row group → içinde 2 adet column group → her column içinde butonlar
            var favGroup = container.add("group");
            favGroup.orientation   = "row";
            favGroup.alignChildren = ["fill", "top"];
            favGroup.spacing       = 2;
            
            var perColumn  = Math.ceil(maxDisplay / CONFIG.FAVORITES_COLUMNS);
            var favColumns = [];
            for (var fc = 0; fc < CONFIG.FAVORITES_COLUMNS; fc++) {
                var favCol = favGroup.add("group");
                favCol.orientation   = "column";
                favCol.alignChildren = ["fill", "top"];
                favCol.spacing       = 0;
                favColumns.push(favCol);
            }
            
            // Her favoriyi doğru sütuna dağıt
            // Math.floor(fi / perColumn) → 0..perColumn-1 arası → sütun 0
            //                              perColumn..2*perColumn-1 → sütun 1
            for (var fi = 0; fi < maxDisplay; fi++) {
                var fTarget = favColumns[Math.floor(fi / perColumn)];
                this.createScriptButton(fTarget, favScripts[fi], true);
            }
            
            // 25'ten fazla favori varsa "Daha fazla" butonu göster
            if (favScripts.length > SHOW_INITIAL) {
                var self      = this;
                var remaining = favScripts.length - SHOW_INITIAL;
                var btnMore   = container.add("button", undefined, "▼ Daha fazla (" + remaining + " adet daha)");
                btnMore.alignment        = ["fill", "top"];
                btnMore.preferredSize.height = CONFIG.BUTTON_HEIGHT;
                
                // Closure: allScripts, startIdx, cont değerlerini kilitle
                (function(allScripts, startIdx, cont, btn) {
                    btn.onClick = function() {
                        cont.remove(btn); // Butonu kaldır
                        
                        var extraMax   = Math.min(CONFIG.FAVORITES_TOTAL_LIMIT, allScripts.length);
                        var extraCount = extraMax - startIdx;
                        
                        // Aynı ızgara yapısını kalan favoriler için de uygula
                        var extraGroup = cont.add("group");
                        extraGroup.orientation   = "row";
                        extraGroup.alignChildren = ["fill", "top"];
                        extraGroup.spacing       = 2;
                        
                        var extraPerCol = Math.ceil(extraCount / CONFIG.FAVORITES_COLUMNS);
                        var extraCols   = [];
                        for (var ec = 0; ec < CONFIG.FAVORITES_COLUMNS; ec++) {
                            var eCol = extraGroup.add("group");
                            eCol.orientation   = "column";
                            eCol.alignChildren = ["fill", "top"];
                            eCol.spacing       = 0;
                            extraCols.push(eCol);
                        }
                        for (var ei = 0; ei < extraCount; ei++) {
                            var eTarget = extraCols[Math.floor(ei / extraPerCol)];
                            WindowManager.createScriptButton(eTarget, allScripts[startIdx + ei], true);
                        }
                        
                        // Layout güncelle
                        cont.layout.layout(true);
                        AppState.launcherWindow.layout.layout(true);
                        AppState.launcherWindow.layout.resize();
                    };
                })(favScripts, SHOW_INITIAL, container, btnMore);
            }
        }
        
        // Kategoriler bölümü — favori ızgarasıyla aynı yapı
        var catHeader = container.add("statictext", undefined, "KATEGORİLER");
        catHeader.graphics.font = ScriptUI.newFont("Segoe UI", "Bold", 9);
        
        var catGroup = container.add("group");
        catGroup.orientation   = "row";
        catGroup.alignChildren = ["fill", "top"];
        catGroup.spacing       = 2;
        
        var catPerColumn = Math.ceil(AppState.categories.length / CONFIG.FAVORITES_COLUMNS);
        var catColumns   = [];
        for (var col = 0; col < CONFIG.FAVORITES_COLUMNS; col++) {
            var colGroup = catGroup.add("group");
            colGroup.orientation   = "column";
            colGroup.alignChildren = ["fill", "top"];
            colGroup.spacing       = 0;
            catColumns.push(colGroup);
        }
        for (var i = 0; i < AppState.categories.length; i++) {
            var targetCol = catColumns[Math.floor(i / catPerColumn)];
            this.createCategoryButton(targetCol, AppState.categories[i], searchBox);
        }
    },
    
    /*
     * showSearchResults: Arama terimiyle eşleşen scriptleri listeler.
     *
     * Eşleşme koşulu: Script adında VEYA açıklamasında arama terimi geçiyorsa göster.
     * indexOf() >= 0 → terimi buldu demek (< 0 ise bulunamadı).
     * toLowerCase() ile büyük/küçük harf duyarsız arama yapılır.
     *
     * Sonuç yoksa gri renkli "Sonuç bulunamadı" metni gösterilir.
     * newPen() → metin rengini [R, G, B] dizisiyle belirler (0-1 arası değerler).
     */
    showSearchResults: function(container, searchTerm) {
        var results = [];
        for (var i = 0; i < AppState.scriptDatabase.length; i++) {
            var script    = AppState.scriptDatabase[i];
            var nameMatch = script.name.toLowerCase().indexOf(searchTerm) >= 0;
            var descMatch = script.description.toLowerCase().indexOf(searchTerm) >= 0;
            if (nameMatch || descMatch) {
                results.push(script);
            }
        }
        
        if (results.length === 0) {
            var noResults = container.add("statictext", undefined, "Sonuç bulunamadı");
            noResults.graphics.foregroundColor = noResults.graphics.newPen(
                noResults.graphics.PenType.SOLID_COLOR, 
                [0.5, 0.5, 0.5], // Gri renk
                1
            );
        } else {
            results = DatabaseManager.sortScripts(results);
            var resultHeader = container.add("statictext", undefined, 
                "SONUÇLAR (" + results.length + ")  [Shift+Click = favoriye ekle]");
            resultHeader.graphics.font = ScriptUI.newFont("Segoe UI", "Bold", 9);
            
            var resultGroup = container.add("group");
            resultGroup.orientation   = "column";
            resultGroup.alignChildren = ["fill", "top"];
            resultGroup.spacing       = 0;
            for (var i = 0; i < results.length; i++) {
                this.createScriptButton(resultGroup, results[i], false);
            }
        }
    },
    
    /*
     * createCategoryButton: Bir kategori için tıklanabilir buton oluşturur.
     *
     * Buton tıklanınca:
     * 1. Panelin anlık konumu hesaplanır (popup yerleşimi için)
     * 2. Buton mavi renge boyanır (hangi kategori açık?)
     * 3. PopupManager.openCategoryList() çağrılır
     *
     * Neden closure (IIFE) kullanıyoruz?
     * for döngüsü içinde onClick tanımlanıyor. Closure olmadan tüm butonların
     * onClick'i aynı (son) category değerini kullanır. (Yukarıda detaylı açıklandı.)
     *
     * Neden safeBounds manuel hesaplanıyor?
     * ScriptUI'da windowBounds güvenilmezdir. win.location + win.size her zaman doğrudur.
     */
    createCategoryButton: function(parent, category, searchBox) {
        var button = parent.add("button", undefined, category);
        button.preferredSize.height = CONFIG.BUTTON_HEIGHT;
        button.alignment            = ["fill", "top"];
        button.justify              = "left";
        
        // Tooltip'te kategorideki script sayısını göster
        var count = 0;
        for (var i = 0; i < AppState.scriptDatabase.length; i++) {
            if (AppState.scriptDatabase[i].category === category) {
                count++;
            }
        }
        
        // Kategori tipi: AX (senin scriptlerin) → koyu mavi-yeşil ton
        //                EX (harici scriptler)   → varsayılan tema rengi
        var catType = AppState.categoryTypes[category] || "EX";
        var tipPrefix = (catType === "AX") ? "[Kendi Script] " : "[Harici Script] ";
        button.helpTip = tipPrefix + category + " (" + count + " script)";
        
        // AX kategorileri için ince renk vurgusu (koyu mavi-gri ton)
        if (catType === "AX") {
            try {
                button.graphics.backgroundColor = button.graphics.newBrush(
                    button.graphics.BrushType.SOLID_COLOR,
                    [0.15, 0.28, 0.38] // R, G, B: petrol mavisi — AX = senin scriptlerin
                );
            } catch(e) {}
        }
        
        // Closure: category, button ve searchBox bu iterasyon için kilitlenir
        (function(cat, btn, search) {
            btn.onClick = function() {
                try {
                    var win    = AppState.launcherWindow;
                    var winLoc = win.location;
                    var winSize = win.size;
                    var safeBounds = {
                        left:   winLoc.x,
                        top:    winLoc.y,
                        right:  winLoc.x + winSize.width,
                        bottom: winLoc.y + winSize.height,
                        width:  winSize.width,
                        height: winSize.height
                    };
                    var btnBounds          = btn.windowBounds;
                    AppState.activeMenuButton = btn;
                    // Butonu mavi renge boya (aktif gösterimi)
                    try {
                        btn.graphics.backgroundColor = btn.graphics.newBrush(
                            btn.graphics.BrushType.SOLID_COLOR,
                            [0.3, 0.5, 0.8] // R, G, B (0-1 arası)
                        );
                    } catch(e) {}
                    PopupManager.openCategoryList(cat, btnBounds, safeBounds, search);
                } catch(e) {
                    Utils.logError("Category button click failed", e);
                    alert("Hata: " + e.toString());
                }
            };
        })(category, button, searchBox);
    },
    
    /*
     * createScriptButton: Bir script için tıklanabilir buton oluşturur.
     *
     * Favori scriptin önüne ★ eklenir.
     * helpTip: Mouse üzerine gelince açıklama, kullanım sayısı ve kısayol bilgisi.
     *
     * Tıklama davranışı:
     *   Normal tıklama           → scripti çalıştır
     *   Shift+Click (favorideyse) → favoriden çıkar, paneli yenile
     *   Shift+Click (favoride değilse) → hiçbir şey (bu buton sadece favoriler için)
     */
    createScriptButton: function(parent, scriptObj, isFavorite) {
        var isFav      = isFavorite || FavoritesManager.isFavorite(scriptObj);
        var buttonText = isFav ? ("★ " + scriptObj.name) : scriptObj.name;
        
        var button = parent.add("button", undefined, buttonText);
        button.preferredSize.height = CONFIG.BUTTON_HEIGHT;
        button.alignment            = ["fill", "top"];
        button.helpTip              = scriptObj.description + 
                                      "\nKullanım: " + scriptObj.count + 
                                      "\n[Shift+Click] Favoriden çıkar";
        
        button.onClick = function() {
            var keyboard = ScriptUI.environment.keyboardState;
            if (keyboard.shiftKey && isFav) {
                // Favoriden çıkar ve paneli yenile
                FavoritesManager.remove(scriptObj);
                var pos = AppState.launcherWindow.location;
                AppState.launcherWindow.close();
                PopupManager.closeActive();
                WindowManager.openLauncher([pos.x, pos.y]);
            } else if (!keyboard.shiftKey) {
                ScriptExecutor.run(scriptObj, AppState.launcherWindow);
            }
        };
    },
    
    /*
     * closeAndMinimize: Paneli kapatır ve küçük ⚡ butonuna dönüştürür.
     *
     * Mini panel konumu: Ana panelin sağ üst köşesine hizalanır.
     * (win.location.x + win.size.width - MINI_BUTTON_SIZE - 4)
     * Kullanıcı ⚡ butonuna tıklayınca panel aynı konumda yeniden açılır.
     */
    closeAndMinimize: function(win) {
        AppState.lastPosition = [win.location.x, win.location.y];
        PersistenceManager.save();
        
        // Flag: win.close() → onClose tetiklenince bar kapatılmasın
        AppState.isMinimizing = true;
        win.close();
        AppState.isMinimizing = false;
        
        // Mini panel ana panelin sağ üst köşesine yerleşir
        var miniPosition = [
            win.location.x + win.size.width - CONFIG.MINI_BUTTON_SIZE - 4,
            win.location.y
        ];
        
        win.close();
        PopupManager.closeActive();
        this.openMiniPanel(miniPosition);
    },
    
    /*
     * openMiniPanel: Küçük tek butonluk ⚡ paletini açar.
     *
     * "palette" + borderless: Başlık çubuğu ve sınırı olmayan minik pencere.
     * ⚡ butonuna tıklanınca AppState.lastPosition'daki konuma geri dönülür
     * (mini panetin konumuna değil — kullanıcı mini paneli taşımış olabilir).
     *
     * Konum hesaplama önceliği:
     * 1. Argüman olarak gelen position (ana panelin sağ üstü)
     * 2. AppState.lastPosition'ın sağ kenarı (fallback)
     * 3. Ekran ortası (son çare)
     */
    openMiniPanel: function(position) {
        var mini = new Window("palette", "AP", undefined, {
            closeButton: false,
            borderless:  true
        });
        mini.margins = 2;
        
        var btnRestore = mini.add("button", 
            [0, 0, CONFIG.MINI_BUTTON_SIZE, CONFIG.MINI_BUTTON_SIZE], 
            "⚡"
        );
        btnRestore.helpTip = "Genişlet";
        btnRestore.onClick = function() {
            mini.close();
            // Mini panetin konumu değil, son kaydedilen panel konumu kullanılır
            WindowManager.openLauncher(AppState.lastPosition);
        };
        
        if (position && position instanceof Array && position.length === 2) {
            mini.location = position;
        } else if (Utils.isValidPosition(AppState.lastPosition)) {
            mini.location = [
                AppState.lastPosition[0] + 200, // Panel genişliğinin tahmini
                AppState.lastPosition[1]
            ];
        } else {
            mini.center();
        }
        
        mini.show();
    }
};

// ============================================================================
// FAVORİ BARI VERİ DURUMU (FavBarState)
//
// Ana panelden tamamen bağımsız. Kendi JSON dosyasına kaydedilir.
// Bar kapatılsa, panel yeniden başlatılsa bile veriler korunur.
// ============================================================================

var FavBarState = {
    window:      null,      // Açık bar penceresi (Window objesi)
    miniWindow:  null,      // Küçük ★⚡ penceresi
    menuWin:     null,      // ≡ menü penceresi
    btnCtxWin:   null,      // Buton sağ tık context menüsü
    overflowWin: null,      // [...] overflow popup
    order:      [],        // [{ realName: "MaskeYap", customLabel: null }, ...]
    buttonSize: "medium",  // "small" | "medium" | "large"
    rows:       2,         // 1 veya 2 satır
    pos:        null,      // [x, y] — barın son ekran konumu
    savedWidth: null,      // Kullanıcının resize sonrası kaydettiği genişlik
    visible:    false      // Bar şu an açık mı?
};

// ============================================================================
// FAVORİ BARI YÖNETİCİSİ (FavBarManager)
//
// Yatay favori barının tüm mantığını yönetir.
// ScriptExecutor.runFromBar() ile scriptleri çalıştırır.
// Veriler AhmetPanel_FavBar.json'a kaydedilir (panelden bağımsız).
// ============================================================================

var FavBarManager = {

    // ---- VERİ DOSYASI ----

    _getFile: function() {
        return new File(Folder.userData + "/" + CONFIG.FAVBAR_FILE);
    },

    load: function() {
        try {
            var f = this._getFile();
            if (!f.exists) return;
            f.encoding = "UTF-8";
            f.open("r");
            var raw = f.read();
            f.close();
            if (!raw) return;
            var data = safeParse(raw);
            if (!data) return;
            if (data.order      instanceof Array)  FavBarState.order      = data.order;
            if (data.buttonSize)                   FavBarState.buttonSize = data.buttonSize;
            if (typeof data.rows === "number")     FavBarState.rows       = data.rows;
            if (data.pos)                          FavBarState.pos        = Utils.sanitizePosition(data.pos);
            if (typeof data.savedWidth === "number") FavBarState.savedWidth = data.savedWidth;
        } catch(e) { Utils.logError("FavBarManager.load failed", e); }
    },

    save: function() {
        try {
            var f = this._getFile();
            f.encoding = "UTF-8";
            f.open("w");
            f.write(safeStringify({
                order:      FavBarState.order,
                buttonSize: FavBarState.buttonSize,
                rows:       FavBarState.rows,
                pos:        FavBarState.pos,
                savedWidth: FavBarState.savedWidth
            }));
            f.close();
        } catch(e) { Utils.logError("FavBarManager.save failed", e); }
    },

    // ---- LABEL SİSTEMİ (3 katmanlı) ----
    //   1. customLabel varsa → onu kullan
    //   2. Aliases'tan ilk kelime → "Maskeleri Resme Çevir" → "Maskeleri"
    //   3. realName olduğu gibi → "MaskeleriResmeCevir"

    getLabel: function(entry) {
        if (entry.customLabel) return entry.customLabel;
        return entry.realName;
    },

    // ---- EKRAN VE BOYUT HESAPLAMA ----

    _getScreenInfo: function() {
        var w = 1920, l = 0, t = 0;
        try {
            if (typeof $.screens !== "undefined" && $.screens && $.screens.length > 0) {
                var sc = $.screens[0];
                // Eğer barın kayıtlı konumu varsa, o monitörü bul
                if (FavBarState.pos) {
                    for (var i = 0; i < $.screens.length; i++) {
                        var s = $.screens[i];
                        if (FavBarState.pos[0] >= s.left && FavBarState.pos[0] <= s.right) {
                            sc = s; break;
                        }
                    }
                }
                w = sc.right - sc.left;
                l = sc.left;
                t = sc.top;
            }
        } catch(e) {}
        return { width: w, left: l, top: t };
    },

    _calcBarWidth: function() {
        if (FavBarState.savedWidth && FavBarState.savedWidth > 200) return FavBarState.savedWidth;
        return Math.floor(this._getScreenInfo().width * CONFIG.FAVBAR_WIDTH_RATIO);
    },

    _btnWidth: function() {
        var map = { small: CONFIG.FAVBAR_BTN_SMALL, medium: CONFIG.FAVBAR_BTN_MEDIUM, large: CONFIG.FAVBAR_BTN_LARGE };
        return map[FavBarState.buttonSize] || CONFIG.FAVBAR_BTN_MEDIUM;
    },

    _btnsPerRow: function(barWidth) {
        // 50px: sol ★ ikonu + sağ kontrol grubu (⚙ + ⚡) için rezerv
        return Math.max(1, Math.floor((barWidth - 50) / (this._btnWidth() + 3)));
    },

    // ---- AÇMA / KAPAMA / TOGGLE ----

    toggle: function() {
        if (FavBarState.window) { this.close(); } else { this.open(); }
    },

    open: function() {
        if (FavBarState.window) {
            try { FavBarState.window.show(); } catch(e) {}
            return;
        }
        // Mini mod açıksa kapat
        if (FavBarState.miniWindow) {
            try { FavBarState.miniWindow.close(); } catch(e) {}
            FavBarState.miniWindow = null;
        }
        this._buildBar();
    },

    close: function() {
        if (FavBarState.menuWin) {
            try { FavBarState.menuWin.close(); } catch(e) {}
            FavBarState.menuWin = null;
        }
        if (FavBarState.btnCtxWin) {
            try { FavBarState.btnCtxWin.close(); } catch(e) {}
            FavBarState.btnCtxWin = null;
        }
        if (FavBarState.overflowWin) {
            try { FavBarState.overflowWin.close(); } catch(e) {}
            FavBarState.overflowWin = null;
        }
        if (FavBarState.window) {
            try { FavBarState.window.close(); } catch(e) {}
            FavBarState.window = null;
        }
        if (FavBarState.miniWindow) {
            try { FavBarState.miniWindow.close(); } catch(e) {}
            FavBarState.miniWindow = null;
        }
        FavBarState.visible = false;
    },

    // Kapat ve aynı konumda yeniden aç (ayar değişikliği veya rebuild sonrası)
    rebuild: function() {
        if (FavBarState.window) {
            FavBarState.pos        = [FavBarState.window.location.x, FavBarState.window.location.y];
            FavBarState.savedWidth = FavBarState.window.size.width;
            FavBarState.window.close();
            FavBarState.window  = null;
            FavBarState.visible = false;
        }
        this.save();
        this.open();
    },

    // ---- BAR PENCERESİNİ OLUŞTUR ----

    _buildBar: function() {
        var self     = this;
        var barWidth = this._calcBarWidth();
        var rows     = FavBarState.rows;
        var btnH     = CONFIG.FAVBAR_BTN_HEIGHT;
        // Toplam yükseklik: her sıra için (buton + spacing) + kenar margins
        var barHeight = rows * (btnH + 4) + 16;

        var bar = new Window("palette", "", undefined, {
            resizeable:  true,
            closeButton: false
        });
        bar.margins           = 4;
        bar.spacing           = 2;
        bar.preferredSize     = [barWidth, barHeight];

        FavBarState.window  = bar;
        FavBarState.visible = true;

        // Resize: genişliği kaydet + butonları yenile
        bar.onResize = function() {
            try {
                FavBarState.savedWidth = bar.size.width;
                self.save();
                self._rebuildButtons(bar);
            } catch(e) {}
        };

        // Move: konumu kaydet
        bar.onMove = function() {
            try {
                FavBarState.pos = [bar.location.x, bar.location.y];
                self.save();
            } catch(e) {}
        };

        bar.onClose = function() {
            FavBarState.window  = null;
            FavBarState.visible = false;
        };

        // ESC → minimize
        bar.addEventListener("keydown", function(e) {
            if (e.keyName === "Escape") { self.minimize(); }
        });

        this._rebuildButtons(bar);
        this._positionBar(bar, barWidth);
        bar.show();
    },

    _positionBar: function(bar, barWidth) {
        if (Utils.isValidPosition(FavBarState.pos)) {
            bar.location = FavBarState.pos;
        } else {
            // İlk açılış: ekranın üst ortasına
            var sc  = this._getScreenInfo();
            var x   = sc.left + Math.floor((sc.width - barWidth) / 2);
            var y   = sc.top + 20;
            bar.location    = [x, y];
            FavBarState.pos = [x, y];
        }
    },

    // ---- BUTONLARI (YENİDEN) OLUŞTUR ----

    _rebuildButtons: function(bar) {
        var self = this;

        // Tüm içeriği temizle
        while (bar.children.length > 0) { bar.remove(bar.children[0]); }

        var barWidth     = (bar.size && bar.size.width > 0) ? bar.size.width : this._calcBarWidth();
        var btnW         = this._btnWidth();
        var btnH         = CONFIG.FAVBAR_BTN_HEIGHT;
        var rows         = FavBarState.rows;
        var bpr          = this._btnsPerRow(barWidth);     // buttons per row
        var maxVisible   = bpr * rows;
        var order        = FavBarState.order;
        var visibleCount = Math.min(order.length, maxVisible);
        var overflow     = order.slice(visibleCount);      // sığmayanlar

        // Ana yatay düzen: [★] | [buton satırları] | [⚙⚡]
        var mainGrp = bar.add("group");
        mainGrp.orientation   = "row";
        mainGrp.alignChildren = ["left", "center"];
        mainGrp.spacing       = 6;

        // Sol ★ ikonu
        var starLbl = mainGrp.add("statictext", undefined, "\u2605");
        try {
            starLbl.graphics.font = ScriptUI.newFont("Segoe UI", "Bold", 13);
            starLbl.graphics.foregroundColor = starLbl.graphics.newPen(
                starLbl.graphics.PenType.SOLID_COLOR, [0.95, 0.78, 0.1], 1
            );
        } catch(e) {}

        // Buton alanı: dikey grup → her sıra bir yatay grup
        var btnArea = mainGrp.add("group");
        btnArea.orientation   = "column";
        btnArea.alignChildren = ["left", "top"];
        btnArea.spacing       = 3;

        for (var r = 0; r < rows; r++) {
            var rowGrp = btnArea.add("group");
            rowGrp.orientation   = "row";
            rowGrp.alignChildren = ["left", "center"];
            rowGrp.spacing       = 3;

            var start = r * bpr;
            var end   = Math.min(start + bpr, visibleCount);

            for (var i = start; i < end; i++) {
                this._createBarButton(rowGrp, order[i], i, btnW, btnH, bar);
            }

            // Son satırda overflow varsa [...] butonu ekle
            if (r === rows - 1 && overflow.length > 0) {
                var btnOvf = rowGrp.add("button", [0, 0, 32, btnH], "...");
                btnOvf.helpTip = overflow.length + " favori daha";
                (function(hidden) {
                    btnOvf.onClick = function() { self._openOverflow(hidden); };
                })(overflow);
            }
        }

        // Tek ≡ menü butonu — tıklayınca Ayarlar / Küçült / Kapat seçenekleri çıkar
        var ctrlGrp = mainGrp.add("group");
        ctrlGrp.orientation   = "row";
        ctrlGrp.alignChildren = ["right", "center"];
        ctrlGrp.spacing       = 0;

        var btnMenu = ctrlGrp.add("button", [0, 0, 26, CONFIG.FAVBAR_BTN_HEIGHT], "\u2261");
        btnMenu.helpTip = "Men\u00FC";
        (function(b, barWin) {
            b.onClick = function() {
                // Menü zaten açıksa kapat (toggle)
                if (FavBarState.menuWin) {
                    try { FavBarState.menuWin.close(); } catch(e) {}
                    FavBarState.menuWin = null;
                    return;
                }
                var m = new Window("palette", "", undefined, {
                    borderless: false, closeButton: false
                });
                m.margins = 3;
                m.spacing = 1;
                var mg = m.add("group");
                mg.orientation   = "column";
                mg.alignChildren = ["fill", "top"];
                mg.spacing       = 1;

                var mSet   = mg.add("button", undefined, "\u2699  Ayarlar");
                var mMin   = mg.add("button", undefined, "\u26A1  K\u00FC\u00E7\u00FClt");
                var mClose = mg.add("button", undefined, "\u00D7  Kapat");
                for (var mi = 0; mi < mg.children.length; mi++) {
                    mg.children[mi].preferredSize.height = 22;
                    mg.children[mi].alignment = ["fill", "top"];
                }
                m.layout.layout(true);

                // Barın sağ altına konumlandır
                try {
                    m.location = [
                        barWin.location.x + barWin.size.width - m.size.width - 2,
                        barWin.location.y + barWin.size.height + 2
                    ];
                } catch(e) { m.center(); }

                FavBarState.menuWin = m;
                m.onClose = function() { FavBarState.menuWin = null; };

                mSet.onClick   = function() { m.close(); self._openSettings(barWin); };
                mMin.onClick   = function() { m.close(); self.minimize(); };
                mClose.onClick = function() { m.close(); self.close(); };
                m.addEventListener("keydown", function(e) {
                    if (e.keyName === "Escape") { m.close(); }
                });
                m.show();
            };
        })(btnMenu, bar);

        bar.layout.layout(true);
        bar.layout.resize();
    },

    // ---- TEK BUTON OLUŞTUR ----

    _createBarButton: function(parent, entry, idx, btnW, btnH, barRef) {
        var self  = this;
        var label = this.getLabel(entry);

        // Etiketi butona sığdır: yaklaşık 6px/karakter
        var maxChars  = Math.max(3, Math.floor((btnW - 10) / 6));
        var dispLabel = (label.length > maxChars)
            ? label.substring(0, maxChars - 1) + "\u2026"
            : label;

        var fullDesc = AppState.aliases[entry.realName] || entry.realName;
        var btn = parent.add("button", [0, 0, btnW, btnH], dispLabel);
        btn.helpTip = label + "\n" + fullDesc + "\n[Sa\u011F Click] Se\u00E7enekler";

        (function(e, i, b) {
            b.onClick = function() { self._runScript(e); };
            try {
                b.addEventListener("mousedown", function(ev) {
                    if (ev.button === 2) { self._openButtonCtx(e, i, barRef); }
                });
            } catch(err) {}
        })(entry, idx, btn);
    },

    // ---- SCRIPT ÇALIŞTIR (bardan) ----

    _runScript: function(entry) {
        for (var i = 0; i < AppState.scriptDatabase.length; i++) {
            var sc = AppState.scriptDatabase[i];
            if (sc.realName === entry.realName) {
                ScriptExecutor.runFromBar(sc);
                return;
            }
        }
        alert("Script bulunamad\u0131: " + entry.realName + "\nDosya silinmi\u015F olabilir.");
    },

    // ---- BUTON CONTEXT MEN\u00DC ----

    _openButtonCtx: function(entry, idx, barRef) {
        var self = this;

        // Zaten açık bir context menü varsa kapat (toggle)
        if (FavBarState.btnCtxWin) {
            try { FavBarState.btnCtxWin.close(); } catch(e) {}
            FavBarState.btnCtxWin = null;
            return;
        }

        var ctx  = new Window("palette", "", undefined, { borderless: false, closeButton: false });
        ctx.margins = 3;
        ctx.spacing = 0;
        var grp = ctx.add("group");
        grp.orientation   = "column";
        grp.alignChildren = ["fill", "top"];
        grp.spacing       = 1;

        var items = [
            { label: "\u25B6  \u00C7al\u0131\u015Ft\u0131r",     action: "run"    },
            { label: "\u270F  Etiketi D\u00FCzenle", action: "edit"   },
            { label: "\u2190  Sola Ta\u015F\u0131",       action: "left"   },
            { label: "\u2192  Sa\u011Fa Ta\u015F\u0131",      action: "right"  },
            { label: "\u2715  Bardan \u00C7\u0131kar", action: "remove" }
        ];

        var btns = [];
        for (var k = 0; k < items.length; k++) {
            var b = grp.add("button", undefined, items[k].label);
            b.preferredSize.height = 22;
            b.alignment = ["fill", "top"];
            btns.push(b);
        }
        btns[2].enabled = (idx > 0);
        btns[3].enabled = (idx < FavBarState.order.length - 1);

        ctx.layout.layout(true);
        try {
            if (barRef && barRef.location && barRef.size) {
                ctx.location = [barRef.location.x + barRef.size.width - 6, barRef.location.y];
            } else { ctx.center(); }
        } catch(e) { ctx.center(); }

        FavBarState.btnCtxWin = ctx;
        ctx.onClose = function() { FavBarState.btnCtxWin = null; };

        (function(e, i, c) {
            btns[0].onClick = function() { c.close(); self._runScript(e); };
            btns[1].onClick = function() { c.close(); self._editLabel(e, i); };
            btns[2].onClick = function() { c.close(); self._moveEntry(i, -1); };
            btns[3].onClick = function() { c.close(); self._moveEntry(i,  1); };
            btns[4].onClick = function() { c.close(); self.removeFromBar(e.realName); };
        })(entry, idx, ctx);

        ctx.addEventListener("keydown", function(ev) {
            if (ev.keyName === "Escape") { ctx.close(); }
        });
        ctx.show();
    },

    // ---- ETİKET DÜZENLE ----

    _editLabel: function(entry, idx) {
        var self    = this;
        var current = entry.customLabel || this.getLabel(entry);

        var dlg = new Window("dialog", "Etiketi D\u00FCzenle — " + entry.realName);
        dlg.orientation   = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.margins = 12;
        dlg.spacing = 8;

        dlg.add("statictext", undefined, "Script: " + entry.realName);
        var desc = AppState.aliases[entry.realName];
        if (desc) dlg.add("statictext", undefined, "A\u00E7\u0131klama: " + desc);

        var row = dlg.add("group");
        row.add("statictext", undefined, "Etiket:");
        var inp = row.add("edittext", undefined, current);
        inp.preferredSize.width = 160;
        inp.active = true;

        var hint = dlg.add("statictext", undefined, "Bo\u015F b\u0131rak\u0131rsan otomatik \u00FCretilir.");
        try {
            hint.graphics.foregroundColor = hint.graphics.newPen(
                hint.graphics.PenType.SOLID_COLOR, [0.55, 0.55, 0.55], 1
            );
        } catch(e) {}

        var btnRow = dlg.add("group");
        var btnOK  = btnRow.add("button", undefined, "Tamam",  { name: "ok"     });
        var btnCnl = btnRow.add("button", undefined, "\u0130ptal",   { name: "cancel" });
        var btnRst = btnRow.add("button", undefined, "S\u0131f\u0131rla");

        btnOK.onClick  = function() {
            var val = inp.text;
            FavBarState.order[idx].customLabel = (val && val.length > 0) ? val : null;
            self.save(); dlg.close(); self.rebuild();
        };
        btnCnl.onClick = function() { dlg.close(); };
        btnRst.onClick = function() {
            FavBarState.order[idx].customLabel = null;
            self.save(); dlg.close(); self.rebuild();
        };
        dlg.show();
    },

    // ---- SIRALA: SOL / SAĞ ----

    _moveEntry: function(idx, dir) {
        var ni = idx + dir;
        if (ni < 0 || ni >= FavBarState.order.length) return;
        var tmp              = FavBarState.order[idx];
        FavBarState.order[idx]  = FavBarState.order[ni];
        FavBarState.order[ni]   = tmp;
        this.save();
        this.rebuild();
    },

    // ---- EKLE / ÇIKAR / KONTROL ----

    isInBar: function(realName) {
        for (var i = 0; i < FavBarState.order.length; i++) {
            if (FavBarState.order[i].realName === realName) return true;
        }
        return false;
    },

    addToBar: function(realName) {
        if (this.isInBar(realName)) return false;
        FavBarState.order.push({ realName: realName, customLabel: null });
        this.save();
        if (FavBarState.window) this.rebuild();
        return true;
    },

    removeFromBar: function(realName) {
        for (var i = 0; i < FavBarState.order.length; i++) {
            if (FavBarState.order[i].realName === realName) {
                FavBarState.order.splice(i, 1);
                this.save();
                this.rebuild();
                return true;
            }
        }
        return false;
    },

    // ---- OVERFLOW POPUP ----

    _openOverflow: function(hidden) {
        var self = this;

        // Zaten açıksa kapat (toggle)
        if (FavBarState.overflowWin) {
            try { FavBarState.overflowWin.close(); } catch(e) {}
            FavBarState.overflowWin = null;
            return;
        }

        var popup = new Window("palette", hidden.length + " Favori Daha", undefined, {
            resizeable: false, closeButton: true
        });
        popup.margins = 6;
        popup.spacing = 4;

        var grp = popup.add("group");
        grp.orientation   = "column";
        grp.alignChildren = ["fill", "top"];
        grp.spacing       = 2;

        for (var i = 0; i < hidden.length; i++) {
            (function(entry) {
                var lbl = self.getLabel(entry);
                var btn = grp.add("button", undefined, lbl);
                btn.alignment = ["fill", "top"];
                btn.preferredSize.height = 22;
                btn.helpTip = AppState.aliases[entry.realName] || entry.realName;
                btn.onClick = function() { popup.close(); self._runScript(entry); };
            })(hidden[i]);
        }

        popup.layout.layout(true);
        if (FavBarState.window && FavBarState.window.location) {
            popup.location = [
                FavBarState.window.location.x,
                FavBarState.window.location.y + FavBarState.window.size.height + 2
            ];
        } else { popup.center(); }

        FavBarState.overflowWin = popup;
        popup.onClose = function() { FavBarState.overflowWin = null; };
        popup.show();
    },

    // ---- AYARLAR MENÜSÜ ----

    _openSettings: function(barRef) {
        var self = this;
        var dlg  = new Window("dialog", "Favori Bar Ayarlar\u0131");
        dlg.orientation   = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.margins = 14;
        dlg.spacing = 10;

        // Buton boyutu seçimi
        var pSize = dlg.add("panel", undefined, "Buton Boyutu");
        pSize.orientation   = "row";
        pSize.alignChildren = ["left", "center"];
        pSize.margins = 10;
        pSize.spacing = 14;
        var rbS = pSize.add("radiobutton", undefined, "K\u00FC\u00E7\u00FCk  (60px)");
        var rbM = pSize.add("radiobutton", undefined, "Orta  (80px)");
        var rbL = pSize.add("radiobutton", undefined, "B\u00FCy\u00FCk  (110px)");
        if      (FavBarState.buttonSize === "small")  { rbS.value = true; }
        else if (FavBarState.buttonSize === "large")  { rbL.value = true; }
        else                                          { rbM.value = true; }

        // Sıra sayısı seçimi
        var pRows = dlg.add("panel", undefined, "S\u0131ra Say\u0131s\u0131");
        pRows.orientation   = "row";
        pRows.alignChildren = ["left", "center"];
        pRows.margins = 10;
        pRows.spacing = 18;
        var rb1 = pRows.add("radiobutton", undefined, "1 S\u0131ra");
        var rb2 = pRows.add("radiobutton", undefined, "2 S\u0131ra");
        rb1.value = (FavBarState.rows === 1);
        rb2.value = (FavBarState.rows === 2);

        // Genişlik sıfırla
        var pWidth = dlg.add("panel", undefined, "Genişlik");
        pWidth.margins = 10;
        var btnRW = pWidth.add("button", undefined, "Ekrana G\u00F6re S\u0131f\u0131rla (%80)");
        btnRW.onClick = function() { FavBarState.savedWidth = null; };

        // Uygula / İptal
        var btnRow = dlg.add("group");
        var btnOK  = btnRow.add("button", undefined, "Uygula", { name: "ok"     });
        var btnCnl = btnRow.add("button", undefined, "\u0130ptal",  { name: "cancel" });

        btnOK.onClick = function() {
            FavBarState.buttonSize = rbS.value ? "small" : (rbL.value ? "large" : "medium");
            FavBarState.rows       = rb1.value ? 1 : 2;
            dlg.close();
            self.save();
            self.rebuild();
        };
        btnCnl.onClick = function() { dlg.close(); };
        dlg.show();
    },

    // ---- MİNİ MOD ----

    minimize: function() {
        var self = this;
        if (FavBarState.window) {
            FavBarState.pos        = [FavBarState.window.location.x, FavBarState.window.location.y];
            FavBarState.savedWidth = FavBarState.window.size.width;
            this.save();
            FavBarState.window.close();
            FavBarState.window  = null;
            FavBarState.visible = false;
        }

        var mini = new Window("palette", "FB", undefined, {
            closeButton: false,
            borderless:  true
        });
        mini.margins = 2;
        var row = mini.add("group");
        row.spacing = 2;
        row.add("statictext", undefined, "\u2605");
        var btnR = row.add("button", [0, 0, 24, 22], "\u26A1");
        btnR.helpTip = "Favori Bar\u0131 A\u00E7";
        btnR.onClick = function() {
            mini.close();
            FavBarState.miniWindow = null;
            self.open();
        };

        if (Utils.isValidPosition(FavBarState.pos)) {
            mini.location = FavBarState.pos;
        } else {
            mini.center();
        }

        FavBarState.miniWindow = mini;
        mini.show();
    }
};

// ============================================================================
// BAŞLATMA (Initialization)
//
// Script çalıştırıldığında bu IIFE (Immediately Invoked Function Expression)
// hemen çalışır ve her şeyi başlatır. Neden IIFE?
// Fonksiyon içindeki geçici değişkenler global alana sızmaz — temiz başlangıç.
// ============================================================================

(function init() {
    // 1. Alias dosyasını yükle (script isim eşleştirmeleri)
    //    Bu önce yüklenmeli çünkü scanFolder() sırasında aliases'a bakılır
    AppState.aliases = AliasManager.load();
    
    // 2. Disk üzerindeki scriptleri tara ve veritabanını oluştur
    //    Kategoriler de bu aşamada belirlenir
    AppState.scriptDatabase = DatabaseManager.generate();
    AppState.categories     = DatabaseManager.getCategories(AppState.scriptDatabase);
    
    // 3. Kaydedilmiş kullanıcı verilerini yükle
    //    scriptDatabase zaten oluşturulmuş olmalı çünkü
    //    load() içinde count değerleri scriptDatabase'e yazılır
    PersistenceManager.load();
    
    // 4. Favori Bar verilerini yükle (panelden bağımsız dosyadan)
    FavBarManager.load();
    
    // 5. Ana paneli aç — lastPosition load() tarafından doldurulmuş olabilir
    WindowManager.openLauncher(AppState.lastPosition);
})();