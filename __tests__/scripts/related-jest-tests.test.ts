import path from 'path';
import { makeTempDir, removeDir, runCli, writeTextFile } from './cli-test-utils';

/**
 * Регрессия #3468 (RED-TEST-ON-MAIN-OUTSIDE-GATE-001): до push идут тесты,
 * которые импортируют или подменяют изменённый модуль.
 *
 * Образец — `__tests__/app/tripCreateScreen.authGate.test.tsx` и коммит
 * `8791989d1`: тест подменял `@/utils/tripPlanLinks` целиком, импортёр начал
 * брать из модуля новое имя, тест покраснел — а шаг до push его не выбирал:
 * выборка была рукописным списком областей, не графом.
 *
 * Отбор идёт на временном проекте настоящим Jest (`--findRelatedTests`), от
 * состояния рабочего дерева не зависит. Каждый запуск Jest — около секунды,
 * поэтому файл не входит в `test:governance`.
 */

const {
  selectRelatedTests,
  formatRelatedSelection,
  findMockingTests,
  findDocContractTests,
  moduleKey,
  mockSpecifierKey,
} = require('@/scripts/related-jest-tests');
const { RELATED_TESTS_RULE } = require('@/scripts/pre-push-guards');

const repoRoot = process.cwd();
const RUNNER = path.join(repoRoot, 'scripts/run-pre-push-guards.js');

const AUTH_GATE_TEST = '__tests__/app/create.authGate.test.js';
const MOCK_ONLY_TEST = '__tests__/app/menu.test.js';
const TRANSITIVE_TEST = '__tests__/screens/create.test.js';
const UNRELATED_TEST = '__tests__/utils/other.test.js';
const DOC_TEST = '__tests__/docs/guide.test.js';
const LOCALE_CONSUMER_TEST = '__tests__/screens/greeting.test.js';
const LOCALE_SUITE_TEST = '__tests__/i18n/parity.test.js';

const temporaryRoots: string[] = [];
afterAll(() => {
  for (const root of temporaryRoots.splice(0)) removeDir(root);
});

/**
 * Цепочка как в инциденте: экран → разбор черновика → ссылки. Тест экрана
 * подменяет модуль ссылок целиком и отдаёт только `buildLink`.
 */
const fixtureProject = ({ authGateBody }: { authGateBody: string }): string => {
  const root = makeTempDir('related-jest-fixture-');
  temporaryRoots.push(root);
  const write = (relativePath: string, content: string) => writeTextFile(path.join(root, relativePath), content);

  write('package.json', `${JSON.stringify({ name: 'related-jest-fixture', private: true })}\n`);
  write(
    'jest.config.js',
    "module.exports = { testEnvironment: 'node', transform: {}, testMatch: ['**/__tests__/**/*.test.js'], moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' } };\n"
  );
  write('utils/links.js', 'exports.buildLink = (id) => `/trips/${id}`;\nexports.firstParam = (value) => (Array.isArray(value) ? value[0] : value);\n');
  write('utils/intake.js', "const { firstParam } = require('@/utils/links');\nexports.readDraft = (params) => ({ title: firstParam(params.title) });\n");
  write('screens/create.js', "const { readDraft } = require('@/utils/intake');\nexports.createScreen = (params) => readDraft(params).title;\n");
  write('utils/other.js', 'exports.other = () => 1;\n');
  write('i18n/locales/ru/common.js', "exports.hello = 'Привет';\n");
  write('screens/greeting.js', "const { hello } = require('@/i18n/locales/ru/common');\nexports.greeting = () => hello;\n");
  write('docs/guide.md', '# Guide\n');

  write(
    AUTH_GATE_TEST,
    "jest.mock('@/utils/links', () => ({ buildLink: () => '/stub' }));\n" +
      "const { createScreen } = require('@/screens/create');\n" +
      `test('auth gate', () => {\n${authGateBody}\n});\n`
  );
  // Подмена без единого импортёра в графе теста: граф Jest такой тест не находит.
  write(MOCK_ONLY_TEST, "jest.doMock('../../utils/links', () => ({}));\nconst { other } = require('@/utils/other');\ntest('menu', () => { expect(other()).toBe(1); });\n");
  write(TRANSITIVE_TEST, "const { createScreen } = require('@/screens/create');\ntest('title', () => { expect(createScreen({ title: ['A'] })).toBe('A'); });\n");
  write(UNRELATED_TEST, "const { other } = require('@/utils/other');\ntest('other', () => { expect(other()).toBe(1); });\n");
  write(DOC_TEST, "const fs = require('fs');\ntest('guide', () => { expect(fs.readFileSync('docs/guide.md', 'utf8')).toContain('Guide'); });\n");
  write(LOCALE_CONSUMER_TEST, "const { greeting } = require('@/screens/greeting');\ntest('greeting', () => { expect(greeting()).toBe('Привет'); });\n");
  write(LOCALE_SUITE_TEST, "const ru = require('@/i18n/locales/ru/common');\ntest('parity', () => { expect(Object.keys(ru)).toEqual(['hello']); });\n");
  return root;
};

