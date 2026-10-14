import test from 'node:test';
import assert from 'node:assert/strict';
import * as realCore from '../src/core.mjs';
import * as workerAssets from '../src/worker-assets.mjs';
import * as preferences from '../src/preferences.mjs';
import {largePdfFixture} from './large-pdf-fixture.mjs';
import {app,deferred,memoryStorage,exportDate,exportedId,pdfDoc,library,importPdf,requestUnload,editControl,png} from './helpers/app-harness.mjs';

test('offline tool Blob matches canonical bytes and excludes current materials, notes and preview DOM',async()=>{
 const a=await app(),privateMarker='PRIVATE_RUNTIME_EXAMPLE_NOT_FOR_DOWNLOAD';
 a.get('text').value=privateMarker;a.get('verification').textContent=privateMarker;a.get('status').textContent=privateMarker;a.get('file').files=[{name:privateMarker+'.png'}];
 a.document.body.innerHTML='<aside>candidate preview '+privateMarker+'</aside>';
 let prevented=false;a.get('offlineDownload').onclick({preventDefault(){prevented=true;}});
 assert(prevented);assert.equal(a.saved.length,1);assert.equal(a.saved[0].name,'offline-watermark-v'+realCore.VERSION+'.html');
 assert.equal(a.saved[0].blob.type,'text/html;charset=utf-8');
 const output=await a.saved[0].blob.text();assert.equal(output,a.canonicalHtml);assert(!output.includes(privateMarker));
 assert.match(a.get('status').textContent,/只包含工具和公开示例/);assert.match(a.get('status').textContent,/不含你导入的材料/);
});

test('file mode keeps the current-offline hint without a redundant save handler',async()=>{
 const a=await app({protocol:'file:'});assert.equal(a.get('offlineDownload').textContent,'当前为离线文件');assert.equal(a.get('offlineDownload').onclick,undefined);assert.equal(a.saved.length,0);
});

