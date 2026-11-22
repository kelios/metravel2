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

    it('the only path is /ai/ask (#2884, #3297): no model url is read; the shared service url is checked when picks are off', () => {
      expect(codes({ ...base, EXPO_PUBLIC_AI_ASSISTANT: '1' }).some((c) => c.startsWith('AI_'))).toBe(false);
      expect(codes({ ...base, EXPO_PUBLIC_AI_ASSISTANT: '1', EXPO_PUBLIC_AI_ASSISTANT_PROVIDER: 'ask', EXPO_PUBLIC_AI_ASSISTANT_URL: 'nope' }).some((c) => c.startsWith('AI_'))).toBe(false);
      expect(codes({ ...base, EXPO_PUBLIC_AI_ASSISTANT: '1', EXPO_PUBLIC_AI_PICKS_URL: 'ws://x' })).toContain('AI_PICKS_URL_INVALID:error');
      const prodLocal = codes({ ...base, NODE_ENV: 'production', EXPO_PUBLIC_AI_ASSISTANT: '1', EXPO_PUBLIC_AI_PICKS_URL: 'http://127.0.0.1:8787' });
      expect(prodLocal).toContain('AI_PICKS_LOCAL_URL_IN_PRODUCTION:error');
      expect(prodLocal).not.toContain('AI_ASSISTANT_LOCAL_URL_IN_PRODUCTION:error');
      // С включёнными блоками подбора ту же диагностику даёт их проверка — не дважды.
      const both = codes({ ...base, NODE_ENV: 'production', EXPO_PUBLIC_AI_ASSISTANT: '1', EXPO_PUBLIC_AI_PICKS: '1', EXPO_PUBLIC_AI_PICKS_URL: 'http://127.0.0.1:8787' });
      expect(both.filter((c) => c === 'AI_PICKS_LOCAL_URL_IN_PRODUCTION:error')).toHaveLength(1);
      expect(codes({ ...base, EXPO_PUBLIC_AI_ASSISTANT: '1', EXPO_PUBLIC_AI_ASSISTANT_PROVIDER: 'openai' })).toContain('AI_ASSISTANT_PROVIDER_INVALID:error');
      expect(codes({ ...base, EXPO_PUBLIC_AI_ASSISTANT_PROVIDER: 'openai' }).some((c) => c.startsWith('AI_'))).toBe(false);
    });

    it('similar blocks source (#3292): static or service; a typo is an error, service without picks is a warning', () => {
      expect(codes({ ...base, EXPO_PUBLIC_AI_SIMILAR_SOURCE: 'static' }).some((c) => c.startsWith('AI_'))).toBe(false);
      expect(codes({ ...base, NODE_ENV: 'production', EXPO_PUBLIC_AI_SIMILAR_SOURCE: ' Static ' }).some((c) => c.startsWith('AI_'))).toBe(false);
      expect(codes({ ...base, EXPO_PUBLIC_AI_SIMILAR_SOURCE: 'statik' })).toContain('AI_SIMILAR_SOURCE_INVALID:error');
      expect(codes({ ...base, EXPO_PUBLIC_AI_SIMILAR_SOURCE: 'service' })).toContain('AI_SIMILAR_SERVICE_WITHOUT_PICKS:warning');
      expect(codes({ ...base, EXPO_PUBLIC_AI_PICKS: '1', EXPO_PUBLIC_AI_SIMILAR_SOURCE: 'service' }).some((c) => c.startsWith('AI_SIMILAR'))).toBe(false);
    });

    it('provider llamacpp is removed (#3297): a configuration error with a hint, with or without a model url', () => {
      const llama = { ...base, EXPO_PUBLIC_AI_ASSISTANT: '1', EXPO_PUBLIC_AI_ASSISTANT_PROVIDER: 'llamacpp' };
      expect(codes(llama)).toContain('AI_ASSISTANT_PROVIDER_REMOVED:error');
      expect(codes({ ...llama, EXPO_PUBLIC_AI_ASSISTANT: 'true', EXPO_PUBLIC_AI_ASSISTANT_PROVIDER: ' LlamaCpp ', EXPO_PUBLIC_AI_ASSISTANT_URL: 'http://127.0.0.1:8080/' })).toContain('AI_ASSISTANT_PROVIDER_REMOVED:error');
      expect(codes(llama)).not.toContain('AI_ASSISTANT_PROVIDER_INVALID:error');
      const [removed] = getRuntimeConfigDiagnostics(llama).filter((d) => d.code === 'AI_ASSISTANT_PROVIDER_REMOVED');
      expect(removed.message).toContain('/ai/ask');
      expect(removed.message).toContain('docs/features/ai-assistant.md');
      // Адрес службы у такой сборки проверяется как у любой другой.
      expect(codes({ ...llama, EXPO_PUBLIC_AI_PICKS_URL: 'ws://x' })).toContain('AI_PICKS_URL_INVALID:error');
      // Выключенный ассистент переменную провайдера не читает.
      expect(codes({ ...base, EXPO_PUBLIC_AI_ASSISTANT_PROVIDER: 'llamacpp' }).some((c) => c.startsWith('AI_'))).toBe(false);
    });

    it('flags the enabled assistant in a production build; the old model url variable is ignored', () => {
      expect(codes({ ...base, NODE_ENV: 'production', EXPO_PUBLIC_AI_ASSISTANT: '1' })).toContain('AI_ASSISTANT_ENABLED_IN_PRODUCTION:warning');
      const prodOldUrl = codes({ ...base, NODE_ENV: 'production', EXPO_PUBLIC_AI_ASSISTANT: '1', EXPO_PUBLIC_AI_ASSISTANT_URL: 'http://127.0.0.1:8080' });
      expect(prodOldUrl.filter((c) => c.startsWith('AI_'))).toEqual(['AI_ASSISTANT_ENABLED_IN_PRODUCTION:warning']);
      const prodRemoved = codes({ ...base, EXPO_PUBLIC_ENV: 'production', EXPO_PUBLIC_AI_ASSISTANT: '1', EXPO_PUBLIC_AI_ASSISTANT_PROVIDER: 'llamacpp' });
      expect(prodRemoved).toEqual(expect.arrayContaining(['AI_ASSISTANT_PROVIDER_REMOVED:error', 'AI_ASSISTANT_ENABLED_IN_PRODUCTION:warning']));
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
