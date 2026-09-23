/**
 * #2074: помощник прод-приёмки. Проверяются правила, которые не должны
 * сломаться молча: отказ на аккаунт владельца ДО входа, повторное
 * использование сессии только e2e-аккаунта 104 с живой cookie, формат согласия
 * `utils/consent.ts` и пресеты вьюпортов 320/390/1440.
 */
jest.mock('playwright', () => ({ chromium: {}, request: {} }));

const probe = require('../../e2e/prod-probe/prodProbe');

const BASE = 'https://metravel.by';
const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);

const stateWith = (overrides: { expires?: number; userId?: string; domain?: string; origin?: string } = {}) => ({
  cookies: [
    {
      name: 'authToken',
      value: 'x'.repeat(40),
      domain: overrides.domain ?? 'metravel.by',
      path: '/',
      expires: overrides.expires ?? NOW / 1000 + 86_400,
    },
  ],
  origins: [
    {
      origin: overrides.origin ?? BASE,
      localStorage: [{ name: 'userId', value: overrides.userId ?? '104' }],
    },
  ],
});

describe('resolveProbeCredentials (#2074)', () => {
  it('отказывает, если E2E_EMAIL совпадает с E2E_EMAIL2 (владелец), без адреса в тексте ошибки', () => {
    const env = { E2E_EMAIL: 'Owner@Example.com', E2E_PASSWORD: 'p', E2E_EMAIL2: 'owner@example.com' };
    expect(() => probe.resolveProbeCredentials(env)).toThrow(probe.ProdProbeError);
    try {
      probe.resolveProbeCredentials(env);
    } catch (error) {
      expect(String((error as Error).message)).not.toMatch(/example\.com/i);
    }
  });

  it('требует E2E_EMAIL и E2E_PASSWORD', () => {
    expect(() => probe.resolveProbeCredentials({ E2E_EMAIL: 'a@b.c' })).toThrow(probe.ProdProbeError);
  });

  it('пропускает e2e-аккаунт', () => {
    expect(
      probe.resolveProbeCredentials({ E2E_EMAIL: 'e2e@b.c', E2E_PASSWORD: 'p', E2E_EMAIL2: 'owner@b.c' }),
    ).toEqual({ email: 'e2e@b.c', password: 'p' });
  });
});

describe('isReusableState (#2074)', () => {
  it('переиспользует живую сессию аккаунта 104', () => {
    expect(probe.isReusableState(stateWith(), BASE, NOW)).toBe(true);
  });

  it('session-cookie (expires -1) считается живой', () => {
    expect(probe.isReusableState(stateWith({ expires: -1 }), BASE, NOW)).toBe(true);
  });

  it('протухшая или истекающая в ближайшие минуты cookie — новый вход', () => {
    expect(probe.isReusableState(stateWith({ expires: NOW / 1000 - 1 }), BASE, NOW)).toBe(false);
    expect(probe.isReusableState(stateWith({ expires: NOW / 1000 + 60 }), BASE, NOW)).toBe(false);
  });

  it('чужой user id в витрине не переиспользуется', () => {
    expect(probe.isReusableState(stateWith({ userId: '1' }), BASE, NOW)).toBe(false);
  });

  it('cookie другого хоста или витрина другого origin не годятся', () => {
    expect(probe.isReusableState(stateWith({ domain: 'example.com' }), BASE, NOW)).toBe(false);
    expect(probe.isReusableState(stateWith({ origin: 'http://127.0.0.1:8085' }), BASE, NOW)).toBe(false);
  });

  it('пустой или битый файл — новый вход', () => {
    expect(probe.isReusableState(null, BASE, NOW)).toBe(false);
    expect(probe.isReusableState({}, BASE, NOW)).toBe(false);
  });
});

describe('согласие и вьюпорты (#2074)', () => {
  it('buildConsentValue пишет формат utils/consent.ts', () => {
    const value = JSON.parse(probe.buildConsentValue(false, new Date(NOW)));
    expect(value).toEqual({ necessary: true, analytics: false, date: new Date(NOW).toISOString() });
    expect(probe.CONSENT_KEY).toBe('metravel_consent_v1');
    expect(JSON.parse(probe.buildConsentValue(true)).analytics).toBe(true);
  });

  it('пресеты 320/390/1440 и явный размер', () => {
    expect(probe.resolveViewport('narrow').width).toBe(320);
    expect(probe.resolveViewport('mobile').width).toBe(390);
    expect(probe.resolveViewport('desktop').width).toBe(1440);
    expect(probe.resolveViewport({ width: 500, height: 700 })).toEqual({ width: 500, height: 700 });
    expect(() => probe.resolveViewport('tablet')).toThrow(probe.ProdProbeError);
  });
});

describe('секреты в выводе (#2074, ревью P2/P3)', () => {
  it('formatProbeError отрезает Call log Playwright и маскирует cookie', () => {
    const error = new Error(
      'apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:1\nCall log:\n  - → GET http://127.0.0.1:1/\n    - cookie: authToken=FAKE_SECRET_TOKEN_123',
    );
    const text = probe.formatProbeError(error);
    expect(text).toBe('apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:1');
    expect(probe.formatProbeError(new Error('bad cookie: authToken=abc; set-cookie: authToken=def'))).not.toMatch(
      /abc|def/,
    );
  });

  it('redactSecrets вырезает токены из тел ответов на любой глубине', () => {
    expect(
      probe.redactSecrets({ id: 104, userToken: 't', data: [{ refreshToken: 'r', name: 'ok' }] }),
    ).toEqual({ id: 104, userToken: '[redacted]', data: [{ refreshToken: '[redacted]', name: 'ok' }] });
  });

  it.each([
    '/api/user/login/',
    '/api/user/google-login/',
    '/api/user/apple-login/',
    '/api/user/facebook-login/callback/',
    '/api/user/confirm-registration/',
    '/api/user/set-password-after-reset/',
    '/api/user/refresh/',
  ])('тело %s не отдаётся', (pathname) => {
    expect(probe.SECRET_BODY_URL_RE.test(`https://metravel.by${pathname}`)).toBe(true);
  });

  it('обычные эндпоинты читаются', () => {
    expect(probe.SECRET_BODY_URL_RE.test('https://metravel.by/api/trips/planned/59/')).toBe(false);
  });
});
