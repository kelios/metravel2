import path from 'path';
import { makeTempDir, removeDir, runCli, writeJsonFile, writeTextFile } from './cli-test-utils';

/**
 * Регрессия #3371 (REVIEW-GATE-LINT-COVERAGE-001): шаг `pre-push-guards`
 * preflight краснеет на `import()` по шаблонной строке — на том, что коммит
 * `4c8a9f7eb` унёс в `main` мимо трёх проходов гейта и pre-push preflight.
 *
 * Вынесено из `pre-push-guards.test.ts`: тот входит в `test:governance` и
 * выполняется на каждый push, а здесь два прогона шага по ~4 с.
 */

const { STAGE_PRE_PUSH, PRE_PUSH_GUARDS, guardsForStage } = require('@/scripts/pre-push-guards');

type Guard = { id: string; script?: string };

const repoRoot = process.cwd();
const RUNNER = path.join(repoRoot, 'scripts/run-pre-push-guards.js');
const UNIMPORTED_GUARD = path.join(repoRoot, 'scripts/guard-unimported-modules.js');
const guards = PRE_PUSH_GUARDS as Guard[];

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) removeDir(root);
});

/**
 * Временный проект, в котором шаг preflight гоняет настоящий граф
 * `guard:unimported-modules` по своим файлам; остальные стражи списка —
 * заглушки с кодом 0. Так видно именно то, что карточка требует: красный
 * `import()` по шаблонной строке останавливает шаг, явная таблица — нет.
 */
const fixtureProject = (askPathSource: string): string => {
  const root = makeTempDir('pre-push-guards-fixture-');
  temporaryRoots.push(root);
  const helper = path.join(root, '.tools', 'unimported-graph.cjs');
  writeTextFile(
    helper,
    `const { analyzeGraph } = require(${JSON.stringify(UNIMPORTED_GUARD)});
const graph = analyzeGraph(process.cwd());
if (graph.errors.length || graph.unreachable.length) {
  console.error(JSON.stringify({ errors: graph.errors, unreachable: graph.unreachable }));
  process.exit(1);
}
console.log('Unimported modules: PASS (fixture)');
`
  );
  const scripts = Object.fromEntries(
    guards.filter((item) => item.script).map((item) => [item.script, `node -e ""`])
  );
  scripts['guard:unimported-modules'] = `node ${JSON.stringify(helper)}`;
  writeJsonFile(path.join(root, 'package.json'), { name: 'pre-push-guards-fixture', private: true, scripts });
  writeJsonFile(path.join(root, 'tsconfig.json'), { compilerOptions: { paths: { '@/*': ['./*'] } } });
  writeTextFile(path.join(root, 'node_modules/eslint/bin/eslint.js'), 'process.exit(0);\n');
  writeTextFile(path.join(root, 'app/index.tsx'), 'export default function Route() { return null; }\n');
  writeTextFile(path.join(root, 'i18n/locales/ru/static/dict.ts'), 'export const dict = { ok: "ок" };\n');
  writeTextFile(path.join(root, 'scripts/eval/ask-path.mjs'), askPathSource);
  writeTextFile(path.join(root, 'changed.txt'), 'scripts/eval/ask-path.mjs\n');
  return root;
};

const runStep = (root: string) =>
  runCli(process.execPath, [RUNNER, '--changed-files-file', path.join(root, 'changed.txt')], { cwd: root });

describe('preflight step on a templated import() (#3371, incident 4c8a9f7eb)', () => {
  it('goes red on an import() built from a template string and names the guard', () => {
    const root = fixtureProject(
      'export async function loadShownTexts(locale) {\n' +
        '  return import(`../../i18n/locales/${locale}/static/dict.ts`);\n' +
        '}\n'
    );
    const result = runStep(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('opaque-loader');
    expect(result.stderr).toContain('scripts/eval/ask-path.mjs');
    expect(result.stderr).toContain('pre-push-guards: FAILED guard:unimported-modules');
    // Шаг останавливается на первом красном страже: до eslint дело не доходит.
    expect(result.stdout).not.toContain('pre-push-guards: PASS');
  }, 120_000);

  it('stays green when the same modules are listed explicitly', () => {
    const root = fixtureProject(
      "const SHOWN_TEXT_RESOURCES = { ru: () => import('../../i18n/locales/ru/static/dict.ts') };\n" +
        'export async function loadShownTexts(locale) {\n' +
        '  return SHOWN_TEXT_RESOURCES[locale]();\n' +
        '}\n'
    );
    const result = runStep(root);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`pre-push-guards: PASS (${guardsForStage(STAGE_PRE_PUSH).length} guards`);
  }, 120_000);
});