const GREEN_BODY = "  expect(typeof createScreen).toBe('function');";
// Импортёр берёт из подменённого модуля `firstParam`, а подмена его не отдаёт — как в `8791989d1`.
const RED_BODY = "  expect(createScreen({ title: ['A'] })).toBe('A');";

describe('related Jest tests for a changed module (#3468)', () => {
  let root = '';
  beforeAll(() => {
    root = fixtureProject({ authGateBody: GREEN_BODY });
  });

  it('selects the test that replaces the changed module through jest.mock, in the graph or not', () => {
    const selection = selectRelatedTests({ changedFiles: ['utils/links.js'], root });

    expect(selection.mocks).toEqual([AUTH_GATE_TEST, MOCK_ONLY_TEST]);
    // Тест с подменой, но без импортёра модуля в своём графе находит только просмотр `jest.mock`.
    expect(selection.mocksOutsideGraph).toEqual([MOCK_ONLY_TEST]);
    expect(selection.selected).toEqual(expect.arrayContaining([AUTH_GATE_TEST, MOCK_ONLY_TEST]));
    expect(selection.selected).not.toContain(UNRELATED_TEST);
  }, 60_000);

  it('selects the test that imports the changed module transitively', () => {
    const selection = selectRelatedTests({ changedFiles: ['utils/links.js'], root });

    // create.test → screens/create → utils/intake → utils/links: два звена до изменённого файла.
    expect(selection.graph).toEqual([AUTH_GATE_TEST, TRANSITIVE_TEST]);
    expect(selection.selected).toContain(TRANSITIVE_TEST);
    expect(selection.overCeiling).toBe(false);
    expect(selection.notRun).toEqual([]);

    // Изменён импортёр, а не сам подменённый модуль, — ровно случай `tripPlanDraftIntake.ts`.
    const viaImporter = selectRelatedTests({ changedFiles: ['utils/intake.js'], root });
    expect(viaImporter.selected).toEqual([AUTH_GATE_TEST, TRANSITIVE_TEST]);
  }, 60_000);

  it('adds the changed test itself, the doc contract and leaves out what another step already runs', () => {
    const selection = selectRelatedTests({ changedFiles: ['docs/guide.md', UNRELATED_TEST, 'utils/gone.js'], root });
    expect(selection.docContracts).toEqual([DOC_TEST]);
    expect(selection.changedTests).toEqual([UNRELATED_TEST]);
    // Удалённый модуль графу не отдаётся: Jest такого пути не знает.
    expect(selection.graphInputs).toEqual([UNRELATED_TEST]);
    expect(selection.selected).toEqual([DOC_TEST, UNRELATED_TEST]);

    const deduplicated = selectRelatedTests({ changedFiles: ['utils/links.js'], root, alreadyRun: [TRANSITIVE_TEST] });
    expect(deduplicated.selected).toEqual([AUTH_GATE_TEST, MOCK_ONLY_TEST]);
  }, 60_000);

  it('does not truncate silently above the ceiling: runs the mandatory tests and reports the rest with a command', () => {
    const selection = selectRelatedTests({ changedFiles: ['utils/links.js'], root, ceiling: 1 });

    expect(selection.overCeiling).toBe(true);
    // Обязательные идут и сверх потолка: подмена изменённого модуля — прямой повод карточки.
    expect(selection.selected).toEqual([AUTH_GATE_TEST, MOCK_ONLY_TEST]);
    expect(selection.notRun).toEqual([TRANSITIVE_TEST]);

    const report = formatRelatedSelection(selection).join('\n');
    expect(report).toContain('граф Jest даёт 2 тестов, потолок 1');
    expect(report).toContain('НЕ ЗАПУЩЕНО 1');
    expect(report).toContain(RELATED_TESTS_RULE.fullCommand);

    // Ручной шаг (`--full`) потолка не знает и запускает весь граф.
    const full = selectRelatedTests({ changedFiles: ['utils/links.js'], root, ceiling: 1, full: true });
    expect(full.overCeiling).toBe(false);
    expect(full.selected).toEqual([AUTH_GATE_TEST, MOCK_ONLY_TEST, TRANSITIVE_TEST]);
    expect(formatRelatedSelection(full).join('\n')).not.toContain('НЕ ЗАПУЩЕНО');
  }, 60_000);

  it('runs the data suite instead of expanding locale files through the graph, and says so', () => {
    const changedFiles = ['i18n/locales/ru/common.js'];
    const selection = selectRelatedTests({ changedFiles, root });

    expect(selection.graphInputs).toEqual([]);
    expect(selection.dataSuites).toEqual([LOCALE_SUITE_TEST]);
    expect(selection.selected).toEqual([LOCALE_SUITE_TEST]);
    const report = formatRelatedSelection(selection).join('\n');
    expect(report).toContain('i18n/locales/');
    expect(report).toContain('__tests__/i18n');
    expect(report).toContain(RELATED_TESTS_RULE.fullCommand);

    const full = selectRelatedTests({ changedFiles, root, full: true });
    expect(full.graph).toEqual([LOCALE_SUITE_TEST, LOCALE_CONSUMER_TEST]);
    expect(full.dataSuites).toEqual([]);
  }, 60_000);

  it('names the whole remaining suite as not run when the diff changes the Jest config, and --full runs it', () => {
    // Граф по конфигурации и setup пуст, а затронут весь набор: молча «0 тестов» быть не должно.
    const selection = selectRelatedTests({ changedFiles: ['jest.config.js', 'utils/other.js'], root });

    expect(selection.wholeSuiteFiles).toEqual(['jest.config.js']);
    expect(selection.selected).toEqual([MOCK_ONLY_TEST, UNRELATED_TEST]);
    expect(selection.notRun).toHaveLength(5);
    const report = formatRelatedSelection(selection).join('\n');
    expect(report).toContain('изменена конфигурация, setup или зависимости Jest (jest.config.js)');
    expect(report).toContain('НЕ ЗАПУЩЕНО 5');
    expect(report).toContain(RELATED_TESTS_RULE.fullCommand);

    const full = selectRelatedTests({ changedFiles: ['__mocks__/svg.js'], root, full: true });
    expect(full.selected).toHaveLength(7);
    expect(full.notRun).toEqual([]);
  }, 60_000);

  it('makes the step green and counts the tests it ran', () => {
    writeTextFile(path.join(root, 'changed.txt'), 'utils/links.js\n');
    const result = runCli(process.execPath, [RUNNER, '--related-only', '--changed-files-file', path.join(root, 'changed.txt')], { cwd: root });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('pre-push-guards: related tests: 3 к запуску');
    expect(result.stdout).toContain('pre-push-guards: PASS (0 guards, 3 related tests, ');
  }, 120_000);
});

