import { getRuntimeConfigDiagnostics as getAppRuntimeConfigDiagnostics } from '@/utils/runtimeConfigDiagnostics';

const {
  getRuntimeConfigDiagnostics: getScriptRuntimeConfigDiagnostics,
} = require('@/scripts/runtime-config-diagnostics');

type EnvCase = Record<string, string | undefined>;

const normalize = (diagnostics: Array<{ code: string; severity: string }>) =>
  diagnostics
    .map((item) => `${item.code}:${item.severity}`)
    .sort();

describe('runtime config diagnostics parity (app vs script)', () => {
  const cases: Array<{ name: string; env: EnvCase }> = [
    {
      name: 'missing API and routing key',
      env: {},
    },
    {
      name: 'canonical secure config',
      env: {
        EXPO_PUBLIC_API_URL: 'https://metravel.by',
        EXPO_PUBLIC_ORS_API_KEY: 'key',
      },
    },
    {
      name: 'legacy routing alias',
      env: {
        EXPO_PUBLIC_API_URL: 'https://metravel.by',
        EXPO_PUBLIC_ROUTE_SERVICE: 'legacy-key',
      },
    },
    {
      name: 'routing alias conflict',
      env: {
        EXPO_PUBLIC_API_URL: 'https://metravel.by',
        EXPO_PUBLIC_ORS_API_KEY: 'a',
        EXPO_PUBLIC_ROUTE_SERVICE_KEY: 'b',
      },
    },
    {
      name: 'unsafe non-local HTTP API URL',
      env: {
        EXPO_PUBLIC_API_URL: 'http://metravel.by',
        EXPO_PUBLIC_ORS_API_KEY: 'key',
      },
    },
    {
      name: 'invalid API URL format',
      env: {
        EXPO_PUBLIC_API_URL: 'not-a-url',
        EXPO_PUBLIC_ORS_API_KEY: 'key',
      },
    },
    {
      name: 'assistant flag without url (#2460)',
      env: {
        EXPO_PUBLIC_API_URL: 'https://metravel.by',
        EXPO_PUBLIC_ORS_API_KEY: 'key',
        EXPO_PUBLIC_AI_ASSISTANT: '1',
      },
    },
    {
      name: 'assistant flag with the removed llamacpp provider in production (#3297)',
      env: {
        NODE_ENV: 'production',
        EXPO_PUBLIC_API_URL: 'https://metravel.by',
        EXPO_PUBLIC_ORS_API_KEY: 'key',
        EXPO_PUBLIC_AI_ASSISTANT: '1',
        EXPO_PUBLIC_AI_ASSISTANT_PROVIDER: 'llamacpp',
        EXPO_PUBLIC_AI_ASSISTANT_URL: 'http://127.0.0.1:8080',
      },
    },
    ...[
      'EXPO_PUBLIC_TRIPS_MOCK',
      'EXPO_PUBLIC_ACHIEVEMENTS_MOCK',
      'EXPO_PUBLIC_SAFETY_MOCK',
      'EXPO_PUBLIC_OSRM_MOCK',
    ].map((flagName) => ({
      name: `production rejects ${flagName}`,
      env: {
        NODE_ENV: 'production',
        EXPO_PUBLIC_API_URL: 'https://metravel.by',
        EXPO_PUBLIC_ORS_API_KEY: 'key',
        [flagName]: 'true',
      },
    })),
  ];

  it.each(cases)('matches diagnostics contract for %s', ({ env }) => {
    const appDiagnostics = getAppRuntimeConfigDiagnostics(env as any);
    const scriptDiagnostics = getScriptRuntimeConfigDiagnostics(env);

    expect(normalize(appDiagnostics)).toEqual(normalize(scriptDiagnostics));
  });

  it.each([
    'EXPO_PUBLIC_TRIPS_MOCK',
    'EXPO_PUBLIC_ACHIEVEMENTS_MOCK',
    'EXPO_PUBLIC_SAFETY_MOCK',
    'EXPO_PUBLIC_OSRM_MOCK',
  ])('reports %s as a production config error', (flagName) => {
    const diagnostics = getScriptRuntimeConfigDiagnostics({
      NODE_ENV: 'production',
      EXPO_PUBLIC_API_URL: 'https://metravel.by',
      EXPO_PUBLIC_ORS_API_KEY: 'key',
      [flagName]: 'true',
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'DEV_MOCK_FLAG_ENABLED', severity: 'error' }),
    );
  });

  it('rejects the legacy numeric true form in production', () => {
    const diagnostics = getScriptRuntimeConfigDiagnostics({
      NODE_ENV: 'production',
      EXPO_PUBLIC_API_URL: 'https://metravel.by',
      EXPO_PUBLIC_ORS_API_KEY: 'key',
      EXPO_PUBLIC_OSRM_MOCK: '1',
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'DEV_MOCK_FLAG_ENABLED', severity: 'error' }),
    );
  });

  // Коды в `.d.ts` пишутся руками: удалённый код остаётся в типе, а новый в него не попадает,
  // и `switch` по `code` в приложении молча теряет ветку (#3297: PROVIDER_REMOVED не был объявлен).
  it('declares in the types exactly the diagnostic codes the JS contract emits', () => {
    const fs = require('fs');
    const path = require('path');
    const read = (file: string) => fs.readFileSync(path.join(process.cwd(), 'utils', file), 'utf8');
    const emitted = [...read('runtimeConfigContract.js').matchAll(/\bcode:\s*'([A-Z0-9_]+)'/g)].map((match) => match[1]);
    const declaration = /export type RuntimeConfigDiagnostic = \{\s*code:([^;]+);/.exec(read('runtimeConfigContract.d.ts'));
    const declared = [...(declaration?.[1] ?? '').matchAll(/'([A-Z0-9_]+)'/g)].map((match) => match[1]);

    expect(emitted.length).toBeGreaterThan(10);
    expect([...new Set(declared)].sort()).toEqual([...new Set(emitted)].sort());
    expect(declared).toHaveLength(new Set(declared).size);
  });
});
