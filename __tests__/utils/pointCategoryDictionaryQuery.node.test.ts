/**
 * @jest-environment node
 *
 * Границы DOM-сигнала обновления словаря категорий точек без браузера: RN-алиас window = global,
 * отсутствие document/Event и SSR. В jsdom 26 (#2735) эти глобалы неизменяемы, поэтому кейсы
 * живут в node-окружении, где подмена глобалов штатна.
 */
import { requestPointCategoryDictionaryRefresh } from '@/utils/pointCategoryDictionaryQuery';

jest.mock('@/api/miscOptimized', () => ({ fetchFiltersOptimized: jest.fn() }));

describe('point category refresh DOM boundary (node env)', () => {
  const originalDescriptors = new Map(
    ['window', 'document', 'Event', 'dispatchEvent'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );

  const replaceGlobal = (key: string, value: unknown) => {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };

  afterEach(() => {
    for (const [key, descriptor] of originalDescriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });

  it('is safe when React Native aliases window to its global without a DOM dispatcher', () => {
    replaceGlobal('dispatchEvent', undefined);
    replaceGlobal('window', globalThis);
    expect(window).toBe(globalThis);
    expect(window.dispatchEvent).toBeUndefined();
    expect(requestPointCategoryDictionaryRefresh).not.toThrow();
  });

  it('does not emit a DOM signal without a document, even if an event dispatcher is polyfilled', () => {
    const dispatchEvent = jest.fn();
    replaceGlobal('document', undefined);
    replaceGlobal('window', { dispatchEvent });
    expect(requestPointCategoryDictionaryRefresh).not.toThrow();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('is safe during server rendering without window', () => {
    replaceGlobal('window', undefined);
    expect(requestPointCategoryDictionaryRefresh).not.toThrow();
  });

  it('does not call the dispatcher when the Event constructor is missing', () => {
    const dispatchEvent = jest.fn();
    replaceGlobal('window', { dispatchEvent });
    replaceGlobal('Event', undefined);
    expect(requestPointCategoryDictionaryRefresh).not.toThrow();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
