// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
// PDF.js uses synchronous ICC reads and asynchronous font/decoder reads.
// This worker-local bridge serves a fixed dictionary; it never calls the network.
export const RESOURCE_PREFIX='offline-asset://';
export function installEmbeddedResources(resources,target=globalThis){
 const prefix='offline-asset://',cache=new Map();
 function read(input){
  const url=typeof input==='string'?input:input?.url||String(input);
  if(!url.startsWith(prefix))throw new TypeError('External worker resource requests are disabled.');
  const key=url.slice(prefix.length);
  if(!Object.prototype.hasOwnProperty.call(resources,key))throw new TypeError('Missing embedded PDF resource: '+key);
  if(!cache.has(key)){const str=target.atob(resources[key]),bytes=new Uint8Array(str.length);for(let i=0;i<str.length;i++)bytes[i]=str.charCodeAt(i);cache.set(key,bytes);}
  return {key,bytes:cache.get(key)};
 }
 target.fetch=async(input,options={})=>{
  const method=options.method||input?.method||'GET';if(method.toUpperCase()!=='GET')throw new TypeError('Only embedded resource reads are allowed.');
  const {key,bytes}=read(input);
  return new target.Response(bytes.slice(),{status:200,headers:{'Content-Type':key.endsWith('.wasm')?'application/wasm':'application/octet-stream'}});
 };
 target.XMLHttpRequest=class EmbeddedXMLHttpRequest{
  constructor(){this.status=0;this.readyState=0;this.responseType='';this.response=null;this.responseText='';this._url=null;this._async=false;}
  open(method,url,async=true){if(method.toUpperCase()!=='GET')throw new TypeError('Only embedded resource reads are allowed.');read(url);this._url=url;this._async=async;this.readyState=1;}
  setRequestHeader(){/* Headers cannot create permissions or alter resource routing. */}
  send(body=null){if(body!==null)throw new TypeError('Resource writes are disabled.');if(!this._url)throw new TypeError('Resource request is not open.');const {bytes}=read(this._url);this.status=200;this.readyState=4;if(this.responseType==='arraybuffer')this.response=bytes.slice().buffer;else{this.responseText=Array.from(bytes,b=>String.fromCharCode(b)).join('');this.response=this.responseText;}if(this._async)queueMicrotask(()=>{this.onreadystatechange?.();this.onload?.();});}
  abort(){this.status=0;this.readyState=0;this._url=null;}
 };
 return {read};
}
export function workerPrelude(resources){return '('+installEmbeddedResources.toString()+')('+JSON.stringify(resources)+');\n';}
