import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { verifySettingsUI } from './settings-ui-smoke-checks';

const scratch = process.env.KLEVER_ACCOUNT_UI_ROOT;
if (!scratch) throw new Error('Missing isolated account UI scratch directory.');
for (const name of ['userData', 'sessionData'] as const) {
  const directory = path.join(scratch, name);
  fs.mkdirSync(directory, { recursive: true });
  app.setPath(name, directory);
}

async function verify() {
  await app.whenReady();
  const window = new BrowserWindow({ show: false, width: 1100, height: 800, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^https?:/.test(details.url) }));
  await window.loadFile(path.join(scratch!, 'renderer/index.html'));
  const run = (code: string) => window.webContents.executeJavaScript(code);
  const waitText = async (text: string) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await run(`document.body.innerText.includes(${JSON.stringify(text)})`)) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(`Account UI did not render: ${text}`);
  };
  const click = (label: string) => run(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const seed = (sharing: boolean, errorCode?: string) => run(`window.accountUISmoke.update({authenticated:true,email:'qa@example.invalid',sdkSession:{status:'connected',sharing:${sharing},identity:{name:'Test User',email:'qa@example.invalid'}${errorCode ? `,error:{code:${JSON.stringify(errorCode)},message:'Simulated limit',retryable:true}` : ''}}})`);
  await waitText('Continue with ChatGPT');
  await click('Continue with ChatGPT');
  await waitText('Finish connecting in your browser.');
  await click('Cancel');
  await waitText('Continue with ChatGPT');
  assert.equal(await run("window.accountUISmoke.calls.some(call => call.method === 'cancel')"), true);
  console.log('PASS official sign-in pending and cancel callbacks');

  await seed(false);
  await waitText('Enable usage sharing');
  await click('Enable usage sharing');
  await waitText('Finish connecting in your browser.');
  assert.equal(await run("window.accountUISmoke.calls.filter(call => call.method === 'login').at(-1).options.reconsent"), true);
  console.log('PASS identity-only connection explicitly requests sharing reconsent');

  await seed(true);
  await waitText('Usage sharing is enabled.');
  const text = await run('document.body.innerText');
  assert.ok(!/Using ChatGPT (plan|credits)|Connected with ChatGPT/.test(text));
  assert.equal(await run("document.querySelectorAll('.siwc-connection').length"), 1);
  assert.equal(await run("document.querySelectorAll('.siwc-usage').length"), 0);
  assert.equal(await run("Array.from(document.querySelectorAll('button')).filter(button => button.textContent.trim() === 'Manage usage').length"), 1);
  assert.equal(await run("Array.from(document.querySelectorAll('.siwc-connection__actions button')).filter(button => button.textContent.trim() === 'Manage usage').length"), 1);
  assert.equal(await run("document.querySelectorAll('.siwc-recovery').length"), 0);
  const normalUsageCalls = await run("window.accountUISmoke.calls.filter(call => call.method === 'openExternal').length");
  await click('Manage usage');
  assert.equal(await run("window.accountUISmoke.calls.filter(call => call.method === 'openExternal').length"), normalUsageCalls + 1);
  assert.equal(await run("window.accountUISmoke.calls.at(-1).url"), 'https://chatgpt.com/settings/usage');
  console.log('PASS one official account usage action without repeated connection status');

  for (const code of ['subscription_sharing_usage_limit_exceeded', 'usage_limit']) {
  await seed(true, code);
  await waitText('ChatGPT usage limit reached');
  const limited = await run('document.body.innerText');
  assert.ok(!/five-hour|weekly/i.test(limited));
  assert.equal(await run("document.querySelectorAll('.siwc-usage').length"), 0);
  assert.equal(await run("Array.from(document.querySelectorAll('button')).filter(button => button.textContent.trim() === 'Manage usage').length"), 1);
  assert.equal(await run("Array.from(document.querySelectorAll('.siwc-connection__actions button')).filter(button => button.textContent.trim() === 'Manage usage').length"), 0);
  assert.equal(await run("Array.from(document.querySelectorAll('.siwc-recovery__actions button')).filter(button => button.textContent.trim() === 'Manage usage').length"), 1);
  const limitedUsageCalls = await run("window.accountUISmoke.calls.filter(call => call.method === 'openExternal').length");
  await click('Manage usage');
  assert.equal(await run("window.accountUISmoke.calls.filter(call => call.method === 'openExternal').length"), limitedUsageCalls + 1);
  assert.equal(await run("window.accountUISmoke.calls.at(-1).url"), 'https://chatgpt.com/settings/usage');
  }
  console.log('PASS one usage-limit recovery action without invented quota window');
  await click('Disconnect');
  await waitText('Continue with ChatGPT');
  assert.equal(await run("window.accountUISmoke.calls.at(-1).method"), 'logout');
  console.log('PASS official disconnect callback');
  await verifySettingsUI(run);
  window.destroy();
  console.log('ACCOUNT_UI_SMOKE_OK {"checks":10,"offline":true,"mockIPC":true,"nativeExecution":false}');
  app.quit();
}
void verify().catch(error => { console.error(error.message); app.exit(1); });
