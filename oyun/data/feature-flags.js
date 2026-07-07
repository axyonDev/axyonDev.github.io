/** Axyon v4.4 U2 feature gates — Decimal runtime and First Orbit economy. */
(function(global){
  global.Axyon=global.Axyon||{};
  global.Axyon.FeatureFlags=Object.freeze({
    V44_SAVE_V16_ENABLED:true,
    V44_CANONICAL_DATA_ENABLED:true,
    V44_ZERO_CREDIT_GAMEPLAY_ENABLED:true,
    V44_DECIMAL_RUNTIME_ENABLED:true,
    V44_FIRST_ORBIT_ENABLED:true,
    V44_COHORT_DEFENSE_ENABLED:false,
    release:'4.4.0-u2'
  });
})(typeof window!=='undefined'?window:globalThis);
