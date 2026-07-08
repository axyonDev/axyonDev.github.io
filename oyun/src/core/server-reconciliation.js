/** AXYON U4.2 — authoritative snapshot validation and client reconciliation. */
(function(global){
  'use strict';
  const A=global.Axyon=global.Axyon||{};
  const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const clone=v=>JSON.parse(JSON.stringify(v));
  function validate(snapshot,actorId){
    if(!plain(snapshot)||Number(snapshot.schemaVersion)!==1)return{ok:false,code:'invalid_snapshot'};
    if(String(snapshot.actorId||'')!==String(actorId||''))return{ok:false,code:'snapshot_actor_mismatch'};
    if(!Number.isSafeInteger(Number(snapshot.serverRevision))||Number(snapshot.serverRevision)<0)return{ok:false,code:'invalid_server_revision'};
    if(!Number.isFinite(Number(snapshot.serverTime))||Number(snapshot.serverTime)<0)return{ok:false,code:'invalid_server_time'};
    if(!plain(snapshot.state))return{ok:false,code:'invalid_snapshot_state'};
    return{ok:true};
  }
  function apply(localState,snapshot,context={}){
    const actorId=String(context.actorId||''),checked=validate(snapshot,actorId);if(!checked.ok)return checked;
    const C=context.commands||A.DomainCommand,E=context.economy||A.Economy;if(!C||!E)return{ok:false,code:'reconciliation_runtime_unavailable'};
    const localRuntime=C._test.ensureRuntime(localState),currentServerRevision=Math.max(0,Number(localRuntime.server?.lastRevision)||0),incoming=Number(snapshot.serverRevision);
    if(incoming<currentServerRevision)return{ok:false,code:'stale_server_snapshot',currentServerRevision,incomingServerRevision:incoming};
    let normalized;try{normalized=E.normalizeState(clone(snapshot.state));}catch(error){return{ok:false,code:'snapshot_normalization_failed',message:error?.message||String(error)};}
    const preservedSettings=clone(localState.settings||{}),droppedOutbox=localRuntime.outbox?.length||0,priorAckHistory=clone(localRuntime.ackHistory||{}),priorAckOrder=clone(localRuntime.ackOrder||[]);
    for(const key of Object.keys(localState))delete localState[key];Object.assign(localState,normalized);localState.settings=preservedSettings;
    const runtime=C._test.ensureRuntime(localState);runtime.revision=incoming;runtime.sources={};runtime.outbox=[];runtime.ackHistory=priorAckHistory;runtime.ackOrder=priorAckOrder;runtime.server.lastRevision=incoming;runtime.server.lastServerTime=Math.max(Number(snapshot.serverTime)||0,Number(runtime.server.lastServerTime)||0);runtime.server.lastAckAt=Date.now();runtime.server.needsReconcile=false;
    return{ok:true,code:'snapshot_applied',serverRevision:incoming,serverTime:Number(snapshot.serverTime),droppedOutbox};
  }
  A.ServerReconciliation={validate,apply};
})(typeof window!=='undefined'?window:globalThis);
