/** Axyon.SaveService v4.4 U3.1 — v16 storage, recoverable transient writes, transactional migration. */
(function(global){
  'use strict';
  const LEGACY_KEY='axyon_idle_factory_v2',INDEX_KEY='axyon_frontier_profiles_v1',ACTIVE_KEY='axyon_frontier_active_profile',SAVE_PREFIX='axyon_frontier_save_';
  const FLAGS=global.Axyon.FeatureFlags||{},EN=global.Axyon.EconomyNumber,M=global.Axyon.SaveMigratorV16;
  const SAVE_RETRY_COOLDOWN_MS=30000;
  let suspended=false,blockingError=null,lastMigration=null,lastSuccessfulSaveAt=0,lastSaveErrorAt=0,nextSaveRetryAt=0;
  const now=()=>Date.now(),emit=(name,detail)=>{try{global.dispatchEvent?.(new CustomEvent(name,{detail}));}catch(_){}},uid=()=>`cmd_${now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
  const cleanName=name=>String(name||'').trim().replace(/[<>\"'&`\x00-\x1F\x7F]/g,'').replace(/\s+/g,' ').slice(0,32);
  const normalize=s=>global.Axyon.Economy.normalizeState(s);
  const clone=o=>JSON.parse(JSON.stringify(o));
  const readIndex=()=>{try{const x=JSON.parse(localStorage.getItem(INDEX_KEY)||'[]');return Array.isArray(x)?x:[];}catch(_){return[];}};
  const writeIndex=list=>localStorage.setItem(INDEX_KEY,JSON.stringify(list));
  const saveKey=id=>SAVE_PREFIX+id,currentProfileId=()=>localStorage.getItem(ACTIVE_KEY)||'';
  const currentProfile=()=>readIndex().find(x=>x.id===currentProfileId())||null;
  const listProfiles=()=>readIndex().sort((a,b)=>(b.lastPlayedAt||0)-(a.lastPlayedAt||0));
  function touchProfile(id,patch){const list=readIndex(),i=list.findIndex(x=>x.id===id);if(i<0)return null;list[i]=Object.assign({},list[i],patch||{},{lastPlayedAt:now()});writeIndex(list);return list[i];}
  const economyPaths={
    roots:['credits','totalEarned','runEarned','topScore'],
    decimalMaps:['inventory','flow','stats.produced'],
    structuralMaps:['galaxy.ships','galaxy.defenses','maintenance.damagedShips','maintenance.damagedDefenses']
  };
  const allEconomyMaps=()=>economyPaths.decimalMaps.concat(economyPaths.structuralMaps);
  function getPath(obj,path){return path.split('.').reduce((v,k)=>v&&v[k],obj);}
  function setPath(obj,path,value){const parts=path.split('.');let cur=obj;for(let i=0;i<parts.length-1;i++)cur=cur[parts[i]]||(cur[parts[i]]={});cur[parts.at(-1)]=value;}
  function buildShadow(v16){const out={};for(const key of economyPaths.roots)out[`economy.${key}`]=v16.economy?.[key]||'0';for(const path of allEconomyMaps())for(const[k,v]of Object.entries(getPath(v16,path)||{}))out[`${path}.${k}`]=v;return out;}
  function storageValue(path,value,shadow,signedValue){
    const prior=shadow?.[path];
    try{if(prior&&(signedValue?EN.fromStorageSigned(prior).eq(EN.signed(value)):EN.fromStorage(prior).eq(EN.safe(value))))return prior;}catch(_){}
    return signedValue?EN.toStorageSigned(value||0):EN.toStorage(value||0);
  }
  function runtimeFromV16(v16){
    M.validateV16(v16);const shadow=buildShadow(v16),raw=clone(v16);
    raw.version=16;
    raw.coins=EN.fromStorage(v16.economy.credits);raw.totalEarned=EN.fromStorage(v16.economy.totalEarned);raw.runEarned=EN.fromStorage(v16.economy.runEarned);raw.topScore=EN.fromStorage(v16.economy.topScore);
    delete raw.economy;delete raw.schemaVersion;delete raw.economyNumberStorage;
    for(const path of economyPaths.decimalMaps){const map=getPath(v16,path)||{},converted={};for(const[k,v]of Object.entries(map))converted[k]=path==='flow'?EN.fromStorageSigned(v):EN.fromStorage(v);setPath(raw,path,converted);}
    for(const path of economyPaths.structuralMaps){const map=getPath(v16,path)||{},converted={};for(const[k,v]of Object.entries(map))converted[k]=Math.max(0,Math.floor(EN.toSafeNumber(v,1000000000)));setPath(raw,path,converted);}
    raw.market=Object.assign({},raw.market,{level:Number(v16.market.networkMk||0),networkMk:Number(v16.market.networkMk||0),satellites:Number(v16.market.satelliteCount||0),prototypeBuilt:!!v16.market.prototypeBuilt,creditEconomyUnlocked:!!v16.market.creditEconomyUnlocked,legacyAccess:!!v16.market.legacyAccess,lastRevenue:EN.fromStorage(v16.market.lastRevenue||'0'),lastUnits:EN.fromStorage(v16.market.lastUnits||'0'),totalRevenue:EN.fromStorage(v16.market.totalRevenue||'0')});
    const state=normalize(raw);
    Object.defineProperty(state,'__v16Shadow',{value:shadow,writable:true,configurable:true,enumerable:false});
    Object.defineProperty(state,'__v16Migration',{value:clone(v16.migration),writable:true,configurable:true,enumerable:false});
    Object.defineProperty(state,'__saveSchema',{value:16,writable:true,configurable:true,enumerable:false});
    return state;
  }
  function encodeRuntime(state){
    const raw=clone(state),shadow=state.__v16Shadow||{};raw.version=16;raw.schemaVersion=16;raw.economyNumberStorage='string';
    raw.economy={credits:storageValue('economy.credits',state.coins,shadow),totalEarned:storageValue('economy.totalEarned',state.totalEarned,shadow),runEarned:storageValue('economy.runEarned',state.runEarned,shadow),topScore:storageValue('economy.topScore',state.topScore,shadow)};
    for(const path of economyPaths.decimalMaps){const map=getPath(state,path)||{},encoded={};for(const[k,v]of Object.entries(map))encoded[k]=storageValue(`${path}.${k}`,v,shadow,path==='flow');setPath(raw,path,encoded);}
    for(const path of economyPaths.structuralMaps){const map=getPath(state,path)||{},encoded={};for(const[k,v]of Object.entries(map))encoded[k]=EN.toStorage(Math.max(0,Math.floor(Number(v)||0)));setPath(raw,path,encoded);}
    const mk=Math.max(0,Math.min(3,Math.floor(Number(state.market?.networkMk??state.market?.level)||0))),sats=Math.max(0,Math.min(9,Math.floor(Number(state.galaxy?.satellites?.prototypeMarketSatellite||0)+Number(state.galaxy?.satellites?.marketSatellite||0))));
    raw.market=Object.assign({},raw.market,{networkMk:mk,satelliteCount:sats,prototypeBuilt:!!state.market?.prototypeBuilt,creditEconomyUnlocked:!!state.market?.creditEconomyUnlocked,lastRevenue:storageValue('market.lastRevenue',state.market?.lastRevenue||0,shadow),lastUnits:storageValue('market.lastUnits',state.market?.lastUnits||0,shadow),totalRevenue:storageValue('market.totalRevenue',state.market?.totalRevenue||0,shadow),foundingContractsCompleted:[...(state.market?.foundingContractsCompleted||[])],legacyAccess:!!state.market?.legacyAccess});
    const previous=state.__v16Migration||{};raw.migration={fromVersion:Number(previous.fromVersion||15),toVersion:16,migratedAt:previous.migratedAt||now(),backupSha256:previous.backupSha256||M.sha256(JSON.stringify(state)),exactUnsafeIntegerLiteralsPreserved:previous.exactUnsafeIntegerLiteralsPreserved!==false,inheritedTechnologies:Array.isArray(previous.inheritedTechnologies)?previous.inheritedTechnologies:[],legacyCreditAccess:!!state.market?.legacyAccess,warnings:Array.isArray(previous.warnings)?previous.warnings:[]};
    delete raw.coins;delete raw.credits;delete raw.totalEarned;delete raw.runEarned;delete raw.topScore;
    M.validateV16(raw);return raw;
  }
  function inspectVersion(raw){const m=String(raw||'').match(/\"(?:version|schemaVersion)\"\s*:\s*(\d+)/);return m?Number(m[1]):0;}
  function ensureV16(key){
    const raw=localStorage.getItem(key);if(raw===null)return{ok:false,error:'Kayıt bulunamadı'};const v=inspectVersion(raw);
    if(v===16){try{M.validateV16(JSON.parse(raw));return{ok:true,migrated:false};}catch(e){return{ok:false,error:e.message};}}
    if(v===15){const r=M.transactionalMigrate(localStorage,key);lastMigration=r;if(!r.ok)return{ok:false,error:r.error,rolledBack:r.rolledBack,backupKey:r.backupKey};return{ok:true,migrated:true,backupKey:r.backupKey};}
    try{const legacy=normalize(JSON.parse(raw));legacy.version=15;localStorage.setItem(`${key}.backup.legacy.${now()}`,raw);localStorage.setItem(key,JSON.stringify(legacy));return ensureV16(key);}catch(e){return{ok:false,error:`Desteklenmeyen veya bozuk kayıt: ${e.message}`};}
  }
  function writeState(id,state){const key=saveKey(id),payload=FLAGS.V44_SAVE_V16_ENABLED===false?JSON.stringify(state):JSON.stringify(encodeRuntime(state)),temp=`${key}.write.tmp`;localStorage.setItem(temp,payload);if(FLAGS.V44_SAVE_V16_ENABLED!==false)M.validateV16(JSON.parse(localStorage.getItem(temp)));localStorage.setItem(key,localStorage.getItem(temp));localStorage.removeItem(temp);return true;}
  function createProfile(name,initialState,options){name=cleanName(name);if(name.length<2)return{ok:false,error:'Komutan adı en az 2 karakter olmalı.'};const list=readIndex();if(list.some(x=>x.name.toLocaleLowerCase('tr-TR')===name.toLocaleLowerCase('tr-TR')))return{ok:false,error:'Bu komutan adı zaten kullanılıyor.'};const id=uid(),createdAt=now(),profile={id,name,empireName:`${name} İmparatorluğu`,createdAt,lastPlayedAt:createdAt,version:2,saveSchema:16};const state=normalize(initialState||global.Axyon.Economy.createInitialState({planetType:options?.planetType,startRegion:options?.startRegion}));writeState(id,state);list.push(profile);writeIndex(list);localStorage.setItem(ACTIVE_KEY,id);blockingError=null;nextSaveRetryAt=0;return{ok:true,profile,state};}
  function selectProfile(id){if(!readIndex().some(x=>x.id===id))return false;localStorage.setItem(ACTIVE_KEY,id);touchProfile(id);blockingError=null;nextSaveRetryAt=0;return true;}
  function deleteProfile(id){const list=readIndex(),next=list.filter(x=>x.id!==id);if(next.length===list.length)return false;for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith(saveKey(id)))localStorage.removeItem(k);}writeIndex(next);if(currentProfileId()===id){if(next.length)localStorage.setItem(ACTIVE_KEY,next[0].id);else localStorage.removeItem(ACTIVE_KEY);}blockingError=null;nextSaveRetryAt=0;return true;}
  function migrateLegacy(){if(readIndex().length)return false;const raw=localStorage.getItem(LEGACY_KEY);if(!raw)return false;try{const state=normalize(JSON.parse(raw)),r=createProfile('Komutan',state);if(r.ok){localStorage.setItem('axyon_frontier_legacy_migrated','1');return true;}}catch(e){blockingError={type:'legacy',message:e.message};}return false;}
  function bootstrap(){migrateLegacy();const list=readIndex();if(!list.length){localStorage.removeItem(ACTIVE_KEY);return null;}let id=currentProfileId();if(!list.some(x=>x.id===id)){id=list[0].id;localStorage.setItem(ACTIVE_KEY,id);}return currentProfile();}
  function save(state,options){
    const forceRetry=!!options?.forceRetry,recovering=blockingError?.type==='save';
    if(suspended)return false;
    if(blockingError){
      if(blockingError.type!=='save')return false;
      if(!forceRetry&&now()<nextSaveRetryAt)return false;
    }
    try{
      const id=currentProfileId();if(!id)return false;
      state.version=global.Axyon.Economy.SAVE_VERSION;state.lastSeen=now();writeState(id,state);
      touchProfile(id,{gameVersion:global.Axyon.Data.game.version,saveSchema:16,product:'AXYON: Orbital Ascendancy'});
      lastSuccessfulSaveAt=now();blockingError=null;nextSaveRetryAt=0;
      emit('axyon:save-success',{at:lastSuccessfulSaveAt,recovered:recovering});return true;
    }catch(e){
      lastSaveErrorAt=now();nextSaveRetryAt=lastSaveErrorAt+SAVE_RETRY_COOLDOWN_MS;
      blockingError={type:'save',message:e.message,at:lastSaveErrorAt,retryAt:nextSaveRetryAt};
      console.error('[Save v16]',e);emit('axyon:save-error',{message:e.message,type:'save',at:lastSaveErrorAt,retryAt:nextSaveRetryAt});return false;
    }
  }
  function retrySave(state){if(suspended||blockingError?.type!=='save')return false;return save(state,{forceRetry:true});}
  function load(){try{const profile=bootstrap();if(!profile)return null;const id=currentProfileId(),key=saveKey(id),raw=localStorage.getItem(key);if(!raw){const state=global.Axyon.Economy.createInitialState();writeState(id,state);return state;}if(FLAGS.V44_SAVE_V16_ENABLED===false)return normalize(JSON.parse(raw));const ready=ensureV16(key);if(!ready.ok){blockingError={type:'migration',message:ready.error,backupKey:ready.backupKey||''};suspended=true;return global.Axyon.Economy.createInitialState();}const v16=JSON.parse(localStorage.getItem(key)),state=runtimeFromV16(v16);blockingError=null;nextSaveRetryAt=0;suspended=false;return state;}catch(e){blockingError={type:'load',message:e.message};suspended=true;console.error('[Load v16]',e);return global.Axyon.Economy.createInitialState();}}
  function resetCurrent(options){const id=currentProfileId();if(!id)return null;const current=blockingError?null:load();suspended=false;blockingError=null;nextSaveRetryAt=0;const fresh=global.Axyon.Economy.createInitialState({planetType:options?.planetType||current?.empire?.planetType||current?.planet?.type,startRegion:options?.startRegion||current?.empire?.startRegion||current?.planet?.startRegion});if(options?.theme)fresh.settings.theme=options.theme;writeState(id,fresh);touchProfile(id,{resetAt:now(),saveSchema:16});return fresh;}
  function deleteAll(){suspended=true;try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&(k.startsWith(SAVE_PREFIX)||[INDEX_KEY,ACTIVE_KEY,LEGACY_KEY].includes(k)))localStorage.removeItem(k);}blockingError=null;nextSaveRetryAt=0;}finally{suspended=false;}}
  const setSuspended=v=>{suspended=!!v;};
  const b64encode=s=>btoa(unescape(encodeURIComponent(s))),b64decode=s=>decodeURIComponent(escape(atob(s)));
  function exportString(state){const payload={format:'axyon-frontier-profile-v16',version:3,product:'AXYON: Orbital Ascendancy',profile:currentProfile(),state:encodeRuntime(state)};return b64encode(JSON.stringify(payload));}
  function importString(str){try{const decoded=JSON.parse(b64decode(str.trim())),raw=decoded&&/^axyon-frontier-profile/.test(decoded.format||'')?decoded.state:decoded;if(Number(raw?.version)===16){M.validateV16(raw);return{ok:true,state:runtimeFromV16(raw)};}return{ok:true,state:normalize(raw)};}catch(e){return{ok:false,error:'Geçersiz veya bozuk kayıt kodu.'};}}
  function diagnostics(){return{schema:16,enabled:FLAGS.V44_SAVE_V16_ENABLED!==false,suspended,blockingError,lastMigration,lastSuccessfulSaveAt,lastSaveErrorAt,nextSaveRetryAt,retryCooldownMs:SAVE_RETRY_COOLDOWN_MS,profile:currentProfile(),canonicalVersion:global.Axyon.Canonical?.version||null,economyEngine:EN?.engine||null,runtimeMode:global.Axyon.Numbers?.runtimeMode||null,firstOrbit:true,product:'AXYON: Orbital Ascendancy'};}
  function rawActiveSave(){const id=currentProfileId();return id?localStorage.getItem(saveKey(id)):null;}
  global.Axyon=global.Axyon||{};global.Axyon.SaveService={bootstrap,save,retrySave,load,resetCurrent,deleteAll,exportString,importString,listProfiles,currentProfile,currentProfileId,createProfile,selectProfile,deleteProfile,setSuspended,diagnostics,rawActiveSave,hasBlockingError:()=>!!blockingError,clearBlockingError:()=>{if(blockingError?.type!=='save')return false;blockingError=null;nextSaveRetryAt=0;return true;},keys:{INDEX_KEY,ACTIVE_KEY,SAVE_PREFIX,LEGACY_KEY},_test:{encodeRuntime,runtimeFromV16,ensureV16}};
})(typeof window!=='undefined'?window:globalThis);
