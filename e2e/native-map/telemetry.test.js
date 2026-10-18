'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { WebSocketServer } = require('ws');
const { createServer } = require('node:http');
const { Acceptance, observerScript } = require('./telemetry');
const { validateSource, validateFixture, assertAndroidForward, assertSimulatorPid, connectCdp, selectAndroidMap } = require('./run');

const keys = Array.from({ length: 869 }, (_, index) => `record:${String(index).padStart(4, '0')}`);
const ids = keys.map((_, index) => index + 1);
let sequence = 0;
const snapshot = (zoom = 8, changes = {}) => ({
  at: 0, sequence: ++sequence,
  mapId: 1000, zoom, markerZoomAnimation: true, keys, desired: keys,
  markerIds: ids, layerIds: ids, scheduled: false, queued: 0, animating: false,
  tiles: { pending: 0 }, tilesLoading: false, frames: 10, maxFrameMs: 19, ...changes,
});
const createAcceptance = () => {
  const acceptance = new Acceptance({ expectedKeys: keys });
  acceptance.started = 0; acceptance.stageStarted = 0;
  return acceptance;
};
const consume = (acceptance, sample, at) => acceptance.consume({ ...sample, at }, at);
function baseline() {
  const acceptance = createAcceptance();
  consume(acceptance, snapshot(), 0);
  consume(acceptance, snapshot(), 600);
  return acceptance;
}

test('requires entry-independent baseline and two zoom-ins plus one zoom-out, all settled', () => {
  const acceptance = baseline();
  assert.equal(acceptance.stage, 1);
  for (const [index, zoom] of [9, 10, 9].entries()) {
    const start = 1000 + index * 1000;
    assert.equal(consume(acceptance, snapshot(zoom, { animating: true }), start - 100), false);
    assert.equal(consume(acceptance, snapshot(zoom), start), false);
    assert.equal(consume(acceptance, snapshot(zoom), start + 600), index === 2);
  }
  assert.deepEqual(acceptance.checkpoints.map(checkpoint => checkpoint.zoom), [8, 9, 10, 9]);
  assert.ok(acceptance.checkpoints.every(checkpoint => checkpoint.count === 869));
});

for (const [name, changes] of [
  ['lost marker', { keys: keys.slice(1) }],
  ['duplicated marker object', { markerIds: [...ids.slice(0, -1), 1] }],
  ['orphan duplicate layer', { layerIds: [...ids, 9000] }],
  ['changed desired keys', { desired: [...keys.slice(0, -1), 'other'] }],
  ['marker replacement', { markerIds: [...ids.slice(0, -1), 9000], layerIds: [...ids.slice(0, -1), 9000] }],
  ['map reload', { mapId: 2000 }],
]) {
  test(`fails ${name} after baseline, even while zoom is animating`, () => {
    assert.throws(() => consume(baseline(), snapshot(9, { ...changes, animating: true }), 1000), /loss, duplication, replacement or map reload/);
  });
}

test('missing fixture or nonempty render queue never establishes baseline', () => {
  for (const changes of [{ keys: [] }, { queued: 1 }, { scheduled: true }, { tiles: { pending: 1 } }, { tilesLoading: true }, { frames: 0 }]) {
    const acceptance = createAcceptance();
    consume(acceptance, snapshot(8, changes), 0);
    consume(acceptance, snapshot(8, changes), 1000);
    assert.equal(acceptance.stage, 0);
  }
});

test('wrong zoom sequence and disabled marker animation fail closed', () => {
  assert.throws(() => consume(baseline(), snapshot(11), 1000), /Unexpected zoom/);
  assert.throws(() => consume(createAcceptance(), snapshot(8, { markerZoomAnimation: false }), 0), /must remain enabled/);
});

test('an unchanged zoom or missing telemetry times out rather than passing', () => {
  const acceptance = baseline();
  consume(acceptance, snapshot(8), 1000);
  assert.equal(acceptance.stage, 1);
  assert.throws(() => acceptance.assertWithinBudget(20601), /stage 1/);
});

