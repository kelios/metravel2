import fs from 'fs';
import path from 'path';
import { makeTempDir, removeDir, runNodeCli, writeTextFile } from './cli-test-utils';

/**
 * Единый список стражей до push (`scripts/pre-push-guards.js`, #3371,
 * REVIEW-GATE-LINT-COVERAGE-001).
 *
 * До карточки список жил в трёх местах — безусловные стражи `check:fast`, набор
 * роли `code-review-gate`, `npm run lint` — и расходился: коммит `4c8a9f7eb`
 * прошёл три прохода гейта и pre-push preflight, а в `main` ушёл красный
 * `guard:unimported-modules` (импорт словаря по шаблонной строке); тестовые
 * токены #3354 поймал только `governance:verify`. Тест держит два равенства:
 * список = `npm run lint` + `governance:verify`; preflight запускает ровно
 * список. Он сам входит в `test:governance`, то есть выполняется до push.
 * Красный страж роняет шаг preflight — `pre-push-guards-templated-import.test.ts`.
 */

const {
  STAGE_FAST,
  STAGE_PRE_PUSH,
  SOURCE_LINT,
  SOURCE_GOVERNANCE,
  SOURCE_TYPECHECK,
  PRE_PUSH_GUARDS,
  NOT_BEFORE_EVERY_PUSH,
  RELATED_TESTS_RULE,
  PREFLIGHT_SELECTIVE_TESTS_ENV,
  BUNDLE_PROBE_RULE,
  guardsForStage,
  guardSegment,
  parseScriptChain,
  isRuntimeSourcePath,
  findImportAdditions,
} = require('@/scripts/pre-push-guards');
const { CHECKS } = require('@/scripts/run-preflight-checks');
const {
  selectGuards,
  alreadyRunTests,
  describeRelatedFailure,
  parseArgs: parseRunnerArgs,
  buildGuardInvocation,
  findDocContractTests,
  formatBundleProbeWarning,
  formatGuardFailure,
  guardEnv,
  SKIPPED_EXIT_CODE,
} = require('@/scripts/run-pre-push-guards');
const { QUALITY_GATE_BUSY_EXIT_ENV, resolveQualityGateBusyExitCode } = require('@/scripts/quality-gate-lock');

type Guard = { id: string; script?: string; command?: string; stage: string; sources: string[]; why: string };

const repoRoot = process.cwd();
const readRepoFile = (relativePath: string): string => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const packageScripts: Record<string, string> = JSON.parse(readRepoFile('package.json')).scripts;
const guards = PRE_PUSH_GUARDS as Guard[];
const ids = (list: Guard[]): string[] => list.map((item) => item.id);

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) removeDir(root);
});

describe('pre-push guard list ↔ package.json', () => {
  it.each([
    ['lint', SOURCE_LINT],
    ['governance:verify', SOURCE_GOVERNANCE],
  ])('covers every command of `npm run %s`, and nothing claims that source falsely', (scriptName, source) => {
    const chain = parseScriptChain(packageScripts[scriptName]);
    expect(chain.length).toBeGreaterThan(3);

    const claimed = guards.filter((item) => item.sources.includes(source)).map(guardSegment);
    // Страж, дописанный в `npm run lint` мимо списка, до push не выполнится —
    // ровно так `guard:unimported-modules` и `guard:env-secrets` ушли в main красными.
    expect(chain.filter((segment: string) => !claimed.includes(segment))).toEqual([]);
    expect(claimed.filter((segment: string) => !chain.includes(segment))).toEqual([]);
  });

  it('names only existing npm scripts, once each, with a stage and a reason', () => {
    expect(new Set(ids(guards)).size).toBe(guards.length);
    for (const item of guards) {
      expect([STAGE_FAST, STAGE_PRE_PUSH]).toContain(item.stage);
      expect(item.why.length).toBeGreaterThan(10);
      expect(item.sources.length).toBeGreaterThan(0);
      if (item.script) expect(typeof packageScripts[item.script]).toBe('string');
      else expect(item.command).toBe('eslint . --max-warnings=0');
    }
  });

  it('keeps the guards that already let red code into main', () => {
    const prePush = ids(guardsForStage(STAGE_PRE_PUSH));
    expect(prePush).toEqual(expect.arrayContaining(['guard:unimported-modules', 'guard:env-secrets', 'test:governance', 'eslint']));
    // `tsc` нет ни в одном из двух наборов: добавлен в список явно и запускается один раз.
    const typecheck = guards.filter((item) => item.id === 'typecheck');
    expect(typecheck).toEqual([expect.objectContaining({ stage: STAGE_PRE_PUSH, sources: [SOURCE_TYPECHECK] })]);
    expect(packageScripts.typecheck).toBe('tsc --noEmit');
  });

  it('records what is deliberately not run on every push, with the place where it does run', () => {
    expect(NOT_BEFORE_EVERY_PUSH.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining(['prod-build-probe', 'e2e-changed', 'test:run'])
    );
    for (const item of NOT_BEFORE_EVERY_PUSH) {
      expect(ids(guards)).not.toContain(item.id);
      for (const field of ['what', 'cost', 'why', 'runsAt']) expect(String(item[field]).length).toBeGreaterThan(5);
    }
    expect(BUNDLE_PROBE_RULE.command).toContain('DEPLOY=0');
    expect(BUNDLE_PROBE_RULE.command).toContain('scripts/deploy-prod.sh');
  });
});

