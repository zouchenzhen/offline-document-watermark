import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createI18n,applyTranslations,MESSAGES} from '../src/i18n.mjs';
import * as preferences from '../src/preferences.mjs';
import * as core from '../src/core.mjs';
import {app,memoryStorage,pdfDoc,importPdf,deferred,png} from './helpers/app-harness.mjs';

const chinese=/[\u3400-\u9fff]/u;
const template=fs.readFileSync(new URL('../src/index.template.html',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
async function language(a,code){const button=a.get(code==='en'?'languageEn':'languageZh');assert.equal(typeof button.onclick,'function');await button.onclick();await Promise.resolve();await Promise.resolve();}
function english(value){assert(!chinese.test(value),`Unexpected Chinese UI text: ${value}`);}

test('translation catalog defaults to Chinese and covers every declared static/app key in English',()=>{
 const zh=createI18n(),en=createI18n('en');assert.equal(zh.language,'zh-CN');assert.equal(en.language,'en');
 assert(Object.keys(MESSAGES).length>30,'a small catalog cannot cover the complete UI');
 for(const [key,message]of Object.entries(MESSAGES)){assert.equal(typeof message['zh-CN'],'string');assert.equal(typeof message.en,'string');assert(message['zh-CN'].length&&message.en.length);const params=Object.fromEntries([...message.en.matchAll(/\{([\w]+)\}/g)].map(m=>[m[1],'ASCII_fixture']));const rendered=en.t(key,params);assert.equal(typeof rendered,'string');english(rendered);assert(!/\{[\w]+\}/.test(rendered));}
 const declared=[...template.matchAll(/data-i18n(?:-placeholder|-aria-label|-title)?="([^"]+)"/g),...source.matchAll(/\bt\(['"]([^'"]+)['"]/g)].map(m=>m[1]);
 assert(declared.length>30);for(const key of declared)assert(Object.hasOwn(MESSAGES,key),`Missing declared translation ${key}`);
 assert.throws(()=>en.t('not-a-real-translation-key'),RangeError);en.setLanguage('zh-CN');assert.equal(en.language,'zh-CN');
});
test('translation parameters are literal user data and never recursively rewritten or interpreted as HTML',()=>{
 const i18n=createI18n('en'),payload='</script><img src=x onerror=alert(1)> $& {version} 保留用户文案',key=Object.keys(MESSAGES).find(key=>MESSAGES[key].en.includes('{name}'));assert(key);
 const translated=i18n.t(key,{name:payload,version:'not-a-replacement'});assert(translated.includes(payload));assert(!translated.includes('not-a-replacement'));
 const node={textContent:'',getAttribute(name){return name==='data-i18n'?'header.badge':null;},setAttribute(){throw Error('Not expected');}},document={documentElement:{lang:''},title:'',querySelectorAll(selector){return selector==='[data-i18n]'?[node]:[];}};
 applyTranslations(document,i18n,{version:payload});assert(node.textContent.includes(payload));assert(document.title.includes(payload));assert.equal(node.innerHTML,undefined);assert.equal(document.documentElement.lang,'en');
 assert.equal(i18n.error('Unrecognized third-party detail '+payload),'Unrecognized third-party detail '+payload,'unknown error details stay verbatim instead of corrupting user data');
});
test('actual core validation failures have English equivalents, including numeric marker dimensions',()=>{
 const en=createI18n('en'),cases=[()=>core.normalizeTrace('bad'),()=>core.normalizeTrace('20260229T010203Z-12AB34CD56EF7890'),()=>core.makeTimestampedTrace('12AB34CD56EF7890',new Date(NaN)),()=>core.parsePages('3-1',2),()=>core.parsePages('word',2),()=>core.scaledSize(NaN,100),()=>core.addPngMetadata(new Uint8Array([0]),{}),()=>core.addJpegMetadata(new Uint8Array([0]),{}),()=>core.embedTrace({width:32,height:32,data:new Uint8ClampedArray(32*32*4)},'12AB34CD56EF7890')];
 for(const run of cases){let message;try{run();assert.fail('Fixture must fail validation');}catch(error){message=error.message;}assert(chinese.test(message));const translated=en.error(message);english(translated);assert(translated.length>8);}
});

test('English DOM translations cover static labels, placeholders, accessible names and example canvas',async()=>{
 const a=await app();assert.equal(a.document.documentElement.lang,'zh-CN');assert(a.translationNodes.length>30);a.counts.canvasTexts.length=0;await language(a,'en');assert.equal(a.document.documentElement.lang,'en');english(a.document.title);
 for(const node of a.translationNodes){if(node.getAttribute('data-i18n'))english(node.textContent);for(const [binding,target]of [['data-i18n-placeholder','placeholder'],['data-i18n-aria-label','aria-label'],['data-i18n-title','title']])if(node.getAttribute(binding))english(node.getAttribute(target)||node[target]||'');}
 assert(a.counts.canvasTexts.length>3,'the fictional example must be redrawn in English');for(const text of a.counts.canvasTexts)english(text);
 await language(a,'zh-CN');assert.equal(a.document.documentElement.lang,'zh-CN');assert(a.translationNodes.some(node=>chinese.test(node.textContent)));
});

test('language changes preserve custom watermark, material, selected page, trace, filename and settings',async()=>{
 const a=await app();await importPdf(a,pdfDoc({numPages:2}));a.get('next').onclick();await a.review.preview();const purpose='USER_PURPOSE_中文_<img src=x onerror=alert(1)>';a.get('text').value=purpose;a.get('pages').value='2';a.get('density').value='5';a.get('metadata').checked=true;const before=a.review.getState(),id=a.get('trace').value,filename=a.get('fileNames').textContent;
 await language(a,'en');const after=a.review.getState();assert.equal(after.pdfDoc,before.pdfDoc);assert.equal(after.total,2);assert.equal(after.current,1);assert.equal(a.get('trace').value,id);assert.equal(a.get('text').value,purpose);assert.equal(a.get('pages').value,'2');assert.equal(a.get('density').value,'5');assert.equal(a.get('metadata').checked,true);assert(a.get('fileNames').textContent.includes('fixture.pdf'));assert.equal(after.lastRecords.length,before.lastRecords.length);assert(filename.includes('fixture.pdf'));
 await language(a,'zh-CN');assert.equal(a.get('text').value,purpose);assert.equal(a.get('trace').value,id);assert.equal(a.review.getState().current,1);
});

test('English import, validation and known core errors use translated UI instead of leaking Chinese messages',async()=>{
 const a=await app();await language(a,'en');const input=a.get('file');input.files=[{name:'synthetic-too-large.pdf',type:'application/pdf',size:160*1024*1024+1}];await input.listeners.change({target:input});english(a.get('status').textContent);assert.match(a.get('status').textContent,/160/);
 await importPdf(a,pdfDoc({numPages:2}));a.get('pages').value='3-1';await a.review.exportFiles('pdf');english(a.get('status').textContent);assert.equal(a.saved.length,0);
 a.get('pages').value='';a.get('trace').value='bad';await a.review.exportFiles('png');english(a.get('status').textContent);assert.equal(a.saved.length,0);
 const b=await app({embedTrace(){throw Error('当前素材无法在画质限制内检出隐藏标记。请提高输出尺寸或关闭隐藏标记后重试。');}});await language(b,'en');b.get('hiddenMark').checked=true;await b.review.exportFiles('png');english(b.get('status').textContent);assert.equal(b.saved.length,0);
});
test('unknown third-party errors retain their details inside an English message framework',async()=>{
 const a=await app(),detail='THIRD_PARTY_DETAIL_第三方 <img src=x onerror=alert(1)>';await language(a,'en');a.review.setLibrary(Promise.resolve({lib:{getDocument(){return {promise:Promise.reject(Error(detail)),destroy:async()=>{}};}}}));const input=a.get('file');input.files=[{name:'synthetic-failing.pdf',type:'application/pdf',size:10,arrayBuffer:async()=>new ArrayBuffer(10)}];await input.listeners.change({target:input});const message=a.get('status').textContent;assert.match(message,/failed|error/i);assert(message.includes(detail));assert(!a.get('status').innerHTML?.includes(detail));assert.equal(a.review.getState().busy,false);
});

test('verification results rerender in English without reimporting or changing user metadata',async()=>{
 const a=await app(),meta={tool:'Offline Document Watermark',traceId:'12AB34CD56EF7890',watermark:'User-owned purpose'},bytes=core.addPngMetadata(png,meta),input=a.get('verifyFile');input.files=[{name:'synthetic-verification.png',type:'image/png',size:bytes.length,arrayBuffer:async()=>bytes.buffer}];await input.listeners.change({target:input});assert(chinese.test(a.get('verification').textContent));const decoded=a.counts.decoded;
 await language(a,'en');english(a.get('verification').textContent);assert(a.get('verification').textContent.includes(meta.traceId));assert(a.get('verification').textContent.includes(meta.watermark));assert(a.get('verifyName').textContent.includes('synthetic-verification.png'));assert.equal(a.counts.decoded,decoded,'switching language must not decode or reset verification');
 await language(a,'zh-CN');assert(chinese.test(a.get('verification').textContent));assert(a.get('verification').textContent.includes(meta.watermark));
});

test('language is a narrow preference and respects remember, history restore and clearing',async()=>{
 assert.deepEqual(preferences.sanitizePreferences({language:'en',traceId:'FORBIDDEN'}),{language:'en'});for(const language of ['en-US','fr','<script>',null,1])assert.equal(preferences.sanitizePreferences({language}),null);
 const storage=memoryStorage(),a=await app({storage});await language(a,'en');a.review.persistPreferences();assert.equal(preferences.readPreferences(storage).latest.language,'en');assert.equal((await app({storage})).document.documentElement.lang,'en');
 a.get('rememberConfig').checked=false;a.get('rememberConfig').listeners.change();await language(a,'zh-CN');await language(a,'en');a.review.persistPreferences();assert.equal(a.document.documentElement.lang,'en');assert.equal(preferences.readPreferences(storage).enabled,false);assert.equal((await app({storage})).document.documentElement.lang,'zh-CN');
 const remembered=memoryStorage();preferences.writePreferences(remembered,{language:'en',text:'History English note',density:3});preferences.writePreferences(remembered,{language:'zh-CN',text:'History Chinese note',density:4});const b=await app({storage:remembered}),entry=preferences.readPreferences(remembered).history.find(e=>e.config.language==='en');b.get('configHistory').value=entry.id;await b.get('restoreConfig').onclick();assert.equal(b.document.documentElement.lang,'en');assert.equal(b.get('text').value,'History English note');b.get('clearConfig').onclick();assert.equal((await app({storage:remembered})).document.documentElement.lang,'zh-CN');
});
test('historical language restore redraws the fictional canvas without replacing imported PDF materials',async()=>{
 const storage=memoryStorage(),purpose='CUSTOM_USER_TEXT_FIXED';preferences.writePreferences(storage,{language:'zh-CN',text:purpose,density:3},{now:'2026-10-15T01:00:00Z'});preferences.writePreferences(storage,{language:'en',text:purpose,density:4},{now:'2026-10-15T01:00:01Z'});const a=await app({storage}),chineseEntry=preferences.readPreferences(storage).history.find(entry=>entry.config.language==='zh-CN');assert.equal(a.document.documentElement.lang,'en');a.counts.canvasTexts.length=0;a.get('configHistory').value=chineseEntry.id;await a.get('restoreConfig').onclick();assert.equal(a.document.documentElement.lang,'zh-CN');assert(a.counts.canvasTexts.includes(createI18n('zh-CN').t('demo.title')));assert.equal(a.get('text').value,purpose);
 await importPdf(a,pdfDoc({numPages:2}));a.get('next').onclick();await a.review.preview();const material=a.review.getState().pdfDoc,id=a.get('trace').value,entry=preferences.readPreferences(storage).history.find(entry=>entry.config.language==='en');a.get('configHistory').value=entry.id;await a.get('restoreConfig').onclick();assert.equal(a.document.documentElement.lang,'en');assert.equal(a.review.getState().pdfDoc,material);assert.equal(a.review.getState().current,1);assert.equal(a.get('trace').value,id);assert.equal(a.get('text').value,purpose);
});

test('language switching is locked during pending operations and preserves export records afterwards',async()=>{
 const wait=deferred(),a=await app(),importing=importPdf(a,pdfDoc({renderWait:wait.promise}));assert.equal(a.review.getState().busy,true);assert.equal(a.get('languageEn').disabled,true);await language(a,'en');assert.equal(a.document.documentElement.lang,'zh-CN');wait.resolve();await importing;
 await language(a,'en');a.get('metadata').checked=true;await a.review.exportFiles('png');assert.equal(a.saved.length,1);const record=a.review.getState().lastRecords[0],snapshot=JSON.stringify(record);await language(a,'zh-CN');assert.equal(JSON.stringify(a.review.getState().lastRecords[0]),snapshot);assert(a.saved[0].name.includes(record.traceId));
});

test('English mode and hostile filenames cannot contaminate the fixed offline download or become HTML',async()=>{
 const a=await app(),filename='<img src=x onerror=alert(1)>_FILENAME_中文.png',purpose='PRIVATE_SYNTHETIC_RUNTIME_NOTE';await language(a,'en');const input=a.get('file');input.files=[{name:filename,type:'image/png',size:png.length,arrayBuffer:async()=>png.buffer}];await input.listeners.change({target:input});assert(a.get('fileNames').textContent.includes(filename));assert(!a.get('fileNames').innerHTML?.includes(filename));a.get('text').value=purpose;
 const verify=a.get('verifyFile');verify.files=input.files;await verify.listeners.change({target:verify});assert(a.get('verifyName').textContent.includes(filename));assert(!a.get('verifyName').innerHTML?.includes(filename));a.get('offlineDownload').onclick({preventDefault(){}});const download=await a.saved.at(-1).blob.text();assert.equal(download,a.canonicalHtml);assert(!download.includes(filename));assert(!download.includes(purpose));
 assert.match(download,/connect-src 'none'/);assert.match(download,/default-src 'none'/);
});

test('export labels identify current-page images and the actual PDF range in both languages',async()=>{
 const a=await app();await importPdf(a,pdfDoc({numPages:2}));
 assert.equal(a.get('png').textContent,'保存PNG（当前页）');assert.equal(a.get('jpg').textContent,'保存JPEG（当前页）');assert.equal(a.get('pdf').textContent,'保存图片型 PDF（所有页）');
 a.get('pages').value='2';a.get('pages').listeners.input();assert.equal(a.get('pdf').textContent,'保存图片型 PDF（所选页）');
 await language(a,'en');assert.equal(a.get('png').textContent,'Save PNG (current page)');assert.equal(a.get('jpg').textContent,'Save JPEG (current page)');assert.equal(a.get('pdf').textContent,'Save image-only PDF (selected pages)');
 a.get('hiddenMark').checked=false;await a.review.exportFiles('pdf');assert.equal(a.saved.length,1);const pdfText=new TextDecoder().decode(await a.saved[0].blob.arrayBuffer());assert.match(pdfText,/\/Type \/Pages \/Kids \[[^\]]*\] \/Count 1\b/);assert.deepEqual(Array.from(a.review.getState().lastRecords[0].sourcePages),[2]);
 a.get('pages').value=' ';a.get('pages').listeners.change();assert.equal(a.get('pdf').textContent,'Save image-only PDF (all pages)');await language(a,'zh-CN');assert.equal(a.get('pdf').textContent,'保存图片型 PDF（所有页）');
});