test('malformed snapshots cannot satisfy assertions', () => {
  assert.throws(() => consume(baseline(), { zoom: 9 }, 1000), /Malformed map telemetry/);
});

test('a late final sample cannot bypass the stage budget', () => {
  const acceptance = baseline();
  consume(acceptance, snapshot(9), 20000);
  assert.throws(() => consume(acceptance, snapshot(9), 20601), /within 20000ms/);
});

test('same-count wrong fixture cannot establish baseline', () => {
  const acceptance = createAcceptance();
  const otherKeys = keys.map(key => `other:${key}`);
  for (const at of [0, 600, 1200]) consume(acceptance, snapshot(8, { keys: otherKeys, desired: otherKeys }), at);
  assert.equal(acceptance.stage, 0);
  assert.throws(() => new Acceptance(), /independent fixture keys/);
  assert.throws(() => new Acceptance({ expectedKeys: [...keys.slice(1), keys[1]] }), /independent fixture keys/);
});

test('the full current 2655-point API fixture passes every settled zoom stage', () => {
  const currentKeys = Array.from({ length: 2655 }, (_, index) => `record:${String(index).padStart(4, '0')}`);
  const currentIds = currentKeys.map((_, index) => index + 1);
  const acceptance = new Acceptance({ expectedKeys: currentKeys });
  acceptance.started = 0; acceptance.stageStarted = 0;
  const currentSnapshot = zoom => snapshot(zoom, {
    keys: currentKeys, desired: currentKeys, markerIds: currentIds, layerIds: currentIds,
  });
  for (const [index, zoom] of [8, 9, 10, 9].entries()) {
    const at = index * 1000;
    assert.equal(consume(acceptance, currentSnapshot(zoom), at), false);
    assert.equal(consume(acceptance, currentSnapshot(zoom), at + 600), index === 3);
  }
  assert.deepEqual(acceptance.checkpoints.map(checkpoint => checkpoint.count), [2655, 2655, 2655, 2655]);
});

test('a current fixture of the same size with different keys cannot pass baseline', () => {
  const currentKeys = Array.from({ length: 2655 }, (_, index) => `record:${index}`);
  const wrongKeys = currentKeys.map(key => `wrong:${key}`).sort();
  const currentIds = currentKeys.map((_, index) => index + 1);
  const acceptance = new Acceptance({ expectedKeys: currentKeys });
  acceptance.started = 0; acceptance.stageStarted = 0;
  for (const at of [0, 600, 1200]) consume(acceptance, snapshot(8, {
    keys: wrongKeys, desired: wrongKeys, markerIds: currentIds, layerIds: currentIds,
  }), at);
  assert.equal(acceptance.stage, 0);
  assert.throws(() => acceptance.assertWithinBudget(20001), /stage 0/);
});

test('empty, duplicate and malformed independent keys fail before runtime', () => {
  for (const expectedKeys of [[], Array(1), ['', 'valid'], [' ', 'valid'], [null], [123], ['duplicate', 'duplicate']]) {
    assert.throws(() => new Acceptance({ expectedKeys }), /independent fixture keys/);
  }
});

test('baseline requires the same map and marker objects throughout settle window', () => {
  const acceptance = createAcceptance();
  consume(acceptance, snapshot(), 0);
  const changedIds = ids.map(id => id + 1000);
  consume(acceptance, snapshot(8, { markerIds: changedIds, layerIds: changedIds }), 600);
  assert.equal(acceptance.stage, 0);
  consume(acceptance, snapshot(8, { markerIds: changedIds, layerIds: changedIds }), 1200);
  assert.equal(acceptance.stage, 1);
});

test('duplicate, stale and reordered snapshots fail even when their state is correct', () => {
  for (const changes of [{ at: 600 }, { sequence: 1 }, { frames: 9 }, { at: -5000 }, { at: 9000 }]) {
    const acceptance = baseline();
    assert.throws(() => acceptance.consume(snapshot(9, { at: 1000, ...changes }), 1000), /Stale, duplicate or reordered/);
  }
});

