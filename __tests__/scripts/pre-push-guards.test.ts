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
  buildGuardInvocation,
  findDocContractTests,
  formatBundleProbeWarning,
} = require('@/scripts/run-pre-push-guards');

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

  it('prints the rule only when there is something to probe', () => {
    expect(formatBundleProbeWarning([])).toEqual([]);
    const lines = formatBundleProbeWarning([{ file: 'utils/tripPlanLinks.ts', added: 2 }]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('utils/tripPlanLinks.ts (+2)');
    expect(lines[1]).toContain(BUNDLE_PROBE_RULE.command);
  });
});