test('clear locks imports until old PDF teardown finishes',async()=>{
 const a=await app(),destroy=deferred();a.review.setPdf(pdfDoc(),{destroy:()=>destroy.promise});
 const clearing=a.get('clear').onclick();assert.equal(a.get('file').disabled,true);assert.equal(a.review.getState().busy,true);
 await importPdf(a,pdfDoc());assert.equal(a.review.getState().pdfDoc,null,'new input is ignored while clearing');
 destroy.resolve();await clearing;assert.equal(a.review.getState().busy,false);
 const imported=pdfDoc();await importPdf(a,imported);assert.equal(a.review.getState().pdfDoc,imported);assert.equal(a.get('pdf').disabled,false);
});
test('demo also locks imports during PDF teardown',async()=>{
 const a=await app(),destroy=deferred();a.review.setPdf(pdfDoc(),{destroy:()=>destroy.promise});
 const showing=a.get('demo').onclick();assert.equal(a.get('file').disabled,true);await importPdf(a,pdfDoc());assert.equal(a.review.getState().pdfDoc,null);
 destroy.resolve();await showing;assert.equal(a.review.getState().total,1);assert.equal(a.review.getState().busy,false);assert.equal(requestUnload(a).prevented,true,'explicitly choosing the demo creates session work');
});
test('render failure survives import and disables export',async()=>{
 const a=await app();await importPdf(a,pdfDoc({failPage:1}));assert.match(a.get('status').textContent,/预览失败：fixture render failed/);
 assert.equal(a.get('pdf').disabled,true);assert.equal(a.review.getState().previewValid,false);assert.equal(a.get('previewTitle').textContent,'预览失败 · 请检查材料或设置');
 await a.review.exportFiles('pdf');assert.equal(a.saved.length,0);
});
test('navigation can recover from a failed page without exporting stale preview',async()=>{
 const a=await app();await importPdf(a,pdfDoc({numPages:2,failPage:2}));assert.equal(a.get('pdf').disabled,false);
 a.get('next').onclick();await new Promise(r=>setImmediate(r));assert.equal(a.get('pdf').disabled,true);
 a.get('prev').onclick();await new Promise(r=>setImmediate(r));assert.equal(a.get('pdf').disabled,false);assert.equal(a.review.getState().current,0);assert.match(a.get('status').textContent,/预览已更新/);
});
test('in-progress preview disables export until actual render completion',async()=>{
 const a=await app(),render=deferred();a.review.setPdf(pdfDoc({renderWait:render.promise}),{destroy:async()=>{}});const previewing=a.review.preview();
 assert.equal(a.get('pdf').disabled,true);await a.review.exportFiles('pdf');assert.equal(a.saved.length,0);
 render.resolve();assert.equal(await previewing,true);assert.equal(a.get('pdf').disabled,false);
});
test('flatten mode permits empty purpose and neither preview nor export paints a watermark',async()=>{
 const a=await app();a.get('addVisibleWatermark').checked=false;a.get('text').value='';const before=a.counts.paint;assert.equal(await a.review.preview(),true);
 assert.equal(a.get('png').disabled,false);assert.equal(a.get('density').disabled,true);assert.equal(a.get('text').disabled,false);
 a.get('metadata').checked=true;await a.review.exportFiles('png');assert.equal(a.saved.length,1);assert.equal(a.counts.paint,before);
 const meta=realCore.readMetadata(new Uint8Array(await a.saved[0].blob.arrayBuffer()));assert.equal(meta.processingMode,'flatten');assert.equal(meta.watermark,'');assert.equal(meta.purposeNote,'');
});
test('flatten optional note is separate from a newly drawn watermark',async()=>{
 const a=await app();a.get('addVisibleWatermark').checked=false;a.get('text').value='Example purpose';a.get('metadata').checked=true;
 await a.review.preview();await a.review.exportFiles('pdf');const meta=realCore.inspectOwnPdf(new Uint8Array(await a.saved[0].blob.arrayBuffer())).metadata;
 assert.equal(meta.watermark,'');assert.equal(meta.purposeNote,'Example purpose');assert.equal(meta.processingMode,'flatten');
});
test('add mode refuses empty text and invalid coverage; flatten ignores unused coverage',async()=>{
 const a=await app();a.get('text').value='';assert.equal(await a.review.preview(),false);assert.equal(a.get('png').disabled,true);
 a.get('text').value='Example';a.get('scope').value='custom';a.get('rw').value='100';assert.equal(await a.review.preview(),false);assert.match(a.get('status').textContent,/覆盖矩形/);
 a.get('addVisibleWatermark').checked=false;a.get('text').value='';assert.equal(await a.review.preview(),true);assert.equal(a.get('png').disabled,false);
});
test('a password-protected PDF gets a local actionable error and releases controls',async()=>{
 const a=await app();a.review.setLibrary(Promise.resolve({lib:{getDocument(){return {promise:Promise.reject(Object.assign(Error('Password needed'),{name:'PasswordException'})),destroy:async()=>{}};}},EmbeddedDataFactory:class {}}));
 const input=a.get('file');input.files=[{name:'encrypted.pdf',type:'application/pdf',size:10,arrayBuffer:async()=>new ArrayBuffer(10)}];await input.listeners.change({target:input});
 assert.match(a.get('status').textContent,/此 PDF 有密码保护/);assert.equal(a.review.getState().total,0);assert.equal(a.get('file').disabled,false);
});
test('clear removes previously displayed verification and trace records',async()=>{
 const a=await app();a.get('verification').textContent='Example receiver note';a.get('verifyFile').value='fixture.png';await a.review.exportFiles('png');assert.equal(a.review.getState().lastRecords.length,1);
 await a.get('clear').onclick();assert.equal(a.get('verification').textContent,'尚未选择验证文件。');assert.equal(a.get('verifyFile').value,'');assert.equal(a.review.getState().lastRecords.length,0);assert.equal(a.get('manifest').disabled,true);
});
test('JPEG and PDF exports stop before download if compressed hidden marker fails verification',async()=>{
 for(const format of ['jpg','pdf']){const a=await app();a.get('hiddenMark').checked=true;await a.review.exportFiles(format);assert.equal(a.saved.length,0);assert.equal(a.counts.embed,1);assert.equal(a.counts.detect,1);assert.match(a.get('status').textContent,/JPEG 压缩后未能确认隐藏标记/);assert.equal(a.review.getState().busy,false);}
});
test('JPEG marker verified against the current ID permits download and recording',async()=>{
 let expected;const a=await app({detectTrace:()=>({traceId:expected})});expected=exportedId(a);a.get('hiddenMark').checked=true;await a.review.exportFiles('jpg');
 assert.equal(a.saved.length,1);assert.equal(a.counts.detect,1);assert.equal(a.review.getState().lastRecords[0].traceId,expected);
});
test('30 large images retain source files and release each decoder before loading the next',async()=>{
 const a=await app({imageWidth:6000,imageHeight:6000}),input=a.get('file');input.files=Array.from({length:30},(_,i)=>({name:'fixture-'+i+'.png',type:'image/png',size:100}));
 await input.listeners.change({target:input});assert.equal(a.review.getState().total,30);assert.equal(a.counts.maxLiveImages,1);assert.equal(a.counts.liveImages,0);
 assert.equal(a.counts.decoded,31,'dimension checks followed by current-page preview');assert.equal(a.counts.released,31);
 for(let i=0;i<30;i++){const s=a.review.getState().sources[i];assert.equal(s.blob,input.files[i]);assert.equal(s.width,6000);assert.equal(s.naturalWidth,undefined);}
 a.get('next').onclick();await new Promise(r=>setImmediate(r));assert.equal(a.counts.liveImages,0);assert.equal(a.counts.decoded,32);
 await a.review.exportFiles('pdf');assert.equal(a.saved.length,1);assert.equal(a.counts.maxLiveImages,1);assert.equal(a.counts.liveImages,0);assert.equal(a.review.getState().lastRecords[0].pagePixels.length,30);
});
test('oversized cumulative files are refused before decoding without reducing 30-image count',async()=>{
 const a=await app(),input=a.get('file');input.files=Array.from({length:3},(_,i)=>({name:'fixture-'+i+'.png',type:'image/png',size:60*1024*1024}));
 await input.listeners.change({target:input});assert.match(a.get('status').textContent,/本次文件总量超过 160 MiB/);assert.equal(a.counts.decoded,0);assert.equal(a.review.getState().total,0);assert.equal(a.get('file').disabled,false);
});
test('an image over the single-image pixel limit releases its decoder before reporting failure',async()=>{
 const a=await app({imageWidth:8000,imageHeight:6000}),input=a.get('file');input.files=[{name:'fixture.png',type:'image/png',size:100}];
 await input.listeners.change({target:input});assert.match(a.get('status').textContent,/单张图片超过 4000 万像素/);assert.equal(a.counts.liveImages,0);assert.equal(a.counts.released,1);assert.equal(a.review.getState().total,0);
});
test('damaged and excessive-page PDFs do not leave a partial document or locked controls',async()=>{
 const damaged=await app();damaged.review.setLibrary(Promise.resolve({lib:{getDocument(){return {promise:Promise.reject(Object.assign(Error('Invalid PDF structure'),{name:'InvalidPDFException'})),destroy:async()=>{}};}},EmbeddedDataFactory:class {}}));
 const input=damaged.get('file');input.files=[{name:'fixture.pdf',type:'application/pdf',size:10,arrayBuffer:async()=>new ArrayBuffer(10)}];await input.listeners.change({target:input});
 assert.match(damaged.get('status').textContent,/Invalid PDF structure/);assert.equal(damaged.review.getState().total,0);assert.equal(damaged.get('file').disabled,false);
 const excessive=await app();await importPdf(excessive,pdfDoc({numPages:101}));assert.match(excessive.get('status').textContent,/最多 100 页/);assert.equal(excessive.review.getState().total,0);assert.equal(excessive.get('file').disabled,false);
});
test('all PDF pages must pass compressed marker checking before any PDF is downloaded',async()=>{
 let id,checks=0;const a=await app({detectTrace:()=>++checks===1?{traceId:id}:null});await importPdf(a,pdfDoc({numPages:2}));id=exportedId(a);a.get('hiddenMark').checked=true;
 await a.review.exportFiles('pdf');assert.equal(checks,2);assert.equal(a.saved.length,0);assert.equal(a.review.getState().lastRecords.length,0);assert.match(a.get('status').textContent,/已停止保存/);
});
test('local verification explains flatten metadata and serializes file operations',async()=>{
 const a=await app();a.get('addVisibleWatermark').checked=false;a.get('text').value='Example note';a.get('metadata').checked=true;await a.review.preview();await a.review.exportFiles('png');
 const bytes=await a.saved[0].blob.arrayBuffer(),reading=deferred(),input=a.get('verifyFile');input.files=[{name:'fixture.png',type:'image/png',size:bytes.byteLength,arrayBuffer:()=>reading.promise}];
 const verifying=input.listeners.change({target:input});assert.equal(a.get('file').disabled,true);assert.equal(a.get('clear').disabled,true);assert.equal(a.get('pdf').disabled,true);
 reading.resolve(bytes);await verifying;assert.match(a.get('verification').textContent,/未提取原有水印文字/);assert.match(a.get('verification').textContent,/补充用途说明：Example note/);assert.equal(a.get('file').disabled,false);assert.equal(a.counts.liveImages,0);
});
test('PDF worker is self-contained and all parser resource URLs stay on the embedded scheme',async()=>{
 let options;const lib={GlobalWorkerOptions:{},getDocument(o){options=o;return {promise:Promise.resolve(pdfDoc()),destroy:async()=>{}};}},a=await app({pdfLibrary:lib}),input=a.get('file');
 input.files=[{name:'fixture.pdf',type:'application/pdf',size:10,arrayBuffer:async()=>new ArrayBuffer(10)}];await input.listeners.change({target:input});
 assert.equal(options.useWorkerFetch,true);assert.equal(options.useSystemFonts,false);assert.equal(options.BinaryDataFactory,undefined);
 for(const [name,folder]of [['cMapUrl','cmaps'],['standardFontDataUrl','standard_fonts'],['wasmUrl','wasm'],['iccUrl','iccs']])assert.equal(options[name],'offline-asset://'+folder+'/');
 assert.equal(a.workerScripts.length,1);const workerCode=await a.workerScripts[0].text();assert(workerCode.startsWith(workerAssets.workerPrelude(a.resources)));assert(workerCode.endsWith('// fixture PDF worker'));assert.equal(lib.GlobalWorkerOptions.workerPort.options.type,'module');
});
test('output resource gates stop oversized image, accumulated JPEG pages, and final PDF bytes',async()=>{
 const image=await app({outputLimit:64});await image.review.exportFiles('png');assert.equal(image.saved.length,0);assert.match(image.get('status').textContent,/输出文件超过 160 MiB/);
 const accumulated=await app({outputLimit:8});await importPdf(accumulated,pdfDoc({numPages:3}));await accumulated.review.exportFiles('pdf');assert.equal(accumulated.saved.length,0);assert.match(accumulated.get('status').textContent,/按页码分批导出/);assert.equal(accumulated.review.getState().busy,false);
 const final=await app({outputLimit:100});await final.review.exportFiles('pdf');assert.equal(final.saved.length,0);assert.match(final.get('status').textContent,/降低图片质量或输出最长边/);assert.equal(final.review.getState().lastRecords.length,0);
});
test('a generated PDF above 80 MiB and below 160 MiB can be imported and verified',async()=>{
 const metadata={tool:'Offline Document Watermark',traceId:'12AB34CD56EF7890',watermark:'Synthetic fixture',hiddenMarker:null},fixture=largePdfFixture(metadata),a=await app();
 assert(fixture.bytes.length>80*1024*1024&&fixture.bytes.length<160*1024*1024);
 const file={name:'synthetic-large.pdf',type:'application/pdf',size:fixture.bytes.length,arrayBuffer:async()=>fixture.bytes.buffer};
 a.review.setLibrary(library(pdfDoc({numPages:3})));const input=a.get('file');input.files=[file];await input.listeners.change({target:input});
 assert.equal(a.review.getState().total,3);assert.match(a.get('status').textContent,/已在本地导入 3 页/);
 const verify=a.get('verifyFile');verify.files=[file];await verify.listeners.change({target:verify});
 assert.match(a.get('verification').textContent,/元信息编号：12AB34CD56EF7890/);assert.match(a.get('verification').textContent,/第一页/);assert.doesNotMatch(a.get('verification').textContent,/验证失败/);
});
test('import and verification reject a single file above the same 160 MiB limit without reading it',async()=>{
 const a=await app();let reads=0;const file={name:'too-large.pdf',type:'application/pdf',size:160*1024*1024+1,arrayBuffer:async()=>{reads++;throw Error('must not read');}};
 const input=a.get('file');input.files=[file];await input.listeners.change({target:input});assert.match(a.get('status').textContent,/单个文件超过 160 MiB/);
 const verify=a.get('verifyFile');verify.files=[file];await verify.listeners.change({target:verify});assert.match(a.get('verification').textContent,/验证文件超过 160 MiB/);assert.equal(reads,0);
});

