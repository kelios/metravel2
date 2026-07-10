// Regression for board #745 and local auth: api modules must forward runtime
// flags into resolveApiBaseUrl, otherwise e2e/local web builds hit an absolute
// API origin and get blocked by CORS instead of resolving to same-origin /api.

const mockResolveApiBaseUrl = jest.fn(() => 'https://example.test/api');

jest.mock('@/utils/resolveApiBaseUrl', () => ({
  resolveApiBaseUrl: (...args: unknown[]) => mockResolveApiBaseUrl(...args),
}));

describe('#745 api modules forward runtime API flags to resolveApiBaseUrl', () => {
  const originalE2E = process.env.EXPO_PUBLIC_E2E;
  const originalLocalApi = process.env.EXPO_PUBLIC_IS_LOCAL_API;

  afterEach(() => {
    process.env.EXPO_PUBLIC_E2E = originalE2E;
    process.env.EXPO_PUBLIC_IS_LOCAL_API = originalLocalApi;
    jest.resetModules();
    mockResolveApiBaseUrl.mockClear();
  });

  const loadWithE2E = (modulePath: string) => {
    process.env.EXPO_PUBLIC_E2E = 'true';
    jest.resetModules();
    mockResolveApiBaseUrl.mockClear();
    jest.isolateModules(() => {
      require(modulePath);
    });
    return mockResolveApiBaseUrl.mock.calls[0]?.[0] as { isE2E?: boolean } | undefined;
  };

  it('api/misc resolves with isE2E: true when EXPO_PUBLIC_E2E=true', () => {
    const opts = loadWithE2E('@/api/misc');
    expect(opts).toBeDefined();
    expect(opts?.isE2E).toBe(true);
  });

  it('api/articles resolves with isE2E: true when EXPO_PUBLIC_E2E=true', () => {
    const opts = loadWithE2E('@/api/articles');
    expect(opts).toBeDefined();
    expect(opts?.isE2E).toBe(true);
  });

  it('api/auth resolves with isLocalApi: true when EXPO_PUBLIC_IS_LOCAL_API=true', () => {
    process.env.EXPO_PUBLIC_IS_LOCAL_API = 'true';
    jest.resetModules();
    mockResolveApiBaseUrl.mockClear();
    jest.isolateModules(() => {
      require('@/api/auth');
    });
    const opts = mockResolveApiBaseUrl.mock.calls[0]?.[0] as { isLocalApi?: boolean } | undefined;
    expect(opts).toBeDefined();
    expect(opts?.isLocalApi).toBe(true);
  });

  it('api/misc resolves with isE2E: false when EXPO_PUBLIC_E2E is unset', () => {
    delete process.env.EXPO_PUBLIC_E2E;
    jest.resetModules();
    mockResolveApiBaseUrl.mockClear();
    jest.isolateModules(() => {
      require('@/api/misc');
    });
    const opts = mockResolveApiBaseUrl.mock.calls[0]?.[0] as { isE2E?: boolean };
    expect(opts.isE2E).toBe(false);
  });
});
