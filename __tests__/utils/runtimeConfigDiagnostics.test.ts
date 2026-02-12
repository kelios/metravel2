import { getRuntimeConfigDiagnostics } from '@/utils/runtimeConfigDiagnostics';

describe('getRuntimeConfigDiagnostics', () => {
  it('reports missing API URL', () => {
    const diagnostics = getRuntimeConfigDiagnostics({});
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'API_URL_MISSING',
          severity: 'error',
        }),
      ])
    );
  });

  it('reports invalid API URL format', () => {
    const diagnostics = getRuntimeConfigDiagnostics({
      EXPO_PUBLIC_API_URL: 'not-a-url',
      EXPO_PUBLIC_ORS_API_KEY: 'ok',
    });
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'API_URL_INVALID',
          severity: 'error',
        }),
      ])
    );
  });

  it('reports unsafe non-local HTTP API URL', () => {
    const diagnostics = getRuntimeConfigDiagnostics({
      EXPO_PUBLIC_API_URL: 'http://metravel.by',
      EXPO_PUBLIC_ORS_API_KEY: 'ok',
    });
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'API_URL_UNSAFE_HTTP',
          severity: 'warning',
        }),
      ])
    );
  });

  it('includes routing diagnostics from routing key resolver', () => {
    const diagnostics = getRuntimeConfigDiagnostics({
      EXPO_PUBLIC_API_URL: 'https://metravel.by',
      EXPO_PUBLIC_ROUTE_SERVICE: 'legacy-key',
    });
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ROUTING_KEY_LEGACY_ALIAS',
          severity: 'warning',
        }),
      ])
    );
  });

  it('returns no diagnostics for canonical secure config', () => {
    const diagnostics = getRuntimeConfigDiagnostics({
      EXPO_PUBLIC_API_URL: 'https://metravel.by',
      EXPO_PUBLIC_ORS_API_KEY: 'key',
    });
    expect(diagnostics).toEqual([]);
  });
});

