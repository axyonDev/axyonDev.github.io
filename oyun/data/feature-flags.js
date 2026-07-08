/** AXYON: Orbital Ascendancy v4.5.5 U4.3.2 feature gates. */
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
    release:'4.5.5-u4.3.2'
  });
})(typeof window!=='undefined'?window:globalThis);
