// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
const $=id=>document.getElementById(id),bundle=JSON.parse($('bundle').textContent);
function decode64(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
function moduleUrl(s){return URL.createObjectURL(new Blob([decode64(s)],{type:'text/javascript'}));}
const coreUrl=moduleUrl(bundle.core),core=await import(coreUrl);URL.revokeObjectURL(coreUrl);
const preferencesUrl=moduleUrl(bundle.preferences),preferences=await import(preferencesUrl);URL.revokeObjectURL(preferencesUrl);
const i18nUrl=moduleUrl(bundle.i18n),i18nModule=await import(i18nUrl);URL.revokeObjectURL(i18nUrl);
const i18n=i18nModule.createI18n('zh-CN'),dynamicText=new Map();
$('licenses').textContent=Object.entries(bundle.licenses).map(([name,text])=>name+'\n'+text).join('\n\n');
if(location.protocol==='file:'){$('offlineDownload').removeAttribute('href');$('offlineDownload').removeAttribute('download');setText('offlineDownload','download.current');}
else $('offlineDownload').onclick=e=>{e.preventDefault();try{const tool=new Blob([decode64(bundle.documentPrefix),$('bundle').textContent,decode64(bundle.documentSuffix)],{type:'text/html;charset=utf-8'});save(tool,'text/html;charset=utf-8','offline-watermark-v'+core.VERSION+'.html');status('status.offlineSaved');}catch(err){status('status.offlineFailed',true,{error:err.message});}};
if(!URL.parse)URL.parse=(url,base)=>{try{return new URL(url,base);}catch{return null;}};
const canvas=$('canvas'),ctx=canvas.getContext('2d');
const MAX_FILE_BYTES=160*1024*1024;
const MAX_OUTPUT_BYTES=MAX_FILE_BYTES;
const MAX_INPUT_TOTAL_BYTES=MAX_FILE_BYTES;
let sources=[],pdfDoc=null,pdfTask=null,current=0,generation=0,previewGeneration=0,pdfPromise=null,previewTimer=null,preferencesTimer=null,busy=false,previewValid=false,lastRecords=[],loadedDemo=true,fictionalDemo=false,sessionActive=false,preferencesDirty=false,uiReady=false,verificationState={kind:'idle'};
const numericPreferences=['density','opacity','size','angle','rx','ry','rw','rh','dpi','longSide','quality'],booleanPreferences=['hiddenMark','metadata','timePrefix'],textPreferences=['text','color','scope'];
let settingsStorage;try{settingsStorage=globalThis.localStorage;}catch{}
let savedPreferences=preferences.readPreferences(settingsStorage);
function translatedParams(params){return Object.hasOwn(params,'error')?{...params,error:i18n.error(params.error)}:params;}
function setText(id,key,params={}){dynamicText.set(id,{key,params});$(id).textContent=i18n.t(key,translatedParams(params));}
function clearText(id){dynamicText.delete(id);$(id).textContent='';}
function status(key,error=false,params={}){setText('status',key,params);$('status').classList.toggle('error',error);}
function currentMode(){return $('addVisibleWatermark').checked?'add':'flatten';}
function currentPreferences(){const config={mode:currentMode(),language:i18n.language};for(const id of numericPreferences)config[id]=Number($(id).value);for(const id of booleanPreferences)config[id]=$(id).checked;for(const id of textPreferences)config[id]=$(id).value;return config;}
function applyPreferences(config){if(!config)return;const previousLanguage=i18n.language;for(const [id,value]of Object.entries(config)){if(id==='language')i18n.setLanguage(value);else if(id==='mode')$('addVisibleWatermark').checked=value==='add';else if(booleanPreferences.includes(id))$(id).checked=value;else $(id).value=String(value);}if(uiReady){if(fictionalDemo&&previousLanguage!==i18n.language)sources=[makeDemo()];refreshLanguage();}}
function updateLeaveHint(){setText('leaveHint',sessionActive||preferencesDirty||busy?'leave.active':'leave.inactive');}
function markSessionActive(){sessionActive=true;updateLeaveHint();}
function updatePreferenceHistory(){const select=$('configHistory'),selected=select.value;select.innerHTML='';const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=i18n.t(savedPreferences.history.length?'config.choose':'config.none');select.append(placeholder);for(const entry of savedPreferences.history){const option=document.createElement('option');option.value=entry.id;option.textContent=new Date(entry.time).toLocaleString(i18n.language)+' · '+preferences.summarizePreferences(entry.config,{language:i18n.language})+' · '+(entry.config.dpi||300)+' dpi';select.append(option);}if(savedPreferences.history.some(entry=>entry.id===selected))select.value=selected;}
function persistPreferences(){clearTimeout(preferencesTimer);preferencesTimer=null;if(!$('rememberConfig').checked)return;savedPreferences=preferences.writePreferences(settingsStorage,currentPreferences());if(savedPreferences.saved)preferencesDirty=false;updatePreferenceHistory();setText('configStatus',savedPreferences.error?'config.saveFailed':'config.saved');}
function schedulePreferences(){markSessionActive();preferencesDirty=true;clearTimeout(preferencesTimer);if($('rememberConfig').checked)preferencesTimer=setTimeout(persistPreferences,450);}
function clearSavedPreferences(){clearTimeout(preferencesTimer);preferencesTimer=null;preferencesDirty=true;const result=preferences.clearPreferences(settingsStorage);savedPreferences=preferences.readPreferences(settingsStorage);$('rememberConfig').checked=false;updatePreferenceHistory();setText('configStatus',result.error?'config.clearFailed':'config.cleared');}
applyPreferences(savedPreferences.latest);$('rememberConfig').checked=savedPreferences.enabled&&!savedPreferences.error;updatePreferenceHistory();setText('configStatus',savedPreferences.error?'config.unavailable':!savedPreferences.enabled?'config.disabled':savedPreferences.latest?'config.restored':'config.ready');
function refreshLanguage(){i18nModule.applyTranslations(document,i18n,{version:core.VERSION});for(const [id,{key,params}]of dynamicText)$(id).textContent=i18n.t(key,translatedParams(params));$('languageZh').setAttribute('aria-pressed',String(i18n.language==='zh-CN'));$('languageEn').setAttribute('aria-pressed',String(i18n.language==='en'));updatePreferenceHistory();renderVerification();updateControls();}
async function switchLanguage(language){if(busy||language===i18n.language)return false;i18n.setLanguage(language);refreshLanguage();schedulePreferences();if(fictionalDemo)sources=[makeDemo()];await preview({silent:true});return true;}
$('languageZh').onclick=()=>switchLanguage('zh-CN');$('languageEn').onclick=()=>switchLanguage('en');
globalThis.addEventListener('beforeunload',event=>{if(preferencesTimer)persistPreferences();if(sessionActive||preferencesDirty||busy){event.preventDefault();event.returnValue=true;}});
function freshTrace(){const b=crypto.getRandomValues(new Uint8Array(8));$('trace').value=[...b].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();}
function settings(){
 const mode=currentMode();let region={x:0,y:0,w:100,h:100};if($('scope').value==='top')region.h=50;if($('scope').value==='bottom'){region.y=50;region.h=50;}
 if(mode!=='flatten'&&$('scope').value==='custom'){region={x:Number($('rx').value),y:Number($('ry').value),w:Number($('rw').value),h:Number($('rh').value)};if(!Object.values(region).every(Number.isFinite)||region.x<0||region.y<0||region.w<=0||region.h<=0||region.x+region.w>100||region.y+region.h>100)throw Error('自定义覆盖矩形必须位于页面内。');}
 return {mode,text:$('text').value.trim(),opacity:Number($('opacity').value)/100,size:Number($('size').value),angle:Number($('angle').value),density:Number($('density').value),color:$('color').value,region};
}
function total(){return pdfDoc?.numPages||sources.length;}
function updateControls(){
 const flatten=currentMode()==='flatten';updateLeaveHint();
 setText('pdf',$('pages').value.trim()?'save.pdfSelected':'save.pdf');
 ['opacity','size','angle','density','quality'].forEach(id=>$(id+'Value').textContent=$(id).value+(id==='angle'?'°':id==='opacity'||id==='quality'?'%':''));
 $('pagesBox').hidden=total()<2;$('regionBox').hidden=flatten||$('scope').value!=='custom';if(total()){dynamicText.delete('pageLabel');$('pageLabel').textContent=`${current+1} / ${total()}`;}else setText('pageLabel','preview.none');
 setText('textLabel',flatten?'watermark.note':'watermark.text');
 setText('modeHint',flatten?'watermark.preserveHelp':'watermark.addHelp');
 const locked=busy||!total()||!previewValid||(!flatten&&!$('text').value.trim());['png','jpg','pdf'].forEach(id=>$(id).disabled=locked);
 $('prev').disabled=busy||current===0;$('next').disabled=busy||current>=total()-1;$('manifest').disabled=!lastRecords.length||busy;
 $('file').disabled=$('demo').disabled=$('clear').disabled=$('sampleImages').disabled=$('samplePdf').disabled=busy;
 ['addVisibleWatermark','text','dpi','longSide','quality','hiddenMark','metadata','timePrefix','trace','newTrace','pages','verifyFile','rememberConfig','configHistory','clearConfig','languageZh','languageEn'].forEach(id=>$(id).disabled=busy);$('restoreConfig').disabled=busy||!$('configHistory').value;
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
async function cleanup(){generation++;previewGeneration++;previewValid=false;clearTimeout(previewTimer);sources=[];fictionalDemo=false;current=0;lastRecords=[];const task=pdfTask;pdfTask=null;pdfDoc=null;$('pages').value='';setText('fileNames','files.empty');setText('exportTrace','trace.pending');if(task)await task.destroy().catch(()=>{});}
function clearVerification(){$('verifyFile').value='';setText('verifyName','verify.idle');verificationState={kind:'idle'};renderVerification();}
function makeDemo(){const c=document.createElement('canvas');c.width=1100;c.height=1000;const p=c.getContext('2d');p.fillStyle='#fff';p.fillRect(0,0,1100,1000);for(const y of [65,535]){p.fillStyle='#dce9ee';p.beginPath();p.roundRect(110,y,880,350,22);p.fill();}p.fillStyle='#365267';p.font='25px "Microsoft YaHei",sans-serif';['demo.title','demo.name','demo.birth','demo.address','demo.number'].forEach((key,index)=>p.fillText(i18n.t(key),150,125+index*55));p.fillText(i18n.t('demo.back'),375,620);p.fillText(i18n.t('demo.issuer'),180,780);p.fillText(i18n.t('demo.valid'),180,840);p.fillStyle='#91adbc';p.beginPath();p.arc(840,200,45,0,Math.PI*2);p.fill();p.fillRect(790,250,100,100);return c;}
async function showDemo(){if(busy)return;busy=true;updateControls();try{await cleanup();sources=[makeDemo()];loadedDemo=fictionalDemo=true;setText('fileNames','files.demo');freshTrace();if(await preview())status('status.demo');}finally{busy=false;updateControls();}}
async function renderBase(index,forPreview=false,output=null){
 const c=document.createElement('canvas');let pageWidth,pageHeight;
 if(pdfDoc){const page=await pdfDoc.getPage(index+1),unit=page.getViewport({scale:1}),dpi=output?.dpi||Number($('dpi').value),requested=forPreview?Math.min(1.8,1100/Math.max(unit.width,unit.height)):dpi/72;
  const view=page.getViewport({scale:requested}),size=core.scaledSize(view.width,view.height,forPreview?1100:(output?.longSide??Number($('longSide').value)),forPreview?1800000:24000000),viewport=page.getViewport({scale:requested*size.ratio});
  const w=Math.max(1,Math.round(viewport.width)),h=Math.max(1,Math.round(viewport.height));if(w>16384||h>16384)throw Error('页面过长，请设置较小的输出最长边。');c.width=w;c.height=h;const p=c.getContext('2d');if(!p)throw Error('浏览器无法创建页面画布，请减小输出尺寸。');p.fillStyle='#fff';p.fillRect(0,0,c.width,c.height);try{await page.render({canvasContext:p,viewport,background:'#ffffff'}).promise;}finally{page.cleanup();}pageWidth=unit.width;pageHeight=unit.height;
 }else{const source=sources[index],im=source.blob?await decodeImage(source.blob):source;try{const w=source.width||im.naturalWidth||im.width,h=source.height||im.naturalHeight||im.height,size=core.scaledSize(w,h,forPreview?1100:(output?.longSide??Number($('longSide').value)),forPreview?1800000:24000000);if(size.width>16384||size.height>16384)throw Error('图片过长，请设置较小的输出最长边。');c.width=size.width;c.height=size.height;const p=c.getContext('2d');if(!p)throw Error('浏览器无法创建图片画布，请减小输出尺寸。');p.fillStyle='#fff';p.fillRect(0,0,c.width,c.height);p.drawImage(im,0,0,c.width,c.height);}finally{if(source.blob)releaseImage(im);}}
 return {canvas:c,pageWidth,pageHeight};
}
async function preview({silent=false}={}){
 previewValid=false;updateControls();if(!total()){canvas.width=1100;canvas.height=300;ctx.clearRect(0,0,1100,300);setText('previewTitle','preview.empty');clearText('dimensions');return false;}
 const version=++previewGeneration,gen=generation;let base;try{const s=settings();base=await renderBase(current,true);if(version!==previewGeneration||gen!==generation)return false;if(s.mode!=='flatten')core.paintWatermark(base.canvas.getContext('2d'),base.canvas.width,base.canvas.height,s);canvas.width=base.canvas.width;canvas.height=base.canvas.height;ctx.drawImage(base.canvas,0,0);setText('dimensions','preview.size',{width:canvas.width,height:canvas.height});setText('previewTitle',s.mode==='flatten'?'preview.preserved':loadedDemo?'preview.demo':'preview.material');previewValid=true;updateControls();if(!busy&&!silent)status('status.previewUpdated');return true;}catch(e){if(version===previewGeneration&&gen===generation){canvas.width=1100;canvas.height=300;ctx.clearRect(0,0,1100,300);setText('previewTitle','preview.failed');clearText('dimensions');status('status.previewFailed',true,{error:e.message});updateControls();}return false;}finally{if(base)base.canvas.width=base.canvas.height=1;}
}
function schedulePreview(){previewValid=false;updateControls();clearTimeout(previewTimer);previewTimer=setTimeout(preview,140);}
$('file').addEventListener('change',async e=>{
 const files=[...e.target.files];if(busy||!files.length)return;busy=true;sessionActive=true;updateControls();try{await cleanup();loadedDemo=false;setText('fileNames','files.selected',{names:files.map(f=>f.name).join('\n')});const gen=generation;if(files.length>30)throw Error('一次最多导入 30 张图片。');if(files.some(f=>f.size>MAX_FILE_BYTES))throw Error('单个文件超过 160 MiB，请先减小文件。');if(files.reduce((sum,f)=>sum+f.size,0)>MAX_INPUT_TOTAL_BYTES)throw Error('本次文件总量超过 160 MiB，请分批导入。');
  const pdfs=files.filter(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name));if(pdfs.length){if(files.length!==1)throw Error('请选择一个 PDF，或多张图片；暂不混合导入。');status('status.parsing');await openPdf(new Uint8Array(await files[0].arrayBuffer()));
  }else{for(const f of files){if(!['image/png','image/jpeg','image/webp'].includes(f.type))throw Error('请选择 PNG、JPEG、WebP 或 PDF。');sources.push(await imageSource(f));}}
  if(gen!==generation)return;freshTrace();if(await preview())status('status.imported',false,{count:total()});
 }catch(err){await cleanup();setText('fileNames','files.failed',{names:files.map(f=>f.name).join('\n')});await preview();status('status.error',true,{error:err.name==='PasswordException'?i18n.t('error.password'):err.message});}finally{busy=false;e.target.value='';updateControls();}
});
const yieldUi=()=>new Promise(resolve=>setTimeout(resolve,0));
function save(bytes,type,name){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function toBlob(c,type,quality){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('浏览器无法导出这张图片，请减小尺寸。')),type,quality));}
async function sha(bytes){if(!crypto.subtle)return null;const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return [...hash].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function verifyJpegTrace(bytes,traceId){const im=await decodeImage(new Blob([bytes],{type:'image/jpeg'})),c=document.createElement('canvas');try{c.width=im.naturalWidth;c.height=im.naturalHeight;const p=c.getContext('2d');p.drawImage(im,0,0);const mark=core.detectTrace(p.getImageData(0,0,c.width,c.height));if(mark?.traceId!==traceId)throw Error('JPEG 压缩后未能确认隐藏标记，已停止保存。请提高图片质量或输出尺寸，或关闭实验性隐藏标记后重试。');}finally{c.width=c.height=1;releaseImage(im);}}
function checkOutputSize(size){if(size>MAX_OUTPUT_BYTES)throw Error('输出文件超过 160 MiB，已停止保存。请降低图片质量或输出最长边，或按页码分批导出。');}
async function exportFiles(format){
 if(busy||!total()||!previewValid)return;busy=true;clearTimeout(previewTimer);previewGeneration++;updateControls();
 try{persistPreferences();const s=settings();if(s.mode!=='flatten'&&!s.text)throw Error('请输入用途水印。');const exportedAt=new Date(),randomId=core.normalizeTrace($('trace').value),timePrefix=$('timePrefix').checked,traceId=timePrefix?core.makeTimestampedTrace(randomId,exportedAt):randomId,hidden=$('hiddenMark').checked,metadata=$('metadata').checked,quality=Number($('quality').value)/100,dpi=Number($('dpi').value),longSide=Number($('longSide').value),indices=format==='pdf'?core.parsePages($('pages').value,total()).map(n=>n-1):[current];if(indices.length>30)throw Error('一次最多导出 30 页，请分批选择页码。');
  const meta={tool:'Offline Document Watermark',version:core.VERSION,traceId,timePrefix,processingMode:s.mode,watermark:s.mode==='flatten'?'':s.text,purposeNote:s.mode==='flatten'?s.text:null,createdAt:exportedAt.toISOString(),hiddenMarker:hidden?(timePrefix?'experimental-dct-owm3':'experimental-dct-v1'):null,dpi,quality,longSide,sourcePages:indices.map(i=>i+1),pagePixels:[]};const pages=[];let result,pdfBytes=0;
  for(let n=0;n<indices.length;n++){status('status.processing',false,{page:n+1,count:indices.length});await yieldUi();const base=await renderBase(indices[n],false,{dpi,longSide}),c=base.canvas,p=c.getContext('2d');if(s.mode!=='flatten')core.paintWatermark(p,c.width,c.height,s);if(hidden){const pixels=p.getImageData(0,0,c.width,c.height);core.embedTrace(pixels,traceId);p.putImageData(pixels,0,0);}meta.pagePixels.push({width:c.width,height:c.height});
   const width=c.width,height=c.height,type=format==='png'?'image/png':'image/jpeg',blob=await toBlob(c,type,quality);c.width=c.height=1;checkOutputSize(format==='pdf'?pdfBytes+blob.size:blob.size);let bytes=new Uint8Array(await blob.arrayBuffer());if(hidden&&format!=='png')await verifyJpegTrace(bytes,traceId);if(format==='pdf'){pdfBytes+=bytes.length;pages.push({jpeg:bytes,width,height,pageWidth:base.pageWidth,pageHeight:base.pageHeight});}else{if(metadata)bytes=format==='png'?core.addPngMetadata(bytes,meta):core.addJpegMetadata(bytes,meta);result=bytes;}
  }
  if(format==='pdf')result=core.buildPdf(pages,metadata?meta:null);checkOutputSize(result.length);const name=(loadedDemo?'sample':'watermarked')+'-'+traceId+'.'+(format==='jpg'?'jpg':format);save(result,format==='pdf'?'application/pdf':format==='png'?'image/png':'image/jpeg',name);lastRecords.push({filename:name,sha256:await sha(result),metadataWritten:metadata,...meta});sessionActive=true;setText('exportTrace','trace.latest',{id:traceId});status('status.saved',false,{name});
 }catch(e){status('status.error',true,{error:e.message});}finally{busy=false;updateControls();}
}
$('png').onclick=()=>exportFiles('png');$('jpg').onclick=()=>exportFiles('jpg');$('pdf').onclick=()=>exportFiles('pdf');
$('manifest').onclick=()=>save(core.utf8(JSON.stringify({tool:'Offline Document Watermark',version:core.VERSION,records:lastRecords},null,2)),'application/json','watermark-trace-records.json');
$('prev').onclick=()=>{if(!busy&&current>0){markSessionActive();current--;preview();}};$('next').onclick=()=>{if(!busy&&current<total()-1){markSessionActive();current++;preview();}};
$('newTrace').onclick=()=>{markSessionActive();freshTrace();};$('demo').onclick=()=>{if(busy)return;markSessionActive();return showDemo();};$('clear').onclick=async()=>{if(busy)return;busy=true;updateControls();try{persistPreferences();await cleanup();clearVerification();$('file').value='';freshTrace();await preview();sessionActive=false;status('status.cleared');}finally{busy=false;updateControls();}};
async function showPublicSamples(asPdf){if(busy)return;busy=true;updateControls();try{await cleanup();loadedDemo=true;setText('fileNames',asPdf?'files.samplePdf':'files.sampleImages');status('status.loadingSamples');if(asPdf){const pages=bundle.samples.map(s=>({width:s.width,height:s.height,jpeg:decode64(s.jpeg)}));await openPdf(core.buildPdf(pages));}else{for(const s of bundle.samples)sources.push(await imageSource(new Blob([decode64(s.jpeg)],{type:'image/jpeg'})));}freshTrace();if(await preview())status('status.samplesLoaded');}catch(e){await cleanup();await preview();status('status.error',true,{error:e.message});}finally{busy=false;updateControls();}}
$('sampleImages').onclick=()=>{if(busy)return;markSessionActive();return showPublicSamples(false);};$('samplePdf').onclick=()=>{if(busy)return;markSessionActive();return showPublicSamples(true);};
for(const event of ['input','change']){
 ['addVisibleWatermark','text','density','opacity','size','angle','color','scope','rx','ry','rw','rh'].forEach(id=>$(id).addEventListener(event,schedulePreview));['dpi','longSide','quality','hiddenMark','metadata','timePrefix'].forEach(id=>$(id).addEventListener(event,updateControls));
 for(const id of [...numericPreferences,...booleanPreferences,...textPreferences,'addVisibleWatermark'])$(id).addEventListener(event,schedulePreferences);
 for(const id of ['trace','pages'])$(id).addEventListener(event,markSessionActive);
 $('pages').addEventListener(event,updateControls);
}
$('rememberConfig').addEventListener('change',()=>{sessionActive=true;if($('rememberConfig').checked)persistPreferences();else clearSavedPreferences();updateControls();});$('clearConfig').onclick=()=>{sessionActive=true;clearSavedPreferences();updateControls();};$('configHistory').addEventListener('change',updateControls);$('restoreConfig').onclick=()=>{if(busy)return;const entry=savedPreferences.history.find(item=>item.id===$('configHistory').value);if(entry){applyPreferences(entry.config);schedulePreferences();schedulePreview();setText('configStatus','config.selectedRestored');}};
function renderVerification(){
 const state=verificationState;if(state.kind==='idle'){setText('verification','verify.idle');return;}if(state.kind==='checking'){setText('verification','verify.checking');return;}if(state.kind==='error'){setText('verification','verify.failed',{error:state.error});return;}
 const {metadata,mark,isPdf}=state,none=i18n.t('none'),lines=[];
 if(metadata){lines.push(i18n.t('verify.metadataId',{id:metadata.traceId||none})+'\n'+i18n.t(metadata.processingMode==='flatten'?'verify.preserved':'verify.purpose',{text:(metadata.processingMode==='flatten'?metadata.purposeNote:metadata.watermark)||none}));}else lines.push(i18n.t('verify.noMetadata'));
 lines.push(mark?i18n.t('verify.pixelId',{id:mark.traceId}):i18n.t('verify.noPixel'));
 if(metadata&&mark)lines.push(i18n.t(metadata.traceId===mark.traceId?'verify.match':'verify.mismatch'));
 if(metadata&&!mark)lines.push(i18n.t('verify.metadataOnly'));if(isPdf)lines.push(i18n.t('verify.firstPage'));lines.push(i18n.t('verify.disclaimer'));
 dynamicText.delete('verification');$('verification').textContent=lines.join('\n\n');
}
$('verifyFile').addEventListener('change',async e=>{
 const f=e.target.files[0];if(busy||!f)return;busy=true;sessionActive=true;updateControls();setText('verifyName','verify.name',{name:f.name});verificationState={kind:'checking'};renderVerification();try{if(f.size>MAX_FILE_BYTES)throw Error('验证文件超过 160 MiB。');const bytes=new Uint8Array(await f.arrayBuffer()),isPdf=f.type==='application/pdf'||/\.pdf$/i.test(f.name);let metadata,pixelBlob;
  if(isPdf){const own=core.inspectOwnPdf(bytes);metadata=own.metadata;if(own.jpeg)pixelBlob=new Blob([own.jpeg],{type:'image/jpeg'});}else{metadata=core.readMetadata(bytes);pixelBlob=f;}
  let mark=null;if(pixelBlob){const im=await decodeImage(pixelBlob),c=document.createElement('canvas');try{if(im.naturalWidth*im.naturalHeight>24000000)throw Error('验证图片超过 2400 万像素。');c.width=im.naturalWidth;c.height=im.naturalHeight;const p=c.getContext('2d');p.drawImage(im,0,0);mark=core.detectTrace(p.getImageData(0,0,c.width,c.height));}finally{c.width=c.height=1;releaseImage(im);}}
  verificationState={kind:'done',metadata,mark,isPdf};renderVerification();
 }catch(err){verificationState={kind:'error',error:err.message};renderVerification();}finally{busy=false;e.target.value='';updateControls();}
});
uiReady=true;refreshLanguage();freshTrace();await showDemo();
