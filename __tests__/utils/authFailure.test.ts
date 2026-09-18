import { ApiError } from '@/api/clientErrors';
import {
  authFailure,
  authFailureFromError,
  authFailureReasonFromStatus,
  authFailureText,
  authRejectionCode,
} from '@/utils/authFailure';

// #1944: таксономия отказа входа. Разделение «нет связи / отказ сервера / ошибка
// сервера» живёт здесь, потому что раньше все три случая схлопывались в `null`,
// и форма писала «Неверный email или пароль» даже в авиарежиме.
describe('utils/authFailure', () => {
  describe('authFailureReasonFromStatus', () => {
    it.each([400, 401, 403, 409])('статус %s — отказ по сути запроса', (status) => {
      expect(authFailureReasonFromStatus(status)).toBe('rejected');
    });

    it.each([429, 500, 502, 503])('статус %s — ошибка стороны сервера', (status) => {
      expect(authFailureReasonFromStatus(status)).toBe('server');
    });
  });

  describe('authFailureFromError', () => {
    it('транспортный сбой — reason network и дружелюбный текст с тегом', () => {
      const failure = authFailureFromError(new Error('Network request failed'), 'fallback');

      expect(failure.reason).toBe('network');
      expect(failure.message).toMatch(/подключением к интернету/i);
      expect(failure.message).toMatch(/\[[^\]]+ · unreachable · \d{2}:\d{2}:\d{2}Z\]$/);
      // Главный признак дефекта из App Review: текста про пароль в сетевой ветке нет.
      expect(failure.message).not.toMatch(/парол/i);
    });

    it('offline-ответ клиента тоже network, а не отказ сервера', () => {
      const failure = authFailureFromError(new ApiError('offline', 0, { offline: true }), 'fallback');

      expect(failure.reason).toBe('network');
    });

    it('таймаут запроса — network со своим текстом на локализованном сообщении', () => {
      // `fetchWithTimeout` бросает ЛОКАЛИЗОВАННЫЙ текст и ставит имя `TimeoutError`.
      // По тексту таймаут опознавался только в английской локали, а в RU уезжал в
      // `unknown` и терял сообщение «сервер не отвечает».
      const timeout = new Error('Превышено время ожидания (10000 ms). Попробуйте позже.');
      timeout.name = 'TimeoutError';

      const failure = authFailureFromError(timeout, 'Не удалось войти.');

      expect(failure.reason).toBe('network');
      expect(failure.message).not.toBe('Не удалось войти.');
      expect(failure.message).toMatch(/время/i);
      expect(failure.message).toMatch(/\[[^\]]+ · timeout-10s · \d{2}:\d{2}:\d{2}Z\]/);
      expect(failure.message).not.toMatch(/парол/i);
    });

    it('NSURLError на iOS попадает в текст отказа отдельной английской строкой', () => {
      const error = Object.assign(new TypeError('Network request failed https://metravel.by/api/user/login/'), {
        code: -1009,
        domain: 'NSURLErrorDomain',
      });

      const failure = authFailureFromError(error, 'Не удалось войти.');

      expect(failure.reason).toBe('network');
      expect(failure.message).toMatch(/NSURLError -1009 \(notConnectedToInternet\) @ metravel\.by/);
      expect(failure.message).not.toMatch(/парол/i);
    });

    it('офлайн в WebKit («Load failed») — network, а не неизвестная ошибка', () => {
      // Весь mobile web на iPhone: Safari бросает TypeError без ключевых слов.
      const failure = authFailureFromError(new TypeError('Load failed'), 'Не удалось войти.');

      expect(failure.reason).toBe('network');
      expect(failure.message).toMatch(/подключением к интернету/i);
      expect(failure.message).toMatch(/\[[^\]]+ · unreachable · \d{2}:\d{2}:\d{2}Z\]$/);
    });

    it('обычный TypeError из кода приложения не выдаётся за обрыв связи', () => {
      const failure = authFailureFromError(new TypeError('undefined is not a function'), 'Не удалось войти.');

      expect(failure).toEqual({ ok: false, reason: 'unknown', message: 'Не удалось войти.' });
    });

    it('несетевое исключение не протекает сырым текстом в форму', () => {
      const failure = authFailureFromError(new Error('TypeError: x is not a function'), 'Не удалось войти.');

      expect(failure).toEqual({ ok: false, reason: 'unknown', message: 'Не удалось войти.' });
    });
  });

  describe('authFailureText', () => {
    const texts = { rejected: 'Неверный email или пароль.', failed: 'Ошибка при входе' };

    it('сообщение слоя api выигрывает у текста формы', () => {
      expect(authFailureText(authFailure('network', 'Нет связи [api · offline · 00:00:00Z]'), texts)).toBe(
        'Нет связи [api · offline · 00:00:00Z]',
      );
    });

    it('пустое сообщение при rejected — прежний текст про учётные данные', () => {
      expect(authFailureText(authFailure('rejected', '   '), texts)).toBe('Неверный email или пароль.');
    });

    it.each(['network', 'server', 'unknown'] as const)(
      'пустое сообщение при %s — общий текст, но НЕ про пароль',
      (reason) => {
        expect(authFailureText(authFailure(reason, ''), texts)).toBe('Ошибка при входе');
      },
    );
  });

  // #1946: у бэкенда нет `error_code` — на обычный отказ и на неактивированный
  // аккаунт он отдаёт 401 с русской строкой в поле `error`. Классификатор
  // разбирает ТОЛЬКО причину, показываемый текст всегда берётся из i18n.
  describe('authRejectionCode', () => {
    it.each([
      'Аккаунт не активирован. Воспользуйтесь ссылкой активации в письме',
      'АККАУНТ НЕ АКТИВИРОВАН',
      'Акаўнт не актываваны',
      'Акаунт не активований',
      'Konto nie jest aktywne',
      'Account is not activated',
    ])('«%s» — аккаунт не активирован', (detail) => {
      expect(authRejectionCode(detail)).toBe('account_not_activated');
    });

    it.each([
      'Данные входа не корректные',
      'Enter a valid email address.',
      '',
      '   ',
    ])('«%s» — обычный отказ по учётным данным', (detail) => {
      expect(authRejectionCode(detail)).toBe('invalid_credentials');
    });

    it.each([undefined, null])('отсутствующее тело (%s) — обычный отказ', (detail) => {
      expect(authRejectionCode(detail)).toBe('invalid_credentials');
    });
  });
});
