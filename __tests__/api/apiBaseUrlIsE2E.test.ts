// Regression for board #745: api/misc.ts and api/articles.ts must forward the
// EXPO_PUBLIC_E2E flag (isE2E) into resolveApiBaseUrl, otherwise e2e/static
// self-proxy builds hit the absolute https://metravel.by/api and get blocked by
// CORS instead of resolving to the relative /api on the current origin.

const mockResolveApiBaseUrl = jest.fn(() => 'https://example.test/api');

jest.mock('@/utils/resolveApiBaseUrl', () => ({
  resolveApiBaseUrl: (...args: unknown[]) => mockResolveApiBaseUrl(...args),
}));

describe('#745 api modules forward isE2E to resolveApiBaseUrl', () => {
  const originalE2E = process.env.EXPO_PUBLIC_E2E;

  afterEach(() => {
    process.env.EXPO_PUBLIC_E2E = originalE2E;
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