describe('a red related test (#3468)', () => {
  it('makes the step red and names the test', () => {
    const root = fixtureProject({ authGateBody: RED_BODY });
    writeTextFile(path.join(root, 'changed.txt'), 'utils/intake.js\n');
    const result = runCli(process.execPath, [RUNNER, '--related-only', '--changed-files-file', path.join(root, 'changed.txt')], { cwd: root });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('firstParam is not a function');
    expect(result.stderr).toContain(`pre-push-guards: FAILED related tests (exit 1) — красные тесты, связанные с diff'ом: ${AUTH_GATE_TEST}`);
    expect(result.stdout).not.toContain('pre-push-guards: PASS');
  }, 120_000);

  it('makes the step red when Jest fails on its config instead of selecting nothing', () => {
    const root = fixtureProject({ authGateBody: GREEN_BODY });
    writeTextFile(path.join(root, 'jest.config.js'), "throw new Error('broken jest config');\n");
    writeTextFile(path.join(root, 'changed.txt'), 'utils/links.js\n');
    const result = runCli(process.execPath, [RUNNER, '--related-only', '--changed-files-file', path.join(root, 'changed.txt')], { cwd: root });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('pre-push-guards: failed: jest --listTests --findRelatedTests failed');
    expect(result.stdout).not.toContain('pre-push-guards: PASS');
  }, 120_000);

  it('makes the step red when the changed files cannot be determined', () => {
    // Вне git без явного списка scope не собрать: пустая выборка не должна выглядеть зелёной.
    const root = fixtureProject({ authGateBody: GREEN_BODY });
    const result = runCli(process.execPath, [RUNNER, '--related-only'], { cwd: root, env: { GIT_CEILING_DIRECTORIES: path.dirname(root) } });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('pre-push-guards: FAILED related tests (exit 1) — изменённые файлы не определены');
    expect(result.stdout).not.toContain('pre-push-guards: PASS');
  }, 120_000);
});

