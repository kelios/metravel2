const {
  computeDurationSeconds,
  median,
  recommendBaseline,
} = require('@/scripts/recommend-smoke-baseline');
const fs = require('fs');
const path = require('path');
const { makeTempDir, writeJsonFile } = require('./cli-test-utils');

describe('recommend-smoke-baseline script helpers', () => {
  it('computes duration seconds from jest report testResults', () => {
    const report = {
      testResults: [
        { startTime: 0, endTime: 1500 },
        { startTime: 0, endTime: 500 },
      ],
    };
    expect(computeDurationSeconds(report)).toBe(2);
  });

  it('returns null duration for missing testResults', () => {
    expect(computeDurationSeconds({})).toBeNull();
  });

  it('calculates median for odd and even counts', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('recommends baseline from most recent reports within limit', () => {
    const dir = makeTempDir('smoke-baseline-');
    const fileA = path.join(dir, 'a.json');
    const fileB = path.join(dir, 'b.json');
    const fileC = path.join(dir, 'c.json');

    const mkReport = (seconds) => ({
      testResults: [{ startTime: 0, endTime: seconds * 1000 }],
    });

    writeJsonFile(fileA, mkReport(10));
    writeJsonFile(fileB, mkReport(20));
    writeJsonFile(fileC, mkReport(30));

    const now = Date.now() / 1000;
    fs.utimesSync(fileA, now - 30, now - 30);
    fs.utimesSync(fileB, now - 20, now - 20);
    fs.utimesSync(fileC, now - 10, now - 10);

    const result = recommendBaseline({
      files: [fileA, fileB, fileC],
      limit: 2,
    });

    expect(result.stats).toHaveLength(2);
    expect(result.durations).toEqual([30, 20]);
    expect(result.baseline).toBe(25);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