test('selected import and verification names survive input reset and independent material changes',async()=>{
 const a=await app(),input=a.get('file'),names=['fixture-front.png','fixture-back.png'];input.files=names.map(name=>({name,type:'image/png',size:100}));input.value='native-picker';await input.listeners.change({target:input});assert.equal(input.value,'');for(const name of names)assert(a.get('fileNames').textContent.includes(name));
 const reading=deferred(),verify=a.get('verifyFile');verify.files=[{name:'fixture-check.png',type:'image/png',size:png.length,arrayBuffer:()=>reading.promise}];verify.value='native-picker';const pending=verify.listeners.change({target:verify});assert.equal(a.get('verifyName').textContent,'验证文件：fixture-check.png');reading.resolve(png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength));await pending;assert.equal(verify.value,'');assert.equal(a.get('verifyName').textContent,'验证文件：fixture-check.png');
 await importPdf(a,pdfDoc());assert.equal(a.get('verifyName').textContent,'验证文件：fixture-check.png');assert.match(a.get('fileNames').textContent,/fixture\.pdf/);assert(![...a.storage.data.values()].join('').includes('fixture'));
 await a.get('clear').onclick();assert.equal(a.get('verifyName').textContent,'尚未选择验证文件。');assert.equal(a.get('fileNames').textContent,'尚未导入文件。');
});

