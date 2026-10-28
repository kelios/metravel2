/**
 * PERF-012 regression guard for the PERF-014 lever (the biggest perf win:
 * −910KB / −47.4% eager web bundle).
 *
 * The eager web bundle shipped react-native-gesture-handler + react-native-reanimated
 * (~910KB transformed) on every page only because of entry.js's native-guarded
 * `require('react-native-gesture-handler')`. The fix is a metro.config web resolver
 * that maps the bare specifier to `metro-stubs/react-native-gesture-handler.js`
 * (default-on, opt-out `DISABLE_GH_STUB=1`).
 *
 * If that resolver is removed, the stub loses an export the app imports, or the
 * native require stops being platform-guarded, these tests fail — catching a
 * regression that would re-bloat every page by ~350KB gz.
 */

import fs from 'fs'
import path from 'path'
import { makeTempDir, runNodeCli } from './cli-test-utils'

const ROOT = path.resolve(__dirname, '..', '..')
const STUB_REL = 'metro-stubs/react-native-gesture-handler.js'
const ROUTE_CONTEXT_STUB_REL = 'metro-stubs/expo-router-context.web.js'
const EXPO_CHUNK_PATCH_REL = 'patches/@expo+metro-config+58.0.19.patch'
const EXPO_CHUNK_SERIALIZER_REL =
  'node_modules/@expo/metro-config/build/serializer/serializeChunks.js'
const EXPO_GRANULAR_STRATEGY_REL =
  'node_modules/@expo/metro-config/build/serializer/chunking/createGranularChunkingStrategy.js'
const EXPO_SERIALIZERS_REL = 'node_modules/@expo/metro-config/build/serializer/withExpoSerializers.js'
const EXPO_OLD_STRATEGY_REL =
  'node_modules/@expo/metro-config/build/serializer/chunking/createMetravelRouteSharedChunkingStrategy.js'
const EXPO_ASYNC_RUNTIME_REL = 'node_modules/expo/src/async-require/asyncRequireModule.ts'

