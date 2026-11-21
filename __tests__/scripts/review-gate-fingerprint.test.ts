import fs from 'node:fs';
import path from 'node:path';
import { makeTempDir, removeDir, runCli, runNodeCli } from './cli-test-utils';

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

const git = (cwd: string, ...args: string[]): string => {
  const result = runCli('git', args, {
    cwd,
    timeoutMs: 10000,
    env: {
      GIT_AUTHOR_NAME: 'gate-test',
      GIT_AUTHOR_EMAIL: 'gate@test.local',
      GIT_COMMITTER_NAME: 'gate-test',
      GIT_COMMITTER_EMAIL: 'gate@test.local',
    },
  });
  if (result.status !== 0) throw new Error(`Fixture git ${args[0]} failed (${result.status}): ${result.stderr}`);
  return result.stdout;
};

const write = (root: string, rel: string, content: string) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

type Verdict = {
  base: string;
  scope: Record<string, string>;
  scope_mode?: string;
  scope_dirs?: string[];
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

const verdictFile = (): string => path.join(work, '.codex-temp/review-gate', `${TASK_ID}.json`);

/** `record` с путями задачи (#3371); `verdict` — записанный файл, `null`, если запись отклонена. */
const recordWith = (
  ...extra: string[]
): { status: number; stderr: string; output: Record<string, unknown> | null; verdict: Verdict | null } => {
  const result = runNodeCli(
    [HOOK, 'record', '--task', String(TASK_ID), '--verdict', 'pass', '--findings', '0', ...extra],
    { CLAUDE_PROJECT_DIR: work },
  );
  return {
    status: result.status,
    stderr: result.stderr,
    output: result.status === 0 ? JSON.parse(result.stdout) : null,
    verdict: fs.existsSync(verdictFile()) ? JSON.parse(fs.readFileSync(verdictFile(), 'utf8')) : null,
  };
};

const show = (): { status: number; code: string; detail: string | null; outside?: string[] } => {
  const result = runNodeCli([HOOK, 'show', '--task', String(TASK_ID)], { CLAUDE_PROJECT_DIR: work });
  const parsed = JSON.parse(result.stdout);
  return { status: result.status, code: parsed.code, detail: parsed.detail, outside: parsed.outside_scope };
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

  // The cloned peer must follow main regardless of the machine's init.defaultBranch.
  git(sandbox, 'init', '-q', '--bare', '-b', 'main', origin);
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

/**
 * Scope по путям задачи (#3371, REVIEW-GATE-FINGERPRINT-FOREIGN-WORKTREE-001).
 *
 * Общий чекаут ведут несколько сессий. Отпечаток по всему дереву дважды блокировал перевод в
 * `testing` закоммиченного и запушенного поезда из-за незакоммиченных файлов соседней сессии
 * (#3351), а 21.11.2026 три записи вердикта подряд забрали в scope чужие untracked
 * `openspec/changes/*` и правку `docs/features/quest-qr-print-kit.md`.
 */
const TASK_PATHS = ['package.json', 'scripts/ai-assist/app.ts', '__tests__/scripts/ai-assist/app.test.ts'];

/** Соседняя сессия в том же дереве: правка tracked-файла и новый untracked-каталог. */
const makeForeignChanges = (): void => {
  fs.appendFileSync(path.join(work, 'docs/other.md'), 'foreign uncommitted edit\n');
  write(work, 'openspec/changes/foreign-change/proposal.md', '# foreign\n');
};

describe('review-gate fingerprint by task paths (#3371)', () => {
  it('keeps foreign uncommitted paths out of the scope and out of the verdict', () => {
    makeTaskChanges();
    makeForeignChanges();
    const { status, output, verdict } = recordWith('--paths', TASK_PATHS.join(','));

    expect(status).toBe(0);
    expect(verdict?.scope_mode).toBe('paths');
    expect(Object.keys(verdict?.scope ?? {}).sort()).toEqual([...TASK_PATHS].sort());
    // Чужое не спрятано: запись называет, что осталось за scope.
    expect(output).toMatchObject({ scope_mode: 'paths', paths: 3 });
    expect(output?.outside_scope).toEqual(['docs/other.md', 'openspec/changes/foreign-change/proposal.md']);
    expectOpen();

    // Сосед продолжает работать после ревью: новый файл и новая правка вердикт не ломают.
    write(work, 'openspec/changes/foreign-change/tasks.md', '- [ ] later\n');
    fs.appendFileSync(path.join(work, 'docs/other.md'), 'second foreign edit\n');
    write(work, 'scripts/foreign-tool.js', 'module.exports = 1;\n');
    const state = show();
    expect(state).toMatchObject({ status: 0, code: 'pass' });
    expect(state.outside).toEqual([
      'docs/other.md',
      'openspec/changes/foreign-change/proposal.md',
      'openspec/changes/foreign-change/tasks.md',
      'scripts/foreign-tool.js',
    ]);
  });

  it('warns about an uncommitted neighbour of a task file left out of the list', () => {
    makeTaskChanges();
    makeForeignChanges();
    write(work, 'scripts/ai-assist/forgotten.ts', 'export const forgotten = 1;\n');
    const { status, stderr } = recordWith('--paths', TASK_PATHS.join(','));

    expect(status).toBe(0);
    expect(stderr).toContain('scripts/ai-assist/forgotten.ts');
    // Корень и чужой каталог соседями не считаются.
    expect(stderr).not.toContain('docs/other.md');
    expect(stderr).not.toContain('openspec/');
  });

  it('goes stale when a task file changes after the verdict, foreign files or not', () => {
    makeTaskChanges();
    makeForeignChanges();
    recordWith('--paths', TASK_PATHS.join(','));

    fs.appendFileSync(path.join(work, 'scripts/ai-assist/app.ts'), 'export const late = 2;\n');
    expectStale('scripts/ai-assist/app.ts');
  });

  it('survives git add → commit → push of the task paths while foreign files stay uncommitted', () => {
    makeTaskChanges();
    makeForeignChanges();
    const { verdict } = recordWith('--paths', TASK_PATHS.join(','));

    git(work, 'add', ...TASK_PATHS);
    git(work, 'commit', '-qm', 'feat: task (#2456)');
    git(work, 'push', '-q', 'origin', 'main');
    expectOpen();
    expect(git(work, 'status', '--porcelain')).toContain('docs/other.md');

    const after = runNodeCli([HOOK, 'show', '--task', String(TASK_ID)], { CLAUDE_PROJECT_DIR: work });
    expect(JSON.parse(after.stdout).verdict.fingerprint).toBe(verdict?.fingerprint);
  });

  it('reads the same list from --paths-file, several --paths values and a comma list', () => {
    makeTaskChanges();
    makeForeignChanges();
    const byList = recordWith('--paths', TASK_PATHS.join(',')).verdict;

    write(work, '.codex-temp/paths.txt', ['# пути задачи', '', ...TASK_PATHS.map((file) => `./${file}`), ''].join('\n'));
    const byFile = recordWith('--paths-file', '.codex-temp/paths.txt').verdict;
    const byValues = recordWith('--paths', ...TASK_PATHS, '--note', 'checked').verdict;

    expect(byFile?.scope).toEqual(byList?.scope);
    expect(byFile?.fingerprint).toBe(byList?.fingerprint);
    expect(byValues?.fingerprint).toBe(byList?.fingerprint);
  });

  it('expands a task directory and goes stale on a new file inside it, not outside it', () => {
    makeTaskChanges();
    makeForeignChanges();
    const { verdict } = recordWith('--paths', 'package.json,scripts/ai-assist/,__tests__/scripts/ai-assist');

    expect(Object.keys(verdict?.scope ?? {}).sort()).toEqual([...TASK_PATHS].sort());
    expect(verdict?.scope_dirs).toEqual(['__tests__/scripts/ai-assist', 'scripts/ai-assist']);
    expectOpen();

    // Соседний каталог с тем же префиксом имени — не каталог задачи.
    write(work, 'scripts/ai-assist-eval/other.ts', 'export const other = 1;\n');
    expectOpen();

    write(work, 'scripts/ai-assist/extra.ts', 'export const extra = 1;\n');
    expectStale('scripts/ai-assist/extra.ts');
  });

  it('tracks a file the task deletes', () => {
    fs.rmSync(path.join(work, 'docs/other.md'));
    const { status, verdict } = recordWith('--paths', 'docs/other.md');

    expect(status).toBe(0);
    expect(verdict?.scope).toEqual({ 'docs/other.md': 'deleted' });
    expectOpen();

    write(work, 'docs/other.md', 'other\n');
    expectStale('docs/other.md');
  });

  it('refuses a list that would fingerprint nothing or something outside the repository', () => {
    makeTaskChanges();

    const typo = recordWith('--paths', 'scripts/ai-assist/app.tsx');
    expect(typo.status).toBe(2);
    expect(typo.stderr).toContain('путь задачи не найден');
    expect(typo.stderr).toContain('scripts/ai-assist/app.tsx');

    const outside = recordWith('--paths', '../peer/package.json');
    expect(outside.status).toBe(2);
    expect(outside.stderr).toContain('вне репозитория');

    const untouchedDir = recordWith('--paths', 'docs');
    expect(untouchedDir.status).toBe(2);
    expect(untouchedDir.stderr).toContain('в каталоге нет изменений');

    // Существующий, но нетронутый файл отпечатал бы «ничего» и пропустил непроверенный diff.
    const untouchedFile = recordWith('--paths', 'docs/other.md');
    expect(untouchedFile.status).toBe(2);
    expect(untouchedFile.stderr).toContain('ни один путь задачи не отличается от базиса');

    // Флаг без значения не откатывается молча к отпечатку по всему дереву.
    const bare = recordWith('--paths');
    expect(bare.status).toBe(2);
    expect(bare.stderr).toContain('--paths требует значение');
    const bareFile = recordWith('--paths-file', '--note', 'x');
    expect(bareFile.status).toBe(2);

    expect(fs.existsSync(verdictFile())).toBe(false);
  });

  it('keeps a record without --paths on the whole-tree scope, as before', () => {
    makeTaskChanges();
    makeForeignChanges();
    const verdict = record();

    expect(verdict.scope_mode).toBeUndefined();
    expect(verdict.scope_dirs).toBeUndefined();
    expect(Object.keys(verdict.scope).sort()).toEqual(
      [...TASK_PATHS, 'docs/other.md', 'openspec/changes/foreign-change/proposal.md'].sort(),
    );
    expectOpen();

    write(work, 'openspec/changes/foreign-change/tasks.md', '- [ ] later\n');
    expectStale('openspec/changes/foreign-change/tasks.md');
    // Отказ подсказывает выход: тот же вердикт, но по путям задачи.
    expect(show().detail).toContain('--paths-file');
  });

  it('keeps the Codex adapter mirror byte-identical to the hook', () => {
    const mirror = path.join(process.cwd(), '.codex/hooks/review-gate.mjs');
    expect(fs.readFileSync(mirror, 'utf8')).toBe(fs.readFileSync(HOOK, 'utf8'));
  });
});
