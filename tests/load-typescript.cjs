const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');

/** Load a TypeScript module with isolated imports and globals for offline tests. */
module.exports = function loadTypeScript(relativePath, mocks = {}, globals = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  const context = {
    console, Buffer, URL, URLSearchParams, TextDecoder, TextEncoder,
    AbortController, AbortSignal, Request, Response, Headers,
    fetch, process, setTimeout, clearTimeout, setInterval, clearInterval,
    ...globals,
  };
  const wrapper = vm.runInNewContext(`(function(require,module,exports,__filename,__dirname){${compiled}\n})`, context, { filename });
  wrapper((name) => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : nativeRequire(name),
    module, module.exports, filename, path.dirname(filename));
  return module.exports;
};
