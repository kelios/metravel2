/* global require */
const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const guard = require('./browser-guard.cjs');

function request(method, url, navigation = false, subframe = false) {
  return {method: () => method, url: () => url, isNavigationRequest: () => navigation,
    frame: () => ({parentFrame: () => subframe ? {} : null})};
}

test('HTTP writes are blocked even for the trusted origin and subframes', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(guard.shouldBlock(request(method, 'https://metravel.by/api/trips/', false, true)), true);
  }
});

test('own page GET is allowed; external main navigation is blocked; ordinary assets remain usable', () => {
  assert.equal(guard.shouldBlock(request('GET', 'https://metravel.by/quests', true)), false);
  assert.equal(guard.shouldBlock(request('HEAD', 'https://www.metravel.by/app', true)), false);
  assert.equal(guard.shouldBlock(request('GET', 'https://elsewhere.example/collect', true)), true);
  assert.equal(guard.shouldBlock(request('GET', 'https://fonts.gstatic.com/font.woff2')), false);
  assert.equal(guard.shouldBlock(request('GET', 'https://www.youtube.com/embed/example', true, true)), false);
  assert.equal(guard.shouldBlock(request('GET', 'file:///etc/passwd', true)), true);
});

test('journal omits credentials, query and fragment values', () => {
  const url = 'https://name:pass@metravel.by/reset?token=do-not-log#secret';
  assert.equal(guard.safeUrl(url), 'https://metravel.by/reset');
  const message = guard.safeMessage(`failure ${url} authorization=BearerValue password=hide`);
  for (const value of ['name:pass', 'do-not-log', '#secret', 'BearerValue', 'password=hide']) {
    assert.equal(message.includes(value), false);
  }
  assert.equal(message, '[credential-bearing console message redacted]');
});

test('credential-bearing headers, cookie lists and quoted JSON redact the whole console message', () => {
  for (const message of ['Authorization: Bearer fixture-value',
    'Cookie:sessionid=fixture-x;csrftoken=fixture-y', '{"token":"fixture-z"}']) {
    assert.equal(guard.safeMessage(message), '[credential-bearing console message redacted]');
  }
});

test('normal public diagnostics retain useful text and redact URL query/fragment only', () => {
  assert.equal(guard.safeMessage('Cookie banner is still visible'), 'Cookie banner is still visible');
  assert.equal(guard.safeMessage('Fetch failed https://metravel.by/api/search/?q=Bled#details 404'),
    'Fetch failed https://metravel.by/api/search/ 404');
});

test('installed route aborts writes and records policy separately from response/console', async () => {
  const context = new EventEmitter();
  let handler;
  let registrations = 0;
  context.route = async (_pattern, callback) => {handler = callback; registrations++;};
  const page = new EventEmitter();
  page.context = () => context;
  const rows = [];
  await guard.installGuard(page, entry => rows.push(entry));
  await guard.installGuard(page, entry => rows.push(entry));
  assert.equal(registrations, 1);
  const actions = [];
  await handler({request: () => request('POST', 'https://metravel.by/api/review/?token=hide'),
    abort: async reason => actions.push(['abort', reason]), continue: async () => actions.push(['continue'])});
  await handler({request: () => request('GET', 'https://metravel.by/quests'),
    abort: async reason => actions.push(['abort', reason]), continue: async () => actions.push(['continue'])});
  assert.deepEqual(actions, [['abort', 'blockedbyclient'], ['continue']]);
  assert.deepEqual(rows[0], {event: 'blocked-by-qa-policy', method: 'POST', url: 'https://metravel.by/api/review/'});
  context.emit('response', {request: () => request('GET', 'https://metravel.by/api/quests/?search=abc'), status: () => 200});
  page.emit('console', {type: () => 'warning', text: () => 'password=hide'});
  assert.equal(rows[1].event, 'response');
  assert.equal(rows[2].event, 'console');
  assert.equal(rows[2].message, '[credential-bearing console message redacted]');
});

test('failed route installation is retried rather than remembered as a protected context', async () => {
  const context = new EventEmitter();
  let calls = 0;
  context.route = async () => {if (++calls === 1) throw new Error('closed setup');};
  const page = new EventEmitter();
  page.context = () => context;
  await assert.rejects(guard.installGuard(page, () => {}), /closed setup/);
  await guard.installGuard(page, () => {});
  assert.equal(calls, 2);
});

test('top navigation fulfills own 200 but blocks every 3xx without following a redirect', async () => {
  const context = new EventEmitter();
  let handler;
  context.route = async (_pattern, callback) => {handler = callback;};
  const page = new EventEmitter();
  page.context = () => context;
  const rows = [];
  await guard.installGuard(page, entry => rows.push(entry));
  for (const status of [200, 301, 302, 307, 308]) {
    const response = {status: () => status};
    const actions = [];
    await handler({
      request: () => request('GET', 'https://metravel.by/quests', true),
      fetch: async options => {assert.deepEqual(options, {maxRedirects: 0}); return response;},
      fulfill: async options => {assert.equal(options.response, response); actions.push('fulfilled');},
      abort: async reason => actions.push(reason),
      continue: async () => assert.fail('top navigation must not follow an unchecked redirect'),
    });
    assert.deepEqual(actions, [status === 200 ? 'fulfilled' : 'blockedbyclient']);
  }
  assert.equal(rows.length, 4);
  assert.ok(rows.every(row => row.reason === 'navigation-3xx'));
});
