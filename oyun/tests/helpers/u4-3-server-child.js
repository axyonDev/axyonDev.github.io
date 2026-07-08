'use strict';
const path=require('path');
const {createRuntime,cloneState}=require('../../server/runtime-factory');
const {SqliteAuthorityRepository}=require('../../server/sqlite-authority-repository');
const {AuthorityService}=require('../../server/authority-service');
const {createHttpServer}=require('../../server/http-server');
(async()=>{
  const runtime=createRuntime(),repository=new SqliteAuthorityRepository({filename:path.resolve(process.env.AXYON_AUTH_DB),cloneState:s=>cloneState(runtime,s)}),service=new AuthorityService({runtime,repository}),app=createHttpServer({service,allowSeed:true,allowedOrigins:['*'],rateLimit:{limit:10000,windowMs:60000}}),address=await app.listen(0);
  if(process.send)process.send({type:'ready',port:address.port});else console.log(JSON.stringify({type:'ready',port:address.port}));
  async function stop(){await app.close();repository.close();process.exit(0);}
  process.on('message',m=>{if(m==='stop')stop();});process.on('SIGTERM',stop);process.on('SIGINT',stop);
})().catch(error=>{console.error(error);process.exit(1);});
