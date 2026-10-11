// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
const $=id=>document.getElementById(id),bundle=JSON.parse($('bundle').textContent);
function decode64(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
function moduleUrl(s){return URL.createObjectURL(new Blob([decode64(s)],{type:'text/javascript'}));}
const coreUrl=moduleUrl(bundle.core),core=await import(coreUrl);URL.revokeObjectURL(coreUrl);
$('licenses').textContent=Object.entries(bundle.licenses).map(([name,text])=>name+'\n'+text).join('\n\n');
if(location.protocol==='file:'){$('offlineDownload').removeAttribute('href');$('offlineDownload').removeAttribute('download');$('offlineDownload').textContent='当前为离线文件';}
if(!URL.parse)URL.parse=(url,base)=>{try{return new URL(url,base);}catch{return null;}};
const canvas=$('canvas'),ctx=canvas.getContext('2d');
const MAX_FILE_BYTES=160*1024*1024;
const MAX_OUTPUT_BYTES=MAX_FILE_BYTES;
const MAX_INPUT_TOTAL_BYTES=MAX_FILE_BYTES;
let sources=[],pdfDoc=null,pdfTask=null,current=0,generation=0,previewGeneration=0,pdfPromise=null,previewTimer=null,busy=false,previewValid=false,lastRecords=[],loadedDemo=true;
function status(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error);}
function freshTrace(){const b=crypto.getRandomValues(new Uint8Array(8));$('trace').value=[...b].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();}
function settings(){
 const mode=$('mode').value;let region={x:0,y:0,w:100,h:100};if($('scope').value==='top')region.h=50;if($('scope').value==='bottom'){region.y=50;region.h=50;}
 if(mode!=='flatten'&&$('scope').value==='custom'){region={x:Number($('rx').value),y:Number($('ry').value),w:Number($('rw').value),h:Number($('rh').value)};if(!Object.values(region).every(Number.isFinite)||region.x<0||region.y<0||region.w<=0||region.h<=0||region.x+region.w>100||region.y+region.h>100)throw Error('自定义覆盖矩形必须位于页面内。');}
 return {mode,text:$('text').value.trim(),opacity:Number($('opacity').value)/100,size:Number($('size').value),angle:Number($('angle').value),density:Number($('density').value),color:$('color').value,region};
}
function total(){return pdfDoc?.numPages||sources.length;}
function updateControls(){
 const flatten=$('mode').value==='flatten';
 ['opacity','size','angle','density','quality'].forEach(id=>$(id+'Value').textContent=$(id).value+(id==='angle'?'°':id==='opacity'||id==='quality'?'%':''));
 $('pagesBox').hidden=total()<2;$('regionBox').hidden=flatten||$('scope').value!=='custom';$('pageLabel').textContent=total()?`${current+1} / ${total()}`:'无材料';
 $('textLabel').textContent=flatten?'补充用途说明（可留空，仅写入勾选的元信息）':'用途、接收方和日期（可换行）';
 $('modeHint').textContent=flatten?'保留当前页面外观并合成图片型发送版，不添加新的可见水印。原有水印文字不会被提取；隐藏标记和元信息仍可自行选择。':'添加新的用途水印，导出时与页面图像融合。';
 const locked=busy||!total()||!previewValid||(!flatten&&!$('text').value.trim());['png','jpg','pdf'].forEach(id=>$(id).disabled=locked);
 $('prev').disabled=busy||current===0;$('next').disabled=busy||current>=total()-1;$('manifest').disabled=!lastRecords.length||busy;
 $('file').disabled=$('demo').disabled=$('clear').disabled=$('sampleImages').disabled=$('samplePdf').disabled=busy;
 ['mode','text','dpi','longSide','quality','hiddenMark','metadata','trace','newTrace','pages','verifyFile'].forEach(id=>$(id).disabled=busy);
 ['density','opacity','size','angle','color','scope','rx','ry','rw','rh'].forEach(id=>$(id).disabled=busy||flatten);
}
async function pdfLibrary(){
 if(!pdfPromise)pdfPromise=(async()=>{const url=moduleUrl(bundle.pdf),lib=await import(url);URL.revokeObjectURL(url);const bridgeUrl=moduleUrl(bundle.workerAssets),{workerPrelude}=await import(bridgeUrl);URL.revokeObjectURL(bridgeUrl);const workerUrl=URL.createObjectURL(new Blob([workerPrelude(bundle.assets),new TextDecoder().decode(decode64(bundle.worker))],{type:'text/javascript'}));lib.GlobalWorkerOptions.workerPort=new Worker(workerUrl,{type:'module'});
  return {lib};})();return pdfPromise;
}
async function decodeImage(blob){const url=URL.createObjectURL(blob),im=new Image();try{im.src=url;await im.decode();return im;}finally{URL.revokeObjectURL(url);}}
function releaseImage(im){im.removeAttribute('src');}
async function imageSource(blob){const im=await decodeImage(blob);try{if(im.naturalWidth*im.naturalHeight>40000000)throw Error('单张图片超过 4000 万像素，请先缩小。');return {blob,width:im.naturalWidth,height:im.naturalHeight};}finally{releaseImage(im);}}
async function openPdf(data){const {lib}=await pdfLibrary();pdfTask=lib.getDocument({data,useWorkerFetch:true,useSystemFonts:false,cMapUrl:'offline-asset://cmaps/',standardFontDataUrl:'offline-asset://standard_fonts/',wasmUrl:'offline-asset://wasm/',iccUrl:'offline-asset://iccs/',isEvalSupported:false,enableXfa:false,disableAutoFetch:true,maxImageSize:40000000,canvasMaxAreaInBytes:96000000,verbosity:0});pdfDoc=await pdfTask.promise;if(pdfDoc.numPages>100)throw Error('暂时只支持最多 100 页的 PDF。');}
async function cleanup(){generation++;previewGeneration++;previewValid=false;clearTimeout(previewTimer);sources=[];current=0;lastRecords=[];const task=pdfTask;pdfTask=null;pdfDoc=null;$('pages').value='';$('verifyFile').value='';$('verification').textContent='尚未选择验证文件。';if(task)await task.destroy().catch(()=>{});}
function makeDemo(){const c=document.createElement('canvas');c.width=1100;c.height=1000;const p=c.getContext('2d');p.fillStyle='#fff';p.fillRect(0,0,1100,1000);for(const y of [65,535]){p.fillStyle='#dce9ee';p.beginPath();p.roundRect(110,y,880,350,22);p.fill();}p.fillStyle='#365267';p.font='25px "Microsoft YaHei",sans-serif';['虚构证件 · 仅用于水印效果演示','姓名    示例用户','出生    2000 年 1 月 1 日','住址    示例省示例市示例路','号码    XXXX XXXX XXXX XXXX'].forEach((s,i)=>p.fillText(s,150,125+i*55));p.fillText('示例证件 · 背面',375,620);p.fillText('签发机关    示例机构',180,780);p.fillText('有效期限    示例日期 — 示例日期',180,840);p.fillStyle='#91adbc';p.beginPath();p.arc(840,200,45,0,Math.PI*2);p.fill();p.fillRect(790,250,100,100);return c;}
async function showDemo(){if(busy)return;busy=true;updateControls();try{await cleanup();sources=[makeDemo()];loadedDemo=true;freshTrace();if(await preview())status('当前是虚构示例，不含真实身份证资料。');}finally{busy=false;updateControls();}}
async function renderBase(index,forPreview=false,output=null){
 const c=document.createElement('canvas');let pageWidth,pageHeight;
 if(pdfDoc){const page=await pdfDoc.getPage(index+1),unit=page.getViewport({scale:1}),dpi=output?.dpi||Number($('dpi').value),requested=forPreview?Math.min(1.8,1100/Math.max(unit.width,unit.height)):dpi/72;
  const view=page.getViewport({scale:requested}),size=core.scaledSize(view.width,view.height,forPreview?1100:(output?.longSide??Number($('longSide').value)),forPreview?1800000:24000000),viewport=page.getViewport({scale:requested*size.ratio});
  const w=Math.max(1,Math.round(viewport.width)),h=Math.max(1,Math.round(viewport.height));if(w>16384||h>16384)throw Error('页面过长，请设置较小的输出最长边。');c.width=w;c.height=h;const p=c.getContext('2d');if(!p)throw Error('浏览器无法创建页面画布，请减小输出尺寸。');p.fillStyle='#fff';p.fillRect(0,0,c.width,c.height);try{await page.render({canvasContext:p,viewport,background:'#ffffff'}).promise;}finally{page.cleanup();}pageWidth=unit.width;pageHeight=unit.height;
 }else{const source=sources[index],im=source.blob?await decodeImage(source.blob):source;try{const w=source.width||im.naturalWidth||im.width,h=source.height||im.naturalHeight||im.height,size=core.scaledSize(w,h,forPreview?1100:(output?.longSide??Number($('longSide').value)),forPreview?1800000:24000000);if(size.width>16384||size.height>16384)throw Error('图片过长，请设置较小的输出最长边。');c.width=size.width;c.height=size.height;const p=c.getContext('2d');if(!p)throw Error('浏览器无法创建图片画布，请减小输出尺寸。');p.fillStyle='#fff';p.fillRect(0,0,c.width,c.height);p.drawImage(im,0,0,c.width,c.height);}finally{if(source.blob)releaseImage(im);}}
 return {canvas:c,pageWidth,pageHeight};
}
async function preview(){
 previewValid=false;updateControls();if(!total()){canvas.width=1100;canvas.height=300;ctx.clearRect(0,0,1100,300);$('previewTitle').textContent='材料已清空';$('dimensions').textContent='';return false;}
 const version=++previewGeneration,gen=generation;let base;try{const s=settings();base=await renderBase(current,true);if(version!==previewGeneration||gen!==generation)return false;if(s.mode!=='flatten')core.paintWatermark(base.canvas.getContext('2d'),base.canvas.width,base.canvas.height,s);canvas.width=base.canvas.width;canvas.height=base.canvas.height;ctx.drawImage(base.canvas,0,0);$('dimensions').textContent=`预览 ${canvas.width} × ${canvas.height}`;$('previewTitle').textContent=s.mode==='flatten'?'材料 · 保留已有外观':loadedDemo?'虚构示例 · 水印效果':'材料 · 可见水印预览';previewValid=true;updateControls();if(!busy)status('预览已更新。保存前请检查材料可辨认程度。');return true;}catch(e){if(version===previewGeneration&&gen===generation){canvas.width=1100;canvas.height=300;ctx.clearRect(0,0,1100,300);$('previewTitle').textContent='预览失败 · 请检查材料或设置';$('dimensions').textContent='';status('预览失败：'+e.message,true);updateControls();}return false;}finally{if(base)base.canvas.width=base.canvas.height=1;}
}
function schedulePreview(){previewValid=false;updateControls();clearTimeout(previewTimer);previewTimer=setTimeout(preview,140);}
$('file').addEventListener('change',async e=>{
 const files=[...e.target.files];if(busy||!files.length)return;busy=true;updateControls();try{await cleanup();loadedDemo=false;const gen=generation;if(files.length>30)throw Error('一次最多导入 30 张图片。');if(files.some(f=>f.size>MAX_FILE_BYTES))throw Error('单个文件超过 160 MiB，请先减小文件。');if(files.reduce((sum,f)=>sum+f.size,0)>MAX_INPUT_TOTAL_BYTES)throw Error('本次文件总量超过 160 MiB，请分批导入。');
  const pdfs=files.filter(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name));if(pdfs.length){if(files.length!==1)throw Error('请选择一个 PDF，或多张图片；暂不混合导入。');status('正在本地解析 PDF…');await openPdf(new Uint8Array(await files[0].arrayBuffer()));
  }else{for(const f of files){if(!['image/png','image/jpeg','image/webp'].includes(f.type))throw Error('请选择 PNG、JPEG、WebP 或 PDF。');sources.push(await imageSource(f));}}
  if(gen!==generation)return;freshTrace();if(await preview())status(`已在本地导入 ${total()} 页。请检查页面外观和材料可辨认程度。`);
 }catch(err){await cleanup();await preview();status(err.name==='PasswordException'?'此 PDF 有密码保护，请先在本地解密后再导入。':err.message,true);}finally{busy=false;e.target.value='';updateControls();}
});
const yieldUi=()=>new Promise(resolve=>setTimeout(resolve,0));
function save(bytes,type,name){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function toBlob(c,type,quality){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('浏览器无法导出这张图片，请减小尺寸。')),type,quality));}
async function sha(bytes){if(!crypto.subtle)return null;const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return [...hash].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function verifyJpegTrace(bytes,traceId){const im=await decodeImage(new Blob([bytes],{type:'image/jpeg'})),c=document.createElement('canvas');try{c.width=im.naturalWidth;c.height=im.naturalHeight;const p=c.getContext('2d');p.drawImage(im,0,0);const mark=core.detectTrace(p.getImageData(0,0,c.width,c.height));if(mark?.traceId!==traceId)throw Error('JPEG 压缩后未能确认隐藏标记，已停止保存。请提高图片质量或输出尺寸，或关闭实验性隐藏标记后重试。');}finally{c.width=c.height=1;releaseImage(im);}}
function checkOutputSize(size){if(size>MAX_OUTPUT_BYTES)throw Error('输出文件超过 160 MiB，已停止保存。请降低图片质量或输出最长边，或按页码分批导出。');}
async function exportFiles(format){
 if(busy||!total()||!previewValid)return;busy=true;clearTimeout(previewTimer);previewGeneration++;updateControls();
 try{const s=settings();if(s.mode!=='flatten'&&!s.text)throw Error('请输入用途水印。');const traceId=core.normalizeTrace($('trace').value),hidden=$('hiddenMark').checked,metadata=$('metadata').checked,quality=Number($('quality').value)/100,dpi=Number($('dpi').value),longSide=Number($('longSide').value),indices=format==='pdf'?core.parsePages($('pages').value,total()).map(n=>n-1):[current];if(indices.length>30)throw Error('一次最多导出 30 页，请分批选择页码。');
  const meta={tool:'Offline Document Watermark',version:core.VERSION,traceId,processingMode:s.mode,watermark:s.mode==='flatten'?'':s.text,purposeNote:s.mode==='flatten'?s.text:null,createdAt:new Date().toISOString(),hiddenMarker:hidden?'experimental-dct-v1':null,dpi,quality,longSide,sourcePages:indices.map(i=>i+1),pagePixels:[]};const pages=[];let result,pdfBytes=0;
  for(let n=0;n<indices.length;n++){status(`正在本地处理第 ${n+1} / ${indices.length} 页…`);await yieldUi();const base=await renderBase(indices[n],false,{dpi,longSide}),c=base.canvas,p=c.getContext('2d');if(s.mode!=='flatten')core.paintWatermark(p,c.width,c.height,s);if(hidden){const pixels=p.getImageData(0,0,c.width,c.height);core.embedTrace(pixels,traceId);p.putImageData(pixels,0,0);}meta.pagePixels.push({width:c.width,height:c.height});
   const width=c.width,height=c.height,type=format==='png'?'image/png':'image/jpeg',blob=await toBlob(c,type,quality);c.width=c.height=1;checkOutputSize(format==='pdf'?pdfBytes+blob.size:blob.size);let bytes=new Uint8Array(await blob.arrayBuffer());if(hidden&&format!=='png')await verifyJpegTrace(bytes,traceId);if(format==='pdf'){pdfBytes+=bytes.length;pages.push({jpeg:bytes,width,height,pageWidth:base.pageWidth,pageHeight:base.pageHeight});}else{if(metadata)bytes=format==='png'?core.addPngMetadata(bytes,meta):core.addJpegMetadata(bytes,meta);result=bytes;}
  }
  if(format==='pdf')result=core.buildPdf(pages,metadata?meta:null);checkOutputSize(result.length);const name=(loadedDemo?'sample':'watermarked')+'-'+traceId+'.'+(format==='jpg'?'jpg':format);save(result,format==='pdf'?'application/pdf':format==='png'?'image/png':'image/jpeg',name);lastRecords.push({filename:name,sha256:await sha(result),metadataWritten:metadata,...meta});status(`已发起保存 ${name}。建议同时保存追踪记录；编号不是身份或传播证据。`);
 }catch(e){status(e.message,true);}finally{busy=false;updateControls();}
}
$('png').onclick=()=>exportFiles('png');$('jpg').onclick=()=>exportFiles('jpg');$('pdf').onclick=()=>exportFiles('pdf');
$('manifest').onclick=()=>save(core.utf8(JSON.stringify({tool:'Offline Document Watermark',version:core.VERSION,records:lastRecords},null,2)),'application/json','watermark-trace-records.json');
$('prev').onclick=()=>{if(current>0){current--;preview();}};$('next').onclick=()=>{if(current<total()-1){current++;preview();}};
$('newTrace').onclick=freshTrace;$('demo').onclick=showDemo;$('clear').onclick=async()=>{if(busy)return;busy=true;updateControls();try{await cleanup();$('file').value='';freshTrace();await preview();status('材料已清空。关闭页面可结束本次处理。');}finally{busy=false;updateControls();}};
async function showPublicSamples(asPdf){if(busy)return;busy=true;updateControls();try{await cleanup();loadedDemo=true;status('正在本地加载公开演示样本…');if(asPdf){const pages=bundle.samples.map(s=>({width:s.width,height:s.height,jpeg:decode64(s.jpeg)}));await openPdf(core.buildPdf(pages));}else{for(const s of bundle.samples)sources.push(await imageSource(new Blob([decode64(s.jpeg)],{type:'image/jpeg'})));}freshTrace();if(await preview())status('已加载两个公开演示样本，不含真实身份证或私人测评结果。');}catch(e){await cleanup();await preview();status(e.message,true);}finally{busy=false;updateControls();}}
$('sampleImages').onclick=()=>showPublicSamples(false);$('samplePdf').onclick=()=>showPublicSamples(true);
['mode','text','density','opacity','size','angle','color','scope','rx','ry','rw','rh'].forEach(id=>$(id).addEventListener('input',schedulePreview));['dpi','longSide','quality','hiddenMark','metadata'].forEach(id=>$(id).addEventListener('input',updateControls));
$('verifyFile').addEventListener('change',async e=>{
 const f=e.target.files[0];if(busy||!f)return;busy=true;updateControls();const box=$('verification');box.textContent='正在本地验证…';try{if(f.size>MAX_FILE_BYTES)throw Error('验证文件超过 160 MiB。');const bytes=new Uint8Array(await f.arrayBuffer()),isPdf=f.type==='application/pdf'||/\.pdf$/i.test(f.name);let metadata,pixelBlob;
  if(isPdf){const own=core.inspectOwnPdf(bytes);metadata=own.metadata;if(own.jpeg)pixelBlob=new Blob([own.jpeg],{type:'image/jpeg'});}else{metadata=core.readMetadata(bytes);pixelBlob=f;}
  let mark=null;if(pixelBlob){const im=await decodeImage(pixelBlob),c=document.createElement('canvas');try{if(im.naturalWidth*im.naturalHeight>24000000)throw Error('验证图片超过 2400 万像素。');c.width=im.naturalWidth;c.height=im.naturalHeight;const p=c.getContext('2d');p.drawImage(im,0,0);mark=core.detectTrace(p.getImageData(0,0,c.width,c.height));}finally{c.width=c.height=1;releaseImage(im);}}
  const purpose=metadata?.processingMode==='flatten'?`处理方式：仅合成发送版，未提取原有水印文字。\n补充用途说明：${metadata.purposeNote||'无'}`:`用途水印：${metadata?.watermark||'无'}`;
  const lines=[metadata?`元信息编号：${metadata.traceId||'无'}\n${purpose}`:'未发现本工具的元信息。',mark?`隐藏标记编号：${mark.traceId}`:'未检出有效隐藏标记（可能未嵌入或已被处理破坏）。'];if(metadata&&mark)lines.push(metadata.traceId===mark.traceId?'元信息与隐藏编号一致。':'两个编号不一致，请核对原始记录。');if(isPdf)lines.push('像素验证仅覆盖本工具 PDF 格式的第一页。');lines.push('这不是真实性认证，也不能单独证明文件由谁传播。');box.textContent=lines.join('\n\n');
 }catch(err){box.textContent='验证失败：'+err.message;}finally{busy=false;e.target.value='';updateControls();}
});
freshTrace();await showDemo();
