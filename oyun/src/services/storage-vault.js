/** Axyon.StorageVault v4.5 U4 — IndexedDB durable vault with checksummed records and bounded rollback backups. */
(function(global){
  'use strict';

  const DB_NAME='axyon_orbital_ascendancy';
  const DB_VERSION=1;
  const RECORDS='records';
  const BACKUPS='backups';
  const MAX_BACKUPS_PER_KEY=5;

  let backend=null;
  let openPromise=null;
  let currentMode='uninitialized';
  let lastError=null;

  function checksum(value){
    const text=String(value??'');
    let hash=0x811c9dc5;
    for(let i=0;i<text.length;i++){
      hash^=text.charCodeAt(i);
      hash=Math.imul(hash,0x01000193)>>>0;
    }
    return `fnv1a32:${hash.toString(16).padStart(8,'0')}:${text.length}`;
  }

  function makeRecord(key,value,revision=1,updatedAt=Date.now(),source='client'){
    const text=String(value);
    return{
      key:String(key),
      value:text,
      revision:Math.max(1,Math.floor(Number(revision)||1)),
      updatedAt:Math.max(0,Math.floor(Number(updatedAt)||Date.now())),
      checksum:checksum(text),
      source:String(source||'client')
    };
  }

  function verifyRecord(record){
    return!!record&&typeof record.key==='string'&&typeof record.value==='string'&&
      Number.isFinite(Number(record.revision))&&Number(record.revision)>0&&
      record.checksum===checksum(record.value);
  }

  const requestResult=request=>new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('IndexedDB request failed'));
  });

  const transactionDone=tx=>new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve(true);
    tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));
    tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
  });

  function createIndexedDBBackend(factory){
    let dbPromise=null;

    function open(){
      if(dbPromise)return dbPromise;
      dbPromise=new Promise((resolve,reject)=>{
        let req;
        try{req=factory.open(DB_NAME,DB_VERSION);}catch(error){reject(error);return;}
        req.onupgradeneeded=()=>{
          const db=req.result;
          if(!db.objectStoreNames.contains(RECORDS))db.createObjectStore(RECORDS,{keyPath:'key'});
          if(!db.objectStoreNames.contains(BACKUPS)){
            const store=db.createObjectStore(BACKUPS,{keyPath:'id'});
            store.createIndex('byKey','key',{unique:false});
          }
        };
        req.onsuccess=()=>{
          const db=req.result;
          db.onversionchange=()=>db.close();
          resolve(db);
        };
        req.onerror=()=>reject(req.error||new Error('IndexedDB open failed'));
        req.onblocked=()=>reject(new Error('IndexedDB upgrade blocked'));
      });
      return dbPromise;
    }

    async function getRecord(key){
      const db=await open(),tx=db.transaction(RECORDS,'readonly');
      const result=await requestResult(tx.objectStore(RECORDS).get(String(key)));
      await transactionDone(tx);
      return result||null;
    }

    async function getAllRecords(){
      const db=await open(),tx=db.transaction(RECORDS,'readonly');
      const result=await requestResult(tx.objectStore(RECORDS).getAll());
      await transactionDone(tx);
      return Array.isArray(result)?result:[];
    }

    async function getBackups(key){
      const db=await open(),tx=db.transaction(BACKUPS,'readonly');
      const index=tx.objectStore(BACKUPS).index('byKey');
      const result=await requestResult(index.getAll(String(key)));
      await transactionDone(tx);
      return(Array.isArray(result)?result:[]).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||(b.revision||0)-(a.revision||0));
    }

    async function pruneBackups(key){
      const all=await getBackups(key);
      if(all.length<=MAX_BACKUPS_PER_KEY)return;
      const db=await open(),tx=db.transaction(BACKUPS,'readwrite'),store=tx.objectStore(BACKUPS);
      for(const item of all.slice(MAX_BACKUPS_PER_KEY))store.delete(item.id);
      await transactionDone(tx);
    }

    async function putRecord(record,options={}){
      if(!verifyRecord(record))throw new Error(`Invalid vault record: ${record?.key||'unknown'}`);
      const db=await open(),tx=db.transaction([RECORDS,BACKUPS],'readwrite');
      const records=tx.objectStore(RECORDS),backups=tx.objectStore(BACKUPS);
      const previous=await requestResult(records.get(record.key));
      const effective=Object.assign({},record);
      if(verifyRecord(previous)){
        const changed=previous.checksum!==effective.checksum||!!previous.deleted!==!!effective.deleted;
        if(changed&&effective.revision<=previous.revision)effective.revision=previous.revision+1;
        else if(!changed&&effective.revision<previous.revision)effective.revision=previous.revision;
        effective.updatedAt=Math.max(Number(effective.updatedAt)||0,changed?Date.now():Number(previous.updatedAt)||0);
        if(options.backupPrevious!==false&&changed){
          const stamp=Date.now();
          backups.put(Object.assign({},previous,{id:`${previous.key}|${previous.revision}|${stamp}|${Math.random().toString(36).slice(2,8)}`,backedUpAt:stamp,reason:String(options.reason||'replace')}));
        }
      }
      records.put(effective);
      await transactionDone(tx);
      await pruneBackups(effective.key);
      return effective;
    }

    async function deleteRecord(key,options={}){
      key=String(key);
      const db=await open(),tx=db.transaction([RECORDS,BACKUPS],'readwrite');
      const records=tx.objectStore(RECORDS),backups=tx.objectStore(BACKUPS);
      const previous=await requestResult(records.get(key));
      if(options.backupPrevious!==false&&verifyRecord(previous)){
        const stamp=Date.now();
        backups.put(Object.assign({},previous,{
          id:`${previous.key}|${previous.revision}|${stamp}|${Math.random().toString(36).slice(2,8)}`,
          backedUpAt:stamp,
          reason:String(options.reason||'delete')
        }));
      }
      records.delete(key);
      await transactionDone(tx);
      await pruneBackups(key);
      return true;
    }

    async function clearAll(){
      const db=await open(),tx=db.transaction([RECORDS,BACKUPS],'readwrite');
      tx.objectStore(RECORDS).clear();
      tx.objectStore(BACKUPS).clear();
      await transactionDone(tx);
      return true;
    }

    return{kind:'indexeddb',durable:true,open,getRecord,getAllRecords,getBackups,putRecord,deleteRecord,clearAll};
  }

  function createMemoryBackend(options={}){
    const records=new Map();
    const backups=[];
    const control={failOpen:false,failNextPut:0,failNextDelete:0};

    async function open(){if(control.failOpen)throw new Error('memory vault open failure');return true;}
    async function getRecord(key){const item=records.get(String(key));return item?Object.assign({},item):null;}
    async function getAllRecords(){return[...records.values()].map(x=>Object.assign({},x));}
    async function getBackups(key){return backups.filter(x=>x.key===String(key)).map(x=>Object.assign({},x)).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||(b.revision||0)-(a.revision||0));}
    function prune(key){const matches=backups.filter(x=>x.key===key).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||(b.revision||0)-(a.revision||0));for(const old of matches.slice(MAX_BACKUPS_PER_KEY)){const index=backups.findIndex(x=>x.id===old.id);if(index>=0)backups.splice(index,1);}}
    async function putRecord(record,opts={}){
      if(control.failNextPut>0){control.failNextPut--;throw new Error('memory vault put failure');}
      if(!verifyRecord(record))throw new Error(`Invalid vault record: ${record?.key||'unknown'}`);
      const key=record.key,previous=records.get(key),effective=Object.assign({},record);
      if(verifyRecord(previous)){
        const changed=previous.checksum!==effective.checksum||!!previous.deleted!==!!effective.deleted;
        if(changed&&effective.revision<=previous.revision)effective.revision=previous.revision+1;
        else if(!changed&&effective.revision<previous.revision)effective.revision=previous.revision;
        effective.updatedAt=Math.max(Number(effective.updatedAt)||0,changed?Date.now():Number(previous.updatedAt)||0);
        if(opts.backupPrevious!==false&&changed){const stamp=Date.now();backups.push(Object.assign({},previous,{id:`${key}|${previous.revision}|${stamp}|${Math.random().toString(36).slice(2,8)}`,backedUpAt:stamp,reason:String(opts.reason||'replace')}));}
      }
      records.set(key,Object.assign({},effective));prune(key);return Object.assign({},effective);
    }
    async function deleteRecord(key,opts={}){
      if(control.failNextDelete>0){control.failNextDelete--;throw new Error('memory vault delete failure');}
      key=String(key);const previous=records.get(key);
      if(opts.backupPrevious!==false&&verifyRecord(previous)){
        const stamp=Date.now();
        backups.push(Object.assign({},previous,{id:`${key}|${previous.revision}|${stamp}|${Math.random().toString(36).slice(2,8)}`,backedUpAt:stamp,reason:String(opts.reason||'delete')}));prune(key);
      }
      records.delete(key);return true;
    }
    async function clearAll(){records.clear();backups.splice(0);return true;}
    function corruptRecord(key,patch={}){const current=records.get(String(key));if(!current)return false;records.set(String(key),Object.assign({},current,patch));return true;}
    function seedRecord(record){records.set(record.key,Object.assign({},record));}

    if(Array.isArray(options.records))for(const record of options.records)seedRecord(record);
    return{kind:'memory',durable:options.durable!==false,open,getRecord,getAllRecords,getBackups,putRecord,deleteRecord,clearAll,_records:records,_backups:backups,_control:control,corruptRecord,seedRecord};
  }

  function configure(customBackend){
    if(openPromise)throw new Error('StorageVault already opened');
    backend=customBackend||null;
    currentMode=backend?.kind||'configured';
    return true;
  }

  async function open(){
    if(openPromise)return openPromise;
    openPromise=(async()=>{
      try{
        if(!backend&&global.__AXYON_STORAGE_BACKEND__)backend=global.__AXYON_STORAGE_BACKEND__;
        if(!backend&&global.indexedDB)backend=createIndexedDBBackend(global.indexedDB);
        if(!backend){currentMode='unavailable';return{ok:false,mode:currentMode,durable:false};}
        await backend.open();
        currentMode=backend.kind||'custom';lastError=null;
        return{ok:true,mode:currentMode,durable:backend.durable!==false};
      }catch(error){
        lastError=error;backend=null;currentMode='unavailable';
        return{ok:false,mode:currentMode,durable:false,error:error?.message||String(error)};
      }
    })();
    return openPromise;
  }

  async function requireBackend(){const status=await open();if(!status.ok||!backend)throw new Error(status.error||'Durable vault unavailable');return backend;}
  async function getRecord(key){return(await requireBackend()).getRecord(key);}
  async function getAllRecords(){return(await requireBackend()).getAllRecords();}
  async function getBackups(key){return(await requireBackend()).getBackups(key);}
  async function putRecord(record,options){return(await requireBackend()).putRecord(record,options);}
  async function deleteRecord(key,options){return(await requireBackend()).deleteRecord(key,options);}
  async function clearAll(){return(await requireBackend()).clearAll();}

  function diagnostics(){return{database:DB_NAME,version:DB_VERSION,mode:currentMode,durable:!!backend&&backend.durable!==false,lastError:lastError?.message||null,maxBackupsPerKey:MAX_BACKUPS_PER_KEY};}

  global.Axyon=global.Axyon||{};
  global.Axyon.StorageVault={
    open,configure,getRecord,getAllRecords,getBackups,putRecord,deleteRecord,clearAll,
    checksum,makeRecord,verifyRecord,diagnostics,
    _test:{createMemoryBackend,createIndexedDBBackend,MAX_BACKUPS_PER_KEY}
  };
})(typeof window!=='undefined'?window:globalThis);
