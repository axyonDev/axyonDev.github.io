/** AXYON: Orbital Ascendancy v4.5.6 U4.3.3 feature gates. */
(function(global){
  global.Axyon=global.Axyon||{};
  global.Axyon.FeatureFlags=Object.freeze({
    V44_SAVE_V16_ENABLED:true,
    V44_CANONICAL_DATA_ENABLED:true,
    V44_ZERO_CREDIT_GAMEPLAY_ENABLED:true,
    V44_DECIMAL_RUNTIME_ENABLED:true,
    V44_FIRST_ORBIT_ENABLED:true,
    V44_COHORT_DEFENSE_ENABLED:true,
    V44_PLANETARY_CAPACITY_ENABLED:true,
    V44_BACKGROUND_RESUME_ENABLED:true,
    U4_INDEXEDDB_VAULT_ENABLED:true,
    U4_LOCALSTORAGE_MIRROR_ENABLED:true,
    U41_IDEMPOTENT_COMMANDS_ENABLED:true,
    U41_SERVER_CLOCK_CONTRACT_ENABLED:true,
    U42_AUTHORITATIVE_SERVER_ENABLED:true,
    U43_PERSISTENT_AUTHORITY_ENABLED:true,
    U43_REAL_NETWORK_ADAPTER_ENABLED:true,
    U433_FACTORY_INTELLIGENCE_ENABLED:true,
    P0_SPATIAL_SIM_PROOF_ENABLED:true,
    // P1: spatial-sim → canlı grid gölge köprüsü mevcut. Açma/kapama per-save
    // ayardır (state.settings.spatialSim, varsayılan KAPALI). Gölge modu canlı
    // aggregate ekonomiyi değiştirmez; yalnız gerçek per-entity telemetri üretir.
    P1_SPATIAL_BRIDGE_SHADOW_AVAILABLE:true,
    // U4.3.4: okunabilir/çakışmasız palet kartları, kompakt/geniş menü yoğunluğu
    // (state.settings.density, varsayılan 'wide'), "neden durdu?" durum dili ve
    // görsel/efekt polish. Oynanış önerileri spec'i pakete eklendi.
    U434_READABLE_PALETTE_DENSITY_ENABLED:true,
    release:'4.5.7-u4.3.4'
  });
})(typeof window!=='undefined'?window:globalThis);
