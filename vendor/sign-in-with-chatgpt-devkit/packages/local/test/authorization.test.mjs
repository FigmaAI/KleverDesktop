import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { get } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { authorize } from '../dist/oauth.js';

const issuer = 'https://auth.openai.com';
const clientId = 'authorization_test_client';
const subject = 'authorization-test-subject';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwks = { keys: [{ ...await exportJWK(publicKey), kid: 'authorization-test-key', use: 'sig', alg: 'RS256' }] };

function identity(claims = {}) {
  return new SignJWT({ iss: issuer, aud: clientId, sub: subject, iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'authorization-test-key' }).sign(privateKey);
}

function visitCallback(authorization) {
  const callback = new URL(authorization.searchParams.get('redirect_uri'));
  callback.searchParams.set('code', 'synthetic-authorization-code');
  callback.searchParams.set('state', authorization.searchParams.get('state'));
  return new Promise((resolve, reject) => {
    const request = get(callback, (response) => {
      response.resume();
      response.once('end', () => response.statusCode === 200 ? resolve() : reject(new Error('Loopback callback rejected')));
      response.once('error', reject);
    });
    request.once('error', reject);
  });
}

async function reauthorize(t, { customOpener = false, claims = {} } = {}) {
  const previous = { version: 1, clientId, subject, status: 'connected', scopes: ['openid', 'offline_access'],
    savedAt: new Date().toISOString(), identity: { email: 'synthetic@example.invalid' },
    profileIdToken: await identity({ nonce: 'previous-authorization-nonce' }),
    credentials: { accessToken: 'previous-synthetic-access', refreshToken: 'previous-synthetic-refresh', expiresAt: Date.now() + 3600_000 } };
  let authorization;
  let launchCount = 0;
  let tokenCount = 0;
  const inspectAuthorization = (url) => {
    launchCount++;
    authorization = new URL(url);
    assert.equal(authorization.origin, issuer);
    assert.equal(authorization.searchParams.has('id_token_hint'), false);
    for (const token of [previous.profileIdToken, previous.credentials.accessToken, previous.credentials.refreshToken]) {
      assert.equal(decodeURIComponent(url).includes(token), false, 'Browser launch must not contain a saved token');
    }
    assert.equal(authorization.searchParams.get('client_id'), clientId);
    assert.equal(authorization.searchParams.get('login_hint'), previous.identity.email);
    assert.equal(authorization.searchParams.get('prompt'), 'consent');
    assert.equal(authorization.searchParams.get('response_type'), 'code');
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(authorization.searchParams.get('state'));
    assert.ok(authorization.searchParams.get('nonce'));
  };

  // Intercept the actual subprocess boundary without opening the user's browser.
  // syncBuiltinESMExports updates oauth.ts's named import of the built-in spawn.
  const spawn = t.mock.method(childProcess, 'spawn', (command, args, options) => {
    assert.equal(customOpener, false, 'A custom opener must not spawn the default opener');
    assert.equal(command, process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open');
    assert.equal(options.shell, false);
    const url = args.at(-1);
    inspectAuthorization(url);
    assert.deepEqual(args, process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url]);
    const child = new EventEmitter();
    queueMicrotask(() => {
      visitCallback(authorization).then(() => child.emit('exit', 0), (error) => child.emit('error', error));
    });
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => { spawn.mock.restore(); syncBuiltinESMExports(); });

  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === `${issuer}/.well-known/openid-configuration`) {
      return Response.json({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/oauth/token`, jwks_uri: `${issuer}/jwks` });
    }
    if (url === `${issuer}/jwks`) return Response.json(jwks);
    if (url === `${issuer}/oauth/token`) {
      tokenCount++;
      assert.equal(options.body.get('grant_type'), 'authorization_code');
      assert.equal(options.body.get('client_id'), clientId);
      assert.equal(options.body.get('code'), 'synthetic-authorization-code');
      assert.equal(createHash('sha256').update(options.body.get('code_verifier')).digest('base64url'), authorization.searchParams.get('code_challenge'));
      return Response.json({ id_token: await identity({ nonce: authorization.searchParams.get('nonce'), ...claims }),
        access_token: 'replacement-synthetic-access', refresh_token: 'replacement-synthetic-refresh', token_type: 'Bearer',
        scope: 'openid offline_access', expires_in: 3600 });
    }
    assert.fail(`Unexpected provider request: ${url}`);
  });

  const config = { appName: 'Authorization Test', appId: 'authorization-test', redirectPort: 0,
    ...(customOpener ? { openBrowser: async (url) => { inspectAuthorization(url); await visitCallback(authorization); } } : {}) };
  const connection = await authorize(config, previous, 'synthetic-host', AbortSignal.timeout(5_000), { reconsent: true });
  assert.equal(launchCount, 1);
  assert.equal(tokenCount, 1);
  return connection;
}

for (const customOpener of [false, true]) {
  test(`saved-profile reauthorization keeps tokens out of the ${customOpener ? 'custom opener URL' : 'default opener process arguments'}`, async (t) => {
    const connection = await reauthorize(t, { customOpener });
    assert.equal(connection.subject, subject);
    assert.equal(connection.credentials.accessToken, 'replacement-synthetic-access');
  });
}

test('reauthorization without an ID-token hint still rejects a different verified subject', async (t) => {
  await assert.rejects(reauthorize(t, { claims: { sub: 'different-synthetic-subject' } }), { code: 'account_mismatch' });
});

test('reauthorization without an ID-token hint still rejects an invalid nonce', async (t) => {
  await assert.rejects(reauthorize(t, { claims: { nonce: 'unrelated-authorization-nonce' } }), { code: 'invalid_id_token' });
});
