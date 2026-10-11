/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir } from './cli-test-utils'

const { createTokenSession, toolTokenSources, readTokenCandidate } = require('@/scripts/lib/metravel-token')
const IDS: Record<string, number> = { 'owner-token': 1, 'qa-token': 104, 'stale-alias': 0 }
let homeDir: string
beforeEach(() => { homeDir = makeTempDir('metravel-token-dedicated-') })
afterEach(() => { removeDir(homeDir) })

const write = (name: string, value: string) => fs.writeFileSync(path.join(homeDir, name), `${value}\n`, { mode: 0o600 })
const files = (sources: any[]) => sources.filter((source) => source.kind === 'file').map((source) => path.basename(source.path))
function verifiedSession(profile: string, expectedUserId: number) {
  const origin = 'https://token.test'
  const fetchImpl = async (url: string, init: any) => {
    const id = IDS[String(init.headers.Authorization).replace(/^Token /, '')]
    return { status: id ? 200 : 401, json: async () => ({ id }), text: async () => '' }
  }
  return createTokenSession({ origin, profile, expectedUserId, homeDir, refreshPolicy: 'never', fixture: { origin, fetchImpl },
    sources: toolTokenSources({ env: {}, homeDir, profile, expectedUserId }) })
}

describe('dedicated per-identity token caches', () => {
  it('owner1 reads its own cache after env overrides and before every alias, never the QA cache', () => {
    const sources = toolTokenSources({ env: { METRAVEL_TOKEN: 'env-token' }, homeDir, profile: 'owner', expectedUserId: 1, order: ['env', 'json', 'home'] })
    expect(files(sources)).toEqual(['.metravel_token.owner', 'metravel-token.json', '.metravel_token'])
    expect(readTokenCandidate(sources)).toBe('env-token')
    write('.metravel_token', 'stale-alias'); write('.metravel_token.qa104', 'qa-token'); write('.metravel_token.owner', 'owner-token')
    expect(readTokenCandidate(toolTokenSources({ env: {}, homeDir, profile: 'owner', expectedUserId: 1 }))).toBe('owner-token')
  })

  it.each([['qa104', 104], ['staff-readonly', 104]])('%s reads the QA cache first and never the owner cache', (profile, id) => {
    write('.metravel_token', 'stale-alias'); write('.metravel_token.owner', 'owner-token'); write('.metravel_token.qa104', 'qa-token')
    const sources = toolTokenSources({ env: {}, homeDir, profile, expectedUserId: id })
    expect(files(sources)).toEqual(['.metravel_token.qa104', '.metravel_token'])
    expect(readTokenCandidate(sources)).toBe('qa-token')
  })

  it.each([['owner', 7], ['editor', 120], [undefined, undefined]])('%s/%s gets no dedicated cache of another identity', (profile, id) => {
    expect(files(toolTokenSources({ env: {}, homeDir, profile, expectedUserId: id, order: ['env', 'json', 'home'] })))
      .toEqual(['metravel-token.json', '.metravel_token'])
  })

  it('owner1 and QA104 both verify while the shared alias holds a stale or foreign token', async () => {
    write('.metravel_token.owner', 'owner-token'); write('.metravel_token.qa104', 'qa-token')
    for (const alias of ['stale-alias', 'owner-token', 'qa-token']) {
      write('.metravel_token', alias)
      await expect(verifiedSession('owner', 1).ensureToken()).resolves.toBe('owner-token')
      await expect(verifiedSession('qa104', 104).ensureToken()).resolves.toBe('qa-token')
    }
  })
})
