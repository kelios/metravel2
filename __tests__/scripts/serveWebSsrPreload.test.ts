/** @jest-environment node */
const fs = require('fs')
const path = require('path')
const { makeTempDir } = require('./cli-test-utils')
const { preloadServerModules } = require('@/scripts/serve-web-ssr')

// Metro's registry is global and the first definition of an id wins (#2817): a
// loader bundle's tree-shaken route module must never be defined before the
// renderer's full one.
describe('serve-web-ssr preload order', () => {
  const fixtures: string[] = []
  afterEach(() => {
    for (const dir of fixtures.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
    delete (globalThis as { __ssrPreloadRegistry?: unknown }).__ssrPreloadRegistry
  })

  it('defines the renderer modules before any loader bundle and shares them with the adapter', async () => {
    const scratch = path.join(process.cwd(), '.codex-temp')
    fs.mkdirSync(scratch, { recursive: true })
    const dir = makeTempDir('ssr-preload-test-', { root: scratch })
    fixtures.push(dir)
    const define = (bundle: string, full: boolean) => `const r = globalThis.__ssrPreloadRegistry ??= { order: [], modules: new Map() };
r.order.push(${JSON.stringify(bundle)}); if (!r.modules.has(2479)) r.modules.set(2479, { full: ${full} });`
    const files: Record<string, string> = {
      '_expo/routes.json': JSON.stringify({ middleware: { file: '_expo/functions/+middleware.js' },
        rendering: { mode: 'ssr', file: '_expo/server/render.js' }, apiRoutes: [],
        htmlRoutes: [{ file: './quests/index.web.tsx', loader: '_expo/loaders/quests/index.js' }, { file: './about.tsx', loader: null }] }),
      '_expo/functions/+middleware.js': define('middleware', false),
      '_expo/server/render.js': define('renderer', true),
      '_expo/loaders/quests/index.js': define('loader', false),
    }
    for (const [name, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
      fs.writeFileSync(path.join(dir, name), text)
    }
    preloadServerModules(dir)
    const registry = (globalThis as { __ssrPreloadRegistry?: { order: string[]; modules: Map<number, { full: boolean }> } }).__ssrPreloadRegistry!
    expect(registry.order).toEqual(['renderer', 'middleware', 'loader'])
    expect(registry.modules.get(2479)).toEqual({ full: true })
    // The adapter resolves the same paths, so its lazy loads hit the module cache.
    const { createNodeEnv } = require('expo-server/vendor/environment/node')
    const env = createNodeEnv({ build: dir })
    await env.getApiRoute({ file: '_expo/loaders/quests/index.js' })
    await env.getMiddleware({ file: '_expo/functions/+middleware.js' })
    expect(registry.order).toEqual(['renderer', 'middleware', 'loader'])
  })
})
