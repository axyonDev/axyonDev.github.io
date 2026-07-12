/** AXYON U4.3 — real HTTP authority adapter, offline outbox delivery and snapshot reconciliation. */
(function(global){
  'use strict';
  const A=global.Axyon=global.Axyon||{},CONFIG_KEY='axyon_authority_url_v1';
  let configuredUrl='',inFlight=null,last={status:'disabled',at:0,code:'',sent:0,acked:0,reconciled:false};
  const clean=value=>String(value||'').trim().replace(/\/+$/,'');
  function normalizeUrl(value){
    const text=clean(value);if(!text)return'';
    try{const u=new URL(text,global.location?.href||'http://localhost');if(!/^https?:$/.test(u.protocol))return'';return u.origin+u.pathname.replace(/\/+$/,'');}catch(_){return'';}
  }
  function storage(){try{return global.localStorage||null;}catch(_){return null;}}
  function configured(){if(configuredUrl)return configuredUrl;const fromGlobal=normalizeUrl(global.AXYON_AUTHORITY_URL||'');const fromStorage=normalizeUrl(storage()?.getItem(CONFIG_KEY)||'');configuredUrl=fromGlobal||fromStorage;return configuredUrl;}
  function configure(value,{persist=true}={}){configuredUrl=normalizeUrl(value);if(persist){const s=storage();if(s){if(configuredUrl)s.setItem(CONFIG_KEY,configuredUrl);else s.removeItem(CONFIG_KEY);}}last={status:configuredUrl?'idle':'disabled',at:Date.now(),code:'configured',sent:0,acked:0,reconciled:false};return configuredUrl;}
  function isConfigured(){return!!configured();}
  function runtime(state){return A.DomainCommand?._test?.ensureRuntime(state);}
  function setStatus(status,code='',extra={}){last={...last,...extra,status,code,at:Date.now()};return diagnostics();}
  function diagnostics(){return{...last,baseUrl:configured(),configured:isConfigured(),inFlight:!!inFlight};}
  async function request(path,options={},timeoutMs=8000){
    const base=configured();if(!base)throw Object.assign(new Error('authority_not_configured'),{code:'authority_not_configured'});
    const controller=typeof AbortController!=='undefined'?new AbortController():null,timer=controller?setTimeout(()=>controller.abort(),Math.max(500,timeoutMs)):null;
    try{
      const response=await global.fetch(base+path,{...options,signal:controller?.signal,headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});
      let body={};try{body=await response.json();}catch(_){body={ok:false,code:'invalid_server_json'};}
      return{response,body};
    }catch(error){if(error?.name==='AbortError')throw Object.assign(new Error('authority_timeout'),{code:'authority_timeout'});throw Object.assign(error,{code:error?.code||'authority_network_error'});}
    finally{if(timer)clearTimeout(timer);}
  }
  async function getSnapshot(actorId){
    actorId=String(actorId||'');if(!actorId)return{ok:false,code:'missing_actor'};
    const {response,body}=await request(`/v1/actors/${encodeURIComponent(actorId)}/snapshot`,{headers:{'x-axyon-actor':actorId}});
    if(!response.ok||!body.snapshot)return{ok:false,code:body.code||`http_${response.status}`,httpStatus:response.status};
    return{ok:true,httpStatus:response.status,snapshot:body.snapshot};
  }
  async function fetchSnapshot(state,{actorId,economy=A.Economy,commands=A.DomainCommand,reconciliation=A.ServerReconciliation}={}){
    const fetched=await getSnapshot(actorId);if(!fetched.ok)return fetched;
    const applied=reconciliation.apply(state,fetched.snapshot,{actorId:String(actorId||''),economy,commands});
    return{...applied,httpStatus:fetched.httpStatus,snapshot:fetched.snapshot};
  }
  async function postCommand(actorId,item,overrides={}){
    const command={schemaVersion:item.schemaVersion||1,commandId:item.commandId,sourceId:item.sourceId,sequence:item.sequence,actorId:item.actorId,type:item.type,payload:item.payload||{},issuedAt:item.issuedAt,expectedRevision:overrides.expectedRevision??item.expectedRevision,clientSessionId:item.sourceId};
    const {response,body}=await request(`/v1/actors/${encodeURIComponent(actorId)}/commands`,{method:'POST',headers:{'x-axyon-actor':actorId},body:JSON.stringify({command})});
    return{httpStatus:response.status,...body};
  }
  async function syncNow(state,options={}){
    if(inFlight)return inFlight;
    let task;
    task=(async()=>{
      const C=options.commands||A.DomainCommand,actorId=String(options.actorId||''),save=typeof options.save==='function'?options.save:()=>{},onChange=typeof options.onChange==='function'?options.onChange:()=>{};
      if(!actorId)return setStatus('idle','waiting_actor');if(!isConfigured())return setStatus('disabled','authority_not_configured');
      setStatus('syncing','', {sent:0,acked:0,reconciled:false});
      try{
        const rt=runtime(state);if(rt?.server?.needsReconcile){const rec=await fetchSnapshot(state,{...options,actorId,commands:C});if(!rec.ok)return setStatus('error',rec.code,{reconciled:false});save();onChange(rec);setStatus('online','snapshot_applied',{reconciled:true});}
        const batch=C.outboxBatch(state,Math.max(1,Math.min(100,Number(options.limit)||25)));let sent=0,acked=0;
        for(const item of batch){
          let result=await postCommand(actorId,item);sent++;
          // A destructive profile reset intentionally wins over stale client
          // revisions. Re-read the authoritative revision and retry the SAME
          // immutable command id; duplicate replay remains safe if the first
          // commit succeeded but its response was lost.
          if(!result.ok&&!result.duplicate&&result.code==='stale_revision'&&item.type==='profile.reset'){
            const current=await getSnapshot(actorId);
            if(current.ok)result=await postCommand(actorId,item,{expectedRevision:current.snapshot.serverRevision});
          }
          if(result.ack){const ack=C.acknowledge(state,{...result.ack,receivedAt:Date.now()},{actorId});if(ack.code==='acknowledged'||ack.code==='duplicate_ack')acked++;save();onChange({type:'ack',result,ack});}
          if(!result.ok&&!result.duplicate){
            const current=runtime(state);if(current)current.server.needsReconcile=true;
            const rec=await fetchSnapshot(state,{...options,actorId,commands:C});if(rec.ok){save();onChange({type:'snapshot',result:rec});return setStatus('online',result.code||'server_rejected',{sent,acked,reconciled:true});}
            return setStatus('error',rec.code||result.code||'server_rejected',{sent,acked,reconciled:false});
          }
        }
        save();return setStatus('online',batch.length?'synced':'idle',{sent,acked,reconciled:false});
      }catch(error){return setStatus('offline',error?.code||error?.message||'authority_network_error');}
    })();
    inFlight=task;
    try{return await task;}finally{if(inFlight===task)inFlight=null;}
  }
  function startAutoSync(getState,getOptions,intervalMs=5000){
    let stopped=false,timer=null;const schedule=delay=>{timer=setTimeout(step,delay);timer?.unref?.();};const step=async()=>{if(stopped)return;try{const state=getState?.(),options=getOptions?.()||{};if(state&&isConfigured())await syncNow(state,options);}finally{if(!stopped)schedule(Math.max(1000,Number(intervalMs)||5000));}};schedule(250);return()=>{stopped=true;if(timer)clearTimeout(timer);};
  }
  A.ServerNetwork={CONFIG_KEY,normalizeUrl,configure,configured,isConfigured,diagnostics,getSnapshot,fetchSnapshot,syncNow,startAutoSync,_test:{postCommand,request,reset(){configuredUrl='';inFlight=null;last={status:'disabled',at:0,code:'',sent:0,acked:0,reconciled:false};}}};
})(typeof window!=='undefined'?window:globalThis);
