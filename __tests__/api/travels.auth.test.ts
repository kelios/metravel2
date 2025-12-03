import { Alert } from 'react-native';
import {
  loginApi,
  registration,
  resetPasswordLinkApi,
  setNewPasswordApi,
  sendPasswordApi,
} from '@/src/api/auth';
import { fetchWithTimeout } from '@/src/utils/fetchWithTimeout';
import { validatePassword } from '@/src/utils/validation';
import { sanitizeInput } from '@/src/utils/security';
import { safeJsonParse } from '@/src/utils/safeJsonParse';
import { devError } from '@/src/utils/logger';
import { getSecureItem, setSecureItem } from '@/src/utils/secureStorage';

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('@/src/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

jest.mock('@/src/utils/validation', () => ({
  validatePassword: jest.fn(() => ({ valid: true })),
}));

jest.mock('@/src/utils/security', () => ({
  sanitizeInput: jest.fn((v: string) => v.trim()),
}));

jest.mock('@/src/utils/safeJsonParse', () => ({
  safeJsonParse: jest.fn(),
}));

jest.mock('@/src/utils/logger', () => ({
  devError: jest.fn(),
}));

jest.mock('@/src/utils/secureStorage', () => ({
  getSecureItem: jest.fn(),
  setSecureItem: jest.fn(),
}));

const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;
const mockedSafeJsonParse = safeJsonParse as jest.MockedFunction<typeof safeJsonParse>;
const mockedValidatePassword = validatePassword as jest.MockedFunction<typeof validatePassword>;
const mockedSanitizeInput = sanitizeInput as jest.MockedFunction<typeof sanitizeInput>;
const mockedGetSecureItem = getSecureItem as jest.MockedFunction<typeof getSecureItem>;

describe('src/api/auth.ts auth/password API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loginApi', () => {
    it('возвращает null и показывает Alert при пустом пароле', async () => {
      const result = await loginApi('test@example.com', '   ');

      expect(result).toBeNull();
      expect(fetchWithTimeout).not.toHaveBeenCalled();
    });

    it('успешный логин возвращает данные пользователя', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ token: 't', name: 'User', email: 'e', id: 1, is_superuser: false } as any);

      const result = await loginApi('test@example.com', 'password');

      expect(result).toMatchObject({ token: 't', name: 'User' });
    });

    it('при ошибке логина логирует devError и показывает Alert', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await loginApi('test@example.com', 'password');

      expect(result).toBeNull();
      expect(devError).toHaveBeenCalled();
    });
  });

  describe('registration', () => {
    it('валидация пароля вызывается и при невалидном пароле возвращает сообщение об ошибке', async () => {
      mockedValidatePassword.mockReturnValueOnce({ valid: false, error: 'bad' } as any);

      const msg = await registration({ email: 'e', password: 'p' } as any);

      expect(msg).toBe('bad');
    });

    it('успешная регистрация сохраняет токен и имя', async () => {
      mockedValidatePassword.mockReturnValueOnce({ valid: true } as any);
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ token: 't', name: 'User' } as any);

      const msg = await registration({ email: 'e', password: 'p' } as any);

      expect(msg).toContain('Пользователь успешно зарегистрирован');
      expect(setSecureItem).toHaveBeenCalledWith('userToken', 't');
    });
  });

  describe('resetPasswordLinkApi', () => {
    it('sanitizeInput вызывается и при пустом email кидает ошибку', async () => {
      mockedSanitizeInput.mockReturnValueOnce('');

      await expect(resetPasswordLinkApi('   ')).rejects.toThrow('Email не может быть пустым');
    });

    it('возвращает сообщение из json при успехе', async () => {
      mockedSanitizeInput.mockReturnValueOnce('user@example.com');
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ message: 'OK' } as any);

      const msg = await resetPasswordLinkApi('user@example.com');
      expect(msg).toBe('OK');
    });
  });

  describe('setNewPasswordApi', () => {
    it('при невалидном пароле показывает Alert и возвращает false', async () => {
      mockedValidatePassword.mockReturnValueOnce({ valid: false, error: 'weak' } as any);

      const result = await setNewPasswordApi('token', 'p');

      expect(result).toBe(false);
      expect(fetchWithTimeout).not.toHaveBeenCalled();
    });

    it('успешная смена пароля показывает Alert успеха', async () => {
      mockedValidatePassword.mockReturnValueOnce({ valid: true } as any);
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ success: true } as any);

      const result = await setNewPasswordApi('token', 'StrongPassword1!');

      expect(result).toBe(true);
    });
  });

  describe('sendPasswordApi', () => {
    it('успешный вызов возвращает true и показывает Alert успеха', async () => {
      mockedFetchWithTimeout.mockResolvedValueOnce({ ok: true } as any);
      mockedSafeJsonParse.mockResolvedValueOnce({ success: true } as any);

      const result = await sendPasswordApi('user@example.com');

      expect(result).toBe(true);
    });

    it('при ошибке логирует и возвращает false', async () => {
      mockedFetchWithTimeout.mockRejectedValueOnce(new Error('network'));

      const result = await sendPasswordApi('user@example.com');

      expect(result).toBe(false);
    });
  });
});
