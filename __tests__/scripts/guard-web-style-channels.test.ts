const fs = require('fs')
const path = require('path')

const {
  KNOWN_PSEUDO_CLASS_STYLE_KEY_DEBT,
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

  describe('pseudo-class style keys (#2036)', () => {
    const namesOf = (sites: { name: string }[]) => sites.map((site) => site.name)

    it("flags the card's fixture: StyleSheet.create({ a: { ':hover': {} } })", () => {
      const result = evaluateGuard({
        sources: [ROOT_LAYOUT, tsx(`const styles = StyleSheet.create({ a: { ':hover': {} } })`)],
        debt: {},
        pseudoClassDebt: {},
      })
      expect(result.ok).toBe(false)
      expect(result.violations).toEqual([
        {
          rule: 'pseudo-class-style-key',
          file: 'components/Sample.tsx',
          line: 1,
          snippet:
            "':hover' is not CSS on react-native-web (compiles to an invalid rule); " +
            'use Pressable hovered/pressed/focused state or a dataSet-marked rule in app/global.css',
        },
      ])
    })

    it('flags every pseudo-class spelling wherever the object goes: factory, Platform.select, props, type', () => {
      const { pseudoClassKeys } = analyzeSource(
        tsx(`
          const createStyles = (colors) => StyleSheet.create({
            button: {
              ...Platform.select({ web: { ':hover': { opacity: 0.8 }, ':active': { opacity: 0.6 } } }),
              '&:hover': {},
              '& :focus': {},
              ':focus-visible': {},
              '::placeholder': {},
              [':visited']: {},
            },
          })
          const A = () => <Pressable {...Platform.select({ web: { cursor: 'pointer', ':focus': {} } })} />
          interface ContainerStyle extends ViewStyle { ':hover'?: ViewStyle }
        `),
      )
      expect(namesOf(pseudoClassKeys)).toEqual([
        ':hover',
        ':active',
        '&:hover',
        '& :focus',
        ':focus-visible',
        '::placeholder',
        ':visited',
        ':focus',
        ':hover',
      ])
    })

    it('ignores selectors in values, ordinary keys and colons that start no selector', () => {
      const { pseudoClassKeys } = analyzeSource(
        tsx(`
          // ':hover': { opacity: 0.8 }
          const css = { content: ':hover', selector: '[data-x]:hover', hover: { opacity: 1 }, 'aria-label': 'x' }
          const map = { 'a:b': 1, ':': 2, ':1': 3, '12:30': 4 }
        `),
      )
      expect(pseudoClassKeys).toEqual([])
    })

    it('keeps sites from before the rule in their own debt list with the exact count', () => {
      const debtFile = 'components/OldHover.tsx'
      const twoKeys = tsx(`const s = StyleSheet.create({ a: { ':hover': {} }, b: { ':focus': {} } })`, debtFile)
      const withDebt = (count: number) =>
        evaluateGuard({ sources: [ROOT_LAYOUT, twoKeys], debt: {}, pseudoClassDebt: { [debtFile]: count } })

      expect(withDebt(2).ok).toBe(true)
      expect(rulesOf(withDebt(1))).toEqual(['debt-count'])
      expect(rulesOf(withDebt(3))).toEqual(['debt-count'])

      const fixed = tsx(`const s = StyleSheet.create({ a: {}, b: {} })`, debtFile)
      expect(
        evaluateGuard({ sources: [ROOT_LAYOUT, fixed], debt: {}, pseudoClassDebt: { [debtFile]: 2 } }).violations,
      ).toEqual([
        {
          rule: 'stale-entry',
          file: debtFile,
          line: 0,
          snippet: 'no pseudo-class style key site left — drop the entry from KNOWN_PSEUDO_CLASS_STYLE_KEY_DEBT',
        },
      ])
    })

    it('is paid off by #2036: no pseudo-class style key is carried as debt', () => {
      // Сорок ключей `':hover'` и девять `':focus'`/`':active'` разобраны в #2036;
      // новое место сразу пишется состоянием `Pressable` или правилом `app/global.css`.
      expect(KNOWN_PSEUDO_CLASS_STYLE_KEY_DEBT).toEqual({})
    })
  })

  describe('title spreads (#2261)', () => {
    it('flags the #2261 shapes: a cast literal, Platform.select and a ternary spread on a component', () => {
      const source = tsx(`import { View, Pressable } from 'react-native';
        export const Sample = ({ label, open }) => (
          <>
            <Pressable accessibilityLabel={label} {...({ title: label } as any)} />
            <Pressable {...({ title } as any)} />
            <Pressable {...Platform.select({ web: { title: label, onMouseDown } as any })} />
            <View {...(Platform.OS === 'web' ? ({ role: 'button', title: open ? 'a' : 'b' } as any) : null)} />
            <Pressable {...webOnly(label ? ({ cursor: 'pointer', title: label } as any) : {})} />
          </>
        )
      `)

      expect(analyzeSource(source).titleSpreads).toEqual([
        { line: 4, target: '<Pressable>' },
        { line: 5, target: '<Pressable>' },
        { line: 6, target: '<Pressable>' },
        { line: 7, target: '<View>' },
        { line: 8, target: '<Pressable>' },
      ])

      const result = evaluateGuard({ sources: [ROOT_LAYOUT, source], debt: {} })
      expect(result.ok).toBe(false)
      expect(rulesOf(result)).toEqual(Array(5).fill('title-spread'))
      expect(result.violations[0].snippet).toContain('webTitleRef')
    })

    it('leaves title alone where it is an ordinary field: prop value, DOM element, data object', () => {
      const source = tsx(`import { Text, Pressable } from 'react-native';
        const screen = { title: 'Профиль' }
        const select = Platform.select({ web: { title: 'x' } })
        const helper = (title) => (Platform.OS === 'web' ? ({ title } as any) : {})
        export const Sample = ({ label }) => (
          <>
            <Stack.Screen options={{ title: label }} />
            <Card title={label} meta={{ ...screen, title: label }} />
            <div {...({ title: label } as any)} />
            <button {...Platform.select({ web: { title: label } })} />
            <Pressable ref={webTitleRef(label)} {...screen} />
            <Text>{i18nT('key', { title: label })}</Text>
          </>
        )
      `)

      expect(analyzeSource(source).titleSpreads).toEqual([])
      expect(evaluateGuard({ sources: [ROOT_LAYOUT, source], debt: {} }).ok).toBe(true)
    })

    it('parses a file that has nothing but a title spread', () => {
      const source = tsx(`import { Pressable } from 'react-native';\nexport const A = ({ t }) => (\n  <Pressable\n    {...({\n      title: t,\n    } as any)}\n  />\n)\n`)
      expect(analyzeSource(source).titleSpreads).toEqual([{ line: 5, target: '<Pressable>' }])
    })
  })

  describe('title-spread import provenance and lexical binding (#2284)', () => {
    const targets = (source: string) => analyzeSource(tsx(source)).titleSpreads.map((site) => site.target)

    it('resolves named aliases, namespaces and immutable captured aliases without external resolution', () => {
      const source = `
        import { View as Box, Pressable } from 'react-native-web';
        import * as RN from 'react-native';
        const Alias = (Box as any); const Chain = Alias!;
        const R = RN; const { View: Destructured } = R;
        const A = () => <><Box {...{title}}/><Pressable {...{title}}/>
          <RN.View {...{title}}/><RN.Pressable {...{title}}/>
          <Chain {...{title}}/><R.View {...{title}}/><Destructured {...{title}}/></>;
        const Captured = Box;
        const B = ({ Box }) => <><Box {...{title}}/><Captured {...{title}}/></>;
      `
      expect(targets(source)).toEqual([
        '<Box>', '<Pressable>', '<RN.View>', '<RN.Pressable>', '<Chain>',
        '<R.View>', '<Destructured>', '<Captured>',
      ])
      const result = evaluateGuard({ sources: [ROOT_LAYOUT, tsx(source)], debt: {} })
      expect(result.violations).toHaveLength(8)
      expect(result.violations.every((site) => site.rule === 'title-spread')).toBe(true)
      expect(Object.keys(analyzeSource(tsx(source)).titleSpreads[0]).sort()).toEqual(['line', 'target'])
    })

    it.each([
      ['custom import', "import { View } from './custom'; const A = () => <View {...{title}}/>;"],
      ['unbound spelling', 'const A = () => <View {...{title}}/>;'],
      ['local function', 'function View() {} const A = () => <View {...{title}}/>;'],
      ['local class', 'class View {} const A = () => <View {...{title}}/>;'],
      ['local const', 'const View = custom; const A = () => <View {...{title}}/>;'],
      ['parameter', "import { View } from 'react-native'; function A(View) { return <View {...{title}}/> }"],
      ['destructured parameter', "import { View } from 'react-native'; const A = ({View}) => <View {...{title}}/>;"],
      ['nested parameter', "import { View } from 'react-native'; const A = ({item: {View}}) => <View {...{title}}/>;"],
      ['renamed parameter', "import { View } from 'react-native'; const A = ({x: View}) => <View {...{title}}/>;"],
      ['local destructuring', "import { View } from 'react-native'; function A() { const {View} = custom; return <View {...{title}}/> }"],
      ['rest parameter', "import { View } from 'react-native'; const A = ({...View}) => <View {...{title}}/>;"],
      ['namespace parameter', "import * as RN from 'react-native'; const A = (RN) => <RN.View {...{title}}/>;"],
      ['destructured namespace', "import * as RN from 'react-native'; const A = ({RN}) => <RN.View {...{title}}/>;"],
      ['local namespace', "import * as RN from 'react-native'; function A() { const RN = custom; return <RN.View {...{title}}/> }"],
      ['hoisted function', "import { View } from 'react-native'; function A() { const Alias = View; function View(){} return <Alias {...{title}}/> }"],
      ['catch binding', "import { View } from 'react-native'; try {} catch(View) { const a = <View {...{title}}/> }"],
      ['loop binding', "import { View } from 'react-native'; for(const View of items) { const a = <View {...{title}}/> }"],
      ['block binding', "import { View } from 'react-native'; { const View = custom; const a = <View {...{title}}/> }"],
      ['function-hoisted var', "import { View } from 'react-native'; function A(){ const Alias = View; var View = custom; return <Alias {...{title}}/> }"],
      ['type-only import', "import type { View } from 'react-native'; const A = () => <View {...{title}}/>;"],
      ['type-only specifier', "import { type View } from 'react-native'; const A = () => <View {...{title}}/>;"],
      ['default import', "import View from 'react-native'; const A = () => <View {...{title}}/>;"],
      ['mutable alias', "import { View } from 'react-native'; let Alias = View; const A = () => <Alias {...{title}}/>;"],
      ['unknown wrapper', "import { View } from 'react-native'; const Alias = wrap(View); const A = () => <Alias {...{title}}/>;"],
      ['alias cycle', 'const A = B; const B = A; const C = () => <A {...{title}}/>;'],
      ['destructure default', "import * as RN from 'react-native'; const { View = custom } = RN; const A = () => <View {...{title}}/>;"],
      ['computed destructuring', "import * as RN from 'react-native'; const { ['View']: Box } = RN; const A = () => <Box {...{title}}/>;"],
      ['DOM/custom fields', 'const A = () => <><div {...{title}}/><button {...{title}}/><Card {...{title}}/><Card options={{title}}/></>;'],
    ])('allows %s while retaining an independent proven RN target', (_family, source) => {
      expect(targets(`${source}\nimport { Pressable as Proven } from 'react-native'; const Control = () => <Proven {...{title}}/>;`))
        .toEqual(['<Proven>'])
    })

    it('preserves the semantic title prop on RN Button/RefreshControl and ignores type-only namespaces', () => {
      expect(targets(`
        import { Button, RefreshControl, Pressable } from 'react-native';
        import type * as Types from 'react-native';
        const A = () => <><Button {...{title: 'Save'}}/><RefreshControl {...{title: 'Refresh'}}/>
          <Types.View {...{title}}/><Pressable {...{title}}/></>;
      `)).toEqual(['<Pressable>'])
    })

    it('recognizes outer RN bindings independently of a shadowed scope', () => {
      expect(targets(`
        import { View } from 'react-native'; import * as RN from 'react-native-web';
        const Shadow = ({ View, RN }) => <><View {...{title}}/><RN.View {...{title}}/></>;
        const Outer = () => <><View {...{title}}/><RN.View {...{title}}/></>;
      `)).toEqual(['<View>', '<RN.View>'])
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

  describe('inline animationKeyframes (#2215)', () => {
    it("flags the ShimmerOverlay shape: keyframes in an inline style object", () => {
      const result = evaluateGuard({
        sources: [
          ROOT_LAYOUT,
          tsx(
            `import { View, StyleSheet } from 'react-native'\n` +
              `export const A = () => <View style={{ ...StyleSheet.absoluteFillObject, animationKeyframes: 'slider-shimmer' }} />\n`,
          ),
        ],
      })
      expect(rulesOf(result)).toEqual(['inline-animation-keyframes'])
      expect(result.violations[0].line).toBe(2)
    })

    it('flags keyframes in a style factory that never reaches StyleSheet.create', () => {
      const { inlineKeyframes } = analyzeSource(
        tsx(`const pulse = (on: boolean) => (on ? { animationKeyframes: { '0%': { opacity: 1 } } } : {})\n`),
      )
      expect(inlineKeyframes).toHaveLength(1)
    })

    it('accepts keyframes inside StyleSheet.create: nested, Platform.select, wrapper call, conditional spread', () => {
      const { inlineKeyframes } = analyzeSource(
        tsx(
          [
            `import { Platform, StyleSheet } from 'react-native'`,
            `import { webViewStyle } from '@/utils/webProps'`,
            `const s = (open: boolean) => StyleSheet.create({`,
            `  a: { animationKeyframes: 'fadeIn' },`,
            `  b: Platform.select({ web: webViewStyle({ animationKeyframes: { '0%': { opacity: 1 } } }), default: {} }),`,
            `  c: { ...(open ? ({ animationKeyframes: 'sheet-slide-up' } as any) : {}) },`,
            `})`,
          ].join('\n'),
        ),
      )
      expect(inlineKeyframes).toEqual([])
    })

    it('flags keyframes passed as a non-first StyleSheet.create argument or to another call', () => {
      const { inlineKeyframes } = analyzeSource(
        tsx(`import { StyleSheet } from 'react-native'\nStyleSheet.flatten([{}, { animationKeyframes: 'x' }])\n`),
      )
      expect(inlineKeyframes).toHaveLength(1)
    })
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
