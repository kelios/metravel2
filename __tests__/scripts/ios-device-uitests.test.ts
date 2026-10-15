import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { makeTempDir } from './cli-test-utils';

const {
  validateSteps, readConfig, runnerSourceHash, assertUnlocked, productHashes, validCache, runCommand, assertExecutionResult, main,
} = require('../../tools/ios-device-uitests/run');

const ROOT = path.resolve(__dirname, '../..');
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

  test('mocked installed-app runs reuse verified build and preserve every evidence directory', async () => {
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
  fs.writeFileSync(path.join(products, 'driver.xctestrun'), 'mock manifest');
  fs.writeFileSync(path.join(products, 'driver-binary'), 'v1');
 }
 if (args[0] === 'test-without-building' && process.env.MOCK_FAIL === '1') process.exit(65);
 if (args[0] === 'test-without-building' && process.env.MOCK_RESULT !== 'no-dispatch') {
  const steps = JSON.parse(process.env.TEST_RUNNER_QA_SCRIPT);
  console.log('QA-COMPLETE ' + JSON.stringify({schemaVersion:1,scriptSha256:require('node:crypto').createHash('sha256').update(process.env.TEST_RUNNER_QA_SCRIPT).digest('hex'),completedSteps:steps.length,completedAssertions:steps.filter(s=>['assert','waitUntil'].includes(s.op)).length}));
 }
}
`;
    for (const command of ['ps', 'xcrun', 'xcodebuild', 'python3']) {
      fs.writeFileSync(path.join(bin, command), fake, { mode: 0o700 });
    }
    const env = { ...process.env, ...deviceEnv, PATH: `${bin}:${process.env.PATH}`, IOS_QA_OUT: path.join(temp, 'evidence'), MOCK_CALLS: calls, MOCK_KEY: path.basename(temp), MOCK_CACHE: path.join(temp, 'cache-path') };
    const argv = [JSON.stringify([assertion]), 'same-label'];
    try {
      await main(argv, env);
      await main(argv, env);
      const passedDirs = fs.readdirSync(env.IOS_QA_OUT);
      expect(passedDirs).toHaveLength(2);
      for (const dir of passedDirs) {
        const report = JSON.parse(fs.readFileSync(path.join(env.IOS_QA_OUT, dir, 'report.json'), 'utf8'));
        expect(report).toMatchObject({ status: 'passed', layer: 'physical-ios', mode: 'diagnostic' });
        expect(report.execution).toMatchObject({ totalTestCount: 1, passedTests: 1, completedAssertions: 1 });
        expect(JSON.stringify(report)).not.toContain(deviceEnv.IOS_QA_DEVICE);
      }
      await expect(main(argv, { ...env, MOCK_FAIL: '1' })).rejects.toMatchObject({ exitCode: 65 });
      const dirs = fs.readdirSync(env.IOS_QA_OUT);
      expect(dirs).toHaveLength(3);
      const reports = dirs.map((dir) => JSON.parse(fs.readFileSync(path.join(env.IOS_QA_OUT, dir, 'report.json'), 'utf8')));
      expect(reports.filter((report) => report.status === 'failed')).toHaveLength(1);
      const commands = fs.readFileSync(calls, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
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
