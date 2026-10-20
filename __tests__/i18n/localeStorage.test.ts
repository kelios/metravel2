import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  DEFAULT_LOCALE_PREFERENCE,
  LOCALE_PREFERENCE_STORAGE_KEY,
  SYSTEM_LOCALE_PREFERENCE,
  parseLocalePreference,
  readLocalePreference,
  readPersistedLocalePreference,
  resolveLocalePreference,
  subscribeLocalePreference,
  writeLocalePreference,
  type LocalePreference,
} from '@/i18n/localeStorage'

describe('locale preference storage contract', () => {
  it('accepts a versioned explicit locale', () => {
    const preference = parseLocalePreference(
      JSON.stringify({ version: 1, mode: 'explicit', locale: 'ru' }),
    )

    expect(preference).toEqual({ version: 1, mode: 'explicit', locale: 'ru' })
    expect(resolveLocalePreference(preference)).toBe('ru')
  })

  it.each(['be', 'uk', 'pl', 'en'] as const)('persists the %s locale explicitly', (locale) => {
    const preference = parseLocalePreference(
      JSON.stringify({ version: 1, mode: 'explicit', locale }),
    )

    expect(preference).toEqual({ version: 1, mode: 'explicit', locale })
    expect(resolveLocalePreference(preference)).toBe(locale)
  })

  it.each([null, '', 'invalid json', '{"version":2}', 'null', '{"version":1,"mode":"explicit","locale":"constructor"}', '{"version":1,"mode":"explicit","locale":"xx"}'])(
    'falls back safely for %p',
    (raw) => {
      expect(parseLocalePreference(raw)).toEqual(DEFAULT_LOCALE_PREFERENCE)
    },
  )
})


describe('deliberate locale persistence', () => {
  const getItem = jest.mocked(AsyncStorage.getItem)
  const setItem = jest.mocked(AsyncStorage.setItem)
  const unsubscribers: Array<() => void> = []
  const explicit = (locale: 'ru' | 'pl' | 'en'): LocalePreference => ({ version: 1, mode: 'explicit', locale })
  const deferred = <T,>() => {
    let resolve!: (value: T) => void
    let reject!: (error: Error) => void
    const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject })
    return { promise, resolve, reject }
  }

  beforeEach(() => {
    getItem.mockReset().mockResolvedValue(null)
    setItem.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    for (const unsubscribe of unsubscribers.splice(0)) unsubscribe()
  })

  it.each([null, '', 'null', '{invalid', '{"version":2}', '{"version":1,"mode":"explicit","locale":"xx"}', '{"version":1,"mode":"explicit","locale":"constructor"}'])(
    'does not treat missing/invalid storage %p as an explicit Russian choice', async (raw) => {
      getItem.mockResolvedValue(raw)
      expect(await readPersistedLocalePreference()).toBeNull()
      expect(await readLocalePreference()).toEqual(DEFAULT_LOCALE_PREFERENCE)
    },
  )

  it.each(['ru', 'be', 'uk', 'pl', 'en'] as const)('recognizes a real saved %s preference', async (locale) => {
    const preference = { version: 1, mode: 'explicit', locale }
    getItem.mockResolvedValue(JSON.stringify(preference))
    expect(await readPersistedLocalePreference()).toEqual(preference)
  })

  it('recognizes system mode without converting it to an explicit preference', async () => {
    getItem.mockResolvedValue(JSON.stringify(SYSTEM_LOCALE_PREFERENCE))
    expect(await readPersistedLocalePreference()).toEqual(SYSTEM_LOCALE_PREFERENCE)
  })

  it('retains the fallback but no deliberate preference after a storage read error', async () => {
    getItem.mockRejectedValue(new Error('storage unavailable'))
    expect(await readPersistedLocalePreference()).toBeNull()
    expect(await readLocalePreference()).toEqual(DEFAULT_LOCALE_PREFERENCE)
  })

  it('publishes successful deliberate writes, never reads, and supports unsubscribe', async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeLocalePreference(listener)
    unsubscribers.push(unsubscribe)
    getItem.mockResolvedValue(JSON.stringify(explicit('pl')))
    await readLocalePreference()
    await readPersistedLocalePreference()
    expect(listener).not.toHaveBeenCalled()
    await writeLocalePreference(explicit('pl'))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(explicit('pl'))
    unsubscribe()
    await writeLocalePreference(explicit('en'))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps successful storage writes independent of a failed subscriber', async () => {
    const listener = jest.fn()
    unsubscribers.push(subscribeLocalePreference(() => { throw new Error('subscriber failed') }))
    unsubscribers.push(subscribeLocalePreference(listener))
    await expect(writeLocalePreference(explicit('en'))).resolves.toBeUndefined()
    expect(listener).toHaveBeenCalledWith(explicit('en'))
  })

  it('serializes writes and suppresses an older completion notification', async () => {
    const first = deferred<void>()
    let stored: string | null = null
    const listener = jest.fn()
    unsubscribers.push(subscribeLocalePreference(listener))
    setItem.mockImplementationOnce(async (_key, value) => { await first.promise; stored = value })
    setItem.mockImplementationOnce(async (_key, value) => { stored = value })
    const older = writeLocalePreference(explicit('pl'))
    const latest = writeLocalePreference(explicit('en'))
    await Promise.resolve()
    expect(setItem).toHaveBeenCalledTimes(1)
    first.resolve(undefined)
    await Promise.all([older, latest])
    expect(JSON.parse(stored!)).toEqual(explicit('en'))
    expect(listener.mock.calls).toEqual([[explicit('en')]])
  })

  it('waits for pending writes before reading their final preference', async () => {
    const pending = deferred<void>()
    setItem.mockReturnValueOnce(pending.promise)
    getItem.mockResolvedValue(JSON.stringify(explicit('en')))
    const write = writeLocalePreference(explicit('en'))
    const read = readPersistedLocalePreference()
    await Promise.resolve()
    expect(getItem).not.toHaveBeenCalled()
    pending.resolve(undefined)
    await write
    expect(await read).toEqual(explicit('en'))
  })

  it('repeats a read overtaken by a deliberate write', async () => {
    const staleRead = deferred<string | null>()
    getItem.mockReturnValueOnce(staleRead.promise).mockResolvedValueOnce(JSON.stringify(explicit('en')))
    const read = readPersistedLocalePreference()
    await Promise.resolve()
    expect(getItem).toHaveBeenCalledTimes(1)
    await writeLocalePreference(explicit('en'))
    staleRead.resolve(JSON.stringify(explicit('pl')))
    expect(await read).toEqual(explicit('en'))
    expect(getItem).toHaveBeenCalledTimes(2)
  })

  it('rejects a failed write without events and permits a later explicit retry', async () => {
    const error = new Error('storage full')
    const listener = jest.fn()
    unsubscribers.push(subscribeLocalePreference(listener))
    setItem.mockRejectedValueOnce(error)
    await expect(writeLocalePreference(explicit('pl'))).rejects.toBe(error)
    expect(listener).not.toHaveBeenCalled()
    await writeLocalePreference(explicit('pl'))
    expect(listener.mock.calls).toEqual([[explicit('pl')]])
    expect(setItem).toHaveBeenLastCalledWith(LOCALE_PREFERENCE_STORAGE_KEY, JSON.stringify(explicit('pl')))
  })
})
