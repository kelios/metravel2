import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { makeTempDir, runCli } from './cli-test-utils';

const {
  validateSteps, readConfig, runnerSourceHash, assertUnlocked, productHashes, validCache, runCommand, assertExecutionResult, main,
} = require('../../tools/ios-device-uitests/run');

const ROOT = path.resolve(__dirname, '../..');
const plist = require('@expo/plist').default;
const deviceEnv = { IOS_QA_DEVICE: '00000000-0000000000000001' };
const assertion = { op: 'waitUntil', id: 'stable-element', state: 'hittable', timeout: 5 };
let temp: string;

beforeEach(() => {
  temp = makeTempDir('ios-driver-unit-', { root: path.join(ROOT, '.codex-temp') });
});
afterEach(() => fs.rmSync(temp, { recursive: true, force: true }));

describe('physical XCTest runner contract without device access', () => {
  const summary = () => ({ result: 'Passed', totalTestCount: 1, passedTests: 1, failedTests: 0, skippedTests: 0, expectedFailures: 0 });
  // Shape verified offline against an existing Xcode xcresult. No real account,
  // device, failure text, screenshot or application data is copied into fixtures.
  const testTree = () => ({ testNodes: [{ nodeType: 'Test Plan', children: [{ nodeType: 'UI test bundle', name: 'MetravelDeviceUITests', children: [{ nodeType: 'Test Suite', name: 'RunScriptTests', children: [{ nodeType: 'Test Case', nodeIdentifier: 'RunScriptTests/testRunScript()', result: 'Passed' }] }] }] }] });
  const completion = (override = {}) => 'QA-COMPLETE ' + JSON.stringify({ schemaVersion: 1, scriptSha256: createHash('sha256').update(JSON.stringify([assertion])).digest('hex'), completedSteps: 1, completedAssertions: 1, ...override });

  test('requires the actual intended passing testcase and completed script hash', () => {
    expect(assertExecutionResult(summary(), testTree(), completion(), [assertion])).toMatchObject({ totalTestCount: 1, passedTests: 1, skippedTests: 0, identity: 'MetravelDeviceUITests/RunScriptTests/testRunScript()', completedSteps: 1, completedAssertions: 1 });
  });

  test.each([
    { totalTestCount: 0, passedTests: 0 },
    { skippedTests: 1 }, { failedTests: 1, passedTests: 0, result: 'Failed' },
    { expectedFailures: 1 }, { totalTestCount: 2, passedTests: 2 },
    { totalTestCount: '1' }, { passedTests: undefined }, { result: 'Skipped' },
  ])('rejects zero, failed, skipped, expected-failure or inconsistent result despite exit zero: %j', (override) => {
    expect(() => assertExecutionResult({ ...summary(), ...override }, testTree(), completion(), [assertion])).toThrow('exactly one passing');
  });

  test('rejects missing, wrong, duplicate or failed intended testcase identities', () => {
    for (const override of [{ nodeIdentifier: 'OtherTests/testOther()' }, { result: 'Skipped' }, { result: 'Failed' }]) {
      const tree = testTree();
      Object.assign(tree.testNodes[0].children[0].children[0].children[0], override);
      expect(() => assertExecutionResult(summary(), tree, completion(), [assertion])).toThrow('Unexpected XCTest case');
    }
    const wrongBundle = testTree();
    wrongBundle.testNodes[0].children[0].name = 'AnotherBundle';
    expect(() => assertExecutionResult(summary(), wrongBundle, completion(), [assertion])).toThrow('Unexpected XCTest case');
    const duplicate = testTree();
    duplicate.testNodes[0].children[0].children[0].children.push({ ...duplicate.testNodes[0].children[0].children[0].children[0] });
    expect(() => assertExecutionResult(summary(), duplicate, completion(), [assertion])).toThrow('Unexpected XCTest case');
    for (const tree of [{}, { testNodes: [] }]) expect(() => assertExecutionResult(summary(), tree, completion(), [assertion])).toThrow('Missing XCTest case');
  });

  test.each(['', 'QA-STEP 0 shot screen', 'QA-COMPLETE not-json', completion() + '\n' + completion()])('rejects absent/default screenshot/invalid/duplicate dispatch completion: %s', (log) => {
    expect(() => assertExecutionResult(summary(), testTree(), log, [assertion])).toThrow(/QA_SCRIPT/);
  });

  test.each([{ scriptSha256: 'a'.repeat(64) }, { completedSteps: 0 }, { completedAssertions: 0 }, { completedSteps: 2 }, { schemaVersion: 2 }])('rejects wrong dispatch hash or incomplete script execution: %j', (override) => {
    expect(() => assertExecutionResult(summary(), testTree(), completion(override), [assertion])).toThrow('dispatch hash or completion');
  });

  test.each([
    [[], '1..200'],
    [[{ op: 'tapId' }], 'missing id'],
    [[{ op: 'tapId', id: 'x', timeout: 31 }], 'invalid timeout'],
    [[{ op: 'wait', sec: 6 }], 'fixed waits'],
    [[{ op: 'tap', x: -1, y: 2 }], 'invalid x'],
    [[{ op: 'swipe', dir: 'around' }], 'invalid direction'],
    [[{ op: 'ensureSwitch', id: 'x', on: 'false' }], 'boolean'],
    [[{ op: 'shot', name: '../../evidence' }], 'unsafe name'],
    [[{ op: 'tapId', id: 'x', retry: 10 }], 'unexpected field'],
    [[{ op: 'assert', id: 'x', text: 'x', state: 'exists' }], 'one exact'],
    [[{ op: 'assert', id: 'x', state: 'count', count: 0.5 }], 'count'],
    [[{ op: 'typePlaceholder', text: 'x' }], 'missing placeholder'],
  ])('rejects invalid script %j before runtime', (steps, error) => {
    expect(() => validateSteps(steps)).toThrow(error);
  });

  test('accepts exact selector assertions and bounded waits', () => {
    expect(validateSteps([assertion, { op: 'assert', id: 'sheet', state: 'absent' }, { op: 'assert', text: 'Done', state: 'count', count: 1 }])).toHaveLength(3);
  });

  test('requires an explicit device; never auto-selects one', () => {
    expect(() => readConfig([JSON.stringify([assertion])], {})).toThrow('Explicit IOS_QA_DEVICE');
    expect(readConfig(['--validate', JSON.stringify([assertion])], deviceEnv).validate).toBe(true);
  });

  test('requires the exact optional no-attachment policy and rejects explicit capture before activation', () => {
    const steps = JSON.stringify([assertion]);
    const config = readConfig([steps], { ...deviceEnv, IOS_QA_ATTACHMENTS: 'none' });
    expect(config.privateInput).toBe(false);
    expect(config.attachmentPolicy).toEqual({ system: 'keepNever', user: 'keepNever' });
    expect(readConfig([steps], deviceEnv).attachmentPolicy).toEqual({ system: 'deleteOnSuccess', user: 'keepAlways' });
    expect(readConfig([JSON.stringify([{ op: 'secretClipboard', key: 'dummy' }])], { ...deviceEnv, QA_PRIVATE_INPUT: '1' }).attachmentPolicy).toEqual({ system: 'keepNever', user: 'keepNever' });
    for (const value of ['', 'all', 'false', '0']) {
      expect(() => readConfig([steps], { ...deviceEnv, IOS_QA_ATTACHMENTS: value })).toThrow('Invalid attachment policy');
    }
    for (const op of ['shot', 'tree']) {
      expect(() => readConfig([JSON.stringify([{ op }])], { ...deviceEnv, IOS_QA_ATTACHMENTS: 'none' })).toThrow('Capture forbidden');
    }
  });

  test('requires an explicit unlocked observation before building the helper', () => {
    expect(() => assertUnlocked('passcodeRequired: false')).not.toThrow();
    for (const state of ['', 'unrecognized format', 'passcodeRequired: true', 'passcodeRequired: false\npasscodeRequired: true']) {
      expect(() => assertUnlocked(state)).toThrow('lock state unknown');
    }
  });

  test('rejects path traversal and symlink evidence redirection', () => {
    expect(() => readConfig(['[]', '../other'], deviceEnv)).toThrow('Unsafe label');
    expect(() => readConfig([JSON.stringify([assertion])], { ...deviceEnv, IOS_QA_OUT: '/tmp/private-evidence' })).toThrow('IOS_QA_OUT');
    fs.symlinkSync('/tmp', path.join(temp, 'outside'));
    expect(() => readConfig([JSON.stringify([assertion])], { ...deviceEnv, IOS_QA_OUT: path.join(temp, 'outside/evidence') })).toThrow('IOS_QA_OUT');
  });

  test('disables sensitive operations in private input before device activation', () => {
    for (const op of ['tree', 'shot', 'assert']) {
      const step = op === 'assert' ? { op, id: 'stable-element', state: 'hittable' } : { op };
      expect(() => validateSteps([step], true)).toThrow('private input');
    }
    expect(() => validateSteps([{ op: 'secretClipboard', key: 'dummy' }])).toThrow('requires private input');
    expect(validateSteps([{ op: 'secretClipboard', key: 'dummy' }, { op: 'clearSecretClipboard' }], true)).toHaveLength(2);
  });

  test('rehearsal rejects untracked scripts and diagnostic arrays', () => {
    expect(() => readConfig(['--rehearsal', JSON.stringify([assertion])], deviceEnv)).toThrow('tracked scenario object');
    const file = path.join(temp, 'scenario.json');
    fs.writeFileSync(file, JSON.stringify({ id: 'untracked', layer: 'physical-ios', steps: [{ op: 'assert', id: 'x', state: 'exists' }] }));
    expect(() => readConfig(['--rehearsal', `@${file}`], deviceEnv)).toThrow('must be tracked');
  });

  test('cache integrity includes test manifest and binary bytes', () => {
    const products = path.join(temp, 'Build/Products');
    fs.mkdirSync(products, { recursive: true });
    fs.writeFileSync(path.join(products, 'driver.xctestrun'), 'manifest');
    fs.writeFileSync(path.join(products, 'driver-binary'), 'v1');
    fs.writeFileSync(path.join(temp, 'manifest.json'), JSON.stringify({ fingerprint: 'expected', files: productHashes(products) }));
    expect(validCache(temp, 'expected')).toBe(true);
    expect(validCache(temp, 'other-source')).toBe(false);
    fs.writeFileSync(path.join(products, 'driver-binary'), 'v2');
    expect(validCache(temp, 'expected')).toBe(false);
  });

  test('deadline stops our subprocess and cannot report pass', async () => {
    const started = Date.now();
    await expect(runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { deadline: Date.now() + 100 })).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(3000);
  });

  test('an exhausted budget starts no subprocess', async () => {
    await expect(runCommand('nonexistent-command-that-must-not-launch', [], { deadline: Date.now() - 1 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  test.each([undefined, 'none'])('mocked installed-app runs reuse verified build and preserve every evidence directory with attachment policy %s', async (policy) => {
    const bin = path.join(temp, 'bin');
    const calls = path.join(temp, 'calls.jsonl');
    fs.mkdirSync(bin);
    const fake = `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path');
const program = path.basename(process.argv[1]), args = process.argv.slice(2);
fs.appendFileSync(process.env.MOCK_CALLS, JSON.stringify({program, args}) + '\\n');
if (program === 'xcrun') {
 if (args[0] !== 'xcresulttool') console.log('passcodeRequired: false');
 else if (process.env.MOCK_RESULT === 'missing') process.exit(1);
 else if (args.includes('summary')) console.log(JSON.stringify({ result:'Passed', totalTestCount:process.env.MOCK_RESULT === 'zero' ? 0 : 1, passedTests:process.env.MOCK_RESULT === 'zero' ? 0 : 1, failedTests:0, skippedTests:0, expectedFailures:0 }));
 else console.log(JSON.stringify({testNodes:[{nodeType:'UI test bundle',name:'MetravelDeviceUITests',children:[{nodeType:'Test Case',nodeIdentifier:'RunScriptTests/testRunScript()',result:'Passed'}]}]}));
}
if (program === 'xcodebuild') {
 if (args[0] === '-version') console.log('Xcode MOCK_UNIT_' + process.env.MOCK_KEY);
 if (args[0] === 'build-for-testing') {
  const cache = args[args.indexOf('-derivedDataPath') + 1];
  fs.writeFileSync(process.env.MOCK_CACHE, cache);
  const products = path.join(cache, 'Build/Products');
  fs.mkdirSync(products, {recursive:true});
  fs.writeFileSync(path.join(products, 'driver.xctestrun'), '<plist version="1.0"><dict><key>TestConfigurations</key><array><dict><key>TestTargets</key><array><dict><key>TestBundlePath</key><string>__TESTROOT__/driver-binary</string></dict></array></dict></array></dict></plist>');
  fs.writeFileSync(path.join(products, 'driver-binary'), 'v1');
 }
 if (args[0] === 'test-without-building' && process.env.MOCK_FAIL === '1') process.exit(65);
 if (args[0] === 'test-without-building' && process.env.MOCK_RESULT !== 'no-dispatch') {
  const steps = JSON.parse(process.env.TEST_RUNNER_QA_SCRIPT);
  console.log('QA-COMPLETE ' + JSON.stringify({schemaVersion:1,scriptSha256:require('node:crypto').createHash('sha256').update(process.env.TEST_RUNNER_QA_SCRIPT).digest('hex'),completedSteps:steps.length,completedAssertions:steps.filter(s=>['assert','waitUntil'].includes(s.op)).length}));
 }
}
`;
    for (const command of ['ps', 'xcrun', 'xcodebuild']) {
      fs.writeFileSync(path.join(bin, command), fake, { mode: 0o700 });
    }
    const python = runCli('python3', ['-c', 'import sys; print(sys.executable)'], { timeoutMs: 5000 });
    expect(python.status).toBe(0);
    fs.symlinkSync(python.stdout.trim(), path.join(bin, 'python3'));
    const env = { ...process.env, ...deviceEnv, ...(policy ? { IOS_QA_ATTACHMENTS: policy } : {}), PATH: `${bin}:${process.env.PATH}`, IOS_QA_OUT: path.join(temp, 'evidence'), MOCK_CALLS: calls, MOCK_KEY: path.basename(temp), MOCK_CACHE: path.join(temp, 'cache-path') };
    const attachmentPolicy = policy ? { system: 'keepNever', user: 'keepNever' } : { system: 'deleteOnSuccess', user: 'keepAlways' };
    const runtimeTarget = (dir: string) => plist.parse(fs.readFileSync(path.join(env.IOS_QA_OUT, dir, 'run.xctestrun'), 'utf8')).TestConfigurations[0].TestTargets[0];
    const argv = [JSON.stringify([assertion]), 'same-label'];
    try {
      await main(argv, env);
      await main(argv, env);
      const passedDirs = fs.readdirSync(env.IOS_QA_OUT);
      expect(passedDirs).toHaveLength(2);
      for (const dir of passedDirs) {
        const report = JSON.parse(fs.readFileSync(path.join(env.IOS_QA_OUT, dir, 'report.json'), 'utf8'));
        expect(report).toMatchObject({ status: 'passed', layer: 'physical-ios', mode: 'diagnostic' });
        expect(report.attachmentPolicy).toEqual(attachmentPolicy);
        expect(report.execution).toMatchObject({ totalTestCount: 1, passedTests: 1, completedAssertions: 1 });
        expect(JSON.stringify(report)).not.toContain(deviceEnv.IOS_QA_DEVICE);
        expect(runtimeTarget(dir)).toMatchObject({ SystemAttachmentLifetime: attachmentPolicy.system, UserAttachmentLifetime: attachmentPolicy.user });
      }
      await expect(main(argv, { ...env, MOCK_FAIL: '1' })).rejects.toMatchObject({ exitCode: 65 });
      const dirs = fs.readdirSync(env.IOS_QA_OUT);
      expect(dirs).toHaveLength(3);
      const reports = dirs.map((dir) => JSON.parse(fs.readFileSync(path.join(env.IOS_QA_OUT, dir, 'report.json'), 'utf8')));
      expect(reports.filter((report) => report.status === 'failed')).toHaveLength(1);
      expect(reports.find((report) => report.status === 'failed').attachmentPolicy).toEqual(attachmentPolicy);
      const failedDir = dirs.find((dir) => JSON.parse(fs.readFileSync(path.join(env.IOS_QA_OUT, dir, 'report.json'), 'utf8')).status === 'failed')!;
      expect(runtimeTarget(failedDir)).toMatchObject({ SystemAttachmentLifetime: attachmentPolicy.system, UserAttachmentLifetime: attachmentPolicy.user });
      const cache = fs.readFileSync(env.MOCK_CACHE, 'utf8');
      const cachedTarget = plist.parse(fs.readFileSync(path.join(cache, 'Build/Products/driver.xctestrun'), 'utf8')).TestConfigurations[0].TestTargets[0];
      expect(cachedTarget).toEqual({ TestBundlePath: '__TESTROOT__/driver-binary' });
      const commands = fs.readFileSync(calls, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
      for (const dir of dirs) expect(runtimeTarget(dir)).toMatchObject({
        TestBundlePath: path.join(cache, 'Build/Products/driver-binary'),
        SystemAttachmentLifetime: attachmentPolicy.system,
        UserAttachmentLifetime: attachmentPolicy.user,
      });
      expect(commands.filter((call) => call.args[0] === 'build-for-testing')).toHaveLength(1);
      expect(commands.filter((call) => call.args[0] === 'test-without-building')).toHaveLength(3);
      expect(commands.some((call) => call.args.includes('-allowProvisioningUpdates'))).toBe(false);
      for (const mode of ['missing', 'zero', 'no-dispatch']) {
        await expect(main(argv, { ...env, MOCK_RESULT: mode })).rejects.toThrow();
      }
      const allReports = fs.readdirSync(env.IOS_QA_OUT).map((dir) => JSON.parse(fs.readFileSync(path.join(env.IOS_QA_OUT, dir, 'report.json'), 'utf8')));
      expect(allReports.filter((report) => report.status === 'passed')).toHaveLength(2);
      expect(allReports.filter((report) => report.status === 'failed')).toHaveLength(4);
    } finally {
      const cacheFile = path.join(temp, 'cache-path');
      if (fs.existsSync(cacheFile)) fs.rmSync(fs.readFileSync(cacheFile, 'utf8'), { recursive: true, force: true });
    }
  });

  test('current Swift driver validates before activation and has bounded exact assertions', () => {
    const swift = fs.readFileSync(path.join(ROOT, 'tools/ios-device-uitests/MetravelDeviceUITests/RunScriptTests.swift'), 'utf8');
    expect(swift.indexOf('guard validate(steps)')).toBeLessThan(swift.indexOf('app.activate()'));
    expect(swift).toContain('Missing QA_SCRIPT dispatch');
    expect(swift).toContain('env("QA_LEGACY_SHOT") == "1"');
    expect(swift).toContain('SHA256.hash(data: Data(raw.utf8))');
    expect(swift.indexOf('print("QA-COMPLETE "')).toBeGreaterThan(swift.indexOf('completedSteps += 1'));
    expect(swift).toContain('case "waitUntil": assertState');
    expect(swift).toContain('case "assert": assertState');
    expect(swift).toContain('for _ in 0..<3');
    expect(swift).not.toContain('0..<25');
    expect(swift).not.toContain('label CONTAINS[c]');
    expect(runnerSourceHash()).toMatch(/^[a-f0-9]{64}$/);
  });

  test('clipboard staging and owned cleanup require the verified writer foreground and deferred target restoration', () => {
    const swift = fs.readFileSync(path.join(ROOT, 'tools/ios-device-uitests/MetravelDeviceUITests/RunScriptTests.swift'), 'utf8');
    const body = (source: string, name: string) => {
      const start = source.indexOf(`private func ${name}(`);
      if (start < 0) return '';
      const opening = source.indexOf('{', start);
      let depth = 1, end = opening + 1;
      for (; end < source.length && depth > 0; end++) {
        if (source[end] === '{') depth++;
        if (source[end] === '}') depth--;
      }
      return source.slice(opening + 1, end - 1);
    };
    const problems = (source: string) => {
      const stage = body(source, 'stageSecretClipboard');
      const clear = body(source, 'clearSecretClipboard');
      const outer = body(source, 'withForegroundClipboardWriter');
      const writer = body(source, 'foregroundClipboardTransaction');
      const failures = [];
      if (![stage, clear].every((operation) => operation.includes('_ = withForegroundClipboardWriter {'))) failures.push('background clipboard access');
      if (!writer.includes('let writerId = Bundle.main.bundleIdentifier') || !writer.includes('let testId = Bundle(for: RunScriptTests.self).bundleIdentifier') || !writer.includes('writerId == testId + ".xctrunner"') || !writer.includes('Bundle.main.bundleURL.pathExtension == "app"')) failures.push('wrong executing writer identity');
      if (!writer.includes('XCUIApplication(bundleIdentifier: writerId)') || !writer.includes('writer.activate()') || !writer.includes('if !writer.wait(for: .runningForeground, timeout: 15)')) failures.push('missing bounded writer activation');
      if (!writer.includes('defer {') || !writer.includes('target.activate()') || !writer.includes('target.wait(for: .runningForeground, timeout: 15)') || writer.indexOf('defer {') > writer.indexOf('writer.activate()')) failures.push('missing deferred target restore');
      if (!writer.includes('onMain {') || !writer.includes('guard UIApplication.shared.applicationState == .active') || !writer.includes('succeeded = action()') || writer.indexOf('if !writer.wait') > writer.indexOf('onMain {') || writer.indexOf('applicationState == .active') > writer.indexOf('succeeded = action()')) failures.push('clipboard action before actual foreground');
      if (!writer.includes('if !succeeded { failure = "Foreground clipboard operation failed" }') || !writer.includes('guard restored else') || !outer.includes('let failure = foregroundClipboardTransaction(action)') || outer.indexOf('XCTFail(failure)') < outer.indexOf('foregroundClipboardTransaction(action)') || !outer.includes('XCTFail(failure)')) failures.push('operation failure accepted');
      if (/XCT(?:Fail|Assert\w*)\s*\(/.test(writer)) failures.push('test issue raised before restoration');
      if (!stage.includes('pasteboard.numberOfItems == 1') || !stage.includes('stagedCount != previousCount') || !stage.includes('pasteboard.changeCount == stagedCount') || stage.includes('pasteboard.string') || stage.includes('pasteboard.items')) failures.push('unverified or payload-reading clipboard write');
      if (!stage.includes('if stagedCount != previousCount { secretPasteboardChangeCount = stagedCount }') || stage.indexOf('secretPasteboardChangeCount = stagedCount') > stage.indexOf('guard stagedCount != previousCount')) failures.push('new generation unowned on verification failure');
      if (!stage.includes('try FileManager.default.removeItem(at: file)') || !stage.includes('.localOnly: true') || !stage.includes('.expirationDate: Date().addingTimeInterval(60)')) failures.push('lost one-shot local expiry');
      if (!clear.includes('guard pasteboard.changeCount == expectedChangeCount else') || clear.indexOf('guard pasteboard.changeCount') > clear.indexOf('pasteboard.items = []') || !clear.includes('pasteboard.numberOfItems == 0') || !clear.includes('pasteboard.changeCount != expectedChangeCount')) failures.push('lost clear ownership or verification');
      if ([stage, clear, writer, outer].some((operation) => operation.includes('print('))) failures.push('clipboard logging');
      return failures;
    };
    expect(problems(swift)).toEqual([]);
    // These mutants represent the old background contract and concrete ways a
    // future refactor could silently lose foreground, failure or ownership gates.
    const clear = body(swift, 'clearSecretClipboard');
    for (const mutant of [
      swift.replace('_ = withForegroundClipboardWriter {', 'onMain {'),
      swift.replace(clear, clear.replace('_ = withForegroundClipboardWriter {', 'onMain {')),
      swift.replace('let writerId = Bundle.main.bundleIdentifier', 'let writerId = Bundle(for: RunScriptTests.self).bundleIdentifier'),
      swift.replace('writer.activate()', '// removed writer activation'),
      swift.replace('if !writer.wait(for: .runningForeground, timeout: 15)', 'if false'),
      swift.replace('defer {\n                target.activate()', 'if false {\n                target.activate()'),
      swift.replace('guard UIApplication.shared.applicationState == .active', 'guard true'),
      swift.replace('if !succeeded { failure = "Foreground clipboard operation failed" }', 'if false { failure = "Foreground clipboard operation failed" }'),
      swift.replace('pasteboard.numberOfItems == 1,', 'pasteboard.string == value,'),
      swift.replace('if stagedCount != previousCount { secretPasteboardChangeCount = stagedCount }', '// lost ownership'),
      swift.replace('failure = "Clipboard writer did not reach foreground"', 'XCTFail("Clipboard writer did not reach foreground")'),
      swift.replace('restored = target.wait(for: .runningForeground, timeout: 15)', 'XCTAssertTrue(target.wait(for: .runningForeground, timeout: 15))'),
      swift.replace('guard pasteboard.changeCount == expectedChangeCount else', 'guard true else'),
      swift.replace('pasteboard.numberOfItems == 0', 'true'),
      swift.replace('.localOnly: true', '.localOnly: false'),
    ]) expect(problems(mutant).length).toBeGreaterThan(0);
  });

  test('persisted close/reopen regression checks dismissal and second opening', () => {
    const file = path.join(ROOT, 'tools/ios-device-uitests/scenarios/travel-sections-close-reopen.json');
    const scenario = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(validateSteps(scenario.steps)).toHaveLength(10);
    expect(scenario.steps.filter((step: { state?: string }) => step.state === 'absent')).toHaveLength(2);
    const component = fs.readFileSync(path.join(ROOT, 'components/travel/TravelSectionsSheet.tsx'), 'utf8');
    for (const id of ['travel-sections-trigger', 'travel-sections-close']) expect(component).toContain(`testID="${id}"`);
    expect(scenario.purpose).toContain('does not cover a complete');
  });
});
