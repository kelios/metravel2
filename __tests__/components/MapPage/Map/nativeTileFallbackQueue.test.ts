/**
 * #2452 — RN-сторона мостового пути тайлов: очередь fallback-запросов (LIFO,
 * отмена, отбрасывание прежнего зума), батч-инжект раз в кадр и план захвата
 * тайлов в дисковый кэш без второй сетевой загрузки.
 */
import {
  createNativeTileBatchInjector,
  createNativeTileFallbackQueue,
  isSafeTileBridgeKey,
  parseNativeTileCaptureEntry,
  planNativeTileCapture,
  type NativeTileFallbackRequest,
} from '@/components/MapPage/Map/nativeTileFallbackQueue';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const deferred = () => {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const flushPromises = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

const req = (z: number, x: number, seq: number): NativeTileFallbackRequest => ({
  key: `${z}/${x}/1#${seq}`,
  z,
  x,
  y: 1,
});

describe('createNativeTileFallbackQueue', () => {
  it('serves the latest request first (LIFO) within the concurrency limit', async () => {
    const started: string[] = [];
    const pending = new Map<string, ReturnType<typeof deferred>>();
    const delivered: Array<[string, string]> = [];
    const queue = createNativeTileFallbackQueue({
      concurrency: 1,
      resolve: (request) => {
        started.push(request.key);
        const d = deferred();
        pending.set(request.key, d);
        return d.promise;
      },
      deliver: (key, dataUrl) => delivered.push([key, dataUrl]),
    });

    queue.enqueue(req(10, 1, 1));
    queue.enqueue(req(10, 2, 2));
    queue.enqueue(req(10, 3, 3));
    expect(started).toEqual(['10/1/1#1']);
    expect(queue.size()).toBe(2);

    pending.get('10/1/1#1')!.resolve(PNG);
    await flushPromises();
    // Последний запрос (последний жест) обслуживается раньше предыдущего.
    expect(started).toEqual(['10/1/1#1', '10/3/1#3']);
    expect(delivered).toEqual([['10/1/1#1', PNG]]);
  });

  it('drops queued tiles of the previous zoom as soon as a new zoom arrives', () => {
    const delivered: Array<[string, string]> = [];
    const queue = createNativeTileFallbackQueue({
      concurrency: 1,
      resolve: () => new Promise<string>(() => undefined),
      deliver: (key, dataUrl) => delivered.push([key, dataUrl]),
    });
    queue.enqueue(req(10, 1, 1)); // in flight
    queue.enqueue(req(10, 2, 2));
    queue.enqueue(req(10, 3, 3));
    queue.enqueue(req(11, 4, 4));

    expect(delivered).toEqual([
      ['10/2/1#2', ''],
      ['10/3/1#3', ''],
    ]);
    expect(queue.size()).toBe(1);
  });

  it('cancelled keys are neither resolved nor delivered', async () => {
    const started: string[] = [];
    const first = deferred();
    const delivered: string[] = [];
    const queue = createNativeTileFallbackQueue({
      concurrency: 1,
      resolve: (request) => {
        started.push(request.key);
        return request.key === '10/1/1#1' ? first.promise : Promise.resolve(PNG);
      },
      deliver: (key) => delivered.push(key),
    });
    queue.enqueue(req(10, 1, 1));
    queue.enqueue(req(10, 2, 2));
    queue.cancel(['10/1/1#1', '10/2/1#2']);
    first.resolve(PNG);
    await flushPromises();

    expect(started).toEqual(['10/1/1#1']);
    expect(delivered).toEqual([]);
  });
});

describe('createNativeTileBatchInjector', () => {
  it('sends all answers of a frame in one __metravelSetTiles inject', () => {
    const scripts: string[] = [];
    const frames: Array<() => void> = [];
    const batch = createNativeTileBatchInjector({
      inject: (script) => scripts.push(script),
      schedule: (flush) => frames.push(flush),
    });
    batch.push('10/1/1#1', PNG);
    batch.push('10/2/1#2', '');
    batch.push('10/3/1#3', PNG);
    expect(frames).toHaveLength(1);
    expect(scripts).toHaveLength(0);

    frames[0]();
    expect(scripts).toEqual([
      `window.__metravelSetTiles && window.__metravelSetTiles(${JSON.stringify([
        ['10/1/1#1', PNG],
        ['10/2/1#2', ''],
        ['10/3/1#3', PNG],
      ])})`,
    ]);

    batch.push('10/4/1#4', PNG);
    expect(frames).toHaveLength(2);
  });

  it('never injects a non-tile key or a non-PNG payload', () => {
    const scripts: string[] = [];
    const batch = createNativeTileBatchInjector({
      inject: (script) => scripts.push(script),
      schedule: (flush) => flush(),
    });
    batch.push('</script><script>alert(1)</script>', PNG);
    expect(scripts).toHaveLength(0);
    batch.push('10/1/1#1', 'javascript:alert(1)');
    expect(scripts[0]).toContain('["10/1/1#1",""]');
    expect(isSafeTileBridgeKey('10/1/1#1')).toBe(true);
    expect(isSafeTileBridgeKey('10/1/1')).toBe(false);
  });
});

describe('tile capture plan (#2452: cache fill without a second download)', () => {
  it('asks only for viewport tiles missing in the disk cache, as z/x/y keys', async () => {
    const hasFresh = jest.fn(async ({ x }: { x: number }) => x === 2);
    const keys = await planNativeTileCapture({
      tiles: [
        { z: 10, x: 1, y: 3 },
        { z: 10, x: 2, y: 3 },
        { z: 10, x: 3, y: 3 },
      ],
      hasFresh,
    });
    expect(keys).toEqual(['10/1/3', '10/3/3']);
    expect(hasFresh).toHaveBeenCalledTimes(3);
  });

  it('accepts only z/x/y keys with PNG data URLs from TILE_CAPTURE', () => {
    expect(parseNativeTileCaptureEntry(['10/585/333', PNG])).toEqual({ z: 10, x: 585, y: 333, dataUrl: PNG });
    expect(parseNativeTileCaptureEntry(['10/585/333#4', PNG])).toBeNull();
    expect(parseNativeTileCaptureEntry(['../../etc/passwd', PNG])).toBeNull();
    expect(parseNativeTileCaptureEntry(['10/1/1', 'data:image/jpeg;base64,AAAA'])).toBeNull();
    expect(parseNativeTileCaptureEntry('10/1/1')).toBeNull();
    // Outside the tile grid of its zoom / beyond the max zoom.
    expect(parseNativeTileCaptureEntry(['10/1024/1', PNG])).toBeNull();
    expect(parseNativeTileCaptureEntry(['23/1/1', PNG])).toBeNull();
  });
});
