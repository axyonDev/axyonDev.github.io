/** Axyon v4.4 U1 feature gates — infrastructure first, gameplay conversion later. */
(function(global){
  global.Axyon=global.Axyon||{};
  global.Axyon.FeatureFlags=Object.freeze({
    V44_SAVE_V16_ENABLED:true,
    V44_CANONICAL_DATA_ENABLED:true,
    V44_ZERO_CREDIT_GAMEPLAY_ENABLED:false,
    V44_DECIMAL_RUNTIME_ENABLED:false,
    release:'4.4.0-u1'
  });
})(typeof window!=='undefined'?window:globalThis);
