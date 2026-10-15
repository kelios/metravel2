import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { mapIncomingAppLinkToHref } from '@/utils/incomingAppLinks';
import { makeTempDir, runCli } from './cli-test-utils';

const {
  FLOW_ROOT, loadManifest, assertJunitPass, validateSelection, runBounded,
} = require('../../scripts/native-e2e-lib');
const { acquireDeviceLock, findConflictingNativeProcesses } = require('../../scripts/native-device-lock');

describe('native e2e source and result contract', () => {
  const { manifest } = loadManifest();
  const valid = {
    suite: 'guest-smoke', platform: 'ios-simulator', device: 'fixture-simulator',
    account: 'guest', locale: 'ru', build: '22', version: '1.0.0', 'api-url': 'http://localhost:8000',
  };

  it('validates the real flows without claiming complete App Review coverage', () => {
    const loaded = loadManifest();
    expect(loaded.files).toContain('auth-consent-entry.yaml');
    expect(loaded.definitionSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.values(manifest.suites).every((suite: any) => suite.completeReviewScenes.length === 0)).toBe(true);
  });

  it('uses only supported OS app links in the tracked Maestro flows', () => {
    const appLinks: string[] = [];
    const collect = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const command = value as Record<string, unknown>;
      if ('openLink' in command) {
        const link = typeof command.openLink === 'string'
          ? command.openLink
          : (command.openLink as { link?: string })?.link;
        if (link?.startsWith('metravel://')) appLinks.push(link);
      }
      Object.values(command).forEach(collect);
    };
    for (const file of loadManifest().files) {
      YAML.parseAllDocuments(fs.readFileSync(path.join(FLOW_ROOT, file), 'utf8'))
        .forEach((doc) => collect(doc.toJSON()));
    }
    expect(appLinks.length).toBeGreaterThan(0);
    // Auth uses internal UI navigation; OS /login and /registration links are
    // intentionally rejected by the app's existing incoming-link policy.
    expect(appLinks.filter((link) => mapIncomingAppLinkToHref(link) === null)).toEqual([]);
  });

  it.each([
    { platform: 'ios-physical' }, { device: '' }, { locale: 'en' }, { account: 'seeded' },
    { suite: 'recommendations', platform: 'ios-simulator' }, { build: '22 extra' },
    { 'api-url': 'https://user:secret@metravel.by' }, { 'api-url': 'https://metravel.by/api?token=secret' },
  ])('rejects unsupported targets or ambiguous run metadata: %p', (override) => {
    expect(() => validateSelection(manifest, { ...valid, ...override })).toThrow();
  });

  it('accepts an explicit supported selection', () => {
    expect(validateSelection(manifest, valid).account).toBe('guest');
  });

  it('requires a real successful JUnit testcase', () => {
    expect(assertJunitPass('<testsuites><testsuite tests="1" failures="0"><testcase name="flow"/></testsuite></testsuites>')).toBe(1);
  });

  it.each([
    '', '<testsuite tests="0"/>', '<report><testcase/></report>',
    '<testsuite><testcase><skipped/></testcase></testsuite>',
    '<testsuite><testcase><failure/></testcase></testsuite>',
    '<testsuite errors="1"><testcase/></testsuite>',
    '<testsuite><testcase><error/></testcase></testsuite>',
    '<testsuite><testcase></testsuite>',
    '<testsuites failures="1"><testsuite><testcase/></testsuite></testsuites>',
    '<testsuites errors="1"><testsuite><testcase/></testsuite></testsuites>',
    '<testsuites skipped="1"><testsuite><testcase/></testsuite></testsuites>',
  ])('does not turn missing, malformed, failed or skipped JUnit into pass', (xml) => {
    expect(() => assertJunitPass(xml)).toThrow();
  });

  it('checks dismiss and reopen, not just the presence of a review modal', () => {
    const flow = fs.readFileSync(path.join(FLOW_ROOT, 'quest-reviews.yaml'), 'utf8');
    expect(flow.match(/id: "quest-reviews-close"/g)).toHaveLength(2);
    expect(flow).toMatch(/assertNotVisible:\s+id: "quest-reviews-modal"/);
    expect(flow).toMatch(/assertNotVisible:\s+id: "quest-reviews-error"/);
  });
});

