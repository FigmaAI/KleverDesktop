const test = require('node:test');
const assert = require('node:assert/strict');
const loadTypeScript = require('./load-typescript.cjs');

// These tests use the installed OpenAI SDK and replace only the HTTP transport.
// No SDK classes, parsers, or response iterators are mocked.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';
const TOKEN = 'offline-chatgpt-plan-token';
const request = (values = {}) => ({ prompt: 'Verify the native screenshot.', images: [PNG], ...values });
const models = (entries = [{ slug: 'gpt-6-luna', visibility: 'list' }]) => Response.json({ models: entries });
const event = (type, values = {}) => `event: ${type}\r\ndata: ${JSON.stringify({ type, ...values })}\r\n\r\n`;
const emptyAction = () => ({ x: null, y: null, endX: null, endY: null, durationMs: null, text: null });
const androidStep = (values = {}) => ({
  observation: '다음 화면으로 이동하는 버튼이 보입니다.', intent: 'Open the next screen.',
  action: { type: 'tap', ...emptyAction(), x: 20, y: 40 },
  assessment: 'continue', reason: 'The goal still needs verification.', ...values,
});
const functionItem = (argumentsText = JSON.stringify(androidStep()), values = {}) => ({
  type: 'function_call', id: 'fc-offline', call_id: 'call-offline', namespace: 'native_android',
  name: 'emit_android_step', status: 'completed', arguments: argumentsText, ...values,
});
const completed = (values = {}) => event('response.completed', { response: {
  id: 'resp-offline', object: 'response', status: 'completed', model: 'gpt-6-luna', output: [],
  usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 }, ...values,
} });

function callEvents(argumentsText = JSON.stringify(androidStep()), values = {}, outputIndex = 0) {
  const item = functionItem(argumentsText, values);
  return event('response.output_item.added', { output_index: outputIndex, item: { ...item, status: 'in_progress', arguments: '' } })
    + event('response.function_call_arguments.delta', { output_index: outputIndex, item_id: item.id, delta: argumentsText.slice(0, 20) })
    + event('response.function_call_arguments.done', { output_index: outputIndex, item_id: item.id, arguments: argumentsText })
    + event('response.output_item.done', { output_index: outputIndex, item });
}

function streamResponse(sse, { chunkSize = 17, headers = { 'content-type': 'text/event-stream', 'x-request-id': 'req-offline' } } = {}) {
  const bytes = new TextEncoder().encode(sse);
  let position = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (position === bytes.length) return controller.close();
      controller.enqueue(bytes.slice(position, position + chunkSize));
      position = Math.min(position + chunkSize, bytes.length);
    },
  }), { headers });
}

function inference(fetch) {
  return loadTypeScript('main/utils/chatgpt-inference.ts', {}, { fetch, structuredClone });
}

