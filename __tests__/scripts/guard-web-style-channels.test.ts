const fs = require('fs')
const path = require('path')

const {
  KNOWN_RAW_DATA_ATTRIBUTE_DEBT,
  OUTPUT_CONTRACT_VERSION,
  ROOT_STYLESHEET,
  analyzeSource,
  buildJsonResult,
  collectSourceFiles,
  evaluateGuard,
  parseArgs,
  shouldScanFile,
} = require('@/scripts/guard-web-style-channels')

const ROOT_LAYOUT = {
  filePath: ROOT_STYLESHEET.file,
  content: `import { Platform } from 'react-native'\nif (Platform.OS === 'web') {\n  require('${ROOT_STYLESHEET.specifier}')\n}\n`,
}

const tsx = (content: string, filePath = 'components/Sample.tsx') => ({ filePath, content })

const rulesOf = (result: { violations: { rule: string }[] }) => result.violations.map((v) => v.rule)

const readRealTree = () => {
  const rootDir = process.cwd()
  return collectSourceFiles(rootDir).map((filePath: string) => ({
    filePath,
    content: fs.readFileSync(path.join(rootDir, filePath), 'utf8'),
  }))
}

describe('guard-web-style-channels', () => {
  it('parses --json flag', () => {
    expect(parseArgs([])).toEqual({ output: 'text' })
    expect(parseArgs(['--json'])).toEqual({ output: 'json' })
  })

  it('scans web app sources only', () => {
    expect(shouldScanFile('components/travel/compactSideBar/parts/NavRow.tsx')).toBe(true)
    expect(shouldScanFile('app/_layout.tsx')).toBe(true)
    expect(shouldScanFile('utils/foo.js')).toBe(true)
    expect(shouldScanFile('components/travel/Map.native.tsx')).toBe(false)
    expect(shouldScanFile('components/travel/Map.android.tsx')).toBe(false)
    expect(shouldScanFile('components/travel/Map.test.tsx')).toBe(false)
    expect(shouldScanFile('components/travel/__tests__/Map.tsx')).toBe(false)
    expect(shouldScanFile('__tests__/components/Home.test.tsx')).toBe(false)
    expect(shouldScanFile('scripts/guard-web-style-channels.js')).toBe(false)
    expect(shouldScanFile('app/global.css')).toBe(false)
  })

  describe('raw data-* attributes', () => {
    it('flags the #2032 shape: a literal key in a JSX spread on a react-native-web component', () => {
      const { attributes } = analyzeSource(
        tsx(`
          const Row = ({ active }) => (
            <Pressable
              {...webOnly({
                'data-sidebar-link': true,
                'data-active': active ? 'true' : 'false',
                role: 'button',
              } as any)}
            >
              <View {...webOnly({ 'data-icon': true } as any)} />
              <Text {...(Platform.OS === 'web' ? { 'data-weather-title': true } : {})}>x</Text>
            </Pressable>
          )
        `),
      )
      expect(attributes.map((site: { name: string; target: string }) => `${site.name} ${site.target}`)).toEqual([
        'data-sidebar-link <Pressable>',
        'data-active <Pressable>',
        'data-icon <View>',
        'data-weather-title <Text>',
      ])
    })

    it("flags the card's fixture: 'data-foo': true in a JSX spread", () => {
      const result = evaluateGuard({
        sources: [ROOT_LAYOUT, tsx(`export const A = () => <View {...{ 'data-foo': true }} />`)],
        debt: {},
      })
      expect(result.ok).toBe(false)
      expect(result.violations).toEqual([
        {
          rule: 'raw-data-attribute',
          file: 'components/Sample.tsx',
          line: 1,
          snippet: "'data-foo' -> <View>",
        },
      ])
    })

    it('follows ternaries, logical operators, casts and nested spreads down to the element', () => {
      const { attributes } = analyzeSource(
        tsx(`
          const A = ({ on }) => (
            <>
              <Animated.View {...(on && ({ 'data-a': 'x' } as any))} />
              <View {...(on ? null : { ...{ 'data-b': 'x' } })} />
              <View {...{ ['data-c']: 'x' }} />
            </>
          )
        `),
      )
      expect(attributes.map((site: { name: string; target: string }) => `${site.name} ${site.target}`)).toEqual([
        'data-a <Animated.View>',
        'data-b <View>',
        'data-c <View>',
      ])
    })

    it('flags a JSX data-* attribute on a component, including an alias of View', () => {
      const { attributes } = analyzeSource(
        tsx(`
          const WebView: any = View
          const A = () => <WebView data-card-action="true"><MapContainer data-testid="map" /></WebView>
        `),
      )
      expect(attributes.map((site: { name: string; target: string }) => `${site.name} ${site.target}`)).toEqual([
        'data-card-action <WebView>',
        'data-testid <MapContainer>',
      ])
    })

    it('flags an object whose way to an element it cannot prove', () => {
      const { attributes } = analyzeSource(
        tsx(`
          export const ROOT_PROPS = IS_WEB ? { testID: 'root', 'data-testid': 'root' } : {}
          const pick = () => Platform.select({ web: { 'data-x': '1' }, default: {} })
        `),
      )
      expect(attributes.map((site: { name: string; target: string }) => `${site.name} ${site.target}`)).toEqual([
        'data-testid unresolved',
        'data-x unresolved',
      ])
    })

    it('allows data-* on DOM elements', () => {
      const { attributes, dataSetKeys } = analyzeSource(
        tsx(`
          const A = ({ tag, testID, level }) => (
            <div data-testid="gallery" {...{ 'data-zoom': '1' }}>
              <input {...(isWeb ? { 'data-testid': 'file' } : {})} />
              {React.createElement('span', { 'data-kind': 'x' })}
              {React.createElement(tag as any, { 'data-testid': testID })}
              {React.createElement(\`h\${level}\`, { 'data-heading': 'x' })}
            </div>
          )
        `),
      )
      expect(attributes).toEqual([])
      expect(dataSetKeys).toEqual([])
    })

    it('flags createElement of a component', () => {
      const { attributes } = analyzeSource(
        tsx(`const A = () => React.createElement(View, { 'data-x': 'y' })`),
      )
      expect(attributes).toEqual([{ line: 1, name: 'data-x', target: 'createElement(View)' }])
    })

    it('accepts dataSet and ignores data-* outside prop keys', () => {
      const { attributes, dataSetKeys } = analyzeSource(
        tsx(`
          // 'data-in-comment': true
          const selector = '[data-sidebar-link]'
          const A = ({ active }) => {
            node.setAttribute('data-section-key', 'map')
            return (
              <Pressable
                {...webOnly({ dataSet: { sidebarLink: 'true', active: String(active) } })}
                {...({ dataSet: { cardAction: 'true' } } as any)}
              />
            )
          }
        `),
      )
      expect(attributes).toEqual([])
      expect(dataSetKeys).toEqual([])
    })

    it('flags a data- prefixed key inside dataSet', () => {
      const result = evaluateGuard({
        sources: [ROOT_LAYOUT, tsx(`const A = () => <View dataSet={{ 'data-card-action': 'true' }} />`)],
        debt: {},
      })
      expect(rulesOf(result)).toEqual(['data-key-in-dataset'])
    })

    it('reads .js files with JSX', () => {
      const { attributes } = analyzeSource({
        filePath: 'components/Legacy.js',
        content: `export const A = () => <View {...{ 'data-legacy': 1 }} />`,
      })
      expect(attributes).toHaveLength(1)
    })
  })

  describe('stylesheet imports', () => {
    it('flags the #2032 shape: a conditional require of *.web.css next to a component', () => {
      const result = evaluateGuard({
        sources: [
          ROOT_LAYOUT,
          tsx(
            `if (Platform.OS === 'web') {\n  require('./CompactSideBarTravel.web.css')\n}\n`,
            'components/travel/CompactSideBarTravel.tsx',
          ),
        ],
        debt: {},
      })
      expect(result.violations).toEqual([
        {
          rule: 'stylesheet-import',
          file: 'components/travel/CompactSideBarTravel.tsx',
          line: 2,
          snippet: './CompactSideBarTravel.web.css — the web export emits only app/_layout.tsx -> ./global.css',
        },
      ])
    })

    it('flags static and dynamic imports of CSS anywhere but the root layout', () => {
      const { stylesheets } = analyzeSource(
        tsx(`
          import 'leaflet/dist/leaflet.css'
          import styles from './Widget.css'
          const lazy = () => import('./late.css')
          const notCss = require('./theme.cssx')
        `),
      )
      expect(stylesheets.map((site: { specifier: string }) => site.specifier)).toEqual([
        'leaflet/dist/leaflet.css',
        './Widget.css',
        './late.css',
      ])
    })

    it('requires the root stylesheet import to stay in place', () => {
      const result = evaluateGuard({ sources: [tsx(`export const A = 1`)], debt: {} })
      expect(rulesOf(result)).toEqual(['root-stylesheet-missing'])

      const moved = evaluateGuard({
        sources: [{ filePath: 'app/+html.tsx', content: `import './global.css'` }],
        debt: {},
      })
      expect(rulesOf(moved)).toEqual(['stylesheet-import', 'root-stylesheet-missing'])
    })
  })

  describe('recorded debt', () => {
    const debtFile = 'components/Old.tsx'
    const twoSites = tsx(
      `const A = () => <View {...{ 'data-a': 1 }}><View {...{ 'data-b': 1 }} /></View>`,
      debtFile,
    )

    it('passes a debt file with exactly the recorded number of sites', () => {
      expect(evaluateGuard({ sources: [ROOT_LAYOUT, twoSites], debt: { [debtFile]: 2 } }).ok).toBe(true)
    })

    it('fails when a debt file gains or loses a site', () => {
      expect(rulesOf(evaluateGuard({ sources: [ROOT_LAYOUT, twoSites], debt: { [debtFile]: 1 } }))).toEqual([
        'debt-count',
      ])
      expect(rulesOf(evaluateGuard({ sources: [ROOT_LAYOUT, twoSites], debt: { [debtFile]: 3 } }))).toEqual([
        'debt-count',
      ])
    })

    it('fails on an entry with no site left', () => {
      const fixed = tsx(`const A = () => <View dataSet={{ a: '1' }} />`, debtFile)
      const result = evaluateGuard({ sources: [ROOT_LAYOUT, fixed], debt: { [debtFile]: 2 } })
      expect(result.violations).toEqual([
        {
          rule: 'stale-entry',
          file: debtFile,
          line: 0,
          snippet: 'no raw data-* site left — drop the entry from KNOWN_RAW_DATA_ATTRIBUTE_DEBT',
        },
      ])
    })

    it('does not carry the #2032 files: the sidebar and the weather widget are fixed', () => {
      expect(Object.keys(KNOWN_RAW_DATA_ATTRIBUTE_DEBT)).toEqual(
        expect.not.arrayContaining([
          'components/travel/CompactSideBarTravel.tsx',
          'components/travel/compactSideBar/parts/NavRow.tsx',
          'components/travel/compactSideBar/parts/AuthorBlock.tsx',
          'components/travel/compactSideBar/parts/WeatherPlaceholder.tsx',
          'components/home/WeatherWidget.tsx',
          'components/travel/TravelPdfExportControl.tsx',
          'components/ui/SubscribeButton.tsx',
        ]),
      )
    })

    it('is paid off by #2035: no raw data-* site is carried as debt any more', () => {
      // Долг только убывает; погашенный список не пополняется — новое место
      // сразу пишется через `dataSet` (`testID` для `data-testid`).
      expect(KNOWN_RAW_DATA_ATTRIBUTE_DEBT).toEqual({})
    })
  })

  it('fails on an empty scan', () => {
    expect(rulesOf(evaluateGuard({ sources: [], debt: {} }))).toEqual(['empty-scan'])
  })

  it('passes on the real tree', () => {
    const result = evaluateGuard({ sources: readRealTree() })
    expect(result.violations).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('builds a versioned json result', () => {
    const json = buildJsonResult({
      ok: false,
      reason: 'fail reason',
      violations: [{ rule: 'raw-data-attribute', file: 'a.tsx', line: 3, snippet: "'data-x' -> <View>" }],
    })
    expect(json).toEqual({
      contractVersion: OUTPUT_CONTRACT_VERSION,
      ok: false,
      reason: 'fail reason',
      violations: [{ rule: 'raw-data-attribute', file: 'a.tsx', line: 3, snippet: "'data-x' -> <View>" }],
      violationCount: 1,
    })
  })

  it('is wired into lint, lint:ci and check:fast', () => {
    // Гейт и есть регрессионный контроль класса: выпади он из общей цепочки,
    // следующий сырой `data-*` снова дожил бы до прода незамеченным.
    const readRepoFile = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
    const { scripts } = JSON.parse(readRepoFile('package.json'))
    expect(scripts['guard:web-style-channels']).toBe('node scripts/guard-web-style-channels.js')
    expect(scripts['guard:web-style-channels:json']).toBe('node scripts/guard-web-style-channels.js --json')
    expect(scripts.lint).toContain('npm run guard:web-style-channels')
    expect(scripts['lint:ci']).toContain('npm run guard:web-style-channels')
    expect(readRepoFile('scripts/run-fast-scope-checks.js')).toContain(
      "runCommand('npm', ['run', 'guard:web-style-channels'])",
    )
  })
})
