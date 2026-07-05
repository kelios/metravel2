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
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

const ROOT = path.resolve(__dirname, '..', '..')
const STUB_REL = 'metro-stubs/react-native-gesture-handler.js'

describe('PERF-014 gesture-handler web stub — metro.config resolver', () => {
  let resolveRequest: (ctx: any, name: string, platform: string) => any

  beforeAll(() => {
    jest.resetModules()
    const cfg = require(path.join(ROOT, 'metro.config.js'))
    resolveRequest = cfg?.resolver?.resolveRequest
  })

  const ctx = {
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
    const dumpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-eager-guard-'))
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

      const result = spawnSync(
        process.execPath,
        [path.join(ROOT, 'scripts/guard-eager-web-bundle.js'), '--from-analyze', '--fail', '--json'],
        {
          cwd: ROOT,
          env: {
            ...process.env,
            METRO_DUMP_DIR: dumpDir,
            EAGER_BUDGET_KB: '1',
          },
          encoding: 'utf8',
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
})
