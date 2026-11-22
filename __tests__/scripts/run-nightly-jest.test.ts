import fs from 'fs';
import path from 'path';
import { runNodeCli } from './cli-test-utils';

/**
 * Второй слой #3468 (RED-TEST-ON-MAIN-OUTSIDE-GATE-001): полный Jest на снимке
 * `origin/main`. Здесь — разбор результата и сравнение с прошлым прогоном; сам
 * прогон идёт в отдельном worktree и в тестах не запускается.
 */

const {
  WORKTREE_PATH,
  REPORT_DIR,
  ENVIRONMENT_ONLY,
  EXIT_NEW_RED,
  EXIT_NOT_RUN,
  parseArgs,
  summarizeJestJson,
  splitEnvironmentRed,
  compareWithPrevious,
  exitCodeFor,
  formatReport,
  localDate,
} = require('@/scripts/run-nightly-jest');

const repoRoot = process.cwd();
const ROOT = '/snapshot';
const suite = (file: string, status: string, assertions: Array<[string, string]> = [], message = '') => ({
  name: `${ROOT}/${file}`,
  status,
  message,
  assertionResults: assertions.map(([fullName, assertionStatus]) => ({ fullName, status: assertionStatus })),
});

describe('nightly Jest result', () => {
  it('counts only failed suites as red and names their failed tests', () => {
    const summary = summarizeJestJson(
      {
        numTotalTestSuites: 5,
        numTotalTests: 40,
        numFailedTests: 2,
        testResults: [
          suite('__tests__/b.test.ts', 'failed', [['b › first', 'passed'], ['b › second', 'failed']]),
          suite('__tests__/a.test.ts', 'failed', [], '  ● Test suite failed to run\n\n    Cannot find module x\n'),
          suite('__tests__/ok.test.ts', 'passed', [['ok', 'passed']]),
          // Набор с пропущенными тестами Jest отдаёт как `focused`, целиком пропущенный — как `pending`:
          // так в снимке без каталога `android/` выглядят `__tests__/config/android-*`.
          suite('__tests__/config/android-config.test.ts', 'focused', [['android', 'pending']]),
          suite('__tests__/config/android-native.test.ts', 'pending', [['native', 'pending']]),
        ],
      },
      ROOT
    );

    expect(summary).toMatchObject({ suites: 5, tests: 40, failedTests: 2 });
    expect(summary.red).toEqual([
      { file: '__tests__/a.test.ts', failedTests: [], message: '● Test suite failed to run | Cannot find module x' },
      { file: '__tests__/b.test.ts', failedTests: ['b › second'], message: '' },
    ]);
  });

  it('keeps stand-only red out of the count only while the stand is not prepared', () => {
    const red = [
      { file: '__tests__/services/pdf-export/bookRendererWorker.test.ts', failedTests: ['x'], message: '' },
      { file: '__tests__/app/screen.test.tsx', failedTests: ['y'], message: '' },
    ];

    const withoutFonts = splitEnvironmentRed(red, { fonts: false });
    expect(withoutFonts.real.map((item: { file: string }) => item.file)).toEqual(['__tests__/app/screen.test.tsx']);
    expect(withoutFonts.environment).toEqual([expect.objectContaining({ file: red[0].file, why: ENVIRONMENT_ONLY[0].why })]);

    // Шрифты подготовлены — красный тест рендерера книги уже настоящий.
    const withFonts = splitEnvironmentRed(red, { fonts: true });
    expect(withFonts.environment).toEqual([]);
    expect(withFonts.real).toHaveLength(2);
  });

  it('compares with the previous run and exits non-zero only on new red', () => {
    const previous = { sha: 'aaa', redFiles: ['__tests__/old.test.ts', '__tests__/fixed.test.ts'] };

    const same = compareWithPrevious(['__tests__/old.test.ts', '__tests__/fixed.test.ts'], previous);
    expect(same).toEqual({ baseline: false, newRed: [], fixed: [], stillRed: ['__tests__/fixed.test.ts', '__tests__/old.test.ts'] });
    expect(exitCodeFor(same)).toBe(0);

    const changed = compareWithPrevious(['__tests__/old.test.ts', '__tests__/new.test.ts'], previous);
    expect(changed).toEqual({
      baseline: false,
      newRed: ['__tests__/new.test.ts'],
      fixed: ['__tests__/fixed.test.ts'],
      stillRed: ['__tests__/old.test.ts'],
    });
    expect(exitCodeFor(changed)).toBe(EXIT_NEW_RED);

    // Старое красное кодом не шумит, но и не пропадает из отчёта.
    expect(exitCodeFor(compareWithPrevious([], previous))).toBe(0);

    // Без прошлого отчёта новым считается всё красное: потерянный `latest.json` не должен молча стать нормой.
    const baseline = compareWithPrevious(['__tests__/old.test.ts'], null);
    expect(baseline).toEqual({ baseline: true, newRed: ['__tests__/old.test.ts'], fixed: [], stillRed: [] });
    expect(exitCodeFor(baseline)).toBe(EXIT_NEW_RED);
    expect(exitCodeFor(compareWithPrevious([], null))).toBe(0);
  });

  it('lists new, fixed, flaky and stand-only red in the text report', () => {
    const report = formatReport({
      ref: 'origin/main',
      sha: '0335e682a1c769096260a4f7b6865d581a5c5119',
      date: '2026-11-22',
      startedAt: '2026-11-22T07:54:34.832Z',
      durationSeconds: 215,
      maxWorkers: '50%',
      suites: 2412,
      tests: 28229,
      redCount: 2,
      red: [
        { file: '__tests__/new.test.ts', failedTests: ['new › breaks'], message: '' },
        { file: '__tests__/old.test.ts', failedTests: [], message: 'Cannot find module x' },
      ],
      newRed: ['__tests__/new.test.ts'],
      fixed: ['__tests__/fixed.test.ts'],
      stillRed: ['__tests__/old.test.ts'],
      flaky: ['__tests__/flaky.test.ts'],
      environmentRed: [{ file: '__tests__/services/pdf-export/bookRendererWorker.test.ts', why: 'нет шрифтов' }],
      previousSha: 'e25ada8bb0000000000000000000000000000000',
      previousDate: '2026-11-21',
      previousRedCount: 2,
      notes: ['шрифты книги не подготовлены'],
    });

    expect(report).toContain('Ночной Jest на origin/main: 0335e682a1c769096260a4f7b6865d581a5c5119');
    expect(report).toContain('Красных наборов: 2 (прошлый прогон 2026-11-21 @ e25ada8bb: 2)');
    expect(report).toContain('НОВЫЕ красные: 1\n  - __tests__/new.test.ts');
    expect(report).toContain('Починенные с прошлого прогона: 1\n  - __tests__/fixed.test.ts');
    expect(report).toContain('  - __tests__/flaky.test.ts');
    expect(report).toContain('bookRendererWorker.test.ts — нет шрифтов');
    expect(report).toContain('    ✕ new › breaks');
    expect(report).toContain('    Cannot find module x');
    expect(report).toContain('Заметка: шрифты книги не подготовлены');
  });
});

