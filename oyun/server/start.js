'use strict';
const path=require('path');
const {createHttpServer}=require('./http-server');
const {AuthorityService}=require('./authority-service');
const {createRuntime,cloneState}=require('./runtime-factory');
const {SqliteAuthorityRepository}=require('./sqlite-authority-repository');
const port=Math.max(1,Math.min(65535,Number(process.env.PORT)||8787));
const runtime=createRuntime();
const database=path.resolve(process.env.AXYON_AUTH_DB||path.join(__dirname,'..','server-data','authority.sqlite'));
const repository=new SqliteAuthorityRepository({filename:database,cloneState:s=>cloneState(runtime,s)});
const service=new AuthorityService({runtime,repository});
const allowedOrigins=String(process.env.AXYON_ALLOWED_ORIGINS||'http://localhost,http://127.0.0.1').split(',').map(x=>x.trim()).filter(Boolean);
const app=createHttpServer({service,allowSeed:process.env.AXYON_ALLOW_SEED==='1',allowedOrigins});
app.listen(port,'0.0.0.0').then(addr=>console.log(`AXYON authority U4.3 listening on http://0.0.0.0:${addr.port} · ${database}`)).catch(error=>{console.error(error);process.exitCode=1;});
async function shutdown(){await app.close();repository.close();process.exit(0);}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>shutdown().catch(()=>process.exit(1)));