describe('preflight ↔ guard list', () => {
  it('runs the pre-push stage as its own step, before e2e', () => {
    const names = CHECKS.map((check: { name: string }) => check.name);
    expect(names).toEqual(['fast-scope-checks', 'guard-file-complexity-changed', 'pre-push-guards', 'e2e-changed']);
    expect(CHECKS.find((check: { name: string }) => check.name === 'pre-push-guards').scriptPath).toBe(
      'scripts/run-pre-push-guards.js'
    );
  });

  it('splits the whole list between check:fast and the pre-push step without a gap or an overlap', () => {
    const fast = ids(guardsForStage(STAGE_FAST));
    const prePush = ids(selectGuards({ all: false }));
    expect([...fast, ...prePush].sort()).toEqual(ids(guards).sort());
    expect(fast.filter((id) => prePush.includes(id))).toEqual([]);
    expect(ids(selectGuards({ all: true }))).toEqual(ids(guards));

    // check:fast читает стадию из списка: рукописной копии цепочки в нём больше нет.
    const fastRunner = readRepoFile('scripts/run-fast-scope-checks.js');
    expect(fastRunner).toContain('guardsForStage(STAGE_FAST)');
    expect(fastRunner).not.toMatch(/runCommand\('npm', \['run', '/);
  });

  it('reports the same guards in the preflight dry-run plan, with and without e2e', () => {
    const dir = makeTempDir('pre-push-guards-plan-');
    temporaryRoots.push(dir);
    const changedFilesFile = path.join(dir, 'changed.txt');
    writeTextFile(changedFilesFile, 'docs/TESTING.md\n');

    const json = runNodeCli(['scripts/run-preflight-checks.js', '--changed-files-file', changedFilesFile, '--dry-run', '--json']);
    expect(json.status).toBe(0);
    const step = JSON.parse(json.stdout).checks.find((check: { name: string }) => check.name === 'pre-push-guards');
    expect(step.payload).toMatchObject({ contractVersion: 1, check: 'pre-push-guards', stage: STAGE_PRE_PUSH });
    expect(step.payload.guards).toEqual(ids(guardsForStage(STAGE_PRE_PUSH)));
    // Тем же шагом идут связанные с diff'ом Jest-тесты (#3468); план называет потолок.
    expect(step.payload.relatedTests).toMatchObject({
      rule: RELATED_TESTS_RULE.id,
      ceiling: RELATED_TESTS_RULE.ceiling,
      overCeiling: false,
      notRun: 0,
    });
    // `test:governance` — страж того же шага: его тесты выборка второй раз не запускает.
    expect(step.payload.relatedTests.selected).not.toContain('__tests__/scripts/pre-push-guards.test.ts');

    // Переход `review → testing` пушит с PREFLIGHT_SKIP_E2E=1: стражи при этом остаются.
    const skipE2e = runNodeCli(
      ['scripts/run-preflight-checks.js', '--changed-files-file', changedFilesFile, '--dry-run'],
      { PREFLIGHT_SKIP_E2E: '1' }
    );
    expect(skipE2e.status).toBe(0);
    expect(skipE2e.stdout).toContain('skipping e2e-changed');
    expect(skipE2e.stdout).toContain('pre-push-guards: stage=pre-push');
    expect(skipE2e.stdout).toContain('guard:unimported-modules');
    expect(skipE2e.stdout).toContain('guard:env-secrets');
  });

  it('invokes npm scripts by name and eslint over the whole repository', () => {
    expect(buildGuardInvocation({ script: 'guard:env-secrets' }).args).toEqual(['run', 'guard:env-secrets']);
    const eslint = buildGuardInvocation(guards.find((item) => item.id === 'eslint'));
    expect(eslint.command).toBe(process.execPath);
    expect(eslint.args.slice(1)).toEqual(['.', '--max-warnings=0']);
    expect(() => buildGuardInvocation({ command: 'rm -rf .' })).toThrow('unsupported guard command');
  });
});

describe('related Jest tests rule (#3468)', () => {
  it('names a ceiling, a worker limit and a full command that exists', () => {
    expect(Number.isInteger(RELATED_TESTS_RULE.ceiling)).toBe(true);
    expect(RELATED_TESTS_RULE.ceiling).toBeGreaterThan(100);
    expect(RELATED_TESTS_RULE.maxWorkers).toBeGreaterThan(0);
    // Команда ручного шага — тот же исполнитель, а не второй отбор.
    expect(packageScripts['test:related']).toBe('node scripts/run-pre-push-guards.js --related-only');
    expect(RELATED_TESTS_RULE.fullCommand).toBe('npm run test:related -- --full');
    expect(parseRunnerArgs(['--related-only', '--full'])).toMatchObject({ relatedOnly: true, full: true, all: false });
    expect(selectGuards({ all: false, relatedOnly: true })).toEqual([]);
  });

  it('replaces the graph only for data that has its own suite on disk', () => {
    expect(RELATED_TESTS_RULE.dataSuites.map((item: { prefix: string }) => item.prefix)).toEqual(['i18n/locales/']);
    for (const item of RELATED_TESTS_RULE.dataSuites) {
      expect(item.why.length).toBeGreaterThan(10);
      const suiteTests = fs.readdirSync(path.join(repoRoot, item.suite)).filter((name) => /\.test\.tsx?$/.test(name));
      expect(suiteTests.length).toBeGreaterThan(0);
    }
    // Набор локалей — тот же, что запускает `npm run test:i18n`.
    expect(packageScripts['test:i18n']).toContain(RELATED_TESTS_RULE.dataSuites[0].suite);
  });

  it('does not run twice what another step of the same run already ran', () => {
    const governance = guardsForStage(STAGE_PRE_PUSH);
    expect(alreadyRunTests({ guards: governance, changedFiles: [], env: {} })).toContain('__tests__/scripts/pre-push-guards.test.ts');
    expect(alreadyRunTests({ guards: [], changedFiles: ['components/travel/Card.tsx'], env: {} })).toEqual([]);
    // Внутри preflight выборочные наборы области уже выполнил `fast-scope-checks`.
    expect(
      alreadyRunTests({ guards: [], changedFiles: ['components/travel/Card.tsx'], env: { [PREFLIGHT_SELECTIVE_TESTS_ENV]: '1' } })
    ).toContain('__tests__/api/travels.test.ts');
    expect(readRepoFile('scripts/run-preflight-checks.js')).toContain("[PREFLIGHT_SELECTIVE_TESTS_ENV]: '1'");
  });

  it('names the red tests in the failure line of the step', () => {
    const line = formatGuardFailure('related tests', 1, describeRelatedFailure(['__tests__/app/tripCreateScreen.authGate.test.tsx']));
    expect(line).toContain('pre-push-guards: FAILED related tests (exit 1)');
    expect(line).toContain('__tests__/app/tripCreateScreen.authGate.test.tsx');
    expect(describeRelatedFailure([])).toContain('не отдав результат');
    // Занятый lock и для связанных тестов — SKIPPED, не PASS.
    expect(formatGuardFailure('related tests', SKIPPED_EXIT_CODE, '')).toContain('pre-push-guards: SKIPPED related tests');
  });
});

describe('prod build probe warning', () => {
  it('counts only runtime modules of the web bundle', () => {
    expect(isRuntimeSourcePath('utils/tripPlanLinks.ts')).toBe(true);
    expect(isRuntimeSourcePath('components\\travel\\Card.tsx')).toBe(true);
    expect(isRuntimeSourcePath('app/(tabs)/index.tsx')).toBe(true);
    for (const file of [
      'scripts/pre-push-guards.js',
      '__tests__/utils/tripPlanLinks.test.ts',
      'utils/tripPlanLinks.test.ts',
      'components/map/Map.native.tsx',
      'types/travel.d.ts',
      'docs/TESTING.md',
      'i18n/locales/pl/static/map_01.ts',
    ]) {
      expect(isRuntimeSourcePath(file)).toBe(false);
    }
  });

  it('finds added import lines and ignores removals, type imports, comments and non-runtime files', () => {
    const diff = [
      'diff --git a/utils/tripPlanLinks.ts b/utils/tripPlanLinks.ts',
      '--- a/utils/tripPlanLinks.ts',
      '+++ b/utils/tripPlanLinks.ts',
      '@@ -1,0 +2,4 @@',
      "+import { readDraft } from '@/stores/tripDraftStore';",
      "+import type { TripDraft } from '@/types/trip';",
      "+// import { unused } from '@/utils/unused';",
      "+const lazy = () => import('@/components/trips/Heavy');",
      "-import { old } from '@/utils/old';",
      '+const answer = 42;',
      'diff --git a/hooks/useThing.ts b/hooks/useThing.ts',
      '--- a/hooks/useThing.ts',
      '+++ b/hooks/useThing.ts',
      '@@ -3,0 +4,2 @@',
      '+  useEffect,',
      "+} from 'react';",
      'diff --git a/scripts/tool.js b/scripts/tool.js',
      '--- a/scripts/tool.js',
      '+++ b/scripts/tool.js',
      '@@ -1,0 +2 @@',
      "+const fs = require('fs');",
      'diff --git a/utils/gone.ts b/utils/gone.ts',
      '--- a/utils/gone.ts',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      "-import x from './x';",
    ].join('\n');

    expect(findImportAdditions(diff)).toEqual([
      { file: 'hooks/useThing.ts', added: 1 },
      { file: 'utils/tripPlanLinks.ts', added: 2 },
    ]);
    expect(findImportAdditions('')).toEqual([]);
  });

  it('selects the Jest contract of a changed document by its quoted path (781314569, #3357)', () => {
    // Полный sha256 в документе ассистента краснил тест манифеста модели, а
    // выборочные наборы preflight подбирают тесты только по коду.
    expect(findDocContractTests(['docs/features/ai-assistant.md'])).toContain(
      '__tests__/scripts/metravel-llm-manifest.test.ts'
    );
    expect(findDocContractTests(['utils/tripPlanLinks.ts', '__tests__/scripts/x.json'])).toEqual([]);

    const root = makeTempDir('pre-push-doc-contract-');
    temporaryRoots.push(root);
    writeTextFile(path.join(root, '__tests__/a/reads.test.ts'), "const DOC = 'docs/x.md';\n");
    writeTextFile(path.join(root, '__tests__/mentions.test.ts'), '// правило — `docs/x.md`\n');
    writeTextFile(path.join(root, '__tests__/helper.ts'), "const DOC = 'docs/x.md';\n");
    expect(findDocContractTests(['docs/x.md'], root)).toEqual(['__tests__/a/reads.test.ts']);
  });

  it('reports a step skipped on a busy quality-gate lock as SKIPPED with a non-zero code, never as PASS', () => {
    expect(SKIPPED_EXIT_CODE).toBeGreaterThan(0);
    const skipped = formatGuardFailure('test:governance', SKIPPED_EXIT_CODE, 'Jest-контракты governance');
    expect(skipped).toContain('pre-push-guards: SKIPPED test:governance');
    expect(skipped).toContain('это не PASS');
    expect(skipped).not.toContain('FAILED');

    const failed = formatGuardFailure('typecheck', 2, 'tsc --noEmit');
    expect(failed).toBe('pre-push-guards: FAILED typecheck (exit 2) — tsc --noEmit');

    // Шаг получает код пропуска в окружении, и Jest при занятом lock выходит именно им
    // (сам выход — `quality-gate-lock.test.ts`).
    expect(guardEnv()[QUALITY_GATE_BUSY_EXIT_ENV]).toBe(String(SKIPPED_EXIT_CODE));
    // Управляющие переменные preflight стражам и связанным тестам не передаются.
    const saved = { skip: process.env.PREFLIGHT_SKIP_E2E, selective: process.env[PREFLIGHT_SELECTIVE_TESTS_ENV] };
    process.env.PREFLIGHT_SKIP_E2E = '1';
    process.env[PREFLIGHT_SELECTIVE_TESTS_ENV] = '1';
    try {
      expect(guardEnv()).not.toHaveProperty('PREFLIGHT_SKIP_E2E');
      expect(guardEnv()).not.toHaveProperty(PREFLIGHT_SELECTIVE_TESTS_ENV);
    } finally {
      if (saved.skip === undefined) delete process.env.PREFLIGHT_SKIP_E2E;
      else process.env.PREFLIGHT_SKIP_E2E = saved.skip;
      if (saved.selective === undefined) delete process.env[PREFLIGHT_SELECTIVE_TESTS_ENV];
      else process.env[PREFLIGHT_SELECTIVE_TESTS_ENV] = saved.selective;
    }
    expect(resolveQualityGateBusyExitCode(guardEnv())).toBe(SKIPPED_EXIT_CODE);
  });

  it('prints the rule only when there is something to probe', () => {
    expect(formatBundleProbeWarning([])).toEqual([]);
    const lines = formatBundleProbeWarning([{ file: 'utils/tripPlanLinks.ts', added: 2 }]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('utils/tripPlanLinks.ts (+2)');
    expect(lines[1]).toContain(BUNDLE_PROBE_RULE.command);
  });
});
