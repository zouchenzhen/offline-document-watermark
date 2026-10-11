// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
// A deterministic ZIP writer: no extra dependencies, timestamps, or private paths.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_U32 = 0xffffffff;
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

export function crc32(bytes) {
  let crc = MAX_U32;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ MAX_U32) >>> 0;
}

/** Store files with a fixed 1980-01-01 DOS timestamp and UTF-8 names. */
export function buildZip(entries) {
  if (!Array.isArray(entries) || entries.length > 65535) throw Error('ZIP entry count exceeds the supported limit.');
  const prepared = entries.map(({ name, bytes }) => {
    if (typeof name !== 'string' || !name || name.includes('\\') || name.includes('\0') || name.startsWith('/') || name.includes(':') || name.split('/').some(part => !part || part === '.' || part === '..')) throw Error('ZIP names must be safe relative file paths.');
    const filename = Buffer.from(name, 'utf8'), data = Buffer.from(bytes);
    if (filename.length > 65535 || data.length > MAX_U32) throw Error('ZIP64 is not supported.');
    return { name, filename, data };
  }).sort((a, b) => Buffer.compare(a.filename, b.filename));
  if (new Set(prepared.map(entry => entry.name)).size !== prepared.length) throw Error('Duplicate ZIP entry names.');
  const locals = [], central = [];
  let offset = 0, centralLength = 0;
  for (const { filename, data } of prepared) {
    const local = Buffer.alloc(30), directory = Buffer.alloc(46), crc = crc32(data);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // Minimum extraction version.
    local.writeUInt16LE(0x0800, 6); // UTF-8, no encryption or data descriptor.
    local.writeUInt16LE(0, 8); // Stored, stable across Node/zlib versions.
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12); // 1980-01-01.
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4); // Fixed DOS creator, independent of host OS.
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(0, 10);
    directory.writeUInt16LE(0, 12);
    directory.writeUInt16LE(0x0021, 14);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    locals.push(local, filename, data);
    central.push(directory, filename);
    offset += local.length + filename.length + data.length;
    centralLength += directory.length + filename.length;
    if (offset > MAX_U32 || centralLength > MAX_U32) throw Error('ZIP64 is not supported.');
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(prepared.length, 8);
  end.writeUInt16LE(prepared.length, 10);
  end.writeUInt32LE(centralLength, 12);
  end.writeUInt32LE(offset, 16);
  if (offset + centralLength + end.length > MAX_U32) throw Error('ZIP64 is not supported.');
  return Buffer.concat([...locals, ...central, end]);
}

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const checksumLine = (name, bytes) => `${sha256(bytes)}  ${name}\n`;
const documents = [
  ['LICENSE', 'LICENSE'],
  ['LICENSE_NOTES.md', 'LICENSE_NOTES.md'],
  ['PRIVACY.md', 'PRIVACY.md'],
  ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
  ['NOTICE', 'NOTICE'],
  ['ATTRIBUTION.md', 'docs/examples/ATTRIBUTION.md'],
  ['id-card-source.json', 'docs/examples/id-card-source.json'],
];

export async function packageRelease(root = projectRoot) {
  const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  if (typeof version !== 'string' || !/^[0-9A-Za-z][0-9A-Za-z.+_-]*$/.test(version)) throw Error('Invalid release version.');
  const dist = path.join(root, 'dist'), htmlName = `offline-watermark-v${version}.html`, zipName = `offline-watermark-v${version}.zip`;
  const html = await fs.readFile(path.join(dist, htmlName));
  // The embedded manifest checks only HTML; including ZIP here would be circular.
  const innerManifest = checksumLine(htmlName, html);
  const entries = [{ name: htmlName, bytes: html }, { name: 'SHA256SUMS.txt', bytes: Buffer.from(innerManifest) }];
  for (const [name, source] of documents) {
    const text = (await fs.readFile(path.join(root, source), 'utf8')).replace(/\r\n?/g, '\n');
    entries.push({ name, bytes: Buffer.from(text) });
  }
  const zip = buildZip(entries), manifest = innerManifest + checksumLine(zipName, zip);
  await fs.writeFile(path.join(dist, zipName), zip);
  await fs.writeFile(path.join(dist, 'SHA256SUMS.txt'), manifest);
  return { htmlName, zipName, htmlBytes: html.length, zipBytes: zip.length, manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await packageRelease();
    console.log(`Packaged ${result.zipName} (${result.zipBytes} bytes). SHA256SUMS.txt checks HTML and ZIP.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
