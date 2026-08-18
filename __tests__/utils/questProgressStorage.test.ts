import {
  buildQuestProgressStorageKey,
  GUEST_QUEST_STORAGE_PREFIX,
} from '@/utils/questProgressStorage'

describe('buildQuestProgressStorageKey (#1456)', () => {
  it('привязывает ключ прогресса к аккаунту', () => {
    expect(
      buildQuestProgressStorageKey('quest_progress_minsk_murals', { isAuthenticated: true, userId: '17' }),
    ).toBe('quest_progress_minsk_murals__u17')
  })

  it('разводит двух пользователей одного устройства по разным ключам', () => {
    const base = 'quest_progress_minsk_murals'
    expect(buildQuestProgressStorageKey(base, { isAuthenticated: true, userId: '17' })).not.toBe(
      buildQuestProgressStorageKey(base, { isAuthenticated: true, userId: '42' }),
    )
  })

  it('гостю отдаёт гостевой ключ', () => {
    expect(buildQuestProgressStorageKey('quest_progress_hel', { isAuthenticated: false })).toBe(
      `${GUEST_QUEST_STORAGE_PREFIX}quest_progress_hel`,
    )
  })

  it('залогиненному без ещё подтянувшегося id не отдаёт ни гостевой, ни чужой ключ', () => {
    // Вырожденное окно после подтверждения аккаунта: isAuthenticated уже true,
    // userId в сторе появится только со следующим checkAuthentication. Гостевой
    // ключ тут означал бы слияние чужих гостевых ответов с аккаунтом.
    const base = 'quest_progress_hel'
    const pending = buildQuestProgressStorageKey(base, { isAuthenticated: true, userId: null })

    expect(pending).not.toBe(buildQuestProgressStorageKey(base, { isAuthenticated: false }))
    expect(pending).not.toBe(buildQuestProgressStorageKey(base, { isAuthenticated: true, userId: '17' }))
    expect(pending).toBe('quest_progress_hel__u:pending')
    expect(buildQuestProgressStorageKey(base, { isAuthenticated: true, userId: '' })).toBe(pending)
  })

  it('не роняется на пустом storage_key бандла', () => {
    expect(buildQuestProgressStorageKey(undefined, { isAuthenticated: true, userId: '17' })).toBe(
      'quest_progress__u17',
    )
    expect(buildQuestProgressStorageKey('', { isAuthenticated: false })).toBe(
      `${GUEST_QUEST_STORAGE_PREFIX}quest_progress`,
    )
  })

  it('принимает числовой id пользователя', () => {
    expect(
      buildQuestProgressStorageKey('quest_progress_krakow', { isAuthenticated: true, userId: 42 }),
    ).toBe('quest_progress_krakow__u42')
  })
})