function withStream(sse, options) {
  return inference(async url => String(url).endsWith('/models') ? models() : streamResponse(sse, options));
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertCode(code) {
  return error => { assert.equal(error.code, code); return true; };
}

test('the installed SDK sends the strict native function with the OAuth bearer and decodes headerless split-byte SSE', async () => {
  const calls = [];
  const diagnostics = [];
  const envNames = ['OPENAI_API_KEY', 'OPENAI_ORG_ID', 'OPENAI_PROJECT_ID'];
  const previous = envNames.map(name => process.env[name]);
  for (const name of envNames) process.env[name] = `offline-env-${name}`;
  try {
    const { inferStructuredAndroidStep } = inference(async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith('/models')) return models([
        { slug: 'gpt-6.1-sol', visibility: 'list' },
        { slug: 'gpt-6-luna', visibility: 'list', input_modalities: ['text', 'image'] },
      ]);
      return streamResponse(': heartbeat\r\n\r\n' + callEvents() + completed(), { chunkSize: 1, headers: {} });
    });
    const result = await inferStructuredAndroidStep(request({ onResponseDiagnostics: value => diagnostics.push(value) }), TOKEN);
    assert.deepEqual(plain(result.step), androidStep());
    assert.deepEqual(plain(result.usage), { input_tokens: 100, output_tokens: 20, total_tokens: 120 });
    assert.equal(result.model, 'gpt-6-luna');
    assert.deepEqual(calls.map(call => call.url), ['https://api.openai.com/v1/models', 'https://api.openai.com/v1/responses']);
    for (const { options } of calls) {
      const headers = new Headers(options.headers);
      assert.equal(headers.get('authorization'), `Bearer ${TOKEN}`);
      assert.equal(headers.has('openai-organization'), false);
      assert.equal(headers.has('openai-project'), false);
      assert.equal(options.redirect, 'error');
    }
    assert.equal(new Headers(calls[0].options.headers).get('accept'), 'application/json');
    assert.equal(new Headers(calls[1].options.headers).get('accept'), 'text/event-stream');
    const body = JSON.parse(calls[1].options.body);
    assert.deepEqual(Object.keys(body).sort(), ['input', 'model', 'parallel_tool_calls', 'store', 'stream', 'tool_choice', 'tools']);
    assert.equal(body.model, 'gpt-6-luna');
    assert.equal(body.store, false);
    assert.equal(body.stream, true);
    assert.equal(body.parallel_tool_calls, false);
    assert.equal(body.tool_choice, 'required');
    assert.deepEqual(body.input, [{ role: 'user', content: [
      { type: 'input_text', text: request().prompt },
      { type: 'input_image', image_url: `data:image/png;base64,${PNG}`, detail: 'auto' },
    ] }]);
    assert.equal(body.tools.length, 1);
    const namespace = body.tools[0];
    assert.equal(namespace.type, 'namespace');
    assert.equal(namespace.name, 'native_android');
    assert.equal(namespace.tools.length, 1);
    const tool = namespace.tools[0];
    assert.equal(tool.type, 'function');
    assert.equal(tool.name, 'emit_android_step');
    assert.equal(tool.strict, true);
    assert.equal(tool.parameters.additionalProperties, false);
    assert.deepEqual(tool.parameters.required, ['observation', 'intent', 'action', 'assessment', 'reason']);
    const variants = tool.parameters.properties.action.anyOf;
    assert.equal(variants.length, 7);
    for (const variant of variants) {
      assert.equal(variant.additionalProperties, false);
      assert.deepEqual(variant.required, ['type', 'x', 'y', 'endX', 'endY', 'durationMs', 'text']);
    }
    const variant = type => variants.find(item => item.properties.type.enum[0] === type);
    for (const [type, fields] of [
      ['tap', ['x', 'y']], ['swipe', ['x', 'y', 'endX', 'endY', 'durationMs']],
      ['text', ['text']], ['wait', ['durationMs']], ['back', []], ['enter', []], ['finish', []],
    ]) {
      for (const field of ['x', 'y', 'endX', 'endY', 'durationMs', 'text']) {
        assert.equal(variant(type).properties[field].type, fields.includes(field) ? field === 'text' ? 'string' : 'number' : 'null');
      }
    }
    assert.deepEqual(tool.parameters.properties.assessment.enum, ['continue', 'passed', 'failed', 'unverified']);
    assert.equal(diagnostics.at(-1).contentType, '');
    assert.equal(diagnostics.at(-1).requestId, undefined);
    assert.equal(diagnostics.at(-1).bodyKind, 'sse');
    assert.equal(diagnostics.at(-1).functionCallCount, 1);
    assert.equal(JSON.stringify(diagnostics).includes(androidStep().observation), false);
  } finally {
    envNames.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});

test('account visibility and explicit image/function capabilities override known model defaults', async () => {
  let selected;
  const { inferStructuredAndroidStep } = inference(async (url, options) => {
    if (String(url).endsWith('/models')) return models([
      { slug: 'gpt-6-luna', visibility: 'list', capabilities: { structured_outputs: false } },
      { slug: 'gpt-5.6-luna', visibility: 'hidden', input_modalities: ['text', 'image'] },
      { slug: 'gpt-6-sol', visibility: 'list', capabilities: { image_input: false } },
      { slug: 'unknown-text', visibility: 'list', input_modalities: ['text'] },
      { slug: 'gpt-6.1-sol', visibility: 'list', inputModalities: ['text', 'image'], structured_outputs: true },
    ]);
    selected = JSON.parse(options.body).model;
    return streamResponse(callEvents() + completed({ model: selected }));
  });
  assert.equal((await inferStructuredAndroidStep(request(), TOKEN)).model, 'gpt-6.1-sol');
  assert.equal(selected, 'gpt-6.1-sol');
});

