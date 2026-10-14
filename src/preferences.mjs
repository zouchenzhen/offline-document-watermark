// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
// Optional browser-local UI preferences. Material bytes and trace records are
// deliberately absent from this whitelist and from the storage envelope.
export const PREFERENCES_SCHEMA_VERSION=1;
export const PREFERENCES_STORAGE_KEY='offline-document-watermark.preferences.v1';
export const PREFERENCES_HISTORY_LIMIT=10;
export const PREFERENCES_FIELDS=Object.freeze([
 'mode','text','density','opacity','size','angle','color','scope','rx','ry','rw','rh',
 'dpi','longSide','quality','hiddenMark','metadata','timePrefix',
]);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const numberRules={
 density:[1,8,.5],opacity:[15,85,1],size:[14,40,1],angle:[-60,60,1],
 rx:[0,99,1],ry:[0,99,1],rw:[1,100,1],rh:[1,100,1],quality:[60,98,1],
};
const enumRules={mode:['add','flatten'],scope:['all','top','bottom','custom'],dpi:[150,200,300,400],longSide:[0,1600,2400,3200]};
const booleanFields=new Set(['hiddenMark','metadata','timePrefix']);
const emptyState=error=>({enabled:true,latest:null,history:[],error:error??null});
const configKey=config=>JSON.stringify(config);

// Return only valid, explicitly supported UI fields. Missing fields stay
// missing so applying an old/partial preference cannot invent new settings.
export function sanitizePreferences(input){
 if(!isObject(input))return null;
 const config={};
 for(const field of PREFERENCES_FIELDS){
  if(!own(input,field))continue;
  let value;try{value=input[field];}catch{continue;}
  if(field==='text'){
   if(typeof value==='string'&&value.length<=240)config.text=value.replace(/\r\n?/g,'\n').trim();
  }else if(field==='color'){
   if(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))config.color=value.toLowerCase();
  }else if(booleanFields.has(field)){
   if(typeof value==='boolean')config[field]=value;
  }else if(own(enumRules,field)){
   if(enumRules[field].includes(value))config[field]=value;
  }else{
   const [min,max,step]=numberRules[field];
   if(typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max&&Number.isInteger((value-min)/step))config[field]=value;
  }
 }
 if(!Object.keys(config).length)return null;
 if(config.scope==='custom'&&config.mode!=='flatten'){
  if(!['rx','ry','rw','rh'].every(field=>own(config,field))||config.rx+config.rw>100||config.ry+config.rh>100)return null;
 }
 return config;
}

export function summarizePreferences(input){
 const config=sanitizePreferences(input);if(!config)return '无有效配置';
 const parts=[config.mode==='flatten'?'仅合成发送版':'用途水印'];
 if(own(config,'density'))parts.push('密度 '+config.density);
 if(own(config,'quality'))parts.push('质量 '+config.quality+'%');
 if(config.text){const text=config.text.replace(/\s+/g,' ');parts.push(text.slice(0,32)+(text.length>32?'…':''));}
 return parts.join(' · ');
}

function isoTime(value){
 try{
  if(!(value instanceof Date)&&(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)))return null;
  const date=value instanceof Date?value:new Date(value);return Number.isFinite(date.getTime())?date.toISOString():null;
 }catch{return null;}
}
function decorateHistory(history){
 return history.map((entry,index)=>({
  // IDs only identify an item in this returned list; they are not trace IDs.
  id:'cfg-'+entry.time+'-'+index,time:entry.time,config:entry.config,summary:summarizePreferences(entry.config),
 }));
}
function sanitizeHistory(value){
 if(!Array.isArray(value))return [];
 const history=[];
 for(const entry of value){
  if(!isObject(entry)||typeof entry.time!=='string')continue;
  const time=isoTime(entry.time),config=sanitizePreferences(entry.config);
  if(time&&config)history.push({time,config});
 }
 history.sort((a,b)=>b.time.localeCompare(a.time));
 const seen=new Set();return history.filter(entry=>{const key=configKey(entry.config);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,PREFERENCES_HISTORY_LIMIT);
}

export function readPreferences(storage){
 let raw;
 try{
  if(!storage||typeof storage.getItem!=='function')return emptyState('本机配置存储不可用。');
  raw=storage.getItem(PREFERENCES_STORAGE_KEY);
 }catch{return emptyState('浏览器不允许读取本机配置。');}
 if(raw===null||raw===undefined||raw==='')return emptyState();
 // A valid envelope is only a few KiB. Avoid processing arbitrary oversized
 // content written by another page on the same origin.
 if(typeof raw!=='string'||raw.length>128*1024)return emptyState('已忽略过大或无效的本机配置。');
 let value;try{value=JSON.parse(raw);}catch{return emptyState('已忽略损坏的本机配置。');}
 if(!isObject(value)||value.schema!==PREFERENCES_SCHEMA_VERSION||typeof value.enabled!=='boolean')return emptyState('已忽略不受支持的本机配置格式。');
 if(!value.enabled)return {enabled:false,latest:null,history:[],error:null};
 const history=sanitizeHistory(value.history),latest=sanitizePreferences(value.latest)||history[0]?.config||null;
 return {enabled:true,latest,history:decorateHistory(history),error:null};
}

export function writePreferences(storage,input,{now=new Date()}={}){
 const previous=readPreferences(storage),config=sanitizePreferences(input),time=isoTime(now);
 if(!config)return {...previous,saved:false,error:'当前配置无效，未写入本机历史。'};
 if(!time)return {...previous,saved:false,error:'配置保存时间无效，未写入本机历史。'};
 const key=configKey(config),sameLatest=previous.latest&&configKey(previous.latest)===key;
 const existing=previous.history.find(entry=>configKey(entry.config)===key);
 const first={time:sameLatest&&existing?existing.time:time,config};
 const history=[first,...previous.history.filter(entry=>configKey(entry.config)!==key).map(({time,config})=>({time,config}))].slice(0,PREFERENCES_HISTORY_LIMIT);
 const payload={schema:PREFERENCES_SCHEMA_VERSION,enabled:true,latest:config,history};
 try{
  if(!storage||typeof storage.setItem!=='function')throw Error('Storage unavailable');
  storage.setItem(PREFERENCES_STORAGE_KEY,JSON.stringify(payload));
 }catch{return {...previous,saved:false,error:'本机配置保存失败；可能没有存储权限或空间不足。'};}
 return {enabled:true,latest:config,history:decorateHistory(history),saved:true,error:null};
}

// Keep only the opt-out flag. No latest configuration, history, or note text
// survives a successful clear, and a reload cannot re-enable remembering.
export function clearPreferences(storage){
 const state={enabled:false,latest:null,history:[]};
 try{
  if(!storage||typeof storage.setItem!=='function')throw Error('Storage unavailable');
  storage.setItem(PREFERENCES_STORAGE_KEY,JSON.stringify({schema:PREFERENCES_SCHEMA_VERSION,enabled:false}));
 }catch{return {...state,cleared:false,error:'本机配置清除失败；浏览器可能不允许写入存储。'};}
 return {...state,cleared:true,error:null};
}