describe('native device exclusivity and bounded subprocesses', () => {
  let root: string;
  beforeEach(() => {
    root = makeTempDir('native-e2e-unit-', { root: path.resolve('.codex-temp') });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('creates fixtures in a selected ignored root and bounds fixture CLI execution', () => {
    const selectedRoot = path.join(root, 'nested');
    const fixture = makeTempDir('fixture-', { root: selectedRoot });
    expect(path.dirname(fixture)).toBe(selectedRoot);
    expect(fs.statSync(fixture).isDirectory()).toBe(true);
    const started = Date.now();
    const result = runCli(process.execPath, ['-e', 'setInterval(() => {}, 10000)'], { timeoutMs: 100 });
    expect(result.status).not.toBe(0);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('blocks the same device and allows a distinct target; release is idempotent', () => {
    const release = acquireDeviceLock({ device: 'target-one', root });
    expect(() => acquireDeviceLock({ device: 'target-one', root })).toThrow(/reserved/);
    const other = acquireDeviceLock({ device: 'target-two', root });
    other();
    release();
    release();
    acquireDeviceLock({ device: 'target-one', root })();
    const locks = fs.readdirSync(path.join(root, '.codex-temp/ops'));
    expect(locks).toHaveLength(0);
  });

  it('does not delete a replaced owner or persist the private device identifier', () => {
    const release = acquireDeviceLock({ device: 'private-device-id', root });
    const dir = path.join(root, '.codex-temp/ops');
    const lock = path.join(dir, fs.readdirSync(dir)[0]);
    expect(fs.readFileSync(lock, 'utf8')).not.toContain('private-device-id');
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, token: 'replacement' }));
    release();
    expect(fs.existsSync(lock)).toBe(true);
  });

  it('detects an unwrapped device operation, excluding the current command and ancestors', () => {
    const processes = '10 1 maestro --device target test flow.yaml\n20 10 node native-e2e.js --device target\n30 1 xcodebuild test -destination id=target\n40 1 maestro --device other test flow.yaml';
    expect(findConflictingNativeProcesses('target', processes, 20).map((row: any) => row.pid)).toEqual([30]);
  });

  it('preserves non-zero exit status without retry', async () => {
    const logPath = path.join(root, 'subprocess.log');
    const result = await runBounded(process.execPath, ['-e', 'process.stderr.write("fixture failure"); process.exit(7)'], { timeoutMs: 3000, logPath });
    expect(result.code).toBe(7);
    expect(fs.readFileSync(logPath, 'utf8')).toBe('fixture failure');
  });

  it('physical helper requires an explicit target and preserves devicectl failures', () => {
    const helper = path.resolve('scripts/ios-device-qa.sh');
    const run = (script: string) => runCli('bash', ['-c', 'source "$1"; ' + script, 'fixture', helper], {
      env: { IOS_QA_OUT: root, IOS_QA_DEVICE: '' }, timeoutMs: 10000,
    });
    expect(run('xcrun() { return 0; }; Launch').status).toBe(1);
    expect(run('UseDevice fixture; xcrun() { return 42; }; Launch').status).toBe(42);
    for (const command of ['AppInfo', 'Pid', 'Kill']) {
      expect(run(`UseDevice fixture; xcrun() { return 42; }; ${command}`).status).toBe(42);
    }
    expect(run('UseDevice fixture; xcrun() { return 0; }; Kill').status).toBe(0);
    expect(run('UseDevice fixture; xcrun() { echo "passcodeRequired: true"; }; Unlocked').status).toBe(1);
    expect(run('UseDevice fixture; xcrun() { echo "passcodeRequired: false"; }; Unlocked').status).toBe(0);
    expect(run('UseDevice fixture; xcrun() { echo "unrecognized format"; }; Unlocked').status).toBe(1);
    expect(run('UseDevice fixture; xcrun() { echo "passcodeRequired: falsehood"; }; Unlocked').status).toBe(1);
    expect(run('UseDevice fixture; xcrun() { echo "passcodeRequired: false"; echo "passcodeRequired: true"; }; Unlocked').status).toBe(1);
  });

  it.each(['nonzero', 'missing-junit'])('stops the real CLI after the first failed flow: %s', (mode) => {
    // Fake tools exercise orchestration, not a device. Never retain synthetic
    // pass evidence or call the machine's actual adb/Maestro executables.
    const calls = path.join(root, 'maestro-calls.jsonl');
    const adb = path.join(root, 'adb');
    const maestro = path.join(root, 'maestro');
    fs.writeFileSync(adb, '#!/usr/bin/env node\nprocess.stdout.write(process.argv.includes("get-state") ? "device\\n" : "versionCode=22 versionName=1.0.0\\n");\n', { mode: 0o700 });
    fs.writeFileSync(maestro, `#!/usr/bin/env node
const fs = require('node:fs');
if (process.argv.includes('--version')) { process.stdout.write('fixture-maestro'); process.exit(0); }
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + '\\n');
process.exit(${mode === 'nonzero' ? 9 : 0});
`, { mode: 0o700 });
    const result = runCli(process.execPath, [path.resolve('scripts/native-e2e.js'),
      '--suite', 'quest-regression', '--platform', 'android', '--device', path.basename(root),
      '--account', 'guest', '--locale', 'ru', '--version', '1.0.0', '--build', '22',
      '--api-url', 'http://localhost:8000',
    ], {
      env: { PATH: `${root}${path.delimiter}${process.env.PATH}`, MAESTRO_BIN: maestro },
      timeoutMs: 10000,
    });
    const reportPath = result.stdout.match(/native-e2e fail: (.+report\.json)/)?.[1];
    try {
      expect(result.status).toBe(1);
      expect(reportPath).toBeDefined();
      const report = JSON.parse(fs.readFileSync(reportPath!, 'utf8'));
      expect(report).toMatchObject({ status: 'fail', recordingReady: false, completeReviewScenes: [] });
      expect(report.flows).toHaveLength(1);
      expect(report.flows[0]).toMatchObject({ file: 'quest-reviews.yaml', status: 'fail' });
      expect(fs.readFileSync(calls, 'utf8').trim().split('\n')).toHaveLength(1);
    } finally {
      if (reportPath?.startsWith(path.resolve('.codex-temp/native-e2e') + path.sep)) fs.rmSync(path.dirname(reportPath), { recursive: true, force: true });
    }
  });

  it('bounds a hung subprocess and supports cancellation before spawning', async () => {
    const hung = await runBounded(process.execPath, ['-e', 'setInterval(() => {}, 10000)'], { timeoutMs: 100 });
    expect(hung).toMatchObject({ code: 124, timedOut: true });
    const abort = new AbortController();
    abort.abort();
    expect(await runBounded('not-a-real-command', [], { timeoutMs: 100, signal: abort.signal })).toMatchObject({ code: 130, cancelled: true });
  });

  it('kills its remaining process group when the main child closes early', async () => {
    const pidPath = path.join(root, 'descendant.pid');
    const descendant = 'process.on("SIGTERM",()=>{}); setInterval(()=>{},10000)';
    const script = `const fs=require('node:fs'); const {spawn}=require('node:child_process'); const p=spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'}); fs.writeFileSync(${JSON.stringify(pidPath)},String(p.pid)); p.unref();`;
    const kill = jest.spyOn(process, 'kill');
    try {
      const result = await runBounded(process.execPath, ['-e', script], { timeoutMs: 3000 });
      expect(result.code).toBe(0);
      expect(kill.mock.calls.some(([pid, signal]) => pid < 0 && signal === 'SIGKILL')).toBe(true);
    } finally {
      kill.mockRestore();
      if (fs.existsSync(pidPath)) {
        try { process.kill(Number(fs.readFileSync(pidPath, 'utf8')), 'SIGKILL'); } catch { /* Already killed with its group. */ }
      }
    }
  });
});
