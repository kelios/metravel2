import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const cfg = require('../../metro.config.js')
const adapter = path.join(ROOT, 'metro-stubs/expoAsyncRequire.web.js')
const name = 'expo/internal/async-require-module'
const resolveRequest = (originModulePath: string, environment: string, platform: string) => cfg.resolver.resolveRequest({
  originModulePath, customResolverOptions: { environment },
  resolveRequest: (_context: unknown, moduleName: string) => ({ type: 'sourceFile', filePath: `ORIGINAL:${moduleName}` }),
}, name, platform)

describe('web async-require adapter boundary', () => {
  it('uses the codec adapter only for the web client and delegates its own original import', () => {
    expect(resolveRequest(path.join(ROOT, 'entry.js'), 'client', 'web').filePath).toBe(adapter)
    expect(resolveRequest(adapter, 'client', 'web').filePath).toBe(`ORIGINAL:${name}`)
  })
  it.each([['web', 'node'], ['web', 'react-server'], ['android', 'client'], ['ios', 'client']])(
    'preserves the original module on %s / %s', (platform, environment) => {
      expect(resolveRequest(path.join(ROOT, 'entry.js'), environment, platform).filePath).toBe(`ORIGINAL:${name}`)
    },
  )
})
