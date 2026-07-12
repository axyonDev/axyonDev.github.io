'use strict';
const {parentPort,workerData}=require('worker_threads');
const {createRuntime,cloneState}=require('../../server/runtime-factory');
const {SqliteAuthorityRepository}=require('../../server/sqlite-authority-repository');
const {AuthorityService}=require('../../server/authority-service');
(async()=>{const runtime=createRuntime(),repository=new SqliteAuthorityRepository({filename:workerData.db,cloneState:s=>cloneState(runtime,s),busyTimeoutMs:10000}),service=new AuthorityService({runtime,repository});try{const result=await service.execute(workerData.actor,workerData.command);parentPort.postMessage({ok:true,result});}catch(error){parentPort.postMessage({ok:false,error:error.message});}finally{repository.close();}})();
