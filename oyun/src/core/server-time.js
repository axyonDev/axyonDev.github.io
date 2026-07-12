/** AXYON U4.1 — server-authoritative clock and lazy elapsed-time resolver contract. */
(function(global){
  'use strict';
  const A=global.Axyon=global.Axyon||{},SCHEMA_VERSION=1,MAX_ABS_OFFSET_MS=7*24*60*60*1000;
  const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v),finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f,int=(v,f=0)=>Number.isSafeInteger(Number(v))?Number(v):f;
  function ensure(state){
    if(!plain(state))throw new TypeError('Server clock state must be an object');const raw=plain(state.serverRuntime)?state.serverRuntime:{};
    const rt={schemaVersion:SCHEMA_VERSION,offsetMs:Math.max(-MAX_ABS_OFFSET_MS,Math.min(MAX_ABS_OFFSET_MS,finite(raw.offsetMs,0))),uncertaintyMs:Math.max(0,finite(raw.uncertaintyMs,Number.MAX_SAFE_INTEGER)),lastObservedAt:Math.max(0,int(raw.lastObservedAt,0)),lastServerTime:Math.max(0,int(raw.lastServerTime,0)),lastResolvedNow:Math.max(0,int(raw.lastResolvedNow,0)),authorityRevision:Math.max(0,int(raw.authorityRevision,0)),timers:plain(raw.timers)?raw.timers:{}};
    for(const [key,value] of Object.entries(rt.timers)){const n=Math.max(0,int(value,0));if(!n)delete rt.timers[key];else rt.timers[key]=n;}state.serverRuntime=rt;return rt;
  }
  function observe(state,sample){
    const rt=ensure(state);if(!plain(sample))return{ok:false,code:'invalid_time_sample'};
    const serverTime=int(sample.serverTime,-1),sentAt=int(sample.sentAt,-1),receivedAt=int(sample.receivedAt,-1),revision=Math.max(0,int(sample.serverRevision,rt.authorityRevision));
    if(serverTime<0||sentAt<0||receivedAt<sentAt)return{ok:false,code:'invalid_time_sample'};
    if(revision<rt.authorityRevision)return{ok:false,code:'stale_server_revision'};
    if(revision===rt.authorityRevision&&rt.lastServerTime&&serverTime<rt.lastServerTime)return{ok:false,code:'stale_server_time'};
    const midpoint=sentAt+(receivedAt-sentAt)/2,offset=Math.max(-MAX_ABS_OFFSET_MS,Math.min(MAX_ABS_OFFSET_MS,serverTime-midpoint)),uncertainty=Math.max(0,(receivedAt-sentAt)/2);
    if(rt.lastObservedAt===0||uncertainty<=rt.uncertaintyMs){rt.offsetMs=offset;rt.uncertaintyMs=uncertainty;}else{const weight=Math.max(.05,Math.min(.25,rt.uncertaintyMs/(rt.uncertaintyMs+uncertainty)));rt.offsetMs=rt.offsetMs*(1-weight)+offset*weight;rt.uncertaintyMs=Math.min(Number.MAX_SAFE_INTEGER,rt.uncertaintyMs*.9+uncertainty*.1);}
    rt.lastObservedAt=receivedAt;rt.lastServerTime=Math.max(rt.lastServerTime,serverTime);rt.authorityRevision=Math.max(rt.authorityRevision,revision);rt.lastResolvedNow=Math.max(rt.lastResolvedNow,serverTime);return{ok:true,code:'time_sample_accepted',offsetMs:rt.offsetMs,uncertaintyMs:rt.uncertaintyMs,authorityRevision:rt.authorityRevision};
  }
  function serverNow(state,clientNow=Date.now()){
    const rt=ensure(state),estimate=Math.max(0,Math.floor(finite(clientNow,Date.now())+rt.offsetMs)),resolved=Math.max(rt.lastResolvedNow,estimate,rt.lastServerTime);rt.lastResolvedNow=resolved;return resolved;
  }
  function setTimer(state,key,at){key=String(key||'').trim();if(!key)throw new TypeError('Timer key is required');const rt=ensure(state),value=Math.max(0,int(at,serverNow(state)));rt.timers[key]=value;return value;}
  function resolveElapsed(state,key,options={}){
    key=String(key||'').trim();if(!key)throw new TypeError('Timer key is required');const rt=ensure(state),current=Math.max(0,int(options.serverNow,serverNow(state,options.clientNow))),initial=Math.max(0,int(options.initialAt,current)),last=Math.max(0,int(rt.timers[key],initial)),rawSeconds=Math.max(0,(current-last)/1000),maxSeconds=options.maxSeconds==null?Number.MAX_SAFE_INTEGER:Math.max(0,finite(options.maxSeconds,0)),usableSeconds=Math.min(rawSeconds,maxSeconds),rate=Math.max(0,finite(options.rate,1));rt.timers[key]=current;return{key,from:last,to:current,rawSeconds,usableSeconds,scaledSeconds:usableSeconds*rate,wasCapped:rawSeconds>maxSeconds,authorityRevision:rt.authorityRevision,uncertaintyMs:rt.uncertaintyMs};
  }
  function peekElapsed(state,key,options={}){const rt=ensure(state),before=rt.timers[String(key||'')],lastNow=rt.lastResolvedNow,result=resolveElapsed(state,key,options);if(before==null)delete rt.timers[String(key||'')];else rt.timers[String(key||'')]=before;rt.lastResolvedNow=lastNow;return result;}
  function diagnostics(state){const rt=ensure(state);return{schemaVersion:rt.schemaVersion,authorityRevision:rt.authorityRevision,offsetMs:rt.offsetMs,uncertaintyMs:rt.uncertaintyMs,lastServerTime:rt.lastServerTime,lastResolvedNow:rt.lastResolvedNow,timers:Object.keys(rt.timers).length,authoritative:rt.authorityRevision>0&&rt.lastServerTime>0};}
  A.ServerClock={SCHEMA_VERSION,observe,serverNow,setTimer,resolveElapsed,peekElapsed,diagnostics,_test:{ensure}};
})(typeof window!=='undefined'?window:globalThis);
