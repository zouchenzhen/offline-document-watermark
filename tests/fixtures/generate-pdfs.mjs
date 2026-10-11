// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
// Deterministic, fictional PDF fixtures; built with Node standard libraries only.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const binary=parts=>Buffer.concat(parts.map(p=>typeof p==='string'?Buffer.from(p):p));
function stream(dict,bytes){return binary([`<< ${dict} /Length ${bytes.length} >>\nstream\n`,bytes,'\nendstream']);}
function pdf(objects){
 const chunks=[Buffer.from('%PDF-1.7\n')],offsets=[0];let size=chunks[0].length;
 objects.forEach((body,i)=>{offsets.push(size);const chunk=binary([`${i+1} 0 obj\n`,body,'\nendobj\n']);chunks.push(chunk);size+=chunk.length;});
 const xref=size,count=objects.length+1;
 chunks.push(Buffer.from(`xref\n0 ${count}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
 return Buffer.concat(chunks);
}
const catalog='<< /Type /Catalog /Pages 2 0 R >>';
const pages='<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
const font='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
const text=(label,y=745)=>`0 g BT /F1 16 Tf 40 ${y} Td (${label}) Tj ET\n`;
const colors=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
function patches(useIcc=false){
 let s=text(useIcc?'SYNTHETIC ICC CMYK PROFILE TEST':'SYNTHETIC HELVETICA / DEVICE CMYK TEST');
 s+=text('No personal data / no embedded system fonts',716);
 s+=text('Cyan, magenta, yellow, black',658);
 colors.forEach((color,i)=>{s+=(useIcc?'/CS0 cs ':'')+`${color.join(' ')} ${useIcc?'scn':'k'} ${40+i*135} 530 110 100 re f\n`;});
 s+=text('DeviceGray levels: 0, 0.25, 0.5, 0.75, 1',474);
 [0,.25,.5,.75,1].forEach((gray,i)=>{s+=`${gray} g ${40+i*108} 345 86 90 re f\n`;});
 s+='0 G 0.5 w 40 345 518 90 re S\n';
 s+=text('Synthetic fixture distributed with the project',285);
 return Buffer.from(s);
}
const page=resources=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> ${resources} >> /Contents 4 0 R >>`;
await fs.writeFile(path.join(root,'standard-fonts-cmyk.pdf'),pdf([catalog,pages,page(''),stream('',patches()),font]));
const profile=await fs.readFile(path.join(root,'../../vendor/pdfjs/iccs/CGATS001Compat-v2-micro.icc'));
await fs.writeFile(path.join(root,'embedded-cmyk-profile.pdf'),pdf([catalog,pages,page('/ColorSpace << /CS0 [/ICCBased 6 0 R] >>'),stream('',patches(true)),font,stream('/N 4 /Alternate /DeviceCMYK',profile)]));
for(const [suffix,filter,label] of [['jpg','DCTDecode','JPEG'],['jp2','JPXDecode','JPEG2000']]){
 const image=await fs.readFile(path.join(root,'synthetic-scan.'+suffix));
 const content=Buffer.from(text('SYNTHETIC '+label+' SCAN TEST')+text('No personal data / original raster illustration',716)+'q\n512 0 0 341.333 40 315 cm\n/Im0 Do\nQ\n');
 const imageObject=stream(`/Type /XObject /Subtype /Image /Width 384 /Height 256 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${filter}`,image);
 await fs.writeFile(path.join(root,suffix==='jpg'?'synthetic-jpeg-scan.pdf':'synthetic-jpeg2000.pdf'),pdf([catalog,pages,page('/XObject << /Im0 6 0 R >>'),stream('',content),font,imageObject]));
}
console.log('Generated four synthetic PDF fixtures.');

