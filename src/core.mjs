// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
// Platform-neutral pixel, metadata, and image-only PDF helpers.
export const VERSION='0.2.0';
const te=new TextEncoder(),td=new TextDecoder();
export function concat(parts){const size=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(size);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
export const utf8=s=>te.encode(s);
export function crc32(data){let c=0xffffffff;for(const b of data){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function u32(n){return new Uint8Array([n>>>24,n>>>16&255,n>>>8&255,n&255]);}
function read32(b,o){return ((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;}
export function normalizeTrace(s){const id=s.trim().replace(/[-\s]/g,'').toUpperCase();if(!/^[0-9A-F]{16}$/.test(id))throw Error('追踪编号必须为 16 位十六进制字符。');return id;}
export function parsePages(text,total){if(!text.trim())return Array.from({length:total},(_,i)=>i+1);const out=new Set();for(const raw of text.split(/[,，]/)){const part=raw.trim(),m=part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!m)throw Error('页码示例：1-3,5。');const a=Number(m[1]),b=Number(m[2]||m[1]);if(a<1||b<a||b>total)throw Error('页码超出范围或顺序不正确。');for(let n=a;n<=b;n++)out.add(n);}return [...out].sort((a,b)=>a-b);}
export function scaledSize(w,h,longSide=0,maxPixels=24000000){if(w<=0||h<=0)throw Error('图片尺寸无效。');let ratio=longSide>0?Math.min(1,longSide/Math.max(w,h)):1;ratio=Math.min(ratio,Math.sqrt(maxPixels/(w*h)));return {width:Math.max(1,Math.round(w*ratio)),height:Math.max(1,Math.round(h*ratio)),ratio};}
export function paintWatermark(ctx,w,h,s){
 const lines=s.text.trim().split('\n').filter(x=>x.trim());if(!lines.length)throw Error('请输入用途水印。');
 const fs=Math.max(8,s.size*Math.min(w,h)/1000),lineHeight=fs*1.45;
 ctx.save();const r=s.region||{x:0,y:0,w:100,h:100};ctx.beginPath();ctx.rect(w*r.x/100,h*r.y/100,w*r.w/100,h*r.h/100);ctx.clip();
 ctx.translate(w/2,h/2);ctx.rotate(s.angle*Math.PI/180);ctx.globalAlpha=s.opacity;ctx.fillStyle=s.color;ctx.font=fs+'px "Microsoft YaHei","PingFang SC",sans-serif';ctx.textBaseline='top';
 const tw=Math.max(...lines.map(t=>ctx.measureText(t).width)),f=s.density/3;
 const dx=(tw+fs*3)/Math.sqrt(f),dy=Math.max(lineHeight*lines.length+fs*1.6,fs*5.5)/f,rad=Math.hypot(w,h)/2;
 let row=0;for(let y=-rad;y<rad;y+=dy,row++)for(let x=-rad-dx+(row%2)*dx/2;x<rad;x+=dx)lines.forEach((t,i)=>ctx.fillText(t,x,y+i*lineHeight));
 ctx.restore();
}

// Experimental blind marker. Two mid-frequency DCT projections carry each bit.
// Public, unkeyed format: identifies copies; does NOT prove authorship or resist attacks.
const ba=new Float64Array(64),bb=new Float64Array(64);
for(let y=0;y<8;y++)for(let x=0;x<8;x++){ba[y*8+x]=0.25*Math.cos((2*x+1)*2*Math.PI/16)*Math.cos((2*y+1)*3*Math.PI/16);bb[y*8+x]=0.25*Math.cos((2*x+1)*3*Math.PI/16)*Math.cos((2*y+1)*2*Math.PI/16);}
function tracePacket(id){const t=normalizeTrace(id),payload=new Uint8Array(12);payload.set(utf8('OWM2'));for(let i=0;i<8;i++)payload[4+i]=parseInt(t.slice(i*2,i*2+2),16);return concat([payload,u32(crc32(payload))]);}
export function embedTrace(image,id,strength=22){
 const {width:w,height:h,data}=image,packet=tracePacket(id),bits=packet.length*8;let k=0;
 if(Math.floor(w/8)*Math.floor(h/8)<bits*3)throw Error('图片太小，无法可靠嵌入隐藏标记（至少需要约 160×160 像素）。');
 for(let by=0;by+8<=h;by+=8)for(let bx=0;bx+8<=w;bx+=8,k++){
  let a=0,b=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++){const j=((by+y)*w+bx+x)*4,q=y*8+x,v=(data[j]+data[j+1]+data[j+2])/3-128;a+=v*ba[q];b+=v*bb[q];}
  const bit=(packet[Math.floor((k%bits)/8)]>>(7-k%8))&1,diff=a-b;
  const target=bit?Math.max(strength,diff):Math.min(-strength,diff),delta=(target-diff)/2;
  if(!delta)continue;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){const j=((by+y)*w+bx+x)*4,q=y*8+x,d=delta*(ba[q]-bb[q]);for(let c=0;c<3;c++)data[j+c]=Math.max(0,Math.min(255,Math.round(data[j+c]+d)));}
 }
 return image;
}
export function detectTrace(image){
 const {width:w,height:h,data}=image,sums=new Float64Array(128),counts=new Uint32Array(128);let k=0;
 for(let by=0;by+8<=h;by+=8)for(let bx=0;bx+8<=w;bx+=8,k++){
  let v=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++){const j=((by+y)*w+bx+x)*4,q=y*8+x;v+=((data[j]+data[j+1]+data[j+2])/3-128)*(ba[q]-bb[q]);}
  sums[k%128]+=v;counts[k%128]++;
 }
 const packet=new Uint8Array(16);for(let i=0;i<128;i++)if(sums[i]>0)packet[i>>3]|=1<<(7-i%8);
 const valid=td.decode(packet.slice(0,4))==='OWM2'&&read32(packet,12)===crc32(packet.slice(0,12))&&counts.every(n=>n>=3);
 return valid?{traceId:[...packet.slice(4,12)].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase(),repetitions:Math.min(...counts)}:null;
}
function pngChunk(type,data){const name=utf8(type);return concat([u32(data.length),name,data,u32(crc32(concat([name,data])))]);}
export function addPngMetadata(png,meta){if(png[0]!==137||png[1]!==80)throw Error('PNG 格式无效。');const content=concat([utf8('OfflineWatermark'),new Uint8Array([0,0,0,0,0]),utf8(JSON.stringify(meta))]);const at=8+12+read32(png,8);return concat([png.slice(0,at),pngChunk('iTXt',content),png.slice(at)]);}
export function addJpegMetadata(jpeg,meta){if(jpeg[0]!==255||jpeg[1]!==216)throw Error('JPEG 格式无效。');const data=utf8('OfflineWatermark:'+JSON.stringify(meta));if(data.length>65000)throw Error('元信息过长。');const size=data.length+2;return concat([jpeg.slice(0,2),new Uint8Array([255,254,size>>8,size&255]),data,jpeg.slice(2)]);}
export function readMetadata(bytes){
 if(bytes[0]===137&&bytes[1]===80){let p=8;while(p+12<=bytes.length){const len=read32(bytes,p),type=td.decode(bytes.slice(p+4,p+8));if(len>bytes.length-p-12)break;if(type==='iTXt'){const data=bytes.slice(p+8,p+8+len),end=data.indexOf(0);if(td.decode(data.slice(0,end))==='OfflineWatermark'&&data[end+1]===0){try{return JSON.parse(td.decode(data.slice(end+5)));}catch{}}}p+=len+12;}}
 if(bytes[0]===255&&bytes[1]===216){let p=2;while(p+4<=bytes.length&&bytes[p]===255){const marker=bytes[p+1];if(marker===218||marker===217)break;const len=(bytes[p+2]<<8)|bytes[p+3];if(len<2||p+2+len>bytes.length)break;if(marker===254){const s=td.decode(bytes.slice(p+4,p+2+len));if(s.startsWith('OfflineWatermark:')){try{return JSON.parse(s.slice(17));}catch{}}}p+=2+len;}}
 return null;
}
export function pdfString(s){let result='FEFF';for(let i=0;i<s.length;i++)result+=s.charCodeAt(i).toString(16).padStart(4,'0');return '<'+result.toUpperCase()+'>';}
export function inspectOwnPdf(bytes){
 // Only our documented image-only layout; not a general-purpose PDF parser.
 const str=new TextDecoder('latin1').decode(bytes),m=str.match(/\/Subject <FEFF([0-9A-F]+)>/);let metadata=null;
 if(m){let s='';for(let i=0;i<m[1].length;i+=4)s+=String.fromCharCode(parseInt(m[1].slice(i,i+4),16));try{const value=JSON.parse(s);if(value.tool==='Offline Document Watermark')metadata=value;}catch{}}
 const image=str.match(/\/Subtype \/Image \/Width \d+ \/Height \d+ \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/);
 let jpeg=null;if(image){const start=image.index+image[0].length,len=Number(image[1]);if(len>0&&start+len<=bytes.length)jpeg=bytes.slice(start,start+len);}
 return {metadata,jpeg};
}
export function buildPdf(pages,meta=null){
 if(!pages.length)throw Error('没有可导出的页面。');const chunks=[],offset=[0];let length=0;const add=b=>{const a=typeof b==='string'?utf8(b):b;chunks.push(a);length+=a.length;};const obj=(n,s)=>{offset[n]=length;add(n+' 0 obj\n'+s+'\nendobj\n');};
 add('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids ['+pages.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] /Count '+pages.length+' >>');
 pages.forEach((p,i)=>{const n=3+i*3,W=p.pageWidth||(p.width>p.height?841.89:595.28),H=p.pageHeight||W*p.height/p.width;
  obj(n,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W.toFixed(3)+' '+H.toFixed(3)+'] /Resources << /XObject << /Im0 '+(n+1)+' 0 R >> >> /Contents '+(n+2)+' 0 R >>');
  offset[n+1]=length;add((n+1)+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+p.width+' /Height '+p.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+p.jpeg.length+' >>\nstream\n');add(p.jpeg);add('\nendstream\nendobj\n');
  const s='q\n'+W.toFixed(3)+' 0 0 '+H.toFixed(3)+' 0 0 cm\n/Im0 Do\nQ\n';obj(n+2,'<< /Length '+utf8(s).length+' >>\nstream\n'+s+'endstream');
 });
 const count=3+pages.length*3,info=meta?count:0;if(meta)obj(info,'<< /Creator '+pdfString('Offline Document Watermark '+VERSION)+' /Subject '+pdfString(JSON.stringify(meta))+' /WatermarkTrace '+pdfString(meta.traceId)+' /WatermarkText '+pdfString(meta.watermark)+' >>');
 const total=count+(meta?1:0),xref=length;add('xref\n0 '+total+'\n0000000000 65535 f \n');for(let n=1;n<total;n++)add(String(offset[n]).padStart(10,'0')+' 00000 n \n');add('trailer\n<< /Size '+total+' /Root 1 0 R'+(info?' /Info '+info+' 0 R':'')+' >>\nstartxref\n'+xref+'\n%%EOF\n');return concat(chunks);
}