test('prefers an available Luna model and never invents an absent account slug', async () => {
  const { inferStructuredAndroidStep } = inference(async url => String(url).endsWith('/models')
    ? models([{ slug: 'gpt-5.6-luna', visibility: 'list' }, { slug: 'gpt-6.1-sol', visibility: 'list' }])
    : streamResponse(callEvents() + completed({ model: 'gpt-5.6-luna' })));
  assert.equal((await inferStructuredAndroidStep(request(), TOKEN)).model, 'gpt-5.6-luna');
  let count = 0;
  const unavailable = inference(async () => { count++; return models([{ slug: 'unknown-text', visibility: 'list', input_modalities: ['text'] }]); });
  await assert.rejects(unavailable.inferStructuredAndroidStep(request(), TOKEN), assertCode('model_unavailable'));
  assert.equal(count, 1);
});

test('rejects invalid SIWC model catalogs instead of treating normal API data as the account catalog', async () => {
  for (const catalog of [{ data: [{ id: 'gpt-6-luna' }] }, { models: 'invalid' }, {}]) {
    let calls = 0;
    const { inferStructuredAndroidStep } = inference(async () => { calls++; return Response.json(catalog); });
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('invalid_model_catalog'));
    assert.equal(calls, 1);
  }
});

test('maps SDK authentication and rate-limit errors with status, code, parameter, and request ID without retries', async () => {
  for (const [status, code] of [[401, 'subscription_sharing_invalid_user'], [429, 'subscription_sharing_usage_limit_exceeded']]) {
    let calls = 0;
    const { inferStructuredAndroidStep, ChatGPTRequestError } = inference(async url => {
      calls++;
      return String(url).endsWith('/models') ? models() : Response.json({ error: {
        message: 'The plan request cannot proceed.', type: 'request_error', code, param: 'authorization',
      } }, { status, headers: { 'x-request-id': `req-${status}` } });
    });
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), error => {
      assert.ok(error instanceof ChatGPTRequestError);
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.equal(error.param, 'authorization');
      assert.equal(error.requestId, `req-${status}`);
      assert.equal(error.message, 'The plan request cannot proceed.');
      assert.equal(error.responseBody, undefined);
      return true;
    });
    assert.equal(calls, 2);
  }
});

test('maps SDK errors during model discovery and preserves a nonstandard admission detail', async () => {
  for (const [body, expected] of [
    [{ error: { message: 'Expired login.', code: 'subscription_sharing_invalid_user', param: 'token' } }, { message: 'Expired login.', code: 'subscription_sharing_invalid_user', param: 'token' }],
    [{ detail: 'Plan usage is disabled.' }, { message: 'Plan usage is disabled.', code: undefined, param: undefined }],
  ]) {
    let calls = 0;
    const { inferStructuredAndroidStep } = inference(async () => {
      calls++;
      return Response.json(body, { status: 403, headers: { 'x-request-id': 'req-catalog' } });
    });
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), error => {
      assert.equal(error.status, 403);
      assert.equal(error.requestId, 'req-catalog');
      assert.equal(error.message, expected.message);
      assert.equal(error.code, expected.code);
      assert.equal(error.param, expected.param);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test('requires global response completion after finalized function items, including sparse terminal output', async () => {
  const { inferStructuredAndroidStep } = withStream(callEvents() + completed());
  assert.equal((await inferStructuredAndroidStep(request(), TOKEN)).step.action.type, 'tap');
  const truncated = withStream(callEvents() + 'data: [DONE]\n\n');
  await assert.rejects(truncated.inferStructuredAndroidStep(request(), TOKEN), assertCode('interrupted_response'));
});

test('a matching complete terminal function is accepted and repeated identical finalized items are deduplicated', async () => {
  const item = functionItem();
  const { inferStructuredAndroidStep } = withStream(callEvents() +
    event('response.output_item.done', { output_index: 0, item }) + completed({ output: [item] }));
  assert.deepEqual(plain((await inferStructuredAndroidStep(request(), TOKEN)).step), androidStep());
});

test('ignores human text when one declared finalized function supplies the action', async () => {
  const sse = event('response.output_text.done', { item_id: 'msg-offline', output_index: 0, content_index: 0, text: JSON.stringify(androidStep({ assessment: 'failed' })) })
    + event('response.output_item.done', { output_index: 0, item: { type: 'message', id: 'msg-offline', status: 'completed', content: [{ type: 'output_text', text: 'Human commentary.' }] } })
    + callEvents(JSON.stringify(androidStep()), {}, 1) + completed();
  const { inferStructuredAndroidStep } = withStream(sse);
  assert.equal((await inferStructuredAndroidStep(request(), TOKEN)).step.assessment, 'continue');
});

test('text deltas and finalized text messages cannot become native actions', async () => {
  const serialized = JSON.stringify(androidStep());
  for (const sse of [
    event('response.output_text.delta', { delta: serialized }),
    event('response.output_text.done', { item_id: 'msg-offline', output_index: 0, content_index: 0, text: serialized }),
    event('response.content_part.done', { output_index: 0, content_index: 0, part: { type: 'output_text', text: serialized } }),
    event('response.output_item.done', { output_index: 0, item: { type: 'message', status: 'completed', content: [{ type: 'output_text', text: serialized }] } }),
  ]) {
    const { inferStructuredAndroidStep } = withStream(sse + completed());
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('missing_tool_call'));
  }
});

test('argument deltas and arguments-done events cannot replace a finalized function output item', async () => {
  const item = functionItem('', { status: 'in_progress' });
  for (const part of [
    event('response.function_call_arguments.delta', { output_index: 0, item_id: item.id, delta: JSON.stringify(androidStep()) }),
    event('response.function_call_arguments.done', { output_index: 0, item_id: item.id, arguments: JSON.stringify(androidStep()) }),
  ]) {
    const { inferStructuredAndroidStep } = withStream(event('response.output_item.added', { output_index: 0, item }) + part + completed());
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('incomplete_tool_call'));
  }
});

test('rejects undeclared native function names and namespaces', async () => {
  for (const values of [{ name: 'other_action' }, { namespace: 'other_namespace' }, { namespace: undefined }]) {
    const { inferStructuredAndroidStep } = withStream(callEvents(JSON.stringify(androidStep()), values) + completed());
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('undeclared_tool_call'));
  }
});

