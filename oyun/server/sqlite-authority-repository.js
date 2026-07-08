'use strict';
const fs=require('fs');
const path=require('path');
const {DatabaseSync}=require('node:sqlite');
const {KeyedMutex}=require('./authoritative-repository');

class RepositoryConflictError extends Error{
  constructor(code,details={}){super(code);this.name='RepositoryConflictError';this.code=code;Object.assign(this,details);}
}
function cloneJson(value){return value==null?value:JSON.parse(JSON.stringify(value));}
class SqliteAuthorityRepository{
  constructor({filename,cloneState,now=()=>Date.now(),busyTimeoutMs=5000}={}){
    if(typeof cloneState!=='function')throw new TypeError('cloneState is required');
    if(!filename)throw new TypeError('filename is required');
    this.filename=path.resolve(filename);this.cloneState=cloneState;this.now=now;this.mutex=new KeyedMutex();
    fs.mkdirSync(path.dirname(this.filename),{recursive:true});
    this.db=new DatabaseSync(this.filename);
    this.db.exec(`PRAGMA busy_timeout=${Math.max(100,Number(busyTimeoutMs)||5000)}; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;`);
    try{this.db.exec('PRAGMA journal_mode=WAL;');}catch(error){if(!/locked/i.test(String(error?.message||error)))throw error;}
    this.migrate();this.prepareStatements();
  }
  migrate(){
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS authority_meta(
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;
      INSERT INTO authority_meta(key,value) VALUES('schema_version','1') ON CONFLICT(key) DO NOTHING;
      CREATE TABLE IF NOT EXISTS actors(
        actor_id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL CHECK(revision>=0),
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS command_ledger(
        actor_id TEXT NOT NULL,
        command_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(actor_id,command_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS sequence_ledger(
        actor_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        sequence INTEGER NOT NULL CHECK(sequence>0),
        command_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(actor_id,source_id,sequence)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_sequence_actor_command ON sequence_ledger(actor_id,command_id);
      CREATE TABLE IF NOT EXISTS event_outbox(
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        actor_id TEXT NOT NULL,
        command_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','published')),
        event_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        published_at INTEGER
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_event_outbox_status_actor ON event_outbox(status,actor_id,event_id);
    `);
  }
  prepareStatements(){
    const db=this.db;
    this.st={
      actorGet:db.prepare('SELECT actor_id,revision,state_json,updated_at FROM actors WHERE actor_id=?'),
      actorUpsert:db.prepare('INSERT INTO actors(actor_id,revision,state_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(actor_id) DO UPDATE SET revision=excluded.revision,state_json=excluded.state_json,updated_at=excluded.updated_at'),
      actorUpdateCas:db.prepare('UPDATE actors SET revision=?,state_json=?,updated_at=? WHERE actor_id=? AND revision=?'),
      ledgerGet:db.prepare('SELECT fingerprint,receipt_json FROM command_ledger WHERE actor_id=? AND command_id=?'),
      ledgerInsert:db.prepare('INSERT INTO command_ledger(actor_id,command_id,fingerprint,receipt_json,created_at) VALUES(?,?,?,?,?)'),
      seqGet:db.prepare('SELECT command_id,fingerprint FROM sequence_ledger WHERE actor_id=? AND source_id=? AND sequence=?'),
      seqInsert:db.prepare('INSERT INTO sequence_ledger(actor_id,source_id,sequence,command_id,fingerprint,created_at) VALUES(?,?,?,?,?,?)'),
      eventInsert:db.prepare("INSERT INTO event_outbox(event_key,actor_id,command_id,status,event_json,created_at) VALUES(?,?,?,'pending',?,?)"),
      eventPending:db.prepare("SELECT event_id,status,event_json,created_at,published_at FROM event_outbox WHERE (? IS NULL OR actor_id=?) AND (? IS NULL OR status=?) ORDER BY event_id LIMIT ?"),
      eventMark:db.prepare("UPDATE event_outbox SET status='published',published_at=? WHERE event_id=? AND status='pending'"),
      countActors:db.prepare('SELECT COUNT(*) AS n FROM actors'),countLedger:db.prepare('SELECT COUNT(*) AS n FROM command_ledger'),countSeq:db.prepare('SELECT COUNT(*) AS n FROM sequence_ledger'),countPending:db.prepare("SELECT COUNT(*) AS n FROM event_outbox WHERE status='pending'"),countEvents:db.prepare('SELECT COUNT(*) AS n FROM event_outbox')
    };
  }
  begin(){this.db.exec('BEGIN IMMEDIATE');}
  commitTx(){this.db.exec('COMMIT');}
  rollback(){try{this.db.exec('ROLLBACK');}catch(_){}}
  close(){this.db.close();}
  ledgerKey(actorId,commandId){return`${actorId}\u0000${commandId}`;}
  sequenceKey(actorId,sourceId,sequence){return`${actorId}\u0000${sourceId}\u0000${sequence}`;}
  seedActor(actorId,state,revision=0){
    actorId=String(actorId||'').trim();if(!actorId)throw new TypeError('actorId is required');
    const at=this.now();this.st.actorUpsert.run(actorId,Math.max(0,Number(revision)||0),JSON.stringify(this.cloneState(state)),at);return this.snapshot(actorId);
  }
  hasActor(actorId){return!!this.st.actorGet.get(String(actorId));}
  snapshot(actorId){const row=this.st.actorGet.get(String(actorId));if(!row)return null;return{actorId:row.actor_id,revision:Number(row.revision),state:this.cloneState(JSON.parse(row.state_json)),updatedAt:Number(row.updated_at)};}
  ledger(actorId,commandId){const row=this.st.ledgerGet.get(String(actorId),String(commandId));return row?cloneJson(JSON.parse(row.receipt_json)):null;}
  sequenceClaim(actorId,sourceId,sequence){const row=this.st.seqGet.get(String(actorId),String(sourceId),Number(sequence));return row?{commandId:row.command_id,fingerprint:row.fingerprint}:null;}
  events({actorId,status='pending',limit=100}={}){
    const actor=actorId?String(actorId):null,stat=status?String(status):null,n=Math.max(1,Math.min(1000,Number(limit)||100));
    return this.st.eventPending.all(actor,actor,stat,stat,n).map(row=>{const e=JSON.parse(row.event_json);return{...e,eventId:e.eventId||`evt-${String(row.event_id).padStart(12,'0')}`,status:row.status,createdAt:Number(row.created_at),publishedAt:row.published_at==null?undefined:Number(row.published_at)};});
  }
  markEventsPublished(eventIds){
    const ids=[...new Set((eventIds||[]).map(x=>Number(String(x).replace(/^evt-/,''))).filter(Number.isSafeInteger))];let changed=0,at=this.now();
    this.begin();try{for(const id of ids)changed+=Number(this.st.eventMark.run(at,id).changes||0);this.commitTx();return changed;}catch(error){this.rollback();throw error;}
  }
  async withActor(actorId,fn){return this.mutex.run(String(actorId),fn);}
  assertClaims({actorId,commandId,fingerprint,sourceId,sequence,expectedRevision}){
    const ledger=this.st.ledgerGet.get(actorId,commandId);
    if(ledger){const receipt=JSON.parse(ledger.receipt_json);if(ledger.fingerprint===fingerprint)throw new RepositoryConflictError('duplicate_commit',{receipt});throw new RepositoryConflictError('command_id_conflict',{receipt});}
    const seq=this.st.seqGet.get(actorId,sourceId,sequence);
    if(seq)throw new RepositoryConflictError(seq.command_id===commandId&&seq.fingerprint===fingerprint?'duplicate_commit':'source_sequence_conflict');
    const actor=this.st.actorGet.get(actorId);if(!actor)throw new RepositoryConflictError('actor_not_found');
    if(Number(actor.revision)!==Number(expectedRevision))throw new RepositoryConflictError('stale_revision',{actualRevision:Number(actor.revision),expectedRevision:Number(expectedRevision)});
    return actor;
  }
  commit({actorId,state,revision,expectedRevision,receipt,sequenceClaim,event,failpoint}){
    if(failpoint==='before_commit')throw new Error('forced_before_commit_failure');
    const now=this.now(),fp=receipt.fingerprint||sequenceClaim.fingerprint;this.begin();
    try{
      this.assertClaims({actorId,commandId:receipt.commandId,fingerprint:fp,sourceId:receipt.sourceId,sequence:receipt.sequence,expectedRevision});
      const updated=this.st.actorUpdateCas.run(Number(revision),JSON.stringify(this.cloneState(state)),now,actorId,Number(expectedRevision));
      if(Number(updated.changes)!==1)throw new RepositoryConflictError('stale_revision');
      this.st.ledgerInsert.run(actorId,receipt.commandId,fp,JSON.stringify(receipt),now);
      this.st.seqInsert.run(actorId,receipt.sourceId,receipt.sequence,receipt.commandId,fp,now);
      if(event){const eventKey=`${actorId}:${receipt.commandId}`,copy=cloneJson(event);this.st.eventInsert.run(eventKey,actorId,receipt.commandId,JSON.stringify(copy),now);}
      this.commitTx();
    }catch(error){this.rollback();throw error;}
    if(failpoint==='after_commit')throw new Error('forced_after_commit_failure');
    return this.snapshot(actorId);
  }
  commitReceiptOnly({actorId,receipt,sequenceClaim,expectedRevision,failpoint}){
    if(failpoint==='before_commit')throw new Error('forced_before_commit_failure');
    const now=this.now(),fp=receipt.fingerprint||sequenceClaim.fingerprint;this.begin();
    try{
      this.assertClaims({actorId,commandId:receipt.commandId,fingerprint:fp,sourceId:receipt.sourceId,sequence:receipt.sequence,expectedRevision});
      this.st.ledgerInsert.run(actorId,receipt.commandId,fp,JSON.stringify(receipt),now);
      this.st.seqInsert.run(actorId,receipt.sourceId,receipt.sequence,receipt.commandId,fp,now);
      this.commitTx();
    }catch(error){this.rollback();throw error;}
    if(failpoint==='after_commit')throw new Error('forced_after_commit_failure');
  }
  diagnostics(){return{backend:'sqlite',database:this.filename,actors:Number(this.st.countActors.get().n),ledger:Number(this.st.countLedger.get().n),sequences:Number(this.st.countSeq.get().n),pendingEvents:Number(this.st.countPending.get().n),totalEvents:Number(this.st.countEvents.get().n),activeLocks:this.mutex.tails.size};}
}
module.exports={RepositoryConflictError,SqliteAuthorityRepository};
