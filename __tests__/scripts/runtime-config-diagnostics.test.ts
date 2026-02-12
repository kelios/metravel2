const {
  SCHEMA_VERSION,
  buildRuntimeConfigReport,
  getRuntimeConfigDiagnostics,
  resolveRoutingApiKeyWithSource,
} = require('@/scripts/runtime-config-diagnostics')

describe('runtime-config-diagnostics script', () => {
  it('resolves routing key with canonical precedence', () => {
    const resolved = resolveRoutingApiKeyWithSource({
      EXPO_PUBLIC_ORS_API_KEY: 'primary',
      EXPO_PUBLIC_ROUTE_SERVICE_KEY: 'secondary',
    })
    expect(resolved).toEqual({
      key: 'primary',
      source: 'EXPO_PUBLIC_ORS_API_KEY',
    })
  })

  it('reports missing API and routing keys', () => {
    const diagnostics = getRuntimeConfigDiagnostics({})
    const codes = diagnostics.map((item) => item.code)
    expect(codes).toContain('API_URL_MISSING')
    expect(codes).toContain('ROUTING_KEY_MISSING')
  })

  it('reports routing key conflict', () => {
    const diagnostics = getRuntimeConfigDiagnostics({
      EXPO_PUBLIC_API_URL: 'https://metravel.by',
      EXPO_PUBLIC_ORS_API_KEY: 'a',
      EXPO_PUBLIC_ROUTE_SERVICE_KEY: 'b',
    })
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ROUTING_KEY_CONFLICT',
          severity: 'warning',
        }),
      ])
    )
  })

  it('builds stable report payload', () => {
    const report = buildRuntimeConfigReport({
      EXPO_PUBLIC_API_URL: 'https://metravel.by',
      EXPO_PUBLIC_ORS_API_KEY: 'key',
    })
    expect(report).toEqual({
      schemaVersion: SCHEMA_VERSION,
      ok: true,
      errorCount: 0,
      warningCount: 0,
      diagnostics: [],
    })
  })
})