test('full export-time ID is identical across PDF pages, compressed checks, metadata, filename and record',async()=>{
 let a,expected;const embedded=[];a=await app({embedTrace:(image,id)=>{embedded.push(id);return image;},detectTrace:()=>({traceId:expected})});await importPdf(a,pdfDoc({numPages:2}));a.get('hiddenMark').checked=a.get('metadata').checked=true;expected=exportedId(a);await a.review.exportFiles('pdf');
 assert.match(expected,/^20261014T010203Z-[0-9A-F]{16}$/);assert.deepEqual(embedded,[expected,expected]);assert.equal(a.saved.length,1);assert(a.saved[0].name.includes(expected));const meta=realCore.inspectOwnPdf(new Uint8Array(await a.saved[0].blob.arrayBuffer())).metadata,record=a.review.getState().lastRecords[0];assert.equal(meta.traceId,expected);assert.equal(record.traceId,expected);assert.equal(meta.createdAt,exportDate.toISOString());assert.equal(meta.hiddenMarker,'experimental-dct-owm3');assert.equal(meta.timePrefix,true);assert.equal(a.counts.detect,2);assert(a.get('exportTrace').textContent.includes(expected));assert(![...a.storage.data.values()].join('').includes(expected));
});

test('disabling time prefix exports the original 16HEX ID with legacy marker format',async()=>{
 let id;const a=await app({detectTrace:()=>({traceId:id})});a.get('timePrefix').checked=false;a.get('hiddenMark').checked=a.get('metadata').checked=true;id=a.get('trace').value;await a.review.exportFiles('jpg');assert.equal(a.saved.length,1);const meta=realCore.readMetadata(new Uint8Array(await a.saved[0].blob.arrayBuffer()));assert.equal(meta.traceId,id);assert.equal(meta.timePrefix,false);assert.equal(meta.hiddenMarker,'experimental-dct-v1');assert(a.saved[0].name.endsWith(id+'.jpg'));
});

