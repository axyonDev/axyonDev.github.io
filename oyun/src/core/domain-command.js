/** AXYON U4.1 — UI/storage bağımsız, idempotent domain command çekirdeği. */
(function(global){
  'use strict';
  const A=global.Axyon=global.Axyon||{};
  const SCHEMA_VERSION=1,MAX_RECEIPTS_PER_SOURCE=128,MAX_OUTBOX=256,MAX_ACK_HISTORY=256,MAX_COMMAND_AGE_MS=30*24*60*60*1000,MAX_FUTURE_SKEW_MS=5*60*1000,MAX_SEQUENCE_GAP=1000000;
  const handlers=new Map();
  let memorySourceId='',memorySequence=0,defaultsRegistered=false;

  const plainObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const cleanId=(value,max=128)=>String(value||'').trim().slice(0,max);
  const int=(value,fallback=0)=>Number.isSafeInteger(Number(value))?Number(value):fallback;
  const now=()=>Date.now();
  function randomPart(){
    try{if(global.crypto?.randomUUID)return global.crypto.randomUUID().replace(/-/g,'').slice(0,20);}catch(_){}
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2,12)}`;
  }
  function stableStringify(value){
    const seen=new Set();
    function walk(v){
      if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
      if(typeof v==='number'){if(!Number.isFinite(v))throw new TypeError('Command payload contains a non-finite number');return JSON.stringify(v);}
      if(Array.isArray(v))return`[${v.map(walk).join(',')}]`;
      if(plainObject(v)){
        if(seen.has(v))throw new TypeError('Command payload contains a cycle');seen.add(v);
        const text=`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${walk(v[k])}`).join(',')}}`;seen.delete(v);return text;
      }
      throw new TypeError(`Unsupported command payload value: ${typeof v}`);
    }
    return walk(value);
  }
  function fingerprint(command){
    const canonical=stableStringify({actorId:command.actorId,type:command.type,payload:command.payload,sourceId:command.sourceId,sequence:command.sequence});
    const sha=A.SaveMigratorV16?.sha256;
    if(typeof sha==='function')return sha(canonical);
    let h1=2166136261,h2=0x9e3779b9;for(let i=0;i<canonical.length;i++){const c=canonical.charCodeAt(i);h1^=c;h1=Math.imul(h1,16777619);h2^=c+((h2<<6)>>>0)+(h2>>>2);}return`${(h1>>>0).toString(16).padStart(8,'0')}${(h2>>>0).toString(16).padStart(8,'0')}`;
  }
  function sessionStore(){try{return global.sessionStorage||null;}catch(_){return null;}}
  function sourceId(){
    const store=sessionStore(),key='axyon_command_source_v1';
    if(store){let value=cleanId(store.getItem(key),96);if(!value){value=`tab-${randomPart()}`;store.setItem(key,value);}return value;}
    if(!memorySourceId)memorySourceId=`memory-${randomPart()}`;return memorySourceId;
  }
  function nextSequence(source){
    const store=sessionStore(),key=`axyon_command_sequence_v1:${source}`;
    if(store){const current=Math.max(0,int(store.getItem(key),0)),next=current+1;store.setItem(key,String(next));return next;}
    memorySequence++;return memorySequence;
  }
  function ensureRuntime(state){
    if(!plainObject(state))throw new TypeError('Command state must be an object');
    const raw=plainObject(state.commandRuntime)?state.commandRuntime:{};
    const runtime={schemaVersion:SCHEMA_VERSION,revision:Math.max(0,int(raw.revision,0)),sources:plainObject(raw.sources)?raw.sources:{},stats:plainObject(raw.stats)?raw.stats:{},outbox:Array.isArray(raw.outbox)?raw.outbox:[],ackHistory:plainObject(raw.ackHistory)?raw.ackHistory:{},ackOrder:Array.isArray(raw.ackOrder)?raw.ackOrder:[],server:plainObject(raw.server)?raw.server:{}};
    runtime.stats={applied:Math.max(0,int(runtime.stats.applied,0)),rejected:Math.max(0,int(runtime.stats.rejected,0)),duplicates:Math.max(0,int(runtime.stats.duplicates,0)),conflicts:Math.max(0,int(runtime.stats.conflicts,0)),stale:Math.max(0,int(runtime.stats.stale,0)),acked:Math.max(0,int(runtime.stats.acked,0)),serverRejected:Math.max(0,int(runtime.stats.serverRejected,0))};
    runtime.outbox=runtime.outbox.filter(x=>plainObject(x)&&x.commandId&&x.fingerprint).slice(-MAX_OUTBOX);runtime.ackOrder=runtime.ackOrder.map(String).slice(-MAX_ACK_HISTORY);const ackKeep=new Set(runtime.ackOrder);for(const key of Object.keys(runtime.ackHistory))if(!ackKeep.has(key))delete runtime.ackHistory[key];runtime.server={lastRevision:Math.max(0,int(runtime.server.lastRevision,0)),lastServerTime:Math.max(0,int(runtime.server.lastServerTime,0)),lastAckAt:Math.max(0,int(runtime.server.lastAckAt,0)),needsReconcile:!!runtime.server.needsReconcile};
    for(const [id,value] of Object.entries(runtime.sources)){
      if(!plainObject(value)){delete runtime.sources[id];continue;}
      value.highWater=Math.max(0,int(value.highWater,0));value.receipts=plainObject(value.receipts)?value.receipts:{};value.order=Array.isArray(value.order)?value.order.map(Number).filter(Number.isSafeInteger).slice(-MAX_RECEIPTS_PER_SOURCE):[];value.updatedAt=Math.max(0,int(value.updatedAt,0));
      const allowed=new Set(value.order.map(String));for(const key of Object.keys(value.receipts))if(!allowed.has(String(key)))delete value.receipts[key];
    }
    state.commandRuntime=runtime;return runtime;
  }
  function ensureSource(runtime,id){
    let source=runtime.sources[id];
    if(!plainObject(source))source=runtime.sources[id]={highWater:0,receipts:{},order:[],updatedAt:0};
    source.receipts=plainObject(source.receipts)?source.receipts:{};source.order=Array.isArray(source.order)?source.order:[];source.highWater=Math.max(0,int(source.highWater,0));return source;
  }
  function revision(state){return ensureRuntime(state).revision;}
  function create(type,payload,options={}){
    const src=cleanId(options.sourceId||sourceId(),96),sequence=Number.isSafeInteger(Number(options.sequence))&&Number(options.sequence)>0?Number(options.sequence):nextSequence(src),actorId=cleanId(options.actorId,128),issuedAt=Math.max(0,int(options.issuedAt,now())),expectedRevision=options.expectedRevision==null?(options.state?revision(options.state):null):Math.max(0,int(options.expectedRevision,0));
    return{schemaVersion:SCHEMA_VERSION,commandId:cleanId(options.commandId||`${src}:${sequence}`,192),sourceId:src,sequence,actorId,type:cleanId(type,96),payload:plainObject(payload)?payload:{},issuedAt,expectedRevision,clientSessionId:cleanId(options.clientSessionId||src,96)};
  }
  function validate(command){
    if(!plainObject(command))return{ok:false,code:'invalid_envelope'};
    if(Number(command.schemaVersion)!==SCHEMA_VERSION)return{ok:false,code:'unsupported_command_schema'};
    if(!/^[A-Za-z0-9._:@-]{3,192}$/.test(String(command.commandId||'')))return{ok:false,code:'invalid_command_id'};
    if(!/^[A-Za-z0-9._:@-]{3,96}$/.test(String(command.sourceId||'')))return{ok:false,code:'invalid_source_id'};
    if(!Number.isSafeInteger(Number(command.sequence))||Number(command.sequence)<1)return{ok:false,code:'invalid_sequence'};
    if(!/^[a-z][a-z0-9.-]{2,95}$/.test(String(command.type||'')))return{ok:false,code:'invalid_command_type'};
    if(!cleanId(command.actorId,128))return{ok:false,code:'missing_actor'};
    if(!plainObject(command.payload))return{ok:false,code:'invalid_payload'};
    try{const text=stableStringify(command.payload);if(text.length>16384)return{ok:false,code:'payload_too_large'};}catch(error){return{ok:false,code:'invalid_payload',message:error.message};}
    return{ok:true};
  }
  function cloneData(value){try{return value==null?null:JSON.parse(JSON.stringify(value));}catch(_){return null;}}
  function record(runtime,source,command,fp,outcome,at){
    const receipt={commandId:command.commandId,sourceId:command.sourceId,sequence:command.sequence,fingerprint:fp,type:command.type,actorId:command.actorId,status:outcome.ok?'applied':'rejected',code:String(outcome.code||(outcome.ok?'applied':'domain_rejected')),data:cloneData(outcome.data),revisionBefore:runtime.revision,revisionAfter:runtime.revision+(outcome.ok?1:0),processedAt:at};
    if(outcome.ok){runtime.revision++;runtime.stats.applied++;}else{runtime.stats.rejected++;if(receipt.code==='stale_revision')runtime.stats.stale++;}
    source.highWater=Math.max(source.highWater,command.sequence);source.receipts[String(command.sequence)]=receipt;source.order.push(command.sequence);source.order=[...new Set(source.order)].sort((a,b)=>a-b).slice(-MAX_RECEIPTS_PER_SOURCE);const keep=new Set(source.order.map(String));for(const key of Object.keys(source.receipts))if(!keep.has(key))delete source.receipts[key];source.updatedAt=at;return receipt;
  }
  function response(command,receipt,flags={}){return{ok:receipt.status==='applied',applied:receipt.status==='applied'&&!flags.duplicate,recorded:!!flags.recorded,duplicate:!!flags.duplicate,rejected:receipt.status!=='applied',conflict:!!flags.conflict,code:flags.code||receipt.code,data:cloneData(receipt.data),receipt,command};}
  function execute(state,command,context={}){
    registerDefaults();
    const basic=validate(command);if(!basic.ok)return{ok:false,applied:false,recorded:false,duplicate:false,rejected:true,code:basic.code,message:basic.message||'',command};
    const actor=cleanId(context.actorId||command.actorId,128);if(actor!==command.actorId)return{ok:false,applied:false,recorded:false,duplicate:false,rejected:true,code:'actor_mismatch',command};
    const runtime=ensureRuntime(state),source=ensureSource(runtime,command.sourceId),seq=Number(command.sequence),fp=fingerprint(command),existing=source.receipts[String(seq)];
    if(seq<=source.highWater){
      if(existing&&existing.commandId===command.commandId&&existing.fingerprint===fp){runtime.stats.duplicates++;return response(command,existing,{duplicate:true,code:'duplicate'});}
      if(existing){runtime.stats.conflicts++;return{ok:false,applied:false,recorded:false,duplicate:false,rejected:true,conflict:true,code:'command_id_conflict',receipt:existing,command};}
      runtime.stats.duplicates++;return{ok:false,applied:false,recorded:false,duplicate:true,rejected:true,code:'replay_below_high_water',command,highWater:source.highWater};
    }
    if(seq-source.highWater>MAX_SEQUENCE_GAP)return{ok:false,applied:false,recorded:false,duplicate:false,rejected:true,code:'sequence_gap_too_large',command};
    const at=Math.max(0,int(context.now,now()));
    let outcome;
    if(command.issuedAt>at+MAX_FUTURE_SKEW_MS)outcome={ok:false,code:'issued_in_future'};
    else if(command.issuedAt<at-MAX_COMMAND_AGE_MS)outcome={ok:false,code:'command_expired'};
    else if(command.expectedRevision!=null&&Number(command.expectedRevision)!==runtime.revision)outcome={ok:false,code:'stale_revision',data:{expected:Number(command.expectedRevision),actual:runtime.revision}};
    else{
      const entry=handlers.get(command.type);
      if(!entry)outcome={ok:false,code:'unknown_command'};
      else if(entry.serverOwned&&context.queueForServer===true&&runtime.outbox.length>=MAX_OUTBOX)outcome={ok:false,code:'outbox_full'};
      else{
        try{const raw=entry.handler({state,payload:command.payload,command,context,economy:context.economy||A.Economy,now:at});outcome=raw&&typeof raw==='object'&&typeof raw.ok==='boolean'?raw:{ok:!!raw,code:raw?'applied':'domain_rejected'};outcome.serverOwned=entry.serverOwned;}
        catch(error){outcome={ok:false,code:'handler_exception',data:{message:error?.message||String(error)},serverOwned:entry.serverOwned};}
      }
    }
    const receipt=record(runtime,source,command,fp,outcome,at);
    if(outcome.ok&&outcome.serverOwned!==false&&context.queueForServer===true){receipt.serverStatus='pending';runtime.outbox.push({schemaVersion:SCHEMA_VERSION,commandId:command.commandId,fingerprint:fp,actorId:command.actorId,sourceId:command.sourceId,sequence:command.sequence,type:command.type,payload:cloneData(command.payload)||{},issuedAt:command.issuedAt,expectedRevision:command.expectedRevision,localRevision:receipt.revisionAfter,status:'pending',queuedAt:at});}else if(outcome.ok){receipt.serverStatus='local-only';}
    return response(command,receipt,{recorded:true});
  }
  function register(type,handler,options={}){type=cleanId(type,96);if(!/^[a-z][a-z0-9.-]{2,95}$/.test(type)||typeof handler!=='function')throw new TypeError('Invalid command handler');handlers.set(type,{handler,serverOwned:options.serverOwned!==false});return true;}
  const accepted=(data,code='applied')=>({ok:true,code,data});
  const rejected=(code='domain_rejected',data=null)=>({ok:false,code,data});
  function boolCall(fn,args,data){if(typeof fn!=='function')return rejected('unsupported_command');return fn(...args)?accepted(data):rejected('domain_rejected');}
  function registerDefaults(){
    if(defaultsRegistered)return;defaultsRegistered=true;
    register('profile.reset',({state,payload,economy:E,command,context})=>{
      const runtime=context.authorityRevision!=null?ensureRuntime(state):state.commandRuntime,source=ensureSource(runtime,command.sourceId),server=plainObject(runtime.server)?runtime.server:{};
      // Keep the currently executing source object attached so execute() can
      // record the reset receipt after the handler replaces the game state.
      source.highWater=Math.max(0,Number(command.sequence)-1);source.receipts={};source.order=[];source.updatedAt=0;
      runtime.schemaVersion=SCHEMA_VERSION;
      runtime.revision=context.authorityRevision!=null?Math.max(0,int(context.authorityRevision,0))+1:Math.max(0,int(command.expectedRevision,runtime.revision));
      runtime.sources={[command.sourceId]:source};
      runtime.stats={applied:0,rejected:0,duplicates:0,conflicts:0,stale:0,acked:0,serverRejected:0};
      runtime.outbox=[];runtime.ackHistory={};runtime.ackOrder=[];
      runtime.server={lastRevision:Math.max(0,int(server.lastRevision,0)),lastServerTime:Math.max(0,int(server.lastServerTime,0)),lastAckAt:0,needsReconcile:false};
      const fresh=E.createInitialState({planetType:String(payload.planetType||state.empire?.planetType||state.planet?.type||'temperate'),startRegion:String(payload.startRegion||state.empire?.startRegion||state.planet?.startRegion||'center')});
      if(payload.theme)fresh.settings.theme=String(payload.theme)==='light'?'light':'dark';
      fresh.commandRuntime=runtime;
      for(const key of Object.keys(state))delete state[key];
      Object.assign(state,fresh);
      return accepted({reset:true,emptyMap:true,starterRights:Object.values(state.firstOrbit?.starterAllowance||{}).reduce((a,b)=>a+Number(b||0),0)});
    });
    register('market.set-enabled',({state,payload,economy:E,now:at})=>{if(!state.researched?.marketNetworkMk1)return rejected('technology_locked');state.market.enabled=!!payload.enabled;if(state.market.enabled&&!state.market.nextDispatchAt)state.market.nextDispatchAt=at+E.marketCooldownSec(state)*1000;return accepted({enabled:state.market.enabled});});
    register('market.set-global-keep',({state,payload,economy:E})=>{const pct=Math.max(0,Math.min(100,Math.floor(Number(payload.pct)||0)));E.setGlobalMarketKeep(state,pct);return accepted({pct});});
    register('market.set-all-auto-sell',({state,payload,economy:E})=>{E.setAllAutoSell(state,!!payload.enabled);return accepted({enabled:!!payload.enabled});});
    register('market.advance',({state,payload,economy:E})=>{const action=String(payload.action||'');if(action==='prototype')return boolCall(E.queueSatellite,[state,'prototypeMarketSatellite',1],{action});if(action==='satellite')return boolCall(E.queueSatellite,[state,'marketSatellite',1],{action});if(action==='upgrade')return boolCall(E.upgradeMarket,[state],{action});return rejected('invalid_market_action');});
    register('founding.start-contract',({state,payload,economy:E})=>boolCall(E.startFoundingContract,[state,String(payload.contractId||'')],{contractId:String(payload.contractId||'')}));
    register('research.start',({state,payload,economy:E})=>boolCall(E.doResearch,[state,String(payload.researchId||'')],{researchId:String(payload.researchId||'')}));
    register('research.start-repeat',({state,payload,economy:E})=>boolCall(E.doRepeatResearch,[state,String(payload.researchId||'')],{researchId:String(payload.researchId||'')}));
    register('research.cancel',({state,economy:E})=>boolCall(E.cancelResearch,[state],{refundedPct:70}));
    register('galaxy.scan',({state,economy:E})=>{const target=E.scanNextTarget(state);return target?accepted({targetId:target.id,name:target.name}):rejected('domain_rejected');});
    register('shipyard.queue-ship',({state,payload,economy:E})=>{const id=String(payload.shipId||''),count=Math.max(1,Math.min(9999,Math.floor(Number(payload.count)||1)));return boolCall(E.queueShip,[state,id,count],{shipId:id,count});});
    register('shipyard.queue-satellite',({state,payload,economy:E})=>{const id=String(payload.satelliteId||''),count=Math.max(1,Math.min(99,Math.floor(Number(payload.count)||1)));return boolCall(E.queueSatellite,[state,id,count],{satelliteId:id,count});});
    register('defense.build',({state,payload,economy:E})=>{const id=String(payload.defenseId||''),count=Math.max(1,Math.min(2000000,Math.floor(Number(payload.count)||1)));return boolCall(E.buildDefense,[state,id,count],{defenseId:id,count});});
    register('target.spy',({state,payload,economy:E})=>boolCall(E.spyTarget,[state,String(payload.targetId||'')],{targetId:String(payload.targetId||'')}));
    register('target.colonize',({state,payload,economy:E})=>boolCall(E.colonizeTarget,[state,String(payload.targetId||'')],{targetId:String(payload.targetId||'')}));
    register('fleet.send',({state,payload,economy:E})=>boolCall(E.sendFleet,[state,String(payload.targetId||''),plainObject(payload.ships)?payload.ships:{}],{targetId:String(payload.targetId||'')}));
    register('maintenance.upgrade-facility',({state,payload,economy:E})=>boolCall(E.upgradeFacility,[state,String(payload.facilityId||'')],{facilityId:String(payload.facilityId||'')}));
    register('maintenance.queue-repair',({state,payload,economy:E})=>{const amount=Math.max(1,Math.min(100000,Math.floor(Number(payload.amount)||1)));return boolCall(E.queueRepair,[state,String(payload.kind||''),String(payload.assetId||''),amount],{kind:String(payload.kind||''),assetId:String(payload.assetId||''),amount});});
    register('infrastructure.upgrade-capacity',({state,payload,economy:E})=>boolCall(E.upgradeCapacity,[state,String(payload.kind||'')],{kind:String(payload.kind||'')}));
    register('infrastructure.build-asset',({state,payload,economy:E})=>boolCall(E.buildAsset,[state,String(payload.assetId||'')],{assetId:String(payload.assetId||'')}));
    register('infrastructure.build-complex',({state,payload,economy:E})=>boolCall(E.buildComplex,[state,String(payload.complexId||'')],{complexId:String(payload.complexId||'')}));
    register('infrastructure.upgrade-complex',({state,payload,economy:E})=>boolCall(E.upgradeComplex,[state,String(payload.complexId||'')],{complexId:String(payload.complexId||'')}));

    register('sector.open',({state,payload,economy:E})=>{const sx=Math.floor(Number(payload.sx)),sy=Math.floor(Number(payload.sy));return boolCall(E.openSector,[state,sx,sy],{sx,sy});});
    register('factory.place',({state,payload,economy:E})=>{const defId=String(payload.defId||''),kind=payload.kind==='plant'?'plant':'machine',x=Math.floor(Number(payload.x)),y=Math.floor(Number(payload.y)),entityId=kind==='plant'?E.placePlant(state,defId,x,y):E.placeMachine(state,defId,x,y);return entityId?accepted({entityId,defId,kind,x,y}):rejected('domain_rejected');});
    register('factory.move',({state,payload,economy:E})=>{const entityId=String(payload.entityId||''),x=Math.floor(Number(payload.x)),y=Math.floor(Number(payload.y));return boolCall(E.moveEntity,[state,entityId,x,y],{entityId,x,y});});
    register('factory.remove',({state,payload,economy:E})=>boolCall(E.removeEntity,[state,String(payload.entityId||'')],{entityId:String(payload.entityId||'')}));
    register('factory.add-conveyor',({state,payload,economy:E})=>boolCall(E.addConveyor,[state,String(payload.from||''),String(payload.to||'')],{from:String(payload.from||''),to:String(payload.to||'')}));
    register('factory.add-power-line',({state,payload,economy:E})=>boolCall(E.addPowerLine,[state,String(payload.from||''),String(payload.to||'')],{from:String(payload.from||''),to:String(payload.to||'')}));
    register('factory.remove-line',({state,payload,economy:E})=>{const x=Number(payload.x),y=Number(payload.y),radius=Math.max(.05,Math.min(2,Number(payload.radius)||.45));return boolCall(E.removeLineNear,[state,x,y,radius],{x,y,radius});});
    register('machine.manual-run',({state,payload,economy:E})=>{const machineId=String(payload.machineId||''),produced=E.manualClick(state,machineId);return Number(produced)>0||String(produced)!=='0'?accepted({machineId,produced:String(produced)}):rejected('domain_rejected');});
    register('machine.upgrade-automation',({state,payload,economy:E})=>boolCall(E.upgradeAutomation,[state,String(payload.machineId||'')],{machineId:String(payload.machineId||'')}));
    register('structure.upgrade-class',({state,payload,economy:E})=>{const structureId=String(payload.structureId||''),kind=payload.kind==='plant'?'plant':'machine';return boolCall(E.doUpgradeClass,[state,structureId,kind],{structureId,kind});});
    register('storage.upgrade',({state,payload,economy:E})=>boolCall(E.upgradeStorage,[state,String(payload.itemId||'')],{itemId:String(payload.itemId||'')}));
    register('market.toggle-item-auto-sell',({state,payload,economy:E})=>{const itemId=String(payload.itemId||'');if(!E.itemInfo(state,itemId)?.name)return rejected('unknown_item');E.toggleAutoSell(state,itemId);return accepted({itemId,enabled:!!state.autoSell[itemId]});});
    register('market.set-item-keep',({state,payload,economy:E})=>{const itemId=String(payload.itemId||''),pct=Math.max(0,Math.min(100,Math.floor(Number(payload.pct)||0)));if(!E.itemInfo(state,itemId)?.name)return rejected('unknown_item');E.setAutoSellKeep(state,itemId,pct);return accepted({itemId,pct:state.autoSellKeep[itemId]||0});});
  }
  function executeAuthoritative(state,command,context={}){
    registerDefaults();
    const basic=validate(command);if(!basic.ok)return{ok:false,applied:false,rejected:true,code:basic.code,message:basic.message||'',command};
    const actor=cleanId(context.actorId||command.actorId,128);if(actor!==command.actorId)return{ok:false,applied:false,rejected:true,code:'actor_mismatch',command};
    const at=Math.max(0,int(context.now,now())),authorityRevision=Math.max(0,int(context.authorityRevision,0));
    if(command.issuedAt>at+MAX_FUTURE_SKEW_MS)return{ok:false,applied:false,rejected:true,code:'issued_in_future',command};
    if(command.issuedAt<at-MAX_COMMAND_AGE_MS)return{ok:false,applied:false,rejected:true,code:'command_expired',command};
    if(command.expectedRevision!=null&&Number(command.expectedRevision)!==authorityRevision)return{ok:false,applied:false,rejected:true,code:'stale_revision',data:{expected:Number(command.expectedRevision),actual:authorityRevision},command};
    const entry=handlers.get(command.type);if(!entry)return{ok:false,applied:false,rejected:true,code:'unknown_command',command};
    try{
      const raw=entry.handler({state,payload:command.payload,command,context,economy:context.economy||A.Economy,now:at});
      const outcome=raw&&typeof raw==='object'&&typeof raw.ok==='boolean'?raw:{ok:!!raw,code:raw?'applied':'domain_rejected'};
      return{ok:!!outcome.ok,applied:!!outcome.ok,rejected:!outcome.ok,code:String(outcome.code||(outcome.ok?'applied':'domain_rejected')),data:cloneData(outcome.data),fingerprint:fingerprint(command),serverOwned:entry.serverOwned!==false,command};
    }catch(error){return{ok:false,applied:false,rejected:true,code:'handler_exception',data:{message:error?.message||String(error)},fingerprint:fingerprint(command),serverOwned:entry.serverOwned!==false,command};}
  }
  function outboxBatch(state,limit=50){const rt=ensureRuntime(state),n=Math.max(1,Math.min(100,Math.floor(Number(limit)||50)));return rt.outbox.slice(0,n).map(cloneData);}
  function findReceipt(runtime,item){return runtime.sources?.[item.sourceId]?.receipts?.[String(item.sequence)]||null;}
  function acknowledge(state,ack,context={}){
    const rt=ensureRuntime(state);if(!plainObject(ack)||!cleanId(ack.commandId,192))return{ok:false,code:'invalid_ack'};
    const prior=rt.ackHistory[ack.commandId];if(prior)return{ok:prior.status==='accepted',duplicate:true,code:'duplicate_ack',ack:cloneData(prior)};
    const index=rt.outbox.findIndex(x=>x.commandId===ack.commandId);if(index<0)return{ok:false,code:'unknown_ack'};
    const item=rt.outbox[index];if(ack.fingerprint&&String(ack.fingerprint)!==item.fingerprint)return{ok:false,code:'ack_fingerprint_mismatch'};
    if(context.actorId&&String(context.actorId)!==item.actorId)return{ok:false,code:'ack_actor_mismatch'};
    const status=ack.status==='accepted'?'accepted':ack.status==='rejected'?'rejected':'';if(!status)return{ok:false,code:'invalid_ack_status'};
    const at=Math.max(0,int(ack.receivedAt,now())),serverRevision=Math.max(rt.server.lastRevision,int(ack.serverRevision,rt.server.lastRevision)),serverTime=Math.max(rt.server.lastServerTime,int(ack.serverTime,rt.server.lastServerTime));
    rt.outbox.splice(index,1);const saved={commandId:item.commandId,fingerprint:item.fingerprint,status,serverRevision,serverTime,receivedAt:at,reason:cleanId(ack.reason,160)};rt.ackHistory[item.commandId]=saved;rt.ackOrder.push(item.commandId);rt.ackOrder=[...new Set(rt.ackOrder)].slice(-MAX_ACK_HISTORY);const keep=new Set(rt.ackOrder);for(const key of Object.keys(rt.ackHistory))if(!keep.has(key))delete rt.ackHistory[key];rt.server.lastRevision=serverRevision;rt.server.lastServerTime=serverTime;rt.server.lastAckAt=at;rt.server.needsReconcile=status==='rejected'||rt.server.needsReconcile;const receipt=findReceipt(rt,item);if(receipt){receipt.serverStatus=status;receipt.serverRevision=serverRevision;receipt.serverTime=serverTime;if(status==='rejected')receipt.serverReason=saved.reason||'server_rejected';}
    if(status==='accepted')rt.stats.acked++;else rt.stats.serverRejected++;return{ok:status==='accepted',duplicate:false,code:status==='accepted'?'acknowledged':'server_rejected',ack:cloneData(saved),needsReconcile:rt.server.needsReconcile};
  }
  function acknowledgeBatch(state,acks,context={}){return(Array.isArray(acks)?acks:[]).map(ack=>acknowledge(state,ack,context));}
  function diagnostics(state){const rt=ensureRuntime(state);return{schemaVersion:rt.schemaVersion,revision:rt.revision,sources:Object.keys(rt.sources).length,pending:rt.outbox.length,server:{...rt.server},stats:{...rt.stats},maxReceiptsPerSource:MAX_RECEIPTS_PER_SOURCE,maxOutbox:MAX_OUTBOX};}
  function resetTestIdentity(){memorySourceId='';memorySequence=0;}

  A.DomainCommand={SCHEMA_VERSION,MAX_RECEIPTS_PER_SOURCE,MAX_OUTBOX,create,execute,executeAuthoritative,register,revision,diagnostics,validate,fingerprint,stableStringify,sourceId,registerDefaults,outboxBatch,acknowledge,acknowledgeBatch,_test:{ensureRuntime,resetTestIdentity}};
})(typeof window!=='undefined'?window:globalThis);