describe('PERF-014 gesture-handler web stub — metro.config resolver', () => {
  let resolveRequest: (ctx: any, name: string, platform: string) => any

  beforeAll(() => {
    jest.resetModules()
    const cfg = require(path.join(ROOT, 'metro.config.js'))
    resolveRequest = cfg?.resolver?.resolveRequest
  })

  const ctx = {
    customResolverOptions: { environment: 'client' },
    resolveRequest: (_c: any, name: string) => ({ filePath: `ORIG:${name}`, type: 'sourceFile' }),
  }

  afterEach(() => {
    delete process.env.DISABLE_GH_STUB
  })

  it('exposes a resolveRequest function', () => {
    expect(typeof resolveRequest).toBe('function')
  })

  it('resolves react-native-gesture-handler to the web stub by default on web', () => {
    delete process.env.DISABLE_GH_STUB
    const r = resolveRequest(ctx, 'react-native-gesture-handler', 'web')
    expect(r.filePath.replace(/\\/g, '/').endsWith(STUB_REL)).toBe(true)
  })

  it('falls through to the real module on web when DISABLE_GH_STUB=1', () => {
    process.env.DISABLE_GH_STUB = '1'
    const r = resolveRequest(ctx, 'react-native-gesture-handler', 'web')
    expect(r.filePath).toBe('ORIG:react-native-gesture-handler')
  })

  it('does NOT stub on native platforms (ios/android keep real gestures)', () => {
    for (const platform of ['ios', 'android']) {
      const r = resolveRequest(ctx, 'react-native-gesture-handler', platform)
      expect(r.filePath).toBe('ORIG:react-native-gesture-handler')
    }
  })

  it('uses the lazy platform-filtered route context on web only', () => {
    const web = resolveRequest(ctx, 'expo-router/_ctx', 'web')
    expect(web.filePath.replace(/\\/g, '/').endsWith(ROUTE_CONTEXT_STUB_REL)).toBe(true)

    for (const platform of ['ios', 'android']) {
      const native = resolveRequest(ctx, 'expo-router/_ctx', platform)
      expect(native.filePath).toBe('ORIG:expo-router/_ctx')
    }

    const source = fs.readFileSync(path.join(ROOT, ROUTE_CONTEXT_STUB_REL), 'utf8')
    expect(source).toContain('android|ios|native')
    expect(source).toMatch(/['"]lazy['"]/)
  })

  it('keeps the stock route context for every web server renderer', () => {
    for (const environment of ['node', 'react-server']) {
      const server = resolveRequest(
        { ...ctx, customResolverOptions: { environment } },
        'expo-router/_ctx',
        'web',
      )
      expect(server.filePath).toBe('ORIG:expo-router/_ctx')
    }
  })

  it('uses the filtered route context when the client resolver omits its environment', () => {
    const { customResolverOptions: _environment, ...clientWithoutEnvironment } = ctx
    const web = resolveRequest(clientWithoutEnvironment, 'expo-router/_ctx', 'web')
    expect(web.filePath.replace(/\\/g, '/').endsWith(ROUTE_CONTEXT_STUB_REL)).toBe(true)
  })

  // #2741: the web export uses Expo's granular chunk planner; the merge pass
  // lives in scripts/lib/granularChunkMerge.js (unit-tested in
  // granularChunkMerge.test.ts) and reaches the planner through metro.config.
  it('wires the granular web export and the merge pass through metro.config', () => {
    jest.resetModules()
    const cfg = require(path.join(ROOT, 'metro.config.js'))
    const { mergeGranularChunkPlan } = require(path.join(ROOT, 'scripts/lib/granularChunkMerge.js'))
    expect(cfg.serializer.unstable_granularWebExport).toBe(true)
    expect(cfg.serializer.unstable_mergeGranularChunkPlan).toBe(mergeGranularChunkPlan)
  })

  it('keeps the two-line granular patch applied after install and nothing of the old strategy', () => {
    const patch = fs.readFileSync(path.join(ROOT, EXPO_CHUNK_PATCH_REL), 'utf8')
    const installedPlanner = fs.readFileSync(path.join(ROOT, EXPO_GRANULAR_STRATEGY_REL), 'utf8')
    const installedSerializers = fs.readFileSync(path.join(ROOT, EXPO_SERIALIZERS_REL), 'utf8')
    const installedChunks = fs.readFileSync(path.join(ROOT, EXPO_CHUNK_SERIALIZER_REL), 'utf8')
    const installedRuntime = fs.readFileSync(path.join(ROOT, EXPO_ASYNC_RUNTIME_REL), 'utf8')

    for (const marker of ['METRAVEL_MERGE_GRANULAR_PLAN', 'METRAVEL_GRANULAR_WEB_EXPORT']) {
      expect(patch).toContain(marker)
    }
    expect(installedPlanner).toContain('context.serializerConfig?.unstable_mergeGranularChunkPlan')
    expect(installedPlanner).toContain('mergePlan(rawPlan, context)')
    expect(installedSerializers).toContain('config.serializer?.unstable_granularWebExport === true')
    // Granular stays gated on a non-lazy web client export: native and dev keep legacy.
    expect(installedSerializers).toMatch(/context\.platform === 'web' && context\.environment === 'client'[^;]*!options\.dev && !isLazyBundle/)
    expect(installedChunks).not.toContain('Metravel')
    expect(fs.existsSync(path.join(ROOT, EXPO_OLD_STRATEGY_REL))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'patches/expo+58.0.19.patch'))).toBe(false)
    expect(installedRuntime).not.toContain('__METRAVEL_CHUNK_DEPS__')
  })
})

describe('PERF-014 gesture-handler web stub — completeness', () => {
  // The stub is only safe if it exports every symbol the first-party code imports
  // from react-native-gesture-handler; a missing export would be `undefined` at
  // runtime on web. This collects the named imports across the codebase and
  // asserts the stub provides each one.
  function collectImportedNames(): Set<string> {
    const names = new Set<string>()
    const exts = new Set(['.ts', '.tsx'])
    const skipDirs = new Set([
      'node_modules',
      'dist',
      'dist-stub',
      '.git',
      '.codex-temp',
      'coverage',
      'metro-stubs',
    ])
    const importRe =
      /import\s*\{([^}]+)}\s*from\s*['"]react-native-gesture-handler['"]/g

    const walk = (dir: string) => {
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        if (e.name.startsWith('.') && e.name !== '.') continue
        const full = path.join(dir, e.name)
        if (e.isDirectory()) {
          if (!skipDirs.has(e.name)) walk(full)
          continue
        }
        if (!exts.has(path.extname(e.name))) continue
        let src: string
        try {
          src = fs.readFileSync(full, 'utf8')
        } catch {
          continue
        }
        if (!src.includes('react-native-gesture-handler')) continue
        let m: RegExpExecArray | null
        importRe.lastIndex = 0
        while ((m = importRe.exec(src))) {
          for (const raw of m[1].split(',')) {
            const name = raw.trim().split(/\s+as\s+/)[0].trim()
            if (name) names.add(name)
          }
        }
      }
    }

    walk(ROOT)
    return names
  }

  it('stub exports every name imported from react-native-gesture-handler in app code', () => {
    const imported = collectImportedNames()
    expect(imported.size).toBeGreaterThan(0) // sanity: we actually scanned imports

    const stub = require(path.join(ROOT, STUB_REL))
    const missing = [...imported].filter((name) => stub[name] === undefined)
    expect(missing).toEqual([])
  })
})

