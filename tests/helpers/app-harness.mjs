import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as realCore from '../../src/core.mjs';
import * as workerAssets from '../../src/worker-assets.mjs';
import * as preferences from '../../src/preferences.mjs';
import * as i18nModule from '../../src/i18n.mjs';
import {largePdfFixture} from '../large-pdf-fixture.mjs';
import {assembleHtml} from '../../scripts/build.mjs';

// Exercise the actual app event handlers with a deterministic DOM/PDF adapter.
// This covers state transitions, not real-browser codec or layout compatibility.
const source=fs.readFileSync(new URL('../../src/app.mjs',import.meta.url),'utf8');
const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=','base64'));
const jpeg=new Uint8Array([255,216,255,217]);
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function memoryStorage(){const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
const exportDate=new Date('2026-10-14T01:02:03.456Z');
function exportedId(a){return a.get('timePrefix').checked?realCore.makeTimestampedTrace(a.get('trace').value,exportDate):a.get('trace').value;}
async function app(overrides={}){
 const counts={paint:0,embed:0,detect:0,decoded:0,released:0,liveImages:0,maxLiveImages:0,canvasTexts:[]},saved=[],workerScripts=[],blobs=new Map(),elements=new Map(),windowListeners=new Map(),storage=overrides.storage||memoryStorage();let blobId=0;
 const context2d={save(){},restore(){},beginPath(){},roundRect(){},fill(){},fillRect(){},clearRect(){},rect(){},clip(){},translate(){},rotate(){},measureText(s){return {width:s.length*10};},fillText(text){counts.canvasTexts.push(text);},arc(){},drawImage(){},getImageData(){return {width:512,height:512,data:new Uint8ClampedArray(512*512*4)};},putImageData(){}};
 const get=id=>{if(!elements.has(id)){const attributes=new Map();elements.set(id,{id,value:'',textContent:'',checked:false,disabled:false,hidden:false,files:[],children:[],attributes,classList:{toggle(){}},listeners:{},addEventListener(name,fn){const previous=this.listeners[name];this.listeners[name]=previous?(...args)=>{previous(...args);return fn(...args);}:fn;},append(child){this.children.push(child);},setAttribute(name,value){attributes.set(name,String(value));},getAttribute(name){return attributes.get(name)??null;},removeAttribute(name){attributes.delete(name);},getContext(){return context2d;}});}return elements.get(id);};
 const values={scope:'all',text:'Only for demonstration',opacity:'42',size:'23',angle:'-24',density:'3',color:'#34475d',dpi:'300',longSide:'0',quality:'92',rx:'10',ry:'10',rw:'80',rh:'80'};
 for(const [k,v]of Object.entries(values))get(k).value=v;
 get('addVisibleWatermark').checked=get('timePrefix').checked=get('rememberConfig').checked=true;
 const resources={'iccs/fixture.icc':'AA==','wasm/fixture.wasm':'AA=='};
 const template=fs.readFileSync(new URL('../../src/index.template.html',import.meta.url),'utf8'),translationNodes=[];
 for(const [index,match]of [...template.matchAll(/<([a-z][\w-]*)\b([^>]*\bdata-i18n(?:-[\w-]+)?="[^"]+"[^>]*)>/gi)].entries()){
  const attributes=[...match[2].matchAll(/([\w-]+)="([^"]*)"/g)],id=attributes.find(a=>a[1]==='id')?.[2]||'translation-node-'+index,node=get(id);
  for(const attribute of attributes)node.setAttribute(attribute[1],attribute[2]);translationNodes.push(node);
 }
 const canonicalHtml=assembleHtml({template,css:'/* synthetic style */',bundle:{licenses:{},samples:[],i18n:Buffer.from(fs.readFileSync(new URL('../../src/i18n.mjs',import.meta.url))).toString('base64'),pdf:'',worker:Buffer.from('// fixture PDF worker').toString('base64'),workerAssets:'',assets:resources},app:source,version:realCore.VERSION});
 get('bundle').textContent=canonicalHtml.match(/<script id="bundle" type="application\/json">([\s\S]*?)<\/script>/)[1];
 const document={getElementById:get,documentElement:get('documentElement'),title:'',querySelectorAll(selector){const attributes=[...selector.matchAll(/\[([\w-]+)\]/g)].map(m=>m[1]);return translationNodes.filter(node=>attributes.some(attribute=>node.getAttribute(attribute)!==null));},querySelector(selector){return selector.startsWith('#')?get(selector.slice(1)):this.querySelectorAll(selector)[0]??null;},createElement(tag){return tag==='canvas'?{width:0,height:0,getContext(){return context2d;},toBlob(callback,type){callback(new Blob([type==='image/png'?png:jpeg],{type}));}}:{click(){saved.push({name:this.download,blob:blobs.get(this.href)});},remove(){}};},body:{append(){}}};
 class ReviewURL extends URL{static createObjectURL(blob){const key='blob:review-'+(++blobId);blobs.set(key,blob);return key;}static revokeObjectURL(key){blobs.delete(key);}}
 const core={...realCore,paintWatermark(...args){counts.paint++;return realCore.paintWatermark(...args);},embedTrace(...args){counts.embed++;return overrides.embedTrace?overrides.embedTrace(...args):args[0];},detectTrace(...args){counts.detect++;return overrides.detectTrace?overrides.detectTrace(...args):null;}};
 const transformed=source.replace("const coreUrl=moduleUrl(bundle.core),core=await import(coreUrl);URL.revokeObjectURL(coreUrl);",'const core=__core;')
  .replace('const preferencesUrl=moduleUrl(bundle.preferences),preferences=await import(preferencesUrl);URL.revokeObjectURL(preferencesUrl);','const preferences=__preferences;')
  .replace('const i18nUrl=moduleUrl(bundle.i18n),i18nModule=await import(i18nUrl);URL.revokeObjectURL(i18nUrl);','const i18nModule=__i18n;')
  .replace('lib=await import(url)','lib=__pdfLibrary').replace('{workerPrelude}=await import(bridgeUrl)','{workerPrelude}=__workerAssets').replace('const MAX_OUTPUT_BYTES=MAX_FILE_BYTES;','const MAX_OUTPUT_BYTES=__outputLimit;');
 const sandbox={document,navigator:{language:overrides.navigatorLanguage||"en-US"},location:{protocol:overrides.protocol||'https:'},localStorage:storage,addEventListener:(name,fn)=>windowListeners.set(name,fn),Date:class extends Date{constructor(...args){super(...(args.length?args:[exportDate.getTime()]));}static now(){return exportDate.getTime();}},crypto:globalThis.crypto,URL:ReviewURL,Blob,atob,Uint8Array,Uint8ClampedArray,TextDecoder,console,Image:class {constructor(){this.naturalWidth=overrides.imageWidth||512;this.naturalHeight=overrides.imageHeight||512;}async decode(){counts.decoded++;counts.liveImages++;counts.maxLiveImages=Math.max(counts.maxLiveImages,counts.liveImages);this.loaded=true;}removeAttribute(name){if(name==='src'&&this.loaded){counts.released++;counts.liveImages--;this.loaded=false;}}},Worker:class {constructor(url,options){this.options=options;workerScripts.push(blobs.get(url));}},__core:core,__preferences:preferences,__i18n:i18nModule,__workerAssets:workerAssets,__pdfLibrary:overrides.pdfLibrary,__outputLimit:overrides.outputLimit??160*1024*1024,
  setTimeout(fn,delay){const timer=setTimeout(fn,delay);if(delay===30000)timer.unref();return timer;},clearTimeout};
 await vm.runInContext('(async()=>{'+transformed+';globalThis.review={getState:()=>({total:total(),current,pdfDoc,pdfTask,sources,generation,busy,previewValid,lastRecords,sessionActive}),setPdf:(doc,task)=>{pdfDoc=doc;pdfTask=task;},setLibrary:p=>{pdfPromise=p;},cleanup,preview,showDemo,exportFiles,updateControls,persistPreferences};})()',vm.createContext(sandbox));
 return {get,review:sandbox.review,counts,saved,workerScripts,resources,canonicalHtml,document,storage,windowListeners,translationNodes,elements};
}
function pdfDoc({failPage=0,renderWait=null,numPages=1}={}){return {numPages,async getPage(pageNumber){return {getViewport({scale}){return {width:600*scale,height:800*scale};},render(){return {promise:pageNumber===failPage?Promise.reject(Error('fixture render failed')):renderWait||Promise.resolve()};},cleanup(){}};}};}
function library(document){return Promise.resolve({lib:{getDocument(){return {promise:Promise.resolve(document),destroy:async()=>{}};}},EmbeddedDataFactory:class {}});}
async function importPdf(a,doc){a.review.setLibrary(library(doc));const input=a.get('file');input.files=[{name:'fixture.pdf',type:'application/pdf',size:10,arrayBuffer:async()=>new ArrayBuffer(10)}];return input.listeners.change({target:input});}
function requestUnload(a){const event={prevented:false,preventDefault(){this.prevented=true;}};a.windowListeners.get('beforeunload')(event);return event;}
function editControl(a,id,event,value){const control=a.get(id);if(typeof value==='boolean')control.checked=value;else control.value=value;assert.equal(typeof control.listeners[event],'function',id+' must handle '+event);return control.listeners[event]({type:event,target:control});}


export {app,deferred,memoryStorage,exportDate,exportedId,pdfDoc,library,importPdf,requestUnload,editControl,png,jpeg};
