'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const SCRIPTS=[
  'data/feature-flags.js','vendor/break_eternity/break_eternity.min.js','src/core/economy-number.js','src/core/lossless-json.js','src/services/save-migrator-v16.js',
  'data/canonical/game-data.v4.4.final.js','src/core/canonical-data-loader.js','src/core/numbers.js','data/config.js','data/u2-first-orbit-data.js','data/u3-planetary-bastions-data.js',
  'src/core/economy.js','src/core/u2-first-orbit-runtime.js','src/core/u3-planetary-bastions-runtime.js','src/core/gameplay-phase-runtime.js','src/core/quests.js','src/core/domain-command.js','src/core/server-time.js'
];
function createRuntime(options={}){
  const ctx={console:options.console||console,Date:options.Date||Date,Math,setTimeout,clearTimeout};
  ctx.globalThis=ctx;vm.createContext(ctx);
  for(const rel of SCRIPTS)vm.runInContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),ctx,{filename:rel});
  const A=ctx.Axyon;
  if(!A?.Economy||!A?.DomainCommand)throw new Error('Authoritative runtime failed to load');
  return A;
}
function cloneState(A,state){
  const raw=JSON.parse(JSON.stringify(state));
  return A.Economy.normalizeState(raw);
}
module.exports={ROOT,SCRIPTS,createRuntime,cloneState};
