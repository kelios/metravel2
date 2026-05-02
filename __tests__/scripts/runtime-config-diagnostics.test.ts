const {
  SCHEMA_VERSION,
  buildRuntimeConfigReport,
  getRuntimeConfigDiagnostics,
  loadEnvFile,
  parseDotEnv,
  resolveRoutingApiKeyWithSource,
} = require('@/scripts/runtime-config-diagnostics')
const fs = require('fs')
const path = require('path')

const { makeTempDir } = require('./cli-test-utils')

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

  it('loads .env values without overriding explicit environment values', () => {
    const tempRoot = makeTempDir('metravel-runtime-config-')
    const envPath = path.join(tempRoot, '.env')

    try {
      fs.writeFileSync(
        envPath,
        [
          '# local config',
          'EXPO_PUBLIC_API_URL=https://from-file.example',
          'EXPO_PUBLIC_ORS_API_KEY="from-file-key"',
          'EXPO_PUBLIC_ROUTE_SERVICE_KEY=from-file-secondary',
        ].join('\n'),
        'utf8'
      )

      expect(loadEnvFile(envPath, { EXPO_PUBLIC_ORS_API_KEY: 'from-process-key' })).toEqual(
        expect.objectContaining({
          EXPO_PUBLIC_API_URL: 'https://from-file.example',
          EXPO_PUBLIC_ORS_API_KEY: 'from-process-key',
          EXPO_PUBLIC_ROUTE_SERVICE_KEY: 'from-file-secondary',
        })
      )
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('parses quoted and unquoted .env values', () => {
    expect(parseDotEnv("A=one\nB='two'\nC=\"three\"\n# ignored")).toEqual({
      A: 'one',
      B: 'two',
      C: 'three',
    })
  })
})