test('rejects incomplete function identity and arguments before schema decoding', async () => {
  for (const values of [{ call_id: '' }, { call_id: undefined }, { arguments: '' }, { arguments: undefined }, { status: 'in_progress' }]) {
    const item = functionItem(JSON.stringify(androidStep()), values);
    const { inferStructuredAndroidStep } = withStream(event('response.output_item.done', { output_index: 0, item }) + completed());
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('incomplete_tool_call'));
  }
  const { inferStructuredAndroidStep } = withStream(event('response.output_item.done', { output_index: 0, item: functionItem(undefined, { id: '' }) }) + completed());
  await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('invalid_response_stream'));
});

test('rejects multiple completed calls and an additional partial call', async () => {
  const other = functionItem('', { id: 'fc-other', call_id: 'call-other', status: 'in_progress' });
  for (const suffix of [
    callEvents(JSON.stringify(androidStep()), { id: other.id, call_id: other.call_id }, 1),
    event('response.output_item.added', { output_index: 1, item: other }),
  ]) {
    const { inferStructuredAndroidStep } = withStream(callEvents() + suffix + completed());
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('multiple_tool_calls'));
  }
});

test('rejects function identity changes and conflicting finalized or terminal arguments', async () => {
  const original = functionItem();
  for (const sse of [
    event('response.output_item.added', { output_index: 0, item: { ...original, status: 'in_progress', arguments: '' } })
      + event('response.output_item.done', { output_index: 0, item: { ...original, call_id: 'changed-call' } }) + completed(),
    callEvents() + event('response.output_item.done', { output_index: 0, item: { ...original, arguments: JSON.stringify(androidStep({ reason: 'Changed.' })) } }) + completed(),
    callEvents() + completed({ output: [{ ...original, arguments: JSON.stringify(androidStep({ reason: 'Changed.' })) }] }),
    callEvents() + completed({ output: [{ ...original, id: 'different-final-id' }] }),
  ]) {
    const { inferStructuredAndroidStep } = withStream(sse);
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('invalid_response_stream'));
  }
});

test('terminal calls must retain a valid ID and the identity announced before completion', async () => {
  const announced = functionItem('', { status: 'in_progress' });
  for (const terminal of [
    functionItem(undefined, { id: 'fc-substituted', call_id: 'call-substituted' }),
    functionItem(undefined, { call_id: 'call-substituted' }),
    functionItem(undefined, { id: undefined }),
  ]) {
    const { inferStructuredAndroidStep } = withStream(event('response.output_item.added', { output_index: 0, item: announced })
      + completed({ output: [terminal] }));
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('invalid_response_stream'));
  }
});

