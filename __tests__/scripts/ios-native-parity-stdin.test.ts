const { ignoredFiles } = require('../../scripts/ios-native-parity');

describe('ios parity git ignore stdin (#2844)', () => {
  it('reads ignored paths from git using file stdin and accepts no matches', () => {
    expect([...ignoredFiles(['.codex-temp/task2844/probe', 'package.json'])]).toEqual(['.codex-temp/task2844/probe']);
    expect([...ignoredFiles(['package.json'])]).toEqual([]);
  });
});
