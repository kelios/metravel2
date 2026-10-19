import { runCli } from './cli-test-utils';

describe('runCli output and exit status', () => {
  it('preserves successful stdout and stderr independently', () => {
    expect(runCli(process.execPath, ['-e', 'process.stdout.write("result"); process.stderr.write("summary");'])).toEqual({
      status: 0,
      stdout: 'result',
      stderr: 'summary',
    });
  });

  it('preserves the exit code and output on failure', () => {
    expect(runCli(process.execPath, ['-e', 'process.stdout.write("partial"); process.stderr.write("invalid"); process.exitCode = 2;'])).toEqual({
      status: 2,
      stdout: 'partial',
      stderr: 'invalid',
    });
  });

  it('reports a missing executable as failure', () => {
    expect(runCli('/nonexistent/metravel-cli-test-executable', []).status).toBe(1);
  });
});
