import { runStaleChunkRecovery } from '@/utils/recovery/runtimeRecovery'

let unregister: jest.Mock
let cacheDelete: jest.Mock
let getRegistrations: jest.Mock
let consoleErrorSpy: jest.SpyInstance

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('runStaleChunkRecovery', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    unregister = jest.fn().mockResolvedValue(true)
    getRegistrations = jest.fn().mockResolvedValue([{ unregister }])
    Object.defineProperty((global as any).navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations,
      },
    })

    cacheDelete = jest.fn().mockResolvedValue(true)
    ;(global as any).caches = {
      keys: jest.fn().mockResolvedValue(['metravel-static-v1', 'third-party-cache']),
      delete: cacheDelete,
    }
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    jest.useRealTimers()
  })

  it('purges only metravel caches when purgeAllCaches=false', async () => {
    runStaleChunkRecovery({ purgeAllCaches: false, safetyTimeoutMs: 1000 })

    await flushPromises()

    expect(cacheDelete).toHaveBeenCalledWith('metravel-static-v1')
    expect(cacheDelete).not.toHaveBeenCalledWith('third-party-cache')
    expect(getRegistrations).toHaveBeenCalled()
    expect(unregister).toHaveBeenCalled()
  })

  it('purges all caches when purgeAllCaches=true', async () => {
    runStaleChunkRecovery({ purgeAllCaches: true, safetyTimeoutMs: 1000 })
    await flushPromises()

    expect(cacheDelete).toHaveBeenCalledWith('metravel-static-v1')
    expect(cacheDelete).toHaveBeenCalledWith('third-party-cache')
  })
})
