/**
 * Worklets transform contract (board #2469, Task Contract «бандл dev и prod
 * содержит __workletHash»).
 *
 * babel.config.js relies on babel-preset-expo to attach
 * `react-native-worklets/plugin`; nothing in the project adds it by hand.
 * If a preset option, a preset upgrade or a manual plugin ever drops or
 * doubles the plugin, reanimated breaks only at runtime on a device. This
 * test runs the real project Babel config the way Metro does (caller with
 * platform + dev flag) and asserts the three facts the native side depends on:
 *   - every `'worklet'` function and every useAnimatedStyle callback gets
 *     `__workletHash` on android and ios, in dev and production;
 *   - the plugin version stamped into the dev bundle is the installed
 *     react-native-worklets version (the JS runtime refuses a mismatch);
 *   - the JS runtime version constant matches package.json, so the native
 *     version check compares real numbers.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { transformFileSync } from '@babel/core'

const ROOT = process.cwd()
const workletsVersion = require('react-native-worklets/package.json').version as string

const PROBE = `
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
export function useProbeStyle() {
  const v = useSharedValue(0);
  return useAnimatedStyle(() => ({ opacity: v.value }));
}
export const probeWorklet = () => { 'worklet'; return 1; };
`

// The worklets plugin re-reads the source from disk for the worklet init data,
// so the probe has to exist as a real file.
const probeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worklets-probe-'))
const probePath = path.join(probeDir, 'probe.tsx')
beforeAll(() => fs.writeFileSync(probePath, PROBE))
afterAll(() => fs.rmSync(probeDir, { recursive: true, force: true }))

const transform = (platform: 'android' | 'ios', envName: 'development' | 'production') => {
  const result = transformFileSync(probePath, {
    cwd: ROOT,
    root: ROOT,
    configFile: path.join(ROOT, 'babel.config.js'),
    babelrc: false,
    envName,
    caller: { name: 'metro', bundler: 'metro', platform, isDev: envName === 'development', supportsStaticESM: false },
    sourceMaps: false,
    compact: true,
  })
  if (!result?.code) throw new Error('babel produced no code')
  return result.code
}

describe('react-native-worklets babel plugin reaches the native bundles (#2469)', () => {
  it.each([
    ['android', 'development'],
    ['android', 'production'],
    ['ios', 'development'],
    ['ios', 'production'],
  ] as const)('%s / %s: both worklets are hashed with the installed plugin version', (platform, envName) => {
    const code = transform(platform, envName)
    expect(code.match(/__workletHash=/g)?.length).toBe(2)
    const pluginVersions = [...code.matchAll(/__pluginVersion="([^"]+)"/g)].map((match) => match[1])
    // The plugin stamps its version only into dev bundles (the runtime check is dev-only).
    expect(pluginVersions).toEqual(envName === 'development' ? [workletsVersion, workletsVersion] : [])
  })

  it('keeps the JS runtime version constant in sync with package.json', () => {
    const { jsVersion } = require('react-native-worklets/lib/module/debug/jsVersion.js')
    expect(jsVersion).toBe(workletsVersion)
  })
})