describe('jest.mock path matching', () => {
  it('treats extension, platform suffix and index as the same module', () => {
    for (const file of ['utils/links.ts', 'utils/links.web.tsx', 'utils/links/index.ts', 'utils/links.native.js']) {
      expect(moduleKey(file)).toBe('utils/links');
    }
    expect(moduleKey('components/Foo.styles.ts')).toBe('components/Foo.styles');
    expect(mockSpecifierKey('@/utils/links', '__tests__/app/a.test.tsx')).toBe('utils/links');
    expect(mockSpecifierKey('../../utils/links.web', '__tests__/app/a.test.tsx')).toBe('utils/links');
    expect(mockSpecifierKey('./helper', '__tests__/app/a.test.tsx')).toBe('__tests__/app/helper');
    expect(mockSpecifierKey('react-native', '__tests__/app/a.test.tsx')).toBe('');
  });

  it('reads jest.mock, jest.doMock and a deleted module', () => {
    const root = makeTempDir('related-jest-mocks-');
    temporaryRoots.push(root);
    writeTextFile(path.join(root, '__tests__/a/mock.test.ts'), "jest.mock('@/utils/links');\n");
    writeTextFile(path.join(root, '__tests__/a/doMock.test.tsx'), 'jest\n  .doMock(\n    "../../utils/links",\n    () => ({}),\n  );\n');
    writeTextFile(path.join(root, '__tests__/a/requireOnly.test.ts'), "const links = require('@/utils/links');\n");
    writeTextFile(path.join(root, '__tests__/a/otherModule.test.ts'), "jest.mock('@/utils/linksExtra');\n");

    expect(findMockingTests(['utils/links.ts'], root)).toEqual(['__tests__/a/doMock.test.tsx', '__tests__/a/mock.test.ts']);
    // Удалённый модуль в рабочем дереве отсутствует, но подмена несуществующего пути роняет тест.
    expect(findMockingTests(['utils/linksExtra.ts'], root)).toEqual(['__tests__/a/otherModule.test.ts']);
    expect(findMockingTests(['docs/x.md', '__tests__/a/mock.test.ts'], root)).toEqual([]);
  });

  it('selects the contract test of a changed shell script or CI config by its quoted path', () => {
    const root = makeTempDir('related-jest-text-');
    temporaryRoots.push(root);
    writeTextFile(path.join(root, '__tests__/s/deploy.test.ts'), "const text = read('scripts/deploy.sh');\n");
    writeTextFile(path.join(root, '__tests__/s/ci.test.ts'), 'const text = read(".github/workflows/ci.yml");\n');
    writeTextFile(path.join(root, '__tests__/s/comment.test.ts'), '// `scripts/deploy.sh` только в комментарии\n');

    expect(findDocContractTests(['scripts/deploy.sh', '.github/workflows/ci.yml'], root)).toEqual(['__tests__/s/ci.test.ts', '__tests__/s/deploy.test.ts']);
  });
});
