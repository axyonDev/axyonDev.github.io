'use strict';
const {createRuntime,cloneState}=require('./runtime-factory');
const {MemoryAuthorityRepository}=require('./authoritative-repository');
function cloneJson(v){return v==null?v:JSON.parse(JSON.stringify(v));}
class AuthorityService{
  constructor(options={}){
    this.A=options.runtime||createRuntime();this.now=options.now||(()=>Date.now());
    this.repository=options.repository||new MemoryAuthorityRepository({cloneState:s=>cloneState(this.A,s),now:this.now});
  }
  seedActor(actorId,state,revision=0){return this.repository.seedActor(actorId,state||this.A.Economy.createInitialState(),revision);}
  ensureActor(actorId){if(!this.repository.hasActor(actorId))this.seedActor(actorId);return this.repository.snapshot(actorId);}
  snapshot(actorId){const row=this.repository.snapshot(actorId);if(!row)return null;return{schemaVersion:1,actorId:row.actorId,serverRevision:row.revision,serverTime:this.now(),state:row.state,updatedAt:row.updatedAt};}
  async execute(actorId,command,options={}){
    actorId=String(actorId||'').trim();
    if(!actorId)return{httpStatus:400,ok:false,code:'missing_actor'};
    return this.repository.withActor(actorId,async()=>{
      const C=this.A.DomainCommand,basic=C.validate(command);
      if(!basic.ok)return{httpStatus:400,ok:false,code:basic.code,message:basic.message||''};
      if(command.actorId!==actorId)return{httpStatus:403,ok:false,code:'actor_mismatch'};
      const fp=C.fingerprint(command),existing=this.repository.ledger(actorId,command.commandId);
      if(existing){
        if(existing.fingerprint!==fp)return{httpStatus:409,ok:false,code:'command_id_conflict',conflict:true,receipt:existing};
        return{httpStatus:200,ok:existing.status==='accepted',duplicate:true,code:'duplicate',receipt:existing,ack:this.toAck(existing,true)};
      }
      const seqExisting=this.repository.sequenceClaim(actorId,command.sourceId,command.sequence);
      if(seqExisting){
        if(seqExisting.commandId!==command.commandId||seqExisting.fingerprint!==fp)return{httpStatus:409,ok:false,code:'source_sequence_conflict',conflict:true};
      }
      const current=this.ensureActor(actorId),draft=cloneState(this.A,current.state),serverTime=this.now();
      const result=C.executeAuthoritative(draft,command,{actorId,economy:this.A.Economy,authorityRevision:current.revision,now:serverTime});
      // Profile reset is a destructive, user-confirmed command that may be
      // created from an offline/stale client. Do not claim its immutable id on
      // a stale CAS rejection; the network adapter will refresh the server
      // revision and safely retry the same command. A committed reset is still
      // protected by the normal command ledger duplicate path above.
      if(!result.ok&&result.code==='stale_revision'&&command.type==='profile.reset')return{httpStatus:409,ok:false,code:'stale_revision',serverRevision:current.revision};
      const nextRevision=result.ok?current.revision+1:current.revision;
      const receipt={schemaVersion:1,actorId,commandId:command.commandId,sourceId:command.sourceId,sequence:command.sequence,type:command.type,fingerprint:fp,status:result.ok?'accepted':'rejected',code:result.code,data:cloneJson(result.data),serverRevision:nextRevision,serverTime,processedAt:serverTime};
      const claim={commandId:command.commandId,fingerprint:fp};
      try{
        if(result.ok){
          const event={schemaVersion:1,actorId,commandId:command.commandId,eventType:`${command.type}.applied`,serverRevision:nextRevision,payload:cloneJson(result.data)||{},occurredAt:serverTime};
          this.repository.commit({actorId,state:draft,revision:nextRevision,expectedRevision:current.revision,receipt,sequenceClaim:claim,event,failpoint:options.failpoint});
        }else this.repository.commitReceiptOnly({actorId,receipt,sequenceClaim:claim,expectedRevision:current.revision,failpoint:options.failpoint});
      }catch(error){
        const code=error?.code||error?.message||'transaction_failed';
        if(code==='duplicate_commit'){
          const saved=error.receipt||this.repository.ledger(actorId,command.commandId);
          if(saved&&saved.fingerprint===fp)return{httpStatus:200,ok:saved.status==='accepted',duplicate:true,code:'duplicate',receipt:saved,ack:this.toAck(saved,true)};
          return{httpStatus:409,ok:false,code:'command_id_conflict',conflict:true,receipt:saved||null};
        }
        if(code==='command_id_conflict'||code==='source_sequence_conflict')return{httpStatus:409,ok:false,code,conflict:true};
        if(code==='stale_revision')return{httpStatus:409,ok:false,code:'stale_revision',serverRevision:Number(error.actualRevision??this.repository.snapshot(actorId)?.revision??current.revision)};
        return{httpStatus:503,ok:false,code:'transaction_failed',message:error.message,serverRevision:current.revision};
      }
      const status=result.ok?200:result.code==='stale_revision'?409:result.code==='actor_mismatch'?403:422;
      return{httpStatus:status,ok:result.ok,duplicate:false,code:result.code,receipt,ack:this.toAck(receipt,false)};
    });
  }
  toAck(receipt,duplicate=false){return{schemaVersion:1,commandId:receipt.commandId,fingerprint:receipt.fingerprint,status:receipt.status,serverRevision:receipt.serverRevision,serverTime:receipt.serverTime,reason:receipt.status==='accepted'?'':receipt.code,data:cloneJson(receipt.data),duplicate:!!duplicate};}
  diagnostics(){return this.repository.diagnostics();}
}
module.exports={AuthorityService};
