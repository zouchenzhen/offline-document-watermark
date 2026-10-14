import test from 'node:test';
import assert from 'node:assert/strict';
import {
 PREFERENCES_SCHEMA_VERSION,PREFERENCES_STORAGE_KEY,PREFERENCES_HISTORY_LIMIT,PREFERENCES_FIELDS,
 sanitizePreferences,summarizePreferences,readPreferences,writePreferences,clearPreferences,
} from '../src/preferences.mjs';

function memoryStorage(initial=null){
 const values=new Map(initial===null?[]:[[PREFERENCES_STORAGE_KEY,initial]]);
 return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
}
const complete={
 mode:'add',text:'仅供示例审核\n其他用途无效',density:3.5,opacity:42,size:23,angle:-24,color:'#34475d',
 scope:'custom',rx:10,ry:10,rw:80,rh:80,dpi:300,longSide:2400,quality:92,hiddenMark:true,metadata:true,timePrefix:false,
};
const clock=n=>'2026-10-14T10:00:'+String(n).padStart(2,'0')+'.000Z';

test('fresh storage remembers by default without inventing a configuration',()=>{
 assert.deepEqual(readPreferences(memoryStorage()),{enabled:true,latest:null,history:[],error:null});
 assert.equal(PREFERENCES_SCHEMA_VERSION,1);assert.equal(PREFERENCES_HISTORY_LIMIT,10);
});
test('the persistence whitelist excludes material data and all trace/verification records',()=>{
 const forbidden={fileBytes:'FORBIDDEN_MATERIAL',filename:'FORBIDDEN_FILENAME',trace:'FORBIDDEN_TRACE',traceId:'FORBIDDEN_TRACE_ID',verification:'FORBIDDEN_VERIFY',records:[{receiver:'FORBIDDEN_RECEIVER'}],sources:'FORBIDDEN_SOURCES'};
 assert.deepEqual(sanitizePreferences({...complete,...forbidden}),complete);assert.deepEqual(Object.keys(complete),PREFERENCES_FIELDS);
 const storage=memoryStorage(),result=writePreferences(storage,{...complete,...forbidden},{now:clock(0)});assert(result.saved);
 const raw=storage.values.get(PREFERENCES_STORAGE_KEY);for(const secret of Object.values(forbidden).filter(v=>typeof v==='string'))assert(!raw.includes(secret));assert(!raw.includes('FORBIDDEN_RECEIVER'));
 const payload=JSON.parse(raw);assert.deepEqual(Object.keys(payload),['schema','enabled','latest','history']);assert.deepEqual(Object.keys(payload.history[0]),['time','config']);
});
test('settings validation is strict about types, values, ranges and allowed increments',()=>{
 for(const config of [{density:NaN},{density:1.1},{opacity:'42'},{opacity:86},{size:13},{angle:61},{color:'url(https://invalid)'},{color:'#abcd'},{mode:'other'},{scope:'outside'},{dpi:600},{longSide:8000},{quality:99},{hiddenMark:'true'},{metadata:1},{timePrefix:'false'},{text:'x'.repeat(241)}])assert.equal(sanitizePreferences(config),null);
 assert.deepEqual(sanitizePreferences({density:1,opacity:15,size:14,angle:-60,color:'#ABCDEF',dpi:150,longSide:0,quality:60,hiddenMark:false,metadata:false,timePrefix:true}),{density:1,opacity:15,size:14,angle:-60,color:'#abcdef',dpi:150,longSide:0,quality:60,hiddenMark:false,metadata:false,timePrefix:true});
 assert.equal(sanitizePreferences(null),null);assert.equal(sanitizePreferences([]),null);assert.equal(sanitizePreferences({traceId:'1234567890ABCDEF'}),null);
});
test('an invalid custom rectangle is refused while flatten can preserve unused coverage settings',()=>{
 assert.equal(sanitizePreferences({...complete,rx:30,rw:80}),null);assert.equal(sanitizePreferences({scope:'custom',rx:10}),null);
 assert.deepEqual(sanitizePreferences({...complete,mode:'flatten',rx:30,rw:80}),{...complete,mode:'flatten',rx:30,rw:80});
});
test('latest configuration round-trips including empty text and the time-prefix switch',()=>{
 const storage=memoryStorage(),config={...complete,mode:'flatten',text:'',timePrefix:true};const result=writePreferences(storage,config,{now:clock(0)});
 assert(result.saved);assert.deepEqual(readPreferences(storage).latest,config);assert.deepEqual(readPreferences(storage).history[0].config,config);assert.equal(result.history[0].time,clock(0));
});
test('equivalent settings do not create duplicate snapshots or refresh an unchanged snapshot time',()=>{
 const storage=memoryStorage();writePreferences(storage,{...complete,text:'  示例\r\n用途  ',color:'#ABCDEF'},{now:clock(0)});
 const result=writePreferences(storage,{...complete,text:'示例\n用途',color:'#abcdef'},{now:clock(1)});assert.equal(result.history.length,1);assert.equal(result.history[0].time,clock(0));
});
test('returning to an earlier snapshot makes it latest and removes its earlier duplicate',()=>{
 const storage=memoryStorage();writePreferences(storage,{text:'A'},{now:clock(0)});writePreferences(storage,{text:'B'},{now:clock(1)});
 const result=writePreferences(storage,{text:'A'},{now:clock(2)});assert.equal(result.history.length,2);assert.equal(result.history[0].config.text,'A');assert.equal(result.history[0].time,clock(2));assert.equal(result.history[1].config.text,'B');assert.equal(result.latest.text,'A');
});
test('history contains at most the ten latest meaningful configurations',()=>{
 const storage=memoryStorage();for(let i=0;i<13;i++)writePreferences(storage,{text:'Snapshot '+i,density:3},{now:clock(i)});
 const state=readPreferences(storage);assert.equal(state.history.length,10);assert.equal(state.latest.text,'Snapshot 12');assert.equal(state.history[9].config.text,'Snapshot 3');assert.equal(new Set(state.history.map(e=>e.id)).size,10);
});
test('clear keeps only a disabled flag and a reload does not silently enable remembering',()=>{
 const storage=memoryStorage();writePreferences(storage,complete,{now:clock(0)});const result=clearPreferences(storage);assert(result.cleared);
 assert.deepEqual(JSON.parse(storage.values.get(PREFERENCES_STORAGE_KEY)),{schema:1,enabled:false});assert.deepEqual(readPreferences(storage),{enabled:false,latest:null,history:[],error:null});assert.equal(storage.values.size,1);
 writePreferences(storage,{text:'Explicitly enabled again'},{now:clock(1)});assert.equal(readPreferences(storage).enabled,true);assert.equal(readPreferences(storage).history.length,1);
});
test('malformed, unsupported and oversized storage never crashes the tool',()=>{
 for(const raw of ['{broken','null','[]',JSON.stringify({schema:2,enabled:true,latest:complete}),JSON.stringify({schema:1,enabled:'true'}),' '.repeat(128*1024+1)]){
  const state=readPreferences(memoryStorage(raw));assert.equal(state.enabled,true);assert.equal(state.latest,null);assert.deepEqual(state.history,[]);assert.equal(typeof state.error,'string');
 }
 const storage=memoryStorage('{broken');assert(writePreferences(storage,complete,{now:clock(0)}).saved);assert.equal(readPreferences(storage).error,null);
});
test('permission and quota failures are reported without claiming a save or clear succeeded',()=>{
 assert.equal(readPreferences(null).enabled,true);assert.equal(writePreferences(null,complete).saved,false);assert.equal(clearPreferences(null).cleared,false);
 const denied={getItem(){throw Error('Denied');},setItem(){throw Error('Denied');}};assert(readPreferences(denied).error);assert.equal(writePreferences(denied,complete).saved,false);assert.equal(clearPreferences(denied).cleared,false);
 const storage=memoryStorage();writePreferences(storage,{text:'Prior'},{now:clock(0)});storage.setItem=()=>{throw Error('QuotaExceededError');};const failed=writePreferences(storage,{text:'Not persisted'},{now:clock(1)});assert.equal(failed.saved,false);assert.equal(failed.latest.text,'Prior');assert.equal(readPreferences(storage).latest.text,'Prior');
});
test('read discards invalid history, deduplicates snapshots, and can recover a damaged latest entry',()=>{
 const storage=memoryStorage(JSON.stringify({schema:1,enabled:true,latest:{traceId:'FORBIDDEN'},history:[
  {time:clock(1),config:{text:'A',trace:'FORBIDDEN'}},{time:clock(2),config:{text:'A'}},{time:'not a date',config:{text:'Bad'}},{time:clock(0),config:{angle:200}},{time:clock(0),config:{text:'B'}},
 ]}));
 const state=readPreferences(storage);assert.equal(state.latest.text,'A');assert.equal(state.history.length,2);assert.equal(state.history[0].time,clock(2));assert.deepEqual(state.history[0].config,{text:'A'});
});
test('summaries are short plain strings, not interpreted markup or persisted redundant data',()=>{
 const config={mode:'flatten',density:3,quality:92,text:'<img src=x>\n'+'用途'.repeat(30)};const summary=summarizePreferences(config);assert(summary.startsWith('原页转图片 · 密度 3 · 质量 92% · <img src=x> '));assert(summary.endsWith('…'));assert(!summary.includes('\n'));
 const storage=memoryStorage();writePreferences(storage,config,{now:clock(0)});assert(!storage.values.get(PREFERENCES_STORAGE_KEY).includes('summary'));assert.equal(summarizePreferences({traceId:'FORBIDDEN'}),'无有效配置');
});
test('untrusted prototype keys and getters cannot enter the serialized configuration',()=>{
 const input=JSON.parse('{"text":"Example","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"traceId":"FORBIDDEN"}');assert.deepEqual(sanitizePreferences(input),{text:'Example'});assert.equal(Object.prototype.polluted,undefined);
 const throwing={density:3};Object.defineProperty(throwing,'text',{get(){throw Error('Getter failed');}});assert.deepEqual(sanitizePreferences(throwing),{density:3});
});
test('invalid clocks and invalid configurations leave the last saved state unchanged',()=>{
 const storage=memoryStorage();writePreferences(storage,{text:'Prior'},{now:new Date(clock(0))});for(const now of ['invalid','12',null,0])assert.equal(writePreferences(storage,{text:'Later'},{now}).saved,false);assert.equal(writePreferences(storage,{density:0},{now:clock(1)}).saved,false);assert.equal(readPreferences(storage).latest.text,'Prior');
});