describe('PERF-017 eager-web analyze guard', () => {
  it('prefers the client entry.js dump over a larger router-server dump', () => {
    const dumpDir = makeTempDir('metravel-eager-guard-')
    try {
      const clientEntry = path.join(ROOT, 'entry.js')
      const clientDep = path.join(ROOT, 'metro-stubs/react-native-gesture-handler.js')
      const serverEntry = path.join(ROOT, 'node_modules/@expo/router-server/node/render.js')
      const serverDep = path.join(ROOT, 'node_modules/react-dom/server.node.js')

      fs.writeFileSync(
        path.join(dumpDir, 'metro-analyze-111-2.json'),
        JSON.stringify({
          entry: clientEntry,
          count: 2,
          mods: [
            [clientEntry, 100, [clientDep]],
            [clientDep, 50, []],
          ],
        }),
      )
      fs.writeFileSync(
        path.join(dumpDir, 'metro-analyze-111-3.json'),
        JSON.stringify({
          entry: serverEntry,
          count: 3,
          mods: [
            [serverEntry, 5000, [serverDep]],
            [serverDep, 5000, []],
            [path.join(ROOT, 'node_modules/expo-router/head.js'), 5000, []],
          ],
        }),
      )

      const result = runNodeCli(
        [path.join(ROOT, 'scripts/guard-eager-web-bundle.js'), '--from-analyze', '--fail', '--json'],
        {
          METRO_DUMP_DIR: dumpDir,
          EAGER_BUDGET_KB: '1',
        },
      )

      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        eagerModules: 2,
      })
    } finally {
      fs.rmSync(dumpDir, { recursive: true, force: true })
    }
  })

  it('prefers the newest client dump after an optimization removes modules', () => {
    const dumpDir = makeTempDir('metravel-eager-latest-client-')
    try {
      const clientEntry = path.join(ROOT, 'entry.js')
      const staleNativeRoute = path.join(ROOT, 'app/(tabs)/profile.native.tsx')
      const stalePath = path.join(dumpDir, 'metro-analyze-333-2.json')
      const currentPath = path.join(dumpDir, 'metro-analyze-444-1.json')
      fs.writeFileSync(
        stalePath,
        JSON.stringify({
          entry: clientEntry,
          count: 2,
          mods: [
            [clientEntry, 100, [], [staleNativeRoute]],
            [staleNativeRoute, 50, []],
          ],
        }),
      )
      fs.writeFileSync(
        currentPath,
        JSON.stringify({ entry: clientEntry, count: 1, mods: [[clientEntry, 100, []]] }),
      )
      const now = new Date()
      const staleTime = new Date(now.getTime() - 60_000)
      fs.utimesSync(stalePath, staleTime, staleTime)
      fs.utimesSync(currentPath, now, now)

      const result = runNodeCli(
        [path.join(ROOT, 'scripts/guard-eager-web-bundle.js'), '--from-analyze', '--fail', '--json'],
        { METRO_DUMP_DIR: dumpDir },
      )

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        eagerModules: 1,
        platformIncompatibleRouteModules: 0,
      })
    } finally {
      fs.rmSync(dumpDir, { recursive: true, force: true })
    }
  })

  it('fails when a native-only app route re-enters the web client graph', () => {
    const dumpDir = makeTempDir('metravel-eager-native-route-')
    try {
      const clientEntry = path.join(ROOT, 'entry.js')
      const nativeRoute = path.join(ROOT, 'app/(tabs)/profile.native.tsx')
      fs.writeFileSync(
        path.join(dumpDir, 'metro-analyze-222-2.json'),
        JSON.stringify({
          entry: clientEntry,
          count: 2,
          mods: [
            [clientEntry, 100, [], [nativeRoute]],
            [nativeRoute, 50, []],
          ],
        }),
      )

      const result = runNodeCli(
        [path.join(ROOT, 'scripts/guard-eager-web-bundle.js'), '--from-analyze', '--fail', '--json'],
        { METRO_DUMP_DIR: dumpDir },
      )

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: false,
        platformIncompatibleRouteModules: 1,
      })
    } finally {
      fs.rmSync(dumpDir, { recursive: true, force: true })
    }
  })
})
