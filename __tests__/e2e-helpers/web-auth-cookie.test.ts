import { WEB_AUTH_COOKIE_NAME, hasWebAuthCookie } from '../../e2e/helpers/auth';

/**
 * #1950: `ensureWebAuthCookie()` подменяет cookie сессии только тогда, когда её
 * нет. Проверку нельзя строить на `context.cookies(url)`: playwright-core 1.61.1
 * (`lib/coreBundle.js:12641`) выбрасывает Secure-cookie для любого не-`https:`
 * URL, host которого не `localhost`. Дефолтный e2e-таргет —
 * `http://127.0.0.1:8085`, cookie бэкенда `Secure` (`AUTH_TOKEN_COOKIE_SECURE`),
 * поэтому фильтр отвечал бы «сессии нет» на контексте с настоящим входом.
 */
const realSessionCookie = {
  name: WEB_AUTH_COOKIE_NAME,
  value: 'a'.repeat(40),
  domain: '127.0.0.1',
  path: '/',
};

describe('hasWebAuthCookie (#1950)', () => {
  it('видит Secure-cookie сессии на http-таргете 127.0.0.1', () => {
    expect(hasWebAuthCookie([realSessionCookie], 'http://127.0.0.1:8085')).toBe(true);
  });

  it('видит cookie сессии на https-таргете', () => {
    expect(hasWebAuthCookie([{ ...realSessionCookie, domain: 'metravel.by' }], 'https://metravel.by/travel/1')).toBe(
      true,
    );
  });

  it('не считает сессией cookie чужого хоста', () => {
    expect(hasWebAuthCookie([{ ...realSessionCookie, domain: 'localhost' }], 'http://127.0.0.1:8085')).toBe(
      false,
    );
  });

  it('принимает cookie домена с точкой для поддомена', () => {
    expect(hasWebAuthCookie([{ ...realSessionCookie, domain: '.metravel.by' }], 'https://www.metravel.by/')).toBe(
      true,
    );
  });

  it('не считает сессией cookie другого пути', () => {
    expect(hasWebAuthCookie([{ ...realSessionCookie, path: '/admin' }], 'http://127.0.0.1:8085/travel/1')).toBe(
      false,
    );
  });

  it('пустое значение и чужое имя сессией не являются', () => {
    expect(hasWebAuthCookie([{ ...realSessionCookie, value: '' }], 'http://127.0.0.1:8085')).toBe(false);
    expect(hasWebAuthCookie([{ ...realSessionCookie, name: 'csrftoken' }], 'http://127.0.0.1:8085')).toBe(false);
    expect(hasWebAuthCookie([], 'http://127.0.0.1:8085')).toBe(false);
  });
});
