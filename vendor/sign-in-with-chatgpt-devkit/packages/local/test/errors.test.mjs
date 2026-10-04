import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonResponse } from '../dist/errors.js';
import { listModels } from '../dist/models.js';

function interruptedResponse(reason, status = 200) {
  let body;
  const response = new Response(new ReadableStream({
    start(controller) {
      body = controller;
      controller.enqueue(new TextEncoder().encode('{"models":['));
    },
  }), { status });
  return { response, interrupt: () => body.error(reason) };
}

for (const name of ['AbortError', 'TimeoutError']) {
  for (const status of [200, 400, 503]) {
    test(`${name} during an HTTP ${status} JSON body remains cancellation`, async () => {
      const { response, interrupt } = interruptedResponse(new DOMException('Synthetic cancellation', name), status);
      const reading = jsonResponse(response);
      interrupt();
      await assert.rejects(reading, { code: 'cancelled', retryable: false });
    });
  }
}

test('model-list cancellation after headers does not become invalid_response', async (t) => {
  const controller = new AbortController();
  let headersReceived;
  const receivingHeaders = new Promise((resolve) => { headersReceived = resolve; });
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    const { response, interrupt } = interruptedResponse(new DOMException('Synthetic cancellation', 'AbortError'));
    signal.addEventListener('abort', interrupt, { once: true });
    headersReceived();
    return response;
  });
  const listing = listModels('synthetic-access-token', controller.signal);
  await receivingHeaders;
  controller.abort();
  await assert.rejects(listing, { code: 'cancelled' });
});

test('malformed successful JSON still produces invalid_response', async () => {
  await assert.rejects(jsonResponse(new Response('{not json', { status: 200 })), {
    code: 'invalid_response', status: 200, retryable: true,
  });
});

test('malformed error JSON preserves HTTP failure diagnostics', async () => {
  await assert.rejects(jsonResponse(new Response('<html>Unavailable</html>', {
    status: 503, headers: { 'x-request-id': 'synthetic-request-id' },
  })), {
    code: 'api_error', status: 503, retryable: true, requestId: 'synthetic-request-id',
  });
});

test('valid JSON responses remain unchanged', async () => {
  assert.deepEqual(await jsonResponse(Response.json({ models: [] })), { models: [] });
});