test('saved settings and selected historical configuration restore while session materials and IDs do not',async()=>{
 const storage=memoryStorage(),first=await app({storage});first.get('text').value='Synthetic remembered purpose';first.get('density').value='5';first.get('angle').value='-40';first.get('quality').value='80';first.get('dpi').value='200';first.get('timePrefix').checked=false;first.review.persistPreferences();
 first.get('density').value='7';first.get('quality').value='92';first.review.persistPreferences();const second=await app({storage});assert.equal(second.get('text').value,'Synthetic remembered purpose');assert.equal(second.get('density').value,'7');assert.equal(second.get('angle').value,'-40');assert.equal(second.get('dpi').value,'200');assert.equal(second.get('timePrefix').checked,false);assert.notEqual(second.get('trace').value,first.get('trace').value);assert.equal(second.review.getState().lastRecords.length,0);assert.equal(second.get('verifyName').textContent,'尚未选择验证文件。');assert.match(second.get('fileNames').textContent,/内置虚构示例/);
 const oldId=preferences.readPreferences(storage).history.find(entry=>entry.config.density===5).id;second.get('configHistory').value=oldId;second.get('restoreConfig').onclick();assert.equal(second.get('density').value,'5');assert.equal(second.get('quality').value,'80');second.review.persistPreferences();assert.equal(preferences.readPreferences(storage).latest.density,5);
});

