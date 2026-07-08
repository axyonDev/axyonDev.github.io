'use strict';
const assert=require('assert');
const {AuthorityService}=require('../server/authority-service');
const {createHttpServer}=require('../server/http-server');
function richState(service){const {Economy:E,EconomyNumber:EN,Data:D}=service.A,s=E.createInitialState();s.coins=EN.safe('1e40');for(const k of Object.keys(D.items))s.inventory[k]=EN.safe('1e40');for(const t of D.research)s.researched[t.id]=true;s.market.creditEconomyUnlocked=true;s.market.legacyAccess=true;return s;}
(async()=>{
  const service=new AuthorityService();service.seedActor('http-pilot',richState(service),0);
  const app=createHttpServer({service,rateLimit:{limit:20,windowMs:60000}}),addr=await app.listen(0),base=`http://127.0.0.1:${addr.port}`;
  try{
    const C=service.A.DomainCommand,cmd=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:1},{actorId:'http-pilot',sourceId:'http-tab',sequence:1,expectedRevision:0,issuedAt:Date.now(),commandId:'http-concurrent-1'});
    const post=()=>fetch(`${base}/v1/actors/http-pilot/commands`,{method:'POST',headers:{'content-type':'application/json','x-axyon-actor':'http-pilot'},body:JSON.stringify({command:cmd})}).then(async r=>({status:r.status,body:await r.json()}));
    const pair=await Promise.all([post(),post()]);assert(pair.every(x=>x.status===200));assert.strictEqual(pair.filter(x=>x.body.duplicate).length,1);assert.strictEqual(pair.filter(x=>x.body.ok&&!x.body.duplicate).length,1);
    const snapResponse=await fetch(`${base}/v1/actors/http-pilot/snapshot`,{headers:{'x-axyon-actor':'http-pilot'}});assert.strictEqual(snapResponse.status,200);const snap=(await snapResponse.json()).snapshot;assert.strictEqual(snap.serverRevision,1);assert.strictEqual(snap.state.galaxy.shipQueue.length,1);
    const badActor=await fetch(`${base}/v1/actors/http-pilot/snapshot`,{headers:{'x-axyon-actor':'someone-else'}});assert.strictEqual(badActor.status,403);
    const badJson=await fetch(`${base}/v1/actors/http-pilot/commands`,{method:'POST',headers:{'content-type':'application/json','x-axyon-actor':'http-pilot'},body:'{bad'});assert.strictEqual(badJson.status,400);
    const health=await fetch(`${base}/health`);assert.strictEqual(health.status,200);assert.strictEqual((await health.json()).version,'4.5.5-u4.3.2');
  }finally{await app.close();}

  // Separate small-limit server proves gateway backpressure.
  const limitedService=new AuthorityService();limitedService.seedActor('limited',richState(limitedService),0);const limited=createHttpServer({service:limitedService,rateLimit:{limit:2,windowMs:60000}}),limitedAddr=await limited.listen(0),limitedBase=`http://127.0.0.1:${limitedAddr.port}`;
  try{const headers={'x-axyon-actor':'limited'};assert.strictEqual((await fetch(`${limitedBase}/v1/actors/limited/snapshot`,{headers})).status,200);assert.strictEqual((await fetch(`${limitedBase}/v1/actors/limited/snapshot`,{headers})).status,200);assert.strictEqual((await fetch(`${limitedBase}/v1/actors/limited/snapshot`,{headers})).status,429);}finally{await limited.close();}
  console.log('PASS u4-2-http-concurrency: real HTTP duplicate race, snapshot, actor auth, JSON rejection, health and rate limit');
})().catch(error=>{console.error(error);process.exit(1);});