test('negative counters and a truthy nonboolean animation flag do not satisfy acceptance', () => {
  for (const changes of [{ queued: -1 }, { tiles: { pending: -1 } }, { markerZoomAnimation: 'true' }]) {
    assert.throws(() => consume(createAcceptance(), snapshot(8, changes), 0), /Malformed|must remain enabled/);
  }
});

test('fixture origin, account, timestamp and keys are independently constrained', () => {
  const fixture = { accountId: 104, apiOrigin: 'https://metravel.by', capturedAt: new Date(0).toISOString(), keys };
  assert.deepEqual(validateFixture(fixture, fixture.apiOrigin, 600), keys);
  for (const changes of [{ accountId: 1 }, { apiOrigin: 'http://other' }, { capturedAt: 'invalid' },
    { capturedAt: new Date(2000).toISOString() }, { keys: [] }, { keys: [...keys, keys[0]] }]) {
    assert.throws(() => validateFixture({ ...fixture, ...changes }, fixture.apiOrigin, 600));
  }
  assert.throws(() => validateFixture(fixture, fixture.apiOrigin, 86400001), /24h/);
  assert.deepEqual(validateFixture({ ...fixture, keys: keys.slice(1) }, fixture.apiOrigin, 600), keys.slice(1));
});

test('target binding refuses a CDP forward or LLDB PID from another device/application', () => {
  const forward = 'selected tcp:9222 localabstract:webview_devtools_remote_123';
  assert.doesNotThrow(() => assertAndroidForward(forward, 'selected', '9222', '123'));
  for (const [device, port, pid] of [['other', '9222', '123'], ['selected', '9223', '123'], ['selected', '9222', '999']]) {
    assert.throws(() => assertAndroidForward(forward, device, port, pid), /selected device/);
  }
  assert.throws(() => assertAndroidForward(forward + '\n' + forward, 'selected', '9222', '123'));
  const processTable = 'PID Status Label\n123 0 UIKitApplication:by.metravel.app[abcd]';
  assert.doesNotThrow(() => assertSimulatorPid(processTable, '123'));
  assert.throws(() => assertSimulatorPid(processTable, '456'), /selected simulator/);
  assert.throws(() => assertSimulatorPid('123 0 UIKitApplication:by.metravel.other[abcd]', '123'));
});

test('observer reads actual layer identities without sending map commands', () => {
  const timers = [];
  class Marker { constructor(id) { this._leaflet_id = id; } }
  const marker = new Marker(123);
  const context = {
    map: { _containerId: 1, options: { markerZoomAnimation: true }, getZoom: () => 8 },
    __metravelMarkerEntries: { example: { marker } }, __metravelMarkerDesired: { example: {} },
    __metravelMarkerQueue: [], __metravelMarkerFrameScheduled: false,
    markersLayer: { getLayers: () => [marker] }, L: { Marker }, performance: { now: () => 0 },
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    setInterval: callback => { timers.push(callback); return 1; }, clearInterval: () => {}, setTimeout: () => {}, clearTimeout: () => {},
    window: { __metravelGetTileStats: () => ({ pending: 0 }), __metravelBaseTileLayer: { isLoading: () => false } },
  };
  assert.equal(vm.runInNewContext(observerScript('fixture', 90), context), true);
  const sample = JSON.parse(JSON.stringify(context.window.__metravelQaMapObserver.snapshot()));
  assert.deepEqual(sample.keys, ['example']);
  assert.deepEqual(sample.markerIds, [123]);
  assert.deepEqual(sample.layerIds, [123]);
  context.window.__metravelQaMapObserver.stop();
  assert.equal(context.window.__metravelQaMapObserver, undefined);
});

test('standalone entry flow and all sidecar sources are fingerprinted', () => {
  assert.match(validateSource(), /^[a-f0-9]{64}$/);
});

