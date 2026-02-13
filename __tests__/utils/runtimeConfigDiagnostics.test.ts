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

  it('does not report unsafe HTTP for private network IPs', () => {
    for (const ip of ['192.168.50.36', '10.0.0.1', '172.16.0.1', '172.31.255.255']) {
      const diagnostics = getRuntimeConfigDiagnostics({
        EXPO_PUBLIC_API_URL: `http://${ip}`,
        EXPO_PUBLIC_ORS_API_KEY: 'ok',
      });
      expect(diagnostics.some((d) => d.code === 'API_URL_UNSAFE_HTTP')).toBe(false);
    }
  });

  it('still reports unsafe HTTP for public IPs', () => {
    const diagnostics = getRuntimeConfigDiagnostics({
      EXPO_PUBLIC_API_URL: 'http://8.8.8.8',
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

  it('ignores non-EXPO_PUBLIC routing key conflicts when EXPO_PUBLIC keys are present', () => {
    const diagnostics = getRuntimeConfigDiagnostics({
      EXPO_PUBLIC_API_URL: 'https://metravel.by',
      EXPO_PUBLIC_ORS_API_KEY: 'correct-key',
      ORS_API_KEY: 'stale-shell-key',
    });
    expect(diagnostics.some((d) => d.code === 'ROUTING_KEY_CONFLICT')).toBe(false);
  });

  it('reports conflict when multiple EXPO_PUBLIC routing keys differ', () => {
    const diagnostics = getRuntimeConfigDiagnostics({
      EXPO_PUBLIC_API_URL: 'https://metravel.by',
      EXPO_PUBLIC_ORS_API_KEY: 'key-a',
      EXPO_PUBLIC_ROUTE_SERVICE_KEY: 'key-b',
    });
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ROUTING_KEY_CONFLICT',
          severity: 'warning',
        }),
      ])
    );
  });
});

