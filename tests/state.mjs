import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

const sqlite=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const DB={
 prepare(sql){
  return {bind(...args){
   return {
    async first(){return sqlite.prepare(sql).get(...args)},
    async all(){return {results:sqlite.prepare(sql).all(...args)}},
    async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}}
   };
  }};
 },
 async batch(statements){return Promise.all(statements.map(statement=>statement.run()))}
};
globalThis.testEnv={DB};
async function load(file){
 const source=fs.readFileSync(file,'utf8').replace(/import \{\s*env\s*\} from ['"]cloudflare:workers['"];?/,'const env=globalThis.testEnv;');
 return import('data:text/javascript;base64,'+Buffer.from(ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext})).toString('base64'));
}
const api=await load('app/api/state/route.ts');
const seen=await load('app/api/seen/route.ts');
const origin='https://example.test';
const get=async()=> (await api.GET(new Request(origin+'/api/state?controller=1'))).json();
const post=async(body,from=origin)=>api.POST(new Request(origin+'/api/state',{method:'POST',headers:{origin:from,'content-type':'application/json'},body:JSON.stringify(body)}));
const roster=[51,52,53,54,55,56,57,59,60];

let state=await get();
assert.equal(state.revision,0);assert.deepEqual(state.calls,[]);
const first={action:'call',bus:51,day:state.day,revision:0,id:'call-51'};
assert.equal((await post(first,'https://other.test')).status,403);
assert.equal((await post({...first,bus:58})).status,400);
assert.equal((await post(first)).status,200);
state=await get();assert.equal(state.calls.length,1);assert.equal(state.calls[0].bus,51);
assert.equal((await post(first)).status,200);assert.equal((await get()).calls.length,1);
assert.equal((await post({...first,id:'repeat-51',revision:1})).status,409);
assert.equal((await post({action:'undo',day:state.day,revision:1,id:'no-undo'})).status,400);
assert.equal((await post({action:'reset',day:state.day,revision:1,id:'too-soon'})).status,409);
assert.equal((await post({...first,bus:52,id:'stale',revision:0})).status,409);
assert.equal((await seen.POST(new Request(origin+'/api/seen',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({id:'screen-one',day:state.day,revision:1})}))).status,204);
assert.equal((await get()).screens[0].revision,1);

state=await get();
for(const bus of roster.slice(1)){
 const result=await post({action:'call',bus,day:state.day,revision:state.revision,id:'call-'+bus});
 assert.equal(result.status,200);state=await get();
}
assert.equal(state.calls.length,9);assert.deepEqual(new Set(state.calls.map(call=>call.bus)),new Set(roster));
assert.equal((await post({action:'call',bus:50,day:state.day,revision:state.revision,id:'old-demo'})).status,400);
const reset=await post({action:'reset',day:state.day,revision:state.revision,id:'complete-reset'});
assert.equal(reset.status,200);state=await get();assert.deepEqual(state.calls,[]);

const concurrent=await Promise.all([
 post({action:'call',bus:51,day:state.day,revision:state.revision,id:'parallel-a'}),
 post({action:'call',bus:52,day:state.day,revision:state.revision,id:'parallel-b'})
]);
assert.deepEqual(concurrent.map(result=>result.status).sort(),[200,409]);
state=await get();
assert.equal((await post({action:'call',bus:53,day:'1999-01-01',revision:state.revision,id:'wrong-day'})).status,409);
console.log('Passed: locked calls, no undo, complete-only reset, all nine buses, acknowledgements, conflicts, origin protection, and day rollover.');
