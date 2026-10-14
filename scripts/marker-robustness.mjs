// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
// Pixel-only, reproducible experiment. Requires Python with Pillow; no npm packages.
// Run: node scripts/marker-robustness.mjs --python /path/to/python
// New public report only when requested: --report docs/examples/new-report.json
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {VERSION,embedTrace,detectTrace,makeTimestampedTrace,addPngMetadata,readMetadata} from '../src/core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const flag=name=>{const at=process.argv.indexOf(name);return at<0?undefined:process.argv[at+1];};
const python=flag('--python')||'python',helper=path.join(root,'scripts/marker-robustness-image.py');
const derived='test-output/marker-robustness',directory=path.join(root,derived);
const reportArgument=flag('--report');if(process.argv.includes('--report')&&!reportArgument)throw Error('--report requires an explicit output filename.');
const output=path.resolve(root,reportArgument||'test-output/marker-robustness/results.json');
await fs.mkdir(directory,{recursive:true});
function call(args,input){return execFileSync(python,[helper,...args],{input,maxBuffer:128*1024*1024});}
function pixels(bytes){const length=bytes.readUInt32BE(0),info=JSON.parse(bytes.subarray(4,4+length).toString('utf8')),rgba=bytes.subarray(4+length);if(rgba.length!==info.width*info.height*4)throw Error('Unexpected helper pixel buffer.');return {...info,data:new Uint8ClampedArray(rgba)};}
function decoded(filename){return pixels(call(['decode',filename]));}
const baseId='12AB34CD56EF7890',timestampedId=makeTimestampedTrace(baseId,new Date('2026-10-14T01:08:07.000Z'));
function gcd(a,b){while(b)[a,b]=[b,a%b];return a;}
const edits=['png-resave','metadata-strip','jpeg-92','jpeg-80','jpeg-60','brightness-105','brightness-95','contrast-105','contrast-95','flip-horizontal','flip-vertical','rotate-90','resize-75','resize-50','edge-crop-3','edge-crop-8','center-crop-90','center-crop-75'];
const coreSource=await fs.readFile(path.join(root,'src/core.mjs'));
const testedCore={source:'src/core.mjs',version:VERSION,sourceSha256:createHash('sha256').update(coreSource).digest('hex'),normalizedLfSha256:createHash('sha256').update(coreSource.toString('utf8').replace(/\r\n?/g,'\n')).digest('hex')};
const report={schema:1,version:VERSION,testedCore,generatedAt:new Date().toISOString(),codecs:JSON.parse(call(['info']).toString('utf8')),method:{metadataUsedForDetection:false,metadataAssertions:'Separate setup checks confirm baseline/demo metadata present and stripped metadata absent; metadata never enters detectTrace.',visibleWatermarkAdded:false,rasterization:'Pillow EXIF orientation applied; RGBA composited onto opaque white',baseline:'PNG lossless encode/decode; demo metadata written but never consulted by detector',jpeg:'Pillow JPEG, 4:2:0, nonprogressive, optimize=false',parameters:'All dimensions and editing operations are recorded per result',derivedDirectory:derived,ids:{OWM2:baseId,OWM3:timestampedId}},edits,samples:[],summary:null};
for(const [name,source]of [['id-card','docs/examples/id-card-input.png'],['screenshot','docs/examples/screenshot-input.png'],['synthetic-scan','tests/fixtures/synthetic-scan.jpg']]){
 const original=decoded(path.join(root,source)),sourceHash=createHash('sha256').update(await fs.readFile(path.join(root,source))).digest('hex'),sample={name,source,sourceSha256:sourceHash,width:original.width,height:original.height,trials:[]};
 for(const [format,traceId]of [['OWM2',baseId],['OWM3',timestampedId]]){
  const trial={format,traceId,embeddingSucceeded:false,baselineSucceeded:false,embeddingError:null,embeddingDelta:null,results:[]};sample.trials.push(trial);
  const image={width:original.width,height:original.height,data:original.data.slice()};
  try{embedTrace(image,traceId);trial.embeddingSucceeded=true;}catch(error){trial.embeddingError=error.message;continue;}
  let maximum=0,total=0;for(let i=0;i<image.data.length;i++){const delta=Math.abs(image.data[i]-original.data[i]);if(i%4===3){if(delta)throw Error('Embedding unexpectedly changed alpha.');continue;}maximum=Math.max(maximum,delta);total+=delta;}
  trial.embeddingDelta={maxRgbChannelChange:maximum,meanAbsoluteRgbChannelChange:total/(image.width*image.height*3),alphaChanged:false};
  const baseFile=path.join(directory,`${name}-${format}-baseline.png`);
  call(['encode',String(image.width),String(image.height),baseFile],Buffer.from(image.data));
  await fs.writeFile(baseFile,addPngMetadata(new Uint8Array(await fs.readFile(baseFile)),{tool:'Offline Document Watermark',version:VERSION,traceId,watermark:'Public synthetic pixel-only robustness test'}));
  trial.metadataChecks={baselineContainsDemoMetadata:readMetadata(new Uint8Array(await fs.readFile(baseFile)))?.traceId===traceId};if(!trial.metadataChecks.baselineContainsDemoMetadata)throw Error('Baseline demonstration metadata missing.');
  function result(edit,value){const detected=detectTrace(value);return {edit,width:value.width,height:value.height,encodedBytes:value.encodedBytes,operation:value.operation,detectedTraceId:detected?.traceId??null,detectedFormat:detected?.format??null,exactMatch:detected?.traceId===traceId};}
  const baseline=result('baseline-png',decoded(baseFile));trial.results.push(baseline);trial.baselineSucceeded=baseline.exactMatch;if(!baseline.exactMatch)continue;
  for(const edit of edits){const filename=path.join(directory,`${name}-${format}-${edit}.${edit.startsWith('jpeg-')?'jpg':'png'}`),value=pixels(call(['edit',baseFile,edit,filename]));trial.results.push(result(edit,value));if(edit==='metadata-strip'){trial.metadataChecks.strippedMetadataAbsent=readMetadata(new Uint8Array(await fs.readFile(filename)))===null;if(!trial.metadataChecks.strippedMetadataAbsent)throw Error('Metadata-strip edit retained the demonstration metadata.');}if(edit==='png-resave')trial.metadataChecks.losslessResavePreservesDemoMetadata=readMetadata(new Uint8Array(await fs.readFile(filename)))?.traceId===traceId;}
  // A separate, predetermined counterexample: preserve width and remove the
  // smallest whole block-row count that leaves packet indexing phase intact.
  const columns=Math.floor(image.width/8),bits=format==='OWM3'?160:128,rows=bits/gcd(bits,columns),topPixels=rows*8,remainingBlocks=columns*Math.floor((image.height-topPixels)/8);
  const selectionRule={columns,bits,blockRows:rows,topPixels,maxHeightFraction:0.5,minRemainingBlocks:bits*3};
  if(topPixels>image.height/2||remainingBlocks<bits*3)trial.alignedTopCrop={selectionRule,skipped:true,reason:'Calculated crop exceeds half the height or leaves fewer than three packet repetitions.'};
  else{const filename=path.join(directory,`${name}-${format}-aligned-top.png`),value=pixels(call(['edit',baseFile,'top-aligned-'+topPixels,filename]));trial.alignedTopCrop={selectionRule,skipped:false,result:result('phase-aligned-top-crop',value)};}
 }
 report.samples.push(sample);
}
const eligible=report.samples.flatMap(s=>s.trials).filter(t=>t.baselineSucceeded),byEdit=[];
for(const edit of ['baseline-png',...edits]){const results=eligible.flatMap(t=>t.results.filter(r=>r.edit===edit)),matched=results.filter(r=>r.exactMatch).length;byEdit.push({edit,tested:results.length,exactMatches:matched,rate:results.length?matched/results.length:null,OWM2:resultsFor('OWM2'),OWM3:resultsFor('OWM3')});function resultsFor(format){const subset=eligible.filter(t=>t.format===format).flatMap(t=>t.results.filter(r=>r.edit===edit));return {tested:subset.length,exactMatches:subset.filter(r=>r.exactMatch).length};}}
report.summary={attemptedBaselines:report.samples.reduce((n,s)=>n+s.trials.length,0),eligibleBaselines:eligible.length,excludedBaselines:report.samples.flatMap(s=>s.trials.filter(t=>!t.baselineSucceeded).map(t=>({sample:s.name,format:t.format,traceId:t.traceId,error:t.embeddingError||'Baseline PNG pixel readback failed'}))),byEdit};
const extra=eligible.map(t=>t.alignedTopCrop).filter(t=>t&&!t.skipped);report.summary.extraAlignedTopCrop={separateFromMainMatrix:true,rule:'crop top 8 * bits/gcd(bits,floor(width/8)) pixels, preserving width; skip above half height or below three repetitions',tested:extra.length,exactMatches:extra.filter(t=>t.result.exactMatch).length,skipped:eligible.length-extra.length};
if(createHash('sha256').update(await fs.readFile(path.join(root,'src/core.mjs'))).digest('hex')!==testedCore.sourceSha256)throw Error('Core source changed during the experiment; rerun before publishing a report.');
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:path.relative(root,output).split(path.sep).join('/'),attemptedBaselines:report.summary.attemptedBaselines,eligibleBaselines:report.summary.eligibleBaselines,matrix:byEdit},null,2));
