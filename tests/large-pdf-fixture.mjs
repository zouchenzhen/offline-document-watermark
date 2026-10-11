// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
// A valid, runtime-only large JPEG/PDF fixture. No large binary is committed.
import fs from 'node:fs';
import {buildPdf} from '../src/core.mjs';

export function largePdfFixture(meta){
 const jpeg=new Uint8Array(fs.readFileSync(new URL('./fixtures/synthetic-scan.jpg',import.meta.url)));
 // Legal JPEG COM segments expand the later pages. Keeping page one
 // small also verifies that inspecting it skips later binary image streams.
 const commentBytes=81*512*1024,large=new Uint8Array(commentBytes+jpeg.length);large.set(jpeg.subarray(0,2));
 let at=2,remaining=commentBytes;
 while(remaining){const size=Math.min(65537,remaining);if(size<4)throw Error('Invalid fixture segment size.');const length=size-2;large.set([255,254,length>>8,length&255],at);at+=size;remaining-=size;}
 large.set(jpeg.subarray(2),at);
 return {jpeg,bytes:buildPdf([{width:384,height:256,jpeg},{width:384,height:256,jpeg:large},{width:384,height:256,jpeg:large}],meta)};
}
