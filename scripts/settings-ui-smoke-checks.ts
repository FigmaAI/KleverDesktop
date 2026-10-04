import assert from 'node:assert/strict';

// Render the real App with isolated in-memory IPC; never touch an account or SDK.
export async function verifySettingsUI(run: (code: string) => Promise<unknown>): Promise<void> {
  const waitFor = async (condition: string) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await run(condition)) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(`Settings UI condition was not met: ${condition}`);
  };
  const button = (label: string, scope = 'document') => `Array.from(${scope}.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)})`;
  const click = async (label: string) => { await run(`${button(label)}.click()`); };
  const header = 'document.querySelector("header")';
  const saveButton = `${header}.querySelector('button:last-child')`;
  const setSdkPath = async (value: string) => { await run(`(() => { const input = document.querySelector('#sdkPath'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`); };
  await run('window.accountUISmoke.mountSettingsApp()');
  await waitFor(`${button('Settings')} !== undefined`);
  await click('Settings');
  await waitFor(`${button('Disconnect')} !== undefined`);
  await waitFor("document.querySelector('#sdkPath')?.value === '/mock/sdk-original'");
  assert.equal(await run("document.querySelector('#language') !== null"), true);
  assert.equal(await run("document.querySelectorAll('.siwc-connection').length"), 1);
  assert.equal(await run(`${button('ChatGPT account')} === undefined && ${button('Android setup')} === undefined && ${button('Preferences')} === undefined`), true);
  assert.equal(await run(`${saveButton}.textContent.trim() === 'Saved' && ${saveButton}.disabled`), true);
  console.log('PASS one settings page contains one account card, Android setup and preferences');

  await waitFor(`${button('Android setup guide')} !== undefined && !${button('Android setup guide')}.disabled`);
  assert.equal(await run("Array.from(document.querySelectorAll('button')).filter(button => button.textContent.trim() === 'Android setup guide').length"), 1);
  assert.equal(await run(`${button('Official SDK download')} === undefined`), true);
  assert.equal(await run(`${button('How to create an emulator')} !== undefined`), true);
  await click('Android setup guide');
  await waitFor("window.accountUISmoke.settingsCalls.length === 1");
  assert.equal(await run("window.accountUISmoke.settingsCalls[0]"), 'sdk-guide');
  console.log('PASS missing Android tools have one SDK setup action and separate emulator help');

  await setSdkPath('/mock/sdk-edited');
  await waitFor(`${saveButton}.textContent.trim() === 'Save' && !${saveButton}.disabled`);
  await click('Disconnect');
  await waitFor(`${button('Continue with ChatGPT')} !== undefined && !${button('Continue with ChatGPT')}.disabled`);
  await click('Continue with ChatGPT');
  await waitFor("document.body.innerText.includes('Finish connecting in your browser.')");
  assert.equal(await run("document.querySelector('#sdkPath').value === '/mock/sdk-edited' && document.querySelector('#language') !== null"), true);
  assert.equal(await run("document.querySelectorAll('.siwc-connection').length"), 1);
  await click('Cancel');
  await waitFor(`${button('Continue with ChatGPT')} !== undefined && !${button('Continue with ChatGPT')}.disabled && !document.body.innerText.includes('Finish connecting in your browser.')`);
  assert.equal(await run('window.accountUISmoke.savedConfigs.length'), 0);
  await waitFor("document.querySelector('#sdkPath')?.value === '/mock/sdk-edited'");
  await waitFor(`${saveButton}.textContent.trim() === 'Save' && !${saveButton}.disabled`);
  await click('Save');
  await waitFor('window.accountUISmoke.savedConfigs.length === 1');
  await waitFor(`${saveButton}.textContent.trim() === 'Saved' && ${saveButton}.disabled`);
  assert.equal(await run('window.accountUISmoke.savedConfigs[0].android.sdkPath'), '/mock/sdk-edited');
  console.log('PASS account login and cancellation preserve the unsaved settings draft');

  await setSdkPath('/mock/sdk-save-in-progress');
  await waitFor(`${saveButton}.textContent.trim() === 'Save' && !${saveButton}.disabled`);
  await run('window.accountUISmoke.deferNextSave()');
  await click('Save');
  await waitFor(`${saveButton}.textContent.trim() === 'Saving...'`);
  await setSdkPath('/mock/sdk-newer-draft');
  await run('window.accountUISmoke.finishSave()');
  await waitFor('window.accountUISmoke.savedConfigs.length === 2');
  await waitFor(`${saveButton}.textContent.trim() === 'Save' && !${saveButton}.disabled`);
  assert.equal(await run('window.accountUISmoke.savedConfigs[1].android.sdkPath'), '/mock/sdk-save-in-progress');
  assert.equal(await run("document.querySelector('#sdkPath').value"), '/mock/sdk-newer-draft');
  await click('Save');
  await waitFor('window.accountUISmoke.savedConfigs.length === 3');
  await waitFor(`${saveButton}.textContent.trim() === 'Saved' && ${saveButton}.disabled`);
  assert.equal(await run('window.accountUISmoke.savedConfigs[2].android.sdkPath'), '/mock/sdk-newer-draft');
  console.log('PASS an older async save cannot mark a newer SDK draft as saved');

  await setSdkPath('/mock/sdk-shortcut-save');
  await waitFor(`${saveButton}.textContent.trim() === 'Save' && !${saveButton}.disabled`);
  await run("document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, ctrlKey: true, bubbles: true }))");
  await waitFor('window.accountUISmoke.savedConfigs.length === 4');
  await waitFor(`${saveButton}.textContent.trim() === 'Saved' && ${saveButton}.disabled`);
  assert.equal(await run('window.accountUISmoke.savedConfigs[3].android.sdkPath'), '/mock/sdk-shortcut-save');
  console.log('PASS the common settings save shortcut saves edited configuration once');
}
