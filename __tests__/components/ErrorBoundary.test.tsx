import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { Text } from 'react-native';

// Mock logger
jest.mock('@/utils/logger', () => ({
  logError: jest.fn(),
}));

// Mock window.location.reload for web platform stale-chunk tests.
// Do NOT overwrite global.window — jsdom already provides it and other tests depend on it.
const mockReload = jest.fn();
const mockReplace = jest.fn();
let origLocation: Location;

beforeAll(() => {
  origLocation = (global as any).window?.location;
  // @ts-ignore – jsdom location is not configurable by default
  delete ((global as any).window as any).location;
  (global as any).window.location = { ...origLocation, reload: mockReload, replace: mockReplace };
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
    let origFetch: any;

    const addBundleScripts = (scripts: string[]) => {
      scripts.forEach((src) => {
        const el = document.createElement('script');
        el.setAttribute('src', src);
        el.setAttribute('data-test-react130-bundle', '1');
        document.head.appendChild(el);
      });
    };

    const cleanupBundleScripts = () => {
      document
        .querySelectorAll('script[data-test-react130-bundle="1"]')
        .forEach((el) => el.parentNode?.removeChild(el));
    };

    beforeEach(() => {
      origPlatformOS = Platform.OS;
      origFetch = (global as any).fetch;
      Platform.OS = 'web';
      delete (global as any).window.__metravelModuleReloadTriggered;
      sessionStorage.clear();
      cleanupBundleScripts();
      // Provide minimal stubs for caches + navigator.serviceWorker used by cleanup()
      (global as any).caches = { keys: jest.fn().mockResolvedValue([]), delete: jest.fn() };
      (global as any).navigator = {
        ...(global as any).navigator,
        serviceWorker: { getRegistrations: jest.fn().mockResolvedValue([]) },
      };
    });

    afterEach(() => {
      Platform.OS = origPlatformOS;
      (global as any).fetch = origFetch;
      delete (global as any).window.__metravelModuleReloadTriggered;
      cleanupBundleScripts();
      mockReplace.mockReset();
    });

    const staleChunkMessages = [
      'Loading module https://metravel.by/_expo/static/js/web/Home-68ad15.js failed.',
      'Failed to fetch dynamically imported module: /chunk.js',
      'ChunkLoadError: Loading chunk 42 failed.',
      'Cannot find module "./SomeComponent"',
      '(0 , r(...).getFiltersPanelStyles) is not a function',
      '(0 , r(...).useBreadcrumbModel) is not a function',
      "Class constructors cannot be invoked without 'new'",
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

    it('should auto-recover for React #130 args[]=undefined even when no SW controller is present (strong stale-cache signal)', async () => {
      const consoleError = console.error;
      console.error = jest.fn();

      (global as any).navigator = {
        ...(global as any).navigator,
        serviceWorker: {
          ...(global as any).navigator?.serviceWorker,
          controller: undefined,
        },
      };

      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          '<html><head><script src="/_expo/static/js/web/__common-same.js"></script><script src="/_expo/static/js/web/entry-same.js"></script></head></html>',
      });
      addBundleScripts([
        '/_expo/static/js/web/__common-same.js',
        '/_expo/static/js/web/entry-same.js',
      ]);

      const ThrowReact130UndefinedArgs = () => {
        throw new Error('Minified React error #130; visit https://react.dev/errors/130?args[]=undefined&args[]= for the full message');
      };

      render(
        <ErrorBoundary>
          <ThrowReact130UndefinedArgs />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect((global as any).window.__metravelModuleReloadTriggered).toBe(true);
        expect(mockReplace).toHaveBeenCalled();
      });

      console.error = consoleError;
    });

    it('should auto-recover for React #130 args[]=undefined when a SW controller is present (stale runtime signal)', async () => {
      const consoleError = console.error;
      console.error = jest.fn();

      try {
        Object.defineProperty((global as any).window.navigator, 'serviceWorker', {
          value: {
            getRegistrations: jest.fn().mockResolvedValue([]),
            controller: {},
          },
          configurable: true,
        });
      } catch {
        // noop
      }

      (global as any).navigator = {
        ...(global as any).navigator,
        serviceWorker: {
          ...(global as any).navigator?.serviceWorker,
          controller: {},
        },
      };

      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          '<html><head><script src="/_expo/static/js/web/__common-same.js"></script><script src="/_expo/static/js/web/entry-same.js"></script></head></html>',
      });
      addBundleScripts([
        '/_expo/static/js/web/__common-same.js',
        '/_expo/static/js/web/entry-same.js',
      ]);

      const ThrowReact130UndefinedArgs = () => {
        throw new Error('Minified React error #130; visit https://react.dev/errors/130?args[]=undefined&args[]= for the full message');
      };

      render(
        <ErrorBoundary>
          <ThrowReact130UndefinedArgs />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect((global as any).window.__metravelModuleReloadTriggered).toBe(true);
        expect(mockReplace).toHaveBeenCalled();
      });

      console.error = consoleError;
    });

    it('should show cache clear instructions when stale retry budget is exhausted', async () => {
      const consoleError = console.error;
      console.error = jest.fn();

      const now = Date.now();
      sessionStorage.setItem('metravel:eb:reload_count', '5');
      sessionStorage.setItem('metravel:eb:reload_ts', String(now));
      // Set exhausted flag (as inline script would do)
      sessionStorage.setItem('__metravel_recovery_exhausted', '1');

      const ThrowChunkError = () => {
        throw new Error('ChunkLoadError: Loading chunk 42 failed.');
      };

      const { toJSON } = render(
        <ErrorBoundary>
          <ThrowChunkError />
        </ErrorBoundary>
      );

      // Should show cache clear instructions instead of trying recovery
      const treeStr = JSON.stringify(toJSON());
      expect(treeStr).toContain('Требуется очистка кэша браузера');
      // Should NOT trigger reload when exhausted
      expect(mockReplace).not.toHaveBeenCalled();

      console.error = consoleError;
    });

    it('should show cache clear instructions for React #130 undefined args when exhausted', async () => {
      const consoleError = console.error;
      console.error = jest.fn();

      // Set exhausted flag
      sessionStorage.setItem('__metravel_recovery_exhausted', '1');

      const ThrowReact130UndefinedArgs = () => {
        throw new Error('Minified React error #130; visit https://react.dev/errors/130?args[]=undefined&args[]= for the full message');
      };

      const { toJSON } = render(
        <ErrorBoundary>
          <ThrowReact130UndefinedArgs />
        </ErrorBoundary>
      );

      // Should show cache clear instructions for React #130 with undefined args when exhausted
      const treeStr = JSON.stringify(toJSON());
      expect(treeStr).toContain('Требуется очистка кэша браузера');
      // Should NOT trigger reload when exhausted
      expect(mockReplace).not.toHaveBeenCalled();

      console.error = consoleError;
    });

    it('should NOT auto-recover for React #130 errors without args[]=undefined', async () => {
      const consoleError = console.error;
      console.error = jest.fn();

      const cacheDelete = jest.fn().mockResolvedValue(true);
      (global as any).caches = {
        keys: jest.fn().mockResolvedValue(['third-party-cache']),
        delete: cacheDelete,
      };

      const ThrowReact130 = () => {
        throw new Error('Minified React error #130; visit https://react.dev/errors/130?args[]=object&args[]=SomeComponent for the full message');
      };

      const { toJSON } = render(
        <ErrorBoundary>
          <ThrowReact130 />
        </ErrorBoundary>
      );

      await waitFor(() => {
        const treeStr = JSON.stringify(toJSON());
        expect(treeStr).toContain('Что-то пошло не так');
      });

      expect((global as any).window.__metravelModuleReloadTriggered).toBeUndefined();
      expect(cacheDelete).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('__metravel_emergency_recovery_ts')).toBeNull();
      expect(mockReplace).not.toHaveBeenCalled();

      console.error = consoleError;
    });

    it('should auto-recover for React #130 when fresh HTML has mismatched bundle scripts (non-undefined args)', async () => {
      const consoleError = console.error;
      console.error = jest.fn();

      addBundleScripts([
        '/_expo/static/js/web/__common-old.js',
        '/_expo/static/js/web/entry-old.js',
      ]);

      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          '<html><head><script src="/_expo/static/js/web/__common-new.js"></script><script src="/_expo/static/js/web/entry-new.js"></script></head></html>',
      });

      const ThrowReact130 = () => {
        throw new Error('Minified React error #130; visit https://react.dev/errors/130?args[]=object&args[]= for the full message');
      };

      render(
        <ErrorBoundary>
          <ThrowReact130 />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect((global as any).fetch).toHaveBeenCalled();
        expect((global as any).window.__metravelModuleReloadTriggered).toBe(true);
        expect(mockReplace).toHaveBeenCalled();
      });

      console.error = consoleError;
    });

    it('should NOT auto-recover for React #130 when fresh HTML bundle scripts match (non-undefined args)', async () => {
      const consoleError = console.error;
      console.error = jest.fn();

      addBundleScripts([
        '/_expo/static/js/web/__common-same.js',
        '/_expo/static/js/web/entry-same.js',
      ]);

      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          '<html><head><script src="/_expo/static/js/web/__common-same.js"></script><script src="/_expo/static/js/web/entry-same.js"></script></head></html>',
      });

      const ThrowReact130 = () => {
        throw new Error('Minified React error #130; visit https://react.dev/errors/130?args[]=object&args[]= for the full message');
      };

      const { toJSON } = render(
        <ErrorBoundary>
          <ThrowReact130 />
        </ErrorBoundary>
      );

      await waitFor(() => {
        const treeStr = JSON.stringify(toJSON());
        expect(treeStr).toContain('Что-то пошло не так');
      });

      expect((global as any).fetch).toHaveBeenCalled();
      expect((global as any).window.__metravelModuleReloadTriggered).toBeUndefined();
      expect(mockReplace).not.toHaveBeenCalled();

      console.error = consoleError;
    });

    it('should show cache clear instructions when _cb param indicates recovery loop', async () => {
      const consoleError = console.error;
      console.error = jest.fn();

      // Simulate being in recovery loop (URL has _cb param)
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://metravel.by/map?_cb=123456',
          hostname: 'metravel.by',
          pathname: '/map',
          search: '?_cb=123456',
          replace: mockReplace,
          reload: jest.fn(),
        },
        writable: true,
      });

      const ThrowChunkError = () => {
        throw new Error('ChunkLoadError: Loading chunk 99 failed.');
      };

      const { toJSON } = render(
        <ErrorBoundary>
          <ThrowChunkError />
        </ErrorBoundary>
      );

      const treeStr = JSON.stringify(toJSON());
      // Should show cache clear instructions when in recovery loop
      expect(treeStr).toContain('Требуется очистка кэша браузера');
      // Should NOT trigger another reload
      expect(mockReplace).not.toHaveBeenCalled();

      // Reset location
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://metravel.by/',
          hostname: 'metravel.by',
          pathname: '/',
          search: '',
          replace: mockReplace,
          reload: jest.fn(),
        },
        writable: true,
      });

      console.error = consoleError;
    });

    it.each([
      'Test error',
      'Element type is invalid: expected a string (for built-in components) or a class/function but got: undefined',
    ])('should NOT trigger reload for non-stale errors: %s', (message) => {
      const consoleError = console.error;
      console.error = jest.fn();

      const ThrowNonStaleError = () => {
        throw new Error(message);
      };

      render(
        <ErrorBoundary>
          <ThrowNonStaleError />
        </ErrorBoundary>
      );

      expect((global as any).window.__metravelModuleReloadTriggered).toBeUndefined();

      console.error = consoleError;
    });

    it('should detect AsyncRequireError as stale chunk error and trigger recovery', async () => {
      const consoleError = console.error;
      console.error = jest.fn();

      // Clear any previous state
      sessionStorage.clear();
      (global as any).window.__metravelModuleReloadTriggered = undefined;

      const ThrowAsyncRequireError = () => {
        const error = new Error(
          'AsyncRequireError: Loading module https://metravel.by/_expo/static/js/web/CustomHeader-35c08b6fda505a901ff6d2adcd502571.js failed.'
        );
        error.name = 'AsyncRequireError';
        throw error;
      };

      render(
        <ErrorBoundary>
          <ThrowAsyncRequireError />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect((global as any).window.__metravelModuleReloadTriggered).toBe(true);
      });

      console.error = consoleError;
    });
  });
});

