/**
 * Regression test for F-2: поля Имя/Фамилия и соцсети оставались пустыми
 * при открытии формы редактирования профиля, хотя профиль содержит значения.
 *
 * Причина: guard `if (hasUnsavedChangesRef.current) return` блокировал
 * первичную гидрацию, т.к. пустая форма считалась «грязной» относительно
 * непустого профиля. Фикс: добавлен hydratedRef, условие стало
 * `if (hydratedRef.current && hasUnsavedChangesRef.current) return`.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { useSettingsProfileForm } from '@/hooks/useSettingsProfileForm'
import { updateUserProfile } from '@/api/user'
import { createQueryWrapper } from '../helpers/testQueryClient'

// Хук использует React Query (useMyTelegramLink) — нужен QueryClientProvider.
const withQueryClient = () => ({ wrapper: createQueryWrapper().Wrapper })

// Мокаем только сетевые зависимости и чистые нормализаторы из api/user.
jest.mock('@/api/user', () => ({
  updateUserProfile: jest.fn(),
  // normalizeAvatar используется внутри хука — реализуем идентично оригиналу
  normalizeAvatar: (raw: unknown): string | null => {
    const str = String(raw ?? '').trim()
    if (!str) return null
    const lower = str.toLowerCase()
    if (lower === 'null' || lower === 'undefined') return null
    return str
  },
  normalizeProfileName: (raw: unknown): string => {
    const str = String(raw ?? '').trim()
    if (!str) return ''
    const lower = str.toLowerCase()
    if (lower === 'null' || lower === 'undefined') return ''
    if (str === 'https://metravel.by/Юлия') return 'Юлия'
    return str
  },
}))

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}))

jest.mock('@/api/client', () => ({
  ApiError: class ApiError extends Error {},
}))

// Минимальный валидный объект профиля
function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    user: 42,
    username: 'testuser',
    first_name: 'Юлия',
    last_name: 'Савран',
    avatar: null,
    youtube: 'https://youtube.com/@test',
    instagram: 'https://instagram.com/test',
    twitter: 'https://twitter.com/test',
    vk: 'https://vk.com/test',
    email_notify_comments: true,
    email_notify_messages: false,
    ...overrides,
  }
}

function makeArgs(profileOverride?: Record<string, unknown> | null) {
  return {
    userId: '42',
    username: 'testuser',
    profile: profileOverride === null ? null : makeProfile(profileOverride ?? {}),
    setProfile: jest.fn(),
    setAvatarPreviewUrl: jest.fn(),
  }
}

describe('useSettingsProfileForm — regression F-2', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ─── Тест 1: гидрация из непустого профиля ───────────────────────────────
  it('гидрирует поля из profile при первом рендере (главный regression)', async () => {
    const args = makeArgs()
    const { result } = renderHook(() => useSettingsProfileForm(args), withQueryClient())

    await waitFor(() => {
      expect(result.current.firstName).toBe('Юлия')
    })

    expect(result.current.lastName).toBe('Савран')
    expect(result.current.youtube).toBe('https://youtube.com/@test')
    expect(result.current.instagram).toBe('https://instagram.com/test')
    expect(result.current.twitter).toBe('https://twitter.com/test')
    expect(result.current.vk).toBe('https://vk.com/test')
  })

  // ─── Тест 2: гидрация при асинхронном приходе profile ────────────────────
  it('заполняет поля, когда profile приходит асинхронно (null → object)', async () => {
    // Сначала profile=null — имитирует загрузку
    const args = makeArgs(null)
    const { result, rerender } = renderHook(
      (props: ReturnType<typeof makeArgs>) => useSettingsProfileForm(props),
      { initialProps: args, ...withQueryClient() },
    )

    // На старте поля пустые
    expect(result.current.firstName).toBe('')
    expect(result.current.lastName).toBe('')

    // Профиль «загрузился»
    const argsWithProfile = makeArgs()
    rerender(argsWithProfile)

    await waitFor(() => {
      expect(result.current.firstName).toBe('Юлия')
    })

    expect(result.current.lastName).toBe('Савран')
    expect(result.current.youtube).toBe('https://youtube.com/@test')
    expect(result.current.instagram).toBe('https://instagram.com/test')
    expect(result.current.twitter).toBe('https://twitter.com/test')
    expect(result.current.vk).toBe('https://vk.com/test')
  })

  // ─── Тест 3: несохранённый ввод НЕ затирается при refresh profile ─────────
  it('не затирает несохранённый ввод при повторном refresh profile', async () => {
    const args = makeArgs()
    const { result, rerender } = renderHook(
      (props: ReturnType<typeof makeArgs>) => useSettingsProfileForm(props),
      { initialProps: args, ...withQueryClient() },
    )

    // Дожидаемся первичной гидрации
    await waitFor(() => {
      expect(result.current.firstName).toBe('Юлия')
    })

    // Пользователь редактирует поле
    act(() => {
      result.current.setFirstName('Новое имя')
    })

    expect(result.current.firstName).toBe('Новое имя')

    // Refresh профиля (напр. после upload аватара): тот же профиль приходит заново
    const refreshedArgs = {
      ...args,
      profile: makeProfile({ avatar: 'https://metravel.by/media/new-avatar.jpg' }),
    }
    rerender(refreshedArgs)

    // Небольшая пауза для эффекта
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    // Несохранённое значение НЕ должно было затереться
    expect(result.current.firstName).toBe('Новое имя')
  })

  // ─── Тест 4 (опц.): email-тоглы гидрируются из profile ──────────────────
  it('гидрирует email-тоглы из profile.email_notify_*', async () => {
    const args = makeArgs({
      email_notify_comments: true,
      email_notify_messages: false,
    })
    const { result } = renderHook(() => useSettingsProfileForm(args), withQueryClient())

    await waitFor(() => {
      expect(result.current.emailNotifyComments).toBe(true)
    })

    expect(result.current.emailNotifyMessages).toBe(false)

    // Проверяем обратную комбинацию
    const args2 = makeArgs({
      email_notify_comments: false,
      email_notify_messages: true,
    })
    const { result: result2 } = renderHook(() => useSettingsProfileForm(args2), withQueryClient())

    await waitFor(() => {
      expect(result2.current.emailNotifyComments).toBe(false)
    })
    expect(result2.current.emailNotifyMessages).toBe(true)
  })
})


describe('useSettingsProfileForm — mutation field ownership (#2691)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('commits only submitted profile fields from a late full response', async () => {
    const args = makeArgs({ language: 'en' })
    const saved = makeProfile({ first_name: 'Updated', language: 'pl' })
    jest.mocked(updateUserProfile).mockResolvedValueOnce(saved)
    const { result } = renderHook(() => useSettingsProfileForm(args), withQueryClient())

    act(() => result.current.setFirstName('Updated'))
    await act(async () => { await result.current.saveProfile() })

    expect(updateUserProfile).toHaveBeenCalledWith('42', {
      first_name: 'Updated',
      last_name: 'Савран',
      youtube: 'https://youtube.com/@test',
      instagram: 'https://instagram.com/test',
      twitter: 'https://twitter.com/test',
      vk: 'https://vk.com/test',
      email_notify_comments: true,
      email_notify_messages: false,
    })
    expect(args.setProfile).toHaveBeenCalledWith(saved, [
      'first_name', 'last_name', 'youtube', 'instagram', 'twitter', 'vk',
      'email_notify_comments', 'email_notify_messages',
    ])
    expect(args.setProfile.mock.calls[0][1]).not.toContain('language')
    expect(args.setProfile.mock.calls[0][1]).not.toContain('avatar')
  })

  it('commits only notification fields from a late full response', async () => {
    const args = makeArgs({ language: 'en' })
    const saved = makeProfile({ email_notify_comments: false, language: 'pl' })
    jest.mocked(updateUserProfile).mockResolvedValueOnce(saved)
    const { result } = renderHook(() => useSettingsProfileForm(args), withQueryClient())

    act(() => result.current.handleEmailNotifyCommentsChange(false))
    await waitFor(() => expect(args.setProfile).toHaveBeenCalledTimes(1))

    expect(updateUserProfile).toHaveBeenCalledWith('42', {
      email_notify_comments: false,
      email_notify_messages: false,
    })
    expect(args.setProfile).toHaveBeenCalledWith(saved, [
      'email_notify_comments', 'email_notify_messages',
    ])
  })
})