test('refresh guard flushes pending preferences and prompts only after session interaction',async()=>{
 const a=await app();let prevented=0;const event=()=>({preventDefault(){prevented++;}});a.windowListeners.get('beforeunload')(event());assert.equal(prevented,0);
 a.get('text').value='Synthetic pending purpose';a.get('text').listeners.input();const active=event();a.windowListeners.get('beforeunload')(active);assert.equal(prevented,1);assert.equal(active.returnValue,true);assert.equal(preferences.readPreferences(a.storage).latest.text,'Synthetic pending purpose');await a.get('clear').onclick();a.windowListeners.get('beforeunload')(event());assert.equal(prevented,1);
});

test('clearing remembered settings remains disabled after a new page session',async()=>{
 const storage=memoryStorage(),a=await app({storage});a.get('text').value='Synthetic note to forget';a.review.persistPreferences();assert([...storage.data.values()].join('').includes('Synthetic note'));a.get('clearConfig').onclick();a.get('text').value='New nonpersistent note';await a.review.exportFiles('png');const raw=[...storage.data.values()].join('');assert(!raw.includes('note'));assert.equal(preferences.readPreferences(storage).enabled,false);const fresh=await app({storage});assert.equal(fresh.get('rememberConfig').checked,false);assert.equal(fresh.get('text').value,'Only for demonstration');assert.match(fresh.get('configStatus').textContent,/记住配置已关闭/);
});

