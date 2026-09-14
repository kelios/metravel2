import { ApiError } from '@/api/clientErrors';
import {
  authFailure,
  authFailureFromError,
  authFailureReasonFromStatus,
  authFailureText,
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
});
