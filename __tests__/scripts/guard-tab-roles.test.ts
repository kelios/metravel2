import fs from 'node:fs'
import path from 'node:path'

import { makeTempDir, removeDir } from './cli-test-utils'

const {
  collectViolations,
  findViolationsInSource,
  lineWritesTabRole,
} = require('../../scripts/guard-tab-roles')

// #2262 / IOS-TAB-ROLE-TRAIT-001: роль вкладки и ряда вкладок ставит только
// `utils/a11yTabRoles.ts` — на iOS `tab`/`tablist` не дают трейта. Страж судит
// обе стороны: реальное дерево проходит, возвращённая прямая роль — падает.
describe('guard-tab-roles', () => {
  it('ловит прямую роль вкладки и ряда во всех формах записи', () => {
    expect(lineWritesTabRole('accessibilityRole="tab"')).toBe(true)
    expect(lineWritesTabRole("<View style={styles.wrapper} accessibilityRole='tablist'>")).toBe(true)
    expect(lineWritesTabRole("accessibilityRole={'tablist' as any}")).toBe(true)
    expect(lineWritesTabRole("accessibilityRole={isWeb ? 'tab' : 'button'}")).toBe(true)
    expect(lineWritesTabRole('<View role="tablist">')).toBe(true)
    expect(lineWritesTabRole("role: 'tab',")).toBe(true)
    expect(lineWritesTabRole("role: Platform.select({ ios: 'button', default: 'tab' }),")).toBe(true)
  })

  it('не трогает помощник, другие роли, ключи и селекторы', () => {
    expect(lineWritesTabRole('{...getTabA11yProps(active)}')).toBe(false)
    expect(lineWritesTabRole('<View {...getTabListA11yProps()}>')).toBe(false)
    expect(lineWritesTabRole('accessibilityRole="button" testID="tab"')).toBe(false)
    expect(lineWritesTabRole("key: 'tab',")).toBe(false)
    expect(lineWritesTabRole('document.querySelectorAll(\'[role="tab"]\')')).toBe(false)
  })

  it('комментарий с ролью — не нарушение, код в той же строке — нарушение', () => {
    expect(findViolationsInSource('components/ui/Tabs.tsx', '// было accessibilityRole="tab"\n')).toEqual([])
    // Многострочный JSDoc: строка ` * role: 'tab'` — проза, не код.
    expect(
      findViolationsInSource('components/ui/Tabs.tsx', "/**\n * Пример:\n *   role: 'tab'\n */\nconst a = 1\n"),
    ).toEqual([])
    // `//` внутри строки не обрезает код после неё.
    expect(
      findViolationsInSource('components/ui/Tabs.tsx', "<Tab href='http://x' accessibilityRole=\"tab\" />\n"),
    ).toEqual(["components/ui/Tabs.tsx:1: <Tab href='http://x' accessibilityRole=\"tab\" />"])
    expect(
      findViolationsInSource('components/ui/Tabs.tsx', 'const a = 1\n  const row = <View accessibilityRole="tab" /> // вкладка\n'),
    ).toEqual(['components/ui/Tabs.tsx:2: const row = <View accessibilityRole="tab" /> // вкладка'])
  })

  it('негативная проба на дереве: прямая роль роняет стража, владелец ролей — нет', () => {
    const root = makeTempDir('guard-tab-roles-')
    try {
      fs.mkdirSync(path.join(root, 'components/profile'), { recursive: true })
      fs.mkdirSync(path.join(root, 'utils'), { recursive: true })
      fs.writeFileSync(
        path.join(root, 'components/profile/LegacyTabs.tsx'),
        "export const Tabs = () => (\n  <View accessibilityRole={'tablist' as any}>\n    <Pressable accessibilityRole=\"tab\" />\n  </View>\n)\n",
      )
      fs.writeFileSync(
        path.join(root, 'utils/a11yTabRoles.ts'),
        "const TAB_ROLES_DEFAULT = { tab: 'tab', tablist: 'tablist' }\nexport const tab = { accessibilityRole: 'tab' }\n",
      )

      expect(collectViolations(root)).toEqual([
        "components/profile/LegacyTabs.tsx:2: <View accessibilityRole={'tablist' as any}>",
        'components/profile/LegacyTabs.tsx:3: <Pressable accessibilityRole="tab" />',
      ])
    } finally {
      removeDir(root)
    }
  })

  it('detects multiline JSX/conditional/Platform.select roles without reading comments or selectors', () => {
    const code = `const tabs = <View accessibilityRole={
      condition ? 'tablist' : 'button'
    } />;
    const props = { role: Platform.select({
      ios: 'button',
      default: 'tab'
    }) };
    // accessibilityRole={'tab'}
    const selector = '[role="tab"]';
    const label = { title: 'tablist' };`;
    expect(findViolationsInSource('components/Tabs.tsx', code)).toEqual([
      'components/Tabs.tsx:1: const tabs = <View accessibilityRole={',
      'components/Tabs.tsx:4: const props = { role: Platform.select({',
    ]);
    expect(findViolationsInSource('components/Tabs.tsx', code.replaceAll("'tablist'", "'button'").replaceAll("'tab'", "'button'"))).toEqual([]);
  })

  it('реальное дерево проекта чистое', () => {
    expect(collectViolations()).toEqual([])
  })
})

describe('canonical helper pairs (#2309)', () => {
  it('rejects a called tab helper with only an imported or commented list helper', () => {
    const source = `import {getTabA11yProps as tab, getTabListA11yProps as row} from '@/utils/a11yTabRoles';
      // row()
      const literal='row()'; const control=<View {...tab(true)} />;`
    expect(findViolationsInSource('components/Row.tsx', source)).toHaveLength(1)
  })
  it('accepts actual aliased and namespace pairs and ignores unrelated same names', () => {
    expect(findViolationsInSource('components/Row.tsx', `import {getTabA11yProps as tab,getTabListA11yProps as row} from '@/utils/a11yTabRoles'; const x=<View {...row()}><View {...tab(true)}/></View>`)).toEqual([])
    expect(findViolationsInSource('components/Row.tsx', `import * as roles from '@/utils/a11yTabRoles'; const x=<View {...roles.getTabListA11yProps()}><View {...roles.getTabA11yProps(true)}/></View>`)).toEqual([])
    expect(findViolationsInSource('components/Other.tsx', `import {getTabA11yProps} from './unrelated'; getTabA11yProps(true)`)).toEqual([])
  })
})
