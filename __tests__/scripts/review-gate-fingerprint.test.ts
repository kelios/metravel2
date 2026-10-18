import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeTempDir, removeDir, runNodeCli } from './cli-test-utils';

/**
 * Отпечаток гейта `review → testing` (`.claude/hooks/review-gate.mjs`).
 *
 * Контракт: вердикт `pass` переживает всё, что обязано случиться между ревью и `testing`
 * (`git add` → `commit` → `push origin main`, `git pull --ff-only` чужих коммитов), и ломается
 * от любой правки проверенного содержимого или нового незакоммиченного файла вне scope.
 *
 * Заведён после #2456 (18.10.2026): HEAD отстал от `origin/main` на два чужих коммита, базис
 * вердикта закрепился как `origin/main`, в отпечаток попали «обратные» чужие правки, и
 * последующий `git pull --ff-only` отбил `testing` как «код изменился после ревью» без единой
 * правки задачи. Хук гоняется как процесс на временном git-репо с bare-origin.
 */

const HOOK = path.join(process.cwd(), '.claude/hooks/review-gate.mjs');
const TASK_ID = 2456;

let sandbox: string;
let work: string;
let peer: string;

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'gate-test',
      GIT_AUTHOR_EMAIL: 'gate@test.local',
      GIT_COMMITTER_NAME: 'gate-test',
      GIT_COMMITTER_EMAIL: 'gate@test.local',
    },
  });

const write = (root: string, rel: string, content: string) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

type Verdict = {
  base: string;
  scope: Record<string, string>;
  fingerprint: string;
  verdict: string;
};

const record = (): Verdict => {
  const result = runNodeCli(
    [HOOK, 'record', '--task', String(TASK_ID), '--verdict', 'pass', '--findings', '0'],
    { CLAUDE_PROJECT_DIR: work },
  );
  expect(result.status).toBe(0);
  return JSON.parse(fs.readFileSync(path.join(work, '.codex-temp/review-gate', `${TASK_ID}.json`), 'utf8'));
};

const show = (): { status: number; code: string; detail: string | null } => {
  const result = runNodeCli([HOOK, 'show', '--task', String(TASK_ID)], { CLAUDE_PROJECT_DIR: work });
  const parsed = JSON.parse(result.stdout);
  return { status: result.status, code: parsed.code, detail: parsed.detail };
};

const expectOpen = (): void => {
  const state = show();
  expect(state).toMatchObject({ status: 0, code: 'pass' });
};

const expectStale = (detailPart: string): void => {
  const state = show();
  expect(state.status).toBe(1);
  expect(state.code).toBe('stale');
  expect(state.detail).toContain(detailPart);
};

/** Чужой коммит в `origin/main` из соседнего клона — HEAD рабочего чекаута отстаёт. */
const pushUpstreamChange = (): void => {
  fs.appendFileSync(path.join(peer, 'docs/other.md'), 'upstream edit\n');
  git(peer, 'commit', '-qam', 'docs: upstream edit from another session');
  git(peer, 'push', '-q', 'origin', 'main');
  git(work, 'fetch', '-q', 'origin');
};

beforeEach(() => {
  sandbox = makeTempDir('metravel-review-gate-');
  const origin = path.join(sandbox, 'origin.git');
  work = path.join(sandbox, 'work');
  peer = path.join(sandbox, 'peer');

  git(sandbox, 'init', '-q', '--bare', origin);
  git(sandbox, 'init', '-q', '-b', 'main', work);
  write(work, '.gitignore', '.codex-temp*\n');
  write(work, 'package.json', '{ "name": "fixture" }\n');
  write(work, 'docs/other.md', 'other\n');
  git(work, 'add', '-A');
  git(work, 'commit', '-qm', 'base');
  git(work, 'remote', 'add', 'origin', origin);
  git(work, 'push', '-q', 'origin', 'main');
  git(sandbox, 'clone', '-q', origin, peer);
});

afterEach(() => {
  removeDir(sandbox);
});

/** Типичная задача: правка tracked-файла плюс новые untracked-файлы в новых каталогах. */
const makeTaskChanges = (): void => {
  fs.appendFileSync(path.join(work, 'package.json'), '// task\n');
  write(work, 'scripts/ai-assist/app.ts', 'export const app = 1;\n');
  write(work, '__tests__/scripts/ai-assist/app.test.ts', 'test("x", () => {});\n');
};

