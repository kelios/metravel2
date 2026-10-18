#!/usr/bin/env node
'use strict'

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { parseArgs } = require('node:util');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');
const YAML = require('yaml');
const { Acceptance, observerScript } = require('./telemetry');
const { acquireDeviceLock } = require('../../scripts/native-device-lock');
const { runBounded, assertJunitPass } = require('../../scripts/native-e2e-lib');

const ROOT = path.resolve(__dirname, '../..');
const ENTRY = path.join(ROOT, 'e2e/maestro/userpoints-map-entry.yaml');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function validateSource() {
  for (const file of [ENTRY, path.join(ROOT, 'e2e/maestro/confirm-ios-app-link.yaml')]) {
    const docs = YAML.parseAllDocuments(fs.readFileSync(file, 'utf8'));
    if (docs.length !== 2 || docs.some(doc => doc.errors.length)) throw new Error('Invalid entry YAML');
    if (docs[0].toJSON().appId !== 'by.metravel.app' || !docs[1].toJSON().length) throw new Error('Invalid entry flow');
  }
  return createHash('sha256').update(fs.readFileSync(ENTRY))
    .update(fs.readFileSync(path.join(ROOT, 'e2e/maestro/confirm-ios-app-link.yaml')))
    .update(fs.readFileSync(__filename)).update(fs.readFileSync(path.join(__dirname, 'telemetry.js')))
    .update(fs.readFileSync(path.join(__dirname, 'lldb_probe.py')))
    .update(fs.readFileSync(path.join(ROOT, 'scripts/native-device-lock.js')))
    .update(fs.readFileSync(path.join(ROOT, 'scripts/native-e2e-lib.js'))).digest('hex');
}

function validateFixture(fixture, apiOrigin, now = Date.now()) {
  if (fixture?.accountId !== 104 || fixture.apiOrigin !== apiOrigin ||
      !Number.isFinite(Date.parse(fixture.capturedAt)) ||
      now - Date.parse(fixture.capturedAt) < 0 || now - Date.parse(fixture.capturedAt) > 24 * 60 * 60 * 1000) {
    throw new Error('Independent user 104 API fixture must match the backend and be less than 24h old');
  }
  // Reuse the assertion's key validation; never derive the fixture from the map.
  new Acceptance({ expectedKeys: fixture.keys });
  return [...fixture.keys].sort();
}

function assertAndroidForward(raw, device, port, pid) {
  const matches = raw.trim().split('\n').map(line => line.trim().split(/\s+/))
    .filter(row => row[1] === `tcp:${port}`);
  if (matches.length !== 1 || matches[0][0] !== device || matches[0][2] !== `localabstract:webview_devtools_remote_${pid}`) {
    throw new Error('CDP forward must belong to the selected device and current MeTravel process');
  }
}

function assertSimulatorPid(raw, pid) {
  const matches = raw.trim().split('\n').map(line => line.trim().split(/\s+/))
    .filter(row => /^UIKitApplication:by\.metravel\.app\[/.test(row[2] || ''));
  if (matches.length !== 1 || matches[0][0] !== pid) throw new Error('LLDB PID must be the selected simulator MeTravel process');
}

async function connectCdp(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'ws:' || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || parsed.username || parsed.password) {
    throw new Error('CDP must be an explicitly forwarded local WebView websocket');
  }
  const socket = new WebSocket(url);
  const pending = new Map();
  let id = 0;
  socket.on('message', bytes => {
    let message;
    try { message = JSON.parse(String(bytes)); } catch { return; }
    if (!message || typeof message !== 'object') return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error('CDP evaluation failed'));
    else request.resolve(message.result);
  });
  const failPending = () => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('CDP disconnected')); }
    pending.clear();
  };
  socket.on('error', failPending); socket.on('close', failPending);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.terminate(); reject(new Error('CDP connection timeout')); }, 5000);
    socket.once('open', () => { clearTimeout(timer); resolve(); });
    socket.once('error', () => { clearTimeout(timer); reject(new Error('CDP unavailable; qualify dev-client debugging')); });
  });
  const evaluate = expression => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('CDP evaluation timeout')); }, 3000);
    pending.set(requestId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  }).then(result => {
    if (result.exceptionDetails || !result.result) throw new Error('Map JavaScript is inaccessible in the selected CDP target');
    return result.result.value;
  });
  return { evaluate, close: () => { socket.terminate(); failPending(); } };
}

