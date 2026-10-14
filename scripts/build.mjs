// Copyright 2026 zouchenzhen. SPDX-License-Identifier: MIT
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const textBase64 = text => Buffer.from(text, 'utf8').toString('base64');

// Source text belongs in a Blob module, never in HTML's script-data parser.
// This preserves strings, comments, operators and UTF-8 without eval or CSP changes.
export const APP_BOOTSTRAP = `
const exportButtons = ['png', 'jpg', 'pdf', 'manifest'];
for (const id of exportButtons) {
  const button = document.getElementById(id);
  if (button) button.disabled = true;
}
let appModuleUrl;
try {
  const encoded = JSON.parse(document.getElementById('bundle').textContent).app;
  const source = new TextDecoder().decode(Uint8Array.from(atob(encoded), char => char.charCodeAt(0)));
  appModuleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  await import(appModuleUrl);
} catch (error) {
  for (const id of exportButtons) {
    const button = document.getElementById(id);
    if (button) button.disabled = true;
  }
  const status = document.getElementById('status');
  if (status) {
    const failureMessages = {
      'zh-CN': '工具加载失败，请重新打开此文件或重新下载完整离线文件。',
      en: 'The tool could not load. Reopen this file or download the complete offline file again.'
    };
    const showFailure = language => {
      if (document.documentElement) document.documentElement.lang = language;
      status.textContent = failureMessages[language];
      for (const [id, value] of [['languageZh', 'zh-CN'], ['languageEn', 'en']]) {
        const button = document.getElementById(id);
        if (button) button.setAttribute?.('aria-pressed', String(value === language));
      }
    };
    showFailure(document.documentElement?.lang === 'en' ? 'en' : 'zh-CN');
    for (const [id, language] of [['languageZh', 'zh-CN'], ['languageEn', 'en']]) {
      const button = document.getElementById(id);
      if (button) { button.disabled = false; button.onclick = () => showFailure(language); }
    }
    status.classList.add('error');
  }
  console.error('Offline Document Watermark startup failed.', error);
} finally {
  if (appModuleUrl) URL.revokeObjectURL(appModuleUrl);
}
`.trim();

/** Assemble the document once; inserted payloads cannot become template tokens. */
export function assembleHtml({ template, css, bundle, app, version }) {
  if ([template, css, app, version].some(value => typeof value !== 'string')) throw Error('Build inputs must be text.');
  const insertions = {
    '__VERSION__': version,
    '/*__CSS__*/': css.replace(/<\/style/gi, text => '<\\/' + text.slice(2)),
    '/*__APP__*/': APP_BOOTSTRAP,
  };
  // A callback preserves $&, $`, $', and $$ in all payloads literally.
  const insert = part => part.replace(/__VERSION__|\/\*__(?:CSS|APP)__\*\//g, token => insertions[token]);
  const marker = '/*__BUNDLE__*/', position = template.indexOf(marker);
  if (position < 0 || template.indexOf(marker, position + marker.length) >= 0) throw Error('Template must contain exactly one bundle insertion.');
  // These static halves never include bundle JSON, so there is no recursive copy.
  // The download reconstructs these bytes rather than serializing runtime DOM.
  const prefix = insert(template.slice(0, position)), suffix = insert(template.slice(position + marker.length));
  const serialized = JSON.stringify({ ...bundle, app: textBase64(app), documentPrefix: textBase64(prefix), documentSuffix: textBase64(suffix) })
    .replace(/[<\u2028\u2029]/g, char => char === '<' ? '\\u003c' : char === '\u2028' ? '\\u2028' : '\\u2029');
  return prefix + serialized + suffix;
}

export function buildProject() {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');
  const base64 = file => fs.readFileSync(path.join(root, file)).toString('base64');
  const text64 = file => textBase64(read(file));
  const version = JSON.parse(read('package.json')).version;
  if (!/^\d+\.\d+\.\d+$/.test(version) || !read('src/core.mjs').includes("VERSION='" + version + "'")) throw Error('Package and runtime version must match.');
  const htmlName = 'offline-watermark-v' + version + '.html';
  const assets = {};
  for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    for (const name of fs.readdirSync(path.join(root, 'vendor/pdfjs', folder)).sort()) {
      if (name.startsWith('LICENSE')) continue;
      const file = path.join('vendor/pdfjs', folder, name);
      if (fs.statSync(path.join(root, file)).isFile()) assets[folder + '/' + name] = base64(file);
    }
  }
  const samples = JSON.parse(read('docs/examples/demo-sizes.json')).map(sample => ({ ...sample, jpeg: base64('docs/examples/' + sample.file) }));
  const licenses = { MIT: read('LICENSE'), 'PDF.js': read('vendor/pdfjs/LICENSE') };
  for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    for (const name of fs.readdirSync(path.join(root, 'vendor/pdfjs', folder)).sort()) {
      if (name.startsWith('LICENSE')) licenses[folder + '/' + name] = read('vendor/pdfjs/' + folder + '/' + name);
    }
  }
  const bundle = { core: text64('src/core.mjs'), preferences: text64('src/preferences.mjs'), i18n: text64('src/i18n.mjs'), workerAssets: text64('src/worker-assets.mjs'), pdf: text64('vendor/pdfjs/pdf.min.mjs'), worker: text64('vendor/pdfjs/pdf.worker.min.mjs'), assets, samples, licenses };
  const html = assembleHtml({ template: read('src/index.template.html'), css: read('src/style.css'), bundle, app: read('src/app.mjs'), version });
  const out = path.join(root, 'dist');
  fs.mkdirSync(path.join(out, 'site'), { recursive: true });
  for (const name of ['index.html', htmlName]) fs.writeFileSync(path.join(out, 'site', name), html);
  fs.writeFileSync(path.join(out, htmlName), html);
  const sums = crypto.createHash('sha256').update(Buffer.from(html)).digest('hex') + '  ' + htmlName + '\n';
  fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), sums);
  fs.writeFileSync(path.join(out, 'site/SHA256SUMS.txt'), sums);
  for (const name of ['LICENSE', 'LICENSE_NOTES.md', 'PRIVACY.md', 'PRIVACY.en.md', 'THIRD_PARTY_NOTICES.md']) fs.copyFileSync(path.join(root, name), path.join(out, name));
  fs.writeFileSync(path.join(out, 'site/.nojekyll'), '');
  console.log('Built self-contained HTML: ' + (Buffer.byteLength(html) / 1024 / 1024).toFixed(2) + ' MiB. SHA-256 manifest written.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildProject();
