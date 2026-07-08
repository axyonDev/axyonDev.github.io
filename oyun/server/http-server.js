'use strict';
const http=require('http');
const {URL}=require('url');
const {AuthorityService}=require('./authority-service');
function json(res,status,body){const text=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(text),'cache-control':'no-store'});res.end(text);}
async function readJson(req,maxBytes=65536){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',c=>{size+=c.length;if(size>maxBytes){reject(Object.assign(new Error('payload_too_large'),{status:413}));req.destroy();return;}chunks.push(c);});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'));}catch(_){reject(Object.assign(new Error('invalid_json'),{status:400}));}});req.on('error',reject);});}
class FixedWindowRateLimiter{
  constructor({limit=120,windowMs=60000,now=()=>Date.now()}={}){this.limit=limit;this.windowMs=windowMs;this.now=now;this.rows=new Map();}
  take(key){const at=this.now(),row=this.rows.get(key);if(!row||at-row.start>=this.windowMs){this.rows.set(key,{start:at,count:1});return{ok:true,remaining:this.limit-1};}row.count++;return{ok:row.count<=this.limit,remaining:Math.max(0,this.limit-row.count),retryAfterMs:Math.max(0,row.start+this.windowMs-at)};}
}
function createHttpServer(options={}){
  const service=options.service||new AuthorityService(),limiter=options.limiter||new FixedWindowRateLimiter(options.rateLimit),allowSeed=!!options.allowSeed,allowedOrigins=new Set(options.allowedOrigins||[]);
  function cors(req,res){const origin=String(req.headers.origin||'');if(allowedOrigins.has('*'))res.setHeader('access-control-allow-origin','*');else if(origin&&allowedOrigins.has(origin)){res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','Origin');}res.setHeader('access-control-allow-headers','content-type,x-axyon-actor');res.setHeader('access-control-allow-methods','GET,POST,OPTIONS');}
  const server=http.createServer(async(req,res)=>{
    try{
      cors(req,res);if(req.method==='OPTIONS'){res.writeHead(204,{'cache-control':'no-store'});return res.end();}
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'axyon-authority',version:'4.5.5-u4.3.2',diagnostics:service.diagnostics()});
      const match=url.pathname.match(/^\/v1\/actors\/([^/]+)\/(commands|snapshot|seed)$/);if(!match)return json(res,404,{ok:false,code:'not_found'});
      const actorId=decodeURIComponent(match[1]),action=match[2],auth=String(req.headers['x-axyon-actor']||'');
      if(auth!==actorId)return json(res,403,{ok:false,code:'actor_mismatch'});
      const rate=limiter.take(actorId);if(!rate.ok){res.setHeader('retry-after',String(Math.ceil(rate.retryAfterMs/1000)));return json(res,429,{ok:false,code:'rate_limited'});}
      if(req.method==='GET'&&action==='snapshot'){const snap=service.snapshot(actorId);return snap?json(res,200,{ok:true,snapshot:snap}):json(res,404,{ok:false,code:'actor_not_found'});}
      if(req.method==='POST'&&action==='seed'&&allowSeed){const body=await readJson(req);return json(res,201,{ok:true,snapshot:service.seedActor(actorId,body.state,body.revision||0)});}
      if(req.method==='POST'&&action==='commands'){const body=await readJson(req),result=await service.execute(actorId,body.command||body);return json(res,result.httpStatus||500,result);}
      return json(res,405,{ok:false,code:'method_not_allowed'});
    }catch(error){return json(res,error.status||500,{ok:false,code:error.message||'internal_error'});}
  });
  return{server,service,limiter,listen:(port=0,host='127.0.0.1')=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server.address()));}),close:()=>new Promise(resolve=>server.close(()=>resolve()))};
}
module.exports={FixedWindowRateLimiter,createHttpServer};