test('refusal events and refusal message parts invalidate otherwise complete functions', async () => {
  for (const refusal of [
    event('response.refusal.delta', { delta: 'Unable to comply.' }),
    event('response.refusal.done', { refusal: 'Unable to comply.' }),
    event('response.content_part.done', { output_index: 1, content_index: 0, part: { type: 'refusal', refusal: 'Unable to comply.' } }),
    event('response.output_item.done', { output_index: 1, item: { type: 'message', status: 'completed', content: [{ type: 'refusal', refusal: 'Unable to comply.' }] } }),
  ]) {
    const { inferStructuredAndroidStep } = withStream(callEvents() + refusal + completed());
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('model_refusal'));
  }
  const terminalRefusal = withStream(callEvents() + completed({ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Unable to comply.' }] }] }));
  await assert.rejects(terminalRefusal.inferStructuredAndroidStep(request(), TOKEN), assertCode('model_refusal'));
});

test('incomplete and failed responses remain unverified after a finalized call', async () => {
  for (const [suffix, code] of [
    [event('response.incomplete', { response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } }), 'response_incomplete'],
    [event('response.failed', { response: { status: 'failed', error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'Usage limit reached.' } } }), 'subscription_sharing_usage_limit_exceeded'],
    [completed({ status: 'in_progress' }), 'response_incomplete'],
  ]) {
    const { inferStructuredAndroidStep } = withStream(callEvents() + suffix);
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode(code));
  }
});

test('response.failed retains safe transport metadata for authentication recovery', async () => {
  const { inferStructuredAndroidStep } = withStream(callEvents() + event('response.failed', { response: {
    status: 'failed', error: { code: 'subscription_sharing_invalid_user', message: 'Sign-in expired.', param: 'authorization' },
  } }));
  await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), error => {
    assert.equal(error.code, 'subscription_sharing_invalid_user');
    assert.equal(error.param, 'authorization');
    assert.equal(error.requestId, 'req-offline');
    assert.equal(error.diagnostics.requestId, 'req-offline');
    assert.equal(error.diagnostics.contentType, 'text/event-stream');
    return true;
  });
});

test('SDK parsing failures have fixed safe errors without malformed payload content', async () => {
  const sensitive = 'PRIVATE_SCREEN_CONTENT';
  const { inferStructuredAndroidStep } = withStream(`data: {"private":"${sensitive}",broken}\n\n`);
  await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), error => {
    assert.equal(error.code, 'invalid_response_stream');
    assert.equal(error.message.includes(sensitive), false);
    assert.equal(JSON.stringify(error).includes(sensitive), false);
    return true;
  });
});

test('unrelated headerless content and an HTTP JSON body cannot substitute for SDK stream completion', async () => {
  for (const body of ['Unrelated response text', JSON.stringify({ status: 'completed', output: [functionItem()] })]) {
    const { inferStructuredAndroidStep } = inference(async url => String(url).endsWith('/models') ? models() : new Response(new TextEncoder().encode(body)));
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('interrupted_response'));
  }
});

test('malformed arguments, fences, null, missing fields, and extra fields fail without repair requests', async () => {
  const missing = androidStep(); delete missing.reason;
  for (const argumentsText of [
    '{broken JSON}', '```json\n' + JSON.stringify(androidStep()) + '\n```', 'null',
    JSON.stringify(missing), JSON.stringify({ ...androidStep(), explanation: 'extra' }),
  ]) {
    let calls = 0;
    const { inferStructuredAndroidStep } = inference(async url => {
      calls++;
      return String(url).endsWith('/models') ? models() : streamResponse(callEvents(argumentsText) + completed());
    });
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('invalid_structured_step'));
    assert.equal(calls, 2);
  }
});

