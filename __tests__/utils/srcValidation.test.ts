import {
  validateAIMessage,
  validateImageFile,
  validateEmail,
  validateTextLength,
  validateFileSize,
  validateImageType,
  validatePassword,
} from '@/src/utils/validation';

describe('src/utils/validation', () => {
  describe('validateAIMessage', () => {
    it('rejects empty or non-string messages', () => {
      expect(validateAIMessage('')).toEqual({ valid: false, error: 'Сообщение не может быть пустым' });
      // @ts-expect-error intentional invalid type
      expect(validateAIMessage(undefined)).toEqual({ valid: false, error: 'Сообщение не может быть пустым' });
      // @ts-expect-error intentional invalid type
      expect(validateAIMessage(null)).toEqual({ valid: false, error: 'Сообщение не может быть пустым' });
    });

    it('rejects whitespace-only messages', () => {
      expect(validateAIMessage('   ')).toEqual({ valid: false, error: 'Сообщение не может быть пустым' });
    });

    it('rejects too long messages', () => {
      const longMessage = 'a'.repeat(5001);
      expect(validateAIMessage(longMessage)).toEqual({
        valid: false,
        error: 'Сообщение слишком длинное (максимум 5000 символов)',
      });
    });

    it('rejects too short messages', () => {
      expect(validateAIMessage('a')).toEqual({
        valid: false,
        error: 'Сообщение слишком короткое (минимум 2 символа)',
      });
    });

    it('accepts valid messages', () => {
      expect(validateAIMessage('ok')).toEqual({ valid: true });
      expect(validateAIMessage('достаточно длинное сообщение')).toEqual({ valid: true });
    });
  });

  describe('validateImageFile', () => {
    const makeFile = (size: number, type?: string) => ({ size, type } as File);

    it('returns error when file is not provided', () => {
      // @ts-expect-error intentional invalid type
      expect(validateImageFile(undefined)).toEqual({ valid: false, error: 'Файл не выбран' });
    });

    it('rejects files larger than 10MB', () => {
      const bigSize = 10 * 1024 * 1024 + 1;
      const file = makeFile(bigSize, 'image/jpeg');
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Размер файла превышает');
    });

    it('rejects empty files', () => {
      const file = makeFile(0, 'image/png');
      expect(validateImageFile(file)).toEqual({ valid: false, error: 'Файл пустой' });
    });

    it('rejects unsupported mime types', () => {
      const file = makeFile(1024, 'application/pdf');
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Неподдерживаемый формат файла');
    });

    it('accepts supported image types within size limits', () => {
      const types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
      for (const type of types) {
        const file = makeFile(1024, type);
        expect(validateImageFile(file)).toEqual({ valid: true });
      }
    });
  });

  describe('validateEmail', () => {
    it('rejects empty or non-string emails', () => {
      expect(validateEmail('')).toEqual({ valid: false, error: 'Email не может быть пустым' });
      // @ts-expect-error intentional invalid type
      expect(validateEmail(undefined)).toEqual({ valid: false, error: 'Email не может быть пустым' });
      // @ts-expect-error intentional invalid type
      expect(validateEmail(null)).toEqual({ valid: false, error: 'Email не может быть пустым' });
    });

    it('rejects whitespace-only emails', () => {
      expect(validateEmail('   ')).toEqual({ valid: false, error: 'Email не может быть пустым' });
    });

    it('rejects invalid email formats', () => {
      expect(validateEmail('invalid')).toEqual({ valid: false, error: 'Некорректный формат email' });
      expect(validateEmail('test@')).toEqual({ valid: false, error: 'Некорректный формат email' });
      expect(validateEmail('test@example')).toEqual({ valid: false, error: 'Некорректный формат email' });
    });

    it('rejects too long emails', () => {
      // 248 + 7 ("@ex.com") = 255 > 254, гарантированно триггерим ветку "Email слишком длинный"
      const local = 'a'.repeat(248);
      const email = `${local}@ex.com`;
      const result = validateEmail(email);
      expect(result).toEqual({ valid: false, error: 'Email слишком длинный' });
    });

    it('accepts valid emails', () => {
      expect(validateEmail('user@example.com')).toEqual({ valid: true });
    });
  });

  describe('validateTextLength', () => {
    it('rejects empty or non-string text', () => {
      expect(validateTextLength('', 1, 10, 'Комментарий')).toEqual({
        valid: false,
        error: 'Комментарий не может быть пустым',
      });
      // @ts-expect-error intentional invalid type
      expect(validateTextLength(undefined, 1, 10, 'Комментарий')).toEqual({
        valid: false,
        error: 'Комментарий не может быть пустым',
      });
    });

    it('rejects too short text', () => {
      const result = validateTextLength('a', 2, 10, 'Поле');
      expect(result).toEqual({
        valid: false,
        error: 'Поле слишком короткое (минимум 2 символов)',
      });
    });

    it('rejects too long text', () => {
      const result = validateTextLength('a'.repeat(11), 1, 10, 'Поле');
      expect(result).toEqual({
        valid: false,
        error: 'Поле слишком длинное (максимум 10 символов)',
      });
    });

    it('accepts valid text within bounds', () => {
      expect(validateTextLength('ok', 1, 10, 'Поле')).toEqual({ valid: true });
    });
  });

  describe('validateFileSize', () => {
    it('rejects files that are too large', () => {
      const big = 11 * 1024 * 1024;
      const result = validateFileSize(big, 10);
      expect(result).toEqual({
        valid: false,
        error: 'Файл слишком большой. Максимальный размер: 10MB',
      });
    });

    it('rejects zero-size files', () => {
      const result = validateFileSize(0, 10);
      expect(result).toEqual({
        valid: false,
        error: 'Файл не может быть пустым',
      });
    });

    it('accepts valid file sizes', () => {
      const result = validateFileSize(1024, 10);
      expect(result).toEqual({ valid: true });
    });
  });

  describe('validateImageType', () => {
    it('rejects missing or non-image mime types', () => {
      expect(validateImageType('' as any)).toEqual({
        valid: false,
        error: 'Файл должен быть изображением',
      });
      expect(validateImageType('application/pdf')).toEqual({
        valid: false,
        error: 'Файл должен быть изображением',
      });
    });

    it('rejects unsupported image types with custom allowed list', () => {
      const result = validateImageType('image/webp', ['image/jpeg', 'image/png']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Неподдерживаемый формат. Разрешены:');
    });

    it('accepts allowed image types', () => {
      expect(validateImageType('image/jpeg')).toEqual({ valid: true });
      expect(validateImageType('image/png')).toEqual({ valid: true });
    });
  });

  describe('validatePassword', () => {
    it('rejects empty or non-string passwords', () => {
      expect(validatePassword('')).toEqual({ valid: false, error: 'Пароль не может быть пустым' });
      // @ts-expect-error intentional invalid type
      expect(validatePassword(undefined)).toEqual({ valid: false, error: 'Пароль не может быть пустым' });
      // @ts-expect-error intentional invalid type
      expect(validatePassword(null)).toEqual({ valid: false, error: 'Пароль не может быть пустым' });
    });

    it('rejects whitespace-only passwords', () => {
      expect(validatePassword('   ')).toEqual({ valid: false, error: 'Пароль не может быть пустым' });
    });

    it('rejects too short passwords', () => {
      const result = validatePassword('Aa1');
      expect(result).toEqual({
        valid: false,
        error: 'Пароль должен содержать минимум 8 символов',
      });
    });

    it('rejects too long passwords', () => {
      const long = 'A'.repeat(129) + 'a1';
      const result = validatePassword(long);
      expect(result).toEqual({
        valid: false,
        error: 'Пароль слишком длинный (максимум 128 символов)',
      });
    });

    it('requires lowercase, uppercase and digit', () => {
      expect(validatePassword('AAAAAAAA')).toEqual({
        valid: false,
        error: 'Пароль должен содержать хотя бы одну строчную букву',
      });
      expect(validatePassword('aaaaaaaa')).toEqual({
        valid: false,
        error: 'Пароль должен содержать хотя бы одну заглавную букву',
      });
      expect(validatePassword('Aaaaaaaa')).toEqual({
        valid: false,
        error: 'Пароль должен содержать хотя бы одну цифру',
      });
    });

    it('accepts strong passwords', () => {
      expect(validatePassword('Aa123456')).toEqual({ valid: true });
      expect(validatePassword('СложныйПароль123')).toEqual({ valid: true });
    });
  });
});
