/** Axyon.Canonical — read-only v4.4 frozen data index for staged gameplay migration. */
(function(global){
  'use strict';
  global.Axyon=global.Axyon||{};
  const flags=global.Axyon.FeatureFlags||{};
  const raw=global.Axyon.CanonicalDataPayload;
  function freezeDeep(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.values(value).forEach(freezeDeep);return Object.freeze(value);}
  function makeIndex(list,label){const map=Object.create(null);for(const row of list||[]){if(!row||typeof row.id!=='string'||!row.id)throw new Error(`Canonical ${label}: invalid id`);if(map[row.id])throw new Error(`Canonical ${label}: duplicate ${row.id}`);map[row.id]=row;}return Object.freeze(map);}
  function validate(data){
    const errors=[];
    if(!data||typeof data!=='object')errors.push('payload missing');
    if(Number(data?.meta?.schemaVersion)!==16)errors.push('schemaVersion must be 16');
    if(Number(data?.rules?.worldSize)!==300)errors.push('worldSize must be 300');
    if(Number(data?.rules?.chunkSize)!==20)errors.push('chunkSize must be 20');
    if(data?.rules?.localSellingEnabled!==false)errors.push('local selling must be disabled');
    for(const key of ['items','machines','powerPlants','technologies','repeatableTechnologies','ships','satellites','defenses','planetTypes']){
      if(!Array.isArray(data?.[key]))errors.push(`${key} missing`);
    }
    if(errors.length)throw new Error(`Canonical data validation failed: ${errors.join('; ')}`);
    return true;
  }
  if(flags.V44_CANONICAL_DATA_ENABLED!==false){
    validate(raw);
    const indexes=Object.freeze({
      items:makeIndex(raw.items,'items'),machines:makeIndex(raw.machines,'machines'),powerPlants:makeIndex(raw.powerPlants,'powerPlants'),
      technologies:makeIndex(raw.technologies,'technologies'),repeatableTechnologies:makeIndex(raw.repeatableTechnologies,'repeatableTechnologies'),
      ships:makeIndex(raw.ships,'ships'),satellites:makeIndex(raw.satellites,'satellites'),defenses:makeIndex(raw.defenses,'defenses'),planetTypes:makeIndex(raw.planetTypes,'planetTypes')
    });
    global.Axyon.Canonical=Object.freeze({data:freezeDeep(raw),indexes,validate,version:raw.meta.designVersion,status:raw.meta.status,get:(group,id)=>indexes[group]?.[id]||null,counts:Object.freeze(Object.fromEntries(Object.entries(indexes).map(([k,v])=>[k,Object.keys(v).length])))});
  }
})(typeof window!=='undefined'?window:globalThis);
