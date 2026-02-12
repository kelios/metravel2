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
  ];

  it.each(cases)('matches diagnostics contract for %s', ({ env }) => {
    const appDiagnostics = getAppRuntimeConfigDiagnostics(env as any);
    const scriptDiagnostics = getScriptRuntimeConfigDiagnostics(env);

    expect(normalize(appDiagnostics)).toEqual(normalize(scriptDiagnostics));
  });
});

