#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const required = ['.vite/build/index.js', '.vite/build/preload.js', 'dist/index.html',
  'vendor/sign-in-with-chatgpt-devkit/LICENSE',
  'vendor/sign-in-with-chatgpt-devkit/THIRD_PARTY_NOTICES.md',
  'vendor/sign-in-with-chatgpt-devkit/README.md'];
const htmlPath = path.join(root, 'dist', 'index.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  for (const match of html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)) {
    required.push(path.join('dist', match[1]));
  }
}
// DevKit icons/fonts are referenced by compiled CSS as well as by the HTML.
for (const file of [...required].filter(file => file.startsWith('dist/') && file.endsWith('.css'))) {
  if (!fs.existsSync(path.join(root, file))) continue;
  const css = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of css.matchAll(/url\(\s*["']?([^"'\s)]+)["']?\s*\)/g)) {
    if (/^(?:data:|https?:|\/\/|#)/.test(match[1])) continue;
    required.push(path.join(path.dirname(file), match[1]));
  }
}
let missing = 0;
for (const file of [...new Set(required)]) {
  const present = fs.existsSync(path.join(root, file));
  console.log(`${present ? 'PASS' : 'FAIL'} ${file}`);
  if (!present) missing++;
}
if (missing) console.error('Run npm run build:local before verifying the bundle.');
else console.log('Generated Electron and renderer files are available.');
process.exitCode = missing ? 1 : 0;