describe('nightly Jest command', () => {
  it('parses its arguments and rejects unknown ones', () => {
    expect(parseArgs([])).toEqual({ ref: 'origin/main', fetch: true, maxWorkers: '50%', keepWorktree: false, dryRun: false });
    expect(parseArgs(['--ref', 'HEAD', '--no-fetch', '--max-workers', '4', '--keep-worktree', '--dry-run'])).toEqual({
      ref: 'HEAD',
      fetch: false,
      maxWorkers: '4',
      keepWorktree: true,
      dryRun: true,
    });
    expect(() => parseArgs(['--bogus'])).toThrow('unknown argument: --bogus');
    expect(() => parseArgs(['--max-workers', 'many'])).toThrow('--max-workers expects');
    expect(localDate(new Date(2026, 10, 2, 3, 4))).toBe('2026-11-02');
  });

  it('keeps the snapshot outside the checkout and the reports inside its ignored directory', () => {
    // Снимок внутри чекаута попал бы под обход файлов Jest и Metro основного дерева;
    // путь чекаута в аргументах прогона глушил бы Jest соседних сессий (quality-gate lock).
    expect(path.relative(repoRoot, WORKTREE_PATH).startsWith('..')).toBe(true);
    expect(path.relative(repoRoot, REPORT_DIR)).toBe(path.join('.codex-temp', 'nightly-jest'));
    const source = fs.readFileSync(path.join(repoRoot, 'scripts/run-nightly-jest.js'), 'utf8');
    expect(source).toContain("path.join(os.tmpdir(), 'nightly-jest-')");
    expect(source).not.toMatch(/outputFile = path\.join\(REPORT_DIR/);
  });

  it('is wired as `npm run test:nightly` and prints its plan on --dry-run', () => {
    const scripts = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).scripts;
    expect(scripts['test:nightly']).toBe('node scripts/run-nightly-jest.js');

    const dryRun = runNodeCli(['scripts/run-nightly-jest.js', '--dry-run']);
    expect(dryRun.status).toBe(0);
    expect(dryRun.stdout).toContain('nightly-jest: dry-run');
    expect(dryRun.stdout).toContain('origin/main');

    const unknown = runNodeCli(['scripts/run-nightly-jest.js', '--bogus']);
    expect(unknown.status).toBe(EXIT_NOT_RUN);
    expect(unknown.stderr).toContain('unknown argument: --bogus');
  });
});
