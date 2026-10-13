import fs from 'fs';
import path from 'path';
import { runCli, writeTextFile, removeDir } from './cli-test-utils';

const repositoryRoot = process.cwd();
const hook = path.join(repositoryRoot, 'githooks/pre-commit');
const resolver = path.join(repositoryRoot, 'scripts/run-local-selective-checks.js');
const fastRunner = path.join(repositoryRoot, 'scripts/run-fast-scope-checks.js');

describe('pre-commit scope isolation', () => {
  let fixture: string;

  const git = (...args: string[]) => {
    const result = runCli('git', args, { cwd: fixture });
    expect(result.status).toBe(0);
    return result;
  };

  const runHook = (exitCode = 0, runFast = false) => runCli('sh', [hook], {
    cwd: fixture,
    env: {
      PATH: `${path.join(fixture, 'bin')}${path.delimiter}${process.env.PATH}`,
      HOOK_TEST_EXIT_CODE: String(exitCode),
      HOOK_TEST_RUN_FAST: String(runFast),
    },
  });

  const invocation = () => JSON.parse(fs.readFileSync(path.join(fixture, 'invocation.json'), 'utf8'));
  const expectCleanup = () => expect(fs.readdirSync(path.join(fixture, '.codex-temp/ops'))).toEqual([]);

  beforeEach(() => {
    // Keep fixture repositories and hook manifests inside ignored workspace storage.
    const parent = path.join(repositoryRoot, '.codex-temp/ops');
    fs.mkdirSync(parent, { recursive: true });
    fixture = path.join(parent, `pre-commit-test-${process.pid}-${Math.random().toString(16).slice(2)}`);
    fs.mkdirSync(fixture);
    git('init', '-q');
    git('config', 'user.name', 'Hook fixture');
    git('config', 'user.email', 'hook@example.invalid');
    writeTextFile(path.join(fixture, '.gitignore'), '.codex-temp/\nbin/\ninvocation.json\n');
    writeTextFile(path.join(fixture, 'eslint.config.js'), 'module.exports = [{ignores: []}];\n');
    for (const file of ['owned.ts', 'foreign.ts', 'deleted.ts', 'old name.ts']) {
      writeTextFile(path.join(fixture, file), 'before\n');
    }
    git('add', '.');
    git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture baseline');

    // Observe the real hook command and use the production manifest resolver.
    // The standard check:fast runner owns selective checks and global guards.
    writeTextFile(path.join(fixture, 'bin/npm'), `#!/bin/sh
exec "${process.execPath}" "$0.js" "$@"
`);
    fs.chmodSync(path.join(fixture, 'bin/npm'), 0o755);
    writeTextFile(path.join(fixture, 'bin/npm.js'), `
const fs = require('fs');
const {resolveChangedFilesInput} = require(${JSON.stringify(resolver)});
const args = process.argv.slice(2);
if (args[1] !== 'check:fast') {
  fs.appendFileSync('guards.jsonl', JSON.stringify(args) + '\\n');
  process.exit(0);
}
const manifest = args[args.indexOf('--changed-files-file') + 1];
fs.writeFileSync('invocation.json', JSON.stringify({args, manifest, input: resolveChangedFilesInput({changedFilesFile: manifest})}));
if (process.env.HOOK_TEST_RUN_FAST === 'true') {
  const child = require('child_process').spawn(process.execPath, [${JSON.stringify(fastRunner)}, ...args.slice(3)], {stdio: 'inherit'});
  child.on('exit', (code) => process.exit(code === null ? 1 : code));
} else {
  process.exit(Number(process.env.HOOK_TEST_EXIT_CODE));
}
`);
  });

  afterEach(() => removeDir(fixture));

  it('runs check:fast with staged paths, excluding foreign unstaged and untracked edits', () => {
    writeTextFile(path.join(fixture, 'owned.ts'), 'staged\n');
    git('add', 'owned.ts');
    writeTextFile(path.join(fixture, 'foreign.ts'), 'unfinished\n');
    writeTextFile(path.join(fixture, 'untracked.ts'), 'unfinished\n');

    expect(runHook().status).toBe(0);
    const observed = invocation();
    expect(observed.args).toEqual(['run', 'check:fast', '--', '--changed-files-file', observed.manifest]);
    expect(observed.input).toEqual({ source: 'file', files: ['owned.ts'] });
    expect(observed.manifest).toMatch(/^\.codex-temp\/ops\/pre-commit\.[^/]+\/changed-files\.txt$/);
    expectCleanup();
  });

  it('preserves deletions and both rename paths along with spaces and Unicode', () => {
    git('rm', 'deleted.ts');
    git('mv', 'old name.ts', 'новое name.ts');
    expect(runHook().status).toBe(0);
    expect(invocation().input.files).toEqual(['deleted.ts', 'old name.ts', 'новое name.ts']);
    expectCleanup();
  });

  it('propagates check failures and removes the manifest', () => {
    writeTextFile(path.join(fixture, 'owned.ts'), 'staged\n');
    git('add', 'owned.ts');
    expect(runHook(7).status).toBe(7);
    expect(invocation().input.files).toEqual(['owned.ts']);
    expectCleanup();
  });

  it('still invokes the standard guard runner with an empty index scope', () => {
    writeTextFile(path.join(fixture, 'foreign.ts'), 'unfinished\n');
    fs.symlinkSync(path.join(repositoryRoot, 'scripts'), path.join(fixture, 'scripts'), 'dir');
    expect(runHook(0, true).status).toBe(0);
    expect(invocation().args.slice(0, 2)).toEqual(['run', 'check:fast']);
    expect(invocation().input).toEqual({ source: 'file', files: [] });
    const guards = fs.readFileSync(path.join(fixture, 'guards.jsonl'), 'utf8').trim()
      .split('\n').map((line) => JSON.parse(line)[1]);
    expect(guards).toEqual(expect.arrayContaining([
      'guard:root-scratch-artifacts', 'guard:external-links', 'guard:type-debt',
    ]));
    expectCleanup();
  });

  it('fails closed and cleans up when Git cannot enumerate the index', () => {
    fs.writeFileSync(path.join(fixture, '.git/index'), 'corrupt index');
    const result = runHook();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('index');
    expect(fs.existsSync(path.join(fixture, 'invocation.json'))).toBe(false);
    expectCleanup();
  });

  it.each(['ambiguous\nname.ts', 'ambiguous\rname.ts', ' leading.ts', 'trailing.ts '])(
    'fails closed and cleans up for an unrepresentable indexed name: %j', filename => {
      writeTextFile(path.join(fixture, filename), 'staged\n');
      git('add', filename);
      const result = runHook();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('staged filename cannot be represented');
      expect(fs.existsSync(path.join(fixture, 'invocation.json'))).toBe(false);
      expectCleanup();
    },
  );
});
