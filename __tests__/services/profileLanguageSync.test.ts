import { createProfileLanguageSync } from '@/services/profileLanguageSync'
import type { SupportedLocale } from '@/i18n/config'

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { for (let index = 0; index < 8; index += 1) await Promise.resolve() }

function setup() {
  const requests: ReturnType<typeof deferred<SupportedLocale>>[] = []
  const save = jest.fn((_owner: string, _language: SupportedLocale, _isCurrent: () => boolean) => {
    const request = deferred<SupportedLocale>()
    requests.push(request)
    return request.promise
  })
  const commit = jest.fn(async (_owner: string, _language: SupportedLocale, _isCurrent: () => boolean) => {})
  const onError = jest.fn()
  const sync = createProfileLanguageSync({ save, commit, onError })
  return { sync, requests, save, commit, onError }
}

describe('profile language serial synchronization', () => {
  it('never writes for a guest or an owner without a deliberate preference', () => {
    const { sync, save } = setup()
    sync.select('pl')
    sync.setOwner('42')
    expect(save).not.toHaveBeenCalled()
  })

  it('serializes and coalesces rapid choices, leaving the last language on the server', async () => {
    const { sync, requests, save, commit } = setup()
    sync.setOwner('42')
    sync.select('pl')
    sync.select('be')
    sync.select('en')
    expect(save.mock.calls.map(([owner, language]) => [owner, language])).toEqual([['42', 'pl']])
    requests[0].resolve('pl')
    await flush()
    expect(commit).not.toHaveBeenCalled()
    expect(save.mock.calls.map(([owner, language]) => [owner, language])).toEqual([['42', 'pl'], ['42', 'en']])
    requests[1].resolve('en')
    await flush()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit.mock.calls[0].slice(0, 2)).toEqual(['42', 'en'])
  })

  it('reports a current failure once and permits a fresh same-language retry', async () => {
    const { sync, requests, save, onError } = setup()
    sync.setOwner('42')
    sync.select('pl')
    requests[0].reject(new Error('offline'))
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledTimes(1)
    sync.select('pl')
    expect(save).toHaveBeenCalledTimes(2)
    requests[1].resolve('pl')
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('ignores a superseded failure and proceeds with the latest choice', async () => {
    const { sync, requests, save, onError } = setup()
    sync.setOwner('42')
    sync.select('pl')
    sync.select('en')
    requests[0].reject(new Error('offline'))
    await flush()
    expect(onError).not.toHaveBeenCalled()
    expect(save).toHaveBeenLastCalledWith('42', 'en', expect.any(Function))
    requests[1].resolve('en')
    await flush()
  })

  it.each(['42', '73'])('keeps the old request lock across logout and login as %s', async (newOwner) => {
    const { sync, requests, save, commit } = setup()
    sync.setOwner('42')
    sync.select('pl')
    sync.select('uk')
    sync.setOwner(null)
    sync.setOwner(newOwner)
    sync.select('en')
    expect(save).toHaveBeenCalledTimes(1)
    requests[0].resolve('pl')
    await flush()
    expect(commit).not.toHaveBeenCalled()
    expect(save.mock.calls.map(([owner, language]) => [owner, language])).toEqual([['42', 'pl'], [newOwner, 'en']])
    requests[1].resolve('en')
    await flush()
  })

  it('discards pending work and errors after teardown/logout', async () => {
    const { sync, requests, save, commit, onError } = setup()
    sync.setOwner('42')
    sync.select('pl')
    sync.select('en')
    sync.setOwner(null)
    requests[0].reject(new Error('obsolete'))
    await flush()
    expect(save).toHaveBeenCalledTimes(1)
    expect(commit).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('treats a successful but unconfirmed response as a visible failure', async () => {
    const { sync, requests, commit, onError } = setup()
    sync.setOwner('42')
    sync.select('pl')
    requests[0].resolve('ru')
    await flush()
    expect(commit).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('rechecks currency during an asynchronous cache commit and queues the next choice', async () => {
    const { sync, requests, save, commit } = setup()
    const cancellation = deferred<void>()
    const patches: SupportedLocale[] = []
    commit.mockImplementation(async (_owner, language, isCurrent) => {
      await cancellation.promise
      if (isCurrent()) patches.push(language)
    })
    sync.setOwner('42')
    sync.select('pl')
    requests[0].resolve('pl')
    await flush()
    sync.select('en')
    expect(save).toHaveBeenCalledTimes(1)
    cancellation.resolve()
    await flush()
    expect(patches).toEqual([])
    expect(save).toHaveBeenLastCalledWith('42', 'en', expect.any(Function))
    requests[1].resolve('en')
    await flush()
    expect(patches).toEqual(['en'])
  })
})
