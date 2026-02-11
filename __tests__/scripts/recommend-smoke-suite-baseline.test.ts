const {
  parseArgs,
  readSnapshot,
  renderBaselineValue,
  renderRecommendation,
} = require('@/scripts/recommend-smoke-suite-baseline');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('recommend-smoke-suite-baseline helpers', () => {
  it('parses default args and supports file/format overrides', () => {
    expect(parseArgs([])).toEqual({
      file: 'test-results/quality-summary.json',
      format: 'json',
      output: 'text',
    });

    expect(parseArgs(['--file', 'tmp/q.json', '--format', 'csv'])).toEqual({
      file: 'tmp/q.json',
      format: 'csv',
      output: 'text',
    });
  });

  it('ignores unsupported formats and keeps json default', () => {
    expect(parseArgs(['--format', 'xml'])).toEqual({
      file: 'test-results/quality-summary.json',
      format: 'json',
      output: 'text',
    });
  });

  it('supports machine-readable json output flag', () => {
    expect(parseArgs(['--json'])).toEqual({
      file: 'test-results/quality-summary.json',
      format: 'json',
      output: 'json',
    });
  });

  it('reads suite files from snapshot and trims entries', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-baseline-'));
    const filePath = path.join(dir, 'quality-summary.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        smokeSuiteFiles: ['__tests__/a.test.ts', '  __tests__/b.test.ts  ', ''],
      }),
      'utf8',
    );

    const suites = readSnapshot(filePath);
    expect(suites).toEqual(['__tests__/a.test.ts', '__tests__/b.test.ts']);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('throws when smokeSuiteFiles are missing or empty', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-baseline-'));
    const missingPath = path.join(dir, 'missing.json');
    const emptyPath = path.join(dir, 'empty.json');

    fs.writeFileSync(missingPath, JSON.stringify({}), 'utf8');
    fs.writeFileSync(emptyPath, JSON.stringify({ smokeSuiteFiles: [] }), 'utf8');

    expect(() => readSnapshot(missingPath)).toThrow('snapshot.smokeSuiteFiles is missing or not an array');
    expect(() => readSnapshot(emptyPath)).toThrow('snapshot.smokeSuiteFiles is empty');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('renders baseline values in json and csv formats', () => {
    const suites = ['__tests__/a.test.ts', '__tests__/b.test.ts'];
    expect(renderBaselineValue(suites, 'json')).toBe('["__tests__/a.test.ts","__tests__/b.test.ts"]');
    expect(renderBaselineValue(suites, 'csv')).toBe('__tests__/a.test.ts,__tests__/b.test.ts');
  });

  it('renders recommendation payload for automation', () => {
    const payload = renderRecommendation({
      file: 'test-results/quality-summary.json',
      format: 'json',
      suites: ['__tests__/a.test.ts'],
    });

    expect(payload).toEqual({
      sourceSnapshot: 'test-results/quality-summary.json',
      suiteCount: 1,
      format: 'json',
      baselineValue: '["__tests__/a.test.ts"]',
      ghCommand: "gh variable set SMOKE_SUITE_FILES_BASELINE --body '[\"__tests__/a.test.ts\"]'",
    });
  });
});
