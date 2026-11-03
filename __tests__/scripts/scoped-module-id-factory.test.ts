/**
 * #2982: Expo serializes the client and the server render bundle concurrently.
 * With one shared counter the client's module ids depended on which serializer
 * ran first, so a warm and a cold transform cache produced different chunks for
 * one sha. Ids must be a function of each environment's own request order.
 */
const { createScopedNumericModuleIdFactory } = require('@/scripts/lib/scopedModuleIdFactory') as {
  createScopedNumericModuleIdFactory: () => (path: string, context?: { platform?: string; environment?: string }) => number
}

const CLIENT = { platform: 'web', environment: 'client' }
const SERVER = { platform: 'web', environment: 'node' }
const clientPaths = ['/app/a.tsx', '/app/b.tsx', '/node_modules/react/index.js']
const serverPaths = ['/node_modules/react/index.js', '/app/server.tsx', '/app/a.tsx']

const assign = (order: 'client-first' | 'server-first' | 'interleaved') => {
  const createModuleId = createScopedNumericModuleIdFactory()
  const client = () => clientPaths.map((path) => createModuleId(path, CLIENT))
  const server = () => serverPaths.map((path) => createModuleId(path, SERVER))
  if (order === 'client-first') return { client: client(), server: server() }
  if (order === 'server-first') {
    const serverIds = server()
    return { client: client(), server: serverIds }
  }
  const ids = { client: [] as number[], server: [] as number[] }
  for (let index = 0; index < clientPaths.length; index += 1) {
    ids.server.push(createModuleId(serverPaths[index], SERVER))
    ids.client.push(createModuleId(clientPaths[index], CLIENT))
  }
  return ids
}

describe('scoped numeric module id factory', () => {
  it('numbers each environment by its own request order, whatever serializes first', () => {
    const expected = { client: [0, 1, 2], server: [0, 1, 2] }
    expect(assign('client-first')).toEqual(expected)
    expect(assign('server-first')).toEqual(expected)
    expect(assign('interleaved')).toEqual(expected)
  })

  it('keeps one id per path inside an environment, shared by all its bundles', () => {
    const createModuleId = createScopedNumericModuleIdFactory()
    expect(createModuleId('/app/render.tsx', SERVER)).toBe(0)
    expect(createModuleId('/app/loader.ts', SERVER)).toBe(1)
    expect(createModuleId('/app/render.tsx', SERVER)).toBe(0)
    expect(createModuleId('/app/a.tsx', CLIENT)).toBe(0)
    expect(createModuleId('/app/b.tsx', CLIENT)).toBe(1)
    // Another platform of one dev server is its own numbering.
    expect(createModuleId('/app/b.tsx', { platform: 'ios', environment: 'client' })).toBe(0)
    expect(createModuleId('/app/a.tsx', CLIENT)).toBe(0)
  })

  // Server bundles of different environments may share one runtime registry
  // (react-server next to node SSR): their ids stay unique, as with Expo's
  // single counter.
  it('never reuses a server id across server environments', () => {
    const createModuleId = createScopedNumericModuleIdFactory()
    expect(createModuleId('/app/render.tsx', SERVER)).toBe(0)
    expect(createModuleId('/app/page.tsx', { platform: 'web', environment: 'react-server' })).toBe(1)
    expect(createModuleId('/app/render.tsx', { platform: 'web', environment: 'react-server' })).toBe(0)
  })
})
