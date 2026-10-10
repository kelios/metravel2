/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const FIXTURES = ['publicTripsMock', 'plannedTripsMock', 'achievementsMock', 'gamificationMock']
const STUB = path.join(ROOT, 'metro-stubs/dev-fixtures.production.js')
const originalNodeEnv = process.env.NODE_ENV

describe('development fixtures in production web artifacts', () => {
  let resolveRequest: (ctx: any, name: string, platform: string) => any
  beforeAll(() => {
    resolveRequest = require(path.join(ROOT, 'metro.config.js')).resolver.resolveRequest
  })
  afterEach(() => { process.env.NODE_ENV = originalNodeEnv })

  const ctx = (file: string, dev = false) => ({
    dev,
    originModulePath: path.join(ROOT, 'api/publicTrips.ts'),
    customResolverOptions: { environment: 'client' },
    resolveRequest: () => ({ type: 'sourceFile', filePath: file }),
  })

  it.each(FIXTURES)('removes %s by resolved identity, for aliases and relative imports', (name) => {
    process.env.NODE_ENV = 'production'
    const file = path.join(ROOT, `api/${name}.ts`)
    for (const specifier of [`@/api/${name}`, `./${name}`, `../api/${name}`]) {
      expect(resolveRequest(ctx(file), specifier, 'web').filePath).toBe(STUB)
    }
    expect(resolveRequest(ctx(file, true), `./${name}`, 'web').filePath).toBe(file)
    expect(resolveRequest(ctx(file), `./${name}`, 'ios').filePath).toBe(file)
    expect(resolveRequest(ctx(file), `./${name}`, 'android').filePath).toBe(file)
    process.env.NODE_ENV = 'test'
    expect(resolveRequest(ctx(file), `./${name}`, 'web').filePath).toBe(file)
  })

  it('keeps actual API implementations and unrelated names unchanged', () => {
    process.env.NODE_ENV = 'production'
    for (const file of ['api/publicTrips.ts', 'api/plannedTripsRequests.ts', 'utils/publicTripsMock.ts']) {
      const absolute = path.join(ROOT, file)
      expect(resolveRequest(ctx(absolute), file, 'web').filePath).toBe(absolute)
    }
  })

  it('rejects every fixture export instead of returning fake or empty product data', () => {
    const production = require(STUB)
    const names = FIXTURES.flatMap((name) => [...fs.readFileSync(path.join(ROOT, `api/${name}.ts`), 'utf8')
      .matchAll(/export const (\w+)/g)].map((match) => match[1]))
    expect(names.length).toBeGreaterThan(15)
    expect(Object.keys(production).sort()).toEqual(names.sort())
    for (const name of names) {
      expect(() => production[name]).toThrow(`Development fixture ${name} is forbidden in production`)
    }
  })
})

describe('production APIs with forbidden fixtures', () => {
  const originalDev = global.__DEV__
  const mockFlags = ['EXPO_PUBLIC_TRIPS_MOCK', 'EXPO_PUBLIC_ACHIEVEMENTS_MOCK'] as const
  const originalFlags = mockFlags.map((name) => process.env[name])
  const consumers = [
    ['@/api/plannedTripsRequests', 'fetchMyPlannedTrips', 'EXPO_PUBLIC_TRIPS_MOCK'],
    ['@/api/publicTrips', 'fetchPublicTrips', 'EXPO_PUBLIC_TRIPS_MOCK'],
    ['@/api/gamification', 'fetchMyPlaceFirstBadges', 'EXPO_PUBLIC_ACHIEVEMENTS_MOCK'],
    ['@/api/achievementsRequests', 'fetchBadgeCatalog', 'EXPO_PUBLIC_ACHIEVEMENTS_MOCK'],
  ] as const
  beforeEach(() => {
    jest.resetModules()
    process.env.NODE_ENV = 'production'
    global.__DEV__ = false
    mockFlags.forEach((name) => { delete process.env[name] })
    jest.doMock('@/api/plannedTripsMock', () => require(STUB))
    jest.doMock('@/api/publicTripsMock', () => require(STUB))
    jest.doMock('@/api/gamificationMock', () => require(STUB))
    jest.doMock('@/api/achievementsMock', () => require(STUB))
    jest.doMock('@/api/client', () => ({
      apiClient: { get: jest.fn(async () => []) },
      ApiError: class ApiError extends Error {
        constructor(readonly status: number, message: string) { super(message) }
      },
    }))
  })
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    global.__DEV__ = originalDev
    mockFlags.forEach((name, index) => {
      if (originalFlags[index] === undefined) delete process.env[name]
      else process.env[name] = originalFlags[index]
    })
    jest.dontMock('@/api/plannedTripsMock')
    jest.dontMock('@/api/publicTripsMock')
    jest.dontMock('@/api/gamificationMock')
    jest.dontMock('@/api/achievementsMock')
    jest.dontMock('@/api/client')
    jest.resetModules()
  })

  it.each(consumers)('%s loads and fetches real data without touching fixtures', async (module, fetch) => {
    await expect(require(module)[fetch]()).resolves.toEqual([])
    expect(require('@/api/client').apiClient.get).toHaveBeenCalled()
  })

  it.each(consumers)('%s propagates missing endpoints instead of serving fixtures', async (module, fetch) => {
    const { apiClient, ApiError } = require('@/api/client')
    const error = new ApiError(404, 'missing endpoint')
    apiClient.get.mockRejectedValueOnce(error)
    await expect(require(module)[fetch]()).rejects.toBe(error)
  })

  it.each(consumers)('%s still rejects a requested mock flag in production', (module, _fetch, flag) => {
    process.env[flag] = 'true'
    expect(() => require(module)).toThrow(`${flag}=true is forbidden in production`)
  })
})
