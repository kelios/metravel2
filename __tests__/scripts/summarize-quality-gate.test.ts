import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const scriptPath = path.resolve(process.cwd(), 'scripts/summarize-quality-gate.js');

type RunResult = {
  status: number;
  stdout: string;
};

const runSummary = (
  eslintPath: string,
  jestPath: string,
  extraArgs: string[] = [],
  env: Record<string, string> = {},
): RunResult => {
  try {
    const stdout = execFileSync(
      process.execPath,
      [scriptPath, eslintPath, jestPath, ...extraArgs],
      {
        encoding: 'utf8',
        env: { ...process.env, ...env },
      },
    );
    return { status: 0, stdout };
  } catch (error) {
    const failed = error as { status?: number; stdout?: string };
    return { status: failed.status ?? 1, stdout: String(failed.stdout ?? '') };
  }
};

const writeJson = (filePath: string, payload: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
};

describe('summarize-quality-gate script', () => {
  let tempDir: string;
  let eslintPassPath: string;
  let eslintFailPath: string;
  let jestPassPath: string;
  let jestFailPath: string;
  let jestSlowPath: string;
  let missingPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-gate-'));
    eslintPassPath = path.join(tempDir, 'eslint-pass.json');
    eslintFailPath = path.join(tempDir, 'eslint-fail.json');
    jestPassPath = path.join(tempDir, 'jest-pass.json');
    jestFailPath = path.join(tempDir, 'jest-fail.json');
    jestSlowPath = path.join(tempDir, 'jest-slow.json');
    missingPath = path.join(tempDir, 'missing.json');

    writeJson(eslintPassPath, [{ filePath: '/tmp/a.ts', errorCount: 0, warningCount: 0 }]);
    writeJson(eslintFailPath, [{ filePath: '/tmp/a.ts', errorCount: 1, warningCount: 0 }]);
    writeJson(jestPassPath, {
      numTotalTestSuites: 2,
      numFailedTestSuites: 0,
      numTotalTests: 10,
      numFailedTests: 0,
    });
    writeJson(jestFailPath, {
      numTotalTestSuites: 2,
      numFailedTestSuites: 1,
      numTotalTests: 10,
      numFailedTests: 2,
    });
    writeJson(jestSlowPath, {
      numTotalTestSuites: 1,
      numFailedTestSuites: 0,
      numTotalTests: 1,
      numFailedTests: 0,
      testResults: [
        { startTime: 0, endTime: 25_000 },
      ],
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('prints PASS when eslint and jest reports are healthy', () => {
    const result = runSummary(eslintPassPath, jestPassPath, ['--fail-on-missing']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Overall Quality Gate: PASS');
    expect(result.stdout).not.toContain('Failure Class:');
  });

  it('classifies missing report as infra_artifact and fails in strict mode', () => {
    const result = runSummary(missingPath, jestPassPath, ['--fail-on-missing']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Failure Class: infra_artifact');
    expect(result.stdout).toContain('Recommendation ID: QG-001');
    expect(result.stdout).toContain('docs/TESTING.md#qg-001 (QG-001)');
    expect(result.stdout).toContain('Quality summary failed: required report artifact is missing.');
  });

  it('classifies inconsistent upstream status as inconsistent_state and fails in strict mode', () => {
    const result = runSummary(
      eslintPassPath,
      jestPassPath,
      ['--fail-on-missing'],
      { LINT_JOB_RESULT: 'failure', SMOKE_JOB_RESULT: 'success' },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Failure Class: inconsistent_state');
    expect(result.stdout).toContain('Recommendation ID: QG-002');
    expect(result.stdout).toContain('docs/TESTING.md#qg-002 (QG-002)');
    expect(result.stdout).toContain('Consistency Checks');
  });

  it('classifies lint-only failure', () => {
    const result = runSummary(eslintFailPath, jestPassPath, ['--fail-on-missing']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Failure Class: lint_only');
    expect(result.stdout).toContain('Recommendation ID: QG-003');
    expect(result.stdout).toContain('docs/TESTING.md#qg-003 (QG-003)');
  });

  it('classifies smoke-only failure', () => {
    const result = runSummary(eslintPassPath, jestFailPath, ['--fail-on-missing']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Failure Class: smoke_only');
    expect(result.stdout).toContain('Recommendation ID: QG-004');
    expect(result.stdout).toContain('docs/TESTING.md#qg-004 (QG-004)');
  });

  it('classifies mixed failure when both lint and smoke fail', () => {
    const result = runSummary(eslintFailPath, jestFailPath, ['--fail-on-missing']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Failure Class: mixed');
    expect(result.stdout).toContain('Recommendation ID: QG-005');
    expect(result.stdout).toContain('docs/TESTING.md#qg-005 (QG-005)');
  });

  it('prints performance budget warning when smoke duration exceeds threshold', () => {
    const result = runSummary(
      eslintPassPath,
      jestSlowPath,
      ['--fail-on-missing'],
      { SMOKE_DURATION_BUDGET_SECONDS: '10' },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Smoke duration: 25s (budget: 10s) [OVER BUDGET]');
    expect(result.stdout).toContain('### Performance Budget');
  });

  it('fails in strict budget mode when smoke duration exceeds threshold', () => {
    const result = runSummary(
      eslintPassPath,
      jestSlowPath,
      ['--fail-on-missing'],
      {
        SMOKE_DURATION_BUDGET_SECONDS: '10',
        SMOKE_DURATION_BUDGET_STRICT: 'true',
      },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Failure Class: performance_budget');
    expect(result.stdout).toContain('Recommendation ID: QG-006');
    expect(result.stdout).toContain('docs/TESTING.md#qg-006 (QG-006)');
    expect(result.stdout).toContain('Strict budget mode is enabled');
    expect(result.stdout).toContain('Quality summary failed: smoke duration budget exceeded in strict mode.');
  });
});
