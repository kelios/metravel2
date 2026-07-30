/**
 * #1147: гейт производительности обязан УМЕТЬ ПАДАТЬ.
 *
 * До этой задачи прод держал LCP 10–11 с и CLS 0.161 при бюджете 4000 мс / 0.1,
 * а все проверки были «зелёными»: e2e-порог LCP вне CI равнялся 45 000 мс,
 * а `lighthouse-produrl.js` снимал отчёт в режиме `simulate`, хотя бюджет
 * требует `devtools`.
 *
 * Тест проверяет три вещи:
 *  1) guard проваливает отчёт, который пробивает бюджет (с перечислением брейчей);
 *  2) guard пропускает отчёт в бюджете;
 *  3) дефолтные пороги e2e и режим троттлинга больше не «бесконечные».
 */
const fs = require('fs');
const path = require('path');
const { runNodeCli, makeTempDir, removeDir } = require('./cli-test-utils');

const REPO_ROOT = path.resolve(__dirname, '../..');
const GUARD = path.join(REPO_ROOT, 'scripts', 'guard-lighthouse-mobile-budget.js');
const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) removeDir(dir);
});

type Metrics = {
  score: number;
  lcp: number;
  cls: number;
  tbt: number;
  fcp: number;
};

const writeReport = (metrics: Metrics): string => {
  const numeric = (value: number) => ({ numericValue: value, score: 1 });
  const lhr = {
    configSettings: { throttlingMethod: 'devtools', formFactor: 'mobile' },
    categories: { performance: { score: metrics.score / 100 } },
    audits: {
      'largest-contentful-paint': numeric(metrics.lcp),
      'cumulative-layout-shift': numeric(metrics.cls),
      'total-blocking-time': numeric(metrics.tbt),
      'first-contentful-paint': numeric(metrics.fcp),
    },
  };
  const dir = makeTempDir('lh-budget-');
  tempDirs.push(dir);
  const file = path.join(dir, 'report.json');
  fs.writeFileSync(file, JSON.stringify(lhr));
  return file;
};

const runGuard = (reportPath: string) => runNodeCli([GUARD, '--report', reportPath, '--fail']);

describe('guard-lighthouse-mobile-budget', () => {
  it('проваливает отчёт, который пробивает бюджет (замер прода 2026-07-30)', () => {
    // Ровно те цифры, которые прод отдал на /travels/ourvietnam с applied-троттлингом.
    const report = writeReport({ score: 64, lcp: 4836, cls: 0.161, tbt: 230, fcp: 1528 });
    const result = runGuard(report);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('LCP (ms)');
    expect(result.stdout).toContain('CLS');
  });

  it('пропускает отчёт в бюджете', () => {
    const report = writeReport({ score: 78, lcp: 2400, cls: 0.03, tbt: 180, fcp: 1400 });
    const result = runGuard(report);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('within mobile travel budget');
  });
});

describe('дефолтные пороги гейтов', () => {
  const budget = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'config', 'lighthouse-budget-mobile.json'), 'utf-8'),
  );

  it('e2e LCP-порог не превышает бюджет и не зависит от CI', () => {
    const spec = fs.readFileSync(
      path.join(REPO_ROOT, 'e2e', 'web-vitals-travel-details.spec.ts'),
      'utf-8',
    );
    const match = /getNumberEnv\('E2E_LCP_MAX_MS',\s*([\d_]+)\)/.exec(spec);
    expect(match).toBeTruthy();
    const fallback = Number(String(match![1]).replace(/_/g, ''));
    expect(fallback).toBeLessThanOrEqual(budget.budget.maxLcpMs);
    // Разные пороги для CI и локального прогона снова открыли бы дыру.
    expect(spec).not.toMatch(/process\.env\.CI\s*\n?\s*\?\s*getNumberEnv\('E2E_LCP_MAX_MS'/);
  });

  it('lighthouse-produrl снимает отчёт в гейтовом режиме по умолчанию', () => {
    const script = fs.readFileSync(
      path.join(REPO_ROOT, 'scripts', 'lighthouse-produrl.js'),
      'utf-8',
    );
    expect(script).not.toContain("'--throttling-method=simulate'");
    expect(script).toContain("|| 'devtools'");
    expect(budget.requiredThrottlingMethod).toBe('devtools');
  });
});
