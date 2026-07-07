'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const CORE_SCRIPTS=[
  'data/feature-flags.js',
  'vendor/break_eternity/break_eternity.min.js',
  'src/core/economy-number.js',
  'src/core/lossless-json.js',
  'src/services/save-migrator-v16.js',
  'data/canonical/game-data.v4.4.final.js',
  'src/core/canonical-data-loader.js',
  'src/core/numbers.js',
  'data/config.js',
  'data/u2-first-orbit-data.js',
  'data/u3-planetary-bastions-data.js',
  'src/core/economy.js',
  'src/core/u2-first-orbit-runtime.js',
  'src/core/u3-planetary-bastions-runtime.js',
  'src/core/quests.js'
];
function memoryStorage(){
  const store=new Map();
  return{
    _store:store,
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k),
    clear:()=>store.clear(),
    key:i=>[...store.keys()][i]??null,
    get length(){return store.size;}
  };
}
function loadRuntime(options={}){
  const ctx={
    console,
    Date:options.Date||Date,
    Math:options.Math||Math,
    setTimeout,clearTimeout,
    localStorage:options.localStorage,
    btoa:s=>Buffer.from(s,'binary').toString('base64'),
    atob:s=>Buffer.from(s,'base64').toString('binary'),
    alert:()=>{}
  };
  ctx.globalThis=ctx;
  vm.createContext(ctx);
  const scripts=[...CORE_SCRIPTS];
  if(options.saveService)scripts.push('src/services/save-service.js');
  for(const file of scripts)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  return ctx;
}
function decimalToString(ctx,value){return ctx.Axyon.EconomyNumber.toStorage(value);}
function decimalEq(ctx,a,b){return ctx.Axyon.EconomyNumber.eq(a,b);}
function fillEconomy(ctx,state,value='1e12'){
  const {Data:D,EconomyNumber:EN}=ctx.Axyon;
  state.coins=EN.safe(value);state.totalEarned=EN.safe(0);state.runEarned=EN.safe(0);state.topScore=EN.safe(0);
  for(const k of Object.keys(D.items))state.inventory[k]=EN.safe(value);
}
module.exports={root,CORE_SCRIPTS,memoryStorage,loadRuntime,decimalToString,decimalEq,fillEconomy};
