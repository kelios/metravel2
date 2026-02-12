import {
  getRoutingConfigDiagnostics,
  resolveRoutingApiKey,
  resolveRoutingApiKeyWithSource,
} from '@/utils/routingApiKey';

describe('resolveRoutingApiKey', () => {
  it('returns undefined when no supported env key is provided', () => {
    expect(resolveRoutingApiKey({})).toBeUndefined();
  });

  it('prefers EXPO_PUBLIC_ORS_API_KEY when multiple aliases are present', () => {
    const key = resolveRoutingApiKey({
      EXPO_PUBLIC_ORS_API_KEY: 'primary-key',
      EXPO_PUBLIC_ROUTE_SERVICE_KEY: 'secondary-key',
      EXPO_PUBLIC_ROUTE_SERVICE: 'legacy-key',
    });

    expect(key).toBe('primary-key');
  });

  it('uses EXPO_PUBLIC_ROUTE_SERVICE_KEY when primary key is absent', () => {
    const key = resolveRoutingApiKey({
      EXPO_PUBLIC_ROUTE_SERVICE_KEY: 'route-service-key',
    });

    expect(key).toBe('route-service-key');
  });

  it('falls back to legacy EXPO_PUBLIC_ROUTE_SERVICE', () => {
    const key = resolveRoutingApiKey({
      EXPO_PUBLIC_ROUTE_SERVICE: 'legacy-token',
    });

    expect(key).toBe('legacy-token');
  });

  it('trims values and ignores whitespace-only candidates', () => {
    const key = resolveRoutingApiKey({
      EXPO_PUBLIC_ORS_API_KEY: '   ',
      EXPO_PUBLIC_ROUTE_SERVICE_KEY: '  clean-key  ',
    });

    expect(key).toBe('clean-key');
  });
});

describe('resolveRoutingApiKeyWithSource', () => {
  it('returns key and source for active alias', () => {
    const resolved = resolveRoutingApiKeyWithSource({
      EXPO_PUBLIC_ROUTE_SERVICE_KEY: 'route-service-key',
    });

    expect(resolved).toEqual({
      key: 'route-service-key',
      source: 'EXPO_PUBLIC_ROUTE_SERVICE_KEY',
    });
  });
});

describe('getRoutingConfigDiagnostics', () => {
  it('reports missing key', () => {
    const diagnostics = getRoutingConfigDiagnostics({});
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ROUTING_KEY_MISSING',
        }),
      ])
    );
  });

  it('reports legacy alias usage', () => {
    const diagnostics = getRoutingConfigDiagnostics({
      EXPO_PUBLIC_ROUTE_SERVICE: 'legacy-token',
    });
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ROUTING_KEY_LEGACY_ALIAS',
        }),
      ])
    );
  });

  it('reports conflict when multiple aliases have different values', () => {
    const diagnostics = getRoutingConfigDiagnostics({
      EXPO_PUBLIC_ORS_API_KEY: 'a',
      EXPO_PUBLIC_ROUTE_SERVICE_KEY: 'b',
    });
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ROUTING_KEY_CONFLICT',
        }),
      ])
    );
  });

  it('returns no diagnostics when only canonical key is configured', () => {
    const diagnostics = getRoutingConfigDiagnostics({
      EXPO_PUBLIC_ORS_API_KEY: 'canonical-key',
    });
    expect(diagnostics).toEqual([]);
  });
});