test('clearing materials cannot drop refresh protection for unsaved settings when remembering is off',async()=>{
 const a=await app();a.get('rememberConfig').checked=false;a.get('rememberConfig').listeners.change();a.get('text').value='Synthetic unsaved purpose';a.get('text').listeners.input();await a.get('clear').onclick();assert.equal(a.get('text').value,'Synthetic unsaved purpose');assert.equal(preferences.readPreferences(a.storage).enabled,false);let prevented=false;a.windowListeners.get('beforeunload')({preventDefault(){prevented=true;}});assert(prevented);
});

test('denied browser preference storage leaves import, export and refresh guard usable',async()=>{
 const denied={getItem(){throw Error('Denied');},setItem(){throw Error('Denied');}},a=await app({storage:denied});assert.equal(a.get('rememberConfig').checked,false);assert.match(a.get('configStatus').textContent,/无法使用本机配置存储/);await importPdf(a,pdfDoc());await a.review.exportFiles('pdf');assert.equal(a.saved.length,1);let prevented=false;a.windowListeners.get('beforeunload')({preventDefault(){prevented=true;}});assert(prevented);
});

test('metadata-only verification explicitly differs from a surviving pixel marker',async()=>{
 const a=await app();a.get('metadata').checked=true;await a.review.exportFiles('png');const bytes=await a.saved[0].blob.arrayBuffer(),input=a.get('verifyFile');input.files=[{name:'metadata-only.png',type:'image/png',size:bytes.byteLength,arrayBuffer:async()=>bytes}];await input.listeners.change({target:input});assert.match(a.get('verification').textContent,/元信息编号：20261014T010203Z-/);assert.match(a.get('verification').textContent,/目前只读到元信息/);assert.match(a.get('verification').textContent,/未检出有效隐藏像素标记/);
});

test('legacy add/flatten preferences map to the visible-watermark checkbox without creating session work',async()=>{
 for(const mode of ['add','flatten']){
  const storage=memoryStorage();preferences.writePreferences(storage,{mode,text:'Legacy synthetic purpose',density:5,quality:80},{now:'2026-10-14T01:00:00Z'});
  const a=await app({storage});assert.equal(a.get('addVisibleWatermark').checked,mode==='add');assert.equal(a.get('text').value,'Legacy synthetic purpose');assert.equal(a.get('density').value,'5');assert.equal(a.get('quality').value,'80');assert.equal(a.get('density').disabled,mode==='flatten');assert.equal(requestUnload(a).prevented,false,'startup restore is not a new user edit');
  a.review.persistPreferences();assert.equal(preferences.readPreferences(storage).latest.mode,mode);assert(!Object.hasOwn(preferences.readPreferences(storage).latest,'addVisibleWatermark'));
 }
});

test('checkbox changes persist mode compatibility and historical restore restores the checkbox',async()=>{
 const a=await app();editControl(a,'addVisibleWatermark','change',false);a.get('text').value='';await a.review.preview();a.review.persistPreferences();
 assert.equal(a.get('png').disabled,false);assert.equal(a.get('pdf').disabled,false);assert.equal(preferences.readPreferences(a.storage).latest.mode,'flatten');
 editControl(a,'addVisibleWatermark','input',true);editControl(a,'text','change','New synthetic purpose');await a.review.preview();a.review.persistPreferences();assert.equal(preferences.readPreferences(a.storage).latest.mode,'add');
 const old=preferences.readPreferences(a.storage).history.find(entry=>entry.config.mode==='flatten');assert(old);a.get('configHistory').value=old.id;a.get('restoreConfig').onclick();await a.review.preview();assert.equal(a.get('addVisibleWatermark').checked,false);assert.equal(a.get('text').value,'');assert.equal(a.get('density').disabled,true);a.review.persistPreferences();assert.equal(preferences.readPreferences(a.storage).latest.mode,'flatten');
 await a.review.cleanup();
});

