import {
  registrationSchema,
  loginSchema,
  resetPasswordSchema,
  setNewPasswordSchema,
  travelSchema,
  feedbackSchema,
  isValidEmail,
  isValidPassword,
  meetsPasswordRequirements,
} from '@/utils/validation'

// Набор unit-тестов для yup-схем и вспомогательных функций в utils/validation.ts

const expectValidationError = async (schema: any, data: any, path: string, message: string) => {
  await expect(schema.validate(data)).rejects.toMatchObject({
    path,
    errors: expect.arrayContaining([message]),
  })
}

describe('utils/validation - yup schemas', () => {
  describe('registrationSchema', () => {
    it('accepts valid registration data', async () => {
      const data = {
        username: 'User_123',
        email: 'user@example.com',
        password: 'Aa123456',
        confirmPassword: 'Aa123456',
      }

      await expect(registrationSchema.validate(data)).resolves.toMatchObject(data)
    })

    it('rejects invalid username (too short, too long, invalid chars)', async () => {
      await expectValidationError(
        registrationSchema,
        { username: '', email: 'u@e.com', password: 'Aa123456', confirmPassword: 'Aa123456' },
        'username',
        'Имя пользователя обязательно',
      )

      await expectValidationError(
        registrationSchema,
        { username: 'ab', email: 'u@e.com', password: 'Aa123456', confirmPassword: 'Aa123456' },
        'username',
        'Имя пользователя должно содержать минимум 3 символа',
      )

      const long = 'a'.repeat(51)
      await expectValidationError(
        registrationSchema,
        { username: long, email: 'u@e.com', password: 'Aa123456', confirmPassword: 'Aa123456' },
        'username',
        'Имя пользователя не должно превышать 50 символов',
      )

      await expectValidationError(
        registrationSchema,
        { username: 'invalid name', email: 'u@e.com', password: 'Aa123456', confirmPassword: 'Aa123456' },
        'username',
        'Имя пользователя может содержать только буквы, цифры и подчеркивание',
      )
    })

    it('rejects invalid email', async () => {
      await expectValidationError(
        registrationSchema,
        { username: 'User_1', email: 'invalid', password: 'Aa123456', confirmPassword: 'Aa123456' },
        'email',
        'Введите корректный email адрес',
      )
    })

    it('rejects weak password and mismatched confirmPassword', async () => {
      await expectValidationError(
        registrationSchema,
        { username: 'User_1', email: 'u@e.com', password: 'short', confirmPassword: 'short' },
        'password',
        'Пароль должен содержать минимум 8 символов',
      )

      await expectValidationError(
        registrationSchema,
        { username: 'User_1', email: 'u@e.com', password: 'password', confirmPassword: 'password' },
        'password',
        'Пароль должен содержать хотя бы одну заглавную букву, одну строчную букву и одну цифру',
      )

      await expectValidationError(
        registrationSchema,
        { username: 'User_1', email: 'u@e.com', password: 'Aa123456', confirmPassword: 'Aa123' },
        'confirmPassword',
        'Пароли не совпадают',
      )
    })
  })

  describe('loginSchema', () => {
    it('accepts valid login data', async () => {
      const data = { email: 'user@example.com', password: 'secret' }
      await expect(loginSchema.validate(data)).resolves.toMatchObject(data)
    })

    it('rejects missing email and password', async () => {
      await expectValidationError(loginSchema, { email: '', password: 'secret' }, 'email', 'Email обязателен')
      await expectValidationError(loginSchema, { email: 'user@example.com', password: '' }, 'password', 'Пароль обязателен')
    })
  })

  describe('resetPasswordSchema', () => {
    it('accepts valid email', async () => {
      await expect(resetPasswordSchema.validate({ email: 'user@example.com' })).resolves.toBeTruthy()
    })

    it('rejects invalid email', async () => {
      await expectValidationError(
        resetPasswordSchema,
        { email: 'invalid' },
        'email',
        'Введите корректный email адрес',
      )
    })
  })

  describe('setNewPasswordSchema', () => {
    it('accepts valid new password', async () => {
      const data = { password: 'Aa123456', confirmPassword: 'Aa123456' }
      await expect(setNewPasswordSchema.validate(data)).resolves.toMatchObject(data)
    })

    it('rejects weak password and mismatched confirmation', async () => {
      await expectValidationError(
        setNewPasswordSchema,
        { password: 'short', confirmPassword: 'short' },
        'password',
        'Пароль должен содержать минимум 8 символов',
      )

      await expectValidationError(
        setNewPasswordSchema,
        { password: 'password', confirmPassword: 'password' },
        'password',
        'Пароль должен содержать хотя бы одну заглавную букву, одну строчную букву и одну цифру',
      )

      await expectValidationError(
        setNewPasswordSchema,
        { password: 'Aa123456', confirmPassword: 'different' },
        'confirmPassword',
        'Пароли не совпадают',
      )
    })
  })

  describe('travelSchema', () => {
    const validBase = {
      name: 'Путешествие',
      description: 'Описание',
      recommendation: null,
      plus: null,
      minus: null,
      year: '2024',
      number_days: 7,
      countries: ['BY'],
      categories: ['city'],
      youtube_link: null,
    }

    it('accepts fully valid travel entity', async () => {
      await expect(travelSchema.validate(validBase)).resolves.toMatchObject(validBase)
    })

    it('rejects invalid year format and range', async () => {
      await expectValidationError(
        travelSchema,
        { ...validBase, year: '20' },
        'year',
        'Год должен быть 4 цифры (например, 2024)',
      )

      await expectValidationError(
        travelSchema,
        { ...validBase, year: '1899' },
        'year',
        'Год должен быть между 1900 и текущим годом',
      )
    })

    it('rejects invalid number_days', async () => {
      await expectValidationError(
        travelSchema,
        { ...validBase, number_days: 0 },
        'number_days',
        'Количество дней должно быть положительным числом',
      )
    })

    it('requires at least one country and category', async () => {
      await expectValidationError(
        travelSchema,
        { ...validBase, countries: [] },
        'countries',
        'Выберите хотя бы одну страну',
      )

      await expectValidationError(
        travelSchema,
        { ...validBase, categories: [] },
        'categories',
        'Выберите хотя бы одну категорию',
      )
    })

    it('validates youtube_link format when provided', async () => {
      await expectValidationError(
        travelSchema,
        { ...validBase, youtube_link: 'https://example.com/video' },
        'youtube_link',
        'Ссылка должна быть на YouTube',
      )

      await expect(
        travelSchema.validate({ ...validBase, youtube_link: 'https://www.youtube.com/watch?v=abc123' }),
      ).resolves.toBeTruthy()
    })
  })

  describe('feedbackSchema', () => {
    it('accepts valid feedback data', async () => {
      const data = { name: 'Иван', email: 'user@example.com', message: 'Длинное сообщение об ошибке' }
      await expect(feedbackSchema.validate(data)).resolves.toMatchObject(data)
    })

    it('rejects too short name and message', async () => {
      await expectValidationError(
        feedbackSchema,
        { name: 'И', email: 'user@example.com', message: 'Сообщение об ошибке' },
        'name',
        'Имя должно содержать минимум 2 символа',
      )

      await expectValidationError(
        feedbackSchema,
        { name: 'Иван', email: 'user@example.com', message: 'Коротко' },
        'message',
        'Сообщение должно содержать минимум 10 символов',
      )
    })
  })
})

