'use strict';
const assert=require('assert');
const {loadRuntime}=require('./runtime-loader');
const {AuthorityService}=require('../server/authority-service');
const ctx=loadRuntime();const {Economy:E,DomainCommand:C,Data:D}=ctx.Axyon;
const actor='reset-actor';
function findCell(s,id){for(const sec of E.openSectorList(s))for(let y=sec.sy*D.map.sectorSize;y<(sec.sy+1)*D.map.sectorSize;y++)for(let x=sec.sx*D.map.sectorSize;x<(sec.sx+1)*D.map.sectorSize;x++)if(E.canPlaceAt(s,id,'machine',x,y))return[x,y];return null;}
function dirtyState(){const s=E.createInitialState(),cell=findCell(s,'ironMine');assert(cell&&E.placeMachine(s,'ironMine',...cell));s.galaxy.reports.unshift({id:'old-report',title:'old',details:{category:'battle'}});s.coins=ctx.Axyon.EconomyNumber.safe(12345);return s;}

// Local command reset keeps exactly one pending reset command and no gameplay residue.
let local=dirtyState();const command=C.create('profile.reset',{theme:'dark'},{actorId:actor,state:local,sourceId:'reset-tab',sequence:7,commandId:'reset-command-1',issuedAt:Date.now(),expectedRevision:C.revision(local)});
let result=C.execute(local,command,{actorId:actor,economy:E,now:Date.now(),queueForServer:true});
assert(result.ok);assert.strictEqual(Object.keys(local.grid.entities).length,0);assert.strictEqual(E.machineCountTotal(local),0);assert.strictEqual(local.galaxy.reports.length,0);assert.strictEqual(local.galaxy.nextRaidAt,0);assert.strictEqual(E.starterFreeRemaining(local,'ironMine'),1);
let diag=C.diagnostics(local);assert.strictEqual(diag.pending,1);assert.strictEqual(local.commandRuntime.outbox[0].type,'profile.reset');
result=C.execute(local,command,{actorId:actor,economy:E,now:Date.now(),queueForServer:true});assert(result.duplicate);assert.strictEqual(C.diagnostics(local).pending,1);

// Authoritative reset can be safely retried with a refreshed CAS revision.
(async()=>{
  const service=new AuthorityService({runtime:ctx.Axyon});
  service.seedActor(actor,dirtyState(),5);
  const stale={...command,expectedRevision:0};
  let response=await service.execute(actor,stale);assert.strictEqual(response.code,'stale_revision');assert.strictEqual(service.snapshot(actor).serverRevision,5);
  const retried={...stale,expectedRevision:5};
  response=await service.execute(actor,retried);assert(response.ok&&!response.duplicate);let snap=service.snapshot(actor);assert.strictEqual(snap.serverRevision,6);assert.strictEqual(Object.keys(snap.state.grid.entities).length,0);assert.strictEqual(E.machineCountTotal(snap.state),0);assert.strictEqual(snap.state.galaxy.nextRaidAt,0);
  response=await service.execute(actor,retried);assert(response.ok&&response.duplicate);snap=service.snapshot(actor);assert.strictEqual(snap.serverRevision,6);
  console.log('PASS U4.3.1 authoritative reset: empty local state, single pending reset, stale-CAS refresh and duplicate-safe server commit');
})().catch(e=>{console.error(e);process.exitCode=1;});
