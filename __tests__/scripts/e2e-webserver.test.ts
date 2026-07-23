const { EventEmitter } = require('node:events');

const { waitForProcessExit } = require('../../scripts/e2e-webserver');

describe('e2e webserver build lifecycle', () => {
  it('waits for the export process to exit before serving the build', async () => {
    const child = new EventEmitter() as EventEmitter & {
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
    };
    child.exitCode = null;
    child.signalCode = null;

    const exitPromise = waitForProcessExit(child, 1000);
    child.exitCode = 0;
    child.emit('exit', 0, null);

    await expect(exitPromise).resolves.toBe(true);
  });

  it('returns false when the export process exceeds the grace period', async () => {
    const child = new EventEmitter() as EventEmitter & {
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
    };
    child.exitCode = null;
    child.signalCode = null;

    await expect(waitForProcessExit(child, 1)).resolves.toBe(false);
  });

  it('accepts a process that already exited', async () => {
    await expect(
      waitForProcessExit({ exitCode: 0, signalCode: null }, 1000),
    ).resolves.toBe(true);
  });
});
