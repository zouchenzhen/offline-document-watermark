// SPDX-License-Identifier: MIT
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n?/g,'\n'),base64=p=>fs.readFileSync(path.join(root,p)).toString('base64'),text64=p=>Buffer.from(read(p)).toString('base64');
const version=JSON.parse(read('package.json')).version;
if(!/^\d+\.\d+\.\d+$/.test(version)||!read('src/core.mjs').includes("VERSION='"+version+"'"))throw Error('Package and runtime version must match.');
const htmlName='offline-watermark-v'+version+'.html';
const assets={};for(const folder of ['cmaps','standard_fonts','wasm','iccs'])for(const name of fs.readdirSync(path.join(root,'vendor/pdfjs',folder)).sort()){if(name.startsWith('LICENSE'))continue;const p=path.join('vendor/pdfjs',folder,name);if(fs.statSync(path.join(root,p)).isFile())assets[folder+'/'+name]=base64(p);}
const sampleInfo=JSON.parse(read('docs/examples/demo-sizes.json'));const samples=sampleInfo.map(s=>({...s,jpeg:base64('docs/examples/'+s.file)}));
const licenses={MIT:read('LICENSE'),'PDF.js':read('vendor/pdfjs/LICENSE')};for(const folder of ['cmaps','standard_fonts','wasm','iccs'])for(const name of fs.readdirSync(path.join(root,'vendor/pdfjs',folder)).sort())if(name.startsWith('LICENSE'))licenses[folder+'/'+name]=read('vendor/pdfjs/'+folder+'/'+name);
const bundle={core:text64('src/core.mjs'),workerAssets:text64('src/worker-assets.mjs'),pdf:text64('vendor/pdfjs/pdf.min.mjs'),worker:text64('vendor/pdfjs/pdf.worker.min.mjs'),assets,samples,licenses};
const escape=s=>s.replace(/<\/script/gi,'<\\/script');
const html=read('src/index.template.html').replaceAll('__VERSION__',version).replace('/*__CSS__*/',read('src/style.css')).replace('/*__BUNDLE__*/',JSON.stringify(bundle)).replace('/*__APP__*/',escape(read('src/app.mjs')));
const out=path.join(root,'dist');fs.mkdirSync(path.join(out,'site'),{recursive:true});for(const name of ['index.html',htmlName])fs.writeFileSync(path.join(out,'site',name),html);
fs.writeFileSync(path.join(out,htmlName),html);
const filenames=[htmlName];const sums=filenames.map(n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(out,n))).digest('hex')+'  '+n).join('\n')+'\n';fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),sums);fs.writeFileSync(path.join(out,'site/SHA256SUMS.txt'),sums);
for(const name of ['LICENSE','LICENSE_NOTES.md','PRIVACY.md','THIRD_PARTY_NOTICES.md'])fs.copyFileSync(path.join(root,name),path.join(out,name));
fs.writeFileSync(path.join(out,'site/.nojekyll'),'');console.log('Built self-contained HTML: '+(Buffer.byteLength(html)/1024/1024).toFixed(2)+' MiB. SHA-256 manifest written.');