describe('review-gate fingerprint', () => {
  it('records untracked files in scope and survives git add → commit → push of the same content', () => {
    makeTaskChanges();
    const verdict = record();

    expect(Object.keys(verdict.scope).sort()).toEqual([
      '__tests__/scripts/ai-assist/app.test.ts',
      'package.json',
      'scripts/ai-assist/app.ts',
    ]);
    expect(verdict.base).toBe(git(work, 'rev-parse', 'HEAD').trim());
    expectOpen();

    git(work, 'add', 'package.json', 'scripts/ai-assist', '__tests__/scripts/ai-assist');
    expectOpen();
    git(work, 'commit', '-qm', 'feat: task (#2456)');
    expectOpen();
    git(work, 'push', '-q', 'origin', 'main');
    expectOpen();

    const after = runNodeCli([HOOK, 'show', '--task', String(TASK_ID)], { CLAUDE_PROJECT_DIR: work });
    expect(JSON.parse(after.stdout).verdict.fingerprint).toBe(verdict.fingerprint);
  });

  it('survives git pull --ff-only of unrelated upstream commits when HEAD was behind at record time (#2456)', () => {
    pushUpstreamChange();
    makeTaskChanges();
    const verdict = record();

    // Базис — merge-base, то есть отставший HEAD, а не origin/main с чужой правкой docs/other.md.
    expect(verdict.base).toBe(git(work, 'rev-parse', 'HEAD').trim());
    expect(verdict.scope).not.toHaveProperty('docs/other.md');

    git(work, 'pull', '-q', '--ff-only', 'origin', 'main');
    expectOpen();

    git(work, 'add', 'package.json', 'scripts/ai-assist', '__tests__/scripts/ai-assist');
    git(work, 'commit', '-qm', 'feat: task (#2456)');
    git(work, 'push', '-q', 'origin', 'main');
    expectOpen();
  });

  it('goes stale when reviewed content changes after the verdict, before or after commit', () => {
    makeTaskChanges();
    record();

    fs.appendFileSync(path.join(work, 'scripts/ai-assist/app.ts'), 'export const late = 2;\n');
    expectStale('scripts/ai-assist/app.ts');

    git(work, 'add', 'package.json', 'scripts/ai-assist', '__tests__/scripts/ai-assist');
    git(work, 'commit', '-qm', 'feat: task with late edit (#2456)');
    expectStale('scripts/ai-assist/app.ts');
  });

  it('goes stale when a reviewed file is deleted or reverted after the verdict', () => {
    makeTaskChanges();
    record();

    fs.rmSync(path.join(work, '__tests__/scripts/ai-assist/app.test.ts'));
    expectStale('__tests__/scripts/ai-assist/app.test.ts');

    write(work, '__tests__/scripts/ai-assist/app.test.ts', 'test("x", () => {});\n');
    expectOpen();

    git(work, 'checkout', '-q', '--', 'package.json');
    expectStale('package.json');
  });

  it('goes stale on a new uncommitted file outside the reviewed scope', () => {
    makeTaskChanges();
    record();

    write(work, 'scripts/ai-assist/extra.ts', 'export const extra = 1;\n');
    expectStale('scripts/ai-assist/extra.ts');

    fs.rmSync(path.join(work, 'scripts/ai-assist/extra.ts'));
    expectOpen();

    fs.appendFileSync(path.join(work, 'docs/other.md'), 'uncommitted edit outside scope\n');
    expectStale('docs/other.md');
  });

  it('keeps evaluating pre-scope verdicts by the current diff against the recorded base', () => {
    makeTaskChanges();
    const verdict = record();
    const file = path.join(work, '.codex-temp/review-gate', `${TASK_ID}.json`);
    const legacy = { ...verdict } as Partial<Verdict>;
    delete legacy.scope;
    fs.writeFileSync(file, `${JSON.stringify(legacy, null, 2)}\n`);

    expectOpen();
    fs.appendFileSync(path.join(work, 'scripts/ai-assist/app.ts'), 'export const late = 2;\n');
    expectStale('отпечаток');
  });
});
