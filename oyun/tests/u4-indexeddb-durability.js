'use strict';
const assert=require('assert');
const {loadRuntime,memoryStorage,decimalToString}=require('./runtime-loader');

async function quietExpected(task){const prior=console.error;console.error=()=>{};try{return await task();}finally{console.error=prior;}}

(async()=>{
  const storage=memoryStorage();

  // Build a genuine U3.1-style local-only profile first. No prepare() and no vault backend.
  const legacyCtx=loadRuntime({localStorage:storage,saveService:true});
  const legacyState=legacyCtx.Axyon.Economy.createInitialState();
  assert(legacyCtx.Axyon.SaveService.createProfile('U4 Migration',legacyState).ok);
  legacyState.coins=legacyCtx.Axyon.EconomyNumber.safe('12345');
  assert.strictEqual(legacyCtx.Axyon.SaveService.save(legacyState),true);
  const profileId=legacyCtx.Axyon.SaveService.currentProfileId();
  const saveKey=legacyCtx.Axyon.SaveService.keys.SAVE_PREFIX+profileId;
  assert(storage.getItem(saveKey),'legacy local save missing');

  const backend=legacyCtx.Axyon.StorageVault._test.createMemoryBackend();

  // Backend-level concurrent/stale revision protection: changed data can never reuse an existing revision.
  const raceA=legacyCtx.Axyon.StorageVault.makeRecord('race-record','A',5,100,'tab-a');
  const raceB=legacyCtx.Axyon.StorageVault.makeRecord('race-record','B',5,101,'tab-b');
  await backend.putRecord(raceA);
  const raceSaved=await backend.putRecord(raceB);
  assert.strictEqual(raceSaved.revision,6,'stale concurrent revision was not advanced');
  assert.strictEqual((await backend.getBackups('race-record')).length,1,'concurrent overwrite did not preserve previous generation');

  // First U4 boot imports all critical local records into the durable vault without deleting the mirror.
  let ctx=loadRuntime({localStorage:storage,storageBackend:backend,saveService:true});
  let S=ctx.Axyon.SaveService;
  const migration=await S.prepare();
  assert.strictEqual(migration.mode,'indexeddb-primary');
  assert(migration.imported>=3,`expected profile/index/active import, got ${migration.imported}`);
  let records=await backend.getAllRecords();
  assert(records.some(x=>x.key===saveKey),'save was not imported into vault');
  assert(records.some(x=>x.key===S.keys.INDEX_KEY),'profile index was not imported into vault');
  assert(records.some(x=>x.key===S.keys.ACTIVE_KEY),'active profile was not imported into vault');
  let state=S.load();
  assert.strictEqual(decimalToString(ctx,state.coins),'12345');

  // Ordinary saves are dual-written and the durable copy reaches the latest revision.
  state.coins=ctx.Axyon.EconomyNumber.safe('20000');
  assert.strictEqual(S.save(state),true);
  assert((await S.flush()).ok,'vault flush failed');
  let durable=await S.rawVaultActiveSave();
  assert(durable&&durable.revision>=2,'durable revision did not advance');
  assert.strictEqual(JSON.parse(durable.value).economy.credits,'20000');

  // A corrupt local mirror is automatically rehydrated from the valid IndexedDB record on next boot.
  storage.setItem(saveKey,'{"broken":true}');
  ctx=loadRuntime({localStorage:storage,storageBackend:backend,saveService:true});S=ctx.Axyon.SaveService;
  const repair=await S.prepare();
  assert(repair.hydrated>=1&&repair.repaired>=1,`local repair was not reported: ${JSON.stringify(repair)}`);
  durable=await S.rawVaultActiveSave();
  assert.strictEqual(storage.getItem(saveKey),durable.value,'local mirror was not repaired from vault');
  state=S.load();
  assert.strictEqual(decimalToString(ctx,state.coins),'20000');

  // Create two durable generations so the bounded backup store has a valid rollback target.
  state.coins=ctx.Axyon.EconomyNumber.safe('31000');assert(S.save(state));await S.flush();
  state.coins=ctx.Axyon.EconomyNumber.safe('42000');assert(S.save(state));await S.flush();
  let backups=await backend.getBackups(saveKey);
  assert(backups.length>=1,'previous durable generation was not backed up');
  const expectedRollback=backups[0];
  assert(ctx.Axyon.StorageVault.verifyRecord(expectedRollback),'backup checksum invalid before corruption');

  // Corrupt both current copies. U4 must restore the newest valid durable backup automatically.
  const corrupted='{"version":16,"schemaVersion":16,"economy":{}}';
  storage.setItem(saveKey,corrupted);
  backend.corruptRecord(saveKey,{value:corrupted,checksum:ctx.Axyon.StorageVault.checksum(corrupted)});
  ctx=loadRuntime({localStorage:storage,storageBackend:backend,saveService:true});S=ctx.Axyon.SaveService;
  const rollback=await S.prepare();
  assert.strictEqual(rollback.rolledBack,1,`automatic rollback did not occur: ${JSON.stringify(rollback)}`);
  state=S.load();
  const rollbackCredits=JSON.parse(expectedRollback.value).economy.credits;
  assert.strictEqual(decimalToString(ctx,state.coins),rollbackCredits,'restored state did not match newest valid backup');
  durable=await S.rawVaultActiveSave();
  assert.strictEqual(durable.value,expectedRollback.value,'vault current record was not repaired by rollback');

  // Rapid sequential saves remain ordered; the last write wins and backup retention stays bounded.
  for(let i=1;i<=9;i++){
    state.coins=ctx.Axyon.EconomyNumber.safe(String(50000+i));
    assert(S.save(state));
  }
  assert((await S.flush()).ok,'rapid save flush failed');
  durable=await S.rawVaultActiveSave();
  assert.strictEqual(JSON.parse(durable.value).economy.credits,'50009','last rapid save did not win');
  backups=await backend.getBackups(saveKey);
  assert(backups.length<=ctx.Axyon.StorageVault._test.MAX_BACKUPS_PER_KEY,'backup retention exceeded bound');

  // An IndexedDB write failure is visible, local progress remains mirrored, and manual retry recovers it.
  backend._control.failNextPut=1;
  state.coins=ctx.Axyon.EconomyNumber.safe('77777');
  assert.strictEqual(S.save(state),true,'local mirror should still accept the save before async vault failure');
  await quietExpected(()=>S.flush());
  let diagnostics=S.diagnostics();
  assert.strictEqual(diagnostics.blockingError?.type,'save');
  assert.strictEqual(diagnostics.blockingError?.layer,'indexeddb');
  assert.strictEqual(JSON.parse(storage.getItem(saveKey)).economy.credits,'77777','local mirror lost progress during vault failure');
  assert.strictEqual(S.retrySave(state),true,'manual durable retry was rejected');
  assert((await S.flush()).ok,'manual durable retry did not recover');
  diagnostics=S.diagnostics();
  assert.strictEqual(diagnostics.blockingError,null);
  durable=await S.rawVaultActiveSave();
  assert.strictEqual(JSON.parse(durable.value).economy.credits,'77777');

  // Profile deletion uses a revisioned tombstone, so an interrupted durable delete cannot resurrect data.
  backend._control.failNextPut=1;
  assert.strictEqual(S.deleteProfile(profileId),true);
  await quietExpected(()=>S.flush());
  assert.strictEqual(storage.getItem(saveKey),null);
  const mirrorMeta=JSON.parse(storage.getItem(S.keys.MIRROR_META_KEY));
  assert.strictEqual(mirrorMeta[saveKey].deleted,true,'local delete tombstone missing');

  // Simulate the next boot after the failed first tombstone write. Local tombstone must beat the older vault value.
  ctx=loadRuntime({localStorage:storage,storageBackend:backend,saveService:true});S=ctx.Axyon.SaveService;
  const deleteRepair=await S.prepare();
  await S.flush();
  const deletedRecord=await backend.getRecord(saveKey);
  assert(deletedRecord?.deleted===true,'deleted profile save was resurrected from an older vault record');
  assert.strictEqual(storage.getItem(saveKey),null);
  assert(deleteRepair.imported>=1||deleteRepair.unchanged>=1,'delete tombstone was not reconciled');

  console.log('PASS u4-indexeddb-durability: legacy import, ordered dual-write, mirror repair, bounded rollback, failure recovery and tombstone delete safety');
})().catch(error=>{console.error(error);process.exit(1);});
