import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as realCore from '../src/core.mjs';
import * as workerAssets from '../src/worker-assets.mjs';

// Exercise the actual app event handlers with a deterministic DOM/PDF adapter.
// This covers state transitions, not real-browser codec or layout compatibility.
const source=fs.readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=','base64'));
const jpeg=new Uint8Array([255,216,255,217]);
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function app(overrides={}){
 const counts={paint:0,embed:0,detect:0,decoded:0,released:0,liveImages:0,maxLiveImages:0},saved=[],workerScripts=[],blobs=new Map(),elements=new Map();let blobId=0;
 const context2d={save(){},restore(){},beginPath(){},roundRect(){},fill(){},fillRect(){},clearRect(){},rect(){},clip(){},translate(){},rotate(){},measureText(s){return {width:s.length*10};},fillText(){},arc(){},drawImage(){},getImageData(){return {width:512,height:512,data:new Uint8ClampedArray(512*512*4)};},putImageData(){}};
 const get=id=>{if(!elements.has(id))elements.set(id,{id,value:'',textContent:'',checked:false,disabled:false,hidden:false,files:[],classList:{toggle(){}},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},removeAttribute(){},getContext(){return context2d;}});return elements.get(id);};
 const values={mode:'add',scope:'all',text:'Only for demonstration',opacity:'42',size:'23',angle:'-24',density:'3',color:'#34475d',dpi:'300',longSide:'0',quality:'92',rx:'10',ry:'10',rw:'80',rh:'80'};
 for(const [k,v]of Object.entries(values))get(k).value=v;
 const resources={'iccs/fixture.icc':'AA==','wasm/fixture.wasm':'AA=='};
 get('bundle').textContent=JSON.stringify({licenses:{},samples:[],pdf:'',worker:Buffer.from('// fixture PDF worker').toString('base64'),workerAssets:'',assets:resources});
 const document={getElementById:get,createElement(tag){return tag==='canvas'?{width:0,height:0,getContext(){return context2d;},toBlob(callback,type){callback(new Blob([type==='image/png'?png:jpeg],{type}));}}:{click(){saved.push({name:this.download,blob:blobs.get(this.href)});},remove(){}};},body:{append(){}}};
 class ReviewURL extends URL{static createObjectURL(blob){const key='blob:review-'+(++blobId);blobs.set(key,blob);return key;}static revokeObjectURL(key){blobs.delete(key);}}
 const core={...realCore,paintWatermark(...args){counts.paint++;return realCore.paintWatermark(...args);},embedTrace(...args){counts.embed++;return overrides.embedTrace?overrides.embedTrace(...args):args[0];},detectTrace(...args){counts.detect++;return overrides.detectTrace?overrides.detectTrace(...args):null;}};
 const transformed=source.replace("const coreUrl=moduleUrl(bundle.core),core=await import(coreUrl);URL.revokeObjectURL(coreUrl);",'const core=__core;')
  .replace('lib=await import(url)','lib=__pdfLibrary').replace('{workerPrelude}=await import(bridgeUrl)','{workerPrelude}=__workerAssets').replace('const MAX_OUTPUT_BYTES=160*1024*1024;','const MAX_OUTPUT_BYTES=__outputLimit;');
 const sandbox={document,location:{protocol:'https:'},crypto:globalThis.crypto,URL:ReviewURL,Blob,atob,Uint8Array,Uint8ClampedArray,TextDecoder,console,Image:class {constructor(){this.naturalWidth=overrides.imageWidth||512;this.naturalHeight=overrides.imageHeight||512;}async decode(){counts.decoded++;counts.liveImages++;counts.maxLiveImages=Math.max(counts.maxLiveImages,counts.liveImages);this.loaded=true;}removeAttribute(name){if(name==='src'&&this.loaded){counts.released++;counts.liveImages--;this.loaded=false;}}},Worker:class {constructor(url,options){this.options=options;workerScripts.push(blobs.get(url));}},__core:core,__workerAssets:workerAssets,__pdfLibrary:overrides.pdfLibrary,__outputLimit:overrides.outputLimit??160*1024*1024,
  setTimeout(fn,delay){const timer=setTimeout(fn,delay);if(delay===30000)timer.unref();return timer;},clearTimeout};
 await vm.runInContext('(async()=>{'+transformed+';globalThis.review={getState:()=>({total:total(),current,pdfDoc,pdfTask,sources,generation,busy,previewValid,lastRecords}),setPdf:(doc,task)=>{pdfDoc=doc;pdfTask=task;},setLibrary:p=>{pdfPromise=p;},cleanup,preview,showDemo,exportFiles,updateControls};})()',vm.createContext(sandbox));
 return {get,review:sandbox.review,counts,saved,workerScripts,resources};
}
function pdfDoc({failPage=0,renderWait=null,numPages=1}={}){return {numPages,async getPage(pageNumber){return {getViewport({scale}){return {width:600*scale,height:800*scale};},render(){return {promise:pageNumber===failPage?Promise.reject(Error('fixture render failed')):renderWait||Promise.resolve()};},cleanup(){}};}};}
function library(document){return Promise.resolve({lib:{getDocument(){return {promise:Promise.resolve(document),destroy:async()=>{}};}},EmbeddedDataFactory:class {}});}
async function importPdf(a,doc){a.review.setLibrary(library(doc));const input=a.get('file');input.files=[{name:'fixture.pdf',type:'application/pdf',size:10,arrayBuffer:async()=>new ArrayBuffer(10)}];return input.listeners.change({target:input});}

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
 destroy.resolve();await showing;assert.equal(a.review.getState().total,1);assert.equal(a.review.getState().busy,false);
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
 const a=await app();a.get('mode').value='flatten';a.get('text').value='';const before=a.counts.paint;assert.equal(await a.review.preview(),true);
 assert.equal(a.get('png').disabled,false);assert.equal(a.get('density').disabled,true);assert.equal(a.get('text').disabled,false);
 a.get('metadata').checked=true;await a.review.exportFiles('png');assert.equal(a.saved.length,1);assert.equal(a.counts.paint,before);
 const meta=realCore.readMetadata(new Uint8Array(await a.saved[0].blob.arrayBuffer()));assert.equal(meta.processingMode,'flatten');assert.equal(meta.watermark,'');assert.equal(meta.purposeNote,'');
});
test('flatten optional note is separate from a newly drawn watermark',async()=>{
 const a=await app();a.get('mode').value='flatten';a.get('text').value='Example purpose';a.get('metadata').checked=true;
 await a.review.preview();await a.review.exportFiles('pdf');const meta=realCore.inspectOwnPdf(new Uint8Array(await a.saved[0].blob.arrayBuffer())).metadata;
 assert.equal(meta.watermark,'');assert.equal(meta.purposeNote,'Example purpose');assert.equal(meta.processingMode,'flatten');
});
test('add mode refuses empty text and invalid coverage; flatten ignores unused coverage',async()=>{
 const a=await app();a.get('text').value='';assert.equal(await a.review.preview(),false);assert.equal(a.get('png').disabled,true);
 a.get('text').value='Example';a.get('scope').value='custom';a.get('rw').value='100';assert.equal(await a.review.preview(),false);assert.match(a.get('status').textContent,/覆盖矩形/);
 a.get('mode').value='flatten';a.get('text').value='';assert.equal(await a.review.preview(),true);assert.equal(a.get('png').disabled,false);
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
 let expected;const a=await app({detectTrace:()=>({traceId:expected})});expected=a.get('trace').value;a.get('hiddenMark').checked=true;await a.review.exportFiles('jpg');
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
 await input.listeners.change({target:input});assert.match(a.get('status').textContent,/本次文件总量超过 160 MB/);assert.equal(a.counts.decoded,0);assert.equal(a.review.getState().total,0);assert.equal(a.get('file').disabled,false);
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
 let id,checks=0;const a=await app({detectTrace:()=>++checks===1?{traceId:id}:null});await importPdf(a,pdfDoc({numPages:2}));id=a.get('trace').value;a.get('hiddenMark').checked=true;
 await a.review.exportFiles('pdf');assert.equal(checks,2);assert.equal(a.saved.length,0);assert.equal(a.review.getState().lastRecords.length,0);assert.match(a.get('status').textContent,/已停止保存/);
});
test('local verification explains flatten metadata and serializes file operations',async()=>{
 const a=await app();a.get('mode').value='flatten';a.get('text').value='Example note';a.get('metadata').checked=true;await a.review.preview();await a.review.exportFiles('png');
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
 const image=await app({outputLimit:64});await image.review.exportFiles('png');assert.equal(image.saved.length,0);assert.match(image.get('status').textContent,/输出文件超过 160 MB/);
 const accumulated=await app({outputLimit:8});await importPdf(accumulated,pdfDoc({numPages:3}));await accumulated.review.exportFiles('pdf');assert.equal(accumulated.saved.length,0);assert.match(accumulated.get('status').textContent,/按页码分批导出/);assert.equal(accumulated.review.getState().busy,false);
 const final=await app({outputLimit:100});await final.review.exportFiles('pdf');assert.equal(final.saved.length,0);assert.match(final.get('status').textContent,/降低图片质量或输出最长边/);assert.equal(final.review.getState().lastRecords.length,0);
});
