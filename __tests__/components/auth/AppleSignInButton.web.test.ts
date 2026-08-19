/**
 * @jest-environment jsdom
 */

// IOS-17 (#1506): аккаунт, созданный в приложении через Apple, не имел пароля и
// потому не мог войти на вебе. Тесты закрывают чистую часть веб-кнопки: гейт
// конфигурации, разбор ответа Apple JS SDK и отделение отмены от ошибки.

import {
  createAppleAuthState,
  getAppleRenderState,
  getAppleWebConfig,
  isAppleWebCancellation,
  isAppleWebConfigured,
  toAppleWebCredential,
} from '@/components/auth/AppleSignInButton.web'

const CLIENT_ID = 'by.metravel.web'

describe('Apple web config gate', () => {
  const originalClientId = process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID
  const originalRedirect = process.env.EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI

  afterEach(() => {
    process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID = originalClientId
    process.env.EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI = originalRedirect
  })

  it('читает Services ID и Return URL из окружения и обрезает пробелы', () => {
    process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID = `  ${CLIENT_ID}  `
    process.env.EXPO_PUBLIC_APPLE_WEB_REDIRECT_URI = ' https://metravel.by/apple/callback '
    expect(getAppleWebConfig()).toEqual({
      clientId: CLIENT_ID,
      redirectUri: 'https://metravel.by/apple/callback',
    })
  })

  it('без Services ID или Return URL провайдер не выпущен', () => {
    expect(isAppleWebConfigured({ clientId: '', redirectUri: 'https://metravel.by/cb' })).toBe(false)
    // `redirectURI` обязателен и в popup-режиме: Apple сверяет его с Return URL.
    expect(isAppleWebConfigured({ clientId: CLIENT_ID, redirectUri: '' })).toBe(false)
    expect(isAppleWebConfigured({ clientId: CLIENT_ID, redirectUri: 'https://metravel.by/cb' })).toBe(true)
  })
})

describe('Apple web render state', () => {
  it('ненастроенный провайдер не занимает места в соц-блоке', () => {
    expect(getAppleRenderState(false, true)).toBe('hidden')
    expect(getAppleRenderState(false, false)).toBe('hidden')
  })

  it('до гидратации держит плейсхолдер той же высоты, а не кнопку', () => {
    expect(getAppleRenderState(true, false)).toBe('hydration-placeholder')
    expect(getAppleRenderState(true, true)).toBe('button')
  })
})

describe('Apple web state', () => {
  it('выдаёт непустое одноразовое значение', () => {
    const first = createAppleAuthState()
    const second = createAppleAuthState()
    expect(first).not.toBe('')
    expect(first).not.toBe(second)
  })
})

describe('toAppleWebCredential', () => {
  it('переводит ответ SDK в контракт /user/apple-login/ и добавляет web-audience', () => {
    expect(
      toAppleWebCredential(
        {
          authorization: { id_token: '  id-token  ', code: '  one-time-code  ', state: 'st-1' },
          user: { name: { firstName: ' Apple ', lastName: ' User ' }, email: 'a@b.c' },
        },
        CLIENT_ID,
        'st-1',
      ),
    ).toEqual({
      identityToken: 'id-token',
      authorizationCode: 'one-time-code',
      givenName: 'Apple',
      familyName: 'User',
      clientId: CLIENT_ID,
    })
  })

  it('на повторном входе Apple не присылает имя — поля остаются пустыми', () => {
    expect(
      toAppleWebCredential(
        { authorization: { id_token: 'id-token', code: 'code', state: 'st-1' } },
        CLIENT_ID,
        'st-1',
      ),
    ).toEqual({
      identityToken: 'id-token',
      authorizationCode: 'code',
      givenName: null,
      familyName: null,
      clientId: CLIENT_ID,
    })
  })

  it('без identity_token сессии нет — отправлять на сервер нечего', () => {
    expect(toAppleWebCredential({ authorization: { code: 'code', state: 'st-1' } }, CLIENT_ID, 'st-1')).toBeNull()
    expect(toAppleWebCredential(null, CLIENT_ID, 'st-1')).toBeNull()
  })

  it('чужой state отбрасывается: ответ пришёл не на наш запрос', () => {
    expect(
      toAppleWebCredential(
        { authorization: { id_token: 'id-token', state: 'other' } },
        CLIENT_ID,
        'st-1',
      ),
    ).toBeNull()
  })
})

describe('isAppleWebCancellation', () => {
  it('закрытое окно Apple — отмена, а не ошибка входа', () => {
    expect(isAppleWebCancellation({ error: 'popup_closed_by_user' })).toBe(true)
    expect(isAppleWebCancellation({ error: 'user_cancelled_authorize' })).toBe(true)
  })

  it('прочие ошибки остаются ошибками', () => {
    expect(isAppleWebCancellation({ error: 'invalid_client' })).toBe(false)
    expect(isAppleWebCancellation(new Error('network'))).toBe(false)
    expect(isAppleWebCancellation(null)).toBe(false)
  })
})
