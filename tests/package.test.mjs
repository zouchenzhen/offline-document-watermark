import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { buildZip, crc32, packageRelease } from '../scripts/package-release.mjs';

function readStoredZip(bytes) {
  const endOffset = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(endOffset), 0x06054b50);
  const count = bytes.readUInt16LE(endOffset + 10), centralSize = bytes.readUInt32LE(endOffset + 12), centralOffset = bytes.readUInt32LE(endOffset + 16);
  assert.equal(centralOffset + centralSize, endOffset);
  let pos = centralOffset;
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(bytes.readUInt32LE(pos), 0x02014b50);
    assert.equal(bytes.readUInt16LE(pos + 8), 0x0800);
    assert.equal(bytes.readUInt16LE(pos + 10), 0);
    assert.equal(bytes.readUInt16LE(pos + 12), 0);
    assert.equal(bytes.readUInt16LE(pos + 14), 0x0021);
    const crc = bytes.readUInt32LE(pos + 16), size = bytes.readUInt32LE(pos + 24), nameLength = bytes.readUInt16LE(pos + 28), offset = bytes.readUInt32LE(pos + 42);
    const filename = bytes.subarray(pos + 46, pos + 46 + nameLength).toString('utf8');
    assert.equal(bytes.readUInt32LE(offset), 0x04034b50);
    assert.equal(bytes.readUInt32LE(offset + 14), crc);
    assert.equal(bytes.readUInt32LE(offset + 18), size);
    assert.equal(bytes.readUInt32LE(offset + 22), size);
    assert.equal(bytes.subarray(offset + 30, offset + 30 + nameLength).toString('utf8'), filename);
    const data = bytes.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    assert.equal(crc32(data), crc);
    entries.set(filename, data);
    pos += 46 + nameLength;
  }
  assert.equal(pos, endOffset);
  return entries;
}

test('ZIP content is deterministic, sorted and CRC-valid with Unicode filenames', () => {
  const entries = [{ name: 'z.txt', bytes: Buffer.from('last') }, { name: 'a.txt', bytes: Buffer.from('first') }, { name: '示例.txt', bytes: Buffer.from('demo') }];
  const first = buildZip(entries), second = buildZip([...entries].reverse());
  assert.deepEqual(first, second);
  const stored = readStoredZip(first);
  assert.deepEqual([...stored.keys()], ['a.txt', 'z.txt', '示例.txt']);
  assert.equal(stored.get('示例.txt').toString(), 'demo');
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.throws(() => buildZip([{ name: '../secret', bytes: Buffer.alloc(0) }]));
  assert.throws(() => buildZip([{ name: 'a', bytes: Buffer.alloc(0) }, { name: 'a', bytes: Buffer.alloc(0) }]));
});

test('release archive retains notices and validates HTML and ZIP without a circular manifest', async t => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'watermark-package-test-'));
  t.after(async () => {
    // Only remove this specifically created test directory after verifying its scope.
    assert.equal(path.dirname(path.resolve(tempRoot)), path.resolve(os.tmpdir()));
    assert(path.basename(tempRoot).startsWith('watermark-package-test-'));
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(tempRoot, 'dist'));
  await fs.mkdir(path.join(tempRoot, 'docs/examples'), { recursive: true });
  await fs.writeFile(path.join(tempRoot, 'package.json'), '{"version":"1.2.3"}');
  const htmlName = 'offline-watermark-v1.2.3.html', zipName = 'offline-watermark-v1.2.3.zip', html = Buffer.from('<!doctype html>\nOffline demo\n');
  await fs.writeFile(path.join(tempRoot, 'dist', htmlName), html);
  const fixtureFiles = ['LICENSE', 'LICENSE_NOTES.md', 'PRIVACY.md', 'PRIVACY.en.md', 'THIRD_PARTY_NOTICES.md', 'NOTICE', 'docs/examples/ATTRIBUTION.md', 'docs/examples/id-card-source.json'];
  for (const file of fixtureFiles) await fs.writeFile(path.join(tempRoot, file), `Public notice: ${path.basename(file)}\r\n`);
  const firstResult = await packageRelease(tempRoot), first = await fs.readFile(path.join(tempRoot, 'dist', zipName));
  const secondResult = await packageRelease(tempRoot), second = await fs.readFile(path.join(tempRoot, 'dist', zipName));
  assert.deepEqual(first, second);
  assert.equal(firstResult.manifest, secondResult.manifest);
  const entries = readStoredZip(first);
  assert.deepEqual([...entries.keys()], ['ATTRIBUTION.md', 'LICENSE', 'LICENSE_NOTES.md', 'NOTICE', 'PRIVACY.en.md', 'PRIVACY.md', 'SHA256SUMS.txt', 'THIRD_PARTY_NOTICES.md', 'id-card-source.json', htmlName]);
  assert.equal(entries.get('PRIVACY.md').toString(), 'Public notice: PRIVACY.md\n');
  assert.equal(entries.get('PRIVACY.en.md').toString(), 'Public notice: PRIVACY.en.md\n');
  assert.deepEqual(entries.get(htmlName), html);
  const sha = data => crypto.createHash('sha256').update(data).digest('hex');
  const inner = `${sha(html)}  ${htmlName}\n`;
  assert.equal(entries.get('SHA256SUMS.txt').toString(), inner);
  assert.equal(firstResult.manifest, `${inner}${sha(first)}  ${zipName}\n`);
  assert.equal((await fs.readFile(path.join(tempRoot, 'dist/SHA256SUMS.txt'))).toString(), firstResult.manifest);
  for (const name of ['LICENSE', 'NOTICE', 'ATTRIBUTION.md']) assert(!entries.get(name).includes(Buffer.from('\r\n')));
});