test('schema failures expose only fixed validation fields and content-free diagnostics', async () => {
  const sensitive = 'PRIVATE_SCREEN_CONTENT';
  const base = androidStep();
  for (const [argumentsText, validation] of [
    ['Malformed ' + sensitive, { field: 'function_call.arguments', reason: 'invalid_json' }],
    [JSON.stringify({ ...base, observation: 1, reason: sensitive }), { field: 'observation', reason: 'invalid_type' }],
    [JSON.stringify({ ...base, reason: sensitive, assessment: 'passed' }), { field: 'assessment', reason: 'action_assessment_mismatch' }],
    [JSON.stringify({ ...base, reason: sensitive, action: { ...base.action, x: null } }), { field: 'action.x', reason: 'required_for_action' }],
    [JSON.stringify({ ...base, reason: sensitive, action: { ...base.action, text: sensitive } }), { field: 'action.text', reason: 'must_be_null' }],
    [JSON.stringify({ ...base, [sensitive]: 'extra' }), { field: 'step', reason: 'unexpected_field' }],
  ]) {
    const { inferStructuredAndroidStep } = withStream(callEvents(argumentsText) + completed());
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), error => {
      assert.deepEqual(plain(error.validation), validation);
      assert.equal(error.message.includes(sensitive), false);
      assert.equal(JSON.stringify(error).includes(sensitive), false);
      if (error.payloadDiagnostics) {
        assert.equal(error.payloadDiagnostics.characterCount, argumentsText.length);
        assert.equal(error.payloadDiagnostics.startsFence, false);
        assert.equal(error.payloadDiagnostics.firstCharacter, 'M');
      }
      return true;
    });
  }
});

test('runtime validation rejects inconsistent required or unused action fields and unknown enums', async () => {
  const base = androidStep();
  for (const step of [
    androidStep({ assessment: 'passed' }), androidStep({ assessment: 'failed' }), androidStep({ assessment: 'unknown' }),
    androidStep({ action: { type: 'finish', ...emptyAction() } }),
    androidStep({ action: { ...base.action, x: null } }),
    androidStep({ action: { ...base.action, type: 'back' } }),
    androidStep({ action: { ...base.action, type: 'swipe' } }),
    androidStep({ action: { ...base.action, durationMs: 100 } }),
    androidStep({ action: { ...base.action, type: 'launch' } }),
    androidStep({ action: { ...base.action, x: '20' } }),
  ]) {
    const { inferStructuredAndroidStep } = withStream(callEvents(JSON.stringify(step)) + completed());
    await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('invalid_structured_step'));
  }
});

test('allows finish with passed, failed, or unverified and rejects executable actions with unverified', async () => {
  for (const assessment of ['passed', 'failed', 'unverified']) {
    const step = androidStep({ assessment, action: { type: 'finish', ...emptyAction() } });
    const { inferStructuredAndroidStep } = withStream(callEvents(JSON.stringify(step)) + completed());
    assert.deepEqual(plain((await inferStructuredAndroidStep(request(), TOKEN)).step), step);
  }
  const { inferStructuredAndroidStep } = withStream(callEvents(JSON.stringify(androidStep({ assessment: 'unverified' }))) + completed());
  await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), error => {
    assert.equal(error.code, 'invalid_structured_step');
    assert.deepEqual(plain(error.validation), { field: 'assessment', reason: 'action_assessment_mismatch' });
    return true;
  });
});

test('accepts every executable action with only its required parameters', async () => {
  for (const action of [
    { type: 'tap', ...emptyAction(), x: 10, y: 40 },
    { type: 'swipe', ...emptyAction(), x: 10, y: 40, endX: 10, endY: 5, durationMs: 300 },
    { type: 'text', ...emptyAction(), text: 'native input' },
    { type: 'wait', ...emptyAction(), durationMs: 200 },
    { type: 'back', ...emptyAction() }, { type: 'enter', ...emptyAction() },
  ]) {
    const { inferStructuredAndroidStep } = withStream(callEvents(JSON.stringify(androidStep({ action }))) + completed());
    assert.deepEqual(plain((await inferStructuredAndroidStep(request(), TOKEN)).step.action), action);
  }
});

test('accepts PNG data URLs and rejects external or mismatched images before any HTTP request', async () => {
  let calls = 0;
  const { inferStructuredAndroidStep } = inference(async url => {
    calls++;
    return String(url).endsWith('/models') ? models() : streamResponse(callEvents() + completed());
  });
  await inferStructuredAndroidStep(request({ images: [`data:image/png;base64,${PNG}`] }), TOKEN);
  assert.equal(calls, 2);
  for (const image of ['', null, 'https://example.com/screenshot.png', 'data:image/svg+xml;base64,AAAA', 'data:image/jpeg;base64,' + PNG, 'not base64', 'AAAA']) {
    await assert.rejects(inferStructuredAndroidStep(request({ images: [image] }), TOKEN), assertCode('invalid_image'));
  }
  assert.equal(calls, 2);
});

