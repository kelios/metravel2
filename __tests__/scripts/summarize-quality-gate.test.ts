import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const scriptPath = path.resolve(process.cwd(), 'scripts/summarize-quality-gate.js');
const quickMapSnippet = 'QG quick map: QG-001 infra_artifact | QG-002 inconsistent_state | QG-003 lint_only | QG-004 smoke_only | QG-005 mixed | QG-006 performance_budget | QG-007 selective_contract | QG-008 validator_contract';

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
  let summaryJsonPath: string;
  let schemaDecisionPath: string;
  let validatorDecisionPath: string;
  let selectiveDecisionsPath: string;
  let validatorContractsSummaryValidationPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-gate-'));
    eslintPassPath = path.join(tempDir, 'eslint-pass.json');
    eslintFailPath = path.join(tempDir, 'eslint-fail.json');
    jestPassPath = path.join(tempDir, 'jest-pass.json');
    jestFailPath = path.join(tempDir, 'jest-fail.json');
    jestSlowPath = path.join(tempDir, 'jest-slow.json');
    missingPath = path.join(tempDir, 'missing.json');
    summaryJsonPath = path.join(tempDir, 'quality-summary.json');
    schemaDecisionPath = path.join(tempDir, 'schema-selective-decision.json');
    validatorDecisionPath = path.join(tempDir, 'validator-selective-decision.json');
    selectiveDecisionsPath = path.join(tempDir, 'selective-decisions.json');
    validatorContractsSummaryValidationPath = path.join(tempDir, 'validator-contracts-summary-validation.json');

    writeJson(eslintPassPath, [{ filePath: '/tmp/a.ts', errorCount: 0, warningCount: 0 }]);
    writeJson(eslintFailPath, [{ filePath: '/tmp/a.ts', errorCount: 1, warningCount: 0 }]);
    writeJson(jestPassPath, {
      numTotalTestSuites: 2,
      numFailedTestSuites: 0,
      numTotalTests: 10,
      numFailedTests: 0,
      testResults: [
        {
          name: `${process.cwd()}/__tests__/app/export.test.tsx`,
          startTime: 0,
          endTime: 1000,
        },
        {
          name: `${process.cwd()}/__tests__/app/subscriptions.test.tsx`,
          startTime: 0,
          endTime: 1000,
        },
      ],
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
    writeJson(schemaDecisionPath, {
      contractVersion: 1,
      check: 'schema-contract-checks',
      decision: 'run',
      shouldRun: true,
      reason: 'match',
      changedFilesScanned: 6,
      relevantMatches: 2,
      matchedFiles: ['scripts/validate-quality-summary.js'],
      dryRun: true,
      targetedTests: 3,
    });
    writeJson(validatorDecisionPath, {
      contractVersion: 1,
      check: 'validator-contract-checks',
      decision: 'skip',
      shouldRun: false,
      reason: 'no-match',
      changedFilesScanned: 6,
      relevantMatches: 0,
      matchedFiles: [],
      dryRun: true,
      targetedTests: 7,
    });
    writeJson(selectiveDecisionsPath, {
      schemaVersion: 1,
      decisions: [
        JSON.parse(fs.readFileSync(schemaDecisionPath, 'utf8')),
        JSON.parse(fs.readFileSync(validatorDecisionPath, 'utf8')),
      ],
      warnings: [],
    });
    writeJson(validatorContractsSummaryValidationPath, {
      contractVersion: 1,
      ok: true,
      errorCount: 0,
      errors: [],
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('prints PASS when eslint and jest reports are healthy', () => {
    const result = runSummary(eslintPassPath, jestPassPath, ['--fail-on-missing']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Overall Quality Gate: PASS');
    expect(result.stdout).toContain('### Smoke Composition');
    expect(result.stdout).toContain('Suites in critical run: 2');
    expect(result.stdout).not.toContain('Failure Class:');
  });

  it('writes summary lines to GITHUB_STEP_SUMMARY', () => {
    const stepSummaryPath = path.join(tempDir, 'step-summary.md');
    const result = runSummary(
      eslintPassPath,
      jestPassPath,
      ['--fail-on-missing'],
      { GITHUB_STEP_SUMMARY: stepSummaryPath },
    );
    expect(result.status).toBe(0);
    const markdown = fs.readFileSync(stepSummaryPath, 'utf8');
    expect(markdown).toContain('## Quality Gate Summary');
    expect(markdown).toContain('Overall Quality Gate: PASS');
  });

  it('prints suite drift when baseline files are provided', () => {
    const result = runSummary(
      eslintPassPath,
      jestPassPath,
      ['--fail-on-missing'],
      {
        SMOKE_SUITE_FILES_BASELINE: '__tests__/legacy/old.test.ts,__tests__/scripts/summarize-quality-gate.test.ts',
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Suite drift vs baseline: +2 / -2');
    expect(result.stdout).toContain('Added suite files:');
    expect(result.stdout).toContain('Removed suite files:');
  });

  it('writes machine-readable quality snapshot when --json-output is provided', () => {
    const result = runSummary(
      eslintFailPath,
      jestPassPath,
      [
        '--fail-on-missing',
        '--json-output',
        summaryJsonPath,
        '--selective-decisions-file',
        selectiveDecisionsPath,
      ],
    );
    expect(result.status).toBe(0);

    const snapshot = JSON.parse(fs.readFileSync(summaryJsonPath, 'utf8'));
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.overallOk).toBe(false);
    expect(snapshot.failureClass).toBe('lint_only');
    expect(snapshot.recommendationId).toBe('QG-003');
    expect(Array.isArray(snapshot.smokeSuiteFiles)).toBe(true);
    expect(typeof snapshot.smokeSuiteBaselineProvided).toBe('boolean');
    expect(Array.isArray(snapshot.smokeSuiteAddedFiles)).toBe(true);
    expect(Array.isArray(snapshot.smokeSuiteRemovedFiles)).toBe(true);
    expect(Array.isArray(snapshot.selectiveDecisions)).toBe(true);
    expect(snapshot.selectiveDecisions).toHaveLength(2);
    expect(snapshot.selectiveDecisionWarnings).toEqual([]);
    expect(snapshot.selectiveDecisionsAggregateIssue).toBe(false);
    expect(snapshot.validatorContractsSummaryValidationOk).toBeNull();
    expect(snapshot.validatorContractsSummaryValidationWarnings).toEqual([]);
    expect(snapshot.validatorContractsSummaryValidationIssue).toBe(false);
    expect(result.stdout).toContain('### Selective Checks');
    expect(result.stdout).toContain('schema-contract-checks: run');
  });

  it('classifies failing validator contracts summary validation as validator_contract', () => {
    writeJson(validatorContractsSummaryValidationPath, {
      contractVersion: 1,
      ok: false,
      errorCount: 2,
      errors: [
        { code: 'VALIDATOR_CONTRACTS_SUMMARY_STATUS_MISMATCH' },
      ],
    });
    const result = runSummary(
      eslintPassPath,
      jestPassPath,
      [
        '--fail-on-missing',
        '--validator-contracts-summary-validation-file',
        validatorContractsSummaryValidationPath,
      ],
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Failure Class: validator_contract');
    expect(result.stdout).toContain('Recommendation ID: QG-008');
    expect(result.stdout).toContain('docs/TESTING.md#qg-008 (QG-008)');
    expect(result.stdout).toContain('### Validator Contracts');
    expect(result.stdout).toContain('Fix validator contracts summary validation issues');
  });

  it('prints selective decision warnings when artifacts are missing', () => {
    const result = runSummary(
      eslintPassPath,
      jestPassPath,
      [
        '--fail-on-missing',
        '--schema-decision-file',
        path.join(tempDir, 'missing-schema-decision.json'),
      ],
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('### Selective Checks');
    expect(result.stdout).toContain('Decision artifact warnings:');
    expect(result.stdout).toContain('schema-contract-checks: decision file not found');
  });

  it('prints selective decision warnings from aggregate file', () => {
    writeJson(selectiveDecisionsPath, {
      schemaVersion: 1,
      decisions: [],
      warnings: ['schema-contract-checks: decision file not found (x.json).'],
    });
    const result = runSummary(
      eslintPassPath,
      jestPassPath,
      [
        '--fail-on-missing',
        '--selective-decisions-file',
        selectiveDecisionsPath,
      ],
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Decision artifact warnings:');
    expect(result.stdout).toContain('schema-contract-checks: decision file not found');
  });

  it('classifies invalid selective decisions aggregate as selective_contract', () => {
    writeJson(selectiveDecisionsPath, {
      schemaVersion: 2,
      decisions: [],
      warnings: [],
    });
    const result = runSummary(
      eslintPassPath,
      jestPassPath,
      [
        '--fail-on-missing',
        '--selective-decisions-file',
        selectiveDecisionsPath,
      ],
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Failure Class: selective_contract');
    expect(result.stdout).toContain('Recommendation ID: QG-007');
    expect(result.stdout).toContain('docs/TESTING.md#qg-007 (QG-007)');
    expect(result.stdout).toContain('Fix selective decisions aggregate contract');
  });

  it('classifies missing report as infra_artifact and fails in strict mode', () => {
    const result = runSummary(missingPath, jestPassPath, ['--fail-on-missing']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Failure Class: infra_artifact');
    expect(result.stdout).toContain('Recommendation ID: QG-001');
    expect(result.stdout).toContain('docs/TESTING.md#qg-001 (QG-001)');
    expect(result.stdout).toContain(quickMapSnippet);
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
    expect(result.stdout).toContain(quickMapSnippet);
    expect(result.stdout).toContain('Consistency Checks');
  });

  it('classifies lint-only failure', () => {
    const result = runSummary(eslintFailPath, jestPassPath, ['--fail-on-missing']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Failure Class: lint_only');
    expect(result.stdout).toContain('Recommendation ID: QG-003');
    expect(result.stdout).toContain('docs/TESTING.md#qg-003 (QG-003)');
    expect(result.stdout).toContain(quickMapSnippet);
  });

  it('classifies smoke-only failure', () => {
    const result = runSummary(eslintPassPath, jestFailPath, ['--fail-on-missing']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Failure Class: smoke_only');
    expect(result.stdout).toContain('Recommendation ID: QG-004');
    expect(result.stdout).toContain('docs/TESTING.md#qg-004 (QG-004)');
    expect(result.stdout).toContain(quickMapSnippet);
  });

  it('classifies mixed failure when both lint and smoke fail', () => {
    const result = runSummary(eslintFailPath, jestFailPath, ['--fail-on-missing']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Failure Class: mixed');
    expect(result.stdout).toContain('Recommendation ID: QG-005');
    expect(result.stdout).toContain('docs/TESTING.md#qg-005 (QG-005)');
    expect(result.stdout).toContain(quickMapSnippet);
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

  it('prints smoke duration trend when previous baseline is provided', () => {
    const result = runSummary(
      eslintPassPath,
      jestSlowPath,
      ['--fail-on-missing'],
      { SMOKE_DURATION_PREVIOUS_SECONDS: '20' },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Smoke trend: +5s (+25%) vs previous 20s [slower]');
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
    expect(result.stdout).toContain(quickMapSnippet);
    expect(result.stdout).toContain('Strict budget mode is enabled');
    expect(result.stdout).toContain('Quality summary failed: smoke duration budget exceeded in strict mode.');
  });
});
