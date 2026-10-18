import {
  getRuntimeConfigDiagnostics,
  shouldRunRuntimeConfigDiagnostics,
} from '@/utils/runtimeConfigDiagnostics';

describe('getRuntimeConfigDiagnostics', () => {
  describe('site assistant feature flag (#2460)', () => {
    const base = { EXPO_PUBLIC_API_URL: 'https://metravel.by', EXPO_PUBLIC_ORS_API_KEY: 'ok' };
    const codes = (env: Record<string, string | undefined>) =>
      getRuntimeConfigDiagnostics(env).map((d) => `${d.code}:${d.severity}`);

    it('is silent while the flag is off', () => {
      expect(codes(base).some((c) => c.startsWith('AI_ASSISTANT'))).toBe(false);
      expect(codes({ ...base, EXPO_PUBLIC_AI_ASSISTANT: 'false', EXPO_PUBLIC_AI_ASSISTANT_URL: 'nope' }).some((c) => c.startsWith('AI_ASSISTANT'))).toBe(false);
    });

    it('requires an absolute http(s) llama-server url when the flag is on', () => {
      expect(codes({ ...base, EXPO_PUBLIC_AI_ASSISTANT: '1' })).toContain('AI_ASSISTANT_URL_INVALID:error');
      expect(codes({ ...base, EXPO_PUBLIC_AI_ASSISTANT: 'true', EXPO_PUBLIC_AI_ASSISTANT_URL: 'ws://x' })).toContain('AI_ASSISTANT_URL_INVALID:error');
      const dev = codes({ ...base, EXPO_PUBLIC_AI_ASSISTANT: '1', EXPO_PUBLIC_AI_ASSISTANT_URL: 'http://127.0.0.1:8080/' });
      expect(dev.some((c) => c.startsWith('AI_ASSISTANT'))).toBe(false);
    });

    it('flags a local model url and the enabled assistant in a production build', () => {
      const prod = codes({ ...base, NODE_ENV: 'production', EXPO_PUBLIC_AI_ASSISTANT: '1', EXPO_PUBLIC_AI_ASSISTANT_URL: 'http://127.0.0.1:8080' });
      expect(prod).toContain('AI_ASSISTANT_LOCAL_URL_IN_PRODUCTION:error');
      expect(prod).toContain('AI_ASSISTANT_ENABLED_IN_PRODUCTION:warning');
      const prodRemote = codes({ ...base, EXPO_PUBLIC_ENV: 'production', EXPO_PUBLIC_AI_ASSISTANT: '1', EXPO_PUBLIC_AI_ASSISTANT_URL: 'https://metravel.by/ai' });
      expect(prodRemote).toEqual(expect.arrayContaining(['AI_ASSISTANT_ENABLED_IN_PRODUCTION:warning']));
      expect(prodRemote).not.toContain('AI_ASSISTANT_LOCAL_URL_IN_PRODUCTION:error');
    });
  });

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

  it('reports Metro self-proxy API URL', () => {
    const diagnostics = getRuntimeConfigDiagnostics(
      {
        EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8085',
        EXPO_PUBLIC_ORS_API_KEY: 'ok',
      },
      { platformOS: 'web' }
    );
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'API_URL_SELF_PROXY',
          severity: 'error',
        }),
      ])
    );
  });

  it('does not report native self-proxy when local api mode is disabled and resolver falls back to prod', () => {
    const diagnostics = getRuntimeConfigDiagnostics(
      {
        EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8085',
        EXPO_PUBLIC_IS_LOCAL_API: 'false',
        EXPO_PUBLIC_ORS_API_KEY: 'ok',
      },
      { platformOS: 'android' }
    );
    expect(diagnostics.some((d) => d.code === 'API_URL_SELF_PROXY')).toBe(false);
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

describe('shouldRunRuntimeConfigDiagnostics', () => {
  it('skips diagnostics outside dev', () => {
    expect(
      shouldRunRuntimeConfigDiagnostics({
        isDev: false,
        isWeb: true,
        hostname: 'localhost',
        pathname: '/',
      })
    ).toBe(false);
  });

  it('skips diagnostics on travel routes in web dev', () => {
    expect(
      shouldRunRuntimeConfigDiagnostics({
        isDev: true,
        isWeb: true,
        hostname: 'localhost',
        pathname: '/travels/demo-route',
      })
    ).toBe(false);
  });

  it('keeps diagnostics enabled on non-travel web routes in dev', () => {
    expect(
      shouldRunRuntimeConfigDiagnostics({
        isDev: true,
        isWeb: true,
        hostname: 'localhost',
        pathname: '/search',
      })
    ).toBe(true);
  });
});