describe('utils/validation - helpers', () => {
  describe('isValidEmail', () => {
    it('returns true for valid email and false for invalid', async () => {
      await expect(isValidEmail('user@example.com')).resolves.toBe(true)
      await expect(isValidEmail('invalid')).resolves.toBe(false)
    })
  })

  describe('isValidPassword', () => {
    it('uses registrationSchema password rules', async () => {
      await expect(isValidPassword('Aa123456')).resolves.toBe(true)
      await expect(isValidPassword('weak')).resolves.toBe(false)
    })
  })

  describe('meetsPasswordRequirements', () => {
    it('rejects empty and too short passwords with proper messages', () => {
      expect(meetsPasswordRequirements('')).toEqual({ valid: false, error: 'Пароль обязателен' })
      expect(meetsPasswordRequirements('short')).toEqual({
        valid: false,
        error: 'Пароль должен содержать минимум 8 символов',
      })
    })

    it('requires lowercase, uppercase and digit', () => {
      expect(meetsPasswordRequirements('AAAAAAAA')).toEqual({
        valid: false,
        error: 'Пароль должен содержать хотя бы одну строчную букву',
      })

      expect(meetsPasswordRequirements('aaaaaaaa')).toEqual({
        valid: false,
        error: 'Пароль должен содержать хотя бы одну заглавную букву',
      })

      expect(meetsPasswordRequirements('Aaaaaaaa')).toEqual({
        valid: false,
        error: 'Пароль должен содержать хотя бы одну цифру',
      })
    })

    it('accepts strong passwords', () => {
      expect(meetsPasswordRequirements('Aa123456')).toEqual({ valid: true })
      expect(meetsPasswordRequirements('СложныйПароль123')).toEqual({ valid: true })
    })
  })
})
