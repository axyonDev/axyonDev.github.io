/**
 * Axyon.Data — özgün oyun verisi. Tüm isimler, reçeteler, tema orijinaldir.
 * Gerçek malzeme adları (demir, bakır, çelik) evrensel; üst-tier isimler özgündür.
 *
 * Sistemler: üretim zinciri + DEPOLAMA sınırı + ARAZI (m²) + GÜÇ (kW) + ARAŞTIRMA ağacı.
 */
(function (global) {
  global.Axyon = global.Axyon || {};

  global.Axyon.Data = {
    game: { title: 'Axyon Idle Factory', version: '2.0.0', world: 'Kestros Kolonisi' },
    resource: { id: 'coin', name: 'Kredi', symbol: '🪙' },

    // Parçalar. cap = temel depolama kapasitesi (yükseltilebilir). research=true → tech'e harcanır.
    items: {
      // Hammadde (tier 0)
      ironOre:    { name: 'Demir Cevheri', icon: '🪨', tier: 0, sell: 1,   cap: 500, desc:'Fırında eritilerek Demir Levha olur. Tüm sanayinin temeli.' },
      copperOre:  { name: 'Bakır Cevheri', icon: '🟫', tier: 0, sell: 1.4, cap: 500, desc:'Bakır Fırınında eritilerek Bakır Levha olur.' },
      coal:       { name: 'Kömür',         icon: '⚫', tier: 0, sell: 1.2, cap: 500, desc:'Kömür Jeneratörü yakıtı ve Plastik üretiminde kullanılır.' },
      stone:      { name: 'Taş',           icon: '⛰️', tier: 0, sell: 0.8, cap: 500, desc:'Silikon Fırınında işlenir; inşaat ve elektronik için.' },
      crudeOil:   { name: 'Ham Petrol',    icon: '🛢️', tier: 0, sell: 2,   cap: 800, desc:'Rafineride Petrol Gazına dönüşür. Kimya zincirinin başı.' },
      water:      { name: 'Su',            icon: '💧', tier: 0, sell: 0,   cap: 1000, desc:'Hidro Türbin yakıtı ve bazı kimya süreçlerinde girdi.' },
      uraniumOre: { name: 'Uranyum Cevheri', icon: '🟢', tier: 0, sell: 8, cap: 250, desc:'Nükleer Reaktör yakıtı. Yüksek güç için gerekli.' },
      // Eritme (tier 1)
      ironPlate:  { name: 'Demir Levha',   icon: '⬜', tier: 1, sell: 4,   cap: 400, desc:'Dişli, devre, çelik, batarya... her yere giren ara malzeme.' },
      copperPlate:{ name: 'Bakır Levha',   icon: '🟧', tier: 1, sell: 6,   cap: 400, desc:'Bakır Tel ve batarya üretiminin girdisi.' },
      steel:      { name: 'Çelik',         icon: '◻️', tier: 1, sell: 22,  cap: 300, desc:'Demir Levhadan üretilir. Kafes ve motor için sağlam malzeme.' },
      silicon:    { name: 'Silikon',       icon: '🔷', tier: 1, sell: 12,  cap: 300, desc:'Taştan üretilir. İleri elektronikte kullanılır.' },
      petroleum:  { name: 'Petrol Gazı',   icon: '⛽', tier: 1, sell: 3,   cap: 800, desc:'Ham petrolden rafine edilir. Plastik ve kükürt girdisi.' },
      // Bileşen (tier 2)
      gear:       { name: 'Dişli',         icon: '⚙️', tier: 2, sell: 14,  cap: 300, desc:'Demir Levhadan preslenir. Motor, kafes ve Alfa Lab girdisi.' },
      wire:       { name: 'Bakır Tel',     icon: '🧵', tier: 2, sell: 9,   cap: 400, desc:'Bakır Levhadan çekilir. Devre ve işlemci için gerekli.' },
      circuit:    { name: 'Devre Kartı',   icon: '🟩', tier: 2, sell: 42,  cap: 300, desc:'Elektroniğin temel taşı. İşlemci, motor, drone girdisi.' },
      frame:      { name: 'Çelik Kafes',   icon: '🏗️', tier: 2, sell: 65,  cap: 200, desc:'Çelik + dişliden kaynak. Makine ve Beta Lab için.' },
      plastic:    { name: 'Plastik',       icon: '🟪', tier: 2, sell: 12,  cap: 300, desc:'Kömür + petrolden üretilir. İşlemci ve Gama Lab girdisi.' },
      sulfur:     { name: 'Kükürt',        icon: '🟡', tier: 2, sell: 8,   cap: 300, desc:'Petrolden elde edilir. Batarya üretiminde kullanılır.' },
      // Gelişmiş (tier 3)
      processor:  { name: 'İşlemci',       icon: '🟥', tier: 3, sell: 130, cap: 200, desc:'Devre + plastikten üretilen ileri çip. Elektronik ve kuantum için.' },
      motor:      { name: 'Elektrik Motoru', icon: '🔵', tier: 3, sell: 95, cap: 200, desc:'Çelik + dişli + devreden montajlanır. Makine ve drone girdisi.' },
      battery:    { name: 'Batarya',       icon: '🔋', tier: 3, sell: 75,  cap: 200, desc:'Levha + kükürtten üretilir. Drone ve enerji için.' },
      // İleri (tier 4)
      quantumCore:{ name: 'Kuantum Çekirdek', icon: '🟦', tier: 4, sell: 420, cap: 150, desc:'En değerli bileşen. Kuantum Fabrikasında üretilir.' },
      drone:      { name: 'Drone İskeleti', icon: '🤖', tier: 4, sell: 320, cap: 150, desc:'Motor + batarya + devreden montajlanan ileri ürün. Yüksek değerli.' },
      electronics:{ name: 'Elektronik',    icon: '💻', tier: 4, sell: 520, cap: 150, desc:'Yüksek değerli son ürün. İşlemci + devreden üretilir, satışta zirve.' },
      machinery:  { name: 'Makine Ünitesi', icon: '🔩', tier: 4, sell: 470, cap: 150, desc:'Motor + kafesten üretilen değerli makine ünitesi.' },
      // Araştırma çekirdekleri (satılmaz, tech'e harcanır)
      alphaCore:  { name: 'Alfa Veri', icon: '🔴', tier: 2, sell: 0, cap: 300, research: true, desc:'🔬 Araştırma çekirdeği. Temel teknolojileri açmak için harcanır. Satılmaz.' },
      betaCore:   { name: 'Beta Veri', icon: '🟢', tier: 3, sell: 0, cap: 300, research: true, desc:'🔬 Orta seviye araştırma çekirdeği. İleri teknolojiler için. Satılmaz.' },
      gammaCore:  { name: 'Gama Veri', icon: '🔵', tier: 4, sell: 0, cap: 250, research: true, desc:'🔬 İleri araştırma çekirdeği. Robotik/kuantum/nükleer için. Satılmaz.' },
    },

    // Makine hatları. footprint = arazi (m²/makine), power = kW/makine (otomatikken).
    // recipe.in boşsa çıkarıcı. tech: gerektirdiği araştırma (null = başta açık).
    machines: [
      // Çıkarıcılar
      { id:'ironMine',   name:'Demir Madeni',   icon:'⛏️', tier:0, recipe:{in:{}, out:{ironOre:1}},   baseRate:1.0, footprint:6, power:8,  buildCost:20,  buildGrowth:1.15, managerCost:80,    tech:null },
      { id:'copperMine', name:'Bakır Madeni',   icon:'⛏️', tier:0, recipe:{in:{}, out:{copperOre:1}}, baseRate:1.0, footprint:6, power:8,  buildCost:35,  buildGrowth:1.15, managerCost:90,    tech:null },
      { id:'coalDrill',  name:'Kömür Ocağı',    icon:'🕳️', tier:0, recipe:{in:{}, out:{coal:1}},      baseRate:1.0, footprint:6, power:8,  buildCost:45,  buildGrowth:1.15, managerCost:110,   tech:null },
      { id:'stoneQuarry',name:'Taş Ocağı',      icon:'🪓', tier:0, recipe:{in:{}, out:{stone:1}},     baseRate:1.0, footprint:6, power:6,  buildCost:45,  buildGrowth:1.15, managerCost:280,   tech:'basics' },
      { id:'waterPump',  name:'Su Pompası',     icon:'🚰', tier:0, recipe:{in:{}, out:{water:5}},     baseRate:1.0, footprint:4, power:4,  buildCost:80,  buildGrowth:1.15, managerCost:400,   tech:'basics' },
      { id:'oilPump',    name:'Petrol Kuyusu',  icon:'🛢️', tier:0, recipe:{in:{}, out:{crudeOil:2}},  baseRate:1.0, footprint:8, power:12, buildCost:250, buildGrowth:1.15, managerCost:1800,  tech:'oil' },
      { id:'uraniumMine',name:'Uranyum Madeni', icon:'☢️', tier:0, recipe:{in:{}, out:{uraniumOre:1}},baseRate:0.5, footprint:10,power:20, buildCost:6000,buildGrowth:1.15, managerCost:35000, tech:'nuclear' },
      // Eritme
      { id:'ironFurnace',  name:'Demir Fırını', icon:'🔥', tier:1, recipe:{in:{ironOre:1}, out:{ironPlate:1}},    baseRate:1.0, footprint:5, power:10, buildCost:30,  buildGrowth:1.15, managerCost:180,   tech:null },
      { id:'copperFurnace',name:'Bakır Fırını', icon:'🔥', tier:1, recipe:{in:{copperOre:1}, out:{copperPlate:1}},baseRate:1.0, footprint:5, power:10, buildCost:45,  buildGrowth:1.15, managerCost:190,   tech:null },
      { id:'steelMill',    name:'Çelik Ocağı',  icon:'🏭', tier:1, recipe:{in:{ironPlate:4}, out:{steel:1}},      baseRate:0.6, footprint:8, power:20, buildCost:320, buildGrowth:1.15, managerCost:3200,  tech:'steel' },
      { id:'siliconFurnace',name:'Silikon Fırını',icon:'♨️',tier:1, recipe:{in:{stone:2}, out:{silicon:1}},      baseRate:0.8, footprint:5, power:12, buildCost:220, buildGrowth:1.15, managerCost:2200,  tech:'basics' },
      // Bileşen
      { id:'gearPress',  name:'Dişli Presi',    icon:'⚙️', tier:2, recipe:{in:{ironPlate:2}, out:{gear:1}},           baseRate:0.8, footprint:5, power:10, buildCost:110, buildGrowth:1.15, managerCost:400, tech:null },
      { id:'wireMill',   name:'Tel Çekme',      icon:'🧵', tier:2, recipe:{in:{copperPlate:1}, out:{wire:2}},         baseRate:1.0, footprint:4, power:8,  buildCost:120, buildGrowth:1.15, managerCost:1200, tech:'basics' },
      { id:'circuitAsm', name:'Devre Montajı',  icon:'🟩', tier:2, recipe:{in:{ironPlate:1, wire:3}, out:{circuit:1}}, baseRate:0.6, footprint:6, power:14, buildCost:420, buildGrowth:1.15, managerCost:4200, tech:'electronics' },
      { id:'frameWelder',name:'Kafes Kaynağı',  icon:'🏗️', tier:2, recipe:{in:{steel:2, gear:2}, out:{frame:1}},      baseRate:0.5, footprint:7, power:18, buildCost:820, buildGrowth:1.15, managerCost:8200, tech:'steel' },
      // Kimya
      { id:'refinery',    name:'Rafineri',      icon:'🏭', tier:2, recipe:{in:{crudeOil:10}, out:{petroleum:6}},        baseRate:0.5, footprint:10,power:25, buildCost:520,  buildGrowth:1.15, managerCost:5200, tech:'oil' },
      { id:'plasticPlant',name:'Plastik Tesisi',icon:'🟪', tier:2, recipe:{in:{coal:1, petroleum:4}, out:{plastic:2}},  baseRate:0.6, footprint:6, power:16, buildCost:640,  buildGrowth:1.15, managerCost:6400, tech:'oil' },
      { id:'sulfurPlant', name:'Kükürt Tesisi', icon:'🟡', tier:2, recipe:{in:{petroleum:4}, out:{sulfur:2}},          baseRate:0.6, footprint:6, power:14, buildCost:700,  buildGrowth:1.15, managerCost:7000, tech:'chemistry' },
      // Gelişmiş
      { id:'motorAsm',    name:'Motor Montajı', icon:'🔵', tier:3, recipe:{in:{steel:1, gear:1, circuit:1}, out:{motor:1}}, baseRate:0.5, footprint:7, power:22, buildCost:2200, buildGrowth:1.15, managerCost:22000, tech:'motors' },
      { id:'batteryPlant',name:'Batarya Tesisi',icon:'🔋', tier:3, recipe:{in:{ironPlate:1, copperPlate:1, sulfur:1}, out:{battery:1}}, baseRate:0.6, footprint:6, power:18, buildCost:1600, buildGrowth:1.15, managerCost:16000, tech:'chemistry' },
      { id:'processorFab',name:'İşlemci Fabrikası',icon:'🟥',tier:3, recipe:{in:{circuit:2, plastic:2, wire:4}, out:{processor:1}}, baseRate:0.4, footprint:8, power:30, buildCost:3200, buildGrowth:1.15, managerCost:32000, tech:'advElectronics' },
      // İleri
      { id:'quantumFab',  name:'Kuantum Fabrikası',icon:'🟦',tier:4, recipe:{in:{circuit:5, processor:2}, out:{quantumCore:1}}, baseRate:0.3, footprint:10,power:45, buildCost:22000, buildGrowth:1.15, managerCost:220000, tech:'quantum' },
      { id:'droneFactory',name:'Drone Fabrikası', icon:'🤖', tier:4, recipe:{in:{motor:1, battery:2, circuit:3}, out:{drone:1}}, baseRate:0.3, footprint:9, power:40, buildCost:16000, buildGrowth:1.15, managerCost:160000, tech:'robotics' },
      { id:'electronicsFab',name:'Elektronik Fab.',icon:'💻',tier:4, recipe:{in:{processor:2, circuit:1}, out:{electronics:1}}, baseRate:0.35,footprint:8, power:32, buildCost:6500, buildGrowth:1.15, managerCost:65000, tech:'advElectronics' },
      { id:'machineryFab',name:'Makine Fabrikası',icon:'🔩', tier:4, recipe:{in:{motor:1, frame:2}, out:{machinery:1}},    baseRate:0.35,footprint:8, power:30, buildCost:5200, buildGrowth:1.15, managerCost:52000, tech:'motors' },
      // Araştırma laboratuvarları (veri çekirdeği üretir)
      { id:'alphaLab', name:'Alfa Lab', icon:'🔴', tier:2, recipe:{in:{copperPlate:1, gear:1}, out:{alphaCore:1}}, baseRate:0.5, footprint:5, power:12, buildCost:150,  buildGrowth:1.15, managerCost:400,  tech:null },
      { id:'betaLab',  name:'Beta Lab',  icon:'🟢', tier:3, recipe:{in:{circuit:1, frame:1}, out:{betaCore:1}},    baseRate:0.4, footprint:6, power:18, buildCost:1100, buildGrowth:1.15, managerCost:11000, tech:'electronics' },
      { id:'gammaLab', name:'Gama Lab', icon:'🔵', tier:4, recipe:{in:{processor:1, plastic:2}, out:{gammaCore:1}}, baseRate:0.3, footprint:8, power:30, buildCost:8500, buildGrowth:1.15, managerCost:85000, tech:'advElectronics' },
    ],

    // Güç santralleri. output = kW/santral. fuel = tükettiği parça (null = yakıtsız).
    powerPlants: [
      { id:'coalGen',  name:'Kömür Jeneratörü', icon:'🔥', output:60,  fuel:{item:'coal', rate:0.5},   footprint:6,  buildCost:100,  buildGrowth:1.18, tech:null },
      { id:'solarArray',name:'Güneş Paneli',    icon:'☀️', output:45,  fuel:null,                       footprint:10, buildCost:450,  buildGrowth:1.18, tech:'solar' },
      { id:'hydroTurbine',name:'Hidro Türbin',  icon:'💧', output:110, fuel:{item:'water', rate:2},     footprint:8,  buildCost:1300, buildGrowth:1.18, tech:'hydro' },
      { id:'nuclearReactor',name:'Nükleer Reaktör',icon:'☢️',output:520,fuel:{item:'uraniumOre', rate:0.1},footprint:14,buildCost:32000,buildGrowth:1.18, tech:'nuclear' },
    ],

    // Araştırma ağacı. cost = harcanan çekirdekler. prereq = önkoşul tech id'leri.
    research: [
      { id:'basics',       name:'Temel Otomasyon', icon:'🔧', cost:{alphaCore:10}, prereq:[], desc:'Taş ocağı, su pompası, silikon fırını, dişli presi, tel çekme' },
      { id:'steel',        name:'Çelik İşleme',    icon:'◻️', cost:{alphaCore:35}, prereq:['basics'], desc:'Çelik ocağı, kafes kaynağı' },
      { id:'electronics',  name:'Elektronik',      icon:'🟩', cost:{alphaCore:55}, prereq:['basics'], desc:'Devre montajı, Beta Lab' },
      { id:'solar',        name:'Güneş Enerjisi',  icon:'☀️', cost:{alphaCore:45}, prereq:['basics'], desc:'Güneş paneli (yakıtsız güç)' },
      { id:'oil',          name:'Petrol İşleme',   icon:'🛢️', cost:{betaCore:30}, prereq:['electronics'], desc:'Petrol kuyusu, rafineri, plastik tesisi' },
      { id:'chemistry',    name:'Kimya',           icon:'🧪', cost:{betaCore:45}, prereq:['oil'], desc:'Kükürt tesisi, batarya tesisi' },
      { id:'hydro',        name:'Hidroelektrik',   icon:'💧', cost:{betaCore:40}, prereq:['oil'], desc:'Hidro türbin (yüksek güç)' },
      { id:'motors',       name:'Motor Teknolojisi',icon:'🔵',cost:{betaCore:55}, prereq:['electronics','steel'], desc:'Motor montajı, makine fabrikası' },
      { id:'advElectronics',name:'İleri Elektronik',icon:'🟥',cost:{betaCore:100},prereq:['electronics','chemistry'], desc:'İşlemci fabrikası, elektronik fab., Gama Lab' },
      { id:'robotics',     name:'Robotik',         icon:'🤖', cost:{gammaCore:40}, prereq:['advElectronics','motors'], desc:'Drone fabrikası' },
      { id:'quantum',      name:'Kuantum Bilişim', icon:'🟦', cost:{gammaCore:65}, prereq:['advElectronics'], desc:'Kuantum fabrikası' },
      { id:'nuclear',      name:'Nükleer Güç',     icon:'☢️', cost:{gammaCore:90}, prereq:['advElectronics','hydro'], desc:'Uranyum madeni, nükleer reaktör' },
    ],

    // Makine sayısı milestone'ları (o makinenin üretimini çarpar)
    milestones: [
      { count: 10, multiplier: 1.5 },
      { count: 25, multiplier: 2 },
      { count: 50, multiplier: 2.5 },
      { count: 100, multiplier: 3 },
    ],

    land: {
      baseArea: 140,            // başlangıç arazi (m²)
      expandAmount: 50,         // her genişletmede eklenen m²
      expandBaseCost: 250,      // ilk genişletme maliyeti
      expandGrowth: 1.55,       // her genişletmede maliyet çarpanı
    },

    prestige: {
      runEarnedThreshold: 250000,
      nexusDivisor: 60000,          // nexus = floor(sqrt(runEarned / bu))
      nexusBonusPerPoint: 0.05,     // her Nexus tüm üretime +%5
    },

    quests: [
      { id:'q1', type:'itemProduced', item:'ironOre', target:40, desc:'40 Demir Cevheri üret', reward:{coins:60} },
      { id:'q2', type:'buildCount', target:3, desc:'3 makine inşa et', reward:{coins:150} },
      { id:'q3', type:'itemProduced', item:'alphaCore', target:15, desc:'15 Alfa Veri üret', reward:{coins:400} },
      { id:'q4', type:'research', target:1, desc:'İlk araştırmanı tamamla', reward:{coins:800} },
      { id:'q5', type:'powerBuilt', target:2, desc:'2 güç santrali kur', reward:{coins:1200} },
      { id:'q6', type:'itemProduced', item:'circuit', target:100, desc:'100 Devre Kartı üret', reward:{alphaCore:20} },
      { id:'q7', type:'landExpand', target:1, desc:'Araziyi genişlet', reward:{coins:3000} },
      { id:'q8', type:'itemProduced', item:'processor', target:50, desc:'50 İşlemci üret', reward:{betaCore:15} },
      { id:'q9', type:'itemProduced', item:'electronics', target:30, desc:'30 Elektronik üret', reward:{gammaCore:10} },
      { id:'q10', type:'prestige', target:1, desc:'İlk prestige (Nexus)', reward:{gammaCore:25} },
    ],

    achievements: [
      { id:'a_build', desc:'İlk makine', check:(s)=> s.stats.machinesBuilt >= 1 },
      { id:'a_power', desc:'İlk güç santrali', check:(s)=> s.stats.plantsBuilt >= 1 },
      { id:'a_mgr', desc:'İlk manager', check:(s)=> s.stats.managersBought >= 1 },
      { id:'a_research', desc:'İlk araştırma', check:(s)=> Object.keys(s.researched).length >= 1 },
      { id:'a_land', desc:'Araziyi genişlet', check:(s)=> s.landExpansions >= 1 },
      { id:'a_circuit', desc:'İlk devre kartı', check:(s)=> (s.stats.produced.circuit||0) >= 1 },
      { id:'a_processor', desc:'İlk işlemci', check:(s)=> (s.stats.produced.processor||0) >= 1 },
      { id:'a_electronics', desc:'İlk elektronik', check:(s)=> (s.stats.produced.electronics||0) >= 1 },
      { id:'a_alltech', desc:'Tüm araştırmalar', check:(s)=> Object.keys(s.researched).length >= 12 },
      { id:'a_prestige', desc:'İlk Nexus', check:(s)=> s.prestigeCount >= 1 },
    ],

    economyConfig: {
      basePower: 30,               // koloninin sabit taban gücü (deadlock'u kırar, ilk makineleri çalıştırır)
      offlineCapSeconds: 4*60*60,
      offlineRate: 0.6,
      tickIntervalMs: 100,
      autosaveIntervalMs: 8000,
      manualBurstSeconds: 3,
      storageUpgradeCostPer: 20,   // depo yükseltme maliyeti = cap*bu (kaba)
      storageUpgradeMult: 1.5,     // her depo yükseltmesi kapasiteyi ×1.5
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