async function selectAndroidMap(url) {
  const parsed = new URL(url);
  if (parsed.protocol === 'ws:') return connectCdp(url);
  if (parsed.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Expected local adb-forwarded CDP origin');
  }
  const response = await fetch(new URL('/json', parsed), { signal: AbortSignal.timeout(3000), redirect: 'error' });
  if (!response.ok) throw new Error('Forwarded WebView target inventory unavailable');
  const targets = await response.json();
  if (!Array.isArray(targets) || targets.some(target => !target || typeof target !== 'object')) throw new Error('Malformed WebView target inventory');
  const matches = [];
  for (const target of targets) {
    if (target.type !== 'page' || !target.webSocketDebuggerUrl) continue;
    let connection;
    try {
      if (new URL(target.webSocketDebuggerUrl).port !== parsed.port) throw new Error('WebView websocket escaped the selected adb forward');
      connection = await connectCdp(target.webSocketDebuggerUrl);
      if (await connection.evaluate("typeof map !== 'undefined' && typeof __metravelMarkerEntries !== 'undefined'")) matches.push(connection);
      else connection.close();
    } catch (error) {
      connection?.close();
      for (const match of matches) match.close();
      throw error;
    }
  }
  if (matches.length !== 1) {
    for (const match of matches) match.close();
    throw new Error('Exactly one native map CDP target is required');
  }
  return matches[0];
}

