'use strict';
const assert=require('assert');
const {loadRuntime,memoryStorage}=require('./runtime-loader');

const schema=require('../data/canonical/save-state-v16.schema.json');
assert.strictEqual(schema.properties.flow.$ref,'#/$defs/signedEconomyMap','canonical v16 schema does not declare signed flow');
assert(schema.$defs.signedEconomyMap,'signed flow schema definition missing');

const storage=memoryStorage();
const ctx=loadRuntime({localStorage:storage,saveService:true});
const {Economy:E,EconomyNumber:EN,SaveService:S,SaveMigratorV16:M}=ctx.Axyon;

const state=E.createInitialState();
assert(S.createProfile('Signed Flow',state).ok,'profile creation failed');
state.flow.ironPlate=EN.signed('-12.5');
state.flow.copperWire=EN.signed('3.75');
assert.strictEqual(S.save(state),true,'signed flow save failed');
const raw=JSON.parse(S.rawActiveSave());
assert.strictEqual(raw.flow.ironPlate,'-12.5','negative flow was not persisted exactly');
assert.strictEqual(raw.flow.copperWire,'3.75','positive flow was not persisted exactly');
assert.doesNotThrow(()=>M.validateV16(raw),'v16 validator rejected signed flow');
const loaded=S.load();
assert(EN.fromStorageSigned('-12.5').eq(loaded.flow.ironPlate),'negative flow did not round-trip');
assert(EN.fromStorageSigned('3.75').eq(loaded.flow.copperWire),'positive flow did not round-trip');
assert.strictEqual(M.preserveSignedEconomyLiteral('-3.25'),'-3.25','legacy signed flow literal was not preserved');
assert.strictEqual(EN.isValidSignedStorage('-1e9'),true,'signed storage validator rejected valid negative value');
assert.strictEqual(EN.isValidStorage('-1'),false,'unsigned validator accepted negative value');
console.log('PASS u4-3-signed-flow-save: negative and positive flow values validate, persist and reload losslessly');