test('CDP transport rejects JavaScript exceptions and outstanding requests on disconnect', async () => {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(server, 'listening');
  let cdp;
  try {
    server.on('connection', socket => socket.on('message', bytes => {
      const request = JSON.parse(bytes);
      socket.send('null'); // An unsolicited malformed frame must not crash cleanup.
      if (request.params.expression === 'disconnect') socket.close();
      else socket.send(JSON.stringify({ id: request.id, result: { exceptionDetails: { text: 'synthetic unit exception' } } }));
    }));
    cdp = await connectCdp(`ws://127.0.0.1:${server.address().port}`);
    await assert.rejects(cdp.evaluate('exception'), /inaccessible/);
    await assert.rejects(cdp.evaluate('disconnect'), /disconnected/);
  } finally {
    cdp?.close();
    await new Promise(resolve => server.close(resolve));
  }
  await assert.rejects(connectCdp('ws://example.com/map'), /explicitly forwarded local/);
});

test('CDP discovery rejects ambiguous maps and closes every discovered connection', async () => {
  const server = createServer((_request, response) => response.end(JSON.stringify(
    ['one', 'two'].map(id => ({ type: 'page', webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/${id}` })),
  )));
  const sockets = new WebSocketServer({ server });
  sockets.on('connection', socket => socket.on('message', bytes => {
    const request = JSON.parse(bytes);
    socket.send(JSON.stringify({ id: request.id, result: { result: { value: true } } }));
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await assert.rejects(selectAndroidMap(`http://127.0.0.1:${server.address().port}`), /Exactly one/);
  } finally {
    await new Promise(resolve => sockets.close(resolve));
    await new Promise(resolve => server.close(resolve));
  }
});

test('LLDB setup, stop and detach failures retain negative receipts with a fake debugger', () => {
  const temporary = fs.mkdtempSync(path.resolve(__dirname, '../../.codex-temp/native-map-unit-'));
  try {
    execFileSync('python3', ['-c', `
import json, pathlib, runpy, sys, types
root = pathlib.Path(sys.argv[1])
for mode in ['wrong-abi', 'missing-breakpoint', 'stop-failure', 'detach-failure', 'success']:
    directory = root / mode
    directory.mkdir()
    class Error:
        def __init__(self, fail=False): self.fail = fail
        def Fail(self): return self.fail
        def Success(self): return not self.fail
    class Process:
        detached = False
        def GetBroadcaster(self): return None
        def Continue(self): return Error()
        def GetState(self): return 1
        def Stop(self): return Error(mode == 'stop-failure')
        def Detach(self): self.detached = True; return Error(mode == 'detach-failure')
    class Breakpoint:
        def GetNumLocations(self): return 0 if mode == 'missing-breakpoint' else 1
        def SetScriptCallbackFunction(self, name): pass
        def GetID(self): return 1
    process = Process()
    target = types.SimpleNamespace(GetProcess=lambda: process,
        GetTriple=lambda: 'x86_64' if mode == 'wrong-abi' else 'arm64-apple-ios',
        BreakpointCreateByName=lambda name: Breakpoint(), BreakpointDelete=lambda number: True)
    sys.modules['lldb'] = types.SimpleNamespace(debugger=types.SimpleNamespace(
        GetSelectedTarget=lambda: target, SetAsync=lambda flag: None),
        SBListener=lambda name: types.SimpleNamespace(StartListeningForEvents=lambda *args: None),
        SBProcess=types.SimpleNamespace(eBroadcastBitStateChanged=1), eStateRunning=1)
    config = dict(output=str(directory / 'samples'), ready=str(directory / 'ready'),
        finished=str(directory / 'finished'), seconds=0, nonce='unit', script='', stop=str(directory / 'stop'))
    config_path = directory / 'config'
    config_path.write_text(json.dumps(config))
    probe = runpy.run_path(sys.argv[2])
    try:
        probe['run'](str(config_path))
        assert mode == 'success', mode
    except RuntimeError:
        assert mode != 'success', mode
    assert process.detached, mode
    receipt = json.loads((directory / 'finished').read_text())
    assert receipt['detached'] == (mode != 'detach-failure'), mode
    assert receipt['completed'] == (mode in ['detach-failure', 'success']), mode
`, temporary, path.join(__dirname, 'lldb_probe.py')], { timeout: 5000 });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
