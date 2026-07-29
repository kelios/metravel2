import { OfflineOperations } from '@/services/offline/offlineOperations';

const meta = {
  key: 'travel:42',
  type: 'travel' as const,
  sourceId: 42,
  route: '/travels/42',
  title: 'Saved route',
};

describe('offline operation state', () => {
  it('publishes real progress and clears the operation after success', async () => {
    const operations = new OfflineOperations();
    const promise = operations.run(meta, async (_signal, report) => {
      report(1, 3);
      await Promise.resolve();
      report(3, 3);
      return 'ready';
    });

    expect(operations.get(meta.key)).toMatchObject({
      status: 'downloading',
      done: 1,
      total: 3,
    });
    await expect(promise).resolves.toBe('ready');
    expect(operations.get(meta.key)).toBeNull();
  });

  it('keeps a failed operation retryable and maps quota failures', async () => {
    const operations = new OfflineOperations();
    let attempt = 0;
    const runner = jest.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('disk full');
      return 'ready';
    });

    await expect(operations.run(meta, runner)).rejects.toThrow('disk full');
    expect(operations.get(meta.key)).toMatchObject({
      status: 'failed',
      errorCode: 'OFFLINE_STORAGE_FULL',
    });
    await expect(operations.retry(meta.key)).resolves.toBe('ready');
    expect(runner).toHaveBeenCalledTimes(2);
    expect(operations.get(meta.key)).toBeNull();
  });

  it('aborts and removes an in-flight operation on cancel', async () => {
    const operations = new OfflineOperations();
    const promise = operations.run(meta, (signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }, { once: true });
    }));

    operations.cancel(meta.key);

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(operations.get(meta.key)).toBeNull();
  });
});
