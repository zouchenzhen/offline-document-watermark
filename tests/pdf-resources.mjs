// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
// Run: node tests/pdf-resources.mjs
// Optional pixel rendering: add --canvas-module /path/to/canvas/index.js
// and --render-dir test-output/pdf-resources. No external URLs are fetched.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {installEmbeddedResources} from '../src/worker-assets.mjs';

const project=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const option=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
// The browser bundle uses newer standard APIs than Node 22 currently provides.
// These compatibility shims affect the test runner, not the published app.
Promise.try||=(callback,...args)=>new Promise(resolve=>resolve(callback(...args)));
Map.prototype.getOrInsertComputed||=function(key,callback){if(!this.has(key))this.set(key,callback(key));return this.get(key);};
Uint8Array.prototype.toHex||=function(){return Buffer.from(this).toString('hex');};
let canvasModule=null;
if(option('--canvas-module')){
 canvasModule=await import(pathToFileURL(path.resolve(option('--canvas-module'))).href);
 for(const key of ['DOMMatrix','ImageData','Path2D'])globalThis[key]=canvasModule[key];
}else{
 // The browser bundle constructs an otherwise unused matrix at module import.
 // Operator-list/decoder checks do not execute canvas code or use this stub.
 globalThis.DOMMatrix=class DOMMatrix{};
}
class FixtureCanvasFactory{
 create(width,height){const canvas=canvasModule.createCanvas(width,height);return {canvas,context:canvas.getContext('2d')};}
 reset(value,width,height){value.canvas.width=width;value.canvas.height=height;}
 destroy(value){value.canvas.width=value.canvas.height=0;value.canvas=null;value.context=null;}
}
const pdfjs=await import('../vendor/pdfjs/pdf.min.mjs');
pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
const resources={};
for(const folder of ['cmaps','standard_fonts','iccs','wasm']){
 for(const entry of await fs.readdir(path.join(project,'vendor/pdfjs',folder),{withFileTypes:true})){
  if(entry.isFile())resources[folder+'/'+entry.name]=(await fs.readFile(path.join(project,'vendor/pdfjs',folder,entry.name))).toString('base64');
 }
}
const originalFetch=globalThis.fetch,originalXHR=globalThis.XMLHttpRequest,reads=[];
installEmbeddedResources(resources);
const bridgeFetch=globalThis.fetch,BridgeXHR=globalThis.XMLHttpRequest;
globalThis.fetch=(input,options)=>{reads.push({kind:'async',url:typeof input==='string'?input:input.url});return bridgeFetch(input,options);};
globalThis.XMLHttpRequest=class extends BridgeXHR{open(method,url,async=true){reads.push({kind:async?'async-xhr':'sync',url});return super.open(method,url,async);}};
const results=[];
try{
 for(const fixture of ['standard-fonts-cmyk.pdf','embedded-cmyk-profile.pdf','synthetic-jpeg-scan.pdf','synthetic-jpeg2000.pdf']){
  const before=reads.length,bytes=new Uint8Array(await fs.readFile(path.join(project,'tests/fixtures',fixture)));
  const task=pdfjs.getDocument({data:bytes,useWorkerFetch:true,useSystemFonts:false,useWasm:true,cMapUrl:'offline-asset://cmaps/',standardFontDataUrl:'offline-asset://standard_fonts/',wasmUrl:'offline-asset://wasm/',iccUrl:'offline-asset://iccs/',isEvalSupported:false,stopAtErrors:true,verbosity:1,...(canvasModule?{CanvasFactory:FixtureCanvasFactory}:{})});
  try{
   const doc=await task.promise;assert.equal(doc.numPages,1);
   const page=await doc.getPage(1),text=await page.getTextContent(),ops=await page.getOperatorList();
   assert(text.items.some(t=>t.str?.includes('SYNTHETIC')));
   const colors=ops.fnArray.flatMap((code,i)=>code===pdfjs.OPS.setFillRGBColor?[ops.argsArray[i]]:[]);
   const imageIds=ops.fnArray.flatMap((code,i)=>code===pdfjs.OPS.paintImageXObject?[ops.argsArray[i][0]]:[]);
   const images=[];
   for(const id of imageIds){
    const image=await new Promise(resolve=>page.objs.get(id,resolve));
    assert.equal(image.width,384);assert.equal(image.height,256);assert(image.data instanceof Uint8Array||image.data instanceof Uint8ClampedArray);
    const channels=image.data.length/(image.width*image.height);assert([3,4].includes(channels));
    const pixel=(x,y)=>[...image.data.slice((y*image.width+x)*channels,(y*image.width+x)*channels+3)];
    const red=pixel(50,90),green=pixel(140,90),blue=pixel(235,90);
    assert(red[0]>220&&red[1]<40&&red[2]<40);assert(green[1]>220&&green[0]<40&&green[2]<40);assert(blue[2]>220&&blue[0]<40&&blue[1]<40);
    images.push({width:image.width,height:image.height,channels,red,green,blue});
   }
   if(fixture.includes('cmyk')||fixture.includes('profile')){
    const values=colors.map(c=>c[0]);
    for(const expected of ['#00adef','#ea028c','#fff100','#221f21','#404040','#808080','#bfbfbf','#ffffff'])assert(values.includes(expected),`Missing converted color ${expected} in ${fixture}`);
   }
   if(fixture.includes('jpeg'))assert.equal(images.length,1);
   let render=null;
   if(canvasModule&&option('--render-dir')){
    const viewport=page.getViewport({scale:1}),canvas=canvasModule.createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),context=canvas.getContext('2d');
    await page.render({canvasContext:context,viewport}).promise;
    const output=path.resolve(project,option('--render-dir'));await fs.mkdir(output,{recursive:true});
    const filename=fixture.replace(/\.pdf$/,'.png');await fs.writeFile(path.join(output,filename),await canvas.encode('png'));
    render={width:canvas.width,height:canvas.height,file:filename};
   }
   results.push({fixture,textItems:text.items.length,operators:ops.fnArray.length,colors,images,reads:reads.slice(before),render});
  }finally{await task.destroy();}
 }
 assert(reads.some(r=>r.kind==='sync'&&r.url==='offline-asset://wasm/qcms_bg.wasm'));
 assert(reads.some(r=>r.kind==='sync'&&r.url==='offline-asset://iccs/CGATS001Compat-v2-micro.icc'));
 assert(reads.some(r=>r.kind==='async'&&r.url==='offline-asset://wasm/openjpeg.wasm'));
 assert(reads.some(r=>r.kind==='async'&&r.url.startsWith('offline-asset://standard_fonts/')));
 assert(reads.every(r=>r.url.startsWith('offline-asset://')));
 console.log(JSON.stringify({pdfjs:pdfjs.version,resourceBridge:'src/worker-assets.mjs',canvasRendered:!!canvasModule&&!!option('--render-dir'),externalReads:0,results},null,2));
}finally{globalThis.fetch=originalFetch;globalThis.XMLHttpRequest=originalXHR;}