async function main() {
  const { values: options } = parseArgs({ options: {
    ...Object.fromEntries(['platform', 'device', 'pid', 'cdp-url', 'api-url', 'version', 'build', 'source', 'account-id', 'locale', 'expected-keys-file'].map(name => [name, { type: 'string' }])),
    check: { type: 'boolean' },
  } });
  const definitionSha256 = validateSource();
  if (options.check) { process.stdout.write(JSON.stringify({ status: 'source-validated', definitionSha256, runtimeExecuted: false }) + '\n'); return; }
  if (!['ios-simulator', 'android'].includes(options.platform) || !/^[a-zA-Z0-9_.:-]+$/.test(options.device || '') ||
      options['account-id'] !== '104' || options.locale !== 'ru' ||
      !/^\d+(?:\.\d+){0,3}$/.test(options.version || '') || !/^\d+$/.test(options.build || '') ||
      !/^[a-f0-9]{40}$/.test(options.source || '')) throw new Error('Explicit platform/device, user 104, RU and candidate version/build/source are required');
  const api = new URL(options['api-url']);
  if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password || api.search || api.hash || !['', '/', '/api', '/api/'].includes(api.pathname)) throw new Error('Expected API origin without secrets');
  if (options.platform === 'ios-simulator' && !/^[1-9]\d*$/.test(options.pid || '')) throw new Error('iOS requires the current qualified application PID');
  if (options.platform === 'android' && !options['cdp-url']) throw new Error('Android requires a qualified WebView CDP URL');
  if (!options['expected-keys-file']) throw new Error('An independent --expected-keys-file API fixture is required');
  const fixtureBytes = fs.readFileSync(options['expected-keys-file']);
  const fixture = JSON.parse(fixtureBytes.toString());
  const expectedKeys = validateFixture(fixture, api.origin);
  const out = path.join(ROOT, '.codex-temp/native-map', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0,8)}`);
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  const write = (file, value) => fs.writeFileSync(path.join(out, file), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  const nonce = randomUUID();
  const report = { status: 'failed', definitionSha256, platform: options.platform,
    candidate: { version: options.version, build: options.build, source: options.source, provenanceVerified: false },
    apiOrigin: api.origin, accountId: 104, locale: 'ru', expectedMarkers: expectedKeys.length,
    fixture: { sha256: createHash('sha256').update(fixtureBytes).digest('hex'), capturedAt: fixture.capturedAt, count: expectedKeys.length },
    entryAssertions: 0, checkpoints: [], offlineRecovery: 'not-covered', runtimeExecuted: true };
  let lldbChild, cdp, release, offset = 0, buffer = '', probeLog, lldbExited = false;
  const stop = path.join(out, 'stop');
  const ready = path.join(out, 'attached');
  const finished = path.join(out, 'detached.json');
  const telemetry = path.join(out, 'snapshots.jsonl');
  const abort = new AbortController();
  const onSignal = () => abort.abort();
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  const readSamples = () => {
    if (!fs.existsSync(telemetry)) return [];
    const bytes = fs.readFileSync(telemetry);
    buffer += bytes.subarray(offset).toString(); offset = bytes.length;
    const lines = buffer.split('\n'); buffer = lines.pop();
    return lines.filter(Boolean).map(line => JSON.parse(line));
  };
  try {
    release = acquireDeviceLock({ device: options.device, name: 'map-marker-acceptance' });
    const probe = async (command, args) => {
      const result = await runBounded(command, args, { timeoutMs: 5000, signal: abort.signal });
      if (result.code !== 0) throw new Error('Selected native target identity probe failed');
      return result.output.trim();
    };
    if (options.platform === 'ios-simulator') {
      const devices = JSON.parse(await probe('xcrun', ['simctl', 'list', 'devices', 'booted', '--json']));
      const selected = Object.values(devices.devices).flat().find(device => device.udid === options.device && device.state === 'Booted');
      if (!selected) throw new Error('Selected iOS simulator is not booted');
      report.targetModel = selected.name;
      const app = await probe('xcrun', ['simctl', 'get_app_container', options.device, 'by.metravel.app', 'app']);
      for (const [key, expected] of [['CFBundleShortVersionString', options.version], ['CFBundleVersion', options.build]]) {
        if (await probe('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, path.join(app, 'Info.plist')]) !== expected) throw new Error('Installed iOS candidate version/build mismatch');
      }
      assertSimulatorPid(await probe('xcrun', ['simctl', 'spawn', options.device, 'launchctl', 'list']), options.pid);
      const config = path.join(out, 'probe-config.json');
      fs.writeFileSync(config, JSON.stringify({ output: telemetry, ready, stop, finished, seconds: 150, nonce, script: observerScript(nonce, 150) }), { mode: 0o600 });
      probeLog = fs.openSync(path.join(out, 'lldb.log'), 'wx', 0o600);
      lldbChild = spawn('xcrun', ['lldb', '--batch', '-p', options.pid,
        '-o', `command script import "${path.join(__dirname, 'lldb_probe.py')}"`,
        '-o', `script lldb_probe.run(${JSON.stringify(config)})`], { stdio: ['ignore', probeLog, probeLog] });
      lldbChild.once('exit', () => { lldbExited = true; });
      lldbChild.once('error', () => { lldbExited = true; abort.abort(); });
      const until = Date.now() + 10000;
      while (!fs.existsSync(ready)) {
        if (Date.now() > until || lldbExited || abort.signal.aborted) throw new Error('LLDB observer did not attach; inspect lldb.log');
        await delay(100);
      }
    }
    const entry = await runBounded(process.env.MAESTRO_BIN || 'maestro', ['--device', options.device, 'test', '--format', 'junit', '--output', path.join(out, 'entry.xml'), ENTRY], {
      timeoutMs: 45000, logPath: path.join(out, 'maestro.log'), signal: abort.signal,
    });
    if (entry.code !== 0) throw new Error('Userpoints map entry failed; inspect maestro.log');
    report.entryAssertions = assertJunitPass(fs.readFileSync(path.join(out, 'entry.xml'), 'utf8'));
    // Discard samples from the launch/previous screen. Baseline must follow
    // the successful userpoints entry, not an old map retained in navigation.
    readSamples();
    if (options.platform === 'android') {
      const parsed = new URL(options['cdp-url']);
      if (!['ws:', 'http:'].includes(parsed.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || !parsed.port) throw new Error('CDP requires an explicit local forwarded port');
      const pid = await probe('adb', ['-s', options.device, 'shell', 'pidof', 'by.metravel.app']);
      if (!/^[1-9]\d*$/.test(pid)) throw new Error('Exactly one running Android MeTravel process is required');
      assertAndroidForward(await probe('adb', ['forward', '--list']), options.device, parsed.port, pid);
      const info = await probe('adb', ['-s', options.device, 'shell', 'dumpsys', 'package', 'by.metravel.app']);
      if (info.match(/versionName=([^\s]+)/)?.[1] !== options.version || info.match(/versionCode=(\d+)/)?.[1] !== options.build) throw new Error('Installed Android candidate version/build mismatch');
      report.targetModel = await probe('adb', ['-s', options.device, 'shell', 'getprop', 'ro.product.model']);
      cdp = await selectAndroidMap(options['cdp-url']);
      if (await cdp.evaluate(observerScript(nonce, 150)) !== true) throw new Error('Selected CDP target has no native map');
    }
    const acceptance = new Acceptance({ expectedKeys });
    write('progress.json', { stage: 0, action: `Wait for all ${expectedKeys.length} independent API fixture markers to settle; do not zoom yet` });
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      if (abort.signal.aborted) throw new Error('Interrupted');
      if (lldbChild && lldbExited) throw new Error('LLDB observer exited before assertions completed');
      let samples;
      if (cdp) {
        const snapshot = await cdp.evaluate('window.__metravelQaMapObserver && window.__metravelQaMapObserver.snapshot()');
        fs.appendFileSync(telemetry, JSON.stringify(snapshot) + '\n'); samples = [snapshot];
      } else samples = readSamples();
      for (const sample of samples) {
        if (sample.nonce !== nonce) throw new Error('Telemetry belongs to another probe');
        const oldStage = acceptance.stage;
        const passed = acceptance.consume(sample);
        report.checkpoints = acceptance.checkpoints;
        if (acceptance.stage !== oldStage) write('progress.json', {
          stage: acceptance.stage, action: ['Wait for baseline', 'QA agent: one native zoom-in gesture', 'QA agent: second native zoom-in gesture', 'QA agent: one native zoom-out gesture', 'Complete'][acceptance.stage],
          checkpoint: acceptance.checkpoints.at(-1),
        });
        if (passed) { report.status = 'passed'; return; }
      }
      acceptance.assertWithinBudget();
      await delay(100);
    }
    throw new Error('Map acceptance exceeded 90 seconds');
  } catch (error) { report.error = error.message; throw error; }
  finally {
    const cleanupErrors = [];
    let detachUncertain = false;
    try { fs.writeFileSync(stop, 'stop\n', { mode: 0o600 }); }
    catch { cleanupErrors.push('Could not request observer cleanup'); }
    if (cdp) {
      try { await cdp.evaluate('window.__metravelQaMapObserver && window.__metravelQaMapObserver.stop()'); }
      catch { cleanupErrors.push('CDP observer cleanup failed; observer self-expires'); }
      finally { cdp.close(); }
    }
    if (lldbChild) {
      const until = Date.now() + 5000;
      while (!lldbExited && Date.now() < until) await delay(100);
      if (!lldbExited) {
        detachUncertain = true;
        cleanupErrors.push('LLDB did not detach; check stopped process and retained lease before reuse');
        lldbChild.kill('SIGTERM');
      } else {
        let receipt;
        try { receipt = JSON.parse(fs.readFileSync(finished, 'utf8')); } catch { /* Missing proof fails closed. */ }
        if (lldbChild.exitCode !== 0 || receipt?.completed !== true || receipt?.detached !== true) {
          detachUncertain = true;
          cleanupErrors.push('LLDB exited unsuccessfully; inspect lldb.log and retained lease before reuse');
        }
      }
    }
    try { if (probeLog !== undefined) fs.closeSync(probeLog); }
    catch { cleanupErrors.push('Could not close debugger log'); }
    if (cleanupErrors.length) {
      report.status = 'failed'; report.cleanupErrors = cleanupErrors; process.exitCode = 1;
    }
    report.deviceLeaseRetained = detachUncertain;
    if (!detachUncertain) release?.();
    process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal);
    write('report.json', report);
    process.stdout.write(`Map acceptance ${report.status}: ${path.relative(ROOT, out)}/report.json\n`);
  }
}

if (require.main === module) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
module.exports = { validateSource, validateFixture, assertAndroidForward, assertSimulatorPid, connectCdp, selectAndroidMap };
