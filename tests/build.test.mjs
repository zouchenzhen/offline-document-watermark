import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { assembleHtml, APP_BOOTSTRAP } from '../scripts/build.mjs';

const template = '<!doctype html><title>v__VERSION__</title><style>/*__CSS__*/</style><script id="bundle" type="application/json">/*__BUNDLE__*/</script><script type="module">/*__APP__*/</script><footer>v__VERSION__</footer>';
function extract(html) {
  const matches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(matches.length, 2);
  return { json: matches[0][1], loader: matches[1][1] };
}

test('bundle safely round-trips HTML parser traps, dollar replacements and Unicode separators', () => {
  const payload = '</script><script>alert("fictional")</script><!--<script> $& $` $\' $$ /*__APP__*/ __VERSION__ \u2028\u2029 简体中文';
  const bundle = { licenses: { Synthetic: payload }, nested: [{ text: payload }] };
  const html = assembleHtml({ template, css: 'body { color: black; }', bundle, app: `globalThis.publicValue = ${JSON.stringify(payload)};`, version: '0.3.0' });
  const { json, loader } = extract(html), decoded = JSON.parse(json);
  assert(!json.includes('<'));
  assert(!json.includes('\u2028'));
  assert(!json.includes('\u2029'));
  assert.equal(decoded.licenses.Synthetic, payload);
  assert.deepEqual(decoded.nested, bundle.nested);
  assert.equal(Buffer.from(decoded.app, 'base64').toString('utf8'), `globalThis.publicValue = ${JSON.stringify(payload)};`);
  assert.equal(loader, APP_BOOTSTRAP);
  assert.equal((html.match(/<script\b/gi) || []).length, 2);
  assert.equal((html.match(/<\/script>/gi) || []).length, 2);
});

test('template insertion preserves dollars and inserted template-looking fragments literally', () => {
  const css = 'body::before { content: "$& $` $\' $$ /*__BUNDLE__*/ /*__APP__*/ __VERSION__"; }';
  const app = 'const comparison = 1 < 2; // $& $` $\' $$ /*__CSS__*/\nglobalThis.publicValue = comparison;';
  const html = assembleHtml({ template, css, bundle: { licenses: { Synthetic: '$& $` $\' $$ /*__APP__*/' } }, app, version: '0.3.0' });
  assert(html.includes('<style>' + css + '</style>'));
  assert(html.includes('<title>v0.3.0</title>'));
  assert(html.endsWith('<footer>v0.3.0</footer>'));
  const { json } = extract(html), decoded = JSON.parse(json);
  assert.equal(Buffer.from(decoded.app, 'base64').toString(), app);
  assert.equal(decoded.licenses.Synthetic, '$& $` $\' $$ /*__APP__*/');
});

test('closing style tags in CSS source cannot create an extra script element', () => {
  const html = assembleHtml({ template, css: 'body::before { content: "</StYlE><script>demo</script>"; }', bundle: {}, app: '', version: '0.3.0' });
  assert(html.includes('<style>body::before { content: "<\\/StYlE><script>demo</script>"; }</style>'));
  // Script-like text remains within style's raw-text body, not a script element.
  const outsideStyle = html.replace(/<style>[\s\S]*?<\/style>/gi, '');
  assert.equal((outsideStyle.match(/<script\b/gi) || []).length, 2);
});

function runBootstrap(app) {
  const html = assembleHtml({ template, css: '', bundle: {}, app, version: '0.3.0' });
  const { json, loader } = extract(html);
  // A standard Node module VM evaluates the actual generated bootstrap and Blob
  // module. This is a code regression check, not a browser compatibility claim.
  const childSource = `
import vm from 'node:vm';
const input = ${JSON.stringify({ json, loader })};
const elements = Object.fromEntries(['png','jpg','pdf','manifest','status','bundle'].map(id => [id, {disabled:false,textContent:id === 'bundle' ? input.json : '',classes:[],classList:{add(value){elements[id].classes.push(value);}}}]));
const blobs = new Map(), revoked = [], errors = [];
const context = vm.createContext({document:{getElementById:id=>elements[id]},atob,TextDecoder,Uint8Array,Blob,URL:{createObjectURL(blob){const url='blob:synthetic/'+blobs.size;blobs.set(url,blob);return url;},revokeObjectURL(url){revoked.push(url);blobs.delete(url);}},console:{error(...args){errors.push(String(args[0]));}}});
const loader = new vm.SourceTextModule(input.loader, {context,importModuleDynamically:async url => {
  const module = new vm.SourceTextModule(await blobs.get(url).text(), {context});
  await module.link(() => {throw Error('Unexpected external module import.');});
  await module.evaluate();
  return module;
}});
await loader.link(() => {throw Error('Unexpected bootstrap import.');});
await loader.evaluate();
process.stdout.write(JSON.stringify({value:context.publicValue,leakedScopedVariable:Object.hasOwn(context,'scoped'),disabled:['png','jpg','pdf','manifest'].map(id=>elements[id].disabled),status:elements.status.textContent,errorClass:elements.status.classes.includes('error'),revoked:revoked.length,errors:errors.length}));
`;
  return JSON.parse(execFileSync(process.execPath, ['--experimental-vm-modules', '--input-type=module'], { input: childSource, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }));
}

test('actual Blob module bootstrap preserves UTF-8, module scope and dangerous source strings', () => {
  const value = '</script><script><!-- $& $` $\' $$ \u2028\u2029 简体中文';
  const result = runBootstrap(`const scoped = ${JSON.stringify(value)};\nglobalThis.publicValue = scoped;\ndocument.getElementById('png').disabled = false;`);
  assert.equal(result.value, value);
  assert.equal(result.leakedScopedVariable, false);
  assert.equal(result.disabled[0], false);
  assert.equal(result.status, '');
  assert.equal(result.errors, 0);
  assert.equal(result.revoked, 1);
});

test('bootstrap failures show a visible error and keep all export buttons disabled', () => {
  for (const source of ['throw new Error("Synthetic bootstrap failure");', 'const = invalid syntax;']) {
    const result = runBootstrap(source);
    assert.deepEqual(result.disabled, [true, true, true, true]);
    assert.match(result.status, /工具加载失败/);
    assert(result.errorClass);
    assert.equal(result.errors, 1);
    assert.equal(result.revoked, 1);
  }
});
