/**
 * @jest-environment node
 */

/**
 * #2742 — iOS-кастомизации нативного проекта живут в `plugins/withIosNativeProject.js`,
 * а tracked `ios/` — результат `expo prebuild --clean`. Тест держит контракт
 * плагина: Info.plist сохраняет проверенные release guard значения, Podfile-
 * правки идемпотентны, а app-owned ресурсы плагина совпадают с tracked-проектом.
 * Полная сверка генерации — `npm run ios:native:parity`.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'

const plugin = require('../../plugins/withIosNativeProject') as {
  INFO_PLIST_KEYS_TO_DROP: string[]
  PROJECT_NAME: string
  applyInfoPlistContract: (info: Record<string, unknown>) => Record<string, unknown>
  applyPodfileContract: (contents: string) => string
}

const REPO_ROOT = path.resolve(__dirname, '../..')

const TEMPLATE_PODFILE = `target 'metravel' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`

describe('withIosNativeProject (#2742)', () => {
  it('keeps the audited Info.plist contract over plugin and template additions', () => {
    const info = plugin.applyInfoPlistContract({
      CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)',
      CFBundleShortVersionString: '1.0.5',
      CFBundleVersion: '14',
      CFBundleAllowMixedLocalizations: true,
      LSMinimumSystemVersion: '12.0',
      NSBonjourServices: ['_expo._tcp'],
      NSLocalNetworkUsageDescription: 'Expo Dev Launcher uses the local network',
      NSLocationTemporaryUsageDescriptionDictionary: { ExpoLocationFullAccuracy: 'x' },
      SKAdNetworkItems: [{ SKAdNetworkIdentifier: 'v9wttpbfk9.skadnetwork' }],
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationLandscapeLeft'],
      NSCameraUsageDescription: 'kept',
    })

    expect(info).toEqual({
      CFBundleDevelopmentRegion: 'ru',
      CFBundleShortVersionString: '$(MARKETING_VERSION)',
      CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
      RCTNewArchEnabled: true,
      UISupportedInterfaceOrientations: [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
      ],
      NSCameraUsageDescription: 'kept',
    })
  })

  it('adds the Podfile customizations once', () => {
    const once = plugin.applyPodfileContract(TEMPLATE_PODFILE)

    expect(once).toContain("pod 'GoogleUtilities', :modular_headers => true")
    expect(once).toContain("pod 'RecaptchaInterop', :modular_headers => true")
    expect(once).toContain("config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'")
    expect(plugin.applyPodfileContract(once)).toBe(once)
  })

  it('fails loudly when the template Podfile anchor moves', () => {
    expect(() => plugin.applyPodfileContract("target 'metravel' do\nend\n")).toThrow(
      /Podfile anchor not found/,
    )
  })

  it('ships the same app-owned resources the tracked project links', () => {
    const resources = ['PrivacyInfo.xcprivacy', 'en', 'ru', 'be', 'uk', 'pl'].map((entry) =>
      entry.endsWith('.xcprivacy') ? entry : `${entry}.lproj/InfoPlist.strings`,
    )

    for (const resource of resources) {
      const source = fs.readFileSync(path.join(REPO_ROOT, 'plugins/ios', resource))
      const tracked = fs.readFileSync(path.join(REPO_ROOT, 'ios', plugin.PROJECT_NAME, resource))
      expect({ resource, equal: source.equals(tracked) }).toEqual({ resource, equal: true })
    }
  })

  it('runs first among app.json plugins so its mods apply last', () => {
    const app = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'app.json'), 'utf8'))

    expect(app.expo.plugins[0]).toBe('./plugins/withIosNativeProject')
  })
})

describe('ios-native-parity project comparison (#2742)', () => {
  const xcode = require('xcode')
  const { compareProjects } = require('../../scripts/ios-native-parity') as {
    compareProjects: (trackedPath: string, generatedPath: string) => string[]
  }
  const TRACKED_PBXPROJ = path.join(REPO_ROOT, 'ios/metravel.xcodeproj/project.pbxproj')

  const withMutatedProject = (mutate: (objects: any) => void) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-parity-test-'))
    try {
      const project = xcode.project(TRACKED_PBXPROJ)
      project.parseSync()
      mutate(project.hash.project.objects)
      const mutatedPath = path.join(dir, 'project.pbxproj')
      fs.writeFileSync(mutatedPath, project.writeSync())
      return compareProjects(mutatedPath, TRACKED_PBXPROJ)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
  const mainTarget = (objects: any) => objects.PBXNativeTarget['13B07F861A680F5B00A75B9A']
  const targetConfigs = (objects: any) =>
    Object.entries(objects.XCBuildConfiguration)
      .filter(([id]) => !id.endsWith('_comment'))
      .map(([, value]) => value as { buildSettings: Record<string, unknown> })
      .filter((configuration) => configuration.buildSettings.INFOPLIST_FILE)

  it('accepts an unchanged project', () => {
    expect(withMutatedProject(() => {})).toEqual([])
  })

  it('reports a reordered build phase list', () => {
    const problems = withMutatedProject((objects) => {
      mainTarget(objects).buildPhases.reverse()
    })

    expect(problems).toEqual([expect.stringContaining('13B07F861A680F5B00A75B9A')])
  })

  it('reports a hand-edited runpath build setting', () => {
    const problems = withMutatedProject((objects) => {
      for (const configuration of targetConfigs(objects)) {
        configuration.buildSettings.LD_RUNPATH_SEARCH_PATHS = '"$(inherited)"'
      }
    })

    expect(problems.length).toBeGreaterThan(0)
  })
})
