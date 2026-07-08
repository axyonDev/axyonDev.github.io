/** Axyon.SaveService v4.5 U4 — v16 state, IndexedDB durable vault, localStorage mirror, recovery and rollback. */
(function(global){
  'use strict';

  const LEGACY_KEY='axyon_idle_factory_v2';
  const INDEX_KEY='axyon_frontier_profiles_v1';
  const ACTIVE_KEY='axyon_frontier_active_profile';
  const SAVE_PREFIX='axyon_frontier_save_';
  const MIRROR_META_KEY='axyon_storage_mirror_meta_v1';
  const FLAGS=global.Axyon.FeatureFlags||{};
  const EN=global.Axyon.EconomyNumber;
  const M=global.Axyon.SaveMigratorV16;
  const V=global.Axyon.StorageVault;
  const SAVE_RETRY_COOLDOWN_MS=30000;

  let suspended=false,blockingError=null,lastMigration=null;
  let lastSuccessfulSaveAt=0,lastDurableSaveAt=0,lastSaveErrorAt=0,nextSaveRetryAt=0;
  let preparePromise=null,prepared=false,vaultReady=false,vaultDurable=false,storageMode='unprepared';
  let mirrorMeta={},syncQueue=Promise.resolve(),saveSettlement=Promise.resolve(),pendingVaultOps=0,lastVaultError=null,lastVaultCommitAt=0,lastReconcile=null;
  let lastCriticalOperation=Promise.resolve({ok:false,fallback:true});

  const now=()=>Date.now();
  const emit=(name,detail)=>{try{global.dispatchEvent?.(new CustomEvent(name,{detail}));}catch(_){}};
  const uid=()=>`cmd_${now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
  const cleanName=name=>String(name||'').trim().replace(/[<>\"'&`\x00-\x1F\x7F]/g,'').replace(/\s+/g,' ').slice(0,32);
  const normalize=s=>global.Axyon.Economy.normalizeState(s);
  const clone=o=>JSON.parse(JSON.stringify(o));

  function readMirrorMeta(){
    try{const parsed=JSON.parse(localStorage.getItem(MIRROR_META_KEY)||'{}');return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch(_){return{};}
  }
  function persistMirrorMeta(){localStorage.setItem(MIRROR_META_KEY,JSON.stringify(mirrorMeta));}
  function isCriticalKey(key){return key===INDEX_KEY||key===ACTIVE_KEY||key===LEGACY_KEY||String(key||'').startsWith(SAVE_PREFIX);}
  function criticalLocalKeys(){const keys=new Set([INDEX_KEY,ACTIVE_KEY,...Object.keys(mirrorMeta).filter(isCriticalKey)]);for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&isCriticalKey(key)&&!key.includes('.write.tmp'))keys.add(key);}return[...keys];}

  const readIndex=()=>{try{const x=JSON.parse(localStorage.getItem(INDEX_KEY)||'[]');return Array.isArray(x)?x:[];}catch(_){return[];}};
  const saveKey=id=>SAVE_PREFIX+id;
  const currentProfileId=()=>localStorage.getItem(ACTIVE_KEY)||'';
  const currentProfile=()=>readIndex().find(x=>x.id===currentProfileId())||null;
  const listProfiles=()=>readIndex().sort((a,b)=>(b.lastPlayedAt||0)-(a.lastPlayedAt||0));

  function inspectVersion(raw){const m=String(raw||'').match(/\"(?:version|schemaVersion)\"\s*:\s*(\d+)/);return m?Number(m[1]):0;}
  function validateCriticalValue(key,value){
    try{
      if(typeof value!=='string')return false;
      if(key===INDEX_KEY)return Array.isArray(JSON.parse(value));
      if(key===ACTIVE_KEY)return value.length<256;
      if(key===LEGACY_KEY){JSON.parse(value);return true;}
      if(key.startsWith(SAVE_PREFIX)){
        const version=inspectVersion(value),parsed=JSON.parse(value);
        if(!version||!parsed||typeof parsed!=='object')return false;
        if(version===16)M.validateV16(parsed);
        return version>0&&version<=16;
      }
      return true;
    }catch(_){return false;}
  }

  function localCandidate(key){
    const value=localStorage.getItem(key),meta=mirrorMeta[key]||{};
    if(value===null){
      if(!meta.deleted)return null;
      return{key,value:'',deleted:true,valid:true,tracked:true,revision:Math.max(1,Math.floor(Number(meta.revision)||1)),updatedAt:Math.max(0,Math.floor(Number(meta.updatedAt)||0)),checksum:V?.checksum?V.checksum(''):''};
    }
    const sum=V?.checksum?V.checksum(value):'',tracked=!meta.deleted&&!!meta.checksum&&meta.checksum===sum;
    return{key,value,deleted:false,valid:validateCriticalValue(key,value),tracked,revision:Math.max(0,Math.floor(Number(meta.revision)||0))+(tracked?0:1),updatedAt:Math.max(0,Math.floor(Number(meta.updatedAt)||0)),checksum:sum};
  }
  function vaultCandidate(record){return record?Object.assign({},record,{valid:!!V?.verifyRecord?.(record)&&(record.deleted===true||validateCriticalValue(record.key,record.value))}):null;}
  function chooseCandidate(local,vault){
    if(local?.valid&&vault?.valid){
      if(local.revision!==vault.revision)return local.revision>vault.revision?{source:'local',item:local}:{source:'vault',item:vault};
      if(local.checksum===vault.checksum)return{source:'vault',item:vault};
      if(local.updatedAt!==vault.updatedAt)return local.updatedAt>vault.updatedAt?{source:'local',item:local}:{source:'vault',item:vault};
      return local.tracked?{source:'vault',item:vault}:{source:'local',item:local};
    }
    if(local?.valid)return{source:'local',item:local};
    if(vault?.valid)return{source:'vault',item:vault};
    return null;
  }
  function writeMirrorFromRecord(record){
    if(record.deleted)localStorage.removeItem(record.key);else localStorage.setItem(record.key,record.value);
    mirrorMeta[record.key]={revision:record.revision,updatedAt:record.updatedAt,checksum:record.checksum,deleted:!!record.deleted};
  }

  async function prepare(){
    if(preparePromise)return preparePromise;
    preparePromise=(async()=>{
      mirrorMeta=readMirrorMeta();
      const report={startedAt:now(),mode:'localstorage-fallback',imported:0,hydrated:0,repaired:0,rolledBack:0,unchanged:0,issues:[]};
      if(!V){prepared=true;storageMode=report.mode;lastReconcile=report;return report;}
      const status=await V.open();
      vaultReady=!!status.ok;vaultDurable=!!status.ok&&status.durable!==false;
      storageMode=vaultReady?(vaultDurable?'indexeddb-primary':'vault-nondurable'):'localstorage-fallback';
      report.mode=storageMode;
      if(!vaultReady){report.issues.push(status.error||'IndexedDB unavailable');prepared=true;lastReconcile=report;return report;}

      const vaultRecords=await V.getAllRecords(),vaultMap=new Map(vaultRecords.map(x=>[x.key,x]));
      const keys=new Set([...criticalLocalKeys(),...vaultMap.keys()].filter(isCriticalKey));
      for(const key of keys){
        const local=localCandidate(key),vault=vaultCandidate(vaultMap.get(key));
        let winner=chooseCandidate(local,vault);
        if(!winner){
          const backups=await V.getBackups(key),backup=backups.map(vaultCandidate).find(x=>x?.valid&&!x.deleted);
          if(backup){
            const revision=Math.max(Number(local?.revision)||0,Number(vault?.revision)||0,Number(backup.revision)||0)+1;
            const restored=V.makeRecord(key,backup.value,revision,now(),'rollback');
            await V.putRecord(restored,{reason:'automatic-rollback',backupPrevious:false});
            writeMirrorFromRecord(restored);report.rolledBack++;continue;
          }
          if(local||vault)report.issues.push(`No valid copy for ${key}`);
          continue;
        }
        if(winner.source==='local'){
          const localItem=winner.item;
          const revision=Math.max(1,Number(localItem.revision)||1,Number(vault?.revision)||0);
          const record=V.makeRecord(key,localItem.value,revision,localItem.updatedAt||now(),vault?.valid?'mirror-newer':'legacy-import');record.deleted=!!localItem.deleted;
          if(!vault?.valid||vault.checksum!==record.checksum||vault.revision!==record.revision){await V.putRecord(record,{reason:vault?'mirror-repair':'u3-local-migration'});report.imported++;}
          else report.unchanged++;
          writeMirrorFromRecord(record);
        }else{
          const record=winner.item;
          const localMatches=local?.valid&&local.checksum===record.checksum&&local.revision===record.revision;
          writeMirrorFromRecord(record);
          if(localMatches)report.unchanged++;else{report.hydrated++;if(local&&!local.valid)report.repaired++;}
        }
      }
      persistMirrorMeta();
      prepared=true;report.finishedAt=now();lastReconcile=report;
      return report;
    })().catch(error=>{
      lastVaultError=error?.message||String(error);vaultReady=false;vaultDurable=false;storageMode='localstorage-fallback';prepared=true;
      const report={startedAt:now(),finishedAt:now(),mode:storageMode,imported:0,hydrated:0,repaired:0,rolledBack:0,unchanged:0,issues:[lastVaultError]};lastReconcile=report;return report;
    });
    return preparePromise;
  }

  function handleVaultFailure(error,key){
    lastVaultError=error?.message||String(error);lastSaveErrorAt=now();nextSaveRetryAt=lastSaveErrorAt+SAVE_RETRY_COOLDOWN_MS;
    if(!blockingError||blockingError.type==='save')blockingError={type:'save',layer:'indexeddb',message:lastVaultError,key,at:lastSaveErrorAt,retryAt:nextSaveRetryAt};
    console.error('[IndexedDB Vault]',error);emit('axyon:save-error',{message:lastVaultError,type:'save',layer:'indexeddb',key,at:lastSaveErrorAt,retryAt:nextSaveRetryAt});
  }
  function queueVaultPut(record,options={}){
    if(!vaultReady||!vaultDurable){lastCriticalOperation=Promise.resolve({ok:false,fallback:true});return lastCriticalOperation;}
    pendingVaultOps++;
    const operation=syncQueue.then(()=>V.putRecord(record,options)).then(saved=>{
      pendingVaultOps--;lastVaultCommitAt=now();lastVaultError=null;
      const current=mirrorMeta[saved.key]||{},localValue=localStorage.getItem(saved.key),matches=saved.deleted?localValue===null&&current.deleted===true:(localValue!==null&&V.checksum(localValue)===saved.checksum);
      if(matches&&(Number(current.revision)||0)<=saved.revision){mirrorMeta[saved.key]={revision:saved.revision,updatedAt:saved.updatedAt,checksum:saved.checksum,deleted:!!saved.deleted};try{persistMirrorMeta();}catch(_){}}
      return{ok:true,record:saved};
    }).catch(error=>{pendingVaultOps--;handleVaultFailure(error,record.key);return{ok:false,error};});
    syncQueue=operation.then(()=>undefined);
    lastCriticalOperation=operation;return operation;
  }
  function queueVaultDelete(key,options={}){
    if(!vaultReady||!vaultDurable){lastCriticalOperation=Promise.resolve({ok:false,fallback:true});return lastCriticalOperation;}
    pendingVaultOps++;
    const operation=syncQueue.then(()=>V.deleteRecord(key,options)).then(()=>{pendingVaultOps--;lastVaultCommitAt=now();return{ok:true};}).catch(error=>{pendingVaultOps--;handleVaultFailure(error,key);return{ok:false,error};});
    syncQueue=operation.then(()=>undefined);lastCriticalOperation=operation;return operation;
  }
  function trackCriticalValue(key,value,reason){
    const prior=mirrorMeta[key]||{},revision=Math.max(0,Math.floor(Number(prior.revision)||0))+1,updatedAt=now();
    const record=V?.makeRecord?V.makeRecord(key,value,revision,updatedAt,'local-mirror'):{key,value,revision,updatedAt,checksum:''};
    mirrorMeta[key]={revision,updatedAt,checksum:record.checksum,deleted:false};persistMirrorMeta();
    return queueVaultPut(record,{reason:reason||'mirror-write'});
  }
  function writeCritical(key,value,reason){value=String(value);localStorage.setItem(key,value);return trackCriticalValue(key,value,reason);}
  function removeCritical(key,reason){const prior=mirrorMeta[key]||{},revision=Math.max(0,Math.floor(Number(prior.revision)||0))+1,updatedAt=now(),record=V?.makeRecord?V.makeRecord(key,'',revision,updatedAt,'local-tombstone'):{key,value:'',revision,updatedAt,checksum:''};record.deleted=true;localStorage.removeItem(key);mirrorMeta[key]={revision,updatedAt,checksum:record.checksum,deleted:true};persistMirrorMeta();return queueVaultPut(record,{reason:reason||'mirror-delete'});}
  function writeIndex(list){return writeCritical(INDEX_KEY,JSON.stringify(list),'profile-index');}
  function setActiveProfile(id){return id?writeCritical(ACTIVE_KEY,id,'active-profile'):removeCritical(ACTIVE_KEY,'active-profile-clear');}

  function touchProfile(id,patch){
    const list=readIndex(),i=list.findIndex(x=>x.id===id);if(i<0)return null;
    list[i]=Object.assign({},list[i],patch||{},{lastPlayedAt:now()});writeIndex(list);return list[i];
  }

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
    M.validateV16(v16);const shadow=buildShadow(v16),raw=clone(v16);raw.version=16;
    raw.coins=EN.fromStorage(v16.economy.credits);raw.totalEarned=EN.fromStorage(v16.economy.totalEarned);raw.runEarned=EN.fromStorage(v16.economy.runEarned);raw.topScore=EN.fromStorage(v16.economy.topScore);
    delete raw.economy;delete raw.schemaVersion;delete raw.economyNumberStorage;
    for(const path of economyPaths.decimalMaps){const map=getPath(v16,path)||{},converted={};for(const[k,v]of Object.entries(map))converted[k]=path==='flow'?EN.fromStorageSigned(v):EN.fromStorage(v);setPath(raw,path,converted);}
    for(const path of economyPaths.structuralMaps){const map=getPath(v16,path)||{},converted={};for(const[k,v]of Object.entries(map))converted[k]=Math.max(0,Math.floor(EN.toSafeNumber(v,1000000000)));setPath(raw,path,converted);}
    raw.market=Object.assign({},raw.market,{level:Number(v16.market.networkMk||0),networkMk:Number(v16.market.networkMk||0),satellites:Number(v16.market.satelliteCount||0),prototypeBuilt:!!v16.market.prototypeBuilt,creditEconomyUnlocked:!!v16.market.creditEconomyUnlocked,legacyAccess:!!v16.market.legacyAccess,lastRevenue:EN.fromStorage(v16.market.lastRevenue||'0'),lastUnits:EN.fromStorage(v16.market.lastUnits||'0'),totalRevenue:EN.fromStorage(v16.market.totalRevenue||'0')});
    const state=normalize(raw);
    Object.defineProperty(state,'__v16Shadow',{value:shadow,writable:true,configurable:true,enumerable:false});
    Object.defineProperty(state,'__v16Migration',{value:clone(v16.migration),writable:true,configurable:true,enumerable:false});
    Object.defineProperty(state,'__saveSchema',{value:16,writable:true,configurable:true,enumerable:false});return state;
  }
  function encodeRuntime(state){
    const raw=clone(state),shadow=state.__v16Shadow||{};raw.version=16;raw.schemaVersion=16;raw.economyNumberStorage='string';
    raw.economy={credits:storageValue('economy.credits',state.coins,shadow),totalEarned:storageValue('economy.totalEarned',state.totalEarned,shadow),runEarned:storageValue('economy.runEarned',state.runEarned,shadow),topScore:storageValue('economy.topScore',state.topScore,shadow)};
    for(const path of economyPaths.decimalMaps){const map=getPath(state,path)||{},encoded={};for(const[k,v]of Object.entries(map))encoded[k]=storageValue(`${path}.${k}`,v,shadow,path==='flow');setPath(raw,path,encoded);}
    for(const path of economyPaths.structuralMaps){const map=getPath(state,path)||{},encoded={};for(const[k,v]of Object.entries(map))encoded[k]=EN.toStorage(Math.max(0,Math.floor(Number(v)||0)));setPath(raw,path,encoded);}
    const mk=Math.max(0,Math.min(3,Math.floor(Number(state.market?.networkMk??state.market?.level)||0))),sats=Math.max(0,Math.min(9,Math.floor(Number(state.galaxy?.satellites?.prototypeMarketSatellite||0)+Number(state.galaxy?.satellites?.marketSatellite||0))));
    raw.market=Object.assign({},raw.market,{networkMk:mk,satelliteCount:sats,prototypeBuilt:!!state.market?.prototypeBuilt,creditEconomyUnlocked:!!state.market?.creditEconomyUnlocked,lastRevenue:storageValue('market.lastRevenue',state.market?.lastRevenue||0,shadow),lastUnits:storageValue('market.lastUnits',state.market?.lastUnits||0,shadow),totalRevenue:storageValue('market.totalRevenue',state.market?.totalRevenue||0,shadow),foundingContractsCompleted:[...(state.market?.foundingContractsCompleted||[])],legacyAccess:!!state.market?.legacyAccess});
    const previous=state.__v16Migration||{};raw.migration={fromVersion:Number(previous.fromVersion||15),toVersion:16,migratedAt:previous.migratedAt||now(),backupSha256:previous.backupSha256||M.sha256(JSON.stringify(state)),exactUnsafeIntegerLiteralsPreserved:previous.exactUnsafeIntegerLiteralsPreserved!==false,inheritedTechnologies:Array.isArray(previous.inheritedTechnologies)?previous.inheritedTechnologies:[],legacyCreditAccess:!!state.market?.legacyAccess,warnings:Array.isArray(previous.warnings)?previous.warnings:[]};
    delete raw.coins;delete raw.credits;delete raw.totalEarned;delete raw.runEarned;delete raw.topScore;M.validateV16(raw);return raw;
  }

  function ensureV16(key){
    const raw=localStorage.getItem(key);if(raw===null)return{ok:false,error:'Kayıt bulunamadı'};const v=inspectVersion(raw);
    if(v===16){try{M.validateV16(JSON.parse(raw));return{ok:true,migrated:false};}catch(e){return{ok:false,error:e.message};}}
    if(v===15){const r=M.transactionalMigrate(localStorage,key);lastMigration=r;if(!r.ok)return{ok:false,error:r.error,rolledBack:r.rolledBack,backupKey:r.backupKey};return{ok:true,migrated:true,backupKey:r.backupKey};}
    try{const legacy=normalize(JSON.parse(raw));legacy.version=15;localStorage.setItem(`${key}.backup.legacy.${now()}`,raw);localStorage.setItem(key,JSON.stringify(legacy));return ensureV16(key);}catch(e){return{ok:false,error:`Desteklenmeyen veya bozuk kayıt: ${e.message}`};}
  }
  function writeState(id,state){
    const key=saveKey(id),payload=FLAGS.V44_SAVE_V16_ENABLED===false?JSON.stringify(state):JSON.stringify(encodeRuntime(state)),temp=`${key}.write.tmp`;
    localStorage.setItem(temp,payload);if(FLAGS.V44_SAVE_V16_ENABLED!==false)M.validateV16(JSON.parse(localStorage.getItem(temp)));
    localStorage.setItem(key,localStorage.getItem(temp));localStorage.removeItem(temp);return trackCriticalValue(key,payload,'state-save');
  }

  function createProfile(name,initialState,options){
    name=cleanName(name);if(name.length<2)return{ok:false,error:'Komutan adı en az 2 karakter olmalı.'};
    const list=readIndex();if(list.some(x=>x.name.toLocaleLowerCase('tr-TR')===name.toLocaleLowerCase('tr-TR')))return{ok:false,error:'Bu komutan adı zaten kullanılıyor.'};
    const id=uid(),createdAt=now(),profile={id,name,empireName:`${name} İmparatorluğu`,createdAt,lastPlayedAt:createdAt,version:2,saveSchema:16,storage:'indexeddb-vault'};
    const state=normalize(initialState||global.Axyon.Economy.createInitialState({planetType:options?.planetType,startRegion:options?.startRegion}));
    writeState(id,state);list.push(profile);writeIndex(list);setActiveProfile(id);blockingError=null;nextSaveRetryAt=0;return{ok:true,profile,state};
  }
  function selectProfile(id){if(!readIndex().some(x=>x.id===id))return false;setActiveProfile(id);touchProfile(id);blockingError=null;nextSaveRetryAt=0;return true;}
  function deleteProfile(id){
    const list=readIndex(),next=list.filter(x=>x.id!==id);if(next.length===list.length)return false;
    const keys=[];for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key&&key.startsWith(saveKey(id)))keys.push(key);}
    keys.forEach(key=>removeCritical(key,'profile-delete'));writeIndex(next);
    if(currentProfileId()===id){if(next.length)setActiveProfile(next[0].id);else setActiveProfile('');}
    blockingError=null;nextSaveRetryAt=0;return true;
  }
  function migrateLegacy(){
    if(readIndex().length)return false;const raw=localStorage.getItem(LEGACY_KEY);if(!raw)return false;
    try{const state=normalize(JSON.parse(raw)),result=createProfile('Komutan',state);if(result.ok){localStorage.setItem('axyon_frontier_legacy_migrated','1');return true;}}catch(e){blockingError={type:'legacy',message:e.message};}return false;
  }
  function bootstrap(){
    migrateLegacy();const list=readIndex();if(!list.length){setActiveProfile('');return null;}
    let id=currentProfileId();if(!list.some(x=>x.id===id)){id=list[0].id;setActiveProfile(id);}return currentProfile();
  }

  function settleSuccessfulSave(recovering,operations){
    if(!vaultReady||!vaultDurable){blockingError=null;nextSaveRetryAt=0;emit('axyon:save-success',{at:lastSuccessfulSaveAt,recovered:recovering,durable:false,fallback:true});return;}
    saveSettlement=Promise.all(operations).then(results=>{
      if(!results.every(x=>x?.ok))return false;
      lastDurableSaveAt=now();if(!blockingError||blockingError.type==='save'){blockingError=null;nextSaveRetryAt=0;}
      emit('axyon:save-success',{at:lastDurableSaveAt,recovered:recovering,durable:true,storage:'indexeddb'});return true;
    });
  }
  function save(state,options){
    const forceRetry=!!options?.forceRetry,recovering=blockingError?.type==='save';
    if(suspended)return false;
    if(blockingError){if(blockingError.type!=='save')return false;if(!forceRetry&&now()<nextSaveRetryAt)return false;}
    try{
      const id=currentProfileId();if(!id)return false;
      state.version=global.Axyon.Economy.SAVE_VERSION;state.lastSeen=now();const stateOp=writeState(id,state);
      touchProfile(id,{gameVersion:global.Axyon.Data.game.version,saveSchema:16,product:'AXYON: Orbital Ascendancy',storage:'indexeddb-vault'});const profileOp=lastCriticalOperation;
      lastSuccessfulSaveAt=now();settleSuccessfulSave(recovering,[stateOp,profileOp]);return true;
    }catch(e){
      lastSaveErrorAt=now();nextSaveRetryAt=lastSaveErrorAt+SAVE_RETRY_COOLDOWN_MS;blockingError={type:'save',layer:'localstorage',message:e.message,at:lastSaveErrorAt,retryAt:nextSaveRetryAt};
      console.error('[Save v16]',e);emit('axyon:save-error',{message:e.message,type:'save',layer:'localstorage',at:lastSaveErrorAt,retryAt:nextSaveRetryAt});return false;
    }
  }
  function retrySave(state){if(suspended||blockingError?.type!=='save')return false;return save(state,{forceRetry:true});}
  async function flush(){await syncQueue;await saveSettlement;return{ok:!blockingError,pending:pendingVaultOps,mode:storageMode};}

  function load(){
    try{
      const profile=bootstrap();if(!profile)return null;const id=currentProfileId(),key=saveKey(id),raw=localStorage.getItem(key);
      if(!raw){const state=global.Axyon.Economy.createInitialState();writeState(id,state);return state;}
      if(FLAGS.V44_SAVE_V16_ENABLED===false)return normalize(JSON.parse(raw));
      const ready=ensureV16(key);if(!ready.ok){blockingError={type:'migration',message:ready.error,backupKey:ready.backupKey||''};suspended=true;return global.Axyon.Economy.createInitialState();}
      if(ready.migrated)trackCriticalValue(key,localStorage.getItem(key),'v16-migration');
      const v16=JSON.parse(localStorage.getItem(key)),state=runtimeFromV16(v16);blockingError=null;nextSaveRetryAt=0;suspended=false;return state;
    }catch(e){blockingError={type:'load',message:e.message};suspended=true;console.error('[Load v16]',e);return global.Axyon.Economy.createInitialState();}
  }
  function resetCurrent(options){
    const id=currentProfileId();if(!id)return null;const current=blockingError?null:load();suspended=false;blockingError=null;nextSaveRetryAt=0;
    const fresh=global.Axyon.Economy.createInitialState({planetType:options?.planetType||current?.empire?.planetType||current?.planet?.type,startRegion:options?.startRegion||current?.empire?.startRegion||current?.planet?.startRegion});
    if(options?.theme)fresh.settings.theme=options.theme;writeState(id,fresh);touchProfile(id,{resetAt:now(),saveSchema:16});return fresh;
  }
  function deleteAll(){
    suspended=true;try{
      const keys=criticalLocalKeys();for(const key of keys)removeCritical(key,'delete-all');
      blockingError=null;nextSaveRetryAt=0;
    }finally{suspended=false;}
  }

  const setSuspended=value=>{suspended=!!value;};
  const b64encode=s=>btoa(unescape(encodeURIComponent(s))),b64decode=s=>decodeURIComponent(escape(atob(s)));
  function exportString(state){const payload={format:'axyon-frontier-profile-v16',version:4,product:'AXYON: Orbital Ascendancy',storage:'indexeddb-vault',profile:currentProfile(),state:encodeRuntime(state)};return b64encode(JSON.stringify(payload));}
  function importString(str){try{const decoded=JSON.parse(b64decode(str.trim())),raw=decoded&&/^axyon-frontier-profile/.test(decoded.format||'')?decoded.state:decoded;if(Number(raw?.version)===16){M.validateV16(raw);return{ok:true,state:runtimeFromV16(raw)};}return{ok:true,state:normalize(raw)};}catch(e){return{ok:false,error:'Geçersiz veya bozuk kayıt kodu.'};}}
  function diagnostics(){return{
    schema:16,enabled:FLAGS.V44_SAVE_V16_ENABLED!==false,suspended,blockingError,lastMigration,lastSuccessfulSaveAt,lastDurableSaveAt,lastSaveErrorAt,nextSaveRetryAt,retryCooldownMs:SAVE_RETRY_COOLDOWN_MS,
    prepared,storageMode,vaultReady,vaultDurable,pendingVaultOps,lastVaultError,lastVaultCommitAt,lastReconcile,mirrorRecords:Object.keys(mirrorMeta).length,vault:V?.diagnostics?.()||null,
    profile:currentProfile(),canonicalVersion:global.Axyon.Canonical?.version||null,economyEngine:EN?.engine||null,runtimeMode:global.Axyon.Numbers?.runtimeMode||null,firstOrbit:true,product:'AXYON: Orbital Ascendancy'
  };}
  function rawActiveSave(){const id=currentProfileId();return id?localStorage.getItem(saveKey(id)):null;}
  async function rawVaultActiveSave(){const id=currentProfileId();if(!id||!vaultReady)return null;return V.getRecord(saveKey(id));}

  global.Axyon=global.Axyon||{};
  global.Axyon.SaveService={
    prepare,bootstrap,save,retrySave,flush,load,resetCurrent,deleteAll,exportString,importString,listProfiles,currentProfile,currentProfileId,createProfile,selectProfile,deleteProfile,setSuspended,diagnostics,rawActiveSave,rawVaultActiveSave,
    hasBlockingError:()=>!!blockingError,
    clearBlockingError:()=>{if(blockingError?.type!=='save')return false;blockingError=null;nextSaveRetryAt=0;return true;},
    keys:{INDEX_KEY,ACTIVE_KEY,SAVE_PREFIX,LEGACY_KEY,MIRROR_META_KEY},
    _test:{encodeRuntime,runtimeFromV16,ensureV16,validateCriticalValue,localCandidate,chooseCandidate}
  };
})(typeof window!=='undefined'?window:globalThis);
