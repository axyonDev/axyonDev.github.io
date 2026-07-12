'use strict';
const assert=require('assert');
const fs=require('fs');
const {loadRuntime}=require('./runtime-loader');
const ctx=loadRuntime();
const {Economy:E,Data:D}=ctx.Axyon;
const findCell=(s,id,type='machine')=>{for(const sec of E.openSectorList(s))for(let y=sec.sy*D.map.sectorSize;y<(sec.sy+1)*D.map.sectorSize;y++)for(let x=sec.sx*D.map.sectorSize;x<(sec.sx+1)*D.map.sectorSize;x++)if(E.canPlaceAt(s,id,type,x,y))return[x,y];return null;};

// Early factory building must not arm ground attacks before the first defense technology.
const s=E.createInitialState();
const cell=findCell(s,'ironMine');assert(cell&&E.placeMachine(s,'ironMine',...cell));
assert.strictEqual(E.groundThreatUnlocked(s),false);
assert.strictEqual(s.galaxy.nextRaidAt,0);
s.galaxy.nextRaidAt=Date.now()-1;E.tick(s,.1,Date.now());
assert.strictEqual(s.stats.raidsWon+s.stats.raidsLost,0);
assert.strictEqual(s.galaxy.nextRaidAt,0);

// The first real defense technology activates the groundfront.
s.researched.defenseGrid=true;E.initializeThreatState(s,Date.now());
assert.strictEqual(E.groundThreatUnlocked(s),true);
assert(s.galaxy.nextRaidAt>Date.now());
assert(s.galaxy.reports.some(r=>r.details?.technology==='defenseGrid'));

// UI contracts: readable icon+text requirements and live collapsible status drawer.
const html=fs.readFileSync('index.html','utf8'),ui=fs.readFileSync('src/ui/ui.js','utf8'),css=fs.readFileSync('css/style.css','utf8'),main=fs.readFileSync('src/main.js','utf8');
for(const id of ['fx-status-toggle','fx-status-panel','fx-status-summary','fx-status-list','fx-status-close'])assert(html.includes(`id="${id}"`),`missing ${id}`);
assert(/aria-controls="fx-status-panel"/.test(html));
assert(ui.includes('fmtCostDetailed')&&ui.includes('pi-req')&&ui.includes('renderFactoryStatus'));
assert(ui.includes("D.items[k]?.name")&&ui.includes('Çevrim:')&&ui.includes('Enerji:'));
assert(css.includes('.fx-status-panel')&&css.includes('.factory-status-row')&&css.includes('.pi-requirements'));
assert(main.includes("fx-status-toggle")&&main.includes("aria-expanded"));

console.log('PASS U4.3.3 factory intelligence: readable palette requirements, defense-gated groundfront and live power/production drawer');
