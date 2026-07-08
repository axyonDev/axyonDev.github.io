'use strict';
class KeyedMutex{
  constructor(){this.tails=new Map();}
  async run(key,fn){
    const prior=this.tails.get(key)||Promise.resolve();
    let release;const gate=new Promise(resolve=>{release=resolve;});
    const tail=prior.catch(()=>{}).then(()=>gate);this.tails.set(key,tail);
    await prior.catch(()=>{});
    try{return await fn();}finally{release();if(this.tails.get(key)===tail)this.tails.delete(key);}
  }
}
class MemoryAuthorityRepository{
  constructor({cloneState,now=()=>Date.now()}={}){
    if(typeof cloneState!=='function')throw new TypeError('cloneState is required');
    this.cloneState=cloneState;this.now=now;this.actors=new Map();this.commandLedger=new Map();this.sequenceLedger=new Map();this.eventOutbox=[];this.mutex=new KeyedMutex();this.eventSequence=0;
  }
  ledgerKey(actorId,commandId){return`${actorId}\u0000${commandId}`;}
  sequenceKey(actorId,sourceId,sequence){return`${actorId}\u0000${sourceId}\u0000${sequence}`;}
  seedActor(actorId,state,revision=0){
    actorId=String(actorId||'').trim();if(!actorId)throw new TypeError('actorId is required');
    this.actors.set(actorId,{actorId,revision:Math.max(0,Number(revision)||0),state:this.cloneState(state),updatedAt:this.now()});return this.snapshot(actorId);
  }
  hasActor(actorId){return this.actors.has(String(actorId));}
  snapshot(actorId){const row=this.actors.get(String(actorId));if(!row)return null;return{actorId:row.actorId,revision:row.revision,state:this.cloneState(row.state),updatedAt:row.updatedAt};}
  ledger(actorId,commandId){const x=this.commandLedger.get(this.ledgerKey(actorId,commandId));return x?JSON.parse(JSON.stringify(x)):null;}
  sequenceClaim(actorId,sourceId,sequence){const x=this.sequenceLedger.get(this.sequenceKey(actorId,sourceId,sequence));return x?{...x}:null;}
  events({actorId,status='pending',limit=100}={}){return this.eventOutbox.filter(e=>(!actorId||e.actorId===actorId)&&(!status||e.status===status)).slice(0,Math.max(1,Math.min(1000,limit))).map(e=>JSON.parse(JSON.stringify(e)));}
  markEventsPublished(eventIds){const set=new Set(eventIds||[]);let changed=0;for(const e of this.eventOutbox)if(set.has(e.eventId)&&e.status==='pending'){e.status='published';e.publishedAt=this.now();changed++;}return changed;}
  async withActor(actorId,fn){return this.mutex.run(String(actorId),fn);}
  commit({actorId,state,revision,expectedRevision,receipt,sequenceClaim,event,failpoint}){
    if(failpoint==='before_commit')throw new Error('forced_before_commit_failure');
    const current=this.actors.get(actorId);if(!current)throw Object.assign(new Error('actor_not_found'),{code:'actor_not_found'});if(expectedRevision!=null&&Number(current.revision)!==Number(expectedRevision))throw Object.assign(new Error('stale_revision'),{code:'stale_revision',actualRevision:current.revision});
    const now=this.now(),actor={actorId,revision,state:this.cloneState(state),updatedAt:now},receiptCopy=JSON.parse(JSON.stringify(receipt)),claimCopy={commandId:sequenceClaim.commandId,fingerprint:sequenceClaim.fingerprint},eventCopy=event?JSON.parse(JSON.stringify(event)):null;
    const ledgerKey=this.ledgerKey(actorId,receipt.commandId),seqKey=this.sequenceKey(actorId,receipt.sourceId,receipt.sequence),eventSequence=this.eventSequence+(eventCopy?1:0);
    this.actors.set(actorId,actor);this.commandLedger.set(ledgerKey,receiptCopy);this.sequenceLedger.set(seqKey,claimCopy);
    if(eventCopy){this.eventSequence=eventSequence;this.eventOutbox.push({...eventCopy,eventId:eventCopy.eventId||`evt-${String(eventSequence).padStart(12,'0')}`,status:'pending',createdAt:now});}
    if(failpoint==='after_commit')throw new Error('forced_after_commit_failure');
    return this.snapshot(actorId);
  }
  commitReceiptOnly({actorId,receipt,sequenceClaim,expectedRevision,failpoint}){
    if(failpoint==='before_commit')throw new Error('forced_before_commit_failure');
    const current=this.actors.get(actorId);if(!current)throw Object.assign(new Error('actor_not_found'),{code:'actor_not_found'});if(expectedRevision!=null&&Number(current.revision)!==Number(expectedRevision))throw Object.assign(new Error('stale_revision'),{code:'stale_revision',actualRevision:current.revision});
    this.commandLedger.set(this.ledgerKey(actorId,receipt.commandId),JSON.parse(JSON.stringify(receipt)));
    this.sequenceLedger.set(this.sequenceKey(actorId,receipt.sourceId,receipt.sequence),{commandId:sequenceClaim.commandId,fingerprint:sequenceClaim.fingerprint});
    if(failpoint==='after_commit')throw new Error('forced_after_commit_failure');
  }
  diagnostics(){return{actors:this.actors.size,ledger:this.commandLedger.size,sequences:this.sequenceLedger.size,pendingEvents:this.eventOutbox.filter(e=>e.status==='pending').length,totalEvents:this.eventOutbox.length,activeLocks:this.mutex.tails.size};}
}
module.exports={KeyedMutex,MemoryAuthorityRepository};