test('parameter input and change both request leaving confirmation before any user material is imported',async()=>{
 // This asserts the app's request, not whether a browser will display a dialog.
 const changes=[['density','4'],['angle','-30'],['quality','80'],['dpi','200'],['longSide','1600'],['scope','custom'],['text','Synthetic changed purpose'],['color','#123456'],['opacity','55'],['size','30'],['rx','15'],['ry','15'],['rw','70'],['rh','70'],['hiddenMark',true],['metadata',true],['timePrefix',false],['addVisibleWatermark',false]];
 for(const [id,value]of changes)for(const eventName of ['input','change']){
  const a=await app();assert.equal(requestUnload(a).prevented,false,id+' '+eventName+' starts without a request');assert.match(a.get('fileNames').textContent,/内置虚构示例/);editControl(a,id,eventName,value);
  const leaving=requestUnload(a);assert.equal(leaving.prevented,true,id+' '+eventName+' must request leaving confirmation');assert.equal(leaving.returnValue,true,id+' '+eventName+' must set the legacy guard value');assert.equal(a.saved.length,0,'settings changes do not save material files');
  await a.review.cleanup();
 }
});

test('manual trace and page-range edits request confirmation but never enter persistent settings',async()=>{
 for(const [id,value]of [['trace','FEDCBA9876543210'],['pages','1']])for(const eventName of ['input','change']){
  const a=await app();editControl(a,id,eventName,value);const leaving=requestUnload(a);assert.equal(leaving.prevented,true,id+' '+eventName);assert.equal(leaving.returnValue,true);
  a.review.persistPreferences();const state=preferences.readPreferences(a.storage),raw=[...a.storage.data.values()].join('');assert(!Object.hasOwn(state.latest,id));assert(!raw.includes('"'+id+'"'));if(id==='trace')assert(!raw.includes(value));assert.equal(a.saved.length,0);
  await a.review.cleanup();
 }
});

test('saving only local settings keeps the session reminder and does not pretend materials were saved',async()=>{
 const a=await app();editControl(a,'density','change','5');a.review.persistPreferences();assert.equal(preferences.readPreferences(a.storage).latest.density,5);assert.equal(a.saved.length,0);assert.equal(requestUnload(a).prevented,true);assert.match(a.get('fileNames').textContent,/内置虚构示例/);await a.review.cleanup();
});

test('disabled or broken preference storage cannot remove protection for parameter-only work after clearing materials',async()=>{
 const broken=memoryStorage();broken.data.set(preferences.PREFERENCES_STORAGE_KEY,'{broken json');
 const denied={getItem(){throw Error('Denied');},setItem(){throw Error('Denied');}};
 for(const storage of [memoryStorage(),broken,denied]){
  const a=await app({storage});if(a.get('rememberConfig').checked)editControl(a,'rememberConfig','change',false);
  editControl(a,'angle','change','-35');editControl(a,'text','input','Synthetic unsaved settings');assert.equal(a.saved.length,0);assert.equal(requestUnload(a).prevented,true);await a.get('clear').onclick();assert.equal(a.get('text').value,'Synthetic unsaved settings');assert.equal(requestUnload(a).prevented,true,'clearing materials must retain unsaved settings protection');
  const raw=storage.data?[...storage.data.values()].join(''):'';assert(!raw.includes('Synthetic unsaved settings'));
 }
});

test('valid local PDF navigation requests confirmation without importing or saving a user file',async()=>{
 const a=await app();a.get('prev').onclick();assert.equal(requestUnload(a).prevented,false,'an ineffective previous-page click must not create work');
 a.review.setPdf(pdfDoc({numPages:2}),{destroy:async()=>{}});await a.review.preview();assert.equal(requestUnload(a).prevented,false,'fixture setup is not a user interaction');
 a.get('next').onclick();await new Promise(resolve=>setImmediate(resolve));assert.equal(a.review.getState().current,1);assert.equal(requestUnload(a).prevented,true);assert.equal(a.saved.length,0);assert.match(a.get('fileNames').textContent,/内置虚构示例/);
 await a.get('clear').onclick();assert.equal(requestUnload(a).prevented,false,'explicit clearing ends this navigation-only session');
});
