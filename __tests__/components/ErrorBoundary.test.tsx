import React from 'react';
import { render } from '@testing-library/react-native';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { Text } from 'react-native';

// Mock logger
jest.mock('@/utils/logger', () => ({
  logError: jest.fn(),
}));

// Mock window.location.reload for web platform stale-chunk tests.
// Do NOT overwrite global.window — jsdom already provides it and other tests depend on it.
const mockReload = jest.fn();
let origLocation: Location;

beforeAll(() => {
  origLocation = (global as any).window?.location;
  // @ts-ignore – jsdom location is not configurable by default
  delete ((global as any).window as any).location;
  (global as any).window.location = { ...origLocation, reload: mockReload };
});

afterAll(() => {
  if ((global as any).window) {
    (global as any).window.location = origLocation;
  }
});

describe('ErrorBoundary', () => {
  // Компонент, который выбрасывает ошибку
  const ThrowError = ({ shouldThrow }: { shouldThrow?: boolean }) => {
    if (shouldThrow) {
      throw new Error('Test error');
    }
    return <Text>No error</Text>;
  };

  it('should render children when there is no error', () => {
    const { toJSON } = render(
      <ErrorBoundary>
        <Text>Test Content</Text>
      </ErrorBoundary>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Test Content');
  });

  it('should render error UI when error occurs', () => {
    // Подавляем ошибку в консоли для теста
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Что-то пошло не так');

    console.error = consoleError;
  });

  it('should call onError callback when error occurs', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // onError вызывается в componentDidCatch
    expect(onError).toHaveBeenCalled();

    console.error = consoleError;
  });

  it('should render custom fallback when provided', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const customFallback = <Text>Custom Error</Text>;
    const { toJSON } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Custom Error');

    console.error = consoleError;
  });

  it('should show error message in error UI', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Test error');

    console.error = consoleError;
  });

  it('should have reset button', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Попробовать снова');

    console.error = consoleError;
  });

  describe('stale chunk / AsyncRequireError detection', () => {
    const { Platform } = require('react-native');
    let origPlatformOS: string;

    beforeEach(() => {
      origPlatformOS = Platform.OS;
      Platform.OS = 'web';
      delete (global as any).window.__metravelModuleReloadTriggered;
      // Provide minimal stubs for caches + navigator.serviceWorker used by cleanup()
      (global as any).caches = { keys: jest.fn().mockResolvedValue([]), delete: jest.fn() };
      (global as any).navigator = {
        ...(global as any).navigator,
        serviceWorker: { getRegistrations: jest.fn().mockResolvedValue([]) },
      };
    });

    afterEach(() => {
      Platform.OS = origPlatformOS;
      delete (global as any).window.__metravelModuleReloadTriggered;
    });

    const staleChunkMessages = [
      'Loading module https://metravel.by/_expo/static/js/web/Home-68ad15.js failed.',
      'Failed to fetch dynamically imported module: /chunk.js',
      'ChunkLoadError: Loading chunk 42 failed.',
      'Spread syntax requires ...iterable not be null or undefined',
      'someValue is not iterable',
    ];

    it.each(staleChunkMessages)(
      'should detect stale chunk error: %s',
      (message) => {
        const consoleError = console.error;
        console.error = jest.fn();

        const ThrowChunkError = () => {
          throw new Error(message);
        };

        render(
          <ErrorBoundary>
            <ThrowChunkError />
          </ErrorBoundary>
        );

        expect((global as any).window.__metravelModuleReloadTriggered).toBe(true);

        console.error = consoleError;
      },
    );

    it('should detect AsyncRequireError by error.name', () => {
      const consoleError = console.error;
      console.error = jest.fn();

      const ThrowAsyncRequireError = () => {
        const err = new Error('some module load failure');
        err.name = 'AsyncRequireError';
        throw err;
      };

      render(
        <ErrorBoundary>
          <ThrowAsyncRequireError />
        </ErrorBoundary>
      );

      expect((global as any).window.__metravelModuleReloadTriggered).toBe(true);

      console.error = consoleError;
    });

    it('should NOT trigger reload for regular errors', () => {
      const consoleError = console.error;
      console.error = jest.fn();

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect((global as any).window.__metravelModuleReloadTriggered).toBeUndefined();

      console.error = consoleError;
    });
  });
});