test('validates the credential, prompt, and screenshot count before HTTP requests', async () => {
  let calls = 0;
  const { inferStructuredAndroidStep } = inference(async () => { calls++; return models(); });
  for (const token of ['', 'bad token']) await assert.rejects(inferStructuredAndroidStep(request(), token), assertCode('not_signed_in'));
  for (const prompt of ['', '   ', null]) await assert.rejects(inferStructuredAndroidStep(request({ prompt }), TOKEN), assertCode('invalid_prompt'));
  await assert.rejects(inferStructuredAndroidStep(request({ images: Array(9).fill(PNG) }), TOKEN), assertCode('input_too_large'));
  assert.equal(calls, 0);
});

test('an already aborted request never performs model discovery', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const { inferStructuredAndroidStep } = inference(async () => { calls++; return models(); });
  await assert.rejects(inferStructuredAndroidStep(request({ signal: controller.signal }), TOKEN), assertCode('request_cancelled'));
  assert.equal(calls, 0);
});

test('cancellation interrupts pending SDK model discovery', async () => {
  const controller = new AbortController();
  let ready;
  const started = new Promise(resolve => { ready = resolve; });
  const { inferStructuredAndroidStep } = inference(async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    ready();
  }));
  const pending = inferStructuredAndroidStep(request({ signal: controller.signal }), TOKEN);
  await started;
  controller.abort();
  await assert.rejects(pending, assertCode('request_cancelled'));
});

test('cancellation interrupts the SDK response iterator after a partial native call', async () => {
  const controller = new AbortController();
  let ready;
  const started = new Promise(resolve => { ready = resolve; });
  const { inferStructuredAndroidStep } = inference(async (url, options) => {
    if (String(url).endsWith('/models')) return models();
    return new Response(new ReadableStream({ start(stream) {
      stream.enqueue(new TextEncoder().encode(event('response.output_item.added', { output_index: 0, item: functionItem('', { status: 'in_progress' }) })));
      options.signal.addEventListener('abort', () => stream.error(options.signal.reason), { once: true });
      ready();
    } }), { headers: { 'content-type': 'text/event-stream' } });
  });
  const pending = inferStructuredAndroidStep(request({ signal: controller.signal }), TOKEN);
  await started;
  controller.abort();
  await assert.rejects(pending, assertCode('request_cancelled'));
});

test('cancellation during SDK iterator cleanup cannot return a completed native action', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const { inferStructuredAndroidStep } = inference(async url => {
    if (String(url).endsWith('/models')) return models();
    return new Response(new ReadableStream({
      start(stream) { stream.enqueue(new TextEncoder().encode(callEvents() + completed())); },
      cancel() { cancelled = true; controller.abort(); },
    }), { headers: { 'content-type': 'text/event-stream' } });
  });
  await assert.rejects(inferStructuredAndroidStep(request({ signal: controller.signal }), TOKEN), assertCode('request_cancelled'));
  assert.equal(cancelled, true);
});

test('cancellation from the diagnostics callback cannot return a native action', async () => {
  const controller = new AbortController();
  const { inferStructuredAndroidStep } = withStream(callEvents() + completed());
  await assert.rejects(inferStructuredAndroidStep(request({ signal: controller.signal,
    onResponseDiagnostics() { controller.abort(); },
  }), TOKEN), assertCode('request_cancelled'));
});

test('caps transport bytes even when the SDK discards SSE comments', async () => {
  const chunk = new TextEncoder().encode(':' + 'x'.repeat(1024 * 1024 - 3) + '\n\n');
  const { inferStructuredAndroidStep } = inference(async url => {
    if (String(url).endsWith('/models')) return models();
    let chunks = 0;
    return new Response(new ReadableStream({ pull(stream) {
      if (chunks++ < 33) stream.enqueue(chunk);
      else stream.close();
    } }), { headers: { 'content-type': 'text/event-stream' } });
  });
  await assert.rejects(inferStructuredAndroidStep(request(), TOKEN), assertCode('response_too_large'));
});
