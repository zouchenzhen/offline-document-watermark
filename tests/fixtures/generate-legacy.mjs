// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
// Recreate frozen compatibility fixtures from the source identified by v0.2.0.
// Node standard library only; requires that commit in the local Git checkout.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';

const root=path.dirname(fileURLToPath(import.meta.url)),project=path.resolve(root,'../..');
const commit='252fc01a38c2cd3caccda2f16e5a7f8b595a3f20';
const expectedHash='8b0120962162df268b145b4a9fb443cd0e0b38daf6b895ddfe40b3f6adf77ca5';
const source=execFileSync('git',['show',commit+':src/core.mjs'],{cwd:project});
if(createHash('sha256').update(source).digest('hex')!==expectedHash)throw Error('Legacy source does not match the frozen v0.2.0 implementation.');
const legacy=await import('data:text/javascript;base64,'+source.toString('base64'));
if(legacy.VERSION!=='0.2.0')throw Error('Expected v0.2.0 source.');
const trace='12AB34CD56EF7890',metadata={tool:'Offline Document Watermark',version:'0.2.0',traceId:trace,watermark:'仅供虚构示例审核\n其他用途无效',createdAt:'2026-10-11T00:00:00.000Z',hiddenMarker:'experimental-dct-v1'};
const jpeg=new Uint8Array(await fs.readFile(path.join(root,'synthetic-scan.jpg')));
await fs.writeFile(path.join(root,'legacy-v0.2.0.pdf'),legacy.buildPdf([{width:384,height:256,jpeg},{width:384,height:256,jpeg}],metadata));

// Original synthetic texture, not a copied document or screenshot. A gentle
// background plus sharp grid gives the old aggregation genuine contrast.
const width=256,height=256,data=new Uint8ClampedArray(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const p=(y*width+x)*4,edge=x%32<2||y%32<2,v=edge?40:180+Math.floor(x/16)+Math.floor(y/32);
 data[p]=v;data[p+1]=Math.min(255,v+10);data[p+2]=Math.min(255,v+20);data[p+3]=255;
}
legacy.embedTrace({width,height,data},trace);if(legacy.detectTrace({width,height,data})?.traceId!==trace)throw Error('Legacy synthetic marker not detectable.');
const u32=n=>Buffer.from([n>>>24,n>>>16&255,n>>>8&255,n&255]);
function chunk(type,bytes){const name=Buffer.from(type),payload=Buffer.concat([name,bytes]);return Buffer.concat([u32(bytes.length),payload,u32(legacy.crc32(payload))]);}
const ihdr=Buffer.concat([u32(width),u32(height),Buffer.from([8,6,0,0,0])]),rows=Buffer.alloc(height*(1+width*4));
for(let y=0;y<height;y++)rows.set(data.subarray(y*width*4,(y+1)*width*4),y*(1+width*4)+1);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
await fs.writeFile(path.join(root,'legacy-v0.2.0.png'),legacy.addPngMetadata(png,metadata));
await fs.writeFile(path.join(root,'legacy-v0.2.0.rgba.zlib'),deflateSync(data));
const hashes={};for(const name of ['legacy-v0.2.0.pdf','legacy-v0.2.0.png','legacy-v0.2.0.rgba.zlib'])hashes[name]=createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex');
await fs.writeFile(path.join(root,'legacy-v0.2.0.json'),JSON.stringify({tag:'v0.2.0',commit,source:'src/core.mjs',sourceSha256:expectedHash,width,height,metadata,hashes},null,2)+'\n');
console.log('Generated frozen v0.2.0 PDF, PNG, and pixel fixtures from synthetic data.');
